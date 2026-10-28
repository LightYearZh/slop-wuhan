const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
globalThis.evidenceFs=fs;globalThis.evidenceRoot='/Users/wuyanji/Desktop/上海漫游/docs/acceptance/0.3.1';
await page.waitForFunction(()=>shanghai.renderer.domElement.width===1920&&shanghai.renderer.domElement.height===1080);
globalThis.metroAcceptance={phase:'dense-metro-performance',done:false,error:null};globalThis.acceptanceSuite={phase:'dense-metro-performance',done:false,error:null};
const id=await page.evaluate(()=>shanghai.data.metroStations.find(s=>s.stationName==='人民广场').id);await page.evaluate(destination=>window.nextMode={mode:'person',destination,label:'dense-metro-person',record:false},id);
await new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/citywide-mode.js','utf8'))(page,context,expect);
globalThis.metroPerformancePromise=(async()=>{try{
 while(!await page.evaluate(()=>modeRun.done))await new Promise(r=>setTimeout(r,1000));
 const run=await page.evaluate(()=>({...modeRun,lastPosition:undefined}));await fs.writeFile(evidenceRoot+'/dense-metro-performance.json',JSON.stringify(run,null,2));
 expect(run.errors).toEqual([]);expect(run.metrics.errors).toEqual([]);expect(run.sampleDuration).toBeGreaterThanOrEqual(300000);expect(run.metrics.p95).toBeLessThanOrEqual(33.3);expect(run.distance).toBeGreaterThan(600);
 await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.1,null,{timeout:15000});metroAcceptance.result={sampleSeconds:run.sampleDuration/1000,distance:run.distance,p95:run.metrics.p95,frames:run.metrics.frames,asset:run.buildAsset};metroAcceptance.done=true;metroAcceptance.phase='performance-complete';acceptanceSuite.phase='metro-functional-checks';
 }catch(error){metroAcceptance.error=String(error.stack||error);metroAcceptance.phase='failed';acceptanceSuite.error=metroAcceptance.error;try{await page.evaluate(()=>{clearInterval(modeTimer);shanghai.controllers.clearGamepadInput();});}catch{}}
 await fs.writeFile(evidenceRoot+'/performance-status.json',JSON.stringify(metroAcceptance,null,2));
})();return {started:true,destination:id};
