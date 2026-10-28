await page.waitForFunction(()=>window.shanghai?.ready);
const results=await page.evaluate(async()=>{
 const app=shanghai,items=[...app.data.landmarks,...app.data.places],out=[];await app.setMode('car');
 for(const p of items){await app.gotoLandmark(p.id);const e=app.controllers.getActiveEntity();out.push({id:p.id,name:p.name,distance:Math.hypot(e.position.x-p.x,e.position.z-p.z),ready:app.loader.readyAt(e.position),water:app.surface.isWater(e.position.x,e.position.z),height:e.position.y,position:{x:e.position.x,y:e.position.y,z:e.position.z}});}
 const original=app.loader.ensureAt.bind(app.loader);let calls=0;app.loader.ensureAt=async(...args)=>{if(calls++===0)await new Promise(r=>setTimeout(r,250));return original(...args);};
 let race;
 try{const first=app.gotoLandmark('jingan');await app.gotoLandmark('yuanshen');const chosen=app.controllers.getActiveEntity().position.clone();await first;race=app.controllers.getActiveEntity().position.distanceTo(chosen);}finally{app.loader.ensureAt=original;}
 return {at:new Date().toISOString(),region:app.data.region,landmarks:app.data.landmarks.length,places:app.data.places.length,buildAsset:performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/index-.*\.js$/.test(n))?.split('/').at(-1),arrivals:out,latestArrivalDrift:race,errors:app.errors.slice()};
});
expect(results.landmarks).toBe(12);expect(results.places).toBe(7);expect(results.latestArrivalDrift).toBeLessThan(.1);
for(const r of results.arrivals){expect(r.ready,r.name+' ready').toBe(true);expect(r.water,r.name+' dry landing').toBe(false);expect(r.distance,r.name+' nearby road').toBeLessThan(350);}
expect(results.errors).toEqual([]);
await page.locator('#map-button').click();await page.locator('#search').fill('静安寺');await expect(page.locator('#search-results button')).toHaveCount(1);await expect(page.locator('#search-results')).toContainText('静安');
const before=await page.evaluate(()=>({mode:shanghai.controllers.activeMode,position:shanghai.controllers.getActiveEntity().position.toArray()}));await page.locator('#search').fill('wasd1234');await page.locator('#search').press('ArrowUp');const after=await page.evaluate(()=>({mode:shanghai.controllers.activeMode,position:shanghai.controllers.getActiveEntity().position.toArray()}));expect(after.mode).toBe(before.mode);expect(after.position).toEqual(before.position);
await page.locator('#search').fill('新天地');await expect(page.locator('#search-results button')).toHaveCount(1);await page.locator('#search-results button').click();await page.waitForFunction(()=>document.getElementById('map-modal').hidden);
const map=await page.evaluate(()=>({paths:document.querySelectorAll('#full-svg > path').length,places:document.querySelectorAll('#full-svg .map-landmark').length,viewBox:document.querySelector('#full-svg').getAttribute('viewBox')}));expect(map.paths).toBeLessThan(20);expect(map.places).toBe(19);results.map=map;results.keyboard={before,after};
await evidenceFs.writeFile(evidenceRoot+'/expansion-interactions.json',JSON.stringify(results,null,2));return {arrivals:results.arrivals.length,latestArrivalDrift:results.latestArrivalDrift,map,errors:results.errors};
