import {orderedCoreDestinations,teleportMenuDestinations} from '../js/runtime/destination-order.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {GEO} from '../js/runtime/wuhan-geodata.js';
import {TELEPORT_LOCATIONS,BOUNDS} from '../js/runtime/city-config.js';
import {buildYellowCrane} from '../js/runtime/yellow-crane.js';
import {buildRedHouse} from '../js/runtime/red-house.js';
import {buildCoreLandmarks} from '../js/runtime/core-landmarks.js';

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
test('Han River crossings gain a red arch and a steel truss above their traversable decks',()=>{
 const scene=new THREE.Scene(),{groups}=buildCoreLandmarks(scene,[],GEO.bridgeModels);
 for(const [name,minY,maxY] of [['晴川桥钢拱',40,80],['江汉桥钢桁架',15,30]]){
  const group=groups.find(g=>g.name===name);assert.ok(group,name);
  const bounds=new THREE.Box3().setFromObject(group);assert.ok(bounds.max.y>minY&&bounds.max.y<maxY,name);
  let vertices=0;group.traverse(o=>{if(o.isMesh){const p=o.geometry.getAttribute('position');vertices+=p.count;assert.ok(Array.from(p.array).every(Number.isFinite));}});
  assert.ok(vertices>1000,name);
 }
});

test('representative destinations retain landmark priority and leave historic sites available separately',()=>{
  const before=GEO.coreDestinations.map(d=>d.id);
  const ordered=orderedCoreDestinations([...GEO.coreDestinations].reverse());
  assert.deepEqual(ordered.map(d=>d.id),['yellow-crane','yangtze-bridge','jianghanguan','jianghan-road','qingchuange','guishan-tower','red-house','greenland-center','shipping-center','heartland-66']);
  assert.deepEqual(GEO.coreDestinations.map(d=>d.id),before);
  assert.ok(ordered.every(d=>!d.id.startsWith('heritage-')));
  for(const site of GEO.heritageSites)assert.ok(TELEPORT_LOCATIONS[site.id],'historic destination remains usable: '+site.name);
});

test('teleport menu prioritizes landmarks without capping places or listing bank aliases',()=>{
 const menu=teleportMenuDestinations(GEO.coreDestinations,TELEPORT_LOCATIONS);
 assert.deepEqual(menu.slice(0,3).map(d=>d.id),['yellow-crane','yangtze-bridge','jianghanguan']);
 assert.ok(menu.length>10);assert.equal(new Set(menu.map(d=>d.id)).size,menu.length);
 assert.ok(!menu.some(d=>/银行/.test(d.name)));
 for(const name of ['江汉桥','晴川桥','铁门关','江汉门','汉口隧道入口','武昌隧道入口','大巴公房子'])assert.ok(menu.some(d=>d.name===name),name);
 assert.equal(menu.filter(d=>d.name==='武汉长江大桥').length,1);
 const added=teleportMenuDestinations(GEO.coreDestinations,{...TELEPORT_LOCATIONS,'future-place':{id:'future-place',name:'新增代表地点'}});
 assert.equal(added.length,menu.length+1);
 assert.ok(added.some(d=>d.id==='future-place'));
});
