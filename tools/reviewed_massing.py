"""Reviewed relation-member massing; source geometry and visual recipes stay distinct."""
import math
from shapely import make_valid
from shapely.geometry import Polygon

def polygon_parts(g):
    if g.geom_type=='Polygon':return [g] if g.area>=1 else []
    return [p for child in getattr(g,'geoms',[]) for p in polygon_parts(child)]

def rings(p):
    return [[[round(x,3),round(z,3)] for x,z in r.coords] for r in [p.exterior,*p.interiors]]

def reviewed_massing(footprint,reference):
    podium=reference['podiumHeightM'];total=reference['totalHeightM']
    if not 0<podium<total<=650:raise ValueError('Invalid reviewed podium height')
    rows=[{'baseY':0,'h':podium,'rings':rings(footprint),'role':'podium','heightSource':'visual-estimate:documented-podium-storeys'}]
    for member in reference['massingMembers']:
        source=make_valid(Polygon(member['ringsLocal'][0],member['ringsLocal'][1:]))
        if source.difference(footprint.buffer(.02)).area>1:raise ValueError('Reviewed member outside parent: '+member['sourceId'])
        body=member['bodyTopM'];top=member['crownTopM'];base=member['baseY'];steps=member['crownSteps']
        if not 0<=base<body<top<=total or not 1<=steps<=32:raise ValueError('Invalid reviewed crown recipe')
        for p in polygon_parts(source.intersection(footprint)):
            common={'sourceId':member['sourceId'],'heightSource':'visual-estimate:documented-total-reviewed-member',
                    'heightReference':reference['source'],'heightNote':member['heightMeaning']}
            rows.append({'baseY':base,'h':body-base,'rings':rings(p),'role':'tower',**common})
            # A stepped gable approximates the photographed shipping tower crown.
            # It uses ordinary extrusions, so rendered and collision shapes agree.
            q=list(p.minimum_rotated_rectangle.exterior.coords)
            choose=min if member.get('crownRidgeAxis')=='short' else max
            a,b=choose(zip(q,q[1:]),key=lambda pair:math.dist(*pair))
            length=math.dist(a,b);ux,uz=(b[0]-a[0])/length,(b[1]-a[1])/length
            along=[x*ux+z*uz for x,z in p.exterior.coords];across=[-x*uz+z*ux for x,z in p.exterior.coords]
            lo,hi=min(along)-1,max(along)+1;mid=(min(across)+max(across))/2;half=(max(across)-min(across))/2
            for i in range(steps):
                width=half*(1-(i+.5)/steps)
                strip=Polygon([(u*ux-v*uz,u*uz+v*ux) for u,v in [(lo,mid-width),(hi,mid-width),(hi,mid+width),(lo,mid+width)]])
                for piece in polygon_parts(p.intersection(strip)):
                    rows.append({'baseY':body+(top-body)*i/steps,'h':(top-body)/steps,
                                 'rings':rings(piece),'role':'crown',**common})
    return rows
