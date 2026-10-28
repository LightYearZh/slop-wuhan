"""Adapt Shanghai Roam's importer and 500 m data contract to the Wuhan pilot."""
from pathlib import Path
import json, math, hashlib, runpy, collections, shutil, os, re, argparse
from shapely.geometry import shape
from shapely.ops import transform
from shapely.strtree import STRtree
from city_profile import load_profile,importer_fingerprint
from building_attributes import BuildingEnricher
from road_audit import audit_roads
from core_geometry import HeightMatcher,hill_grid,sample_hill,landmark_from_building,named_crossings
from tunnel_routes import build_tunnels
from spatial_rules import resolve_ground_layout
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import make_valid,set_precision

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data'
SOURCE=ROOT/'data/hubei-latest.osm.pbf'
CACHE=ROOT/'data/derived/wuhan.json'
ORIGIN=[114.293,30.585]

def dump(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def parts(g,kind='Polygon'):
    if g.is_empty:return []
    if g.geom_type==kind:return [g]
    return [p for sub in getattr(g,'geoms',[]) for p in parts(sub,kind)]

def polygons(g):
    g=set_precision(make_valid(g),.001)
    return [[[[round(x,3),round(z,3)] for x,z in ring.coords] for ring in [p.exterior,*p.interiors]] for p in parts(g)]

def geometry(rows):
    return unary_union([make_valid(Polygon(p[0],p[1:])) for p in rows])

def road_width(r):
    raw=r.get('widthTag') or ''
    m=re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(?:m)?\s*',raw)
    if m and 1<=float(m.group(1))<=45:return float(m.group(1)),'OSM:width'
    if r['mode']=='person':
        if r['name'] in ('江汉路','江汉路步行街'):return 16,'visual-estimate:pedestrian-street'
        return (1.8 if r['highway']=='steps' else 2.5),'class-estimate:footpath'
    lanes=r.get('lanesTag') or ''
    if lanes.isdigit() and 1<=int(lanes)<=8:return int(lanes)*3.25,'OSM:lanes-derived'
    return {'expy':12,'major':10,'minor':8,'local':6,'link':5}[r['class']],'class-estimate'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--profile',help='JSON area profile; defaults to config/wuhan-core.json')
    args=parser.parse_args();profile=load_profile(args.profile);os.environ['WUHAN_PROFILE']=profile['_file']
    if not SOURCE.exists():raise SystemExit('Missing data/hubei-latest.osm.pbf; see README.md')
    digest=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    importer_digest=importer_fingerprint()
    if not CACHE.exists() or json.loads(CACHE.read_text()).get('importerSha256')!=importer_digest or json.loads(CACHE.read_text()).get('profileBounds')!=profile['boundsWgs84'] or json.loads(CACHE.read_text())['source']['sha256']!=digest:
        runpy.run_path(str(ROOT/'tools/import-citywide.py'),run_name='__main__')
    raw=json.loads(CACHE.read_text())
    rad=math.pi/180;s=math.sin(ORIGIN[1]*rad);e2=6.69437999014e-3
    sx=rad*6378137/math.sqrt(1-e2*s*s)*math.cos(ORIGIN[1]*rad)
    sz=rad*6378137*(1-e2)/(1-e2*s*s)**1.5
    def project(lon,lat,z=None):return ((lon-ORIGIN[0])*sx,-(lat-ORIGIN[1])*sz)
    west,south,east,north=profile['boundsWgs84']
    a=project(west,north);b=project(east,south)
    bounds=[*a,*b];region=box(*bounds)
    water=unary_union([geometry(v['polygons']) for v in raw['areas'] if v['kind']=='water']).intersection(region).buffer(0)
    hills=hill_grid(ROOT/profile['terrainExtract'],water) if profile.get('terrainExtract') else None
    height_matcher=HeightMatcher(ROOT/profile['heightExtract'],project) if profile.get('heightExtract') else None
    parks=unary_union([geometry(v['polygons']) for v in raw['areas'] if v['kind'] in ('park','green')]).intersection(region).difference(water).buffer(0)
    forest=unary_union([geometry(v['polygons']) for v in raw['areas'] if v.get('natural')=='wood']).intersection(region).difference(water).buffer(0)
    roads=[];excluded=collections.Counter()
    for r in raw['roads']:
        if r['tunnel'] or r['bridge'] or r['layer']!=0:
            excluded['bridge_tunnel_or_layer']+=1;continue
        line=LineString([(p[0],p[2]) for p in r['points']])
        for i,p in enumerate(parts(line.intersection(region),'LineString')):
            if p.length<1:continue
            points=[[round(x,3),2.12,round(z,3)] for x,z in p.coords]
            if r['reverse']:points.reverse()
            node_map={(p[0],p[2]):id for p,id in zip(r['points'],r['nodeIds'])}
            width,width_source=road_width(r)
            roads.append({**r,'id':r['id']+f'-part-{i}','points':points,
                'width':width,
                'heightSource':'flat-ground-estimate','widthSource':width_source,
                'nodeIds':[node_map.get((p[0],p[2]),f'clip:{p[0]},{p[2]}') for p in points]})
    if not roads:raise SystemExit('No usable Wuhan roads; refusing empty output')
    road_lines=[LineString([(p[0],p[2]) for p in r['points']]) for r in roads]
    asphalt=unary_union([line.buffer(r['width']/2,quad_segs=4) for line,r in zip(road_lines,roads) if r['mode']=='car']).intersection(region).difference(water)
    pedestrian=unary_union([line.buffer(r['width']/2,quad_segs=4) for line,r in zip(road_lines,roads) if r['mode']=='person']).intersection(region).difference(water).difference(asphalt)
    shoulders=unary_union([line.buffer(r['width']/2+2,quad_segs=3) for line,r in zip(road_lines,roads)]).intersection(region).difference(water)
    buildings=[];seen=set()
    landmark_source=next((b for b in raw['buildings'] if b['name']=='江汉关大楼'),None)
    if landmark_source is None:raise SystemExit('This profile must include the Jianghanguan pilot landmark; configure a separate landmark adapter for another area.')
    landmark_poly=geometry(landmark_source['polygons'])
    landmark_rr=landmark_poly.minimum_rotated_rectangle
    q=list(landmark_rr.exterior.coords);cx,cz=landmark_rr.centroid.x,landmark_rr.centroid.y
    theta=math.atan2(q[1][1]-q[0][1],q[1][0]-q[0][0])
    landmark={'id':'jianghanguan','name':'江汉关博物馆','type':'jianghanguan','x':cx,'z':cz,'height':45.85,'w':math.dist(q[0],q[1]),'d':math.dist(q[1],q[2]),'ry':-theta,'footprint':polygons(landmark_poly)[0],
        'source':landmark_source['id'],'modelSource':'OSM footprint + Wuhan government photo reference; simplified exterior','heightSource':'https://3g.wuhan.gov.cn/sy/kwh/202401/t20240122_2347703.shtml','aliases':['江汉关','江汉关大楼','钟楼'],'district':'汉口试验区'}
    landmarks=[landmark]
    if profile['id']=='wuhan-three-towns-core':
        for name,kind,identifier,height,url in [
            ('黄鹤楼','yellow-crane','yellow-crane',51.4,'https://english.wuhan.gov.cn/travel/tourist4attractions4an4incomplete4list/202110/t20211026_1819226.shtml'),
            ('龟山电视塔','tv-tower','guishan-tower',221.2,'https://www.wuhan.gov.cn/zjwh/whly/202602/t20260215_2730613.shtml'),
            ('晴川阁','qingchuange','qingchuange',18,'visual-estimate:two-storey-hall')]:
            item=next((b for b in raw['buildings'] if b['name']==name),None)
            if not item:raise ValueError('Required core landmark missing from source: '+name)
            landmarks.append(landmark_from_building(item,kind,identifier,height,hills,url))
    landmark_shapes=[Polygon(l['footprint'][0],l['footprint'][1:]) for l in landmarks]
    evidence=json.loads((ROOT/'data/source/building-evidence.json').read_text())
    enricher=BuildingEnricher(raw,roads,evidence)
    road_tree=STRtree(road_lines)
    def add_building(item,poly,i,provider):
        if poly.area<16 or poly.intersection(water).area>poly.area*.1:return
        if any(poly.intersection(g).area>poly.area*.15 for g in landmark_shapes):return
        key=poly.normalize().wkb_hex
        if key in seen:return
        # Compare the actual footprint with narrowly buffered source centrelines, never its bounding rectangle.
        conflict=unary_union([road_lines[int(j)].buffer(min(roads[int(j)]['width']/2,3)) for j in road_tree.query(poly.buffer(16))])
        overlap=poly.intersection(conflict).area/poly.area if not conflict.is_empty else 0
        if overlap>.35:excluded['source_footprint_road_conflict']+=1;return
        rr=poly.minimum_rotated_rectangle;q=list(rr.exterior.coords)
        w=math.dist(q[0],q[1]);d=math.dist(q[1],q[2]);x,z=rr.centroid.x,rr.centroid.y
        if min(w,d)<2:excluded['building_dimensions']+=1;return
        seen.add(key)
        h=item.get('h',0)
        if not (2<=h<=650):h=12
        attributes=enricher.enrich(item,poly,provider)
        candidate=height_matcher.match(poly) if height_matcher else None
        if candidate:
            attributes['heightCandidate']=candidate
            if attributes['heightSource']=='visual-estimate':
                attributes.update({'h':candidate['heightM'],'heightSource':'3D-GloBFP:model-estimate',
                    'heightEvidence':{**candidate,'confidence':'model-estimate;conservative-footprint-match','meaning':'2020 remote-sensing height estimate; not measured'}})
                height_matcher.stats['applied_to_missing_height']+=1
            else:height_matcher.stats['retained_existing_height']+=1
        buildings.append({'id':item['id']+f'-{i}','name':item.get('name',''),'x':round(x,2),'z':round(z,2),'w':round(w,2),'d':round(d,2),'h':h,
            'ry':round(-math.atan2(q[1][1]-q[0][1],q[1][0]-q[0][0]),5),'style':0 if h>70 else 1 if h>24 else 3,
            'source':provider,'sourceDatasets':item.get('sourceDatasets',[]),'heightSource':item['heightSource'] if h==item.get('h') else 'visual-estimate',
            'footprint':polygons(poly)[0][0],'rings':polygons(poly)[0],**attributes})
    for item in raw['buildings']:
        for i,poly in enumerate(parts(geometry(item['polygons']).intersection(region))):
            add_building(item,poly,i,'OSM:footprint')
    osm_polys=[p for b in raw['buildings'] for p in parts(geometry(b['polygons']))]
    osm_tree=STRtree(osm_polys)
    overture_path=ROOT/profile['overtureExtract']
    if not overture_path.exists():raise SystemExit('Missing pinned Overture extract; see README')
    extraction=json.loads(overture_path.with_suffix('.geojson.state').read_text())['bbox']
    if not(extraction['xmin']<=west and extraction['ymin']<=south and extraction['xmax']>=east and extraction['ymax']>=north):
        raise SystemExit('Overture extract does not cover the profile. Download the expanded bbox before building.')
    overture=json.loads(overture_path.read_text())
    for feature in overture['features']:
        props=feature['properties']
        if props.get('is_underground'):continue
        g=make_valid(transform(project,shape(feature['geometry']))).intersection(region)
        for i,poly in enumerate(parts(g)):
            if poly.area<16:continue
            candidates=osm_tree.query(poly)
            if any(poly.intersection(osm_polys[int(j)]).area/min(poly.area,osm_polys[int(j)].area)>.25 for j in candidates):
                excluded['overture_duplicate_osm']+=1;continue
            item={'id':'overture-'+feature['id'],'h':props.get('height') or (props.get('num_floors') or 0)*3.2,
                  'heightSource':'Overture:height' if props.get('height') else 'Overture:floors' if props.get('num_floors') else 'visual-estimate',
                  'name':(props.get('names') or {}).get('primary',''),'tags':{'building':props.get('class') or 'yes'},
                  'sourceDatasets':sorted(set(s.get('dataset') or s.get('resource','unknown') for s in props.get('sources',[])))}
            add_building(item,poly,i,'Overture:footprint')
    roads,asphalt,pedestrian,shoulders,spatial_audit=resolve_ground_layout(roads,buildings,landmarks,region,water)
    crossings,bridge_models=named_crossings(raw['roads'],region,road_width,hills) if hills else ([],[])
    # Ground roads drape on the same hill sampler as buildings and the player; bridge decks stay independent.
    for r in roads:
        r['points']=[[p[0],round(2.12+sample_hill(hills,p[0],p[2]),3),p[2]] for p in r['points']]
        if any(p[1]>2.121 for p in r['points']):r['elevationMode']='terrain';r['heightSource']='Terrain-Tiles:masked-relief-estimate'
    # Join ground approaches to their mapped deck endpoints with identical shared-node elevations.
    bridge_ends={n:p[1] for r in crossings for n,p in zip(r['nodeIds'],r['points'])}
    for r in roads:
        for n,p in zip(r['nodeIds'],r['points']):
            if n in bridge_ends:p[1]=bridge_ends[n]
        if any(p[1]>2.121 for p in r['points']):r['elevationMode']='terrain'
    roads+=crossings
    excluded['bridge_tunnel_or_layer']-=len(crossings)
    tunnels,ramp_cuts=build_tunnels(raw,region,water) if profile['id']=='wuhan-three-towns-core' else ([],Polygon())
    excluded['bridge_tunnel_or_layer']-=sum(len(t['sourceIds']) for t in tunnels)
    road_lines=[LineString([(p[0],p[2]) for p in r['points']]) for r in roads]
    places=[]
    for name in ['江汉路','沿江大道','中山大道','北京路','南京路','洞庭街']:
        candidates=[(r,line) for r,line in zip(roads,road_lines) if name in r['name']]
        if not candidates:continue
        r,line=min(candidates,key=lambda p:p[1].distance(Point(0,0)))
        p=line.interpolate(line.length/2)
        places.append({'id':'road-'+name,'name':name,'district':'汉口试验区','x':p.x,'z':p.y,'road':r['name'],'source':r['id']})
    for b in buildings:
        if not b['heightEvidence'].get('reference'):continue
        point=Point(b['x'],b['z'])
        candidates=[(r,line) for r,line in zip(roads,road_lines) if r['mode']=='car']
        r,line=min(candidates,key=lambda value:value[1].distance(point));q=line.interpolate(line.project(point))
        places.append({'id':'building-'+b['id'],'name':b['name'],'aliases':['佳丽广场'] if '平安大厦' in b['name'] else ['璇宫饭店'],
            'district':'汉口试验区','x':b['x'],'z':b['z'],'arrival':{'x':q.x,'z':q.y},'source':b['id'],'heightSource':b['heightSource']})
    spawn=next((p for p in places if p['name']=='沿江大道'),None)
    if spawn is None:raise SystemExit('Missing 沿江大道; inspect geographic bounds before continuing')
    # A safe roadside arrival, outside the museum footprint, rather than the building centre.
    museum_target=Point(landmark['x'],landmark['z'])
    riverside=[(r,line) for r,line in zip(roads,road_lines) if r['name']=='沿江大道' and r['mode']=='car']
    rr,ll=min(riverside,key=lambda value:value[1].distance(museum_target))
    dist=ll.project(museum_target);pp=ll.interpolate(max(0,dist-60));qq=ll.interpolate(min(ll.length,max(0,dist-60)+4))
    spawn={**spawn,'x':pp.x,'z':pp.y,'heading':math.atan2(qq.x-pp.x,qq.y-pp.y)}
    walking=[(r,line) for r,line in zip(roads,road_lines) if r['name']=='江汉路']
    _,walking_line=min(walking,key=lambda value:value[1].distance(museum_target))
    p=walking_line.interpolate(walking_line.project(museum_target))
    landmark['arrival']={'x':p.x,'z':p.y}
    for l in landmarks[1:]:
        target=Point(l['x'],l['z']);options=[]
        for r,line in zip(roads,road_lines):
            if r.get('bridge') or r.get('elevationMode')=='terrain' and l['type']=='qingchuange':continue
            point=line.interpolate(line.project(target))
            if point.distance(target)>500 or water.covers(point):continue
            if any(g.buffer(3).covers(point) for g in landmark_shapes):continue
            if any(Polygon(b['rings'][0],b['rings'][1:]).covers(point) for b in buildings if abs(b['x']-point.x)<100 and abs(b['z']-point.y)<100):continue
            options.append((point.distance(target)+(50 if r['mode']=='car' else 0),point,r))
        if not options:raise ValueError('No safe landmark arrival: '+l['name'])
        _,point,r=min(options,key=lambda row:row[0]);l['arrival']={'x':point.x,'z':point.y,'y':sample_hill(hills,point.x,point.y),'road':r['name']}
    city={'schemaVersion':2,'origin':ORIGIN,'bounds':bounds,'region':{'id':profile['id'],'name':profile['name'],'boundsWgs84':profile['boundsWgs84']},
        'source':raw['source'],'water':polygons(water),'waterAreaM2':round(water.area),'parks':polygons(parks.difference(forest)),'forest':polygons(forest),
        'land':polygons(region.difference(water)),'asphalt':polygons(asphalt),'shoulders':polygons(shoulders),
        'roads':roads,'pedestrian':polygons(pedestrian),'tunnels':tunnels,'rampCuts':polygons(ramp_cuts),'landmarks':landmarks,'buildings':buildings,'places':places,'controlPoints':[],'spawn':spawn,
        'pois':raw.get('pois',[]),'streetNodes':raw.get('streetNodes',[])}
    if hills:
        hills.pop('_values',None);city['hills']=hills;city['bridgeModels']=bridge_models
    city['region'].update({'widthM':round(bounds[2]-bounds[0],1),'heightM':round(bounds[3]-bounds[1],1),'areaKm2':round(region.area/1e6,3),'scale':'1:1'})
    if height_matcher:city['heightSupplement']={**height_matcher.source,'matching':dict(height_matcher.stats)}
    road_audit=audit_roads(roads,bounds,landmark)
    city['streetFocus']={'roadIds':[r['id'] for r in roads if r['name'] in ('江汉路','江汉路步行街')],'landmarkId':'jianghanguan'}
    city['supplement']={'provider':'Overture Maps','release':json.loads((overture_path.with_suffix('.geojson.state')).read_text())['last_release'],'sha256':hashlib.sha256(overture_path.read_bytes()).hexdigest(),'license':'ODbL 1.0'}
    stage=ROOT/'public/data-wuhan-build';shutil.rmtree(stage,ignore_errors=True);(stage/'tiles').mkdir(parents=True)
    dump(stage/'city.json',city)
    dump(stage/'road-audit.json',road_audit)
    dump(stage/'spatial-audit.json',spatial_audit)
    manifest={'schemaVersion':1,'sourceVersion':digest,'origin':ORIGIN,'bounds':bounds,'tileSizeM':500,'collisionHaloM':180,'attribution':'© OpenStreetMap contributors · ODbL 1.0','tiles':[],'routes':[]}
    for x in range(math.floor(bounds[0]/500),math.ceil(bounds[2]/500)):
        for z in range(math.floor(bounds[1]/500),math.ceil(bounds[3]/500)):
            id=f'{x}_{z}';bs=[b for b in buildings if math.floor(b['x']/500)==x and math.floor(b['z']/500)==z]
            path=stage/'tiles'/f'{id}.json';dump(path,{'id':id,'buildings':bs})
            manifest['tiles'].append({'id':id,'bounds':[x*500,z*500,(x+1)*500,(z+1)*500],'url':f'./data/tiles/{id}.json','bytes':path.stat().st_size,'hash':hashlib.sha256(path.read_bytes()).hexdigest()})
    dump(stage/'manifest.json',manifest);dump(stage/'metro.json',{'stations':[],'lines':[]})
    report={'source':raw['source'],'roads':len(roads),'buildings':len(buildings),'heightSources':dict(collections.Counter(b['heightSource'] for b in buildings)),
        'waterAreaM2':round(water.area),'waterPolygons':len(city['water']),'tiles':len(manifest['tiles']),'places':[p['name'] for p in places],
        'buildingSources':dict(collections.Counter(b['source'] for b in buildings)),'supplement':city['supplement'],'landmarks':[l['name'] for l in landmarks],'region':city['region'],'heightSupplement':city.get('heightSupplement'),'bridges':{'sourceSegments':len(crossings),'names':sorted(set(r['bridgeGroup'] for r in crossings))},'roadAudit':road_audit,'spatialAudit':spatial_audit,'excluded':dict(excluded),'skippedSourceGeometries':raw['skippedGeometries'],
        'limitations':['Only Guishan/Sheshan relief enabled from coarse global terrain; other lowland remains flat','Actual footprints extruded; facade details and missing heights remain estimates','Landmarks are simplified exteriors, not surveyed models','Three named bridge crossings and Wuhan Yangtze Tunnel main bores enabled with estimated engineering profiles; other elevated/tunnel roads remain excluded','No metro data or ride-hailing tasks yet']}
    attributes_report={'categoryCounts':dict(collections.Counter(b['category'] for b in buildings)),
        'categorySources':dict(collections.Counter(b['categorySource'] for b in buildings)),
        'heightSources':dict(collections.Counter(b['heightSource'] for b in buildings)),
        'retainedPOIs':len(raw.get('pois',[])),'buildingsWithPOIs':sum(bool(b['pois']) for b in buildings),
        'frontageBuildings':sum(bool(b['frontages']) for b in buildings),
        'appliedReferences':sorted(set(enricher.applied)),
        'massingEstimates':[{'id':b['id'],'source':b['massingReference'],'method':b['massingSource']} for b in buildings if b.get('massingParts')],
        'rules':'Documented height > floor-derived estimate > marked 12m fallback; classification has its own source; facade appearance remains illustrative'}
    report['attributes']=attributes_report
    dump(stage/'building-attributes-audit.json',attributes_report)
    report['tunnels']=[{k:t[k] for k in ['id','direction','sourceIds','length','width','widthSource','depthEstimateM','heightSource','portalConnections']} for t in tunnels]
    dump(stage/'wuhan-audit.json',report)
    OUT.mkdir(parents=True,exist_ok=True)
    for p in stage.iterdir():
        target=OUT/p.name
        if target.is_dir():shutil.rmtree(target)
        os.replace(p,target)
    stage.rmdir();print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
