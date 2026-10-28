"""Coastline topology, with OSM's land-on-the-left direction retained."""
import math
from collections import Counter
from shapely.geometry import Point, LineString
from shapely.ops import unary_union, polygonize
from shapely.strtree import STRtree

def road_payload(road,points):
    record={k:road[k] for k in ['id','name','width','bridge','class','mode','layer','oneway','directionSource','levelSource','heightSource'] if k in road}
    record['points']=points
    record['nodeIds']=[f'{p[0]},{p[1]},{p[2]}' for p in points]
    return record

def coastal_land(boundary,coast,ground_points):
    clipped=[LineString(p).intersection(boundary) for p in coast if len(p)>1]
    faces=list(polygonize(unary_union([boundary.boundary,*clipped])))
    tree=STRtree(faces);left=Counter();right=Counter();ground=STRtree(ground_points)
    for ps in coast:
        for a,b in zip(ps,ps[1:]):
            dx=b[0]-a[0];dz=b[1]-a[1];length=math.hypot(dx,dz)
            if length<1:continue
            x=(a[0]+b[0])/2;z=(a[1]+b[1])/2
            # World z points south, so WGS84's left normal changes sign.
            for j in tree.query(Point(x+dz/length*3,z-dx/length*3),predicate='within'):left[int(j)]+=1
            for j in tree.query(Point(x-dz/length*3,z+dx/length*3),predicate='within'):right[int(j)]+=1
    land=[];audit=[]
    for i,f in enumerate(faces):
        inside=boundary.covers(f.representative_point())
        selected=inside and (left[i]>right[i] or left[i]==right[i]==0 and len(ground.query(f,predicate='contains'))>0)
        if selected:land.append(f)
        audit.append({'areaKm2':round(f.area/1e6,4),'landVotes':left[i],'waterVotes':right[i],'land':bool(selected)})
    return unary_union(land).buffer(0),audit
