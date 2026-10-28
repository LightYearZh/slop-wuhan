// Formal citywide suite. No screencast or builds during frame sampling.
const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
globalThis.evidenceFs=fs;globalThis.evidenceRoot='/Users/wuyanji/Desktop/上海漫游/docs/acceptance/0.3.0';globalThis.recording=null;
const program=async file=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+file,'utf8'))(page,context,expect);
globalThis.acceptanceSuite={startedAt:new Date().toISOString(),phase:'starting',results:[],error:null,done:false};
const pause=()=>new Promise(resolve=>setTimeout(resolve,1000)),save=()=>fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
await fs.mkdir(evidenceRoot+'/modes',{recursive:true});await fs.mkdir(evidenceRoot+'/drives',{recursive:true});
globalThis.suitePromise=(async()=>{try{
 await page.evaluate(()=>{if(document.visibilityState!=='visible')throw Error('Acceptance page must be visible');document.body.classList.remove('clean');shanghai.controllers.clearGamepadInput();shanghai.follow();});
 await program('stability-start.js');
 for(const [mode,destination]of [['person','zhujiajiao'],['car','minhang'],['cyclist','baoshan'],['helicopter','dishui']]){
  const config={mode,destination,label:'citywide-'+mode,record:false,altitude:350,altitudeAmplitude:15};
  acceptanceSuite.phase=config.label;await save();await page.evaluate(c=>window.nextMode=c,config);await program('citywide-mode.js');
  while(!await page.evaluate(()=>modeRun.done))await pause();
  const run=await page.evaluate(()=>({...modeRun,lastPosition:undefined}));await fs.writeFile(evidenceRoot+'/modes/'+mode+'.json',JSON.stringify(run,null,2));
  expect(run.errors).toEqual([]);expect(run.sampleDuration).toBeGreaterThanOrEqual(300000);expect(run.distance).toBeGreaterThan(mode==='helicopter'?2500:600);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);expect(run.metrics.errors).toEqual([]);
  await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.1,null,{timeout:15000});
  acceptanceSuite.results.push({mode,destination,duration:run.duration,sampleDuration:run.sampleDuration,distance:run.distance,p95:run.metrics.p95,frames:run.metrics.frames,buildAsset:run.buildAsset,stopped:true});await save();
 }
 const savedRoot=evidenceRoot;await program('recording.js');globalThis.evidenceRoot=savedRoot;
 for(const [direction,time]of [['east','midday'],['west','midday'],['east','midnight'],['west','midnight'],['east','golden'],['west','golden']]){
  const config={direction,time,label:direction+'-'+time+'-release',record:true};acceptanceSuite.phase=config.label;await save();await page.evaluate(c=>window.nextDrive=c,config);await program('drive.js');
  while(!await page.evaluate(()=>driveRun.done))await pause();
  acceptanceSuite.results.push(await program('save-drive.js'));await save();
 }
 await program('export-stability.js');acceptanceSuite.phase='complete';acceptanceSuite.done=true;
 }catch(error){acceptanceSuite.error=String(error.stack||error);acceptanceSuite.phase='failed';try{await page.evaluate(()=>{shanghai.controllers.clearGamepadInput();if(window.modeTimer)clearInterval(modeTimer);if(window.driveRun?.timer)clearInterval(driveRun.timer);});}catch{}}
 await save();
})();return {started:true,phase:acceptanceSuite.phase};
