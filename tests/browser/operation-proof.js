if(!acceptanceSuite.done||acceptanceSuite.error)throw Error('Finish formal performance before recording functional proof');
const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const program=async file=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+file,'utf8'))(page,context,expect);
globalThis.operationProofStatus={done:false,phase:'starting',steps:[],error:null};
globalThis.operationProofPromise=(async()=>{try{
 const root=evidenceRoot;await program('recording.js');globalThis.evidenceRoot=root;let started;
 for(const [index,mode]of ['person','car','cyclist','helicopter'].entries()){
  operationProofStatus.phase=mode;const destinations=['zhujiajiao','minhang','baoshan','dishui'];await page.evaluate(c=>window.nextMode=c,{mode,destination:globalThis.proofCitywide?destinations[index]:undefined,label:'functional-'+mode,record:false,altitude:350,altitudeAmplitude:15});await program(globalThis.proofCitywide?'citywide-mode.js':'mode.js');
  await page.evaluate(time=>shanghai.setTime(time),['midday','golden','midnight','midday'][index]);
  if(!recording){await beginRecording('four-modes-release');started=Date.now();}
  const begin=(Date.now()-started)/1000;await new Promise(r=>setTimeout(r,22000));
  await page.evaluate(()=>{clearInterval(modeTimer);shanghai.controllers.clearGamepadInput();modeRun.done=true;});
  await page.waitForFunction(()=>{const e=shanghai.controllers.getActiveEntity();return Math.abs(e.speed)<.1&&Math.abs(e.verticalSpeed||0)<.1;},null,{timeout:15000});
  const state=await page.evaluate(()=>({mode:shanghai.controllers.activeMode,speed:shanghai.controllers.getActiveEntity().speed,camera:shanghai.cameras.activePresetId,cameraChanges:modeRun.previewChanges,errors:shanghai.errors,quality:shanghai.quality,canvas:[shanghai.renderer.domElement.width,shanghai.renderer.domElement.height]}));
  expect(state.mode).toBe(mode);expect(state.cameraChanges).toBeGreaterThanOrEqual(3);expect(state.errors).toEqual([]);await new Promise(r=>setTimeout(r,2000));
  operationProofStatus.steps.push({mode,beginSeconds:begin,endSeconds:(Date.now()-started)/1000,stopped:true,...state});
 }
 operationProofStatus.recording=await endRecording();operationProofStatus.done=true;operationProofStatus.phase='complete';
 }catch(error){operationProofStatus.error=String(error.stack||error);operationProofStatus.phase='failed';try{await page.evaluate(()=>{clearInterval(modeTimer);shanghai.controllers.clearGamepadInput();});if(recording)await endRecording();}catch{}}
 await fs.writeFile(evidenceRoot+'/four-modes-operation.json',JSON.stringify(operationProofStatus,null,2));
})();return {started:true};
