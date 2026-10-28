import test from 'node:test';
import assert from 'node:assert/strict';
const load = async () => { try { return await import('../js/core.js'); } catch { return {}; } };
test('WGS84 projection preserves east/north orientation and metre scale', async () => {
 const m=await load(); assert.equal(typeof m.projectWgs84,'function','projection not implemented');
 assert.deepEqual(m.projectWgs84(114.293,30.585),{x:0,z:0});
 const p=m.projectWgs84(114.294,30.586); assert.ok(p.x>95&&p.x<97);assert.ok(p.z < -110 && p.z > -112);
 const q=m.unprojectWorld(p.x,p.z);assert.ok(Math.abs(q.lon-114.294)<1e-7&&Math.abs(q.lat-30.586)<1e-7);
});
test('surface sampling keeps a car underground while a pedestrian stays on the street above', async () => {
 const m=await load();assert.equal(typeof m.SurfaceProvider,'function','surface provider not implemented');
 const s=new m.SurfaceProvider([{id:'tunnel',points:[[0,2,0],[100,-20,0],[200,2,0]],width:8,tunnel:true}]);
 assert.equal(s.sample({x:100,z:0,y:-20,mode:'car',surfaceId:'tunnel'}).height,-20);
 assert.equal(s.sample({x:100,z:0,y:2,mode:'person'}).height,2);
 assert.equal(s.sample({x:0,z:0,y:2,mode:'car'}).height,2);
 assert.ok(s.sample({x:50,z:0,y:-9,mode:'car',surfaceId:'tunnel'}).normal.y>0);
});
test('collision query filters both horizontal extent and height and unregisters tiles', async () => {
 const m=await load();assert.equal(typeof m.CollisionWorld,'function','collision world not implemented');
 const w=new m.CollisionWorld();w.addTile('a',[{id:'building',minX:0,maxX:10,minY:2,maxY:40,minZ:0,maxZ:10}]);
 assert.equal(w.query({minX:2,maxX:4,minY:-22,maxY:-18,minZ:2,maxZ:4}).length,0);
 assert.equal(w.query({minX:2,maxX:4,minY:3,maxY:5,minZ:2,maxZ:4}).length,1);
 w.removeTile('a');assert.equal(w.query({minX:2,maxX:4,minY:3,maxY:5,minZ:2,maxZ:4}).length,0);
});
test('tile loader retries failures and ignores stale late mounts after disposal', async () => {
 const m=await load();assert.equal(typeof m.TileLoader,'function','tile loader not implemented');
 let attempts=0,mounts=0,disposes=0;
 const loader=new m.TileLoader({tiles:[{id:'a',bounds:[0,0,500,500],url:'a'}]},async()=>{if(++attempts===1)throw Error('offline');return {};},()=>{mounts++;return {dispose(){disposes++;}};});
 await assert.rejects(loader.ensureAt({x:10,z:10},'car'),/offline/);
 await loader.ensureAt({x:10,z:10},'car');assert.equal(mounts,1);loader.dispose();assert.equal(disposes,1);
 let resolve;const slow=new m.TileLoader({tiles:[{id:'a',bounds:[0,0,500,500],url:'a'}]},()=>new Promise(r=>resolve=r),()=>{mounts++;return {dispose(){}};});
 const p=slow.ensureAt({x:1,z:1},'car');slow.dispose();resolve({});await assert.rejects(p,/disposed/);assert.equal(mounts,1);
});
test('road graph separates levels and respects one-way and walking-only paths', async () => {
 const m=await load();assert.equal(typeof m.buildRoadGraph,'function','road graph not implemented');
 const g=m.buildRoadGraph([{id:'a',nodeIds:[1,2],points:[[0,2,0],[10,2,0]],oneway:true,mode:'car',layer:0},{id:'b',nodeIds:[3,4],points:[[5,-20,-5],[5,-20,5]],mode:'car',layer:-1},{id:'c',nodeIds:[2,5],points:[[10,2,0],[20,2,0]],mode:'person',layer:0}]);
 assert.equal(g.edges.filter(e=>e.roadId==='a').length,1);assert.equal(g.edges.filter(e=>e.roadId==='b').length,2);
 assert.ok(!g.edges.some(e=>e.from==='0:1'&&e.to==='-1:3'));assert.deepEqual(g.edges.find(e=>e.roadId==='c').modes,['person','cyclist']);
});
test('readiness gate blocks an unmounted cell and rejects positions outside the declared region',async()=>{
 const {TileLoader}=await load();const loader=new TileLoader({bounds:[0,0,500,500],tiles:[{id:'river',bounds:[0,0,500,500]}]},async()=>({buildings:[]}),()=>({dispose(){}}));
 assert.equal(loader.readyAt({x:10,z:10}),false);await loader.ensureAt({x:10,z:10},'helicopter');assert.equal(loader.readyAt({x:10,z:10}),true);assert.equal(loader.readyAt({x:-1,z:10}),false);
 await assert.rejects(loader.ensureAt({x:-1,z:10},'car'),/outside/);
});
test('a pending explicit arrival survives background prefetch at the old position',async()=>{
 const {TileLoader}=await load();let finish,aborted=false;
 const loader=new TileLoader({tiles:[{id:'old',bounds:[0,0,500,500]},{id:'far',bounds:[3000,0,3500,500]}]},async(t,signal)=>{if(t.id==='old')return {};return new Promise((resolve,reject)=>{finish=resolve;signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));});});},()=>({dispose(){}}));
 const arrival=loader.ensureAt({x:3200,z:100},'car');const outcome=arrival.then(()=>true,()=>false);await loader.update({x:100,z:100},'car');finish({});assert.equal(await outcome,true);assert.equal(aborted,false);assert.equal(loader.readyAt({x:3200,z:100}),true);
});
test('landing and movement readiness include neighbouring owners of buildings spanning a tile boundary',async()=>{
 const {TileLoader}=await load(),mounted=[];const loader=new TileLoader({bounds:[-500,0,500,500],collisionHaloM:180,tiles:[{id:'west',bounds:[-500,0,0,500]},{id:'east',bounds:[0,0,500,500]}]},async()=>({}),(_,t)=>{mounted.push(t.id);return {dispose(){}};});
 await loader.ensure('west');assert.equal(loader.readyAt({x:-.5,z:100}),false);await loader.ensureAt({x:-.5,z:100},'car');assert.equal(loader.readyAt({x:-.5,z:100}),true);assert.ok(mounted.includes('east'));
});

