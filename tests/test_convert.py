import sys,unittest,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools'))
from convert_osm import projector, height, convert, DEFAULT_BBOX
class TestConvert(unittest.TestCase):
    def test_origin(self):
        s,w,n,e=DEFAULT_BBOX
        self.assertEqual(projector(DEFAULT_BBOX)((w+e)/2,(s+n)/2),[0.0,0.0])
    def test_latitude_z_south(self):
        p=projector(DEFAULT_BBOX);self.assertLess(p(114.29,30.59)[1],p(114.29,30.58)[1])
    def test_height_sources(self):
        self.assertEqual(height({'height':'18 m'}),(18.0,'osm_height'))
        self.assertEqual(height({'building:levels':'4'}),(13.0,'osm_levels'))
        self.assertEqual(height({}),(12.0,'visual_estimate'))
    def test_road_and_building(self):
        data=[('way/1',{'highway':'residential'},[[114.29,30.58],[114.291,30.58]]),
              ('way/2',{'building':'yes','height':'24'},[[114.2901,30.58],[114.2902,30.58],[114.2902,30.5801],[114.2901,30.58]])]
        city,stats=convert(data)
        self.assertEqual(stats['roads'],1);self.assertEqual(stats['buildings'],1)
        self.assertEqual(city['buildings'][0]['height'],24.0)
    def test_outside(self):
        city,stats=convert([('way/1',{'highway':'residential'},[[115,31],[115.001,31]])])
        self.assertEqual(stats['roads'],0)
if __name__=='__main__':unittest.main()

class TestRelations(unittest.TestCase):
    def test_stitch_outer(self):
        from convert_osm import join_relation_rings
        a=[[0,0],[1,0],[1,1]];b=[[0,0],[0,1],[1,1]]
        rings=join_relation_rings([a,b])
        self.assertEqual(len(rings),1)
        self.assertEqual(rings[0][0],rings[0][-1])
    def test_clip_polygon(self):
        from convert_osm import clip_polygon
        ring=[[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]]
        clipped=clip_polygon(ring,(-1,-1,1,1))
        self.assertTrue(all(-1<=x<=1 and -1<=y<=1 for x,y in clipped))
