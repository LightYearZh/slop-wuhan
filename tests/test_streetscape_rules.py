import json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from streetscape_rules import pedestrian_road,appearance_profile
ROOT=Path(__file__).resolve().parents[1]

class StreetscapeRules(unittest.TestCase):
 def setUp(self):self.review=json.loads((ROOT/'config/jianghanguan-streetscape.json').read_text())
 def test_only_reviewed_alleys_change_and_source_tags_remain_auditable(self):
  original={'id':'osm-way-621914971','name':'','mode':'car','highway':'residential','class':'local','oneway':True,'widthTag':None}
  fixed=pedestrian_road(original,self.review)
  self.assertEqual(fixed['mode'],'person');self.assertEqual(fixed['accessReview']['original']['mode'],'car')
  self.assertTrue(original['oneway']);self.assertFalse(fixed['oneway'])
  arterial={**original,'id':'osm-way-other','name':'沿江大道'}
  self.assertIs(pedestrian_road(arterial,self.review),arterial)
 def test_appearance_is_identity_bound_and_does_not_claim_historic_status(self):
  item={'id':'osm-building-way-981847958','name':'长江航务管理局'}
  p=appearance_profile(item,self.review)
  self.assertIn('not-verified-historic-identity',p['detailConfidence'])
  self.assertNotIn('historic',p)
  with self.assertRaises(ValueError):appearance_profile({**item,'name':'other'},self.review)
