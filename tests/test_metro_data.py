import unittest,importlib.util
from pathlib import Path
path=Path(__file__).resolve().parents[1]/'tools/metro_data.py'
class MetroDataTests(unittest.TestCase):
 def module(self):
  self.assertTrue(path.exists(),'metro data builder is missing')
  spec=importlib.util.spec_from_file_location('metro_data',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 def test_transfer_station_merges_lines_but_does_not_use_platform_stops_as_the_station_centre(self):
  m=self.module();reference=[{'line':'1','stations':[{'code':'0144','name':'人民广场'}]},{'line':'2','stations':[{'code':'0245','name':'人民广场'}]}]
  features=[{'type':'node','id':1,'lon':121.47,'lat':31.23,'tags':{'name':'人民广场','railway':'station','station':'subway'}},{'type':'node','id':2,'lon':121.48,'lat':31.24,'tags':{'name':'人民广场','railway':'stop','subway':'yes'}},{'type':'node','id':3,'lon':121.49,'lat':31.25,'tags':{'name':'人民广场（在建）','railway':'station','station':'subway'}}]
  out=m.group_stations(features,reference);self.assertEqual(len(out),1);self.assertEqual(out[0]['name'],'人民广场站');self.assertEqual(out[0]['lines'],['1','2']);self.assertAlmostEqual(out[0]['lon'],121.47);self.assertAlmostEqual(out[0]['lat'],31.23)
 def test_old_station_alias_uses_current_official_name_and_future_stations_are_excluded(self):
  m=self.module();reference=[{'line':'2','stations':[{'code':'0248','name':'浦东南路'}]},{'line':'19','stations':[{'code':'1901','name':'未来站'}]}]
  features=[{'type':'node','id':11,'lon':121.51,'lat':31.23,'tags':{'name':'东昌路','railway':'station','station':'subway'}},{'type':'node','id':12,'lon':121.52,'lat':31.24,'tags':{'name':'未来站','railway':'station','station':'subway','construction':'yes'}}]
  out=m.group_stations(features,reference);self.assertEqual(len(out),1);self.assertEqual(out[0]['name'],'浦东南路站');self.assertIn('东昌路',out[0]['aliases'])
 def test_rounded_self_intersecting_land_is_repaired_without_filling_holes(self):
  m=self.module();from shapely.ops import unary_union
  bow=[[[0,0],[10,10],[0,10],[10,0],[0,0]]];g=unary_union(m.valid_polygons([bow]));self.assertTrue(g.is_valid);self.assertAlmostEqual(g.area,50)
  square=[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[4,2],[4,4],[2,4],[2,2]]];self.assertAlmostEqual(unary_union(m.valid_polygons([square])).area,96)
 def test_real_entrance_faces_the_nearby_path_instead_of_away_from_it(self):
  m=self.module();import math
  segments=[{'a':[100,2.12,80],'dx':0,'dz':1,'length':40}]
  self.assertAlmostEqual(m.road_facing_heading({'x':90,'z':100},segments),math.pi/2)
  self.assertAlmostEqual(m.road_facing_heading({'x':110,'z':100},segments),-math.pi/2)
if __name__=='__main__':unittest.main()
