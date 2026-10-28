import test from 'node:test';import assert from 'node:assert/strict';
test('full-city map zoom preserves the pointer location and supports street-scale views',async()=>{
 const {MapViewport}=await import('../js/map-view.js').catch(()=>({}));assert.equal(typeof MapViewport,'function');
 const v=new MapViewport([-70000,-80000,65000,60000]);const anchor={x:40000,z:-50000};
 const u=(anchor.x-v.x)/v.w,w=(anchor.z-v.z)/v.h;v.zoom(4,anchor);
 assert.ok(Math.abs((anchor.x-v.x)/v.w-u)<1e-9);assert.ok(Math.abs((anchor.z-v.z)/v.h-w)<1e-9);
 v.zoom(100,anchor);assert.ok(v.w>=500&&v.w<2000);v.reset();assert.equal(v.w,135000);
});
test('map can fit filtered results to a wide panel and zoom to a station entrance without letterbox drift',async()=>{
 const {MapViewport}=await import('../js/map-view.js');const v=new MapViewport([-70000,-80000,65000,60000],{aspect:2,minWidth:250});assert.equal(typeof v.fitBounds,'function','filtered map fitting is missing');v.fitBounds([-1000,-500,1000,500],{padding:0});assert.equal(v.w,2000);assert.equal(v.h,1000);v.zoom(100);assert.equal(v.w,250);assert.equal(v.h,125);v.reset();assert.ok(v.w>=135000&&v.h>=140000);assert.ok(v.x<=-70000&&v.x+v.w>=65000);
});
test('fitting a single search result preserves neighbourhood context while manual zoom can still inspect the entrance',async()=>{
 const {MapViewport}=await import('../js/map-view.js');const v=new MapViewport([-70000,-80000,65000,60000],{aspect:2,minWidth:250});v.fitBounds([300,-200,300,-200],{minWidth:2000});assert.equal(v.w,2000);assert.equal(v.h,1000);assert.equal(v.x+v.w/2,300);assert.equal(v.z+v.h/2,-200);v.zoom(100);assert.equal(v.w,250);
});
test('map can pan to islands and recenter on a remote player without leaving city bounds',async()=>{
 const {MapViewport}=await import('../js/map-view.js').catch(()=>({}));assert.equal(typeof MapViewport,'function');
 const v=new MapViewport([-70000,-80000,65000,60000]);v.centerOn({x:40000,z:-50000},5000);assert.equal(v.x+v.w/2,40000);
 v.pan(1000,-2000);assert.equal(v.x+v.w/2,41000);assert.equal(v.z+v.h/2,-52000);v.pan(1e9,1e9);assert.ok(v.x+v.w<=65000&&v.z+v.h<=60000);
});
