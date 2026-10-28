"""Build one named, walk-in metro entrance per in-city operating station."""
from pathlib import Path
from functools import lru_cache
from collections import defaultdict
import json,math,hashlib,importlib,osmium
from shapely.geometry import Polygon,Point,LineString,box
from shapely.ops import unary_union
from shapely.affinity import rotate,translate
from shapely.strtree import STRtree
from metro_data import normalize_name,is_active_rail,group_stations,valid_polygons,road_facing_heading
geo=importlib.import_module('import-citywide');ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'public';SOURCE=ROOT/'data/source/metro'

def read(path):return json.loads(path.read_text())
def polygons(items):return valid_polygons(items)
def footprint(x,z,heading,width,depth):return translate(rotate(box(-width/2-.2,-depth/2-.2,width/2+.2,depth/2+.2),-math.degrees(heading),origin=(0,0)),xoff=x,yoff=z)

class Collector(osmium.SimpleHandler):
 def __init__(self,keys):super().__init__();self.features=[];self.entrances=[];self.areas=[];self.keys=keys
 def node(self,n):
  t=dict(n.tags)
  if t.get('railway')=='subway_entrance' and t.get('access') not in ('no','private') and not t.get('construction'):
   self.entrances.append({'type':'node','id':n.id,'lon':n.location.lon,'lat':n.location.lat,'tags':t})
  elif is_active_rail(t):self.features.append({'type':'node','id':n.id,'lon':n.location.lon,'lat':n.location.lat,'tags':t})
 def way(self,w):
  t=dict(w.tags)
  if not is_active_rail(t) or (t.get('railway') not in ('station','halt') and t.get('public_transport')!='station'):return
  try:coords=[[n.lon,n.lat] for n in w.nodes]
  except osmium.InvalidLocationError:return
  self.features.append({'type':'way','id':w.id,'coords':coords,'tags':t})
 def relation(self,r):
  t=dict(r.tags)
  if t.get('public_transport')=='stop_area' and normalize_name(t.get('name:zh') or t.get('name','')) in self.keys:
   self.areas.append({'name':t.get('name:zh') or t.get('name',''),'members':[m.ref for m in r.members if m.type=='n']})

class Placement:
 def __init__(self,city,manifest):self.city=city;self.manifest=manifest;self.tiles={t['id']:t for t in manifest['tiles']};self.size=manifest['tileSizeM'];self.used=[]
 @lru_cache(maxsize=512)
 def tile(self,id):
  t=self.tiles.get(id)
  if not t or t.get('inline'):return {'buildings':[],'roads':[],'land':[]}
  return read(PUBLIC/t['url'])
 def context(self,x,z):
  ix,iz=math.floor(x/self.size),math.floor(z/self.size);tiles=[self.tile(f'{i}_{j}') for i in range(ix-1,ix+2) for j in range(iz-1,iz+2)]
  land=unary_union([p for t in tiles for p in polygons(t.get('land',[]))]);buildings=[]
  for t in tiles:
   for b in t['buildings']:buildings.append(translate(rotate(box(-b['w']/2,-b['d']/2,b['w']/2,b['d']/2),-math.degrees(b['ry']),origin=(0,0)),xoff=b['x'],yoff=b['z']))
  for l in self.city['landmarks']:
   if math.hypot(x-l['x'],z-l['z'])<1500:buildings.append(box(l['x']-l['reserve'],l['z']-l['reserve'],l['x']+l['reserve'],l['z']+l['reserve']))
  buildings.extend(polygons(self.city.get('rampCuts',[])));roads=[];segments=[]
  for t in tiles:
   for r in t['roads']:
    if r.get('tunnel'):continue
    points=r['points']
    if len(points)<2:continue
    roads.append(LineString([(p[0],p[2]) for p in points]).buffer(r['width']/2+.25,cap_style='flat'))
    for a,b in zip(points,points[1:]):
     dx,dz=b[0]-a[0],b[2]-a[2];length=math.hypot(dx,dz)
     if length<1:continue
     tval=max(0,min(1,((x-a[0])*dx+(z-a[2])*dz)/length**2));qx,qz=a[0]+tval*dx,a[2]+tval*dz;dist=math.hypot(qx-x,qz-z)
     if dist<350:segments.append({'a':a,'dx':dx/length,'dz':dz/length,'length':length,'t':tval*length,'distance':dist,'width':r['width'],'id':r['id']})
  return land,STRtree(buildings),STRtree(roads),sorted(segments,key=lambda s:s['distance'])[:50]
 def place(self,station,anchors):
  x,z=station['x'],station['z'];land,buildings,roads,segments=self.context(x,z)
  if not segments:raise RuntimeError('No road near '+station['stationName'])
  def valid(candidate,w,d):
   if math.hypot(candidate['x']-x,candidate['z']-z)>=350:return False
   p=footprint(candidate['x'],candidate['z'],candidate['heading'],w,d)
   return land.covers(p) and len(buildings.query(p,predicate='intersects'))==0 and len(roads.query(p,predicate='intersects'))==0 and not any(p.intersects(old) for old in self.used)
  for width,depth in [(4.8,4.4),(3.0,3.6)]:
   candidates=[]
   for anchor in sorted(anchors,key=lambda a:math.hypot(a['x']-x,a['z']-z)):
    candidates.append({'x':anchor['x'],'z':anchor['z'],'heading':road_facing_heading(anchor,segments),'source':'OSM:subway_entrance','sourceId':'osm-node-'+str(anchor['id']),'rawLon':anchor['lon'],'rawLat':anchor['lat']})
   for s in segments:
    for shift in [0,-10,10,-22,22,-40,40,-70,70,-100,100,-150,150]:
     along=max(0,min(s['length'],s['t']+shift));qx,qz=s['a'][0]+s['dx']*along,s['a'][2]+s['dz']*along
     for side in [-1,1]:
      offset=s['width']/2+depth/2+1.1;candidates.append({'x':qx-s['dz']*side*offset,'z':qz+s['dx']*side*offset,'heading':math.atan2(s['dz']*side,-s['dx']*side),'source':'visual-estimate-roadside','roadId':s['id']})
   real=[c for c in candidates if c['source']=='OSM:subway_entrance'];estimated=sorted((c for c in candidates if c['source']!='OSM:subway_entrance'),key=lambda c:math.hypot(c['x']-x,c['z']-z))
   for c in real+estimated:
    if not valid(c,width,depth):continue
    c={**c,'x':round(c['x'],2),'z':round(c['z'],2),'width':width,'depth':depth,'y':2.12};c['heading']=round(c['heading'],8)
    if not valid(c,width,depth):continue
    c['tileId']=f"{math.floor(c['x']/self.size)}_{math.floor(c['z']/self.size)}";c['distanceFromStation']=round(math.hypot(c['x']-x,c['z']-z),2)
    c['approach']={'x':round(c['x']+math.sin(c['heading'])*(depth/2+3.5),2),'z':round(c['z']+math.cos(c['heading'])*(depth/2+3.5),2)};c['safety']={'checkedBuildings':True,'checkedRoads':True,'checkedLand':True};self.used.append(footprint(c['x'],c['z'],c['heading'],width,depth));return c
  raise RuntimeError('No clear entrance footprint within 350m of '+station['stationName'])

