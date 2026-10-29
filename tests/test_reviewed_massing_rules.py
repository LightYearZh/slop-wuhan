import sys,pathlib,unittest
from shapely.geometry import box,Polygon
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools'))
from reviewed_massing import reviewed_massing
from building_attributes import BuildingEnricher

class ReviewedMassingRules(unittest.TestCase):
 def reference(self):
  return {'osmId':'test','expectedName':'Test','totalHeightM':330,'podiumHeightM':22.5,'heightMeaning':'documented total; estimated crown',
          'source':'source-reference','massingMembers':[{'sourceId':'osm-way-member','ringsLocal':[list(box(0,0,50,100).exterior.coords)],
          'baseY':22.5,'bodyTopM':294,'crownTopM':330,'crownSteps':9,'heightMeaning':'reviewed member'}]}
 def test_tall_body_uses_member_footprint_and_crown_colliders_match_stepped_extrusions(self):
  parent=box(0,0,100,150);rows=reviewed_massing(parent,self.reference())
  self.assertEqual(len(rows),11);self.assertEqual(rows[0]['h'],22.5)
  self.assertEqual(max(p['baseY']+p['h'] for p in rows),330)
  self.assertEqual(Polygon(rows[1]['rings'][0]).area,5000)
  crowns=[p for p in rows if p['role']=='crown']
  self.assertTrue(all(Polygon(a['rings'][0]).area>Polygon(b['rings'][0]).area for a,b in zip(crowns,crowns[1:])))
  self.assertTrue(all(parent.covers(Polygon(p['rings'][0])) for p in rows))
  self.assertTrue(all(p['baseY']+p['h']<=330 for p in rows))
 def test_unrelated_member_cannot_be_assigned_to_this_building(self):
  r=self.reference();r['massingMembers'][0]['ringsLocal']=[list(box(200,0,250,100).exterior.coords)]
  with self.assertRaisesRegex(ValueError,'outside parent'):reviewed_massing(box(0,0,100,150),r)
 def test_short_axis_ridge_narrows_along_the_long_face(self):
  r=self.reference();r['massingMembers'][0]['crownRidgeAxis']='short'
  rows=reviewed_massing(box(0,0,100,150),r)
  last=Polygon(rows[-1]['rings'][0]);x0,z0,x1,z1=last.bounds
  self.assertAlmostEqual(x1-x0,50);self.assertLess(z1-z0,6)
 def test_original_source_height_and_estimated_geometry_remain_distinct(self):
  r=self.reference();tool=BuildingEnricher({'pois':[],'areas':[]},[],{'records':[r]})
  b=tool.enrich({'id':'test','name':'Test','h':330,'heightSource':'OSM:height','tags':{}},box(0,0,100,150),'OSM:footprint')
  self.assertEqual(b['heightBeforeReference'],{'h':330,'heightSource':'OSM:height'})
  self.assertEqual(b['heightSource'],'reference:architectural-total')
  self.assertTrue(b['massingSource'].startswith('visual-estimate:'))
