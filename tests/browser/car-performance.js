// Run only after the mode suite, without Page.screencast.
if(!acceptanceSuite.done||acceptanceSuite.error)throw Error('Finish modes first');
if(recording)await endRecording();
await evidenceCDP.send('Page.stopScreencast');
const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
await page.evaluate(()=>window.nextDrive={direction:'east',time:'midnight',label:'car-performance-no-recording',cruise:7,record:false});
const runProgram=async name=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+name,'utf8'))(page,context,expect);
await runProgram('drive.js');
globalThis.carPerformancePromise=(async()=>{try{
 while(!await page.evaluate(()=>driveRun.done))await new Promise(r=>setTimeout(r,1000));
 const summary=await runProgram('save-drive.js'),run=JSON.parse(await fs.readFile(evidenceRoot+'/drives/car-performance-no-recording.json','utf8'));
 expect(run.duration).toBeGreaterThanOrEqual(300000);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);await fs.writeFile(evidenceRoot+'/car-performance.json',JSON.stringify({...run,performanceCapture:'renderer frames without Page.screencast'},null,2));globalThis.carPerformanceStatus={done:true,summary};
 }catch(error){globalThis.carPerformanceStatus={done:true,error:String(error.stack||error)};}
})();return {started:true,recording:false};
