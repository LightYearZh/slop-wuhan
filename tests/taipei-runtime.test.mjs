import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {GEO} from '../js/runtime/wuhan-geodata.js';
import {BUILDINGS,ROAD_LINKS,ROAD_NODES,TELEPORT_LOCATIONS,WATER} from '../js/runtime/city-config.js';
import {circleFootprint} from '../js/runtime/collision-footprint.js';
import {roofRectangleFits,fitRoofShed} from '../js/runtime/roof-layout.js';
const city=JSON.parse(fs.readFileSync(new URL('../public/data/city.json',import.meta.url)));

test('Taipei runtime is the active entry and includes only Wuhan geography',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/src="\.\/js\/runtime\/main.js"/);assert.match(html,/lang="zh-CN"/);
 assert.equal(GEO.city,'wuhan');assert.equal(GEO.frame.lon0,114.293);
 assert.deepEqual(Object.keys(GEO.landmarks),['jianghanguan']);
 assert.ok(TELEPORT_LOCATIONS.jianghanguan);assert.equal(GEO.viaducts.length,0);
 assert.ok(!html.includes('武汉101'));assert.ok(!html.includes('信义'));
 const audit=JSON.parse(fs.readFileSync(new URL('../public/data/runtime-audit.json',import.meta.url)));
 assert.equal(audit.sourceCitySha256,createHash('sha256').update(fs.readFileSync(new URL('../public/data/city.json',import.meta.url))).digest('hex'));
});

test('source heights survive display estimates and documented tower parts remain separate',()=>{
 const source=new Map(city.buildings.map(b=>[b.id,b]));
 for(const b of BUILDINGS){
  const original=source.get(b.sourceId);assert.ok(original);
  if(original.heightSource==='visual-estimate'){
   assert.equal(b.sourceHeight,null);assert.match(b.displayHeightSource,/visual-estimate:hankou/);
  }else assert.equal(b.sourceHeight,original.h);
  assert.ok(b.h>b.base);assert.ok(b.rings.every(r=>Array.from(r).every(Number.isFinite)));
 }
 const estimates=BUILDINGS.filter(b=>b.sourceHeight===null);
 assert.ok(new Set(estimates.map(b=>b.h)).size>=10);
 const tower=BUILDINGS.filter(b=>b.sourceId.startsWith('osm-building-way-128398494-'));
 assert.equal(tower.length,3);assert.equal(Math.max(...tower.map(b=>b.h)),251);
 assert.ok(tower.some(b=>b.base>20));
});

test('runtime road graph preserves original topology and excludes cars from pedestrian streets',()=>{
 assert.equal(ROAD_LINKS.length,GEO.roadSourceIds.length);
 const sources=new Map(city.roads.map(r=>[r.id,r]));
 for(const l of ROAD_LINKS){
  const road=sources.get(GEO.roadSourceIds[l.id]);assert.ok(road);
  assert.ok(l.len>0);assert.ok(ROAD_NODES[l.a].links.includes(l.id));
  assert.ok(ROAD_NODES[l.b].links.includes(l.id));
  assert.equal(Boolean(l.flags&4),road.mode==='person');
  assert.equal(Boolean(l.oneway),Boolean(road.oneway));
 }
 for(const t of Object.values(TELEPORT_LOCATIONS))assert.equal(WATER.contains(t.x,t.z),false);
});

test('migrated collision retains open courtyards and produces finite corrective depth',()=>{
 const c={rings:[new Float32Array([0,0,10,0,10,10,0,10]),new Float32Array([3,3,3,7,7,7,7,3])]};
 assert.equal(circleFootprint(5,5,.4,c),null);
 const hit=circleFootprint(1,1,.4,c);assert.ok(hit&&hit.depth>0);
 assert.ok([hit.depth,hit.nx,hit.nz].every(Number.isFinite));
 const edge=circleFootprint(-.2,5,.4,c);assert.ok(edge&&edge.nx<0);
});

test('roof detail fits inside the real roof rather than touching its bounding-box edge',()=>{
 const rings=[[[0,0],[20,0],[20,12],[0,12]]];
 const box={cx:10,cz:6,ux:1,uz:0,hx:10,hz:6};
 assert.equal(roofRectangleFits(rings,3,6,1,0,3,2),false);
 const site=fitRoofShed(rings,box,.5,.3);assert.ok(site);
 assert.equal(roofRectangleFits(rings,site.x,site.z,1,0,site.w/2*1.04,site.d/2*1.08),true);
});

test('roof equipment rejects courtyards and concave notches even when all four corners fit',()=>{
 const courtyard=[[[0,0],[20,0],[20,20],[0,20]],[[9,9],[9,11],[11,11],[11,9]]];
 assert.equal(roofRectangleFits(courtyard,10,10,1,0,5,5),false);
 const notch=[[[0,0],[20,0],[20,20],[12,20],[12,6],[8,6],[8,20],[0,20]]];
 assert.equal(roofRectangleFits(notch,10,10,1,0,7,2),false);
});

test('real OSM signal nodes and POI signs reach the runtime with provenance',()=>{
 assert.ok(GEO.signals.length>0);assert.equal(GEO.signals.length,GEO.signalMeta.length);
 const sourceSignals=new Set(city.streetNodes.filter(n=>n.tags.highway==='traffic_signals').map(n=>'osm-node-'+n.id));
 for(const s of GEO.signalMeta)for(const p of s.sources)assert.ok(sourceSignals.has(p.sourceId));
 assert.equal(GEO.signs.length,GEO.signMeta.length);
 assert.ok(GEO.signMeta.some(m=>m.verticalAllowed));
 assert.ok(GEO.signMeta.some(m=>m.textSource==='OSM:POI'));
 assert.ok(GEO.signCats.includes('bank'));assert.ok(GEO.links.some(l=>l[8].length>4));
});
