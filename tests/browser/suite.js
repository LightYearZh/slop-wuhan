// The persistent Tabbit Node runtime runs this bounded state machine in the
// background. All movement uses the application's actual analog controls.
const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
globalThis.acceptanceSuite={startedAt:new Date().toISOString(),phase:'starting',results:[],error:null,done:false};
const program=async file=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+file,'utf8'))(page,context,expect);
const pause=()=>new Promise(r=>setTimeout(r,1000));
globalThis.suitePromise=(async()=>{try{
 await program('stability-start.js');
 for(const config of [
  {direction:'east',time:'midday',label:'east-1-midday',record:true},
  {direction:'west',time:'midday',label:'west-1-midday',record:true},
  {direction:'east',time:'midnight',label:'east-2-midnight',cruise:7,record:true},
  {direction:'west',time:'midnight',label:'west-2-midnight',record:true},
  {direction:'east',time:'golden',label:'east-3-golden',record:true},
  {direction:'west',time:'golden',label:'west-3-golden',record:true}
 ]){
  acceptanceSuite.phase=config.label;await page.evaluate(c=>window.nextDrive=c,config);await program('drive.js');
  while(!await page.evaluate(()=>driveRun.done))await pause();
  const result=await program('save-drive.js');acceptanceSuite.results.push(result);await fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
 }
 for(const mode of ['person','cyclist','helicopter']){
  const config={mode,label:'mode-'+mode,record:true};acceptanceSuite.phase=config.label;await page.evaluate(c=>window.nextMode=c,config);await program('mode.js');
  while(!await page.evaluate(()=>modeRun.done))await pause();
  const run=await page.evaluate(()=>({...modeRun,lastPosition:undefined}));expect(run.errors).toEqual([]);expect(run.sampleDuration).toBeGreaterThanOrEqual(300000);expect(run.distance).toBeGreaterThan(200);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);expect(run.metrics.errors).toEqual([]);
  if(recording)await endRecording();await fs.mkdir(evidenceRoot+'/modes',{recursive:true});await fs.writeFile(evidenceRoot+'/modes/'+mode+'.json',JSON.stringify(run,null,2));
  await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.1,null,{timeout:15000});
  acceptanceSuite.results.push({mode,duration:run.duration,distance:run.distance,p95:run.metrics.p95,frames:run.metrics.frames,stopped:true});await fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
 }
 acceptanceSuite.phase='complete';acceptanceSuite.done=true;
 }catch(error){acceptanceSuite.error=String(error.stack||error);acceptanceSuite.phase='failed';try{await page.evaluate(()=>{shanghai.controllers.clearGamepadInput();if(window.modeTimer)clearInterval(modeTimer);if(window.driveRun?.timer)clearInterval(driveRun.timer);});if(recording)await endRecording();}catch{} }
 await fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
})();
return {started:true,...acceptanceSuite};
