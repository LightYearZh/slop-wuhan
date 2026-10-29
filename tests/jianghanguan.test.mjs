import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three/webgpu';
import {pointInPolygon} from '../js/core.js';
import {GEO} from '../js/runtime/wuhan-geodata.js';
import {BUILDINGS} from '../js/runtime/city-config.js';
import {buildHeritageBuilding} from '../js/runtime/hankou-heritage.js';
import {buildWuhanLandmarks} from '../js/wuhan-landmarks.js';
const city=JSON.parse(fs.readFileSync('public/data/city.json'));
const landmark=city.landmarks.find(l=>l.id==='jianghanguan');

test('museum roof courses keep the concave plan clear of its touching neighbour',()=>{
 const original=globalThis.document;
 globalThis.document={createElement(){return {getContext(){return new Proxy({},{get:()=>()=>{}});}};}};
 try{
  const root=buildWuhanLandmarks(new THREE.Scene(),[landmark]).groups[0];
  const slabs=root.children.filter(m=>m.userData.footprintCourse);
  assert.equal(slabs.length,6);
  const neighbour=city.buildings.find(b=>b.id==='osm-building-way-128400513-0');
  let sampled=0;
  for(const mesh of slabs){
   const p=mesh.geometry.getAttribute('position');
   for(let i=0;i<p.count;i+=3){
    // Triangle interiors detect a roof spanning a notch even when its corners lie on the outline.
    for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){
     const x=weights.reduce((s,w,j)=>s+w*p.getX(i+j),0),z=weights.reduce((s,w,j)=>s+w*p.getZ(i+j),0);
     const normal=mesh.geometry.getAttribute('normal');if(Math.abs(normal.getY(i))<.9)continue;
     assert.ok(pointInPolygon(x,z,landmark.footprint),'course fills the concave courtyard');
     assert.ok(!pointInPolygon(x,z,neighbour.rings),'course embeds in the neighbouring building');sampled++;
    }
   }
  }
  assert.ok(sampled>100);
  const bounds=new THREE.Box3().setFromObject(root);
  assert.ok(bounds.max.y>47&&bounds.max.y<48,'clock tower height changed');
 }finally{globalThis.document=original;}
});

test('reviewed clock component is removed without deleting its surrounding mapped buildings',()=>{
 const config=JSON.parse(fs.readFileSync('config/landmark-components.json'));
 const audit=JSON.parse(fs.readFileSync('public/data/wuhan-audit.json'));
 for(const c of config.components){
  assert.ok(!city.buildings.some(b=>b.id.startsWith(c.sourceId+'-')));
  assert.ok(audit.landmarkComponentReviews.some(r=>r.sourceId===c.sourceId));
 }
 for(const id of ['osm-building-way-128400513-0','osm-building-way-767972190-0','osm-building-way-981847959-0','osm-building-way-981847958-0'])assert.ok(city.buildings.some(b=>b.id===id),id+' incorrectly removed');
});

test('clock shaft, entrance and colonnade share an axis without changing the approved orientation',()=>{
 const original=globalThis.document;
 globalThis.document={createElement(){return {getContext(){return new Proxy({},{get:()=>()=>{}});}};}};
 try{
  const root=buildWuhanLandmarks(new THREE.Scene(),[landmark]).groups[0],axis=root.userData.axis;
  const g=root.children.find(o=>o.isGroup);
  assert.equal(g.rotation.y,landmark.ry,'approved orientation changed');
  assert.equal(axis.towerLocal[0],axis.entryLocal[0]);
  assert.equal(axis.towerLocal[1],axis.planDepthCenter);
  const bounds=new THREE.Box3();
  for(const mesh of g.children.filter(o=>o.isMesh)){
   const pos=mesh.geometry.getAttribute('position');
   for(let i=0;i<pos.count;i++)if(pos.getY(i)>25)bounds.expandByPoint(new THREE.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)));
  }
  const center=bounds.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(center.x-axis.entryLocal[0])<.001,'actual tower geometry is off the entrance axis');
  assert.ok(Math.abs(center.z-axis.planDepthCenter)<.001,'actual tower geometry is shifted along the roof');
 }finally{globalThis.document=original;}
});

test('reviewed narrow streets use pedestrian paving and cannot be NPC vehicle links',()=>{
 const review=JSON.parse(fs.readFileSync('config/jianghanguan-streetscape.json'));
 for(const entry of review.pedestrianRoads){
  const roads=city.roads.filter(r=>r.id.startsWith(entry.sourceId+'-part-'));
  assert.ok(roads.length);
  for(const r of roads){assert.equal(r.mode,'person');assert.equal(r.width,2.5);assert.equal(r.accessReview.original.mode,'car');}
  const links=GEO.links.filter((_,i)=>GEO.roadSourceIds[i].startsWith(entry.sourceId+'-part-'));
  assert.ok(links.length);
  for(const l of links){assert.equal(l[3],9);assert.ok(l[7]&4);}
 }
 assert.ok(city.roads.some(r=>r.name==='沿江大道'&&r.mode==='car'));
});

test('marked streetscape frontage has a detailed model without changing its source identity or height',()=>{
 const b=BUILDINGS.find(b=>b.sourceId==='osm-building-way-981847958-0');
 assert.ok(b.contextAppearance);
 assert.equal(b.category,'civic');assert.ok(!b.heritageProfile);
 const root=buildHeritageBuilding(new THREE.Group(),{...b,heritageProfile:b.contextAppearance});
 const bounds=new THREE.Box3().setFromObject(root);
 assert.ok(bounds.max.y<=b.ground+b.h+.25);
 assert.ok(bounds.min.x>=b.minX-.6&&bounds.max.x<=b.maxX+.6);
 assert.ok(bounds.min.z>=b.minZ-.6&&bounds.max.z<=b.maxZ+.6);
 assert.ok(root.userData.heritage.facadeBays>15);
 assert.equal(root.userData.heritage.detailConfidence,'user-reference:streetscape-reconstruction;not-verified-historic-identity');
 const risshin=BUILDINGS.find(b=>b.sourceId==='osm-building-way-981847959-0');
 assert.equal(risshin.h,22);assert.equal(risshin.heritageProfile.floors,5);
 assert.equal(risshin.sourceHeight,null,'estimated envelope must not be presented as a measured height');
});
