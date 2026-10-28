import test from 'node:test';import assert from 'node:assert/strict';
const module=()=>import('../js/loading-progress.js').catch(()=>({}));
test('startup percentage advances with completed work, never with elapsed time, and waits for a usable frame',async()=>{
 const m=await module();assert.equal(typeof m.BootProgress,'function','measured startup progress is missing');let now=0;const p=new m.BootProgress({now:()=>now});p.begin('download',100);p.update('download',50,100,'50 bytes');const before=p.snapshot();now=60000;assert.equal(p.snapshot().percent,before.percent);assert.equal(p.snapshot().elapsedMs,60000);assert.ok(before.percent>0&&before.percent<100);
 for(const id of ['download','data','engine','scene','tiles','render'])p.complete(id);assert.ok(p.snapshot().percent<100);assert.equal(p.snapshot().ready,false);p.markReady();assert.equal(p.snapshot().percent,100);assert.equal(p.snapshot().ready,true);
});
test('a startup failure stays incomplete and preserves a useful error for retry',async()=>{
 const m=await module();assert.equal(typeof m.BootProgress,'function');const p=new m.BootProgress();p.begin('tiles',3);p.update('tiles',1,3,'1/3');p.fail(new Error('HTTP 503 · tile'));assert.equal(p.snapshot().ready,false);assert.match(p.snapshot().error,/503/);assert.ok(p.snapshot().percent<100);assert.throws(()=>p.markReady());
});
test('stream progress counts decoded bytes against a pinned size even when the wire Content-Length is compressed',async()=>{
 const m=await module();assert.equal(typeof m.fetchTrackedBytes,'function','streamed asset reads are missing');const updates=[];const body=new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.enqueue(new Uint8Array([3,4,5]));c.close();}});
 const result=await m.fetchTrackedBytes('/asset',{expectedBytes:5,onProgress:p=>updates.push({...p}),fetchImpl:async()=>new Response(body,{headers:{'Content-Length':'2','Content-Encoding':'gzip'}})});
 assert.deepEqual([...result],[1,2,3,4,5]);assert.ok(updates.some(p=>p.loaded===2&&p.total===5&&!p.done));assert.deepEqual(updates.at(-1),{loaded:5,total:5,done:true});
});
test('unknown-length streams are counted without an invented percentage and truncated pinned assets fail',async()=>{
 const m=await module();assert.equal(typeof m.fetchTrackedBytes,'function');const updates=[];await m.fetchTrackedBytes('/unknown',{onProgress:p=>updates.push({...p}),fetchImpl:async()=>new Response(new Uint8Array([1,2,3]))});assert.equal(updates.at(-1).loaded,3);assert.equal(updates.at(-1).total,null);assert.equal(updates.at(-1).done,true);
 await assert.rejects(m.fetchTrackedBytes('/short',{expectedBytes:5,fetchImpl:async()=>new Response(new Uint8Array([1,2]))}),/长度|size|truncat/i);
 await assert.rejects(m.fetchTrackedBytes('/failed',{fetchImpl:async()=>new Response('fail',{status:503})}),/503/);
 await assert.rejects(m.fetchTrackedBytes('/data/metro.json',{fetchImpl:async()=>{throw Error('offline');}}),/metro\.json/);
});
