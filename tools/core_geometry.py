"""Conservative multi-source matching, hill relief and named river crossings.

All horizontal coordinates stay in the fixed WGS84-derived metre frame.
Height estimates and bridge engineering approximations remain explicitly attributed.
"""
import base64,collections,json,math
import numpy as np
from shapely import make_valid
from shapely.geometry import Polygon,Point,LineString,shape
from shapely.ops import transform
from shapely.strtree import STRtree

class HeightMatcher:
    def __init__(self,path,project):
        data=json.loads(path.read_text());self.source=data['source'];self.rows=data['features']
        self.shapes=[make_valid(transform(project,shape(f['geometry']))) for f in self.rows]
        self.tree=STRtree(self.shapes);self.stats=collections.Counter();self.samples=[]
    def match(self,poly):
        candidates=[]
        for j in self.tree.query(poly):
            j=int(j);g=self.shapes[j];overlap=poly.intersection(g).area
            if not overlap:continue
            iou=overlap/(poly.area+g.area-overlap);ratio=min(poly.area,g.area)/max(poly.area,g.area)
            distance=poly.centroid.distance(g.centroid)
            if iou>=.65 and ratio>=.7 and distance<=min(12,math.sqrt(poly.area)*.25):
                candidates.append((iou,j,ratio,distance))
        if not candidates:self.stats['no_conservative_match']+=1;return None
        candidates.sort(reverse=True)
        if len(candidates)>1 and candidates[0][0]-candidates[1][0]<.15:
            self.stats['ambiguous_match']+=1;return None
        iou,j,ratio,distance=candidates[0];row=self.rows[j]
        self.stats['matched']+=1
        return {'heightM':row['properties']['height'],'candidateId':row['id'],'provider':'3D-GloBFP',
                'referenceYear':2020,'method':'remote-sensing-model-estimate','license':'CC BY 4.0',
                'iou':round(iou,4),'areaRatio':round(ratio,4),'centroidDistanceM':round(distance,3)}

def hill_grid(path,water):
    if not path.exists():return None
    source=json.loads(path.read_text());nx=source['nx'];nz=source['nz'];res=source['res']
    a=np.array(source['values']).reshape(nz,nx)
    # 3x3 median suppresses isolated canopy / urban returns; these are not surveyed heights.
    padded=np.pad(a,1,mode='edge');smoothed=np.median(np.stack([padded[j:j+nz,i:i+nx] for j in range(3) for i in range(3)]),axis=0)
    # Explicit visual masks isolate the two actual ridges; raw DEM outside remains available for future integration.
    masks=[{'id':'guishan','x':-1420,'z':3090,'rx':1050,'rz':390},
           {'id':'sheshan','x':1100,'z':4225,'rx':1200,'rz':300}]
    values=np.zeros((nz,nx),dtype=np.uint8)
    for j in range(nz):
        z=source['z0']+j*res
        for i in range(nx):
            x=source['x0']+i*res
            weight=max(max(0,min(1,(1-math.sqrt(((x-m['x'])/m['rx'])**2+((z-m['z'])/m['rz'])**2))/.22)) for m in masks)
            if weight<=0 or water.covers(Point(x,z)):continue
            values[j,i]=round(max(0,min(180,smoothed[j,i]-24))*weight)
    tiles=[];size=16
    for j in range(math.ceil(nz/size)):
        for i in range(math.ceil(nx/size)):
            # Include adjacent samples: mesh tiles sharing a nonzero border must both exist.
            if not values[max(0,j*size-1):min(nz,(j+1)*size+1),max(0,i*size-1):min(nx,(i+1)*size+1)].any():continue
            tile=np.zeros((size,size),dtype=np.uint8);v=values[j*size:(j+1)*size,i*size:(i+1)*size];tile[:v.shape[0],:v.shape[1]]=v
            tiles.append([i,j,base64.b64encode(tile.tobytes()).decode()])
    return {k:source[k] for k in ('nx','nz','x0','z0','res')}|{'tile':size,'tiles':tiles,
        'source':source['source'],'processing':{'datumOffsetM':24,'datumMeaning':'display datum estimate near lowland streets; not an absolute height calibration',
            'filter':'3x3 median','masks':masks,'maskMethod':'declared visual ridge envelopes with feathered edges, not surveyed hill boundaries','outsideMask':'flat lowland pending terrain/road integration'}}

