import test from 'node:test';
import assert from 'node:assert/strict';

test('ambient pools select the current neighbourhood even when distant sites occur first',async()=>{
 const {nearbySites}=await import('../js/nearby-sites.js');
 const sites=[{x:-4000,z:0},{x:100,z:0},{x:25,z:0},{x:50,z:0}];
 assert.deepEqual(nearbySites(sites,{x:0,z:0},2,300),[sites[2],sites[3]]);
 assert.deepEqual(nearbySites(sites,{x:-4000,z:0},2,300),[sites[0]]);
});

test('recycled ambient actors enter outside the visible centre and never duplicate an occupied site',async()=>{
 const {nearbySites}=await import('../js/nearby-sites.js');
 const sites=[{x:20,z:0},{x:240,z:0},{x:280,z:0},{x:500,z:0}];
 assert.deepEqual(nearbySites(sites,{x:0,z:0},80,420,220,new Set([sites[1]])),[sites[2]]);
});

test('citywide actor selection indexes distant streets instead of scanning every seed',async()=>{
 const m=await import('../js/nearby-sites.js');assert.equal(typeof m.SpatialSites,'function');
 let reads=0;const local={x:20,z:0},far=Array.from({length:50000},(_,i)=>({get x(){reads++;return 10000+i*2;},z:10000}));
 const index=new m.SpatialSites([local,...far]);reads=0;
 assert.deepEqual(m.nearbySites(index,{x:0,z:0},20,500),[local]);assert.ok(reads<50,'selection scanned '+reads+' distant sites');
});
