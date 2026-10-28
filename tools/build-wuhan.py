"""Adapt Shanghai Roam's importer and 500 m data contract to the Wuhan pilot."""
from pathlib import Path
import json, math, hashlib, runpy, collections, shutil, os
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import make_valid

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
    return [[[[round(x,3),round(z,3)] for x,z in ring.coords] for ring in [p.exterior,*p.interiors]] for p in parts(g)]

def geometry(rows):
    return unary_union([make_valid(Polygon(p[0],p[1:])) for p in rows])

def main():
    if not SOURCE.exists():raise SystemExit('Missing data/hubei-latest.osm.pbf; see README.md')
    digest=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if not CACHE.exists() or json.loads(CACHE.read_text())['source']['sha256']!=digest:
        runpy.run_path(str(ROOT/'tools/import-citywide.py'),run_name='__main__')
    raw=json.loads(CACHE.read_text())
    rad=math.pi/180;s=math.sin(ORIGIN[1]*rad);e2=6.69437999014e-3
    sx=rad*6378137/math.sqrt(1-e2*s*s)*math.cos(ORIGIN[1]*rad)
    sz=rad*6378137*(1-e2)/(1-e2*s*s)**1.5
    project=lambda lon,lat:((lon-ORIGIN[0])*sx,-(lat-ORIGIN[1])*sz)
    a=project(114.2826,30.594);b=project(114.3034,30.576)
    bounds=[*a,*b];region=box(*bounds)
    water=unary_union([geometry(v['polygons']) for v in raw['areas'] if v['kind']=='water']).intersection(region).buffer(0)
    parks=unary_union([geometry(v['polygons']) for v in raw['areas'] if v['kind'] in ('park','green')]).intersection(region).difference(water).buffer(0)
    roads=[];excluded=collections.Counter()
    for r in raw['roads']:
        if r['tunnel'] or r['bridge'] or r['layer']!=0:
            excluded['bridge_tunnel_or_layer']+=1;continue
        line=LineString([(p[0],p[2]) for p in r['points']])
        for i,p in enumerate(parts(line.intersection(region),'LineString')):
            if p.length<1:continue
            points=[[round(x,3),2.12,round(z,3)] for x,z in p.coords]
            if r['reverse']:points.reverse()
            roads.append({**r,'id':r['id']+f'-part-{i}','points':points,
                'width':{'expy':16,'major':15,'minor':12,'local':8,'link':7,'pedestrian':5}[r['class']],
                'heightSource':'flat-ground-estimate','widthSource':'class-estimate',
                'nodeIds':[f'{p[0]},{p[2]}' for p in points]})
    if not roads:raise SystemExit('No usable Wuhan roads; refusing empty output')
    road_lines=[LineString([(p[0],p[2]) for p in r['points']]) for r in roads]
    asphalt=unary_union([line.buffer(r['width']/2,quad_segs=3) for line,r in zip(road_lines,roads)]).intersection(region).difference(water)
    shoulders=unary_union([line.buffer(r['width']/2+2,quad_segs=3) for line,r in zip(road_lines,roads)]).intersection(region).difference(water)
    buildings=[];seen=set()
    for item in raw['buildings']:
        for i,poly in enumerate(parts(geometry(item['polygons']).intersection(region))):
            if poly.area<25 or poly.intersection(water).area>poly.area*.1:continue
            rr=poly.minimum_rotated_rectangle;q=list(rr.exterior.coords)
            w=math.dist(q[0],q[1]);d=math.dist(q[1],q[2]);x,z=rr.centroid.x,rr.centroid.y
            if min(w,d)<4 or max(w,d)>220:excluded['building_dimensions']+=1;continue
            key=poly.normalize().wkb_hex
            if key in seen:continue
            seen.add(key)
            if any(line.distance(rr)<r['width']/2+.4 for line,r in zip(road_lines,roads)):
                excluded['building_box_overlaps_road']+=1;continue
            h=item['h'] if 2<=item['h']<=650 else 12
            buildings.append({'id':item['id']+f'-{i}','x':round(x,2),'z':round(z,2),'w':round(w,2),'d':round(d,2),'h':h,
                'ry':round(-math.atan2(q[1][1]-q[0][1],q[1][0]-q[0][0]),5),'style':0 if h>70 else 1 if h>24 else 3,
                'source':'OSM:footprint','heightSource':item['heightSource'] if h==item['h'] else 'visual-estimate',
                'footprint':polygons(poly)[0][0]})
    places=[]
    for name in ['江汉路','沿江大道','中山大道','北京路','南京路','洞庭街']:
        candidates=[(r,line) for r,line in zip(roads,road_lines) if name in r['name']]
        if not candidates:continue
        r,line=min(candidates,key=lambda p:p[1].distance(Point(0,0)))
        p=line.interpolate(line.length/2)
        places.append({'id':'road-'+name,'name':name,'district':'汉口试验区','x':p.x,'z':p.y,'road':r['name'],'source':r['id']})
    spawn=next((p for p in places if p['name']=='沿江大道'),None)
    if spawn is None:raise SystemExit('Missing 沿江大道; inspect geographic bounds before continuing')
    city={'schemaVersion':2,'origin':ORIGIN,'bounds':bounds,'region':{'id':'wuhan-hankou-pilot','name':'武汉·汉口试验区','boundsWgs84':[114.2826,30.576,114.3034,30.594]},
        'source':raw['source'],'water':polygons(water),'waterAreaM2':round(water.area),'parks':polygons(parks),
        'land':polygons(region.difference(water)),'asphalt':polygons(asphalt),'shoulders':polygons(shoulders),
        'roads':roads,'tunnels':[],'rampCuts':[],'landmarks':[],'buildings':buildings,'places':places,'controlPoints':[],'spawn':spawn}
    stage=ROOT/'public/data-wuhan-build';shutil.rmtree(stage,ignore_errors=True);(stage/'tiles').mkdir(parents=True)
    dump(stage/'city.json',city)
    manifest={'schemaVersion':1,'sourceVersion':digest,'origin':ORIGIN,'bounds':bounds,'tileSizeM':500,'collisionHaloM':180,'attribution':'© OpenStreetMap contributors · ODbL 1.0','tiles':[],'routes':[]}
    for x in range(math.floor(bounds[0]/500),math.ceil(bounds[2]/500)):
        for z in range(math.floor(bounds[1]/500),math.ceil(bounds[3]/500)):
            id=f'{x}_{z}';bs=[b for b in buildings if math.floor(b['x']/500)==x and math.floor(b['z']/500)==z]
            path=stage/'tiles'/f'{id}.json';dump(path,{'id':id,'buildings':bs})
            manifest['tiles'].append({'id':id,'bounds':[x*500,z*500,(x+1)*500,(z+1)*500],'url':f'./data/tiles/{id}.json','bytes':path.stat().st_size,'hash':hashlib.sha256(path.read_bytes()).hexdigest()})
    dump(stage/'manifest.json',manifest);dump(stage/'metro.json',{'stations':[],'lines':[]})
    report={'source':raw['source'],'roads':len(roads),'buildings':len(buildings),'heightSources':dict(collections.Counter(b['heightSource'] for b in buildings)),
        'waterAreaM2':round(water.area),'waterPolygons':len(city['water']),'tiles':len(manifest['tiles']),'places':[p['name'] for p in places],
        'excluded':dict(excluded),'skippedSourceGeometries':raw['skippedGeometries'],
        'limitations':['Flat ground, no DEM','Building massing uses Shanghai rectangular runtime geometry','No invented building footprints or landmarks','Bridge/tunnel/layer roads excluded pending elevation verification','Vehicle visuals inherited from Shanghai, not an authentic Wuhan fleet','No metro data or ride-hailing tasks yet']}
    dump(stage/'wuhan-audit.json',report)
    OUT.mkdir(parents=True,exist_ok=True)
    for p in stage.iterdir():
        target=OUT/p.name
        if target.is_dir():shutil.rmtree(target)
        os.replace(p,target)
    stage.rmdir();print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
