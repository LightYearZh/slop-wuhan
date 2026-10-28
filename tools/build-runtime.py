"""Adapt the audited Wuhan source layer to the Taipei runtime contract.

Source heights stay unchanged in city.json; display estimates are explicit metadata.
"""
from pathlib import Path
import collections, hashlib, json, math
from shapely.geometry import Polygon, LineString
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from runtime_streets import road_graph,road_details
from runtime_signs import build_signs

ROOT = Path(__file__).resolve().parents[1]
CLASSES = ['motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','service','pedestrian']
KINDS = ['RESIDENTIAL','COMMERCIAL','CIVIC','INDUSTRIAL','TEMPLE','CANOPY','HOUSE','STATION']
RULE = 'hankou-display-v1'

def seed_of(identifier):
    return int(hashlib.sha256(identifier.encode()).hexdigest()[:8],16)/0xffffffff

def display_height(b):
    if b['heightSource'] != 'visual-estimate':
        return b['h'], b['heightSource']
    area = Polygon(b['rings'][0],b['rings'][1:]).area
    r = seed_of(b['id']); category = b['category']
    # Conservative Hankou pilot typologies, not Taipei's tall commercial defaults.
    if category == 'historic': floors = 3 + int(r*3)
    elif category == 'industrial': floors = 2 + int(r*2)
    elif category == 'religious': floors = 2 + int(r*2)
    elif area < 65: floors = 1 + int(r*3)
    elif category == 'retail': floors = 4 + int(r*(5 if area>1200 else 3))
    elif category == 'office': floors = 7 + int(r*6)
    elif category == 'civic': floors = 3 + int(r*4)
    else: floors = 4 + int(r*(7 if area>700 else 3))
    return round(floors*(3.6 if category=='historic' else 3.2),1),'visual-estimate:'+RULE

def polygons(rows):
    return unary_union([Polygon(p[0],p[1:]) for p in rows])

def flat_polys(geom):
    if geom.is_empty: return []
    if geom.geom_type != 'Polygon':
        return [p for part in getattr(geom,'geoms',[]) for p in flat_polys(part)]
    p=orient(geom,sign=1)
    return [[[round(v,3) for point in list(r.coords)[:-1] for v in point] for r in [p.exterior,*p.interiors]]]

def encode_building(rings,h,base,kind):
    p=orient(Polygon(rings[0],rings[1:]),sign=1)
    out=[round(h*10),round(base*10),kind,len(p.interiors)+1]
    for ring in [p.exterior,*p.interiors]:
        pts=list(ring.coords)[:-1];out.append(len(pts));px=pz=0
        for i,(x,z) in enumerate(pts):
            x,z=round(x*10),round(z*10);out.extend([x-px if i else x,z-pz if i else z]);px,pz=x,z
    return out

