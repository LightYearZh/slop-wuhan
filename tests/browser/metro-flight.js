const fs=await import('node:fs/promises');
globalThis.evidenceRoot='/Users/wuyanji/Desktop/上海漫游/docs/acceptance/0.3.1';globalThis.evidenceFs=fs;
await metroStationPromise;expect(metroStationStatus.error).toBe(null);expect(metroStationStatus.done).toBe(true);
await page.evaluate(async()=>{const a=shanghai;a.controllers.resetInput();a.controllers.clearGamepadInput();await a.setMode('helicopter');await a.gotoLandmark('tower');a.follow();a.setTime('golden');});
globalThis.flightStatus={phase:'climb-above-tower',done:false,error:null};
await page.evaluate(()=>{
 const a=shanghai;window.flightRun={startedAt:new Date().toISOString(),buildAsset:performance.getEntriesByType('resource').find(r=>/\/assets\/index-.*\.js$/.test(r.name))?.name.split('/').at(-1),start:performance.now(),trace:[],fullFrameTimes:[],collecting:false,done:false,checks:{},tower:a.data.landmarks.find(l=>l.id==='tower'),closestTower:Infinity};
 window.activeFrameRun=flightRun;if(!a.frameRecorderInstalled){a.frameRecorderInstalled=true;a.samples.push=function(...v){const r=window.activeFrameRun;if(r?.collecting&&!r.done)r.fullFrameTimes.push(...v);return Array.prototype.push.apply(this,v);};}
 window.flightTimer=setInterval(()=>{const r=flightRun,e=a.controllers.getActiveEntity(),now=performance.now(),elapsed=now-r.start;
  if(elapsed>=30000&&!r.collecting&&!r.done){r.collecting=true;r.sampleStart=now;a.samples.length=0;}
  r.closestTower=Math.min(r.closestTower,Math.hypot(e.position.x-r.tower.x,e.position.z-r.tower.z));
  if(!r.lastTrace||now-r.lastTrace>=250){r.lastTrace=now;r.trace.push({ms:elapsed,x:e.position.x,y:e.position.y,z:e.position.z,speed:e.speed,verticalSpeed:e.verticalSpeed,heading:e.heading,phase:r.phase||'ascent',camera:a.cameras.activePresetId});}
  if(r.cruise){a.controllers.setGamepadInput('left',.17);a.controllers.setGamepadInput('forward',e.speed<22?.15:0);a.controllers.setGamepadInput('backward',e.speed>25?.2:0);}
  if(r.collecting&&now-r.sampleStart>=301000){clearInterval(flightTimer);a.controllers.clearGamepadInput();r.done=true;r.sampleDuration=now-r.sampleStart;r.metrics=a.metrics();const values=r.fullFrameTimes;const sorted=values.slice().sort((a,b)=>a-b);Object.assign(r.metrics,{frames:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)]});r.frameTimes=values;delete r.fullFrameTimes;r.errors=a.errors.slice();}
 },25);
});
globalThis.flightPromise=(async()=>{try{
 await page.keyboard.down('e');await page.waitForFunction(()=>shanghai.controllers.getActiveEntity().position.y>850,null,{timeout:60000});await page.keyboard.up('e');await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().verticalSpeed)<.05);
 const climbed=await page.evaluate(()=>{const a=shanghai,e=a.controllers.getActiveEntity(),t=flightRun.tower;flightRun.phase='over-tower';flightRun.closestTower=Infinity;e.heading=Math.atan2(t.x-e.position.x,t.z-e.position.z);return e.position.y;});expect(climbed).toBeGreaterThan(850);flightStatus.phase='over-tower';
 await page.keyboard.down('w');await page.waitForFunction(()=>flightRun.closestTower<8,null,{timeout:20000});await page.keyboard.up('w');await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.1);
 const over=await page.evaluate(()=>({closest:flightRun.closestTower,height:shanghai.controllers.getActiveEntity().position.y,towerHeight:flightRun.tower.height}));expect(over.height).toBeGreaterThan(over.towerHeight+100);
 const jumps=await page.evaluate(async()=>{const a=shanghai,e=a.controllers.getActiveEntity(),before=e.position.y;await a.gotoLandmark('metro-0247');const metro=e.position.y;await a.gotoLandmark('pearl');const landmark=e.position.y;return {before,metro,landmark};});expect(jumps.metro).toBeCloseTo(jumps.before,2);expect(jumps.landmark).toBeCloseTo(jumps.before,2);
 flightStatus.phase='altitude-limit';await page.evaluate(()=>flightRun.phase='touch-limit');await page.keyboard.down('e');await page.waitForFunction(()=>{const e=shanghai.controllers.getActiveEntity();return e.position.y===1200&&e.verticalSpeed===0;},null,{timeout:30000});await page.keyboard.up('e');
 const top=await page.evaluate(()=>({height:shanghai.controllers.getActiveEntity().position.y,verticalSpeed:shanghai.controllers.getActiveEntity().verticalSpeed}));
 const downStart=Date.now();await page.keyboard.down('q');await page.waitForFunction(()=>shanghai.controllers.getActiveEntity().position.y<1180,null,{timeout:5000});await page.keyboard.up('q');const descendMs=Date.now()-downStart;expect(descendMs).toBeLessThan(4000);await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().verticalSpeed)<.05);
 await page.evaluate(checks=>{flightRun.checks=checks;flightRun.phase='high-cruise';flightRun.cruise=true;}, {climbed,over,jumps,top,descendMs});flightStatus.phase='five-minute-high-flight';
 while(!await page.evaluate(()=>flightRun.done))await new Promise(r=>setTimeout(r,1000));
 const run=await page.evaluate(()=>flightRun);await fs.writeFile(evidenceRoot+'/high-flight.json',JSON.stringify(run,null,2));expect(run.errors).toEqual([]);expect(run.metrics.errors).toEqual([]);expect(run.sampleDuration).toBeGreaterThanOrEqual(300000);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);expect(run.trace.every(p=>p.y<=1200.001)).toBe(true);
 flightStatus.done=true;flightStatus.phase='complete';flightStatus.result={checks:run.checks,sampleSeconds:run.sampleDuration/1000,p95:run.metrics.p95,frames:run.metrics.frames,asset:run.buildAsset};
 }catch(error){flightStatus.error=String(error.stack||error);flightStatus.phase='failed';try{await page.keyboard.up('e');await page.keyboard.up('q');await page.keyboard.up('w');await page.evaluate(()=>{clearInterval(flightTimer);flightRun.done=true;shanghai.controllers.resetInput();shanghai.controllers.clearGamepadInput();});}catch{}}
 await fs.writeFile(evidenceRoot+'/flight-status.json',JSON.stringify(flightStatus,null,2));
})();return {started:true};
