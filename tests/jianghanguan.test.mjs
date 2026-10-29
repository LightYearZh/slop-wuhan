import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three/webgpu';
import {pointInPolygon} from '../js/core.js';
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
