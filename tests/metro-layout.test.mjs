import test from 'node:test';import assert from 'node:assert/strict';import {CollisionWorld} from '../js/core.js';
test('the metro vestibule is open at the front and inside, while its back and sides stop a pedestrian',async()=>{
 const module=await import('../js/metro-layout.js').catch(()=>({}));assert.equal(typeof module.metroColliders,'function','metro entrance collision layout is missing');
 const station={id:'metro-test',entrance:{x:100,z:100,y:2.12,heading:0,width:4.8,depth:4.4}};const world=new CollisionWorld();world.addTile('entry',module.metroColliders(station));
 const touch=(x,z)=>world.query({minX:x-.48,maxX:x+.48,minY:2.12,maxY:4.02,minZ:z-.48,maxZ:z+.48});
 for(const z of [105,103,101,100,99])assert.equal(touch(100,z).length,0,'open entrance was obstructed at '+z);
 assert.ok(touch(100,97.8).length>0);assert.ok(touch(102.3,100).length>0);world.removeTile('entry');assert.equal(touch(102.3,100).length,0);
});
test('rotating a metro entrance keeps its walk-in opening in the same direction as its approach point',async()=>{
 const module=await import('../js/metro-layout.js').catch(()=>({}));assert.equal(typeof module.metroColliders,'function');
 const world=new CollisionWorld();world.addTile('entry',module.metroColliders({id:'rotated',entrance:{x:0,z:0,y:2.12,heading:Math.PI/2,width:3,depth:3.6}}));
 const touch=(x,z)=>world.query({minX:x-.48,maxX:x+.48,minY:2.12,maxY:4.02,minZ:z-.48,maxZ:z+.48});assert.equal(touch(2,0).length,0);assert.equal(touch(0,0).length,0);assert.ok(touch(-1.7,0).length>0);
});
test('a walking metro arrival uses its own ground floor rather than the adjacent elevated road',async()=>{
 const module=await import('../js/metro-layout.js');assert.equal(typeof module.metroFloorRoad,'function','metro walk-in floor is missing');assert.equal(typeof module.metroArrivalTarget,'function');const {SurfaceProvider}=await import('../js/core.js');
 const station={id:'under-overpass',name:'入口站',entrance:{x:8,z:0,y:2.12,heading:-Math.PI/2,width:4.8,depth:4.4,approach:{x:2.3,z:0}}};
 const provider=new SurfaceProvider([{id:'overpass',name:'高架',bridge:true,mode:'car',width:8,points:[[0,12,-100],[0,12,100]]}]);provider.setTileRoads({id:'tile',bounds:[-100,-100,100,100]},[module.metroFloorRoad(station)]);
 const target=module.metroArrivalTarget(station,'person'),landing=provider.landingCandidates(target.x,target.z,'person')[0];assert.equal(landing.y,2.12);assert.ok(landing.road.id.includes('under-overpass'));
 const sample=provider.sample({...target,y:2.12,mode:'person'});assert.equal(sample.height,2.12);assert.equal(sample.road.name,'入口站');assert.ok(provider.landingCandidates(target.x,target.z,'car').every(p=>p.road.mode!=='person'));
 provider.removeTileRoads('tile');assert.ok(provider.landingCandidates(target.x,target.z,'person').every(p=>!p.road.id.includes('under-overpass')));assert.deepEqual(module.metroArrivalTarget(station,'car'),{x:2.3,z:0});
});
