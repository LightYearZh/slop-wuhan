"""Offline whole-Shanghai build. Full source geometry is clipped per 1 km cell."""
from pathlib import Path
import json, math, random, os, runpy, hashlib, shutil
from collections import defaultdict
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union, polygonize
from shapely import make_valid
from shapely.prepared import prep
from shapely.strtree import STRtree
from citywide_geo import coastal_land, road_payload

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data'
DERIVED=ROOT/'data/derived'
SIZE=1000

def polygons(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [[[[round(x,2),round(z,2)] for x,z in ring.coords] for ring in [g.exterior,*g.interiors]]]
    return [p for sub in getattr(g,'geoms',[]) for p in polygons(sub)]

def geometry(rows):return unary_union([make_valid(Polygon(p[0],p[1:])) for p in rows])
def parts(g,kind='Polygon'):
    if g.is_empty:return []
    if g.geom_type==kind:return [g]
    return [p for sub in getattr(g,'geoms',[]) for p in parts(sub,kind)]
def dump(p,v):p.write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')))

def main():
    DERIVED.mkdir(exist_ok=True)
    source=ROOT/'data/source/citywide/shanghai-20261022.osm.pbf'
    assert source.exists(),'Pinned whole-city PBF is missing; see docs/CITYWIDE.md'
    imported=DERIVED/'citywide.json'
    if not imported.exists():runpy.run_path(str(ROOT/'tools/import-citywide.py'),run_name='__main__')
    raw=json.loads(imported.read_text())
    assert hashlib.sha256(source.read_bytes()).hexdigest()==raw['source']['sha256']
    centralDir=DERIVED/'central-b';os.environ['SHANGHAI_BUILD_OUTPUT']=str(centralDir)
    runpy.run_path(str(ROOT/'tools/build-central.py'),run_name='__main__')
    central=json.loads((centralDir/'city.json').read_text())
    core=box(*central['bounds']);coreMask=prep(core)
    boundary=geometry(raw['boundary']).buffer(0)
    bounds=list(boundary.bounds)
    world=box(*bounds)
    groundPoints=[Point(r['points'][len(r['points'])//2][0],r['points'][len(r['points'])//2][2]) for r in raw['roads'] if not r['bridge'] and not r['tunnel'] and r['layer']==0]
    coastalLand,coastAudit=coastal_land(boundary,raw['coast'],groundPoints)
    auditDir=ROOT/'docs/acceptance/0.3.0';auditDir.mkdir(parents=True,exist_ok=True)
    (auditDir/'coastline-audit.json').write_text(json.dumps(coastAudit,indent=2))
    print('Coastline land area',round(coastalLand.area/1e6,2),'faces',len(coastAudit),flush=True)
    assert 5000<coastalLand.area/1e6<8500,'Coastline assembly did not recover Shanghai land and islands'
    areaByKind=defaultdict(list)
    for a in raw['areas']:
        g=geometry(a['polygons'])
        if not g.is_empty and g.intersects(boundary):areaByKind[a['kind']].append(g.intersection(boundary))
    inland=unary_union(areaByKind['water']).buffer(0)
    # Keep the accepted river/portal geometry in the original central area.
    water=boundary.difference(coastalLand).union(inland.intersection(boundary)).difference(core).union(geometry(central['water'])).buffer(0)
    rampCuts=geometry(central['rampCuts'])
    land=coastalLand.difference(water).difference(rampCuts).buffer(0)
    parks=unary_union(areaByKind['park']+areaByKind['green']).difference(core).union(geometry(central['parks'])).difference(water).buffer(0)
    farmland=unary_union(areaByKind['farmland']+areaByKind['orchard']).buffer(0)
    parkFast=prep(parks);farmFast=prep(farmland);landFast=prep(land)
    print('Water, land use and administrative boundaries assembled',flush=True)
    districts=[]
    for d in raw['districts']:
        g=geometry(d['polygons']).intersection(boundary)
        districts.append({'id':d['id'],'name':d['name'],'polygons':polygons(g.simplify(20,preserve_topology=True)),'landAreaKm2':round(g.intersection(land).area/1e6,2)})

    roads=list(central['roads']);skippedTunnels=0
    for r in raw['roads']:
        if r['layer']>0 and not r['bridge']:r={**r,'bridge':True}
        if r['tunnel'] or r['layer']<0:
            skippedTunnels+=1;continue
        if len(r['points'])<2:continue
        original=LineString([(p[0],p[2]) for p in r['points']])
        clipped=original.intersection(boundary).difference(core)
        width={'expy':20,'major':15,'minor':12,'local':8,'link':7,'pedestrian':5}[r['class']]
        for i,line in enumerate(parts(clipped,'LineString')):
            if line.length<1:continue
            if r['bridge']:
                # Open deck follows the verified OSM line. Vertical clearance is visual.
                n=max(2,math.ceil(line.length/18)); ps=[]
                for j in range(n+1):
                    dist=j*line.length/n;p=line.interpolate(dist);u=min(1,dist/180,(line.length-dist)/180)
                    ps.append([round(p.x,2),round(2.12+max(6,8+r['layer']*3)*(u*u*(3-2*u)),3),round(p.y,2)])
            else:ps=[[round(x,2),2.12,round(z,2)] for x,z in line.coords]
            if r['reverse']:ps.reverse()
            roads.append({k:r[k] for k in ['id','name','class','mode','oneway','layer','bridge','directionSource','levelSource']}|{'id':r['id']+(f'-part-{i}' if i else ''),'points':ps,'width':width,'heightSource':'visual-estimate-clearance' if r['bridge'] else 'flat-ground','nodeIds':[f'{p[0]},{p[1]},{p[2]}' for p in ps]})
    roadLines=[LineString([(p[0],p[2]) for p in r['points']]) for r in roads]
    roadTree=STRtree(roadLines)
    print('Drivable / pedestrian road objects',len(roads),flush=True)
    landmarks=central['landmarks'];reserves=unary_union([Point(l['x'],l['z']).buffer(l['reserve']) for l in landmarks]);reserveFast=prep(reserves)
    bs=list(central['buildings']);keys=set();real=0
    for b in raw['buildings']:
        for idx,p in enumerate(b['polygons']):
            g=make_valid(Polygon(p[0],p[1:]))
            for poly in parts(g):
                if poly.area<25 or core.intersects(poly) or not landFast.covers(poly) or reserveFast.intersects(poly):continue
                rr=poly.minimum_rotated_rectangle;q=list(rr.exterior.coords);w=math.dist(q[0],q[1]);d=math.dist(q[1],q[2]);x,z=rr.centroid.x,rr.centroid.y
                if min(w,d)<4 or max(w,d)>220:continue
                key=(round(x,1),round(z,1),round(poly.area))
                if key in keys:continue
                # Rectangular runtime massing must not close an adjacent street.
                if any(roadLines[int(j)].distance(rr)<roads[int(j)]['width']/2+.4 for j in roadTree.query(rr.buffer(12))):continue
                keys.add(key);real+=1
                h=b['h'] or (min(48,max(w,d)*.9) if poly.area>400 else 9.6)
                bs.append({'id':b['id']+f'-{idx}','x':round(x,2),'z':round(z,2),'w':round(w,2),'d':round(d,2),'h':round(min(350,h),2),'ry':round(-math.atan2(q[1][1]-q[0][1],q[1][0]-q[0][0]),5),'style':0 if h>70 else 1 if h>24 else 3,'source':'OSM:footprint','heightSource':b['heightSource'],'footprint':p[0]})
    print('Source buildings outside core',real,flush=True)
    byCell=defaultdict(list)
    for b in bs:byCell[(math.floor(b['x']/SIZE),math.floor(b['z']/SIZE))].append(b)
    places=list(central['places'])
    hints=[
      ('huangpu','黄浦 · 人民广场','黄浦区',121.475,31.230),('xuhui','徐汇 · 徐家汇','徐汇区',121.437,31.188),
      ('changning','长宁 · 中山公园','长宁区',121.415,31.219),('jingan-district','静安 · 大宁','静安区',121.453,31.275),
      ('putuo','普陀 · 长风','普陀区',121.399,31.230),('hongkou','虹口 · 鲁迅公园','虹口区',121.478,31.270),
      ('yangpu','杨浦 · 五角场','杨浦区',121.516,31.300),('minhang','闵行 · 莘庄','闵行区',121.381,31.111),
      ('baoshan','宝山 · 友谊路','宝山区',121.485,31.404),('jiading','嘉定 · 州桥','嘉定区',121.243,31.384),
      ('pudong','浦东 · 世纪公园','浦东新区',121.550,31.215),('jinshan','金山 · 城市沙滩','金山区',121.342,30.727),
      ('songjiang','松江 · 老城','松江区',121.226,31.010),('zhujiajiao','青浦 · 朱家角','青浦区',121.052,31.109),
      ('fengxian','奉贤 · 南桥','奉贤区',121.469,30.919),('chongming','崇明 · 南门','崇明区',121.397,31.624),
      ('changxing','长兴岛','崇明区',121.715,31.386),('hengsha','横沙岛','崇明区',121.837,31.334),
      ('dishui','临港 · 滴水湖','浦东新区',121.929,30.898),('pudong-airport','浦东机场周边','浦东新区',121.805,31.150),
      ('hongqiao','虹桥枢纽周边','闵行区',121.314,31.197),('disney','上海迪士尼周边','浦东新区',121.660,31.144),
      ('sheshan','佘山周边','松江区',121.191,31.098),('qingpu','青浦 · 夏阳湖','青浦区',121.120,31.149)]
    rad=math.pi/180;s=math.sin(31.237*rad);e2=6.69437999014e-3;sx=rad*6378137/math.sqrt(1-e2*s*s)*math.cos(31.237*rad);sz=rad*6378137*(1-e2)/(1-e2*s*s)**1.5
    roadLand=prep(land)
    for id,name,district,lon,lat in hints:
        target=Point((lon-121.495)*sx,-(lat-31.237)*sz)
        candidates=[]
        for j in roadTree.query(target.buffer(2500)):
            j=int(j);r=roads[j]
            if r.get('bridge') or r['mode']=='person' or r['class']=='expy':continue
            line=roadLines[j];q=line.interpolate(line.project(target))
            if not roadLand.covers(q):continue
            candidates.append((line.distance(target)+(0 if r['name'] else 60),j,q))
        assert candidates,'No valid source road near '+name
        _,j,q=min(candidates,key=lambda p:p[0]);r=roads[j]
        places.append({'id':id,'name':name,'district':district,'aliases':[district,name.split(' · ')[-1]],'x':round(q.x,2),'z':round(q.y,2),'near':[lon,lat],'road':r['name'],'source':r['id']})
    # All cells in the bounding box exist, including empty water; flight never
    # runs into an undeclared gap between islands.
    stage=ROOT/'public/data-citywide-build'
    if stage.exists():shutil.rmtree(stage)
    (stage/'tiles').mkdir(parents=True)
    playable=polygons(boundary.simplify(.1,preserve_topology=True));boundaryFast=prep(boundary)
    manifest={'schemaVersion':2,'sourceVersion':raw['source']['sha256'],'origin':central['origin'],'bounds':bounds,'playableBoundary':playable,'tileSizeM':SIZE,'collisionHaloM':180,'attribution':'© OpenStreetMap contributors · ODbL 1.0','tiles':[],'routes':[]}
    totalFill=0;totalBytes=0;tileCount=0;fieldTileCount=0
    x0,z0,x1,z1=bounds
    for ix in range(math.floor(x0/SIZE),math.ceil(x1/SIZE)):
      for iz in range(math.floor(z0/SIZE),math.ceil(z1/SIZE)):
        cell=box(ix*SIZE,iz*SIZE,(ix+1)*SIZE,(iz+1)*SIZE);id=f'{ix}_{iz}';rng=random.Random(f'shanghai:{id}')
        cellLand=land.intersection(cell) if landFast.intersects(cell) else Polygon();cellWater=water.intersection(cell);cellPark=parks.intersection(cell) if parkFast.intersects(cell) else Polygon()
        indices=[int(j) for j in roadTree.query(cell)]
        localRoads=[]
        for j in indices:
            r=roads[j]
            for section in parts(LineString([(p[0],p[2],p[1]) for p in r['points']]).intersection(cell).difference(rampCuts),'LineString'):
                localRoads.append(road_payload(r,[[round(x,2),round(y,3),round(z,2)] for x,z,y in section.coords]))
        buffers=[roadLines[j].buffer(roads[j]['width']/2+3,quad_segs=2) for j in indices if not roads[j].get('bridge')]
        shoulder=unary_union(buffers).intersection(cell).intersection(land) if buffers else Polygon()
        cellBs=byCell[(ix,iz)]
        # Deterministic street-front infill, limited by actual land use. Rural
        # roads keep sparse low-rise massing instead of receiving a city grid.
        occupied=[Polygon(b['footprint']) if 'footprint' in b else Point(b['x'],b['z']).buffer(max(b['w'],b['d'])) for b in cellBs]
        occupiedFast=prep(unary_union(occupied).buffer(4))
        accepted=[]
        for j in indices:
            r=roads[j]
            if r.get('bridge') or r['class'] in ('expy','link','pedestrian'):continue
            line=roadLines[j].intersection(cell)
            for route in parts(line,'LineString'):
                for dist in range(20,int(route.length),44):
                    q=route.interpolate(dist);a=route.interpolate(max(0,dist-1));b=route.interpolate(min(route.length,dist+1));angle=math.atan2(b.y-a.y,b.x-a.x)
                    for side in (-1,1):
                        x=q.x-math.sin(angle)*(r['width']/2+16)*side;z=q.y+math.cos(angle)*(r['width']/2+16)*side
                        p=Point(x,z)
                        if not cell.covers(p) or coreMask.covers(p) or not landFast.covers(p) or farmFast.intersects(p) or parkFast.intersects(p) or reserveFast.intersects(p):continue
                        if math.hypot(x,z)>16000 and rng.random()<.65:continue
                        w=rng.uniform(12,22);d=rng.uniform(11,20);poly=box(x-w/2,z-d/2,x+w/2,z+d/2)
                        if not landFast.covers(poly) or occupiedFast.intersects(poly) or any(poly.distance(roadLines[k])<roads[k]['width']/2+2 for k in indices):continue
                        if any(poly.distance(other)<4 for other in accepted):continue
                        h=rng.uniform(9,22) if math.hypot(x,z)>16000 else rng.uniform(15,42)
                        cellBs.append({'id':f'infill-{id}-{len(accepted)}','x':round(x,2),'z':round(z,2),'w':round(w,2),'d':round(d,2),'h':round(h,2),'ry':0,'style':3 if h<22 else 1,'source':'procedural','heightSource':'visual-estimate','footprint':[[round(x,2),round(z,2)] for x,z in poly.exterior.coords]});accepted.append(poly);totalFill+=1
        tile={'id':id,'buildings':cellBs,'land':polygons(cellLand.simplify(.2,preserve_topology=True)),'water':polygons(cellWater.simplify(.2,preserve_topology=True)),'parks':polygons(cellPark.simplify(.5,preserve_topology=True)),'shoulders':polygons(shoulder.simplify(.2,preserve_topology=True)),'roads':localRoads}
        empty=not cellBs and not localRoads and cellLand.is_empty
        inline='water' if empty and boundaryFast.covers(cell) else 'void' if empty and not boundaryFast.intersects(cell) else None
        if not inline:
            tile['farmland']=polygons(farmland.intersection(cell).simplify(.3,preserve_topology=True)) if farmFast.intersects(cell) else []
            fieldTileCount+=bool(tile['farmland'])
        content=json.dumps(tile,ensure_ascii=False,separators=(',',':')).encode()
        if not inline:(stage/'tiles'/f'{id}.json').write_bytes(content)
        totalBytes+=0 if inline else len(content);tileCount+=1
        manifest['tiles'].append({'id':id,'bounds':[ix*SIZE,iz*SIZE,(ix+1)*SIZE,(iz+1)*SIZE],**({'inline':inline} if inline else {'url':f'./data/tiles/{id}.json'}),'bytes':len(content),'hash':hashlib.sha256(content).hexdigest()})
        if tileCount%1000==0:print('City tiles',tileCount,'bytes',totalBytes,flush=True)
    for t in central['tunnels']:
        ids=[m['id'] for m in manifest['tiles'] if any(m['bounds'][0]-180<=p[0]<=m['bounds'][2]+180 and m['bounds'][1]-180<=p[2]<=m['bounds'][3]+180 for p in t['points'])]
        manifest['routes'].append({'id':t['id'],'tiles':ids})
    overview=[{k:b[k] for k in ['id','x','z','w','d','h','ry','style','source','heightSource']} for b in bs if b['h']>=65][:14900]
    mapRoads=[]
    for r,line in zip(roads,roadLines):
        if r['class'] in ('major','minor','expy'):
            mapRoads.append({'width':r['width'],'points':[[round(x,1),2.12,round(z,1)] for x,z in line.simplify(8).coords]})
    city={**central,'centralRegion':central['region'],'schemaVersion':3,'region':{'id':'shanghai-citywide','name':'上海全市','districtCount':16,'boundsWgs84':[121.495+bounds[0]/sx,31.237-bounds[3]/sz,121.495+bounds[2]/sx,31.237-bounds[1]/sz],'areaKm2':round(boundary.area/1e6,2),'landAreaKm2':round(land.area/1e6,2),'boundsAreaKm2':round(world.area/1e6,2)},'bounds':bounds,'districts':districts,'administrativeBoundary':polygons(boundary.simplify(12,preserve_topology=True)),'land':polygons(land.difference(core).simplify(12,preserve_topology=True).union(geometry(central['land']))),'water':polygons(water.difference(core).simplify(6,preserve_topology=True).union(geometry(central['water']))),'waterAreaM2':round(water.area),'parks':[],'asphalt':[],'shoulders':[],'roads':central['roads'],'mapRoads':mapRoads,'buildings':overview,'places':places,'source':{**central['source'],'fullCity':raw['source'],'fullCityTimestamp':raw['timestamp'],'limitations':central['source']['limitations']+['outside central B: OSM footprints plus deterministic street-front infill; building heights may be estimated','other underground roads excluded until tunnel geometry is validated; named OSM bridge decks use estimated vertical clearance','flat terrain; no surveyed elevation or airport interiors','city administrative area includes jurisdictional water; landAreaKm2 is geometric land after mapped water subtraction']}}
    city['outside']=polygons(world.difference(boundary).simplify(6,preserve_topology=True))
    dump(stage/'city.json',city);dump(stage/'manifest.json',manifest)
    report={'version':'0.3.0','profile':'shanghai-citywide','districts':16,'roads':len(roads),'realBuildings':sum(b['source']!='procedural' for b in bs),'proceduralBuildings':sum(b['source']=='procedural' for b in bs)+totalFill,'centralBuildings':len(central['buildings']),'tiles':len(manifest['tiles']),'tileSizeM':SIZE,'tilePayloadBytes':totalBytes,'tilesWithFarmland':fieldTileCount,'bootstrapBytes':(stage/'city.json').stat().st_size,'landAreaKm2':city['region']['landAreaKm2'],'administrativeAreaKm2':city['region']['areaKm2'],'boundsAreaKm2':city['region']['boundsAreaKm2'],'waterAreaM2':round(water.area),'destinations':len(landmarks)+len(places),'sourceSHA256':raw['source']['sha256'],'sourceTimestamp':raw['timestamp'],'skippedSourceGeometries':raw['skippedGeometries'],'otherUndergroundRoadsExcluded':skippedTunnels,'tunnels':[{k:t[k] for k in ['id','length','width','widthSource','heightSource']} for t in central['tunnels']],'citySHA256':hashlib.sha256((stage/'city.json').read_bytes()).hexdigest()}
    # Publish only a fully built data tree. Old release archives are independent.
    if OUT.exists():shutil.rmtree(OUT)
    stage.replace(OUT);(ROOT/'docs/data-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
