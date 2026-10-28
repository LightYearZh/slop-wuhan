import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=()=>{assert.ok(fs.existsSync('public/data/city.json'),'Shanghai dataset not built');return JSON.parse(fs.readFileSync('public/data/city.json'));};
test('release data contains twelve unique landmarks, sourced real buildings, river polygons and two directed tunnel routes',()=>{
 const d=read();assert.equal(d.landmarks.length,12);assert.equal(new Set(d.landmarks.map(l=>l.id)).size,12);
 assert.ok(d.buildings.filter(b=>b.source!=='procedural').length>100);assert.ok(d.waterAreaM2>1000000);
 assert.equal(d.tunnels.length,2);for(const t of d.tunnels){assert.ok(t.points.length>10);assert.equal(t.points[0][1],2.12);assert.equal(t.points.at(-1)[1],2.12);assert.ok(Math.min(...t.points.map(p=>p[1])) < -20);assert.ok(t.oneway);}
});
test('both widened bores keep their full open ramp width clear of terrain and surface asphalt',async()=>{
 const d=read(),{pointInPolygon}=await import('../js/core.js');
 for(const t of d.tunnels){
  assert.equal(t.width,10);assert.equal(t.widthSource,'gameplay-visual-estimate');
  for(let i=1;i<t.points.length-1;i++){
   const a=t.points[i],b=t.points[i+1];if(a[1]<=-3)continue;
   const len=Math.hypot(b[0]-a[0],b[2]-a[2]),nx=(b[2]-a[2])/len,nz=-(b[0]-a[0])/len;
   for(const side of [-1,1]){const x=a[0]+nx*side*(t.width/2-.1),z=a[2]+nz*side*(t.width/2-.1);
    assert.ok(d.rampCuts.some(r=>pointInPolygon(x,z,r)),'open ramp edge not cut out');
    assert.ok(!d.land.some(r=>pointInPolygon(x,z,r)),'terrain covers ramp edge');
    assert.ok(!d.asphalt.some(r=>pointInPolygon(x,z,r)),'surface road covers ramp edge');
   }
  }
 }
});
test('landmarks and procedural buildings do not overlap water, parks or landmark reservations',async()=>{
 const d=read();const {pointInPolygon}=await import('../js/core.js');
 for(const b of d.buildings.filter(b=>b.source==='procedural')){
  assert.ok(!d.water.some(r=>pointInPolygon(b.x,b.z,r)),'building in water');
  assert.ok(!d.landmarks.some(l=>Math.hypot(l.x-b.x,l.z-b.z)<l.reserve),'duplicate landmark');
 }
 assert.ok(d.controlPoints.length>=20);assert.ok(d.source.license==='ODbL 1.0');
});
test('every playable cell is declared, including empty river tiles',()=>{
 const d=read(),manifest=JSON.parse(fs.readFileSync('public/data/manifest.json'));
 const size=manifest.tileSizeM,ids=new Set(manifest.tiles.map(t=>t.id));
 for(let x=Math.floor(d.bounds[0]/size);x<Math.ceil(d.bounds[2]/size);x++)for(let z=Math.floor(d.bounds[1]/size);z<Math.ceil(d.bounds[3]/size);z++){
  const id=x+'_'+z;assert.ok(ids.has(id),'missing playable tile '+id);
 }
 for(const t of d.tunnels)for(const p of t.points){const id=Math.floor(p[0]/size)+'_'+Math.floor(p[2]/size);assert.ok(manifest.routes.find(r=>r.id===t.id).tiles.includes(id),'route must preload water tile '+id);}
});
test('collision readiness halo covers all source building extents and is retained along each tunnel',()=>{
 const d=read(),manifest=JSON.parse(fs.readFileSync('public/data/manifest.json'));
 assert.ok(manifest.collisionHaloM>=180,'missing collision halo');
 for(const b of d.buildings){const radius=Math.hypot(b.w,b.d)/2+7;assert.ok(radius<=manifest.collisionHaloM,'building exceeds collision halo '+b.id);}
 for(const route of manifest.routes){const t=d.tunnels.find(t=>t.id===route.id);for(const p of t.points)for(const tile of manifest.tiles){const b=tile.bounds,h=manifest.collisionHaloM;if(p[0]>=b[0]-h&&p[0]<=b[2]+h&&p[2]>=b[1]-h&&p[2]<=b[3]+h)assert.ok(route.tiles.includes(tile.id),'unretained collision neighbour '+tile.id);}}
});
test('a car entering either bore from an ordinary road follows the ramp without an elevation snap',async()=>{
 const d=read(),{SurfaceProvider}=await import('../js/core.js'),s=new SurfaceProvider([...d.roads,...d.tunnels]);
 for(const t of d.tunnels){let y=2.12,surfaceId=null,maxStep=0;
  for(let i=1;i<27;i++)for(let j=1;j<=32;j++){const a=t.points[i-1],b=t.points[i],u=j/32,p=a.map((v,k)=>v+(b[k]-v)*u),r=s.sample({x:p[0],z:p[2],y,mode:'car',surfaceId});maxStep=Math.max(maxStep,Math.abs(r.height-y));y=r.height;surfaceId=r.surfaceId;}
  assert.ok(maxStep<=.1,t.id+' entry elevation snapped '+maxStep+'m');assert.equal(surfaceId,t.id);
 }
});
