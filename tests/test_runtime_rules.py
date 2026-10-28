import importlib.util,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('runtime',ROOT/'tools/build-runtime.py')
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)

class RuntimeRules(unittest.TestCase):
 def building(self,**kwargs):
  return {'id':'example','category':'residential','heightSource':'visual-estimate','h':12,
          'rings':[[[0,0],[20,0],[20,20],[0,20],[0,0]]],**kwargs}
 def test_height_estimates_are_repeatable_and_cannot_override_source(self):
  b=self.building();self.assertEqual(runtime.display_height(b),runtime.display_height(b))
  self.assertEqual(runtime.display_height(self.building(h=48,heightSource='OSM:height')),(48,'OSM:height'))
  self.assertTrue(runtime.display_height(b)[1].startswith('visual-estimate:'))
 def test_polygon_conversion_keeps_courtyard_and_winding(self):
  from shapely.geometry import Polygon
  p=Polygon([(0,0),(0,10),(10,10),(10,0)],holes=[[(3,3),(7,3),(7,7),(3,7)]])
  rows=runtime.flat_polys(p);self.assertEqual(len(rows),1);self.assertEqual(len(rows[0]),2)
  rings=[list(zip(r[::2],r[1::2])) for r in rows[0]]
  q=Polygon(rings[0],rings[1:]);self.assertEqual(q.area,84);self.assertTrue(q.exterior.is_ccw)
 def test_estimate_does_not_mutate_original_source(self):
  b=self.building();before=json.dumps(b,sort_keys=True);runtime.display_height(b)
  self.assertEqual(before,json.dumps(b,sort_keys=True))

if __name__=='__main__':unittest.main()
