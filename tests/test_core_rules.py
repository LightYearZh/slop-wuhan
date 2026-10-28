import json,pathlib,sys,tempfile,unittest
from shapely.geometry import box,mapping
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools'))
from core_geometry import HeightMatcher,named_crossings
from runtime_streets import road_graph

class CoreRulesTests(unittest.TestCase):
    def matcher(self,polys):
        directory=tempfile.TemporaryDirectory();self.addCleanup(directory.cleanup)
        p=pathlib.Path(directory.name)/'height.geojson'
        p.write_text(json.dumps({'source':{'license':'CC BY 4.0'},'features':[
            {'id':str(i),'geometry':mapping(g),'properties':{'height':24}} for i,g in enumerate(polys)]}))
        return HeightMatcher(p,lambda x,y,z=None:(x,y))
    def test_height_requires_matching_footprint_not_just_nearest_centroid(self):
        m=self.matcher([box(0,0,20,20)])
        result=m.match(box(.2,.2,19.8,19.8));self.assertGreater(result['iou'],.95)
        self.assertEqual(result['method'],'remote-sensing-model-estimate');self.assertEqual(result['referenceYear'],2020)
        self.assertIsNone(m.match(box(5,5,15,15)))  # same centre, incompatible podium/roof area
        self.assertIsNone(m.match(box(21,0,41,20)))
    def test_ambiguous_candidates_cannot_silently_win(self):
        m=self.matcher([box(0,0,20,20),box(.1,0,20.1,20)])
        self.assertIsNone(m.match(box(0,0,20,20)))
        self.assertEqual(m.stats['ambiguous_match'],1)
    def road(self,id,name,coords,ids,reverse=False):
        return {'id':id,'name':name,'points':[[x,2.12,z] for x,z in coords],'nodeIds':ids,'bridge':True,
                'tunnel':False,'layer':1,'mode':'car','reverse':reverse,'oneway':reverse,'highway':'primary'}
    def test_crossing_keeps_connected_bridge_approaches_and_source_direction(self):
        roads=[self.road('main','江汉桥',[(0,0),(0,200),(0,400)],['a','b','c']),
               self.road('approach','武胜路',[(0,400),(0,450),(0,500)],['c','d','e'],True)]
        out,_=named_crossings(roads,box(-100,-100,100,600),lambda r:(10,'test'),None)
        self.assertEqual(len(out),2)
        main=next(r for r in out if r['id']=='main');approach=next(r for r in out if r['id']=='approach')
        self.assertEqual(approach['nodeIds'],['e','d','c'])
        self.assertEqual(main['points'][-1][1],approach['points'][-1][1])
        self.assertGreater(main['points'][1][1],5)
        g=road_graph(out);self.assertTrue(all(l[7]&2 for l in g['links']))
        self.assertEqual(g['nodeSourceIds'].count('c'),1)
    def test_boundary_never_presents_a_severed_crossing_as_complete(self):
        road=self.road('main','武汉长江大桥',[(-300,0),(300,0)],['a','b'])
        out,_=named_crossings([road],box(-100,-100,100,100),lambda r:(10,'test'),None)
        self.assertEqual(out,[])

if __name__=='__main__':unittest.main()
