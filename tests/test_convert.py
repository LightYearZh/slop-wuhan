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

class TestTopology(unittest.TestCase):
    def test_hole_and_boundary(self):
        from shapely.geometry import Polygon
        bbox=(0,0,.02,.02)
        outer=[[-.01,-.01],[.03,-.01],[.03,.03],[-.01,.03],[-.01,-.01]]
        inner=[[.005,.005],[.015,.005],[.015,.015],[.005,.015],[.005,.005]]
        city,_=convert([('relation/1',{'natural':'water'},outer,[inner])],bbox)
        self.assertEqual(len(city['water']),1)
        self.assertEqual(len(city['water'][0]['holes']),1)
        self.assertTrue(Polygon(city['water'][0]['points'],city['water'][0]['holes']).is_valid)

    def test_hole_crosses_clip_edge(self):
        from shapely.geometry import Polygon
        outer=[[-1,-1],[2,-1],[2,2],[-1,2],[-1,-1]]
        hole=[[.5,.5],[1.5,.5],[1.5,.8],[.5,.8],[.5,.5]]
        from convert_osm import area_parts
        pieces=list(area_parts(outer,[hole],(0,0,1,1)))
        self.assertAlmostEqual(sum(Polygon(p['points'],p['holes']).area for p in pieces),.85)
        self.assertTrue(all(Polygon(p['points'],p['holes']).is_valid for p in pieces))

    def test_road_reentry_does_not_add_shortcut(self):
        city,_=convert([('way/1',{'highway':'residential'},[[.005,.005],[.03,.005],[.03,.015],[.005,.015]])],(0,0,.02,.02))
        self.assertEqual(len(city['roads']),2)
        self.assertEqual(len({r['id'] for r in city['roads']}),2)

    def test_json_xml_relation_parity(self):
        import tempfile,json
        from convert_osm import parse_xml,parse_overpass
        coords=[[.001,.001],[.019,.001],[.019,.019],[.001,.019],[.001,.001]]
        with tempfile.TemporaryDirectory() as directory:
            path=pathlib.Path(directory)
            obj={'elements':[{'type':'way','id':1,'tags':{'natural':'water'},'geometry':[{'lon':x,'lat':y} for x,y in coords]},
                {'type':'relation','id':2,'tags':{'type':'multipolygon','natural':'water'},'members':[{'type':'way','ref':1,'role':'outer','geometry':[{'lon':x,'lat':y} for x,y in coords]}]}]}
            (path/'a.json').write_text(json.dumps(obj))
            nodes=''.join(f'<node id="{i}" lon="{x}" lat="{y}"/>' for i,(x,y) in enumerate(coords[:-1]))
            (path/'a.osm').write_text('<osm>'+nodes+'<way id="1">'+''.join(f'<nd ref="{i}"/>' for i in [0,1,2,3,0])+'<tag k="natural" v="water"/></way><relation id="2"><member type="way" ref="1" role="outer"/><tag k="type" v="multipolygon"/><tag k="natural" v="water"/></relation></osm>')
            a,_=convert(parse_overpass(path/'a.json'),(0,0,.02,.02))
            b,_=convert(parse_xml(path/'a.osm'),(0,0,.02,.02))
            self.assertEqual(a,b)
            self.assertEqual(len(a['water']),1)

    def test_incomplete_relation_warning(self):
        from convert_osm import relation_features
        warnings=[]
        result=list(relation_features('relation/1',{},[('outer',[[0,0],[1,0]])],warnings))
        self.assertEqual(result,[])
        self.assertTrue(warnings)
