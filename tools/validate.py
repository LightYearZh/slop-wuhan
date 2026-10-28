#!/usr/bin/env python3
"""Validate geometry, pilot boundary, IDs and important road coverage."""
import json, math, pathlib, collections
from shapely.geometry import Polygon


def validate(city):
    counts={};errors=[]
    for category in ('roads','buildings','water','parks'):
        items=city.get(category,[]);counts[category]=len(items);ids=set()
        for obj in items:
            label=f"{category}: {obj.get('id')}"
            if obj['id'] in ids:errors.append(f'{label}: duplicate ID')
            ids.add(obj['id'])
            rings=[obj['points']]+obj.get('holes',[])
            for ring in rings:
                if len(ring)<(2 if category=='roads' else 4):errors.append(f'{label}: too few points')
                for p in ring:
                    if len(p)!=2 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in p):
                        errors.append(f'{label}: non-finite coordinate');continue
                    if abs(p[0])>city['width_m']/2+1 or abs(p[1])>city['depth_m']/2+1:
                        errors.append(f'{label}: outside pilot boundary')
                if category!='roads' and ring[0]!=ring[-1]:errors.append(f'{label}: open polygon')
            if category!='roads' and not Polygon(obj['points'],obj.get('holes',[])).is_valid:
                errors.append(f'{label}: invalid polygon')
            if category=='buildings' and not (2<=obj['height']<=650):errors.append(f'{label}: invalid height')
    if not counts['roads']:errors.append('No roads')
    return counts,errors


def main():
    root=pathlib.Path(__file__).resolve().parents[1]
    p=root/'web/data/city.json'
    if not p.exists():raise SystemExit('Missing web/data/city.json (run importer first)')
    city=json.loads(p.read_text())
    counts,errors=validate(city)
    print(json.dumps(counts,ensure_ascii=False,indent=2))
    print('Height provenance:',dict(collections.Counter(x['height_source'] for x in city['buildings'])))
    for name in ('江汉路','沿江大道'):
        found=[r for r in city['roads'] if name in r['name']]
        print(f'{name}: {len(found)} road segments')
        if not found:print(f'WARNING: expected road {name} absent')
    if not city['water']:print('WARNING: no water polygons; river coverage needs investigation')
    if errors:raise SystemExit('\n'.join(errors))
    print('OK: geometry and bounds valid; geographic interpretation still requires review')

if __name__=='__main__':main()
