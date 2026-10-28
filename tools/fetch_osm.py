#!/usr/bin/env python3
"""Fetch bounded OSM data with Overpass, without guessing missing geometry."""
import argparse, pathlib, urllib.request, urllib.parse, json, datetime, time
from convert_osm import ROOT, DEFAULT_BBOX

ENDPOINTS=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.nchc.org.tw/api/interpreter']

def query(b):
    s,w,n,e=b
    bbox=f'({s},{w},{n},{e})'
    return f'''[out:json][timeout:120];(
way["highway"]{bbox};
way["building"]{bbox};
way["natural"="water"]{bbox};
way["waterway"="riverbank"]{bbox};
way["landuse"="reservoir"]{bbox};
way["leisure"="park"]{bbox};
way["landuse"~"^(grass|forest|meadow|recreation_ground)$"]{bbox};
rel["type"="multipolygon"]["natural"="water"]{bbox};
rel["type"="multipolygon"]["waterway"="riverbank"]{bbox};
rel["type"="multipolygon"]["landuse"="reservoir"]{bbox};
rel["type"="multipolygon"]["leisure"="park"]{bbox};
);out geom;'''

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--bbox',nargs=4,type=float,default=DEFAULT_BBOX,metavar=('S','W','N','E'))
    ap.add_argument('--output',type=pathlib.Path,default=ROOT/'data/wuhan_overpass.json')
    ap.add_argument('--endpoint',default=None)
    args=ap.parse_args(); q=query(args.bbox)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    (args.output.parent/'query.overpassql').write_text(q,encoding='utf-8')
    for url in ([args.endpoint] if args.endpoint else ENDPOINTS):
        print('Querying',url,flush=True)
        try:
            body=urllib.parse.urlencode({'data':q}).encode()
            request=urllib.request.Request(url,body,headers={'User-Agent':'SlopWuhanPilot/0.1 (human-operated OSM development demo)'})
            with urllib.request.urlopen(request,timeout=150) as resp:raw=resp.read()
            payload=json.loads(raw)
            if not isinstance(payload.get('elements'),list) or len(payload['elements'])<5:
                raise ValueError('Not enough OSM objects')
            args.output.write_bytes(raw)
            manifest={'source':'OpenStreetMap via Overpass API','url':url,'retrieved_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'query':q,'osm_elements':len(payload['elements']),'license':'ODbL 1.0, © OpenStreetMap contributors'}
            (args.output.parent/'source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
            print('Saved',args.output,'elements:',len(payload['elements']))
            return
        except Exception as e:
            print('Failed:',type(e).__name__,str(e)[:260],flush=True)
            time.sleep(2)
    raise SystemExit('All Overpass endpoints failed. See README for Geofabrik + Osmium fallback.')

if __name__=='__main__':main()
