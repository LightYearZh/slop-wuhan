import importlib.util,json,unittest,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
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
 def road(self,identifier,points,ids):
  return {'id':identifier,'name':'test','highway':'tertiary','width':6,'lanesTag':'2','oneway':False,'mode':'car','points':[[x,0,z] for x,z in points],'nodeIds':ids}
 def test_road_bends_are_geometry_not_extra_junctions(self):
  from runtime_streets import road_graph
  r=self.road('a',[(0,0),(5,2),(10,0)],['1','2','3'])
  g=road_graph([r]);self.assertEqual(len(g['links']),1);self.assertEqual(len(g['links'][0][8]),6)
  self.assertEqual(g['nodes'][3::4],[0,0]);self.assertEqual(g['roadShapeNodeIds'],[['1','2','3']])
  r2=self.road('b',[(5,2),(5,8)],['2','4'])
  joined=road_graph([r,r2]);self.assertEqual(len(joined['links']),3)
  self.assertEqual(joined['nodeSourceIds'].count('2'),1);self.assertGreater(max(joined['nodes'][3::4]),0)
 def test_nearby_unshared_nodes_are_not_connected(self):
  from runtime_streets import road_graph
  a=self.road('a',[(0,0),(10,0)],['1','2']);b=self.road('b',[(10,.1),(20,0)],['3','4'])
  g=road_graph([a,b]);self.assertEqual(len(g['nodeSourceIds']),4)
 def test_crossings_and_signals_require_actual_source_records(self):
  from runtime_streets import road_graph,road_details
  roads=[self.road('a',[(-20,0),(0,0),(20,0)],['1','2','3']),self.road('b',[(0,0),(0,20)],['2','4'])]
  g=road_graph(roads);self.assertEqual(road_details(g,[])['signals'],[])
  source=[{'id':'2','x':0,'z':0,'tags':{'highway':'traffic_signals'}},
          {'id':'5','x':10,'z':0,'tags':{'highway':'crossing','crossing:markings':'no'}}]
  d=road_details(g,source);self.assertEqual(len(d['signals']),1);self.assertEqual(d['crossings'],[])
  self.assertEqual(d['signalMeta'][0]['sources'][0]['sourceId'],'osm-node-2')
 def test_poi_signs_keep_business_category_and_auditable_association(self):
  from runtime_signs import build_signs
  b=self.building(name='',frontages=[])
  city={'buildings':[b],'landmarks':[],'water':[],'roads':[self.road('a',[(-10,30),(30,30)],['1','2'])],
        'pois':[{'id':'osm-node-bank','x':10,'z':18,'tags':{'amenity':'bank','name':'Source Bank'}}]}
  data,_=build_signs(city,runtime.display_height)
  self.assertEqual(len(data['signs']),1);self.assertEqual(data['signCats'][data['signs'][0][3]],'bank')
  self.assertEqual(data['signMeta'][0]['association'],'contained-footprint')
  self.assertEqual(data['signNames'],['Source Bank']);self.assertTrue(data['signMeta'][0]['verticalAllowed'])

if __name__=='__main__':unittest.main()
