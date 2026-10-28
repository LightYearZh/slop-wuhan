// Isolate performance from the browser's prior screencast/diagnostic session.
const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const program=async file=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+file,'utf8'))(page,context,expect);
acceptanceSuite.error=null;acceptanceSuite.done=false;
globalThis.remainingPerformance=(async()=>{try{
 for(const mode of ['cyclist','helicopter']){
  acceptanceSuite.phase='fresh-performance-'+mode;await fs.writeFile(evidenceRoot+'/suite-progress-final.json',JSON.stringify(acceptanceSuite,null,2));
  if(globalThis.acceptCDP)await acceptCDP.detach();globalThis.acceptCDP=await context.newCDPSession(page);await acceptCDP.send('Emulation.setDeviceMetricsOverride',{width:1728,height:972,deviceScaleFactor:1.1111111111,mobile:false});
  await page.goto('http://127.0.0.1:4187/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.shanghai?.ready);
  await page.evaluate(mode=>window.nextMode={mode,label:'mode-'+mode+'-fresh-no-capture',record:false},mode);await program('mode.js');
  while(!await page.evaluate(()=>modeRun.done))await new Promise(r=>setTimeout(r,1000));
  const run=await page.evaluate(()=>({...modeRun,lastPosition:undefined,validationProtocol:'Fresh page; no Page.screencast; 30s warmup then 301s foreground sampling.'}));
  await fs.writeFile(evidenceRoot+'/modes/'+mode+'.json',JSON.stringify(run,null,2));
  expect(run.errors).toEqual([]);expect(run.sampleDuration).toBeGreaterThanOrEqual(300000);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);expect(run.metrics.errors).toEqual([]);expect(run.distance).toBeGreaterThan(200);
  await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.1,null,{timeout:15000});
  acceptanceSuite.results.push({mode,sampleDuration:run.sampleDuration,distance:run.distance,p95:run.metrics.p95,frames:run.metrics.frames,buildAsset:run.buildAsset,stopped:true,protocol:run.validationProtocol});await fs.writeFile(evidenceRoot+'/suite-progress-final.json',JSON.stringify(acceptanceSuite,null,2));
 }
 acceptanceSuite.phase='complete';acceptanceSuite.done=true;
 }catch(error){acceptanceSuite.phase='failed';acceptanceSuite.error=String(error.stack||error);try{await page.evaluate(()=>{shanghai.controllers.clearGamepadInput();if(window.modeTimer)clearInterval(modeTimer);});}catch{}}
 await fs.writeFile(evidenceRoot+'/suite-progress-final.json',JSON.stringify(acceptanceSuite,null,2));
})();return {started:true,phase:acceptanceSuite.phase,recording:false};
