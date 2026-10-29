import unittest,sys,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from core_destinations import build_destinations
spec=importlib.util.spec_from_file_location('height_scan',ROOT/'tools/audit-building-heights.py');scan=importlib.util.module_from_spec(spec);spec.loader.exec_module(scan)

class DestinationRules(unittest.TestCase):
 def test_building_destination_uses_source_position_and_a_separate_road_arrival(self):
  city={'landmarks':[],'buildings':[{'id':'tower','x':20,'z':30,'h':200}],
        'roads':[{'name':'Street','mode':'car','points':[[0,2,0],[100,2,0]]}], 'places':[]}
  out=build_destinations(city,{'destinations':[{'id':'tower','name':'Tower','buildingId':'tower'}]})[0]
  self.assertEqual((out['x'],out['z']),(20,30));self.assertEqual(out['arrival']['z'],0);self.assertEqual(out['heightM'],200)
 def test_height_flags_are_candidates_and_cannot_modify_the_source(self):
  import json
  c={'region':{'boundsWgs84':[0,0,1,1]},'buildings':[{'id':'mall','name':'Business大厦','x':0,'z':0,'h':12,'heightSource':'visual-estimate','category':'office','rings':[[[0,0],[10,0],[10,10],[0,10],[0,0]]]}]}
  before=json.dumps(c,sort_keys=True);r=scan.audit(c)
  self.assertEqual(r['scannedBuildings'],1);self.assertEqual(r['flaggedCandidates'],1)
  self.assertTrue(r['candidates'][0]['status'].startswith('待核对'));self.assertEqual(before,json.dumps(c,sort_keys=True))
