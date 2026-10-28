import unittest
from shapely.geometry import box, Point
from tools.citywide_geo import coastal_land

class CoastTests(unittest.TestCase):
 def test_offshore_road_does_not_turn_estuary_into_land(self):
  coast=[[(0,100),(0,0)]]
  land,audit=coastal_land(box(-100,0,100,100),coast,[Point(50,50)])
  self.assertTrue(land.covers(Point(-50,50)))
  self.assertFalse(land.covers(Point(50,50)))
  self.assertAlmostEqual(land.area,10000)
 def test_uninhabited_island_survives_without_any_road_seeds(self):
  coast=[[(0,100),(0,0)],[(20,20),(20,40),(40,40),(40,20),(20,20)]]
  land,audit=coastal_land(box(-100,0,100,100),coast,[])
  self.assertTrue(land.covers(Point(30,30)))
  self.assertFalse(land.covers(Point(60,60)))
  self.assertAlmostEqual(land.area,10400)


class SourceIntegrityTests(unittest.TestCase):
 def test_changed_administrative_boundary_is_rejected_before_pbf_parsing(self):
  import tempfile, importlib.util, json, hashlib
  from pathlib import Path
  spec=importlib.util.spec_from_file_location('citywide_import_test',Path(__file__).resolve().parents[1]/'tools/import-citywide.py')
  module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  with tempfile.TemporaryDirectory() as directory:
   source=Path(directory);payload=b'not-a-real-pbf';(source/'shanghai-20261022.osm.pbf').write_bytes(payload)
   (source/'shanghai-boundary.geojson').write_text('{"type":"Polygon","coordinates":[]}')
   (source/'source.json').write_text(json.dumps({'sha256':hashlib.sha256(payload).hexdigest(),'administrativeBoundary':{'sha256':'0'*64}}))
   module.SOURCE=source
   with self.assertRaisesRegex(AssertionError,'boundary SHA-256'):module.main()
