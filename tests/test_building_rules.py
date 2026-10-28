import sys,pathlib,unittest
from shapely.geometry import box
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools'))
from building_attributes import height_value,height_from_tags,BuildingEnricher

class BuildingRulesTests(unittest.TestCase):
    def enrich(self,item,poly=None,pois=None,areas=None,evidence=None):
        tool=BuildingEnricher({'pois':pois or [],'areas':areas or []},[],{'records':evidence or []})
        return tool.enrich(item,poly or box(0,0,10,10),'OSM:footprint')
    def item(self,**extra):return {'id':'osm-building-way-1','name':'Test','h':0,'heightSource':'visual-estimate','tags':{'building':'yes'},**extra}
    def test_height_units_and_malformed_values_do_not_silently_change_scale(self):
        self.assertEqual(height_value('20 m'),20)
        self.assertAlmostEqual(height_value('30 ft'),9.14,places=2)
        self.assertIsNone(height_value('20;25'));self.assertIsNone(height_value('-7'))
        self.assertIsNone(height_value('1000 m'))
        self.assertEqual(height_from_tags({'height':'invalid','building:levels':'5'}),(16,'OSM:levels'))
    def test_source_height_is_preserved_and_missing_height_stays_explicit(self):
        value=self.enrich(self.item(h=31,heightSource='OSM:height'))
        self.assertEqual(value['h'],31);self.assertEqual(value['heightEvidence']['confidence'],'source-height')
        missing=self.enrich(self.item());self.assertEqual(missing['h'],12)
        self.assertEqual(missing['heightEvidence']['confidence'],'visual-estimate')
    def test_a_nearby_shop_outside_the_footprint_is_not_attached(self):
        poi={'id':'shop','x':10.5,'z':5,'tags':{'shop':'clothes'}}
        value=self.enrich(self.item(),pois=[poi]);self.assertEqual(value['pois'],[])
        self.assertEqual(value['category'],'unknown')
    def test_contained_poi_and_context_inference_have_distinct_provenance(self):
        poi={'id':'shop','x':5,'z':5,'tags':{'shop':'clothes'}}
        actual=self.enrich(self.item(),pois=[poi]);self.assertEqual(actual['category'],'retail')
        self.assertTrue(actual['categorySource'].startswith('OSM:'))
        inferred=self.enrich(self.item(),areas=[{'kind':'residential','polygons':[[list(box(-10,-10,30,30).exterior.coords)]]}])
        self.assertEqual(inferred['category'],'residential')
        self.assertEqual(inferred['categorySource'],'context-estimate:OSM-landuse')
    def test_reference_id_and_name_must_both_match(self):
        with self.assertRaisesRegex(ValueError,'identity mismatch'):
            self.enrich(self.item(),evidence=[{'osmId':'osm-building-way-1','expectedName':'Other'}])
    def test_documented_total_creates_estimated_setbacks_not_a_full_height_slab(self):
        reference={'osmId':'osm-building-way-1','expectedName':'Test','totalHeightM':200,'podiumStoreys':8,
                   'heightMeaning':'architectural-total','source':'https://example.test/source','use':'mixed-commercial-office',
                   'massingRecipe':{'towerScale':.4,'crownFraction':.06}}
        value=self.enrich(self.item(),poly=box(0,0,100,100),evidence=[reference])
        parts=value['massingParts'];self.assertEqual(value['h'],200)
        self.assertEqual(len(parts),3);self.assertAlmostEqual(max(p['baseY']+p['h'] for p in parts),200)
        from shapely.geometry import Polygon
        self.assertLess(Polygon(parts[1]['rings'][0]).area,Polygon(parts[0]['rings'][0]).area*.5)
        self.assertTrue(value['massingSource'].startswith('visual-estimate'))
        self.assertEqual(value['heightEvidence']['confidence'],'documented-total;estimated-massing')

if __name__=='__main__':unittest.main()
