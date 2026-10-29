import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three/webgpu';
import {GEO} from '../js/runtime/wuhan-geodata.js';
import {BUILDINGS,hillHeight} from '../js/runtime/city-config.js';
import {ThirdPersonControllerManager} from '../js/runtime/controllers.js';
import {buildPassageGate} from '../js/runtime/passage-gates.js';

const city=JSON.parse(fs.readFileSync(new URL('../public/data/city.json',import.meta.url)));
function manager(){
 const m=Object.create(ThirdPersonControllerManager.prototype);m.activeMode='car';m.colliders=BUILDINGS.map(b=>({minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ,minY:b.ground+(b.base||-1.5),maxY:b.ground+b.h,poly:b.rings[0],rings:b.rings,building:b}));return m;
}

test('both mapped carriageways survive under Tiemen Gate and a taxi fits in both directions',()=>{
 const m=manager();
 for(const source of ['osm-way-1055558222','osm-way-1055558225']){
  const road=city.roads.find(r=>r.id===source+'-part-0');assert.ok(road,source+' missing from ground graph');
  assert.equal(road.tunnel,false);assert.equal(road.layer,0);assert.ok(GEO.roadSourceIds.includes(road.id));
  const a=road.points[0],b=road.points.at(-1),dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz),heading=Math.atan2(dx,dz);
  const car={type:'car',position:new THREE.Vector3(),heading,speed:0,vx:0,vz:0};m.entities={car};
  for(let s=-4;s<L+4;s+=.25){
   const x=a[0]+dx*s/L,z=a[2]+dz*s/L;car.position.set(x,hillHeight(x,z),z);m.resolveHorizontalCollision(car.position,1.35,car.position.y+1,car);
   assert.ok(Math.hypot(car.position.x-x,car.position.z-z)<.02,source+' blocked at '+s);
  }
 }
});

test('the two foot arches and the Jianghan Gate path stay open while actual gate walls still collide',()=>{
 const m=manager();m.activeMode='person';
 for(const source of ['osm-way-675321054','osm-way-675321062','osm-way-1525361062','osm-way-1525361064']){
  const road=city.roads.find(r=>r.id===source+'-part-0');assert.ok(road,source+' missing');
  for(let i=1;i<road.points.length;i++)for(let t=0;t<=1;t+=.05){
   const a=road.points[i-1],b=road.points[i],x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t,p=new THREE.Vector3(x,hillHeight(x,z),z);m.resolveHorizontalCollision(p,.48,p.y+1);
   assert.ok(Math.hypot(p.x-x,p.z-z)<.02,source+' blocked at '+t);
  }
 }
 const g=GEO.passageGates.find(g=>g.name==='铁门关'),f=g.frame,x=f.x-20*f.ux,z=f.z-20*f.uz,p=new THREE.Vector3(x,g.groundY,z);m.resolveHorizontalCollision(p,.48,p.y+1);
 assert.ok(Math.hypot(p.x-x,p.z-z)>.5,'solid wall lost collision');
});

test('visible Tiemen arch holes match the collider passage and have solid vaults above',()=>{
 const p=GEO.passageGates.find(p=>p.name==='铁门关');assert.ok(p);const root=buildPassageGate(p);root.updateMatrixWorld(true);const f=p.frame;
 const ray=(u,y)=>new THREE.Raycaster(new THREE.Vector3(f.x+f.ux*u+f.uz*20,p.groundY+y,f.z+f.uz*u-f.ux*20),new THREE.Vector3(-f.uz,0,f.ux),0,40).intersectObject(root,true);
 for(const u of [-15.5,-4,4,14])assert.equal(ray(u,2).length,0,'visual opening filled at '+u);
 assert.ok(ray(-20,2).length>0);assert.ok(ray(0,12).length>0);
 root.traverse(o=>{if(o.isMesh)assert.ok(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite));});
});

test('all gate and canopy volumes carry explicit vertical clearance and preserve surveyed source rings',()=>{
 assert.ok(GEO.passageGates.length>=19);assert.ok(GEO.passageGates.some(p=>p.name==='江汉门'));assert.ok(GEO.passageGates.some(p=>p.name==='三楚一楼大牌坊'));
 for(const p of GEO.passageGates){
  assert.ok(p.clearanceM>=3);assert.ok(p.parts.some(v=>v.baseY>=3));
  assert.ok(BUILDINGS.some(b=>b.passageProfileId===p.sourceId));
  for(const b of BUILDINGS.filter(b=>b.passageProfileId===p.sourceId))assert.equal(b.ground,p.groundY);
 }
});
