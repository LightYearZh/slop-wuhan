await page.waitForFunction(()=>window.shanghai?.ready);
const results=await page.evaluate(async()=>{
 const app=shanghai,original=app.loader.ensureAt.bind(app.loader),out=[];
 let calls=0;
 app.loader.ensureAt=async(...args)=>{if(calls++===0)await new Promise(r=>setTimeout(r,200));return original(...args);};
 try{
  const target=app.surface.nearest(600,150,r=>!r.tunnel);
  await Promise.all([app.teleport(-900,-150),app.teleport(600,150)]);
  const e=app.controllers.getActiveEntity();out.push({name:'latest-arrival-wins',distance:Math.hypot(e.position.x-target.x,e.position.z-target.z)});
 }finally{app.loader.ensureAt=original;}
 const before={mode:app.controllers.activeMode,position:app.controllers.getActiveEntity().position.clone()};
 app.loader.ensureAt=async()=>{throw Error('验收注入：请求失败');};
 try{
  const result=await app.setMode('person');const e=app.controllers.getActiveEntity();
  out.push({name:'failed-mode-keeps-safe-location',result,unchanged:app.controllers.activeMode===before.mode&&e.position.distanceTo(before.position)<.2});
 }finally{app.loader.ensureAt=original;}
 let resolve;app.loader.ensureAt=()=>new Promise(r=>resolve=r);
 try{
  const pending=app.setMode('helicopter');out.push({name:'mode-waits-for-ready',mode:app.controllers.activeMode,expected:before.mode});resolve();await pending;
 }finally{app.loader.ensureAt=original;}
 await app.setMode('car');
 return out;
});
expect(results[0].distance).toBeLessThan(25);
expect(results[1].result).toBe(false);expect(results[1].unchanged).toBe(true);
expect(results[2].mode).toBe(results[2].expected);
const fs=await import('node:fs/promises');await fs.writeFile('/Users/wuyanji/Desktop/上海漫游/docs/acceptance/arrival-regressions.json',JSON.stringify(results,null,2));return results;
