import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {GEO} from '../js/runtime/wuhan-geodata.js';
import {BUILDINGS,TELEPORT_LOCATIONS,TAIPEI_LANDMARKS} from '../js/runtime/city-config.js';
import {buildHeritageBuilding,facadeEdges,recessRing} from '../js/runtime/hankou-heritage.js';

test('reviewed heritage identities survive source conversion and have separate street arrivals',()=>{
  const buildings=BUILDINGS.filter(b=>b.heritageProfile);
  assert.equal(buildings.length,12);assert.equal(GEO.heritageSites.length,12);
  assert.equal(new Set(buildings.map(b=>b.sourceId)).size,12);
  for(const s of GEO.heritageSites){
    assert.ok(TAIPEI_LANDMARKS.find(l=>l.id===s.id));
    assert.equal(TELEPORT_LOCATIONS[s.id].mode,'person');
    assert.ok(Math.hypot(s.arrival.x-s.x,s.arrival.z-s.z)>2);
    assert.ok(Math.hypot(s.arrival.x-s.x,s.arrival.z-s.z)<120);
  }
  assert.equal(GEO.coreDestinations.length,10,'historic buildings do not replace the ten citywide destinations');
});

test('a colonnade recess moves inward rather than adding a slab across the pavement',()=>{
  const ring=[0,0,20,0,20,10,0,10],edges=facadeEdges(ring),east=edges.find(e=>e.nx>.99),out=recessRing(ring,east,1.8);
  for(let i=0;i<out.length;i+=2){assert.ok(out[i]>=0&&out[i]<=18.2+.001);assert.ok(out[i+1]>=0&&out[i+1]<=10);}
  assert.equal(Math.max(...out.filter((_,i)=>i%2===0)),18.2);
});

test('all heritage models preserve mapped extents and finite geometry within a bounded detail budget',()=>{
  let total=0;
  for(const b of BUILDINGS.filter(b=>b.heritageProfile)){
    const root=buildHeritageBuilding(new THREE.Group(),b),bounds=new THREE.Box3().setFromObject(root);
    assert.ok(bounds.min.x>=b.minX-.6&&bounds.max.x<=b.maxX+.6,b.name+' x extent');
    assert.ok(bounds.min.z>=b.minZ-.6&&bounds.max.z<=b.maxZ+.6,b.name+' z extent');
    assert.ok(bounds.max.y<=b.ground+b.h+.25,b.name+' height');
    let vertices=0;
    root.traverse(o=>{if(o.isMesh){for(const attr of ['position','normal'])assert.ok(Array.from(o.geometry.getAttribute(attr).array).every(Number.isFinite));vertices+=o.geometry.getAttribute('position').count;}});
    assert.ok(vertices>1000&&vertices<300000,b.name+' vertex budget');total+=vertices;
    if(['modern-bank','restrained-deco'].includes(b.heritageProfile.template))assert.equal(root.userData.heritage.columns,0);
    if(['taiwan-bank','citibank','hsbc-bank'].includes(b.heritageProfile.template))assert.ok(root.userData.heritage.setbackM>1);
  }
  assert.ok(total<1500000);
});
