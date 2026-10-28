import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from building_parts import apply_parts

def ring(x0,z0,x1,z1):return [[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]]
def parent():return {'id':'parent-0','rings':[ring(0,0,100,100)],'h':6.4,'heightSource':'OSM:levels'}
def part(**tags):return {'id':'part','name':'','polygons':[[ring(10,10,30,50)]],'tags':tags}
class BuildingPartsRules(unittest.TestCase):
 def test_real_part_shape_and_vertical_offset_replace_podium_only_representation(self):
  b=parent();r=apply_parts([b],[part(height='81',min_height='6.4')],{'records':[]})
  self.assertEqual(r['rendered_parts'],1);self.assertEqual(b['h'],81);self.assertEqual(b['massingParts'][0]['h'],6.4)
  tower=b['massingParts'][1];self.assertEqual(tower['baseY'],6.4);self.assertAlmostEqual(tower['h'],74.6);self.assertEqual(set(map(tuple,tower['rings'][0])),set(map(tuple,ring(10,10,30,50))))
 def test_documented_part_height_can_correct_mapped_floor_count_without_raising_the_whole_podium(self):
  b=parent();apply_parts([b],[part(**{'building:levels':'17'})],{'records':[{'osmId':'part','expectedName':'','totalHeightM':88.6,'source':'hotel-history','facadeProfile':'qingchuan-hotel'}]})
  self.assertEqual(b['h'],88.6);self.assertEqual(b['massingParts'][0]['h'],6.4);self.assertEqual(b['massingParts'][1]['heightSource'],'reference:architectural-total')
 def test_unmatched_and_invalid_parts_do_not_invent_new_buildings(self):
  b=parent();p=part(height='60');p['polygons']=[[ring(200,200,220,220)]]
  stats=apply_parts([b],[p,part(height='12',min_height='30'),part()],{'records':[]})
  self.assertNotIn('massingParts',b);self.assertEqual(stats['no_containing_parent'],1);self.assertEqual(stats['missing_or_invalid_height'],2)
 def test_existing_documented_massing_is_preserved(self):
  b=parent();b['massingParts']=[{'h':100}];apply_parts([b],[part(height='60')],{'records':[]});self.assertEqual(b['massingParts'],[{'h':100}])
 def test_small_source_mismatch_is_clipped_to_parent_footprint(self):
  from shapely.geometry import Polygon
  b=parent();p=part(height='60');p['polygons']=[[ring(-.2,10,20,50)]]
  apply_parts([b],[p],{'records':[]})
  tower=Polygon(b['massingParts'][1]['rings'][0])
  self.assertTrue(Polygon(b['rings'][0]).covers(tower))