def main():
 source=read(SOURCE/'source.json');reference=[]
 for record in source['records']:
  assert hashlib.sha256((SOURCE/record['file']).read_bytes()).hexdigest()==record['sha256'],'Official source changed: '+record['file']
  if record.get('line') not in (None,'51'):reference.append(record)
 pbf=ROOT/'data/source/citywide/shanghai-20261022.osm.pbf';pbfmeta=read(pbf.parent/'source.json');assert hashlib.sha256(pbf.read_bytes()).hexdigest()==pbfmeta['sha256']
 keys={normalize_name(s['name']) for r in reference for s in r['stations']};collector=Collector(keys);collector.apply_file(str(pbf),locations=True,idx='flex_mem');stations=group_stations(collector.features,reference)
 expected={s['name'] for r in reference for s in r['stations']};missing=sorted(expected-{s['stationName'] for s in stations});assert not missing,missing
 city=read(PUBLIC/'data/city.json');manifest=read(PUBLIC/'data/manifest.json');boundary=unary_union(polygons(manifest['playableBoundary']));inside=[];outside=[]
 for s in stations:
  s['x'],s['z']=[round(v,2) for v in geo.project(s['lon'],s['lat'])]
  (inside if boundary.covers(Point(s['x'],s['z'])) else outside).append(s)
 stationKeys={normalize_name(s['stationName']):s for s in inside};entryByKey=defaultdict(list);entryNodes={e['id']:e for e in collector.entrances};claimed=set()
 for area in collector.areas:
  key=normalize_name(area['name'])
  if key not in stationKeys:continue
  for id in area['members']:
   if id in entryNodes:entryByKey[key].append(entryNodes[id]);claimed.add(id)
 points=STRtree([Point(s['x'],s['z']) for s in inside])
 for e in collector.entrances:
  e['x'],e['z']=geo.project(e['lon'],e['lat'])
  if e['id'] not in claimed:
   i=int(points.nearest(Point(e['x'],e['z'])));s=inside[i]
   if math.hypot(e['x']-s['x'],e['z']-s['z'])<450:entryByKey[normalize_name(s['stationName'])].append(e)
 placement=Placement(city,manifest)
 for i,s in enumerate(inside):
  key=normalize_name(s['stationName']);s['entrance']=placement.place(s,entryByKey[key]);s['district']='地铁 · '+ ' / '.join('浦江线' if n=='41' else n+'号线' for n in s['lines'])
  if (i+1)%50==0:print('Metro entrances',i+1,flush=True)
 result={'schemaVersion':1,'source':{'osm':pbfmeta,'official':source,'referenceLines':19,'coordinates':'OSM WGS84; official map GIS coordinates are not used'},'stations':inside,'outsideScope':outside,'missingOfficialStations':missing,'scope':'Operating metro lines 1-18 and Pujiang inside Shanghai; one representative surface entrance per station. Airport link is excluded.','stationCount':len(inside),'realEntranceCount':sum(s['entrance']['source']=='OSM:subway_entrance' for s in inside)}
 out=PUBLIC/'data/metro.json';out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')));audit={'stations':len(inside),'outsideScope':[s['stationName'] for s in outside],'realEntrances':result['realEntranceCount'],'estimatedEntrances':len(inside)-result['realEntranceCount'],'missingOfficialStations':missing,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'maxPlacementDistanceM':max(s['entrance']['distanceFromStation'] for s in inside)};(ROOT/'docs/metro-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2));print(json.dumps(audit,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
