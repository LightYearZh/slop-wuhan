"""Identity-bound Hankou appearances; never infer a European facade from location alone."""
import json
from heritage_geometry import roof_plan
from pathlib import Path

def load_profiles():
    return json.loads((Path(__file__).resolve().parents[1]/'config/hankou-heritage.json').read_text())['buildings']

def apply_heritage(item, attributes, profiles, geometry=None):
    profile=next((p for p in profiles if p['osmId']==item['id']),None)
    if not profile:return attributes
    if item.get('name')!=profile['expectedName']:
        raise ValueError('Heritage identity mismatch: '+item['id'])
    result={**attributes,'heritageProfile':profile,'category':'historic','categorySource':'reference:identity-bound-heritage','historic':True,'roofStyle':'heritage'}
    if profile.get('roofDetail'):
        result['heritageProfile']={**profile,'roofPlan':roof_plan(geometry,profile['roofDetail'])}
    correction=profile.get('heightCorrection')
    if correction and (correction.get('documented') or attributes['heightSource'] in ('visual-estimate','OSM:levels')):
        result['heightBeforeHeritage']={'h':attributes['h'],'heightSource':attributes['heightSource']}
        result.update(h=correction['heightM'],heightSource='reference:architectural-total' if correction.get('documented') else 'visual-reference:photo-envelope',
            heightEvidence={'confidence':'documented-total' if correction.get('documented') else 'visual-estimate',
                'reference':correction['source'],'meaning':correction['meaning'],'rangeM':correction.get('rangeM')})
    return result

def heritage_sites(city):
    from shapely.geometry import Point,Polygon,LineString
    roads=[(r,LineString([(p[0],p[2]) for p in r['points']])) for r in city['roads'] if not r.get('bridge') and not r.get('tunnel') and r.get('layer',0)==0]
    sites=[]
    for b in city['buildings']:
        p=b.get('heritageProfile')
        if not p:continue
        center=Point(b['x'],b['z']);local=[Polygon(k['rings'][0],k['rings'][1:]) for k in city['buildings'] if abs(k['x']-b['x'])<100 and abs(k['z']-b['z'])<100]
        choices=[]
        for r,line in roads:
            if line.distance(center)>120:continue
            q=line.interpolate(line.project(center))
            if any(g.buffer(.8).covers(q) for g in local):continue
            choices.append((q.distance(center)+(0 if r['mode']=='person' else 8),q,r))
        if not choices:raise ValueError('Missing safe heritage arrival: '+p['label'])
        _,q,r=min(choices,key=lambda a:a[0])
        sites.append({'id':'heritage-'+p['osmId'],'name':p['label'],'aliases':[b['name']],'x':b['x'],'z':b['z'],'sourceId':b['id'],'source':p['source'],
            'arrival':{'x':q.x,'z':q.y,'heading':__import__('math').atan2(b['x']-q.x,b['z']-q.y),'road':r['name'],'mode':'person'}})
    return sites
