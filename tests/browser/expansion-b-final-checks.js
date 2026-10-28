const fs=await import('node:fs/promises'),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const program=async file=>new AsyncFunction('page','context','expect',await fs.readFile('/Users/wuyanji/Desktop/上海漫游/tests/browser/'+file,'utf8'))(page,context,expect);
globalThis.finalChecksPromise=postPromise.then(async()=>{if(acceptanceSuite.error)return;try{
 acceptanceSuite.phase='expanded-region-edge-cases';await fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
 await program('expansion-b-extra.js');await program('loading-gate.js');
 const landings=await page.evaluate(async()=>{const app=shanghai,out=[];for(const l of app.data.landmarks)for(const mode of ['person','car','cyclist']){
  await app.setMode('helicopter');await app.gotoLandmark(l.id);const flightHeight=app.controllers.getActiveEntity().position.y;const changed=await app.setMode(mode),e=app.controllers.getActiveEntity(),before=e.position.clone();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  out.push({landmark:l.id,requested:mode,changed,active:app.controllers.activeMode,flightHeight,distance:Math.hypot(e.position.x-l.x,e.position.z-l.z),shift:e.position.distanceTo(before),height:e.position.y,water:app.surface.isWater(e.position.x,e.position.z),ready:app.loader.readyAt(e.position)});
 }return out;});
 await fs.writeFile(evidenceRoot+'/flying-landings.json',JSON.stringify(landings,null,2));
 expect(landings.length).toBe(36);for(const r of landings){expect(r.changed).toBe(true);expect(r.active).toBe(r.requested);expect(r.flightHeight).toBeGreaterThan(50);expect(r.height).toBeGreaterThanOrEqual(1.9);expect(r.height).toBeLessThan(2.3);expect(r.distance).toBeLessThan(350);expect(r.shift).toBeLessThan(.3);expect(r.water).toBe(false);expect(r.ready).toBe(true);}
 await page.evaluate(()=>window.acceptanceAllowUI=true);try{await program('map-keyboard.js');}finally{await page.evaluate(()=>window.acceptanceAllowUI=false);}
 await program('network-export.js');acceptanceSuite.finalChecks=true;acceptanceSuite.phase='complete';acceptanceSuite.done=true;
 }catch(error){acceptanceSuite.error=String(error.stack||error);acceptanceSuite.phase='failed';acceptanceSuite.done=false;}
 await fs.writeFile(evidenceRoot+'/suite-progress.json',JSON.stringify(acceptanceSuite,null,2));
});return {attached:true,phase:acceptanceSuite.phase};
