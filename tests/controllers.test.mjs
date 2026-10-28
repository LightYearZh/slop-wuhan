import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three/webgpu';import {ThirdPersonControllerManager} from '../js/controllers.js';
test('helicopter descent stops above Shanghai land and cancels its downward velocity',()=>{
 const c=Object.create(ThirdPersonControllerManager.prototype),h={position:new THREE.Vector3(0,2.12,0),speed:0,heading:0,verticalSpeed:0,pitchAngle:0,rollAngle:0,tiltPivot:{rotation:{},position:{}}};
 c.entities={helicopter:h};c.keys={down:true};c.surfaceProvider={isWater:()=>false,sample:()=>({height:2.12,surfaceId:'ground'})};c.resolveHorizontalCollision=()=>{};
 for(let i=0;i<120;i++)c.updateHelicopter(1/60,i/60);assert.ok(h.position.y>=2.82,'helicopter sank below land '+h.position.y);assert.equal(h.verticalSpeed,0);
});
test('taxi collision contains its mirrors and bumper rather than only its narrow chassis',()=>{
 const c=Object.create(ThirdPersonControllerManager.prototype),car={position:new THREE.Vector3(.9,2.12,0),heading:0,speed:0,vx:0,vz:0};c.entities={car};c.activeMode='car';c.nearColliders=()=>[{minX:1.8,maxX:2,minY:2,maxY:20,minZ:-8,maxZ:8}];
 c.resolveHorizontalCollision(car.position,1.35,1,car);assert.ok(car.position.x+1.0563<=1.81,'taxi mirror penetrated a wall');
});
test('movement honours the expanded Shanghai bounds on both banks instead of clamping to the old release',()=>{
 const c=Object.create(ThirdPersonControllerManager.prototype),car={position:new THREE.Vector3(3330,2.12,300),heading:0,speed:0,vx:0,vz:0};c.entities={car};c.activeMode='car';c.worldBounds=[-5240,-3105,4288,4103];c.nearColliders=()=>[];
 c.resolveHorizontalCollision(car.position,1.35,1,car);assert.equal(car.position.x,3330,'east-bank expansion was clamped to the old border');
 car.position.set(-5100,2.12,1200);c.resolveHorizontalCollision(car.position,1.35,1,car);assert.equal(car.position.x,-5100,'Jing’an was clamped to the old border');
 car.position.set(5000,2.12,6000);c.resolveHorizontalCollision(car.position,1.35,1,car);assert.equal(car.position.x,4288);assert.equal(car.position.z,4103);
});
test('helicopter can climb above Shanghai Tower and stops upward velocity at the new ceiling',()=>{
 const c=Object.create(ThirdPersonControllerManager.prototype),h={type:'helicopter',position:new THREE.Vector3(0,620,0),speed:0,heading:0,verticalSpeed:0,pitchAngle:0,rollAngle:0,tiltPivot:{rotation:{},position:{}}};
 c.entities={helicopter:h};c.keys={up:true};c.surfaceProvider={isWater:()=>false,sample:()=>({height:2.12,surfaceId:'ground'})};c.resolveHorizontalCollision=()=>{};
 for(let i=0;i<900;i++)c.updateHelicopter(1/60,i/60);assert.ok(h.position.y>800,'flight remained below the skyline: '+h.position.y);
 for(let i=0;i<3600;i++)c.updateHelicopter(1/60,i/60);assert.ok(h.position.y<=1200);assert.equal(h.verticalSpeed,0,'upward velocity remained at ceiling');
 c.keys={down:true};for(let i=0;i<60;i++)c.updateHelicopter(1/60,i/60);assert.ok(h.position.y<1190,'descent did not respond after hitting ceiling');
});
test('a high helicopter keeps its altitude when teleported to another location',()=>{
 const c=Object.create(ThirdPersonControllerManager.prototype),h={type:'helicopter',position:new THREE.Vector3(0,900,0),heading:0,chaseDistance:20,chaseHeight:6,tiltPivot:{rotation:{},position:{}},mesh:{position:new THREE.Vector3(),rotation:{}}};
 c.entities={helicopter:h};c.activeMode='helicopter';c.keys={};c._pressedCodes=new Set();c.worldBounds=[-500,-500,500,500];c.nearColliders=()=>[];
 c.teleportActiveTo(100,100,0);assert.equal(h.position.y,900);assert.equal(h.position.x,100);assert.equal(h.position.z,100);
});
