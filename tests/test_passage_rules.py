import sys,unittest,copy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from shapely.geometry import Polygon,LineString
from shapely.ops import unary_union
from building_passages import apply_passages,surface_passage
from spatial_rules import ground_polygons_for,resolve_ground_layout

def fixture(name='铁门关',source='osm-building-way-675137415',tags=None):
 ring=[[-21,-6],[21,-6],[21,6],[-21,6],[-21,-6]]
 b={'id':source+'-0','name':name,'x':0,'z':0,'rings':[ring],'h':12.8,'heightSource':'OSM:levels'}
 item={'id':source,'name':name,'tags':tags or {'historic':'city_gate'},'h':0}
 return b,{'buildings':[item]}

class PassageRules(unittest.TestCase):
 def test_three_real_openings_keep_side_walls_and_upper_arch_solids(self):
  b,raw=fixture();before=copy.deepcopy(b['rings'])
  apply_passages([b],raw,[],None,lambda h,x,z:18)
  ground=ground_polygons_for(b)
  for x in [-15.5,-4,4,14]:self.assertEqual(ground.intersection(LineString([(x,-8),(x,8)])).length,0)
  self.assertGreater(ground.intersection(LineString([(-20,-8),(-20,8)])).length,10)
  self.assertEqual(b['rings'],before);self.assertTrue(any(p['baseY']>=6.3 for p in b['massingParts']));self.assertEqual(b['passageProfile']['groundY'],18)
 def test_restored_road_is_continuous_under_opening_but_not_through_a_pier(self):
  b,raw=fixture();apply_passages([b],raw,[],None,lambda h,x,z:0)
  def road(x):return {'id':str(x),'name':'Road','points':[[x,2.12,-9],[x,2.12,9]],'nodeIds':['a','b'],'width':3,'mode':'car'}
  roads,*_,audit=resolve_ground_layout([road(0),road(-20)],[b],[],Polygon([[-50,-50],[50,-50],[50,50],[-50,50]]),Polygon())
  self.assertEqual(len([r for r in roads if r['id']=='0']),1)
  self.assertTrue(any(a['sourceRoadId']=='-20' for a in audit['closedUnverifiedPassages']))
 def test_roof_posts_avoid_the_mapped_walkway(self):
  b,raw=fixture('Canopy','osm-building-way-9',{'building':'roof'});road={'width':3,'points':[[0,2.12,-9],[0,2.12,9]]}
  apply_passages([b],raw,[road],None,lambda h,x,z:0)
  self.assertGreater(len(b['massingParts']),1);self.assertTrue(ground_polygons_for(b).intersection(LineString([(0,-9),(0,9)])).is_empty)
  self.assertGreaterEqual(b['passageProfile']['clearanceM'],3)
 def test_underground_routes_are_not_promoted_by_name_or_tunnel_tag_alone(self):
  self.assertFalse(surface_passage({'id':'another-road','tunnelTag':'building_passage'}))
  self.assertFalse(surface_passage({'id':'another-road','tunnelTag':'building_passage','layer':-1}))
  self.assertTrue(surface_passage({'id':'another-road','tunnelTag':'building_passage','layer':0}))
  self.assertTrue(surface_passage({'id':'osm-way-1055558222'}))
