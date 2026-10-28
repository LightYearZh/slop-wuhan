import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectWgs84,SurfaceProvider,pointInPolygon} from '../js/core.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/city.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../public/data/manifest.json',import.meta.url)));
test('Wuhan source, origin and pilot roads replace Shanghai geography',()=>{
 assert.deepEqual(data.origin,[114.293,30.585]);assert.deepEqual(projectWgs84(...data.origin),{x:0,z:0});
 assert.match(data.source.sha256,/^[a-f0-9]{64}$/);assert.ok(data.source.url.includes('hubei'));
 for(const name of ['江汉路','沿江大道'])assert.ok(data.roads.some(r=>r.name.includes(name)),name);
 assert.ok(data.waterAreaM2>10000);assert.equal(data.landmarks[0].id,'jianghanguan');assert.equal(data.tunnels.length,0);
 assert.ok(data.buildings.every(b=>['OSM:footprint','Overture:footprint'].includes(b.source)));
 assert.ok(data.roads.every(r=>!r.tunnel&&(r.layer===0||r.elevationMode==='bridge')));
 assert.deepEqual([...new Set(data.roads.filter(r=>r.bridge).map(r=>r.bridgeGroup))].sort(),['晴川桥','武汉长江大桥','江汉桥']);
});
test('arrival point sits on a drivable road on land and has a collision tile',()=>{
 const surface=new SurfaceProvider(data.roads,data.water);
 const p=surface.nearest(data.spawn.x,data.spawn.z,r=>r.mode==='car');assert.ok(p);assert.ok(p.distance<.1);
 assert.equal(surface.isWater(p.x,p.z),false);
 assert.ok(manifest.tiles.some(t=>p.x>=t.bounds[0]&&p.x<t.bounds[2]&&p.z>=t.bounds[1]&&p.z<t.bounds[3]));
 assert.ok(data.land.some(r=>pointInPolygon(p.x,p.z,r)));
});
test('every building is in exactly one loadable tile with matching bytes and hash',async()=>{
 const {createHash}=await import('node:crypto');const ids=[];
 for(const t of manifest.tiles){const bytes=fs.readFileSync(new URL('../public/'+t.url.slice(2),import.meta.url));assert.equal(bytes.length,t.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),t.hash);ids.push(...JSON.parse(bytes).buildings.map(b=>b.id));}
 assert.equal(ids.length,data.buildings.length);assert.equal(new Set(ids).size,ids.length);
});

test('street upgrade restores footprints, adds source buildings and keeps Jianghan route connected',()=>{
 const audit=JSON.parse(fs.readFileSync(new URL('../public/data/wuhan-audit.json',import.meta.url)));
 assert.ok(audit.buildingSources['OSM:footprint']>400);assert.ok(audit.buildingSources['Overture:footprint']>1000);
 assert.ok(audit.roadAudit.jianghanToYanjiangConnected);assert.equal(audit.roadAudit.guessedConnectors,0);
 assert.ok(data.pedestrian.length);assert.ok(data.buildings.every(b=>b.rings?.[0]?.length>=4));
 assert.ok(data.roads.some(r=>r.widthSource==='OSM:width'||r.widthSource==='OSM:lanes-derived'));
 const landmark=data.landmarks[0];assert.equal(landmark.height,45.85);assert.ok(landmark.arrival);assert.ok(landmark.footprint[0].length>4);
});

test('building classification keeps source, contextual inference and visual estimates separate',()=>{
 assert.ok(data.buildings.some(b=>b.category==='historic'));
 assert.ok(data.buildings.every(b=>b.categorySource&&b.heightEvidence));
 const tower=data.buildings.find(b=>b.id.startsWith('osm-building-way-128398494-'));
 assert.equal(tower.h,251);assert.equal(tower.heightSource,'reference:architectural-total');
 assert.ok(tower.massingSource.startsWith('visual-estimate'));assert.equal(tower.massingParts.length,3);
 assert.ok(data.buildings.some(b=>b.categorySource.startsWith('context-estimate:')));
 assert.ok(data.buildings.filter(b=>b.heightSource==='visual-estimate').every(b=>b.h===12));
});
