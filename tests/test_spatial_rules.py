import pathlib,sys,unittest
from shapely.geometry import box,Polygon,LineString
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools'))
from spatial_rules import resolve_ground_layout

class SpatialRulesTests(unittest.TestCase):
    def road(self,z=0,width=6):
        return {'id':'source-road','name':'测试路','width':width,'mode':'car',
                'points':[[-20,2.12,z],[20,2.12,z]],'nodeIds':['a','b']}
    def building(self,poly):return {'id':'source-building','rings':[list(poly.exterior.coords)]}
    def test_unverified_passage_is_closed_without_destroying_the_source_building(self):
        building=self.building(box(-3,-3,3,3));road=self.road();original=list(road['points'])
        roads,asphalt,pedestrian,shoulders,audit=resolve_ground_layout([road],[building],[],box(-50,-50,50,50),Polygon())
        self.assertEqual(len(roads),2)
        self.assertEqual(road['points'],original)
        self.assertEqual(audit['closedUnverifiedPassages'][0]['buildingIds'],['source-building'])
        self.assertEqual(audit['remainingCentrelineConflicts'],0)
        self.assertLess(asphalt.intersection(box(-3,-3,3,3)).area,1e-6)
        self.assertEqual(roads[0]['nodeIds'][0],'a');self.assertEqual(roads[1]['nodeIds'][-1],'b')
    def test_estimated_road_width_trims_paint_without_deleting_a_building(self):
        poly=box(-4,3,4,9);building=self.building(poly)
        roads,asphalt,_,_,audit=resolve_ground_layout([self.road(width=10)],[building],[],box(-50,-50,50,50),Polygon())
        self.assertEqual(len(roads),1)
        self.assertEqual(audit['closedUnverifiedPassages'],[])
        self.assertGreater(audit['roadPaintTrimmedM2'],10)
        self.assertLess(asphalt.intersection(poly).area,1e-6)
    def test_tagged_upper_and_lower_roads_are_not_silently_flattened(self):
        for tag in ('bridge','tunnel'):
            road={**self.road(),tag:True}
            with self.assertRaisesRegex(ValueError,'screened ground roads'):
                resolve_ground_layout([road],[],[],box(-50,-50,50,50),Polygon())
    def test_courtyard_lane_remains_open(self):
        poly=box(-10,-10,10,10);hole=list(box(-8,-3,8,3).exterior.coords)
        building={'id':'courtyard','rings':[list(poly.exterior.coords),hole]}
        road={**self.road(),'points':[[-7,2.12,0],[7,2.12,0]]}
        roads,_,_,_,audit=resolve_ground_layout([road],[building],[],box(-50,-50,50,50),Polygon())
        self.assertEqual(len(roads),1);self.assertEqual(audit['closedUnverifiedPassages'],[])

if __name__=='__main__':unittest.main()
