"""Two source-connected Wuhan Yangtze Tunnel bores; Shanghai-style estimated grade.

Horizontal route and direction are OSM. Depth, clearance and width are declared
display estimates; layer=-1 is NOT interpreted as a measured depth.
"""
import math
from shapely.geometry import LineString,Point
from shapely.ops import unary_union

CHAINS=[('hankou-to-wuchang',['osm-way-264411350','osm-way-104683962']),
        ('wuchang-to-hankou',['osm-way-426933533','osm-way-426933532'])]

def build_tunnels(raw,region,water):
    by_id={r['id']:r for r in raw['roads']};routes=[];cuts=[]
    for direction,ids in CHAINS:
        rows=[by_id[i] for i in ids];coordinates=[];node_ids=[]
        for r in rows:
            if not r['tunnel'] or not r['oneway'] or r['reverse']:raise ValueError('Inspect changed tunnel source direction: '+r['id'])
            if node_ids and node_ids[-1]!=r['nodeIds'][0]:raise ValueError('Tunnel source chain disconnected')
            coordinates+=r['points'][1:] if coordinates else r['points'];node_ids+=r['nodeIds'][1:] if node_ids else r['nodeIds']
        line=LineString([(p[0],p[2]) for p in coordinates]);length=line.length
        if not region.covers(line):raise ValueError('Do not clip a river crossing or relocate its portals')
        wet=line.intersection(water)
        if wet.is_empty:raise ValueError('Expected a real river crossing')
        wet_parts=[wet] if wet.geom_type=='LineString' else list(wet.geoms)
        stations=[line.project(Point(p)) for part in wet_parts if part.geom_type=='LineString' for p in part.coords]
        down=max(400,min(900,min(stations)-80));up=max(400,min(900,length-max(stations)-80))
        if down+up>=length:raise ValueError('Insufficient length for continuous portal ramps')
        points=[];distances=sorted(set([0,length]+[min(length,s) for s in range(0,math.ceil(length),6)]+[line.project(Point(p[0],p[2])) for p in coordinates]))
        def height(s):
            u=max(0,min(1,s/down,(length-s)/up));return 2.12-28*(u*u*(3-2*u))
        for s in distances:
            p=line.interpolate(s);points.append([round(p.x,3),round(height(s),3),round(p.y,3)])
        identifier='wuhan-yangtze-'+direction
        route={'id':identifier,'name':'武汉长江隧道','direction':direction,'sourceIds':ids,'sourceNodeIds':node_ids,
               'sourceCoordinates':[[p[0],p[2]] for p in coordinates],'points':points,'width':8,'clearance':5.8,
               'widthSource':'visual-estimate:two-lane-8m-bore','heightSource':'visual-estimate:Shanghai-style-smooth-28m-profile',
               'heightMeaning':'Relative to the display street datum, not surveyed tunnel elevations','length':round(length,3),
               'tunnel':True,'oneway':True,'layer':-1,'mode':'car','depthEstimateM':28,'rampLengthsM':[round(down,3),round(up,3)],
               'portalConnections':[{'nodeId':node_ids[0],'roads':[r['id'] for r in raw['roads'] if not r['tunnel'] and node_ids[0] in r['nodeIds']]},
                                    {'nodeId':node_ids[-1],'roads':[r['id'] for r in raw['roads'] if not r['tunnel'] and node_ids[-1] in r['nodeIds']]}]}
        if not all(p['roads'] for p in route['portalConnections']):raise ValueError('Tunnel portal must join a real surface road')
        routes.append(route)
    # The source bores approach within ~6 m at the portals. A fixed 8 m
    # display width would overlap their walls; narrow only the estimated width,
    # never move the source centreline or its shared surface-road nodes.
    lines=[LineString([(p[0],p[2]) for p in r['points']]) for r in routes]
    for i,r in enumerate(routes):
        r['widths']=[round(min(r['width'],max(4.8,min(line.distance(Point(p[0],p[2])) for j,line in enumerate(lines) if j!=i)-.6)),3) for p in r['points']]
        r['widthSource']='visual-estimate:up-to-8m-constrained-by-source-bore-spacing'
        for k,(a,b) in enumerate(zip(r['points'],r['points'][1:])):
            if max(a[1],b[1])-2.12> -6.4:
                cuts.append(LineString([(a[0],a[2]),(b[0],b[2])]).buffer(max(r['widths'][k:k+2])/2+.2,cap_style='flat',join_style='mitre'))
    return routes,unary_union(cuts)
