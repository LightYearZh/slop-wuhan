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
 assert.ok(data.waterAreaM2>10000);assert.equal(data.landmarks.length,0);assert.equal(data.tunnels.length,0);
 assert.ok(data.buildings.every(b=>b.source==='OSM:footprint'));
 assert.ok(data.roads.every(r=>!r.bridge&&!r.tunnel&&r.layer===0));
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
