"""Partition existing walkable paving; never extend it across roads, water or buildings."""
from shapely.geometry import LineString
from shapely.ops import unary_union

def split_heritage_paving(city,pedestrian):
    roads=[r for r in city['roads'] if r['name'] in ('江汉路','江汉路步行街') and r['mode']=='person' and not r.get('bridge') and not r.get('tunnel')]
    if not roads:return pedestrian,pedestrian.difference(pedestrian),[]
    corridor=unary_union([LineString([(p[0],p[2]) for p in r['points']]).buffer(r['width']/2+.2,cap_style=2,join_style=2) for r in roads])
    focus=pedestrian.intersection(corridor)
    return pedestrian.difference(focus),focus,[r['id'] for r in roads]
