"""Station identity and WGS84 source normalization, independent of rendering."""
import re,math
from collections import defaultdict
from shapely.geometry import Polygon
from shapely import make_valid
ALIASES={'徐泾东':'国家会展中心','东昌路':'浦东南路','浦东国际机场':'浦东1号2号航站楼','浦东机场':'浦东1号2号航站楼','松江南站':'上海松江站','黄陂南路':'一大会址·黄陂南路','新天地':'一大会址·新天地','蟠祥路':'蟠祥路·国家会计学院'}
def valid_polygons(items):
 return [make_valid(Polygon(p[0],p[1:])) for p in items if p and len(p[0])>=3]
def road_facing_heading(anchor,segments):
 best=None
 for s in segments:
  d=max(0,min(s['length'],(anchor['x']-s['a'][0])*s['dx']+(anchor['z']-s['a'][2])*s['dz']))
  dx=s['a'][0]+s['dx']*d-anchor['x'];dz=s['a'][2]+s['dz']*d-anchor['z'];distance=math.hypot(dx,dz)
  if best is None or distance<best[0]:best=(distance,math.atan2(dx,dz))
 return best[1]
def normalize_name(name):
 name=ALIASES.get(name,name)
 return re.sub(r'[·・•\s（）()]','',name).rstrip('站')
def is_active_rail(tags):
 name=tags.get('name:zh') or tags.get('name','')
 if re.search(r'[（(](?:在建|待建|规划|废弃)[）)]',name):return False
 if any(tags.get(k) not in (None,'no','false','0') for k in ['construction','disused','proposed','abandoned']):return False
 return tags.get('station') in ('subway','light_rail','monorail') or tags.get('subway')=='yes' or tags.get('network')=='上海地铁'
def group_stations(features,reference):
 names={};members=defaultdict(list)
 for line in reference:
  for station in line['stations']:
   key=normalize_name(station['name']);item=names.setdefault(key,{'stationName':station['name'],'lines':set(),'officialCodes':set()});item['lines'].add(str(line['line']));item['officialCodes'].add(station['code'])
 for feature in features:
  t=feature['tags'];key=normalize_name(t.get('name:zh') or t.get('name',''))
  if key in names and is_active_rail(t):members[key].append(feature)
 result=[]
 for key,items in members.items():
  preferred=[f for f in items if f['tags'].get('railway') in ('station','halt') or f['tags'].get('public_transport')=='station'] or items
  points=[]
  for f in preferred:
   if f['type']=='node':points.append((f['lon'],f['lat']))
   elif len(f.get('coords',[]))>=3:
    p=Polygon(f['coords']).centroid
    if not p.is_empty:points.append((p.x,p.y))
  if not points:continue
  record=names[key];base=record['stationName'];name=base if base.endswith('站') else base+'站';lines=sorted(record['lines'],key=lambda n:int(n) if n.isdigit() else 999)
  aliases=sorted({base,'地铁'+base,base+'地铁站','地铁','轨道交通','metro','subway',*[x+'号线' if x.isdigit() else x for x in lines],*[f['tags'].get('name:zh') or f['tags'].get('name','') for f in items]}-{''})
  result.append({'id':'metro-'+min(record['officialCodes']),'name':name,'stationName':base,'lines':lines,'officialCodes':sorted(record['officialCodes']),'aliases':aliases,'lon':sum(p[0] for p in points)/len(points),'lat':sum(p[1] for p in points)/len(points),'sourceIds':sorted({f"osm-{f['type']}-{f['id']}" for f in items}),'coordinateSource':'OSM WGS84 station objects; centroid across interchange objects','metro':True})
 return sorted(result,key=lambda r:r['id'])
