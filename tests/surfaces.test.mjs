import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleTerrain} from '../js/runtime/terrain-surface.js';
import {createBridgeSurfaces,triangleHeight} from '../js/runtime/bridge-surfaces.js';

test('saddle terrain uses the rendered triangle planes rather than a bilinear patch',()=>{
 const h={nx:2,nz:2,x0:0,z0:0,res:25,data:new Uint8Array([0,0,0,20])};
 assert.equal(sampleTerrain(h,6.25,6.25),0);assert.equal(sampleTerrain(h,18.75,18.75),10);
 assert.equal(sampleTerrain(h,12.5,12.5),0);assert.equal(sampleTerrain(h,-1,5),0);
 for(const tri of [[[0,0,0],[25,0,0],[0,0,25]],[[25,0,0],[25,20,25],[0,0,25]]]){
  for(const [u,v] of [[.2,.3],[.6,.1],[.1,.8]]){
   const p=tri[0].map((n,k)=>n*(1-u-v)+tri[1][k]*u+tri[2][k]*v);
   assert.ok(Math.abs(sampleTerrain(h,p[0],p[2])-p[1])<1e-8);
  }
 }
});

test('two opposite bridge carriageways become one supported deck, including their central gap',()=>{
 const models=[{name:'bridge',sourceId:'a',width:6,points:[[0,34.12,0],[0,34.12,100]]},
               {name:'bridge',sourceId:'b',width:6,points:[[8,34.12,100],[8,34.12,0]]}];
 const b=createBridgeSurfaces(models);assert.equal(b.surfaces.length,1);
 for(let z=1;z<100;z+=2)for(let x=-3;x<=11;x+=.5)assert.ok(Math.abs(b.heightAt(x,z)-32)<1e-8,`${x},${z}`);
 assert.equal(b.heightAt(4,50,30),null); // an actor underneath does not snap onto the deck
 assert.equal(b.heightAt(12,50),null);assert.deepEqual([...b.roadIds],['a','b']);
});

test('surface contact follows the actual quad triangles through bends and height changes',()=>{
 const b=createBridgeSurfaces([
  {name:'bridge',sourceId:'a',width:6,points:[[0,12.12,0],[0,14.12,100],[20,16.12,200]]},
  {name:'bridge',sourceId:'b',width:6,points:[[28,16.12,200],[8,14.12,100],[8,12.12,0]]}]);
 for(const tri of b.surfaces[0].triangles){
  const p=tri[0].map((n,k)=>n*.3+tri[1][k]*.3+tri[2][k]*.4);
  assert.ok(Math.abs(b.heightAt(p[0],p[2])-p[1])<1e-7);
 }
 assert.equal(triangleHeight([0,1,0],[1,1,0],[0,1,1],10,10),null);
});

test('separate distant bridge alignments cannot be merged merely because their names match',()=>{
 const b=createBridgeSurfaces([{name:'bridge',sourceId:'a',width:6,points:[[0,12.12,0],[0,12.12,100]]},
 {name:'bridge',sourceId:'b',width:6,points:[[80,12.12,100],[80,12.12,0]]}]);assert.equal(b.surfaces.length,0);
});
