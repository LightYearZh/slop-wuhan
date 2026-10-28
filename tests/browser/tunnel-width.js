// Targeted 0.1.1 regression: widened vehicle envelope and follow-camera walls.
await page.waitForFunction(()=>window.shanghai?.ready);
const result=await page.evaluate(async()=>{
 const app=shanghai;await app.setMode('car');app.controllers.resetInput();app.follow();
 const rows=[];
 for(const t of app.data.tunnels){
  await app.loader.ensureRoute(t.id);
  const i=Math.floor(t.points.length/2),a=t.points[i],b=t.points[i+1],roadAngle=Math.atan2(b[0]-a[0],b[2]-a[2]),nx=Math.cos(roadAngle),nz=-Math.sin(roadAngle),e=app.controllers.entities.car;
  for(const side of [-1,1])for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI*.72]){
   e.position.set(a[0]+nx*side*4.3,a[1],a[2]+nz*side*4.3);e.heading=roadAngle+angle;e.speed=e.vx=e.vz=e.angularVel=0;e.surfaceId=t.id;e.surface=app.surface.sample({x:e.position.x,y:e.position.y,z:e.position.z,mode:'car',surfaceId:t.id});
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const p=app.surface.nearest(e.position.x,e.position.z,r=>r.id===t.id),relative=e.heading-Math.atan2(p.b[0]-p.a[0],p.b[2]-p.a[2]),extent=Math.abs(Math.sin(relative))*2.28+Math.abs(Math.cos(relative))*1.07,camera=app.cameras.camera.position,cp=app.surface.nearest(camera.x,camera.z,r=>r.id===t.id);
   rows.push({route:t.id,width:t.width,side,angle,centreDistance:p.distance,outerBoundary:p.distance+extent,cameraDistance:cp.distance,cameraCeilingClearance:cp.height+5.8-camera.y});
  }
 }
 return {at:new Date().toISOString(),buildAsset:performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/index-.*\.js$/.test(n))?.split('/').at(-1),rows,errors:app.errors.slice()};
});
for(const r of result.rows){
 expect(r.width).toBe(10);expect(r.outerBoundary).toBeLessThanOrEqual(r.width/2-.11);
 expect(r.cameraDistance).toBeLessThanOrEqual(r.width/2-.79);expect(r.cameraCeilingClearance).toBeGreaterThanOrEqual(.69);
 if(r.angle===0)expect(r.centreDistance).toBeGreaterThan(3.4);
}
expect(result.errors).toEqual([]);
const fs=await import('node:fs/promises');await fs.mkdir('/Users/wuyanji/Desktop/上海漫游/docs/acceptance/0.1.1',{recursive:true});await fs.writeFile('/Users/wuyanji/Desktop/上海漫游/docs/acceptance/0.1.1/tunnel-width.json',JSON.stringify(result,null,2));return result;
