import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {GEO} from '../js/runtime/wuhan-geodata.js';
import {TELEPORT_LOCATIONS,BOUNDS} from '../js/runtime/city-config.js';
import {buildYellowCrane} from '../js/runtime/yellow-crane.js';
import {buildRedHouse} from '../js/runtime/red-house.js';

test('ten curated places cover the three towns and keep residential calibration targets out',()=>{
 assert.equal(GEO.coreDestinations.length,10);
 assert.equal(new Set(GEO.coreDestinations.map(d=>d.id)).size,10);
 for(const id of ['jianghanguan','yellow-crane','guishan-tower','yangtze-bridge','greenland-center','red-house'])assert.ok(GEO.coreDestinations.some(d=>d.id===id));
 assert.ok(!GEO.coreDestinations.some(d=>/住宅|世纪江尚|公馆/.test(d.name)));
 for(const d of GEO.coreDestinations){
  assert.ok(d.source&&d.summary&&d.category);assert.ok(TELEPORT_LOCATIONS[d.id]);
  assert.ok(d.arrival.x>BOUNDS.minX&&d.arrival.x<BOUNDS.maxX);assert.ok(d.arrival.z>BOUNDS.minZ&&d.arrival.z<BOUNDS.maxZ);
  assert.ok(Number.isFinite(d.arrival.y??0));
 }
 assert.equal(TELEPORT_LOCATIONS['yangtze-bridge'].mode,'car');
 assert.ok(TELEPORT_LOCATIONS['yangtze-bridge'].y>10);
});

test('Yellow Crane model has curved projecting roof massing, finite geometry and the documented 51.4m total',()=>{
 const root=buildYellowCrane(new THREE.Group()),bounds=new THREE.Box3().setFromObject(root);
 assert.ok(Math.abs(bounds.max.y-51.4)<.001);assert.equal(bounds.min.y,0);
 assert.ok(bounds.max.x-bounds.min.x>34&&bounds.max.x-bounds.min.x<36);
 assert.equal(root.userData.modelReference.visibleFloors,5);
 let vertices=0;root.traverse(o=>{if(o.isMesh){const p=o.geometry.getAttribute('position');vertices+=p.count;assert.ok(Array.from(p.array).every(Number.isFinite));assert.ok(Array.from(o.geometry.getAttribute('normal').array).every(Number.isFinite));}});
 assert.ok(vertices>20000&&vertices<250000);
});

test('Red House uses the mapped concave footprint and an explicitly estimated 18m exterior',()=>{
 const l=GEO.landmarks['red-house'];assert.equal(l.source,'osm-building-way-1136234332');assert.ok(l.heightSource.startsWith('visual-estimate:'));
 const root=buildRedHouse(new THREE.Group(),l),b=new THREE.Box3().setFromObject(root);
 assert.ok(Math.abs(b.max.y-18)<.01);assert.ok(b.max.x-b.min.x<80);assert.ok(b.max.z-b.min.z<45);
});
