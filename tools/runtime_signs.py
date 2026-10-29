"""Source POIs and attributed generic frontages -> safe wall-mounted sign records."""
import collections,math
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.prepared import prep
from shapely import make_valid

CATS=['convenience','food','drink','health','bank','beauty','hotel','karaoke','shop']

def category(tags):
    kind=tags.get('shop') or tags.get('amenity') or tags.get('tourism')
    if kind in ('convenience','supermarket'):return 'convenience'
    if kind in ('restaurant','fast_food','food_court','deli','bakery','confectionery','ice_cream'):return 'food'
    if kind in ('cafe','beverages','tea','coffee','bar','pub'):return 'drink'
    if kind in ('pharmacy','chemist','clinic','dentist','doctors','optician'):return 'health'
    if kind in ('bank','atm','money_lender','pawnbroker'):return 'bank'
    if kind in ('hairdresser','beauty','massage','cosmetics','nail_salon'):return 'beauty'
    if kind in ('hotel','hostel','guest_house','motel'):return 'hotel'
    if kind in ('karaoke_box','nightclub'):return 'karaoke'
    return 'shop' if tags.get('shop') and kind!='vacant' else None

def sign_footprint(x,z,nx,nz,width,depth,offset):
    # Width is along the wall; depth projects outwards. Same yaw as the renderer.
    return Polygon([(x+nx*(offset+v)+nz*u,z+nz*(offset+v)-nx*u)
                    for u,v in [(-width/2,-depth/2),(width/2,-depth/2),(width/2,depth/2),(-width/2,depth/2)]])

def build_signs(city,height_of):
    shapes=[Polygon(b['rings'][0],b['rings'][1:]) for b in city['buildings']]
    obstacle_shapes=shapes+[Polygon(l['footprint'][0],l['footprint'][1:]) for l in city['landmarks']]
    obstacle_tree=STRtree(obstacle_shapes)
    water=prep(unary_union([make_valid(Polygon(p[0],p[1:])) for p in city['water']]))
    corridors=unary_union([LineString([(p[0],p[2]) for p in r['points']]).buffer(
        (r['width'] if r['mode']=='car' else max(2,r['width']-4))/2+.15) for r in city['roads']])
    corridors=prep(corridors)
    roads=[LineString([(p[0],p[2]) for p in r['points']]) for r in city['roads']];road_tree=STRtree(roads)
    edges=[];lines=[]
    for bi,(b,poly) in enumerate(zip(city['buildings'],shapes)):
        if b.get('passageProfile'):continue # An open gate/canopy is not a shop facade.
        if height_of(b)[0]<6:continue
        for a,c in zip(poly.exterior.coords,list(poly.exterior.coords)[1:]):
            dx,dz=c[0]-a[0],c[1]-a[1];length=math.hypot(dx,dz)
            if length<3:continue
            nx,nz=(dz/length,-dx/length) if poly.exterior.is_ccw else (-dz/length,dx/length)
            mid=Point((a[0]+c[0])/2,(a[1]+c[1])/2)
            facing=False
            for ri in road_tree.query(mid.buffer(24)):
                ri=int(ri);r=city['roads'][ri]
                if r['highway'] in ('steps','path','service'):continue
                q=roads[ri].interpolate(roads[ri].project(mid));d=mid.distance(q)
                if .1<d<r['width']/2+9 and ((q.x-mid.x)*nx+(q.y-mid.y)*nz)/d>.35:facing=True;break
            if facing:edges.append((bi,a,c,nx,nz,length));lines.append(LineString([a,c]))
    tree=STRtree(lines);records=[];metadata=[];names=[];rejected=collections.Counter()
    def append(bi,a,c,nx,nz,length,t,cat,name,source):
        x=a[0]+(c[0]-a[0])*t;z=a[1]+(c[1]-a[1])*t
        if any(math.hypot(x-s[0],z-s[1])<4 for s in records):rejected['near_another_sign']+=1;return
        width=min(5.2,length-.7,2*min(t,1-t)*length-.2)
        if width<2.2:rejected['short_wall']+=1;return
        def clear(p):
            return not water.intersects(p) and not corridors.intersects(p) and all(p.intersection(obstacle_shapes[int(i)]).area<1e-7 for i in obstacle_tree.query(p))
        horizontal=sign_footprint(x,z,nx,nz,width,.16,.12)
        vertical=sign_footprint(x,z,nx,nz,.2,.95,.62)
        if not clear(horizontal):rejected['unsafe_horizontal_sign']+=1;return
        ni=0
        if name:
            if name not in names:names.append(name)
            ni=names.index(name)+1
        h=height_of(city['buildings'][bi])[0]
        records.append([round(x,3),round(z,3),round(math.atan2(nx,nz),6),CATS.index(cat),ni,h])
        metadata.append({**source,'buildingId':city['buildings'][bi]['id'],'width':round(width,3),
                         'verticalAllowed':h>=9 and clear(vertical),'appearanceSource':'procedural:Taipei-sign-atlas'})
    for poi in city.get('pois',[]):
        cat=category(poi['tags'])
        if cat is None:continue
        point=Point(poi['x'],poi['z']);choices=[]
        for i in tree.query(point.buffer(22)):
            i=int(i);bi,a,c,nx,nz,length=edges[i];t=max(.18,min(.82,lines[i].project(point)/length))
            q=lines[i].interpolate(t*length);d=q.distance(point)
            if d<=22:choices.append((0 if shapes[bi].covers(point) else 1,d,i,t))
        if not choices:rejected['poi_without_nearby_street_wall']+=1;continue
        contained,d,i,t=min(choices);bi,a,c,nx,nz,length=edges[i]
        append(bi,a,c,nx,nz,length,t,cat,poi['tags'].get('name') or poi['tags'].get('name:zh') or '',
               {'sourceId':poi['id'],'textSource':'OSM:POI' if poi['tags'].get('name') or poi['tags'].get('name:zh') else 'generic:business-category',
                'association':'contained-footprint' if not contained else 'estimate:nearest-street-wall-within-22m','distanceM':round(d,2)})
    # Existing attributed storefronts remain generic unless the building itself has a source name.
    for bi,b in enumerate(city['buildings']):
        if b['category'] not in ('retail','historic'):continue
        for f in b.get('frontages',[])[:2]:
            if f['kind']!='shop':continue
            a,c=f['a'],f['b'];nx,nz=f['normal'];length=math.dist(a,c)
            append(bi,a,c,nx,nz,length,.5,'shop',b['name'],
                   {'sourceId':b['id'],'textSource':'OSM:building-name' if b['name'] else 'generic:business-category','association':'attributed-frontage'})
    return {'signs':records,'signMeta':metadata,'signNames':names,'signCats':CATS},dict(rejected)