def convert(city):
    graph=road_graph(city['roads'],city.get('streetNodes',[]));details=road_details(graph,city.get('streetNodes',[]))
    names,nodes,links,road_sources=[graph[k] for k in ('names','nodes','links','roadSourceIds')]
    buildings=[];meta=[];heights=collections.Counter();signs=[];sign_names=[]
    for b in city['buildings']:
        h,source=display_height(b);heights[source]+=1
        kind={'retail':1,'office':1,'civic':2,'industrial':3,'religious':2,'historic':2}.get(b['category'],0)
        # Documented podium / tower geometry survives the runtime migration.
        massing=b.get('massingParts') or [{'rings':b['rings'],'h':h,'baseY':0}]
        for part in massing:
            base=part.get('baseY',0);top=base+part['h']
            part_kind=1 if part.get('role') in ('tower','crown') else kind
            buildings.extend(encode_building(part['rings'],top,base,part_kind))
            meta.append({'sourceId':b['id'],'category':b['category'],'sourceHeight':None if b['heightSource']=='visual-estimate' else b['h'],
                         'sourceHeightType':b['heightSource'],'displayHeight':top,'displayHeightSource':source,'baseY':base,
                         'role':part.get('role'),'name':b['name']})
    sign_data,sign_rejected=build_signs(city,display_height)
    signs=sign_data['signs']
    water=polygons(city['water']);asphalt=polygons(city['asphalt']);ped=polygons(city['pedestrian'])
    sides=polygons(city['shoulders']).difference(asphalt).difference(ped).difference(water)
    landmark=city['landmarks'][0];spawn=city['spawn'];bounds=city['bounds']
    places=[[p['name'],p['x'],p['z'],1] for p in city['places']]
    teleports=[{'id':'jianghanguan','name':'江汉关博物馆','sub':'沿江大道 · 钟楼','x':spawn['x'],'z':spawn['z'],'heading':spawn['heading'],'road':'沿江大道'}]
    for p in city['places']:
        if p['name'] in ('江汉路','中山大道','沿江大道') or p.get('arrival'):
            arrival=p.get('arrival',p)
            teleports.append({'id':p['id'],'name':p['name'],'sub':'汉口核心区','x':arrival['x'],'z':arrival['z'],'heading':spawn['heading'],'road':p.get('road','')})
    geo={'version':1,'city':'wuhan','frame':{'lon0':city['origin'][0],'lat0':city['origin'][1],'units':'m'},
         'bounds':dict(zip(['minX','minZ','maxX','maxZ'],bounds)),'roadClasses':CLASSES,'names':names,'nodes':nodes,'links':links,
         'roadSourceIds':road_sources,'carriageway':flat_polys(asphalt),'pedestrian':flat_polys(ped),'sidewalks':flat_polys(sides),
         'water':flat_polys(water),'ground':flat_polys(polygons(city['land'])),'park':flat_polys(polygons(city['parks'])),
         'grass':[],'forest':[],'pitch':[],'apron':[],'airfield':[],'runways':[],'parking':[],'plaza':[],
         **graph,**{k:v for k,v in details.items() if k!='detailRejected'},'hills':{'nx':2,'nz':2,'x0':bounds[0],'z0':bounds[1],'res':5000,'tile':2,'tiles':[]},
         'buildingKinds':KINDS,'buildings':buildings,'buildingMeta':meta,'landmarks':{'jianghanguan':landmark},'wuhanLandmarks':city['landmarks'],
         'viaducts':[],'mrtStations':[],'stations':[],**sign_data,
         'districts':[['汉口',flat_polys(polygons(city['land']))[0]]] if city['land'] else [],'places':places,
         'namedBuildings':[[b['name'],b['x'],b['z'],display_height(b)[0]] for b in city['buildings'] if b['name']],
         'teleports':teleports,'placementData':{k:city[k] for k in ['bounds','land','water','roads','buildings','landmarks']}}
    lat=city['origin'][1]*math.pi/180;e2=6.69437999014e-3;s=math.sin(lat);rad=math.pi/180
    geo['frame'].update(mLon=rad*6378137/math.sqrt(1-e2*s*s)*math.cos(lat),mLat=rad*6378137*(1-e2)/(1-e2*s*s)**1.5)
    report={'runtimeBase':'shwang1979/slop-taipei','ruleVersion':RULE,'sourceBuildings':len(city['buildings']),
            'renderedParts':len(meta),'roadLinks':len(links),'curvedRoadLinks':sum(len(l[8])>4 for l in links),'crossings':len(details['crossings']),'signals':len(details['signals']),'streetDetailRejected':details['detailRejected'],'heightSources':dict(heights),'signRecords':len(signs),'verticalSignCandidates':sum(m['verticalAllowed'] for m in sign_data['signMeta']),'signTextSources':dict(collections.Counter(m['textSource'] for m in sign_data['signMeta'])),'signRejected':sign_rejected,
            'limits':['Missing heights are visual estimates, not surveyed','No Taipei geography or landmarks imported',
                      'Flat terrain; no bridges/tunnels/MRT','Vehicle models and facade details adapted from Taipei; not exact Wuhan replicas']}
    return geo,report

def main():
    city_path=ROOT/'public/data/city.json';city=json.loads(city_path.read_text())
    geo,report=convert(city);report['sourceCitySha256']=hashlib.sha256(city_path.read_bytes()).hexdigest()
    path=ROOT/'js/runtime/wuhan-geodata.js'
    path.write_text('// GENERATED by tools/build-runtime.py. Geography: OSM / Overture (ODbL).\nexport const GEO = '+json.dumps(geo,ensure_ascii=False,separators=(',',':'))+';\n')
    (ROOT/'public/data/runtime-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
