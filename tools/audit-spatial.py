"""Read generated files and independently check spatial safety gates."""
import json,pathlib
from shapely.geometry import Polygon,LineString
from shapely.ops import unary_union
from shapely.strtree import STRtree
from spatial_rules import polygons_for

ROOT=pathlib.Path(__file__).resolve().parents[1]

def main():
    city=json.loads((ROOT/'public/data/city.json').read_text())
    footprints=[polygons_for(b) for b in city['buildings']]
    footprints += [Polygon(l['footprint'][0],l['footprint'][1:]) for l in city['landmarks']]
    for building,footprint in zip(city['buildings'],footprints):
        for part in building.get('massingParts',[]):
            ring=part['rings'];p=Polygon(ring[0],ring[1:])
            if not p.is_valid or p.difference(footprint.buffer(.01)).area>.01:raise SystemExit('Massing part escapes its source footprint: '+building['id'])
            if part['baseY']<0 or part['h']<=0 or part['baseY']+part['h']>building['h']+.01:raise SystemExit('Invalid vertical massing: '+building['id'])
    blockers=unary_union(footprints);tree=STRtree(footprints)
    surfaces=unary_union([Polygon(p[0],p[1:]) for name in ('asphalt','pedestrian') for p in city[name]])
    overlap=surfaces.intersection(blockers).area
    conflicts=[]
    for road in city['roads']:
        line=LineString([(p[0],p[2]) for p in road['points']])
        for i in tree.query(line):
            length=line.intersection(footprints[int(i)]).length
            if length>.01:conflicts.append({'road':road['id'],'lengthM':length})
    if overlap>1e-6 or conflicts:raise SystemExit(json.dumps({'roadBuildingOverlapM2':overlap,'centrelineConflicts':conflicts},ensure_ascii=False))
    print(json.dumps({'roads':len(city['roads']),'buildingAndLandmarkFootprints':len(footprints),
        'roadBuildingOverlapM2':round(overlap,6),'centrelineConflicts':len(conflicts),'status':'passed'},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
