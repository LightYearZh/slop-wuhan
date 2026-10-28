await page.waitForFunction(()=>window.shanghai?.ready);
const result=await page.evaluate(async()=>{
 const checks=[];
 for(const l of shanghai.data.landmarks){
  await shanghai.gotoLandmark(l.id);const e=shanghai.controllers.getActiveEntity(),p=e.position.clone();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  checks.push({id:l.id,shift:e.position.distanceTo(p),distance:Math.hypot(e.position.x-l.x,e.position.z-l.z),ready:shanghai.loader.readyAt(e.position)});
 }
 return checks;
});
for(const check of result){expect(check.shift,check.id+' safe arrival').toBeLessThan(.3);expect(check.distance).toBeLessThan(350);expect(check.ready).toBe(true);}
const fs=await import('node:fs/promises');await fs.writeFile('/Users/wuyanji/Desktop/上海漫游/docs/acceptance/landings.json',JSON.stringify(result,null,2));return result;