test('underground follow camera remains below the ceiling without clamping to world zero',async()=>{const m=await load();assert.equal(typeof m.constrainTunnelCamera,'function','tunnel camera not implemented');const p=m.constrainTunnelCamera({x:20,y:5,z:5},{x:10,y:-26,z:0,heading:Math.PI/2},8,5.5);assert.ok(p.y<-20&&p.y>-26);assert.ok(Math.abs(p.z)<3);});
test('underground camera stays inside the actual bore when the vehicle is already near a wall',async()=>{
 const m=await load(),road={points:[[0,-26,0],[0,-26,50],[10,-25,80]],width:8};
 const target={x:2.5,y:-26,z:25,heading:0},p=m.constrainTunnelCamera({x:5.15,y:-23,z:18},target,8,5.8,road);
 const nearest=new m.SurfaceProvider([road]).nearest(p.x,p.z);assert.ok(nearest.distance<=3.2,'camera crossed the bore wall: '+nearest.distance);
});

test('road surface triangles face upward for either travel direction',async()=>{const m=await import('../js/road-geometry.js').catch(()=>({}));assert.equal(typeof m.buildStrip,'function','road geometry not implemented');for(const ps of [[[0,2,0],[0,2,10]],[[0,2,10],[0,2,0]]]){const g=m.buildStrip(ps,8);assert.ok(g.attributes.normal.getY(0)>.9);}});

// A citywide manifest has tens of thousands of cells; per-frame readiness stays local.
test('citywide readiness and prefetch do not scan the complete tile catalog',async()=>{
 const {TileLoader}=await load();let reads=0;
 const tiles=Array.from({length:20000},(_,i)=>{const x=(i%200)*1000,z=Math.floor(i/200)*1000,b=[x,z,x+1000,z+1000];return {id:String(i),get bounds(){reads++;return b;}};});
 const l=new TileLoader({tileSizeM:1000,bounds:[0,0,200000,100000],tiles},async()=>({buildings:[]}),()=>({dispose(){}}));
 await l.ensureAt({x:500,z:500},'car');reads=0;for(let i=0;i<60;i++)assert.equal(l.readyAt({x:500,z:500}),true);
 assert.ok(reads<1000,'frame readiness inspected '+reads+' remote tiles');
 reads=0;await l.update({x:500,z:500},'car');assert.ok(reads<200,'prefetch inspected '+reads+' remote tiles');l.dispose();
});

