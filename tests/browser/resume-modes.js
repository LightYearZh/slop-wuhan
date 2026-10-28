const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
await fs.writeFile(evidenceRoot+'/technical-trial/suite-boundary-failure.json',JSON.stringify(acceptanceSuite,null,2));
const program=async file=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+file,'utf8'))(page,context,expect);
acceptanceSuite.error=null;acceptanceSuite.resumedAfter='sampling clock boundary corrected; walking continuous frames recovered from ring overlap';
globalThis.suitePromise=(async()=>{try{
 for(const mode of ['cyclist','helicopter']){
  const config={mode,label:'mode-'+mode,record:true};acceptanceSuite.phase=config.label;await page.evaluate(c=>window.nextMode=c,config);await program('mode.js');
  while(!await page.evaluate(()=>modeRun.done))await new Promise(r=>setTimeout(r,1000));
  const run=await page.evaluate(()=>({...modeRun,lastPosition:undefined}));expect(run.errors).toEqual([]);expect(run.sampleDuration).toBeGreaterThanOrEqual(300000);expect(run.distance).toBeGreaterThan(200);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);expect(run.metrics.errors).toEqual([]);
  if(recording)await endRecording();await fs.writeFile(evidenceRoot+'/modes/'+mode+'.json',JSON.stringify(run,null,2));await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.1,null,{timeout:15000});
  acceptanceSuite.results.push({mode,duration:run.duration,distance:run.distance,p95:run.metrics.p95,frames:run.metrics.frames,stopped:true});await fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
 }
 acceptanceSuite.phase='complete';acceptanceSuite.done=true;
 }catch(error){acceptanceSuite.error=String(error.stack||error);acceptanceSuite.phase='failed';try{await page.evaluate(()=>{shanghai.controllers.clearGamepadInput();if(window.modeTimer)clearInterval(modeTimer);});if(recording)await endRecording();}catch{}}
 await fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
})();return {resumed:true,phase:acceptanceSuite.phase};
