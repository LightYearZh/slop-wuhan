"""Reproducible WGS84 -> local metre scene build from a pinned OSM cache.
Run with .venv/bin/python tools/build-data.py. Source remains ODbL 1.0.
"""
from pathlib import Path
import json, math, random, hashlib, os
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import make_valid
from shapely.prepared import prep

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('SHANGHAI_BUILD_OUTPUT',str(ROOT/'public/data'))); OUT.mkdir(parents=True,exist_ok=True)
SRC=ROOT/'data/source'
base=json.loads((SRC/'shanghai-basemap.json').read_text())
buildings=json.loads((SRC/'shanghai-buildings.json').read_text())
expansion=json.loads((SRC/'expansion-b.json').read_text())
lat0=31.237; lon0=121.495; r=math.pi/180; e2=6.69437999014e-3; s=math.sin(lat0*r)
sx=r*6378137/math.sqrt(1-e2*s*s)*math.cos(lat0*r)
sz=r*6378137*(1-e2)/(1-e2*s*s)**1.5
def project(p): return ((p[0]-lon0)*sx,-(p[1]-lat0)*sz)
def coords(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [[[[round(x,3),round(z,3)] for x,z in g.exterior.coords]]+[[[round(x,3),round(z,3)] for x,z in ring.coords] for ring in g.interiors]]
    return [p for sub in getattr(g,'geoms',[]) for p in coords(sub)]
def valid_poly(points):
    try:return make_valid(Polygon([project(p) for p in points]))
    except:return Polygon()
west,south,east,north=expansion['boundsWgs84']
a=project((west,north));b=project((east,south));bounds=[a[0],a[1],b[0],b[1]];region=box(*bounds)
areas=[]
for i,v in enumerate(base['areas']):
    g=valid_poly(v['p'])
    if not g.is_empty and g.intersects(region):areas.append((v['c'],g.intersection(region)))
water=unary_union([g for c,g in areas if c=='water' and g.area>100]).buffer(0)
parks=unary_union([g for c,g in areas if c in ('park','green') and g.area>300]).difference(water).buffer(0)
print('Water and parks assembled',flush=True)

landmarks=[
 {'id':'pearl','name':'东方明珠','lon':121.4947167,'lat':31.2416694,'height':468,'reserve':75,'type':'pearl','source':'Wikidata Q223207'},
 {'id':'tower','name':'上海中心','lon':121.501246,'lat':31.235505,'height':632,'reserve':70,'type':'tower','source':'OSM named footprint / height'},
 {'id':'swfc','name':'环球金融中心','lon':121.50304,'lat':31.236575,'height':492,'reserve':60,'type':'swfc','source':'OSM named footprint / height'},
 {'id':'jinmao','name':'金茂大厦','lon':121.501388,'lat':31.237256,'height':420.5,'reserve':57,'type':'jinmao','source':'OSM named footprint / height'},
 {'id':'conference','name':'上海国际会议中心','lon':121.492303,'lat':31.241633,'height':48,'reserve':110,'type':'conference','source':'OSM named footprint; spheres visually estimated'},
 {'id':'customs','name':'海关大楼','lon':121.4854375,'lat':31.238615,'height':90,'reserve':48,'type':'customs','source':'OSM named footprint / Wikidata Q5196503'},
 {'id':'hsbc','name':'原汇丰银行大楼','lon':121.485556,'lat':31.238056,'height':61,'reserve':51,'type':'hsbc','source':'Wikidata Q213087'},
 {'id':'peace','name':'和平饭店','lon':121.484722,'lat':31.241111,'height':77,'reserve':46,'type':'peace','source':'Wikidata Q11140758'}
]+expansion['landmarks']
for l in landmarks:l['x'],l['z']=project((l['lon'],l['lat']))
reservations=unary_union([Point(l['x'],l['z']).buffer(l['reserve']) for l in landmarks])

# The cached OSM lines preserve source vertex order. Stitch only equal endpoints.
segments=[dict(r) for r in base['roads'] if r.get('n')=='延安东路隧道']
chains=[]
while segments:
    chain=segments.pop(0)['p'][:]
    changed=True
    while changed:
        changed=False
        for i,rw in enumerate(segments):
            if rw['p'][0]==chain[-1]:chain+=rw['p'][1:];segments.pop(i);changed=True;break
            if rw['p'][-1]==chain[0]:chain=rw['p'][:-1]+chain;segments.pop(i);changed=True;break
    if chain[0][0]<chain[-1][0]:
        exit_parts=[v['p'][:] for v in base['roads'] if v.get('n')=='银城中路出口']
        while True:
            match=next((p for p in exit_parts if p[0]==chain[-1]),None)
            if not match:break
            chain+=match[1:];exit_parts.remove(match)
    else:
        # Century Avenue's parallel carriageway is within four metres at this junction.
        # A short connector remains inside the combined road widths; no river crossing is invented.
        chain=[[121.49705,31.24021]]+chain
    chains.append(chain)
assert len(chains)==2, f'Expected two continuous tunnel chains, got {len(chains)}'
tunnels=[];ramp_holes=[]
# Gameplay clearance, not a surveyed bore dimension. Keep portals and open cuts in sync.
tunnel_width=10
for i,chain in enumerate(chains):
    line=LineString([project(p) for p in chain]);length=line.length
    pts=[]
    n=math.ceil(length/8)
    for j in range(n+1):
        dist=length*j/n;p=line.interpolate(dist)
        u=min(1,dist/560,(length-dist)/560);u=max(0,u)
        y=2.12-28.12*(u*u*(3-2*u))
        pts.append([round(p.x,3),round(y,3),round(p.y,3)])
    pts[0][1]=pts[-1][1]=2.12
    t={'id':f'yanan-{i}','name':'延安东路隧道','points':pts,'width':tunnel_width,'widthSource':'gameplay-visual-estimate','tunnel':True,'oneway':True,'layer':-1,'mode':'car','length':round(length,2),'heightSource':'visual-estimate-continuous-profile','sourceCoordinates':chain}
    tunnels.append(t)
    ramp_run=[]
    for p,q in zip(pts,pts[1:]):
        if max(p[1],q[1])>-3:
            if not ramp_run:ramp_run=[(p[0],p[2])]
            ramp_run.append((q[0],q[2]))
        elif ramp_run:
            ramp_holes.append(LineString(ramp_run).buffer(tunnel_width/2+1.2,cap_style='flat'));ramp_run=[]
    if ramp_run:ramp_holes.append(LineString(ramp_run).buffer(tunnel_width/2+1.2,cap_style='flat'))

roads=[];road_keys=set()
for i,rw in enumerate(base['roads']):
    if rw['c']=='expy' or any(word in rw.get('n','') for word in ('隧道','地道','高架','大桥','银城中路出口')):continue
    line=LineString([project(p) for p in rw['p']])
    if not line.intersects(region):continue
    clipped=line.intersection(region)
    parts=[clipped] if clipped.geom_type=='LineString' else [g for g in getattr(clipped,'geoms',[]) if g.geom_type=='LineString']
    widths={'expy':16,'major':15,'minor':12,'local':8,'link':7}
    control_source=next((p for p in rw['p'] if region.covers(Point(project(p)))),None)
    for part_index,part in enumerate(parts):
        if part.length<.5:continue
        ps=[[round(x,3),2.12,round(z,3)] for x,z in part.coords]
        key=min(tuple(map(tuple,ps)),tuple(map(tuple,reversed(ps))))
        if key in road_keys:continue
        road_keys.add(key)
        roads.append({'id':f'osm-cache-road-{i}'+(f'-part-{part_index}' if part_index else ''),'name':rw.get('n',''),'class':rw['c'],'points':ps,'width':widths.get(rw['c'],7),'mode':'car','layer':0,'nodeIds':[f'{p[0]},{p[2]}' for p in ps],'directionSource':'not-retained-in-cache','controlSource':control_source})
road_buffers=unary_union([LineString([(p[0],p[2]) for p in r['points']]).buffer(r['width']/2+3) for r in roads])
print(f'Clipped ground road objects: {len(roads)}',flush=True)
land=region.difference(water).difference(unary_union(ramp_holes))
asphalt=unary_union([LineString([(p[0],p[2]) for p in r['points']]).buffer(r['width']/2,quad_segs=3) for r in roads]).intersection(region).difference(unary_union(ramp_holes))

render_buildings=[];footprints=[];footprint_keys=set()
def add_building(poly,h,style,source,idx):
    if poly.geom_type!='Polygon' or poly.area<25 or poly.intersects(reservations) or poly.intersection(water).area>poly.area*.1:return
    key=poly.normalize().wkb_hex
    if key in footprint_keys:return
    rr=poly.minimum_rotated_rectangle;ps=list(rr.exterior.coords);w=math.dist(ps[0],ps[1]);d=math.dist(ps[1],ps[2])
    if min(w,d)<4 or max(w,d)>220:return
    x,z=rr.centroid.x,rr.centroid.y;theta=math.atan2(ps[1][1]-ps[0][1],ps[1][0]-ps[0][0])
    render_buildings.append({'id':idx,'x':round(x,2),'z':round(z,2),'w':round(w,2),'d':round(d,2),'h':round(h,2),'ry':round(-theta,5),'style':style,'source':source,'heightSource':source,'footprint':[[round(x,3),round(z,3)] for x,z in poly.exterior.coords]})
    footprint_keys.add(key)
    footprints.append(poly)
for i,v in enumerate(buildings['buildings']):
    poly=valid_poly(v['r'])
    if not poly.is_empty and poly.intersects(region):
        x,z=poly.centroid.x,poly.centroid.y
        style=0 if v['h']>100 else (2 if x<-500 else 1)
        add_building(poly,v['h'],style,'osm:height' if v['k'] else 'osm:levels',f'osm-cache-building-{i}')
existing=unary_union(footprints).buffer(6)
excluded=unary_union([water.buffer(12),parks,road_buffers,reservations,existing]).buffer(0)
excluded_fast=prep(excluded)
print(f'Infill exclusion index: {excluded.geom_type}; sourced buildings: {len(render_buildings)}',flush=True)
rng=random.Random(20261023);fill=0
for ix in range(math.floor(bounds[0]/39),math.ceil(bounds[2]/39)):
    for iz in range(math.floor(bounds[1]/39),math.ceil(bounds[3]/39)):
        x=ix*39+rng.uniform(-5,5);z=iz*39+rng.uniform(-5,5);w=rng.uniform(14,25);d=rng.uniform(13,24)
        poly=box(x-w/2,z-d/2,x+w/2,z+d/2)
        if not region.contains(poly) or excluded_fast.intersects(poly):continue
        # Avoid vacant-looking grids: street-aligned massing with distinct Shanghai neighbourhood types.
        west=x<-500;style=rng.choice([2,3,3,4]) if west else rng.choice([0,1,1,4])
        h=rng.uniform(12,28) if west else rng.uniform(18,60)
        if not west and rng.random()<.08:h=rng.uniform(65,130);style=0
        add_building(poly,h,style,'procedural',f'fill-{ix}-{iz}');fill+=1

# Shape-based road shoulders, parks and water keep full polygon boundaries.
control=[]
for l in landmarks:control.append({'name':l['name'],'lon':l['lon'],'lat':l['lat'],'x':l['x'],'z':l['z'],'source':l['source']})
for road in roads:
    if road['name'] and road['controlSource'] and len(control)<32:
        lon,lat=road['controlSource'];x,z=project((lon,lat))
        p=min(road['points'],key=lambda p:math.hypot(p[0]-x,p[2]-z))
        control.append({'name':road['name'],'lon':lon,'lat':lat,'x':p[0],'z':p[2],'source':road['id']})

places=[]
for p in expansion['places']:
    candidates=[r for r in roads if r['name']==p['road']]
    assert candidates, f'Missing named destination street {p["road"]}'
    target=Point(project(p['near']))
    road=min(candidates,key=lambda r:LineString([(q[0],q[2]) for q in r['points']]).distance(target))
    route=LineString([(q[0],q[2]) for q in road['points']]);q=route.interpolate(route.project(target))
    places.append({**p,'x':q.x,'z':q.y,'source':road['id']})
data={'schemaVersion':2,'region':{'id':expansion['id'],'name':expansion['name'],'boundsWgs84':expansion['boundsWgs84'],'areaKm2':round(region.area/1e6,2)},'bounds':bounds,'origin':[lon0,lat0],'source':{'provider':base['source'],'license':base['license'],'fetchedAt':base['fetchedAt'],'mirror':json.loads((SRC/'mirror-source.json').read_text()),'limitations':['road directions and OSM object IDs omitted by source cache','building outlines limited to tagged height >=18m','ordinary fill, added exterior models and tunnel vertical profile are visual estimates','unverified elevated expressways and major bridge decks excluded']},'water':coords(water),'waterAreaM2':round(water.area),'parks':coords(parks),'land':coords(land),'asphalt':coords(asphalt),'shoulders':coords(road_buffers.intersection(region).difference(water).difference(unary_union(ramp_holes))),'roads':roads,'tunnels':tunnels,'buildings':render_buildings,'landmarks':landmarks,'places':places,'controlPoints':control}
data['rampCuts']=coords(unary_union(ramp_holes))
(OUT/'city.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
tiles={f'{x}_{z}':[] for x in range(math.floor(bounds[0]/500),math.ceil(bounds[2]/500)) for z in range(math.floor(bounds[1]/500),math.ceil(bounds[3]/500))}
for b in render_buildings:
    k=f'{math.floor(b["x"]/500)}_{math.floor(b["z"]/500)}';tiles.setdefault(k,[]).append(b)
manifest={'schemaVersion':1,'sourceVersion':base['fetchedAt'],'origin':[lon0,lat0],'bounds':bounds,'tileSizeM':500,'collisionHaloM':180,'attribution':'© OpenStreetMap contributors · ODbL 1.0','tiles':[],'routes':[]}
(OUT/'tiles').mkdir(exist_ok=True)
for k,bs in sorted(tiles.items()):
    x,z=map(int,k.split('_'));payload=json.dumps({'id':k,'buildings':bs},ensure_ascii=False,separators=(',',':'));(OUT/'tiles'/f'{k}.json').write_text(payload)
    manifest['tiles'].append({'id':k,'bounds':[x*500,z*500,(x+1)*500,(z+1)*500],'url':f'./data/tiles/{k}.json','bytes':len(payload.encode()),'hash':hashlib.sha256(payload.encode()).hexdigest()})
for t in tunnels:
    halo=manifest['collisionHaloM'];ids=[]
    for tile in manifest['tiles']:
        a,b,c,d=tile['bounds']
        if any(a-halo<=p[0]<=c+halo and b-halo<=p[2]<=d+halo for p in t['points']):ids.append(tile['id'])
    manifest['routes'].append({'id':t['id'],'tiles':sorted(ids)})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
report={'realBuildings':sum(b['source']!='procedural' for b in render_buildings),'proceduralBuildings':sum(b['source']=='procedural' for b in render_buildings),'roads':len(roads),'waterAreaM2':round(water.area),'tiles':len(tiles),'tunnels':[{k:t[k] for k in ('id','length','width','widthSource','heightSource')} for t in tunnels],'citySHA256':hashlib.sha256((OUT/'city.json').read_bytes()).hexdigest()}
(OUT/'central-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
