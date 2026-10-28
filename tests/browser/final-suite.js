// Re-run the entire long-duration acceptance on the frozen release build.
const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const program=async file=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+file,'utf8'))(page,context,expect);
const previous=globalThis.resumeFinalSuite?JSON.parse(await fs.readFile(evidenceRoot+'/suite-progress-final.json','utf8')):null,completed=previous?.results||[];
globalThis.acceptanceSuite={startedAt:new Date().toISOString(),continuingFrom:previous?.startedAt,build:JSON.parse(await fs.readFile(evidenceRoot+'/builds/final.json','utf8')),phase:'starting',results:completed,error:null,done:false};
const pause=()=>new Promise(resolve=>setTimeout(resolve,1000)),save=()=>fs.writeFile(evidenceRoot+'/suite-progress-final.json',JSON.stringify(acceptanceSuite,null,2));
globalThis.suitePromise=(async()=>{try{
 await page.evaluate(()=>{document.body.classList.remove('clean');shanghai.controllers.clearGamepadInput();shanghai.follow();});
 if(!globalThis.preserveStability)await program('stability-start.js');
 for(const [direction,time]of [['east','midday'],['west','midday'],['east','midnight'],['west','midnight'],['east','golden'],['west','golden']].filter(([direction,time])=>!completed.some(r=>r.label===direction+'-'+time+'-release'))){
  const config={direction,time,label:direction+'-'+time+'-release',record:true};acceptanceSuite.phase=config.label;await save();await page.evaluate(c=>window.nextDrive=c,config);await program('drive.js');
  while(!await page.evaluate(()=>driveRun.done))await pause();
  const result=await program('save-drive.js');acceptanceSuite.results.push(result);await save();
 }
 acceptanceSuite.phase='car-performance-release';await save();await page.evaluate(()=>window.nextDrive={direction:'east',time:'midnight',label:'car-performance-release',cruise:7,record:false});await program('drive.js');
 while(!await page.evaluate(()=>driveRun.done))await pause();
 acceptanceSuite.results.push(await program('save-drive.js'));
 const car=JSON.parse(await fs.readFile(evidenceRoot+'/drives/car-performance-release.json','utf8')),all=car.frameTimes;let count=0,warmup=0;while(count<all.length&&warmup<10000)warmup+=all[count++];
 car.warmupExcluded={frames:count,ms:warmup,method:'First ten seconds of the continuous physical drive. Untrimmed data: drives/car-performance-release.json'};car.frameTimes=all.slice(count);car.sampleDuration=car.frameTimes.reduce((s,n)=>s+n,0);const sorted=car.frameTimes.slice().sort((a,b)=>a-b);Object.assign(car.metrics,{frames:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)]});
 expect(car.sampleDuration).toBeGreaterThanOrEqual(300000);expect(car.metrics.p95).toBeLessThanOrEqual(33.3);await fs.writeFile(evidenceRoot+'/car-performance.json',JSON.stringify(car,null,2));await save();
 for(const mode of ['person','cyclist','helicopter']){
  const config={mode,label:'mode-'+mode+'-release',record:true};acceptanceSuite.phase=config.label;await save();await page.evaluate(c=>window.nextMode=c,config);await program('mode.js');
  while(!await page.evaluate(()=>modeRun.done))await pause();
  const run=await page.evaluate(()=>({...modeRun,lastPosition:undefined}));expect(run.errors).toEqual([]);expect(run.sampleDuration).toBeGreaterThanOrEqual(300000);expect(run.distance).toBeGreaterThan(200);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);expect(run.metrics.errors).toEqual([]);
  if(recording)await endRecording();await fs.writeFile(evidenceRoot+'/modes/'+mode+'.json',JSON.stringify(run,null,2));await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.1,null,{timeout:15000});
  acceptanceSuite.results.push({mode,duration:run.duration,sampleDuration:run.sampleDuration,distance:run.distance,p95:run.metrics.p95,frames:run.metrics.frames,buildAsset:run.buildAsset,stopped:true});await save();
 }
 await program('export-stability.js');acceptanceSuite.phase='complete';acceptanceSuite.done=true;
 }catch(error){acceptanceSuite.error=String(error.stack||error);acceptanceSuite.phase='failed';try{await page.evaluate(()=>{shanghai.controllers.clearGamepadInput();if(window.modeTimer)clearInterval(modeTimer);if(window.driveRun?.timer)clearInterval(driveRun.timer);});if(recording)await endRecording();}catch{}}
 await save();
})();return {started:true,phase:acceptanceSuite.phase};
