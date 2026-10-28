import test from 'node:test';
import assert from 'node:assert/strict';
import {GEO} from '../js/runtime/wuhan-geodata.js';
import {createTunnelSystem} from '../js/runtime/tunnel-surfaces.js';
import {barrierSpan,tunnelHasSides} from '../js/runtime/surface-barriers.js';
import {streetPropCollider,streetPropColliders} from '../js/runtime/prop-colliders.js';
import {circleFootprint} from '../js/runtime/collision-footprint.js';
const system=createTunnelSystem(GEO.tunnels);
test('all four ground portals allow a car to leave either side without invisible confinement',()=>{
 for(const road of GEO.tunnels)for(const end of [0,road.points.length-1])for(const side of [-1,1]){
  const p=road.points[end],q=road.points[end===0?1:end-1],len=Math.hypot(q[0]-p[0],q[2]-p[2]),nx=-(q[2]-p[2])/len,nz=(q[0]-p[0])/len;
  const car={position:{x:p[0],y:p[1],z:p[2]},heading:Math.atan2(nx*side,nz*side),tunnelId:road.id};
  for(let d=.1;d<8;d+=.1){const x=p[0]+nx*side*d,z=p[2]+nz*side*d;car.position.x=x;car.position.z=z;system.move(car);assert.ok(Math.hypot(car.position.x-x,car.position.z-z)<1e-8);}
  assert.equal(tunnelHasSides(car.position.y),false);
 }
});
test('walls start at the same separation threshold on screen and in contact; raised terrain is considered',()=>{
 assert.equal(tunnelHasSides(-.7),false);assert.equal(tunnelHasSides(-.8),true);
 assert.equal(barrierSpan([0,0,0],[0,-.7,10],0,0,{underground:true}),null);
 const span=barrierSpan([0,0,0],[0,-3,12],0,0,{underground:true});assert.deepEqual(span[0],[0,-.75,3]);
 assert.equal(barrierSpan([0,18,0],[0,18.4,10],18,18),null);
 assert.ok(barrierSpan([0,18,0],[0,21,12],18,18));
 for(const road of GEO.tunnels){const p=road.points[Math.floor(road.points.length/2)],car={position:{x:p[0]+8,y:p[1],z:p[2]},heading:0,tunnelId:road.id};assert.ok(system.move(car));assert.ok(system.floorAt(car.position.x,car.position.z,road.id)!==null);}
});
test('furniture reservation space remains drivable; actual pole and planter still block',()=>{
 const lamp=streetPropCollider({kind:'heritage-lamp',x:0,z:0,radius:.55});
 assert.equal(circleFootprint(.4,0,.1,lamp),null);assert.ok(circleFootprint(.12,0,.1,lamp));
 const planter=streetPropColliders({kind:'planter-tree',x:0,z:0,radius:2});assert.equal(planter.length,2);assert.equal(planter[0].maxY,.4);
 assert.equal(circleFootprint(1.8,0,.1,planter[0]),null);assert.ok(circleFootprint(1.4,0,.1,planter[0]));
 const bench=streetPropCollider({kind:'bench',x:0,z:0,radius:1.15,yaw:Math.PI/2});assert.equal(circleFootprint(.7,0,.1,bench),null);assert.ok(circleFootprint(0,.7,.1,bench));
 assert.equal(streetPropCollider({kind:'reservation-only',x:0,z:0,radius:20}),null);
});

test('the actual taxi collision routine clears a lamp when the body clears its visible pole',async()=>{
 const {ThirdPersonControllerManager}=await import('../js/runtime/controllers.js');
 const {Vector3}=await import('three');
 const manager=Object.create(ThirdPersonControllerManager.prototype);manager.activeMode='car';
 manager.nearColliders=()=>[streetPropCollider({kind:'heritage-lamp',x:0,z:0,radius:.55})];
 for(const heading of [0,Math.PI/2,Math.PI]){const car={position:new Vector3(Math.cos(heading)*1.3,0,-Math.sin(heading)*1.3),heading,speed:0,vx:0,vz:0},before=car.position.clone();
  manager.resolveHorizontalCollision(car.position,1.35,1,car);assert.ok(car.position.distanceTo(before)<1e-8);
 }
});
