"""Adapt the audited Wuhan source layer to the Taipei runtime contract.

Source heights stay unchanged in city.json; display estimates are explicit metadata.
"""
from pathlib import Path
import collections, hashlib, json, math
from shapely.geometry import Polygon, LineString,box,Point
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import make_valid
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
    return unary_union([make_valid(Polygon(p[0],p[1:])) for p in rows])

def flat_polys(geom):
    if geom.is_empty: return []
    if geom.geom_type != 'Polygon':
        return [p for part in getattr(geom,'geoms',[]) for p in flat_polys(part)]
    p=orient(geom,sign=1)
    return [[[round(v,3) for point in list(r.coords)[:-1] for v in point] for r in [p.exterior,*p.interiors]]]

def terrain_polys(geom,hills):
    if not hills:return flat_polys(geom)
    # Add vertices over the ridges so a large flat triangle cannot cut through a hill.
    tiles=[box(hills['x0']+i*hills['tile']*hills['res'],hills['z0']+j*hills['tile']*hills['res'],
               hills['x0']+(i+1)*hills['tile']*hills['res'],hills['z0']+(j+1)*hills['tile']*hills['res']) for i,j,_ in hills['tiles']]
    mask=unary_union(tiles);out=flat_polys(geom.difference(mask));local=geom.intersection(mask)
    if local.is_empty:return out
    size=hills['res']
    for tile in tiles:
        piece=local.intersection(tile)
        if piece.is_empty:continue
        w,s,e,n=tile.bounds
        for i in range(hills['tile']):
            for j in range(hills['tile']):
                x=w+i*size;z=s+j*size;cell=piece.intersection(box(x,z,x+size,z+size))
                if cell.is_empty:continue
                # Same diagonal and planes as sampleTerrain / sample_hill, clipped to real land/layer outlines.
                for triangle in [Polygon([(x,z),(x+size,z),(x,z+size)]),Polygon([(x+size,z),(x+size,z+size),(x,z+size)])]:
                    out+=flat_polys(cell.intersection(triangle))
    return out

def encode_building(rings,h,base,kind):
    p=orient(Polygon(rings[0],rings[1:]),sign=1)
    out=[round(h*10),round(base*10),kind,len(p.interiors)+1]
    for ring in [p.exterior,*p.interiors]:
        pts=list(ring.coords)[:-1];out.append(len(pts));px=pz=0
        for i,(x,z) in enumerate(pts):
            x,z=round(x*10),round(z*10);out.extend([x-px if i else x,z-pz if i else z]);px,pz=x,z
    return out

