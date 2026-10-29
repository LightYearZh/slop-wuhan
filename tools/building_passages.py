"""Ground occupancy is not a building's complete roof outline.

Reviewed gates and explicit OSM roofs get shared solid volumes for rendering,
collision and ground-road trimming. Ordinary buildings keep their full footprint.
"""
import math,collections
from shapely.geometry import Polygon,LineString,Point,box
from shapely.ops import unary_union,transform

REVIEWED={
 'osm-building-way-675137415':('铁门关','city-gate'),
 'osm-building-relation-20802715':('江汉门','riverfront-gate')}
REVIEWED_ROADS={
 'osm-way-1055558222','osm-way-1055558225', # OSM tunnel=building_passage, two directions
 'osm-way-675321054','osm-way-675321062', # the mapped side foot passages
 'osm-way-1525361062','osm-way-1525361064'} # covered Jianghan Gate foot passages

def open_building(item):
    tags=item.get('tags',{})
    return item['id'] in REVIEWED or tags.get('building')=='roof' or tags.get('man_made')=='ceremonial_gate'

def surface_passage(road):
    # Ground-level building passages are not underwater/road tunnels. Negative and
    # upper layers stay separate, apart from the six individually reviewed gate paths.
    return road['id'] in REVIEWED_ROADS or road.get('tunnelTag')=='building_passage' and road.get('layer')==0

