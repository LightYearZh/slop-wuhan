"""Extract reproducible local-metre features from the pinned full Shanghai PBF."""
from pathlib import Path
import json, math, re, hashlib
import osmium
from shapely import wkb, make_valid
from shapely.ops import transform
from shapely.geometry import box
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/source/citywide'
DERIVED = ROOT / 'data/derived'
ORIGIN = (114.293, 30.585)
PILOT_WGS84 = box(114.2826,30.576,114.3034,30.594)
rad = math.pi / 180
e2 = 6.69437999014e-3
s = math.sin(ORIGIN[1] * rad)
SX = rad * 6378137 / math.sqrt(1 - e2 * s*s) * math.cos(ORIGIN[1] * rad)
SZ = rad * 6378137 * (1-e2) / (1-e2*s*s)**1.5
DISTRICTS = set()
CLASSES = {'motorway':'expy','trunk':'major','primary':'major','secondary':'minor','tertiary':'local','residential':'local','unclassified':'local','living_street':'local','service':'local','pedestrian':'pedestrian','footway':'pedestrian','path':'pedestrian','steps':'pedestrian','cycleway':'pedestrian'}
for kind in ['motorway','trunk','primary','secondary','tertiary']:
    CLASSES[kind+'_link'] = 'link'

def project(lon,lat):
    return ((lon-ORIGIN[0])*SX, -(lat-ORIGIN[1])*SZ)

def polygons(g):
    if g.is_empty: return []
    if g.geom_type == 'Polygon':
        return [[[[round(x,2),round(y,2)] for x,y in ring.coords] for ring in [g.exterior,*g.interiors]]]
    return [p for sub in getattr(g,'geoms',[]) for p in polygons(sub)]

class Importer(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.factory=osmium.geom.WKBFactory()
        self.roads=[]; self.coast=[]; self.buildings=[]; self.areas=[]; self.districts=[]; self.boundary=None
        self.skipped=0

    def way(self,w):
        kind=w.tags.get('highway')
        coast=w.tags.get('natural')=='coastline'
        if kind not in CLASSES and not coast:return
        try:
            geo=[(n.lon,n.lat) for n in w.nodes]
            if not geo or not box(min(p[0] for p in geo),min(p[1] for p in geo),max(p[0] for p in geo),max(p[1] for p in geo)).intersects(PILOT_WGS84):return
            pts=[project(*p) for p in geo]
        except osmium.InvalidLocationError:
            self.skipped+=1; return
        if len(pts)<2:return
        if coast:self.coast.append([[round(x,2),round(z,2)] for x,z in pts])
        if kind not in CLASSES or w.tags.get('access') in ('no','private') or w.tags.get('area')=='yes':return
        name=w.tags.get('name:zh') or w.tags.get('name','')
        tunnel=w.tags.get('tunnel') not in (None,'no','false')
        bridge=w.tags.get('bridge') not in (None,'no','false')
        try:layer=int(w.tags.get('layer','0'))
        except ValueError:layer=0
        self.roads.append({'id':'osm-way-'+str(w.id),'name':name,'class':CLASSES[kind],
            'points':[[round(x,2),2.12,round(z,2)] for x,z in pts],
            'nodeIds':[str(n.ref) for n in w.nodes], 'highway':kind,'widthTag':w.tags.get('width'),'lanesTag':w.tags.get('lanes'),'surfaceTag':w.tags.get('surface'),'footTag':w.tags.get('foot'),'oneway':w.tags.get('oneway') in ('yes','1','-1'),
            'reverse':w.tags.get('oneway')=='-1','bridge':bridge,'tunnel':tunnel,'layer':layer,
            'mode':'person' if CLASSES[kind]=='pedestrian' else 'car',
            'directionSource':'OSM:oneway','levelSource':'OSM:bridge/tunnel/layer'})

    def area(self,a):
        t=a.tags; name=t.get('name:zh') or t.get('name','')
        admin=False
        building=t.get('building') not in (None,'no')
        kind=('water' if t.get('natural')=='water' or t.get('waterway')=='riverbank' or t.get('landuse')=='reservoir' else
              'park' if t.get('leisure') in ('park','garden') else
              'green' if t.get('landuse') in ('forest','grass','meadow','recreation_ground') or t.get('natural') in ('wood','scrub') else
              t.get('landuse') if t.get('landuse') in ('residential','commercial','retail','industrial','farmland','farmyard','orchard') else None)
        if not (admin or building or kind):return
        try:
            raw=wkb.loads(self.factory.create_multipolygon(a),hex=True)
            if not raw.intersects(PILOT_WGS84):return
            geom=make_valid(transform(project,raw))
            if geom.is_empty:return
        except (RuntimeError,ValueError):
            self.skipped+=1;return
        if admin:
            if a.orig_id()==913067:self.boundary=polygons(geom)
            elif name in DISTRICTS:self.districts.append({'id':'osm-relation-'+str(a.orig_id()),'name':name,'polygons':polygons(geom)})
        if kind:self.areas.append({'id':('way-' if a.from_way() else 'relation-')+str(a.orig_id()),'kind':kind,'polygons':polygons(geom.simplify(1,preserve_topology=True))})
        if building:
            raw=t.get('height') or t.get('building:height') or ''
            number=re.search(r'[\d.]+',raw)
            try:height=float(number.group()) if number else float(t.get('building:levels','0'))*3.2
            except ValueError:height=0
            source='OSM:height' if number else 'OSM:levels' if height else 'visual-estimate'
            self.buildings.append({'id':('osm-building-way-' if a.from_way() else 'osm-building-relation-')+str(a.orig_id()),'polygons':polygons(geom.simplify(.3,preserve_topology=True)),'h':height,'heightSource':source,'name':name,'use':t.get('building','yes')})

def main():
    path=ROOT/'data/hubei-latest.osm.pbf'
    if not path.exists():raise SystemExit('Download hubei-latest.osm.pbf to data/ first; see README.md')
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    h=Importer();h.apply_file(str(path),locations=True,idx='flex_mem')
    reader=osmium.io.Reader(str(path));timestamp=reader.header().get('osmosis_replication_timestamp');reader.close()
    meta={'provider':'Geofabrik / OpenStreetMap','url':'https://download.geofabrik.de/asia/china/hubei-latest.osm.pbf','sha256':digest,'timestamp':timestamp,'license':'ODbL 1.0'}
    data={'source':meta,'importerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'roads':h.roads,'buildings':h.buildings,'areas':h.areas,'skippedGeometries':h.skipped}
    DERIVED.mkdir(exist_ok=True)
    (DERIVED/'wuhan.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
    print(json.dumps({'roads':len(h.roads),'buildings':len(h.buildings),'areas':len(h.areas),'skippedGeometries':h.skipped,'timestamp':timestamp},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