def convert(city):
    print('Adapting road topology...',flush=True)
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
            meta.append({'sourceId':b['id'],'category':b['category'],'sourceHeight':None if b['heightSource']=='visual-estimate' or b['heightSource'].startswith('visual-reference:') else b['h'],
                         'sourceHeightType':b['heightSource'],'displayHeight':top,'displayHeightSource':source,'baseY':base,
                         'role':part.get('role'),'partSourceId':part.get('sourceId'),'partHeightSource':part.get('heightSource'),'partHeightReference':part.get('heightReference'),'facadeProfile':part.get('facadeProfile') or b.get('facadeProfile'),'name':b['name']})
    print('Matching storefront signs...',flush=True)
    sign_data,sign_rejected=build_signs(city,display_height)
    signs=sign_data['signs']
    print('Preparing surfaces and terrain...',flush=True)
    water=polygons(city['water']);asphalt=polygons(city['asphalt']);ped=polygons(city['pedestrian'])
    sides=polygons(city['shoulders']).difference(asphalt).difference(ped).difference(water)
    landmark=city['landmarks'][0];spawn=city['spawn'];bounds=city['bounds']
    places=[[p['name'],p['x'],p['z'],1] for p in city['places']]
    teleports=[{'id':'jianghanguan','name':'江汉关博物馆','sub':'沿江大道 · 钟楼','x':spawn['x'],'z':spawn['z'],'heading':spawn['heading'],'road':'沿江大道'}]
    for p in city['places']:
        if not p.get('name'):continue  # Height-only references are not unnamed destinations.
        if p['name'] in ('江汉路','中山大道','沿江大道') or p.get('arrival'):
            arrival=p.get('arrival',p)
            teleports.append({'id':p['id'],'name':p['name'],'sub':'汉口核心区','x':arrival['x'],'z':arrival['z'],'heading':spawn['heading'],'road':p.get('road','')})
    for l in city['landmarks'][1:]:
        a=l['arrival'];teleports.append({'id':l['id'],'name':l['name'],'sub':l['district'],'x':a['x'],'z':a['z'],'y':a['y'],'heading':0,'road':a['road']})
    for model in city.get('bridgeModels',[]):
        if any(t['name']==model['name'] for t in teleports):continue
        p=model['points'][0];teleports.append({'id':'bridge-'+model['sourceId'],'name':model['name'],'sub':'真实位置 · 桥面高度为估计','x':p[0],'z':p[2],'y':p[1]-2.12,'heading':0,'road':model['name']})
    tunnels=[{**t,'points':[[p[0],round(p[1]-2.12,3),p[2]] for p in t['points']]} for t in city.get('tunnels',[])]
    for t in tunnels:
        p,q=t['points'][:2];name=('汉口' if t['direction']=='hankou-to-wuchang' else '武昌')+'隧道入口'
        teleports.append({'id':t['id'],'name':name,'sub':'武汉长江隧道 · 汽车通行','x':p[0],'z':p[2],'y':0,'heading':math.atan2(q[0]-p[0],q[2]-p[2]),'mode':'car','road':t['name']})
        places.append([name,p[0],p[2],1])
    hills=city.get('hills');cuts=polygons(city.get('rampCuts',[]));flat=lambda g:terrain_polys(g.difference(cuts),hills)
    land=polygons(city['land']);districts=[]
    # Town labels follow the actual connected land pieces separated by the two rivers.
    anchors=[('汉口',Point(-200,0)),('汉阳',Point(-2400,3200)),('武昌',Point(1700,4000))]
    pieces=[land] if land.geom_type=='Polygon' else list(land.geoms)
    for piece in pieces:
        if piece.geom_type!='Polygon' or piece.area<10000:continue
        name=next((name for name,p in anchors if piece.covers(p)),None)
        if name:districts.extend([[name,p] for p in flat_polys(piece)])
    geo={'version':1,'city':'wuhan','frame':{'lon0':city['origin'][0],'lat0':city['origin'][1],'units':'m'},
         'bounds':dict(zip(['minX','minZ','maxX','maxZ'],bounds)),'roadClasses':CLASSES,'names':names,'nodes':nodes,'links':links,
         'roadSourceIds':road_sources,'carriageway':flat(asphalt),'pedestrian':flat(ped),'sidewalks':flat(sides),
         'water':flat_polys(water),'ground':flat(polygons(city['land'])),'park':flat(polygons(city['parks'])),
         'grass':[],'forest':flat(polygons(city.get('forest',[]))),'pitch':[],'apron':[],'airfield':[],'runways':[],'parking':[],'plaza':[],
         **graph,**{k:v for k,v in details.items() if k!='detailRejected'},'hills':hills or {'nx':2,'nz':2,'x0':bounds[0],'z0':bounds[1],'res':5000,'tile':2,'tiles':[]},
         'buildingKinds':KINDS,'buildings':buildings,'buildingMeta':meta,'landmarks':{l['id']:l for l in city['landmarks']},'wuhanLandmarks':city['landmarks'],'bridgeModels':city.get('bridgeModels',[]),
         'tunnels':tunnels,'rampCuts':city.get('rampCuts',[]),'viaducts':[],'mrtStations':[],'stations':[],**sign_data,
         'districts':districts,'places':places,
         'namedBuildings':[[b['name'],b['x'],b['z'],display_height(b)[0]] for b in city['buildings'] if b['name']],
         'teleports':teleports,'placementData':{k:city[k] for k in ['bounds','land','water','roads','buildings','landmarks','rampCuts']}}
    lat=city['origin'][1]*math.pi/180;e2=6.69437999014e-3;s=math.sin(lat);rad=math.pi/180
    geo['frame'].update(mLon=rad*6378137/math.sqrt(1-e2*s*s)*math.cos(lat),mLat=rad*6378137*(1-e2)/(1-e2*s*s)**1.5)
    report={'runtimeBase':'shwang1979/slop-taipei','ruleVersion':RULE,'sourceBuildings':len(city['buildings']),
            'renderedParts':len(meta),'roadLinks':len(links),'curvedRoadLinks':sum(len(l[8])>4 for l in links),'crossings':len(details['crossings']),'signals':len(details['signals']),'streetDetailRejected':details['detailRejected'],'heightSources':dict(heights),'signRecords':len(signs),'verticalSignCandidates':sum(m['verticalAllowed'] for m in sign_data['signMeta']),'signTextSources':dict(collections.Counter(m['textSource'] for m in sign_data['signMeta'])),'signRejected':sign_rejected,
            'tunnelBores':len(tunnels),'tunnelLengthM':round(sum(t['length'] for t in tunnels),3),'tunnelProfile':'Estimated width, depth, clearance; source horizontal geometry and portal nodes',
            'region':city['region'],'hillTiles':len(geo['hills']['tiles']),'elevatedLinks':sum(bool(l[7]&2) for l in links),'terrainLinks':sum(bool(l[7]&8) for l in links),
            'limits':['Missing heights and 3D-GloBFP heights are estimates, not surveyed','No Taipei geography or landmarks imported',
                      'Only two masked ridges and three named crossings; deck engineering profiles estimated','Vehicle models and facade details adapted from Taipei; not exact Wuhan replicas']}
    return geo,report

def main():
    city_path=ROOT/'public/data/city.json';city=json.loads(city_path.read_text())
    geo,report=convert(city);report['sourceCitySha256']=hashlib.sha256(city_path.read_bytes()).hexdigest()
    path=ROOT/'js/runtime/wuhan-geodata.js'
    path.write_text('// GENERATED by tools/build-runtime.py. Geography: OSM / Overture (ODbL).\nexport const GEO = '+json.dumps(geo,ensure_ascii=False,separators=(',',':'))+';\n')
    (ROOT/'public/data/runtime-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
