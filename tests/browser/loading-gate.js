await page.waitForFunction(()=>window.shanghai?.ready);
await page.evaluate(async()=>{
 await shanghai.setMode('car');const app=shanghai;window.gateProbe={before:app.controllers.getActiveEntity().position.clone(),readyAt:app.loader.readyAt.bind(app.loader),ensureAt:app.loader.ensureAt.bind(app.loader)};
 app.loader.readyAt=()=>false;app.loader.ensureAt=async()=>{throw Error('验收注入：前方请求失败');};app.controllers.setGamepadInput('forward',1);
});
await expect(page.locator('#toast')).toContainText('前方街区未就绪');
const result=await page.evaluate(()=>{
 const app=shanghai,e=app.controllers.getActiveEntity(),shift=e.position.distanceTo(gateProbe.before);app.controllers.clearGamepadInput();app.loader.readyAt=gateProbe.readyAt;app.loader.ensureAt=gateProbe.ensureAt;return {shift,errors:app.errors,ready:app.loader.readyAt(e.position)};
});
expect(result.shift).toBeLessThan(.01);expect(result.ready).toBe(true);expect(result.errors).toEqual([]);
const fs=await import('node:fs/promises');await fs.writeFile((globalThis.evidenceRoot||'/Users/wuyanji/Desktop/上海漫游/docs/acceptance')+'/loading-gate.json',JSON.stringify(result,null,2));return result;
