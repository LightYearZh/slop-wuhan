#!/usr/bin/env python3
"""Convert OSM Overpass JSON or OSM XML into bounded, metric, browser-ready city data.
Preserves multipolygon holes and clips geometry to the pilot boundary.
"""
import argparse, datetime, hashlib, json, math, pathlib, re, xml.etree.ElementTree as ET
from shapely.geometry import Polygon, LineString, box
from shapely import make_valid

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_BBOX = (30.576, 114.2826, 30.594, 114.3034) # south west north east
ROADS = {'motorway': 14, 'trunk': 12, 'primary': 10, 'secondary': 9, 'tertiary': 8,
         'residential': 6, 'unclassified': 6, 'living_street': 5, 'service': 4,
         'pedestrian': 6, 'footway': 2, 'path': 2, 'cycleway': 2, 'steps': 2,
         'motorway_link': 6, 'trunk_link': 6, 'primary_link': 6, 'secondary_link': 5,
         'tertiary_link': 5}


def projector(bbox):
    south, west, north, east = bbox
    lat0, lon0 = (south+north)/2, (west+east)/2
    mx = 111320.0*math.cos(math.radians(lat0))
    mz = 111132.0
    return lambda lon, lat: [round((lon-lon0)*mx, 2), round((lat0-lat)*mz, 2)]


def height(tags):
    if tags.get('height'):
        m = re.search(r'^\s*(\d+(?:\.\d+)?)\s*(?:m|metres|meters)?\s*$', tags['height'].lower())
        if m:
            v = float(m.group(1))
            if 2 <= v <= 650: return round(v, 1), 'osm_height'
    if tags.get('building:levels'):
        try:
            v = float(tags['building:levels'])*3.25
            if 2 <= v <= 650: return round(v, 1), 'osm_levels'
        except ValueError: pass
    return 12.0, 'visual_estimate'


def join_relation_rings(segments):
    """Stitch OSM relation outer way segments into closed rings."""
    waiting=[list(s) for s in segments if len(s)>=2]
    rings=[]
    while waiting:
        ring=waiting.pop()
        while ring[0]!=ring[-1] and waiting:
            tail=ring[-1]
            for i,part in enumerate(waiting):
                if part[0]==tail:
                    ring.extend(part[1:]);waiting.pop(i);break
                if part[-1]==tail:
                    ring.extend(list(reversed(part[:-1])));waiting.pop(i);break
            else: break
        if len(ring)>=4 and ring[0]==ring[-1]:rings.append(ring)
    return rings


