await page.waitForFunction(()=>window.shanghai?.ready);
const result=await page.evaluate(async()=>{
 const app=shanghai,t=app.data.tunnels[0],p=t.points[Math.floor(t.points.length*.5)],e=app.controllers.entities.car;
 app.controllers.setMode('car');e.position.set(...p);e.heading=0;e.speed=0;e.surfaceId=t.id;e.surface=app.surface.sample({x:p[0],y:p[1],z:p[2],mode:'car',surfaceId:t.id});
 const same=await app.setMode('car'),afterSame={x:e.position.x,y:e.position.y,z:e.position.z};
 const blocked=await app.setMode('person');
 const original=app.loader.ensureRoute.bind(app.loader);app.loader.ensureRoute=async()=>{throw Error('验收注入：隧道预载失败');};
 window.failureBefore=e.position.clone();window.restoreRoute=()=>app.loader.ensureRoute=original;
 return {same,afterSame,blocked,mode:app.controllers.activeMode};
});
expect(result.afterSame.y).toBeLessThan(-20);expect(result.same).toBe(true);expect(result.blocked).toBe(false);expect(result.mode).toBe('car');
await page.locator('#places-button').click();await page.getByRole('button',{name:'驾车过江 · 浦西入口',exact:true}).click();
await expect(page.locator('#toast')).toContainText('跨江线路未就绪');
const failure=await page.evaluate(()=>{const e=shanghai.controllers.getActiveEntity();const unchanged=e.position.distanceTo(failureBefore)<.2;restoreRoute();return {unchanged,errors:shanghai.errors};});
expect(failure.unchanged).toBe(true);expect(failure.errors).toEqual([]);
await page.locator('#places-button').click();await page.evaluate(async()=>{await shanghai.teleport(-900,-200);shanghai.follow();});
const fs=await import('node:fs/promises');await fs.writeFile('/Users/wuyanji/Desktop/上海漫游/docs/acceptance/underground-regressions.json',JSON.stringify({result,failure},null,2));return {result,failure};
