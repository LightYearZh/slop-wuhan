"""Curated visitor destinations, separate from residential height calibration records."""
import math
from shapely.geometry import LineString,Point

def build_destinations(city,config):
    landmarks={l['id']:l for l in city['landmarks']};buildings={b['id']:b for b in city['buildings']}
    roads=[(r,LineString([(p[0],p[2]) for p in r['points']])) for r in city['roads'] if not r.get('bridge') and r.get('mode')=='car']
    result=[]
    for spec in config['destinations']:
        d={k:v for k,v in spec.items() if k not in ('landmarkId','buildingId','bridgeName','placeName')}
        if spec.get('landmarkId'):
            item=landmarks[spec['landmarkId']];arrival=item['arrival'];d.update(x=item['x'],z=item['z'],heightM=item['height'])
        elif spec.get('buildingId'):
            item=buildings[spec['buildingId']];target=Point(item['x'],item['z'])
            r,line=min(roads,key=lambda row:row[1].distance(target));distance=line.project(target);p=line.interpolate(distance)
            q=line.interpolate(min(line.length,distance+2));arrival={'x':p.x,'z':p.y,'heading':math.atan2(q.x-p.x,q.y-p.y),'road':r['name']}
            d.update(x=item['x'],z=item['z'],heightM=item['h'],buildingSourceId=item['id'])
        elif spec.get('bridgeName'):
            item=max((b for b in city['bridgeModels'] if b['name']==spec['bridgeName']),key=lambda b:LineString([(p[0],p[2]) for p in b['points']]).length)
            pts=item['points'];p=pts[len(pts)//2];q=pts[min(len(pts)-1,len(pts)//2+1)]
            arrival={'x':p[0],'z':p[2],'y':p[1]-2.12,'heading':math.atan2(q[0]-p[0],q[2]-p[2]),'road':item['name']}
            d.update(x=p[0],z=p[2],mode='car')
        else:
            item=next(p for p in city['places'] if p['name']==spec['placeName']);arrival=item.get('arrival',item);d.update(x=item['x'],z=item['z'])
        d['arrival']={k:arrival[k] for k in ('x','z','y','heading','road') if k in arrival}
        d.setdefault('mode','person');result.append(d)
    if len({p['id'] for p in result})!=len(result):raise ValueError('Duplicate core destination')
    return result
