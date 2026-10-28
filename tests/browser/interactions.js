await page.waitForFunction(()=>window.shanghai?.ready);
await page.evaluate(()=>{shanghai.controllers.clearGamepadInput();document.getElementById('map-modal').hidden=true;document.getElementById('search').value='';});
await page.getByRole('button',{name:'▱ 地图 M',exact:true}).click();
await expect(page.getByLabel('搜索地标',{exact:true})).toBeFocused();
const before=await page.evaluate(()=>({...shanghai.controllers.getActiveEntity().position,mode:shanghai.controllers.activeMode}));
await page.getByLabel('搜索地标',{exact:true}).pressSequentially('wasd1234',{delay:40});
const after=await page.evaluate(()=>({position:shanghai.controllers.getActiveEntity().position.clone(),mode:shanghai.controllers.activeMode}));
expect(Math.hypot(after.position.x-before.x,after.position.z-before.z)).toBeLessThan(.1);expect(after.mode).toBe(before.mode);
await page.getByLabel('搜索地标',{exact:true}).fill('东方明珠');
await expect(page.locator('#search-results button')).toHaveCount(1);
await page.locator('#search-results button').click();
await expect(page.locator('#map-modal')).toBeHidden();
const places=[];
for(const id of ['pearl','tower','swfc','jinmao','conference','customs','hsbc','peace']){
 const result=await page.evaluate(async id=>{await shanghai.gotoLandmark(id);const e=shanghai.controllers.getActiveEntity(),l=shanghai.data.landmarks.find(l=>l.id===id);return {id,distance:Math.hypot(e.position.x-l.x,e.position.z-l.z),ready:shanghai.loader.readyAt(e.position),finite:[e.position.x,e.position.y,e.position.z].every(Number.isFinite)};},id);
 expect(result.distance).toBeLessThan(300);expect(result.ready).toBe(true);expect(result.finite).toBe(true);places.push(result);
}
const modes=[];
for(const [label,mode]of [['♙ 步行 1','person'],['♧ 骑行 3','cyclist'],['⌘ 飞行 4','helicopter'],['▰ 驾驶 2','car']]){
 await page.getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(m=>shanghai.controllers.activeMode===m,mode);modes.push(mode);
}
const cameras=[];for(let i=0;i<3;i++){await page.locator('#camera-button').click();cameras.push(await page.locator('#camera-label').textContent());}
const times=[];for(const [label,id]of [['☀ 白天','midday'],['☾ 夜间','midnight'],['◒ 黄昏','golden']]){await page.getByRole('button',{name:label,exact:true}).click();times.push({id,active:await page.locator(`[data-time="${id}"]`).evaluate(e=>e.classList.contains('active'))});}
expect(times.every(t=>t.active)).toBe(true);
const result={typingDidNotDrive:true,places,modes,cameras,times,errors:await page.evaluate(()=>shanghai.errors)};expect(result.errors).toEqual([]);
const fs=await import('node:fs/promises');await fs.mkdir('/Users/wuyanji/Desktop/上海漫游/docs/acceptance',{recursive:true});await fs.writeFile('/Users/wuyanji/Desktop/上海漫游/docs/acceptance/interactions.json',JSON.stringify(result,null,2));return result;
