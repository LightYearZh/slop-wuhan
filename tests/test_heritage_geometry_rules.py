import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from shapely.geometry import Polygon,Point,LineString,box
from shapely.ops import unary_union
from heritage_geometry import roof_plan
from heritage_paving import split_heritage_paving

class HeritageGeometryRules(unittest.TestCase):
 def test_roofs_cover_concave_footprint_without_covering_courtyard(self):
  p=Polygon([(0,0),(40,0),(40,12),(18,12),(18,35),(0,35)],holes=[[(4,5),(10,5),(10,10),(4,10)]])
  detail={'anchorHint':[40,0],'radiusM':2.1,'slopeWidthM':2,'slopeFraction':.5}
  plan=roof_plan(p,detail);triangles=[]
  for t in plan['triangles']:
   tri=Polygon([(t[i],t[i+2]) for i in range(0,9,3)])
   self.assertLess(tri.difference(p).area,.002);triangles.append(tri)
   self.assertTrue(all(0<=t[i]<=.5 for i in [1,4,7]))
  self.assertLess(unary_union(triangles).symmetric_difference(p).area,.002)
  at=plan['pavilion'];self.assertTrue(p.buffer(.001).covers(Point(at['x'],at['z']).buffer(at['radiusM'])))
 def test_paving_partition_preserves_holes_road_crossings_and_original_area(self):
  ped=box(-8,0,8,80).difference(box(-2,20,2,26)).difference(box(-10,39,10,45))
  city={'roads':[{'id':'jianghan','name':'江汉路','mode':'person','width':16,'points':[[0,0,0],[0,0,80]]},
                 {'id':'other','name':'江汉路','mode':'car','width':16,'points':[[50,0,0],[50,0,80]]}]}
  normal,heritage,ids=split_heritage_paving(city,ped)
  self.assertEqual(ids,['jianghan']);self.assertAlmostEqual(normal.intersection(heritage).area,0)
  self.assertLess(normal.union(heritage).symmetric_difference(ped).area,1e-8)
  self.assertFalse(heritage.covers(Point(0,23)));self.assertFalse(heritage.covers(Point(0,42)))
  self.assertFalse(heritage.covers(Point(50,30)))
