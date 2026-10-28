"""Source-aware building attributes. Appearance choices never become measured facts."""
import math,re,hashlib
from shapely.geometry import Point,Polygon,LineString
from shapely.affinity import scale
from shapely.strtree import STRtree

RETAINED_TAGS=('building','building:use','height','building:height','building:levels','roof:height','roof:shape','roof:colour','roof:material',
 'building:material','building:colour','historic','heritage','start_date','shop','amenity','office','tourism','name','name:zh','old_name','natural','man_made','ele')

def height_value(raw):
    if raw is None:return None
    match=re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(m|metres|meters|ft|feet|\')?\s*',str(raw).lower())
    if not match:return None
    value=float(match.group(1))*(.3048 if match.group(2) in ('ft','feet',"'") else 1)
    return round(value,2) if math.isfinite(value) and 2<=value<=650 else None

def height_from_tags(tags):
    for key in ('height','building:height'):
        value=height_value(tags.get(key))
        if value is not None:return value,'OSM:height'
    try:levels=float(tags.get('building:levels',0))
    except (ValueError,TypeError):levels=0
    if 1<=levels<=150:return round(levels*3.2,2),'OSM:levels'
    return 0,'visual-estimate'


def style_for(category,seed):
    return {'historic':1+seed%2,'religious':1,'civic':5,'retail':2 if seed%2 else 5,
            'office':0,'residential':4,'industrial':6}.get(category,[4,6,7][seed%3])


def classify(tags,pois,context):
    if tags.get('historic') not in (None,'no','false') or tags.get('heritage') not in (None,'no'):
        return 'historic','OSM:historic/heritage'
    use=tags.get('building:use') or tags.get('building','')
    evidence=[tags]+[p['tags'] for p in pois]
    if use in ('church','cathedral','mosque','temple','religious'):return 'religious','OSM:building'
    if use in ('school','hospital','public','civic','university') or any(p.get('amenity') in ('school','hospital','townhall','police','library') or p.get('tourism')=='museum' for p in evidence):
        return 'civic','OSM:building/contained-POI'
    if use in ('retail','commercial') or any(p.get('shop') or p.get('amenity') in ('bank','restaurant','cafe','fast_food','bar','cinema') for p in evidence):
        return 'retail','OSM:building/contained-POI'
    if use=='office' or any(p.get('office') for p in evidence):return 'office','OSM:building/contained-POI'
    if use in ('apartments','apartment','appartment','house','residential','dormitory'):return 'residential','OSM:building'
    if use in ('warehouse','industrial','garage','garages'):return 'industrial','OSM:building'
    if context in ('residential','commercial','retail','industrial'):
        return {'commercial':'retail','retail':'retail','residential':'residential','industrial':'industrial'}[context],'context-estimate:OSM-landuse'
    return 'unknown','unknown'