def sample_hill(h,x,z):
    if not h:return 0
    # Reconstruct once, then use the exact same bilinear grid as the runtime.
    if '_values' not in h:
        a=np.zeros((h['nz'],h['nx']),dtype=np.uint8)
        for ti,tj,encoded in h['tiles']:
            v=np.frombuffer(base64.b64decode(encoded),dtype=np.uint8).reshape(h['tile'],h['tile'])
            j=tj*h['tile'];i=ti*h['tile'];hh=min(h['tile'],h['nz']-j);ww=min(h['tile'],h['nx']-i);a[j:j+hh,i:i+ww]=v[:hh,:ww]
        h['_values']=a
    fx=(x-h['x0'])/h['res'];fz=(z-h['z0'])/h['res'];i=math.floor(fx);j=math.floor(fz)
    if i<0 or j<0 or i>=h['nx']-1 or j>=h['nz']-1:return 0
    tx=fx-i;tz=fz-j;a=h['_values']
    return float((a[j,i]*(1-tx)+a[j,i+1]*tx)*(1-tz)+(a[j+1,i]*(1-tx)+a[j+1,i+1]*tx)*tz)

def landmark_from_building(item,kind,identifier,height,hills,source):
    # Use the largest mapped part; do not substitute a geocoded label for an existing footprint.
    p=max((Polygon(r[0],r[1:]) for r in item['polygons']),key=lambda p:p.area)
    rr=p.minimum_rotated_rectangle;q=list(rr.exterior.coords)
    return {'id':identifier,'name':item['name'],'type':kind,'x':rr.centroid.x,'z':rr.centroid.y,
        'groundY':round(sample_hill(hills,rr.centroid.x,rr.centroid.y),2),'height':height,
        'w':math.dist(q[0],q[1]),'d':math.dist(q[1],q[2]),'ry':-math.atan2(q[1][1]-q[0][1],q[1][0]-q[0][0]),
        'footprint':[[list(p) for p in ring.coords] for ring in [p.exterior,*p.interiors]],'source':item['id'],
        'heightSource':source,'modelSource':'procedural simplified silhouette; decorative dimensions estimated','district':'汉阳' if kind in ('tv-tower','qingchuange') else '武昌'}

def named_crossings(raw_roads,region,road_width,hills):
    names={'武汉长江大桥':32,'晴川桥':9,'江汉桥':9}
    output=[];models=[];selected={};adj=collections.defaultdict(list)
    eligible=[r for r in raw_roads if r['bridge'] and not r['tunnel']]
    for r in eligible:
        for n in r['nodeIds']:adj[n].append(r)
    queue=[]
    for r in eligible:
        if r['name'] in names:selected[r['id']]=(r,r['name']);queue.append(r['id'])
    while queue:
        r,group=selected[queue.pop()]
        for n in [r['nodeIds'][0],r['nodeIds'][-1]]:
            for other in adj[n]:
                if other['id'] not in selected:selected[other['id']]=(other,group);queue.append(other['id'])
    counts=collections.Counter(n for r,_ in selected.values() for n in r['nodeIds'])
    for r,group in selected.values():
        line=LineString([(p[0],p[2]) for p in r['points']])
        if not region.covers(line):continue  # Never ship a severed named crossing as complete.
        coords=list(line.coords);length=line.length;travelled=0;points=[]
        start=sample_hill(hills,*coords[0]);end=sample_hill(hills,*coords[-1]);deck=max(names[group],start,end)
        if counts[r['nodeIds'][0]]>1:start=deck
        if counts[r['nodeIds'][-1]]>1:end=deck
        # Han bridges use short, declared display ramps inside the mapped bridge span.
        # Yangtze bridge abutments are naturally on the two ridges, so tie deck ends to the terrain.
        for i,(x,z) in enumerate(coords):
            if i:travelled+=math.dist(coords[i-1],coords[i])
            blend=min(1,travelled/150,(length-travelled)/150)
            base=start+(end-start)*travelled/length
            y=base+(deck-base)*max(0,blend)
            if counts[r['nodeIds'][i]]>1:y=deck
            points.append([x,round(y+2.12,3),z])
        width,ws=road_width(r)
        record={**r,'points':points,'width':width,'widthSource':ws,'elevationMode':'bridge',
            'heightSource':'visual-estimate:terrain-tied-deck-and-150m-ramps','deckHeightEstimateM':round(deck,2),'bridgeGroup':group}
        if r['reverse']:record['points']=list(reversed(points));record['nodeIds']=list(reversed(r['nodeIds']))
        output.append(record)
        if r['mode']=='car':models.append({'name':r['name'],'sourceId':r['id'],'points':record['points'],'width':width,
            'heightSource':record['heightSource'],'deckHeightEstimateM':record['deckHeightEstimateM']})
    return output,models
