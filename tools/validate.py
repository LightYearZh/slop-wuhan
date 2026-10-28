#!/usr/bin/env python3
import json, pathlib, collections, sys
root=pathlib.Path(__file__).resolve().parents[1]
p=root/'web/data/city.json'
if not p.exists():raise SystemExit('Missing web/data/city.json (run importer first)')
a=json.loads(p.read_text(encoding='utf-8'))
for cat in ('roads','buildings','water','parks'):
    items=a.get(cat,[])
    for obj in items:
        if len(obj['points'])<2 or any(len(pt)!=2 for pt in obj['points']):raise SystemExit(f'Bad {cat} {obj.get("id")}')
    print(f'{cat}: {len(items)}')
print('Height provenance:',dict(collections.Counter(x['height_source'] for x in a['buildings'])))
if not a['roads']:raise SystemExit('No roads; dataset not usable')
print('OK: dataset structurally valid (NOT a full geographic accuracy test)')
