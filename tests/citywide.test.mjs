import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectWgs84,pointInPolygon,SurfaceProvider,TileLoader} from '../js/core.js';
const read=()=>JSON.parse(fs.readFileSync('public/data/city.json'));
const districts=['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','闵行区','宝山区','嘉定区','浦东新区','金山区','松江区','青浦区','奉贤区','崇明区'];

test('citywide data covers all sixteen districts with real roads and safe destinations',()=>{
 const d=read();assert.equal(d.region.id,'shanghai-citywide');assert.equal(d.districts.length,16);
 const surface=new SurfaceProvider([...d.roads,...d.tunnels],d.water),m=JSON.parse(fs.readFileSync('public/data/manifest.json'));
 for(const place of d.places){const meta=m.tiles.find(t=>t.id===Math.floor(place.x/m.tileSizeM)+'_'+Math.floor(place.z/m.tileSizeM));if(meta?.url){const tile=JSON.parse(fs.readFileSync('public/'+meta.url.replace(/^\.\//,'')));surface.setTileRoads(meta,tile.roads);surface.setTileWater(meta,tile.water);}}
 for(const name of districts){const region=d.districts.find(r=>r.name===name);assert.ok(region,'missing district '+name);const destination=d.places.find(p=>p.district===name);assert.ok(destination,'missing destination '+name);assert.ok(surface.landingCandidates(destination.x,destination.z).length,'no road at '+name);assert.ok(!surface.isWater(destination.x,destination.z),'destination is water: '+name);}
 for(const id of ['chongming','changxing','hengsha','zhujiajiao','jinshan','dishui','hongqiao'])assert.ok(d.places.find(p=>p.id===id),'missing citywide destination '+id);
 assert.ok(d.region.landAreaKm2>5000&&d.region.landAreaKm2<8000,'land area must describe Shanghai mainland and islands');
});

test('citywide stream keeps full buildings out of the bootstrap and includes terrain in independent tiles',()=>{
 const d=read(),m=JSON.parse(fs.readFileSync('public/data/manifest.json'));
 assert.equal(d.schemaVersion,3);assert.ok(d.buildings.length<15000,'bootstrap must not ship all city buildings');assert.ok(m.tiles.length>5000);
 for(const place of d.places){const ix=Math.floor(place.x/m.tileSizeM),iz=Math.floor(place.z/m.tileSizeM),meta=m.tiles.find(t=>t.id===ix+'_'+iz);assert.ok(meta,'undeclared destination tile '+place.name);const tile=JSON.parse(fs.readFileSync('public/'+meta.url.replace(/^\.\//,'')));assert.ok(tile.land.length,'no terrain for '+place.name);assert.ok(tile.roads.length,'no roads for '+place.name);assert.ok(tile.buildings.length,'no buildings for '+place.name);}
});

test('all-city water preserves Chongming and Hengsha land while the Yangtze mouth remains water',()=>{
 const d=read(),s=new SurfaceProvider([],d.water);
 for(const p of [[121.397,31.624],[121.837,31.334],[121.746,31.378],[121.05,31.11]]){const q=projectWgs84(...p);assert.equal(s.isWater(q.x,q.z),false,'land incorrectly flooded '+p);}
 const q=projectWgs84(122.30,31.35);assert.equal(s.isWater(q.x,q.z),true,'estuary must remain water');
});

test('outside-core source road directions and levels survive independent render tiles',()=>{
 const controls=JSON.parse(fs.readFileSync('data/source/citywide/road-controls.json'));
 assert.ok(controls.length>=32);assert.ok(controls.some(c=>c.oneway));
 for(const c of controls){const tile=JSON.parse(fs.readFileSync('public/data/tiles/'+c.tile+'.json'));const r=tile.roads.find(r=>r.id===c.id);assert.ok(r,c.id);assert.equal(r.oneway,c.oneway,c.id+' lost direction');assert.equal(r.layer,c.layer,c.id+' lost layer');assert.equal(!!r.bridge,c.bridge,c.id+' lost elevation');assert.equal(r.directionSource,'OSM:oneway');assert.equal(r.nodeIds.length,r.points.length);}
});