test('streamed road and water surfaces enter and leave with their owning tile',async()=>{
 const {SurfaceProvider}=await load();const s=new SurfaceProvider();assert.equal(typeof s.setTileRoads,'function');
 const meta={id:'remote',bounds:[30000,0,31000,1000]},road={id:'remote-road',points:[[30500,2.12,20],[30500,2.12,200]],width:10};
 s.setTileRoads(meta,[road]);s.setTileWater(meta,[[[[30000,0],[30100,0],[30100,1000],[30000,1000]]]]);
 assert.equal(s.nearest(30501,100).road.id,'remote-road');assert.equal(s.sample({x:30501,z:100,y:2.12,mode:'car'}).height,2.12);assert.ok(s.isWater(30050,50));
 s.removeTileRoads(meta.id);s.removeTileWater(meta.id);assert.equal(s.nearest(30501,100),null);assert.equal(s.isWater(30050,50),false);
});
test('walking and cycling follow a raised bridge while staying above a separate tunnel',async()=>{
 const {SurfaceProvider}=await load();const s=new SurfaceProvider([{id:'bridge',width:12,bridge:true,points:[[0,2.12,0],[0,12,100]]},{id:'under',width:10,tunnel:true,points:[[0,-20,0],[0,-20,100]]}]);
 for(const mode of ['person','cyclist'])assert.equal(s.sample({x:0,z:50,y:7,mode,surfaceId:'bridge'}).height,7.06);
 assert.equal(s.sample({x:0,z:50,y:-20,mode:'car',surfaceId:'under'}).height,-20);
});

test('municipal mask blocks unmodelled neighbouring provinces without blocking island water',async()=>{
 const {TileLoader}=await load();const boundary=[[[[0,0],[1000,0],[1000,1000],[0,1000]]]];
 const l=new TileLoader({bounds:[0,0,2000,2000],playableBoundary:boundary,tiles:[{id:'a',bounds:[0,0,1000,1000]},{id:'b',bounds:[1000,0,2000,1000]}]},async()=>({}),()=>({dispose(){}}));
 await l.ensureAt({x:500,z:500},'helicopter');assert.equal(l.readyAt({x:500,z:500}),true);
 await assert.rejects(l.ensureAt({x:1500,z:500},'car'),/outside/);assert.equal(l.readyAt({x:1500,z:500}),false);
});

test('car arrivals exclude walking-only paths while pedestrians can use them',async()=>{
 const {SurfaceProvider}=await load();const s=new SurfaceProvider([{id:'walk',mode:'person',width:5,points:[[0,2.12,0],[0,2.12,100]]},{id:'drive',mode:'car',width:10,points:[[20,2.12,0],[20,2.12,100]]}]);
 assert.ok(s.landingCandidates(0,50,'car').every(p=>p.road.id==='drive'));
 assert.equal(s.landingCandidates(0,50,'person')[0].road.id,'walk');
});

test('non-car modes stop before open tunnel ramps without blocking an upper street over a deep bore',async()=>{
 const {SurfaceProvider}=await load();const s=new SurfaceProvider([{id:'bore',width:10,tunnel:true,points:[[0,2.12,0],[0,-2,100],[0,-26,300]]}]);
 assert.equal(typeof s.canTraverse,'function');
 for(const mode of ['person','cyclist']){assert.equal(s.canTraverse({x:0,z:25,y:2.12,mode}),false);assert.equal(s.canTraverse({x:0,z:250,y:2.12,mode}),true);assert.equal(s.canTraverse({x:8,z:25,y:2.12,mode}),true);assert.equal(s.canTraverse({x:0,z:25,y:10,mode}),true);}
 assert.equal(s.canTraverse({x:0,z:25,y:2.12,mode:'car'}),true);assert.equal(s.canTraverse({x:0,z:25,y:90,mode:'helicopter'}),true);
});
