import test from 'node:test';
import {ShapeUtils,Vector2} from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {GEO} from '../js/runtime/wuhan-geodata.js';
import {BUILDINGS,ROAD_LINKS,ROAD_NODES,TELEPORT_LOCATIONS,WATER,hillHeight,deckHeightAt,linkPointAt,BRIDGE_SURFACES} from '../js/runtime/city-config.js';
import {circleFootprint} from '../js/runtime/collision-footprint.js';
import {roofRectangleFits,fitRoofShed} from '../js/runtime/roof-layout.js';
const city=JSON.parse(fs.readFileSync(new URL('../public/data/city.json',import.meta.url)));

test('Taipei runtime is the active entry and includes only Wuhan geography',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/src="\.\/js\/runtime\/main.js"/);assert.match(html,/lang="zh-CN"/);
 assert.equal(GEO.city,'wuhan');assert.equal(GEO.frame.lon0,114.293);
 assert.deepEqual(Object.keys(GEO.landmarks),['jianghanguan','yellow-crane','guishan-tower','qingchuange','red-house']);
 assert.ok(TELEPORT_LOCATIONS.jianghanguan);assert.ok(GEO.links.some(l=>l[7]&2));
 assert.ok(!html.includes('武汉101'));assert.ok(!html.includes('信义'));
 const audit=JSON.parse(fs.readFileSync(new URL('../public/data/runtime-audit.json',import.meta.url)));
 assert.equal(audit.sourceCitySha256,createHash('sha256').update(fs.readFileSync(new URL('../public/data/city.json',import.meta.url))).digest('hex'));
});

