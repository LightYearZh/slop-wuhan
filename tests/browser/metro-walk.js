if(!flightStatus.done||flightStatus.error)throw Error('Finish flight acceptance before metro walk checks');
const fs=await import('node:fs/promises');globalThis.evidenceRoot='/Users/wuyanji/Desktop/上海漫游/docs/acceptance/0.3.1';globalThis.evidenceFs=fs;
const results=[];
for(const stationName of ['陆家嘴','上海南站','蟠祥路·国家会计学院']){
 await page.evaluate(async name=>{const a=shanghai;a.controllers.resetInput();a.controllers.clearGamepadInput();await a.setMode('person');const s=a.data.metroStations.find(s=>s.stationName===name);await a.gotoLandmark(s.id);a.follow();a.setTime('golden');window.walkRun={name,station:s,start:performance.now(),trace:[],phase:'out'};window.walkTimer=setInterval(()=>{const e=a.controllers.getActiveEntity(),en=s.entrance,dx=e.position.x-en.x,dz=e.position.z-en.z;walkRun.local={x:dx*Math.cos(en.heading)-dz*Math.sin(en.heading),z:dx*Math.sin(en.heading)+dz*Math.cos(en.heading)};walkRun.trace.push({ms:performance.now()-walkRun.start,x:e.position.x,y:e.position.y,z:e.position.z,local:{...walkRun.local},phase:walkRun.phase});},50);},stationName);
 await page.keyboard.down('s');await page.waitForFunction(()=>walkRun.local?.z>walkRun.station.entrance.depth/2+1,null,{timeout:10000});await page.keyboard.up('s');await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.05);
 const front=await page.evaluate(()=>{const s=walkRun.station,en=s.entrance;shanghai.setView({name:s.name+'入口前',position:[en.x+Math.sin(en.heading)*9,5.8,en.z+Math.cos(en.heading)*9],target:[en.x,3.8,en.z]});return {position:shanghai.controllers.getActiveEntity().position.toArray(),local:walkRun.local};});
 await page.waitForFunction(()=>Math.abs(shanghai.cameras.camera.position.y-5.8)<.01);
 const filename=await page.evaluate(()=>walkRun.station.id);const capture=await metroCDP.send('Page.captureScreenshot',{format:'png',fromSurface:true});await fs.writeFile(evidenceRoot+'/'+filename+'-entrance.png',Buffer.from(capture.data,'base64'));
 await page.evaluate(()=>{walkRun.phase='inside';shanghai.follow();});await page.keyboard.down('w');await page.waitForFunction(()=>walkRun.local.z<-walkRun.station.entrance.depth/2+.9,null,{timeout:10000});
 await page.evaluate(()=>walkRun.wallTime=performance.now());await page.waitForFunction(()=>performance.now()-walkRun.wallTime>1000);await page.keyboard.up('w');
 const result=await page.evaluate(()=>{clearInterval(walkTimer);return {...walkRun,errors:shanghai.errors.slice(),height:shanghai.controllers.getActiveEntity().position.y,toast:document.getElementById('toast').textContent};});
 expect(Math.abs(result.local.x)).toBeLessThan(.1);expect(result.local.z).toBeGreaterThan(-result.station.entrance.depth/2);expect(result.local.z).toBeLessThan(-result.station.entrance.depth/2+1);expect(Math.abs(result.height-2.12)).toBeLessThan(.02);expect(result.errors).toEqual([]);results.push({...result,front});
 if(stationName==='陆家嘴'){
  await page.evaluate(()=>{const e=walkRun.station.entrance;shanghai.setTime('midnight');shanghai.setView({name:'地铁入口夜景',position:[e.x+Math.sin(e.heading)*8,4.9,e.z+Math.cos(e.heading)*8],target:[e.x,3.7,e.z]});});
  await page.waitForFunction(()=>Math.abs(shanghai.cameras.camera.position.y-4.9)<.01);const night=await metroCDP.send('Page.captureScreenshot',{format:'png',fromSurface:true});await fs.writeFile(evidenceRoot+'/metro-night.png',Buffer.from(night.data,'base64'));
 }
}
await fs.writeFile(evidenceRoot+'/metro-walk-final.json',JSON.stringify({asset:await page.evaluate(()=>performance.getEntriesByType('resource').find(r=>/\/assets\/index-.*\.js$/.test(r.name))?.name),results,passed:true},null,2));
return results.map(r=>({name:r.name,local:r.local,height:r.height,errors:r.errors}));