class BuildingEnricher:
    def __init__(self,raw,roads,evidence):
        self.pois=raw.get('pois',[]);self.poi_points=[Point(p['x'],p['z']) for p in self.pois]
        self.poi_tree=STRtree(self.poi_points)
        self.contexts=[];self.context_shapes=[]
        for area in raw['areas']:
            if area['kind'] not in ('residential','commercial','retail','industrial'):continue
            for rings in area['polygons']:
                self.contexts.append(area['kind']);self.context_shapes.append(Polygon(rings[0],rings[1:]))
        self.context_tree=STRtree(self.context_shapes)
        self.roads=roads;self.lines=[LineString([(p[0],p[2]) for p in r['points']]) for r in roads];self.road_tree=STRtree(self.lines)
        self.evidence={r['osmId']:r for r in evidence['records']}
        self.applied=[]

    def enrich(self,item,poly,provider):
        tags=item.get('tags',{})
        if not tags:tags={'building':item.get('use','yes')}
        pois=[self.pois[int(i)] for i in self.poi_tree.query(poly) if poly.covers(self.poi_points[int(i)])]
        context=None;best=0
        for i in self.context_tree.query(poly):
            ratio=poly.intersection(self.context_shapes[int(i)]).area/poly.area
            if ratio>best and ratio>=.5:best=ratio;context=self.contexts[int(i)]
        category,category_source=classify(tags,pois,context)
        seed=int(hashlib.sha256(item['id'].encode()).hexdigest()[:8],16)
        height=item.get('h',0);hs=item.get('heightSource','visual-estimate')
        height_details={'confidence':'source-height' if hs.endswith(':height') else 'floor-derived' if hs.endswith(':levels') or hs.endswith(':floors') else 'visual-estimate'}
        if hs.endswith(':levels') or hs.endswith(':floors'):
            height_details.update({'floorHeightEstimateM':3.2,'rawLevels':tags.get('building:levels'),'meaning':'Metric height derived from source floor count, not surveyed'})
        reference=self.evidence.get(item['id'])
        if reference and item.get('name')!=reference['expectedName']:raise ValueError('Evidence identity mismatch: '+item['id'])
        if reference:
            if reference.get('use')=='mixed-commercial-office':category,category_source='office','reference:documented-use'
            if reference.get('use')=='historic-commercial':category,category_source='historic','reference:documented-use'
            self.applied.append(reference['osmId'])
            if reference.get('totalHeightM'):
                height=reference['totalHeightM'];hs='reference:architectural-total';height_details={'confidence':'documented-total;estimated-massing','reference':reference['source'],'meaning':reference['heightMeaning']}
            elif not height and reference.get('storeys'):
                height=reference['storeys']*3.6;hs='reference:storeys-derived';height_details={'confidence':'floor-derived','reference':reference['source'],'floorHeightEstimateM':3.6,'meaning':reference['heightMeaning']}
        if not (2<=height<=650):height=12;hs='visual-estimate';height_details={'confidence':'visual-estimate','rule':'fixed-12m-placeholder'}
        result={'h':height,'heightSource':hs,'heightEvidence':height_details,'category':category,'categorySource':category_source,
                'style':style_for(category,seed),'paletteVariant':seed%3,'roofStyle':'parapet' if category in ('historic','retail','civic') else 'flat',
                'use':tags.get('building:use') or tags.get('building','unknown'),'historic':(category=='historic'),
                'startDate':tags.get('start_date'),'pois':[{'id':p['id'],'name':p['tags'].get('name',''),'shop':p['tags'].get('shop'),'amenity':p['tags'].get('amenity'),'tourism':p['tags'].get('tourism')} for p in pois]}
        result['frontages']=self.frontages(poly,category,pois)
        if reference and reference.get('massingRecipe'):
            from shapely import make_valid
            rr=poly.minimum_rotated_rectangle
            tower=make_valid(scale(rr,reference['massingRecipe']['towerScale'],reference['massingRecipe']['towerScale'],origin=poly.centroid)).intersection(poly)
            if tower.geom_type!='Polygon' or tower.area<50:raise ValueError('Invalid tower estimate: '+item['id'])
            podium_height=reference['podiumStoreys']*3.6;body_top=height*(1-reference['massingRecipe']['crownFraction'])
            crown=scale(tower,.75,.75,origin=tower.centroid)
            def rings(p):return [[[round(x,3),round(z,3)] for x,z in r.coords] for r in [p.exterior,*p.interiors]]
            result['massingParts']=[{'baseY':0,'h':podium_height,'rings':rings(poly),'style':5,'role':'podium'},
              {'baseY':podium_height,'h':body_top-podium_height,'rings':rings(tower),'style':0,'role':'tower'},
              {'baseY':body_top,'h':height-body_top,'rings':rings(crown),'style':0,'role':'crown'}]
            result['massingSource']='visual-estimate:documented-total-and-podium-storeys';result['massingReference']=reference['source']
            result['style']=0
        return result

    def frontages(self,poly,category,pois):
        # Generic shopfronts only where commerce is tagged or a street context is inferred; no invented brand names.
        if category not in ('historic','retail','civic','office'):return []
        coords=list(poly.exterior.coords);ccw=poly.exterior.is_ccw;fronts=[]
        for a,b in zip(coords,coords[1:]):
            dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz)
            if length<5:continue
            centre=Point((a[0]+b[0])/2,(a[1]+b[1])/2);nx,nz=((dz/length,-dx/length) if ccw else (-dz/length,dx/length))
            matches=[]
            for j in self.road_tree.query(centre.buffer(22)):
                j=int(j);road=self.roads[j]
                if road['highway'] in ('path','steps','service'):continue
                line=self.lines[j];q=line.interpolate(line.project(centre));distance=centre.distance(q)
                if distance<.1 or distance>road['width']/2+9:continue
                facing=((q.x-centre.x)*nx+(q.y-centre.y)*nz)/distance
                if facing>.45:matches.append((distance-road['width']/2,road))
            if not matches:continue
            _,road=min(matches,key=lambda r:r[0]);commercial=category=='retail' or any(p['tags'].get('shop') or p['tags'].get('amenity') in ('bank','restaurant','cafe','fast_food','bar') for p in pois)
            fronts.append({'a':list(a),'b':list(b),'normal':[nx,nz],'roadId':road['id'],'kind':'shop' if commercial else 'entrance','appearanceSource':'generic-estimate'})
        return fronts[:3]
