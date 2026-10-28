import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';import {buildLandmarks} from '../js/shanghai-landmarks.js';
import fs from 'node:fs';

test('B landmark exteriors keep distinct silhouettes and lane houses leave a walkable central passage',()=>{
 const original=globalThis.document;
 globalThis.document={createElement(){return {width:128,height:128,getContext(){return new Proxy({},{get:()=>()=>{}});}};}};
 try{
  const scene=new THREE.Scene(),items=[{name:'temple',type:'temple',x:0,z:0},{name:'museum',type:'museum',x:300,z:0},{name:'exhibition',type:'exhibition',x:600,z:0},{name:'lane',type:'lane',x:900,z:0}],out=buildLandmarks(scene,items);
  for(const [i,height]of [48,29.5,110,12].entries()){
   const bounds=new THREE.Box3().setFromObject(out.groups[i]);assert.ok(Math.abs(bounds.max.y-2-height)<.6,items[i].type+' silhouette has the wrong height');
  }
  const lane=out.groups[3],parts=lane.userData.collisionParts;assert.ok(parts?.length>=12,'lane collision is one solid city block');
  for(const part of parts){const b=new THREE.Box3().setFromObject(part);assert.ok(!b.containsPoint(new THREE.Vector3(900,3,0)),'central lane blocked by a house');}
  const exhibition=out.groups[2],courtyard=new THREE.Vector3(600,3,50);assert.ok(exhibition.userData.collisionParts?.length>=4,'exhibition uses a solid block collision');
  for(const part of exhibition.userData.collisionParts)assert.ok(!new THREE.Box3().setFromObject(part).containsPoint(courtyard),'open exhibition courtyard is blocked');
 }finally{globalThis.document=original;}
});
test('new landmark collision parts leave the sourced street centrelines clear for a complete taxi',()=>{
 const original=globalThis.document;globalThis.document={createElement(){return {width:128,height:128,getContext(){return new Proxy({},{get:()=>()=>{}});}};}};
 try{
  const data=JSON.parse(fs.readFileSync('public/data/city.json')),items=data.landmarks.filter(l=>['jingan','museum','exhibition','tianzifang'].includes(l.id)),out=buildLandmarks(new THREE.Scene(),items);
  const hits=(a,b,box)=>{let lo=0,hi=1;for(const [k,index]of [['x',0],['z',2]]){const d=b[index]-a[index],min=box.min[k]-2.6,max=box.max[k]+2.6;if(!d){if(a[index]<min||a[index]>max)return false;continue;}const t1=(min-a[index])/d,t2=(max-a[index])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}return true;};
  out.groups.forEach((g,index)=>{g.updateMatrixWorld(true);for(const part of g.userData.collisionParts||[g]){const b=new THREE.Box3().setFromObject(part);for(const road of data.roads)for(let i=1;i<road.points.length;i++)assert.ok(!hits(road.points[i-1],road.points[i],b),items[index].id+' blocks sourced road '+road.name+' '+road.id);}});
 }finally{globalThis.document=original;}
});