test('source heights survive display estimates and documented tower parts remain separate',()=>{
 const source=new Map(city.buildings.map(b=>[b.id,b]));
 for(const b of BUILDINGS){
  const original=source.get(b.sourceId);assert.ok(original);
  if(original.heightSource==='visual-estimate'||original.heightSource.startsWith('visual-reference:')){
   assert.equal(b.sourceHeight,null);assert.match(b.displayHeightSource,/visual-estimate:hankou|visual-reference:photo-envelope|visual-reference:open-building-envelope/);
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

test('expanded core preserves metre scale, the pilot and the four mapped landmarks',()=>{
 const b=GEO.bounds;assert.ok(b.maxX-b.minX>8000&&b.maxX-b.minX<8100);assert.ok(b.maxZ-b.minZ>6000&&b.maxZ-b.minZ<6100);
 assert.equal(city.region.scale,'1:1');assert.deepEqual(city.origin,[114.293,30.585]);
 assert.equal(GEO.landmarks['yellow-crane'].source,'osm-building-way-81641900');
 assert.equal(GEO.landmarks['guishan-tower'].source,'osm-building-way-99463468');
 assert.equal(GEO.landmarks['guishan-tower'].height,221.2); // OSM's 311.4m is the conflicting absolute-altitude label.
 assert.deepEqual(new Set(GEO.districts.map(d=>d[0])),new Set(['汉口','汉阳','武昌']));
});

test('hill sampling, landmark foundations and building foundations share a single heightfield',()=>{
 assert.ok(GEO.hills.tiles.length>0);assert.match(GEO.hills.source.sha256,/^[a-f0-9]{64}$/);
 for(const id of ['yellow-crane','guishan-tower']){
  const l=GEO.landmarks[id];assert.ok(hillHeight(l.x,l.z)>15);
  assert.ok(Math.abs(hillHeight(l.x,l.z)-l.groundY)<.02);
 }
 assert.equal(hillHeight(0,0),0); // no urban building-height noise is promoted to terrain in the old pilot.
 for(const b of BUILDINGS){
  // Gate slices share one foundation so piers and vaults do not acquire different
  // heights from their individual polygon centres along a hillside.
  if(b.passageProfileId){const p=GEO.passageGates.find(p=>p.sourceId===b.passageProfileId);assert.equal(b.ground,p.groundY);assert.ok(Math.abs(b.ground-hillHeight(p.frame.x,p.frame.z))<.02);}
  else assert.equal(b.ground,hillHeight(b.cx,b.cz));
 }
});

test('remote-sensing heights preserve source identity, thresholds, age and uncertainty',()=>{
 const models=city.buildings.filter(b=>b.heightSource==='3D-GloBFP:model-estimate');assert.ok(models.length>19000);
 for(const b of models){const e=b.heightEvidence;assert.ok(e.iou>=.65&&e.areaRatio>=.7);assert.equal(e.referenceYear,2020);assert.match(e.confidence,/model-estimate/);assert.equal(b.h,e.heightM);}
 assert.ok(city.buildings.some(b=>b.heightCandidate&&b.heightSource.startsWith('OSM:')));
 assert.equal(city.heightSupplement.referenceYear,2020);assert.match(city.heightSupplement.archiveSha256,/^[a-f0-9]{64}$/);
});

test('bridge decks retain actual shared node elevations and clear the mapped water',()=>{
 const elevated=ROAD_LINKS.filter(l=>l.flags&2);assert.ok(elevated.length>0);
 for(const l of ROAD_LINKS){
  assert.ok(Math.abs(l.pts[1]-ROAD_NODES[l.a].y)<.02);
  assert.ok(Math.abs(l.pts[l.pts.length-2]-ROAD_NODES[l.b].y)<.02);
 }
 for(const l of elevated)for(let s=10;s<l.len-10;s+=20){
  const p=linkPointAt(l,s);if(!WATER.contains(p.x,p.z))continue;
  assert.ok(p.y>.6,`${l.name} deck at ${s.toFixed(0)}m must clear water`);
  assert.ok(Math.abs(deckHeightAt(p.x,p.z)-p.y)<.5);
 }
});

test('rendered terrain faces agree with contact height throughout the two hill regions',()=>{
 let maximum=0,checked=0;
 for(const key of ['ground','park','forest','carriageway','pedestrian','sidewalks'])for(const poly of GEO[key]){
  const rings=poly.map(r=>{const points=[];for(let i=0;i<r.length;i+=2)points.push(new Vector2(r[i],r[i+1]));return points;});
  const vertices=rings.flat(),triangles=ShapeUtils.triangulateShape(rings[0],rings.slice(1));
  for(const triangle of triangles){
   const p=triangle.map(i=>vertices[i]);const x=p.reduce((s,p)=>s+p.x,0)/3,z=p.reduce((s,p)=>s+p.y,0)/3;
   const drawn=p.reduce((s,p)=>s+hillHeight(p.x,p.y),0)/3;
   maximum=Math.max(maximum,Math.abs(drawn-hillHeight(x,z)));checked++;
  }
 }
 assert.ok(checked>10000);assert.ok(maximum<.01,`visible/contact surface mismatch ${maximum}m`);
});

test('all mapped paired bridge decks support lateral movement across the entire span',()=>{
 assert.ok(BRIDGE_SURFACES.surfaces.some(s=>s.name==='武汉长江大桥'));
 for(const surface of BRIDGE_SURFACES.surfaces)for(let i=1;i<surface.left.length-1;i+=3){
  const l=surface.left[i],r=surface.right[i];
  for(let t=.05;t<1;t+=.05){
   const p=l.map((v,k)=>v*(1-t)+r[k]*t),h=BRIDGE_SURFACES.heightAt(p[0],p[2]);
   assert.notEqual(h,null,`${surface.name}: station ${i}, lateral ${t}`);
   assert.ok(Math.abs(h-p[1])<.01);
   assert.ok(deckHeightAt(p[0],p[2],h+1.2)>=h-.01);
  }
 }
});


test('Wuhan skyline keeps real tower footprints, low podiums and explicit height evidence',()=>{
 const hotel=BUILDINGS.filter(b=>b.sourceId==='osm-building-way-132727666-0');
 assert.ok(hotel.some(b=>b.role==='podium'&&b.h===6.4));
 const hotelTower=hotel.find(b=>b.partSourceId==='osm-building-way-675137406');
 assert.ok(hotelTower);assert.equal(hotelTower.h,88.6);
 assert.equal(hotelTower.facadeProfile,'qingchuan-hotel');
 assert.equal(hotelTower.partHeightSource,'reference:architectural-total');
 assert.ok(hotelTower.partHeightReference);
 assert.ok(hotelTower.area<hotel.find(b=>b.role==='podium').area);
 for(const id of ['1018926851','1018926852','1018926854','1018926855','1018926856']){
  const b=BUILDINGS.find(b=>b.sourceId===`osm-building-way-${id}-0`);
  assert.ok(b);assert.equal(b.h,134.4);assert.equal(b.sourceHeightType,'reference:storeys-derived');
  assert.equal(b.facadeProfile,'riverfront-residential');
 }
 const retail=city.buildings.find(b=>b.id==='osm-building-way-1018926853-0');
 assert.ok(retail.h<40,'long retail wing must not become a residential tower');
 for(const id of ['1100564308','1100564309']){
  const b=BUILDINGS.find(b=>b.sourceId===`osm-building-way-${id}-0`);
  assert.equal(b.h,54);assert.equal(b.sourceHeight,null);assert.equal(b.facadeProfile,'riverfront-office');
 }
 assert.equal(city.buildingPartsAudit.parents_restored,33);
 assert.equal(city.buildingPartsAudit.rendered_parts,60);
});


test('Hankou skyline restores documented residential cluster without raising nearby low wings',()=>{
 const ids=['1094972949','1094972950','1094972951','1094972953','1094972954','1094972958','1094972959','1094972960','1094972961'];
 for(const id of ids){
  const b=BUILDINGS.find(b=>b.sourceId===`osm-building-way-${id}-0`);
  assert.ok(b);assert.equal(b.h,174);assert.equal(b.sourceHeightType,'reference:architectural-total');
  assert.equal(b.facadeProfile,'hankou-riverfront-residential');
 }
 for(const id of ['1094972955','1094972956'])assert.ok(city.buildings.find(b=>b.id===`osm-building-way-${id}-0`).h<30);
 const office=BUILDINGS.find(b=>b.sourceId==='osm-building-way-1013447170-0');
 assert.equal(office.h,320.7);assert.equal(office.facadeProfile,'riverfront-office');
 assert.ok(GEO.teleports.filter(p=>p.id.startsWith('building-')).every(p=>p.name));
});

test('shipping center retains corroborated 330m total but separates low podium and a narrowing crown',()=>{
 const parts=BUILDINGS.filter(b=>b.sourceId==='osm-building-relation-14117454-0');
 assert.equal(Math.max(...parts.map(b=>b.h)),330);
 const podium=parts.find(b=>b.role==='podium');assert.equal(podium.h,22.5);
 const body=parts.find(b=>b.role==='tower');assert.equal(body.h,294);assert.equal(body.base,22.5);
 assert.ok(body.area<podium.area*.8);
 const crowns=parts.filter(b=>b.role==='crown').sort((a,b)=>a.base-b.base);assert.equal(crowns.length,9);
 assert.ok(crowns.every((b,i)=>!i||b.area<crowns[i-1].area));
 for(const part of [...crowns,body]){assert.equal(part.partSourceId,'osm-way-943192870');assert.ok(part.partHeightSource.startsWith('visual-estimate:'));}
});
