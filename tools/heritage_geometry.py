"""Display-only heritage roof meshes clipped to authoritative source footprints."""
from shapely.geometry import Polygon,Point
from shapely.ops import triangulate,nearest_points

def parts(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [g]
    return [p for k in getattr(g,'geoms',[]) for p in parts(k)]

def roof_plan(rings,detail):
    p=rings if hasattr(rings,'geom_type') else Polygon(rings[0],rings[1:]);width=detail.get('slopeWidthM',2)
    inner=p.buffer(-width,join_style=2)
    zones=[]
    for region,fraction in [(p.difference(inner),None),(inner,detail.get('slopeFraction',.62))]:
        for poly in parts(region):
            for coarse in triangulate(poly):
                for clipped in parts(coarse.intersection(poly)):
                    for tri in triangulate(clipped):
                        if not clipped.covers(tri):continue
                        vertices=[]
                        for x,z in list(tri.exterior.coords)[:3]:
                            f=fraction if fraction is not None else min(1,p.boundary.distance(Point(x,z))/width)*detail.get('slopeFraction',.62)
                            vertices.extend([round(x,4),round(f,6),round(z,4)])
                        zones.append(vertices)
    radius=detail.get('radiusM',2.3);safe=p.buffer(-radius-.12)
    if safe.is_empty:raise ValueError('No contained heritage roof pavilion')
    target=Point(detail['anchorHint']);q=nearest_points(safe,target)[0]
    return {'triangles':zones,'pavilion':{'x':round(q.x,4),'z':round(q.y,4),'radiusM':radius},
            'meaning':'Footprint-contained illustrative roof; roof heights and ornament dimensions are estimates'}
