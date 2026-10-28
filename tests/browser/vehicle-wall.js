await page.waitForFunction(()=>window.shanghai?.ready);
const results=await page.evaluate(async()=>{
 const app=shanghai,t=app.data.tunnels[0],i=Math.floor(t.points.length*.5),a=t.points[i],b=t.points[i+1],roadAngle=Math.atan2(b[0]-a[0],b[2]-a[2]),nx=Math.cos(roadAngle),nz=-Math.sin(roadAngle),e=app.controllers.entities.car,results=[];
 app.controllers.setMode('car');app.controllers.resetInput();app.follow();
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI*.72]){
  const offset=t.width/2-1.5;e.position.set(a[0]+nx*offset,a[1],a[2]+nz*offset);e.heading=roadAngle+angle;e.speed=e.vx=e.vz=e.angularVel=0;e.surfaceId=t.id;e.surface=app.surface.sample({x:e.position.x,y:e.position.y,z:e.position.z,mode:'car',surfaceId:t.id});
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const p=app.surface.nearest(e.position.x,e.position.z,r=>r.id===t.id),extent=Math.abs(Math.sin(angle))*2.28+Math.abs(Math.cos(angle))*1.07;
  results.push({angle,width:t.width,centreDistance:p.distance,extent,outerBoundary:p.distance+extent,y:e.position.y});
 }
 return results;
});
for(const r of results)expect(r.outerBoundary,'whole taxi inside the bore').toBeLessThanOrEqual(r.width/2-.11);
const fs=await import('node:fs/promises');await fs.writeFile('/Users/wuyanji/Desktop/上海漫游/docs/acceptance/vehicle-wall.json',JSON.stringify(results,null,2));return results;
