"""Shared, deterministic build-time ground geometry rules.

Source geometry remains untouched. Unverified passages through buildings close
only in the generated ground-road layer, with source IDs recorded for review.
"""
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union
from shapely.strtree import STRtree


def polygons_for(building):
    rings=building.get('rings') or [building['footprint']]
    return Polygon(rings[0],rings[1:])

def ground_polygons_for(building):
    if not building.get('passageProfile'):return polygons_for(building)
    return unary_union([Polygon(p['rings'][0],p['rings'][1:]) for p in building['massingParts'] if p.get('baseY',0)<2.6])


def line_parts(geometry):
    if geometry.is_empty:return []
    if geometry.geom_type=='LineString':return [geometry]
    return [part for g in getattr(geometry,'geoms',[]) for part in line_parts(g)]


def resolve_ground_layout(roads,buildings,landmarks,region,water):
    if any(r.get('bridge') or r.get('tunnel') or r.get('layer',0)!=0 for r in roads):
        raise ValueError('Ground layout requires screened ground roads; elevated roads need a separate layer')
    blockers=[(b['id'],ground_polygons_for(b)) for b in buildings]
    blockers += [(l['id'],Polygon(l['footprint'][0],l['footprint'][1:])) for l in landmarks]
    shapes=[g for _,g in blockers];tree=STRtree(shapes)
    occupied=unary_union(shapes).buffer(.2)
    closures=[];resolved=[]
    for road in roads:
        original=LineString([(p[0],p[2]) for p in road['points']])
        hits=[int(j) for j in tree.query(original) if original.intersection(shapes[int(j)]).length>.01]
        if not hits:
            resolved.append(road);continue
        # Do not guess that an untagged crossing is a tunnel or demolish a real footprint.
        cut=original.difference(unary_union([shapes[j].buffer(.2) for j in hits]))
        closures.append({'sourceRoadId':road['id'],'roadName':road['name'],
            'buildingIds':[blockers[j][0] for j in hits],
            'closedLengthM':round(original.length-cut.length,3),
            'reason':'Unverified ground passage intersects a building; source retained for review'})
        node_map={(p[0],p[2]):n for p,n in zip(road['points'],road['nodeIds'])}
        for index,line in enumerate(line_parts(cut)):
            if line.length<.5:continue
            points=[[round(x,3),2.12,round(z,3)] for x,z in line.coords]
            resolved.append({**road,'id':road['id']+f'/clear/{index}','sourceRoadId':road['id'],
                'points':points,'nodeIds':[node_map.get((p[0],p[2]),f'closure:{p[0]},{p[2]}') for p in points],
                'closureBoundary':True})
    lines=[LineString([(p[0],p[2]) for p in r['points']]) for r in resolved]
    def surface(extra,mode=None):
        values=[line.buffer(r['width']/2+extra,quad_segs=4) for line,r in zip(lines,resolved) if mode is None or r['mode']==mode]
        raw=unary_union(values).intersection(region).difference(water)
        return raw.difference(occupied),raw
    asphalt,raw_asphalt=surface(0,'car')
    pedestrian,raw_pedestrian=surface(0,'person');pedestrian=pedestrian.difference(asphalt)
    shoulders,_=surface(2)
    # Floating-point slivers below one square millimetre are numerically insignificant.
    overlap=asphalt.union(pedestrian).intersection(unary_union(shapes)).area
    if overlap>1e-6:raise ValueError(f'Ground road/building overlap after spatial rules: {overlap}')
    centreline_hits=[]
    for r,line in zip(resolved,lines):
        for j in tree.query(line):
            length=line.intersection(shapes[int(j)]).length
            if length>.01:centreline_hits.append({'road':r['id'],'building':blockers[int(j)][0],'lengthM':round(length,3)})
    if centreline_hits:raise ValueError(f'Unresolved centreline conflicts: {centreline_hits[:5]}')
    audit={'policyVersion':1,'closedUnverifiedPassages':closures,'remainingCentrelineConflicts':0,
        'renderedRoadBuildingOverlapM2':round(overlap,6),
        'roadPaintTrimmedM2':round(raw_asphalt.union(raw_pedestrian).difference(asphalt.union(pedestrian)).area,3),
        'policy':'Preserve building footprints; close unverified ground passages; trim estimated road paint against real footprints; never edit raw sources'}
    return resolved,asphalt,pedestrian,shoulders,audit
