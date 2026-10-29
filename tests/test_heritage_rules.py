import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from heritage_profiles import apply_heritage,heritage_sites

class HeritageRules(unittest.TestCase):
 def setUp(self):
  self.p={'osmId':'osm-building-way-1','expectedName':'Old bank','template':'taiwan-bank','label':'Bank','source':'reference','heightCorrection':{'heightM':23,'source':'photo','meaning':'estimate'}}
  self.a={'h':12,'heightSource':'visual-estimate','heightEvidence':{},'category':'historic'}
 def test_identity_and_source_height_are_not_guessed_from_nearby_location(self):
  self.assertIs(apply_heritage({'id':'other','name':'Old bank'},self.a,[self.p]),self.a)
  with self.assertRaises(ValueError):apply_heritage({'id':self.p['osmId'],'name':'New office'},self.a,[self.p])
  a=apply_heritage({'id':self.p['osmId'],'name':'Old bank'},{**self.a,'h':26,'heightSource':'OSM:height'},[self.p])
  self.assertEqual(a['h'],26)
 def test_photo_estimate_keeps_original_and_is_never_labeled_measured(self):
  a=apply_heritage({'id':self.p['osmId'],'name':'Old bank'},self.a,[self.p])
  self.assertEqual(a['h'],23);self.assertEqual(a['heightSource'],'visual-reference:photo-envelope');self.assertEqual(a['heightBeforeHeritage']['h'],12)
 def test_street_arrival_avoids_footprint_even_when_nearest_road_intersects_it(self):
  c={'buildings':[{'id':'b','name':'Old bank','x':10,'z':10,'rings':[[[5,5],[15,5],[15,15],[5,15],[5,5]]],'heritageProfile':self.p}],
     'roads':[{'name':'bad','mode':'person','points':[[0,0,10],[20,0,10]]},{'name':'good','mode':'person','points':[[0,0,0],[20,0,0]]}]}
  s=heritage_sites(c)[0];self.assertEqual(s['arrival']['road'],'good');self.assertEqual(s['arrival']['z'],0)
