// Attach after the running suite, keeping all evidence under the version directory.
const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const program=async file=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+file,'utf8'))(page,context,expect);
const pause=()=>new Promise(resolve=>setTimeout(resolve,1000)),save=()=>fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
globalThis.postPromise=suitePromise.then(async()=>{if(acceptanceSuite.error)return;try{
 acceptanceSuite.done=false;acceptanceSuite.phase='b-person-clean-retest';await save();
 await page.evaluate(()=>window.nextMode={mode:'person',label:'b-person-clean',road:'南京西路',record:false});await program('mode.js');
 while(!await page.evaluate(()=>modeRun.done))await pause();
 const run=await page.evaluate(()=>({...modeRun,lastPosition:undefined}));await fs.writeFile(evidenceRoot+'/modes/person.json',JSON.stringify(run,null,2));
 expect(run.errors).toEqual([]);expect(run.sampleDuration).toBeGreaterThanOrEqual(300000);expect(run.distance).toBeGreaterThan(600);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);expect(run.metrics.errors).toEqual([]);
 acceptanceSuite.results=acceptanceSuite.results.filter(r=>r.mode!=='person');acceptanceSuite.results.push({mode:'person',duration:run.duration,sampleDuration:run.sampleDuration,distance:run.distance,p95:run.metrics.p95,frames:run.metrics.frames,buildAsset:run.buildAsset,retest:'Earlier clip interrupted by a destination click; archived separately'});
 for(const id of ['person','car','cyclist','helicopter']){const r=JSON.parse(await fs.readFile(evidenceRoot+'/modes/'+id+'.json'));for(let i=1;i<r.trace.length;i++){const a=r.trace[i-1],b=r.trace[i];expect(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),'continuous '+id).toBeLessThan(30);}}
 await program('export-stability.js');acceptanceSuite.done=true;acceptanceSuite.phase='resource-roundtrips';await save();
 await page.evaluate(()=>window.lifecycleTargets=['jingan','yuanshen']);await program('lifecycle.js');
 acceptanceSuite.phase='fixed-view-evidence';await save();await program('screenshots.js');await program('new-landmark-screenshots.js');
 acceptanceSuite.phase='functional-video';await save();await page.evaluate(()=>shanghai.follow());await program('operation-proof.js');await operationProofPromise;if(operationProofStatus.error)throw Error(operationProofStatus.error);
 acceptanceSuite.phase='network-audit';await save();await program('network-export.js');
 acceptanceSuite.phase='complete';acceptanceSuite.done=true;
 }catch(error){acceptanceSuite.done=false;acceptanceSuite.error=String(error.stack||error);acceptanceSuite.phase='failed';try{await page.evaluate(()=>{clearInterval(window.modeTimer);shanghai.controllers.clearGamepadInput();});if(recording)await endRecording();}catch{}}
 await save();
});return {attached:true,phase:acceptanceSuite.phase};
