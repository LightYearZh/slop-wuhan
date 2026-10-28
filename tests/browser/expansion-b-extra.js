if(!acceptanceSuite.done||acceptanceSuite.error)throw Error('Complete the formal suite first');
const failed=await page.evaluate(async()=>{
 const app=shanghai;await app.setMode('car');await app.gotoLandmark('yuanshen');app.controllers.resetInput();
 const before=app.controllers.getActiveEntity().position.clone(),original=app.loader.ensureAt;
 app.loader.ensureAt=async()=>{throw Error('验收注入：新区目标请求失败');};
 try{await app.gotoLandmark('jingan');}finally{app.loader.ensureAt=original;}
 const after=app.controllers.getActiveEntity().position.clone(),failureToast=document.getElementById('toast').textContent;await app.gotoLandmark('jingan');
 const target=app.data.landmarks.find(l=>l.id==='jingan'),e=app.controllers.getActiveEntity();
 return {shift:after.distanceTo(before),failureToast,retryDistance:Math.hypot(e.position.x-target.x,e.position.z-target.z),retryReady:app.loader.readyAt(e.position),errors:app.errors.slice()};
});
expect(failed.shift).toBeLessThan(.1);expect(failed.failureToast).toContain('重试');expect(failed.retryReady).toBe(true);expect(failed.retryDistance).toBeLessThan(350);expect(failed.errors).toEqual([]);
await evidenceFs.writeFile(evidenceRoot+'/loading-failure.json',JSON.stringify(failed,null,2));
await page.evaluate(async()=>{const app=shanghai,l=app.data.landmarks.find(l=>l.id==='tianzifang');await app.setMode('person');await app.loader.ensureAt(l,'person');app.follow();app.cameras.activePresetId='pov';app.setTime('golden');const e=app.controllers.getActiveEntity();e.position.set(l.x,2,l.z-45);e.speed=0;e.heading=0;e.surfaceId='ground';e.surface=null;window.laneWalk={start:performance.now(),origin:e.position.toArray(),trace:[],timer:setInterval(()=>{const e=shanghai.controllers.getActiveEntity();laneWalk.trace.push({ms:performance.now()-laneWalk.start,x:e.position.x,y:e.position.y,z:e.position.z,speed:e.speed});},100)};});
await beginRecording('tianzifang-walk');await page.evaluate(()=>shanghai.controllers.setGamepadInput('forward',.7));await page.waitForFunction(()=>performance.now()-laneWalk.start>=20000,null,{timeout:30000});
const walk=await page.evaluate(()=>{clearInterval(laneWalk.timer);shanghai.controllers.clearGamepadInput();const e=shanghai.controllers.getActiveEntity();return {...laneWalk,timer:undefined,end:e.position.toArray(),distance:e.position.z-laneWalk.origin[2],lateralDrift:Math.abs(e.position.x-laneWalk.origin[0]),errors:shanghai.errors.slice()};});
await page.waitForFunction(()=>Math.abs(shanghai.controllers.getActiveEntity().speed)<.1,null,{timeout:10000});walk.recording=await endRecording();
await evidenceFs.writeFile(evidenceRoot+'/tianzifang-walk.json',JSON.stringify(walk,null,2));expect(walk.distance).toBeGreaterThan(50);expect(walk.lateralDrift).toBeLessThan(.5);expect(walk.errors).toEqual([]);
return {failedTarget:failed,walk:{distance:walk.distance,lateralDrift:walk.lateralDrift,frames:walk.recording.frames}};