def pieces(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [g]
    return [p for child in getattr(g,'geoms',[]) for p in pieces(child)]

def rings(g):
    return [[[round(x,3),round(z,3)] for x,z in r.coords] for r in [g.exterior,*g.interiors]]

def frame(poly):
    q=list(poly.minimum_rotated_rectangle.exterior.coords)
    a,b=max(zip(q,q[1:]),key=lambda pair:math.dist(*pair));w=math.dist(a,b);ux=(b[0]-a[0])/w;uz=(b[1]-a[1])/w
    if ux<0:ux,uz=-ux,-uz
    center=poly.minimum_rotated_rectangle.centroid
    return {'x':center.x,'z':center.y,'ux':ux,'uz':uz,'w':w,'d':poly.area/w}

def apply_passages(buildings,raw,roads,hills,sample_height):
    source={b['id']:b for b in raw['buildings']};counts=collections.Counter();profiles=[]
    road_lines=[(r,LineString([(p[0],p[2]) for p in r['points']])) for r in roads]
    for b in buildings:
        item=source.get(b['id'].rsplit('-',1)[0])
        if not item:continue
        poly=Polygon(b['rings'][0],b['rings'][1:])
        mapped=[(r,line) for r,line in road_lines if r.get('passageOriginalTags',{}).get('tunnel')=='building_passage' and line.intersection(poly).length>.2]
        if not open_building(item) and not mapped:continue
        reviewed=REVIEWED.get(item['id']);tags=item.get('tags',{})
        if reviewed and item.get('name')!=reviewed[0]:raise ValueError('Passage identity mismatch: '+item['id'])
        kind=reviewed[1] if reviewed else 'ceremonial-gate' if tags.get('man_made')=='ceremonial_gate' else 'canopy' if tags.get('building')=='roof' else 'building-passage'
        f=frame(poly);volumes=[]
        def part(g,base,top,role):
            for p in pieces(g.intersection(poly)):
                if p.area>.025:volumes.append({'rings':rings(p),'baseY':round(base,3),'h':round(top-base,3),'role':role,'heightSource':'visual-estimate:open-building-clearance'})
        def world(g):return transform(lambda u,v:(f['x']+f['ux']*u-f['uz']*v,f['z']+f['uz']*u+f['ux']*v),g)
        openings=[]
        if kind=='building-passage':
            height=b['h'];clearance=4.5 if any(r['mode']=='car' for r,_ in mapped) else 3.2
            clearance=min(clearance,height-.5)
            cut=unary_union([line.buffer(r['width']/2+.4,cap_style=2) for r,line in mapped])
            originals=b.get('massingParts') or [{'rings':b['rings'],'baseY':0,'h':height,'role':'mapped-solid','heightSource':b['heightSource']}]
            for original in originals:
                g=Polygon(original['rings'][0],original['rings'][1:]);lo=original.get('baseY',0);hi=lo+original['h']
                if lo>=clearance:
                    volumes.append(original);continue
                part(g.difference(cut),lo,hi,'passage-side')
                if hi>clearance:part(g.intersection(cut),clearance,hi,'passage-overhead')
        elif kind=='city-gate':
            # One broad vehicle arch for the two carriageways, two smaller foot arches.
            # Widths/clearances are explicit display estimates aligned to OSM roads, not engineering measurements.
            height,wall_top=26.5,13
            openings=[{'u':-15.5,'width':3.8,'spring':3.5,'crown':5.5},{'u':0,'width':20,'spring':6.3,'crown':10.3},{'u':14,'width':3.8,'spring':3.5,'crown':5.5}]
            cut=unary_union([world(box(o['u']-o['width']/2,-30,o['u']+o['width']/2,30)) for o in openings])
            part(poly.difference(cut),0,wall_top,'gate-wall')
            for o in openings:
                steps=math.ceil(o['width']/.5)
                def ceiling(u):return o['spring']+(o['crown']-o['spring'])*math.sqrt(max(0,1-((u-o['u'])/(o['width']/2))**2))
                for i in range(steps):
                    a=o['u']-o['width']/2+o['width']*i/steps;c=o['u']-o['width']/2+o['width']*(i+1)/steps
                    part(world(box(a,-30,c,30)),min(ceiling(a),ceiling(c)),wall_top,'gate-arch')
            part(world(box(-12,-f['d']/2,12,f['d']/2)),wall_top,height,'gate-tower')
            clearance=3.5
        else:
            height=8 if kind=='riverfront-gate' else 7 if kind=='ceremonial-gate' else max(3.8,min(10,item.get('h') or 4.6))
            clearance=height-(1.6 if kind=='ceremonial-gate' else .6)
            part(poly,clearance,height,'gate-canopy')
            # Posts follow the mapped boundary. Never place a support on a restored walking/car route.
            near=[line.buffer(r['width']/2+.7) for r,line in road_lines if line.distance(poly)<3]
            reserved=unary_union(near);inset=poly.buffer(-.45)
            candidates=[]
            for g in pieces(inset):
                edge=g.exterior
                for i in range(max(4,math.ceil(edge.length/8))):
                    p=edge.interpolate(i*edge.length/max(4,math.ceil(edge.length/8)))
                    post=box(p.x-.22,p.y-.22,p.x+.22,p.y+.22)
                    if not reserved.intersects(post) and poly.covers(post) and all(p.distance(q)>2 for q in candidates):
                        candidates.append(p);part(post,0,clearance,'gate-post')
        ground=sample_height(hills,b['x'],b['z'])
        profile={'sourceId':b['id'],'name':b['name'] or '有顶廊架','kind':kind,'frame':f,'openings':openings,'height':height,'groundY':ground,
                 'clearanceM':clearance,'dimensionsSource':'visual-estimate:source-footprint-and-mapped-passage-alignment','sourceTags':tags,
                 'reference':'https://you.ctrip.com/sight/wuhan145/89908.html' if kind=='city-gate' else 'OSM roof / covered passage tags; user-reported Jianghan Gate opening'}
        if kind!='building-passage':
            b.update(heightBeforePassage={'h':b['h'],'heightSource':b['heightSource']},h=height,heightSource='visual-reference:open-building-envelope',
                     heightEvidence={'confidence':'visual-estimate','meaning':'Roof/arch envelope and clearance estimates, not surveyed'})
        b.update(massingParts=volumes,massingSource='OSM:footprint;reviewed-ground-openings',passageProfile=profile)
        profile['mappedPassageRoads']=[r['id'] for r,_ in mapped]
        profiles.append(profile);counts[kind]+=1
    return {'counts':dict(counts),'buildings':profiles,'policy':'Reviewed gates, explicit roof tags and ground-layer OSM building_passage routes. Upper/negative-layer unreviewed passages remain separate.'}