def point_in_ring(point, ring):
    x,y=point; inside=False
    for a,b in zip(ring,ring[1:]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            inside=not inside
    return inside


def relation_features(id_, tags, members, diagnostics):
    parts={role:[] for role in ('outer','inner')}
    for role,coords in members:
        if role in parts: parts[role].append(coords)
    rings={role:join_relation_rings(segments) for role,segments in parts.items()}
    for role,segments in parts.items():
        expected=sum(len(s)-1 for s in segments)
        actual=sum(len(r)-1 for r in rings[role])
        if expected!=actual:diagnostics.append(f'{id_}: incomplete {role} ring')
    for i,outer in enumerate(rings['outer']):
        holes=[r for r in rings['inner'] if point_in_ring(r[0],outer)]
        yield f'{id_}/outer/{i}',tags,outer,holes


def parse_overpass(path, diagnostics=None):
    diagnostics=diagnostics if diagnostics is not None else []
    obj=json.loads(path.read_text(encoding='utf-8'))
    if obj.get('remark'):raise ValueError('Overpass returned a partial/error response: '+obj['remark'])
    elements=obj.get('elements',[])
    relations=[e for e in elements if e.get('type')=='relation' and e.get('tags',{}).get('type')=='multipolygon']
    member_ids={m['ref'] for e in relations for m in e.get('members',[]) if m.get('type')=='way'}
    for item in elements:
        tags=item.get('tags',{})
        if item.get('type')=='way' and item.get('geometry'):
            # Relation owns area geometry; keep highway ways independently.
            if item['id'] in member_ids:
                tags={k:v for k,v in tags.items() if k not in ('building','natural','waterway','landuse','leisure')}
            yield f"way/{item['id']}",tags,[[p['lon'],p['lat']] for p in item['geometry']]
        elif item in relations:
            members=[(m.get('role') or 'outer',[[p['lon'],p['lat']] for p in m.get('geometry',[])])
                     for m in item.get('members',[]) if m.get('type')=='way']
            yield from relation_features(f"relation/{item['id']}",tags,members,diagnostics)


def parse_xml(path, diagnostics=None):
    diagnostics=diagnostics if diagnostics is not None else []
    nodes={};ways={};relations=[]
    for _,elem in ET.iterparse(path,events=('end',)):
        if elem.tag=='node':
            nodes[elem.get('id')]=[float(elem.get('lon')),float(elem.get('lat'))];elem.clear()
        elif elem.tag=='way':
            refs=[n.get('ref') for n in elem.findall('nd')]
            coords=[nodes[r] for r in refs if r in nodes]
            if len(coords)!=len(refs):
                diagnostics.append(f"way/{elem.get('id')}: missing nodes");coords=[]
            ways[elem.get('id')]=({t.get('k'):t.get('v') for t in elem.findall('tag')},coords)
            elem.clear()
        elif elem.tag=='relation':
            tags={t.get('k'):t.get('v') for t in elem.findall('tag')}
            if tags.get('type')=='multipolygon':
                relations.append((elem.get('id'),tags,[(m.get('role') or 'outer',m.get('ref')) for m in elem.findall('member') if m.get('type')=='way']))
            elem.clear()
    member_ids={ref for _,_,members in relations for _,ref in members}
    for id_,(tags,coords) in ways.items():
        if id_ in member_ids:tags={k:v for k,v in tags.items() if k not in ('building','natural','waterway','landuse','leisure')}
        if coords:yield f'way/{id_}',tags,coords
    for id_,tags,members in relations:
        yield from relation_features(f'relation/{id_}',tags,[(role,ways.get(ref,({},[]))[1]) for role,ref in members],diagnostics)


def geometry_parts(geom, kind):
    if geom.is_empty:return
    if geom.geom_type==kind:yield geom
    elif hasattr(geom,'geoms'):
        for part in geom.geoms:yield from geometry_parts(part,kind)


def area_parts(points, holes, clipbox):
    geom=make_valid(Polygon(points,holes)).intersection(box(*clipbox))
    for poly in geometry_parts(geom,'Polygon'):
        if poly.area<0.1:continue
        yield {'points':[list(p) for p in poly.exterior.coords],
               'holes':[[list(p) for p in r.coords] for r in poly.interiors]}


def distinct(coords):
    result=[]
    for pt in coords:
        if not result or pt!=result[-1]:result.append(pt)
    return result


def in_bounds(poly, bbox):
    south,west,north,east=bbox
    # Bounding-box intersection, intentionally allows overhanging edges beyond AOI.
    return bool(poly and not (max(p[0] for p in poly)<west or min(p[0] for p in poly)>east or max(p[1] for p in poly)<south or min(p[1] for p in poly)>north))


def clip_polygon(path, bbox_xy):
    """Sutherland-Hodgman rectangle clipping in local metric coordinates."""
    xmin,zmin,xmax,zmax=bbox_xy
    poly=path[:-1] if path[0]==path[-1] else list(path)
    if len(poly)<3:return []
    for axis,bound,keep in [(0,xmin,1),(0,xmax,-1),(1,zmin,1),(1,zmax,-1)]:
        if not poly:break
        out=[]
        for a,b in zip(poly[-1:]+poly[:-1],poly):
            da=keep*(a[axis]-bound);db=keep*(b[axis]-bound)
            ia,ib=da>=0,db>=0
            if ia!=ib:
                t=(bound-a[axis])/(b[axis]-a[axis]) if b[axis]!=a[axis] else 0
                out.append([round(a[0]+t*(b[0]-a[0]),2),round(a[1]+t*(b[1]-a[1]),2)])
            if ib:out.append(b)
        poly=out
    if len(poly)<3:return []
    return poly+[poly[0]]


def simplify(path, tolerance=0.8):
    # Lightweight distance-based consecutive point reduction; preserve last point.
    if len(path)<3: return path
    result=[path[0]]
    for p in path[1:-1]:
        if (p[0]-result[-1][0])**2+(p[1]-result[-1][1])**2>=tolerance*tolerance:result.append(p)
    result.append(path[-1]);return result


def convert(source, bbox=DEFAULT_BBOX):
    proj=projector(bbox); roads=[]; buildings=[]; water=[]; parks=[]
    sw=proj(bbox[1],bbox[0]);ne=proj(bbox[3],bbox[2])
    clipbox=(sw[0],ne[1],ne[0],sw[1])
    stats={'source_ways':0,'heights_from_osm':0,'estimated_heights':0,'out_of_bounds_ways':0}
    for feature in source:
        id_,tags,geo=feature[:3]
        holes=feature[3] if len(feature)>3 else []
        stats['source_ways']+=1
        if len(geo)<2 or not in_bounds(geo,bbox):
            stats['out_of_bounds_ways']+=1;continue
        pts=distinct([proj(*p) for p in geo])
        hole_pts=[distinct([proj(*p) for p in ring]) for ring in holes]
        if len(pts)<2:continue
        name=tags.get('name:zh') or tags.get('name') or ''
        hw=tags.get('highway')
        if hw in ROADS:
            width = float(tags.get('width') or 0) if re.fullmatch(r'\d+(?:\.\d+)?',tags.get('width','')) else 0
            width=max(1.5,min(30,width)) if width else ROADS[hw]
            for i,line in enumerate(geometry_parts(LineString(pts).intersection(box(*clipbox)),'LineString')):
                roads.append({'id':f'{id_}/segment/{i}','osm_id':id_,'name':name,'type':hw,'width':width,
                    'oneway':tags.get('oneway','unknown'),'layer':tags.get('layer','0'),
                    'bridge':tags.get('bridge','no'),'tunnel':tags.get('tunnel','no'),
                    'points':[list(p) for p in line.coords]})
        if tags.get('building') and tags.get('building')!='no' and len(pts)>=4 and pts[0]==pts[-1]:
            h,hs=height(tags)
            stats['estimated_heights' if hs=='visual_estimate' else 'heights_from_osm']+=1
            for i,area in enumerate(area_parts(pts,hole_pts,clipbox)):
                buildings.append({'id':f'{id_}/part/{i}','osm_id':id_,'name':name,'use':tags.get('building','yes'),'height':h,'height_source':hs,**area})
        is_closed = len(pts)>=4 and pts[0]==pts[-1]
        if is_closed and (tags.get('natural')=='water' or tags.get('waterway')=='riverbank' or tags.get('landuse')=='reservoir'):
            for i,area in enumerate(area_parts(pts,hole_pts,clipbox)):
                water.append({'id':f'{id_}/part/{i}','osm_id':id_,'name':name,**area})
        if is_closed and (tags.get('leisure')=='park' or tags.get('landuse') in ('grass','forest','meadow','recreation_ground')):
            for i,area in enumerate(area_parts(pts,hole_pts,clipbox)):
                parks.append({'id':f'{id_}/part/{i}','osm_id':id_,'name':name,**area})
    city={'schema':2,'name':'武汉·汉口试验区','area':'江汉路—沿江大道','projection':'local-equirectangular WGS84 metres x=east z=south',
          'bbox_swen':bbox,'center_wgs84':[round((bbox[1]+bbox[3])/2,7),round((bbox[0]+bbox[2])/2,7)],
          'width_m':round((bbox[3]-bbox[1])*111320*math.cos(math.radians((bbox[0]+bbox[2])/2))),
          'depth_m':round((bbox[2]-bbox[0])*111132), 'terrain':'flat-placeholder-not-a-DEM',
          'roads':roads,'buildings':buildings,'water':water,'parks':parks}
    stats.update({'roads':len(roads),'buildings':len(buildings),'water_polygons':len(water),'parks':len(parks),'polygon_holes':sum(len(p.get('holes',[])) for p in water+parks+buildings)})
    return city, stats


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input',required=True, type=pathlib.Path, help='Overpass JSON with out geom, or Osmium-extracted .osm XML')
    ap.add_argument('--bbox',nargs=4,type=float,default=DEFAULT_BBOX,metavar=('S','W','N','E'))
    ap.add_argument('--output',type=pathlib.Path,default=ROOT/'web/data/city.json')
    args=ap.parse_args()
    if not args.input.is_file():ap.error(f'File not found: {args.input}')
    if not (args.bbox[0]<args.bbox[2] and args.bbox[1]<args.bbox[3]):ap.error('Invalid bbox (S W N E)')
    diagnostics=[]
    source=parse_xml(args.input,diagnostics) if args.input.suffix.lower()=='.osm' else parse_overpass(args.input,diagnostics)
    city,stats=convert(source,args.bbox)
    if not stats['roads']:
        raise SystemExit('ERROR: no roads in input AOI; refusing to write empty city file')
    city['source']={'file':args.input.name,'sha256':hashlib.sha256(args.input.read_bytes()).hexdigest(),
                    'attribution':'© OpenStreetMap contributors','license':'ODbL 1.0'}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(city,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    report={'generated_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'source_file':args.input.name,'source_sha256':city['source']['sha256'],'bbox_swen':args.bbox,'stats':stats,'geometry_warnings':diagnostics,
            'limitations':['Missing building outlines are NOT invented','Unverified heights estimated at 12 metres',
                'Incomplete relation rings omitted and reported in geometry_warnings','Road levels/bridge/tunnel retained but not rendered in 3D yet',
                'Flat terrain placeholder; no DEM','Roads have no routable navigation graph yet']}
    (args.output.parent/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Saved',args.output,'\n',json.dumps(stats,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
