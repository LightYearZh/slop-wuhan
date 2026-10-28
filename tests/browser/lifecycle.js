if(!acceptanceSuite.done||acceptanceSuite.error)throw Error('Run after the mode suite');
const result=await page.evaluate(async()=>{
 const app=shanghai;app.controllers.clearGamepadInput();await app.setMode('car');app.follow();app.setTime('golden');
 const settle=async()=>{app.loader.update(app.controllers.getActiveEntity().position,'car');const until=performance.now()+15000;while([...app.loader.records.values()].some(r=>r.state==='loading')){if(performance.now()>until)throw Error('tiles did not settle');await new Promise(r=>requestAnimationFrame(r));}await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(app.renderer.backend.device?.queue)await app.renderer.backend.device.queue.onSubmittedWorkDone();};
 const sample=()=>({time:performance.now(),memory:{...app.renderer.info.memory},tiles:app.city.loaded.size,colliders:app.world.tiles.size,records:app.loader.records.size,heap:performance.memory?.usedJSHeapSize});
 const targets=window.lifecycleTargets||['peace','tower'],rounds=[];await app.gotoLandmark(targets[0]);await settle();const initial=sample();
 for(let i=0;i<12;i++){await app.gotoLandmark(targets[1]);await settle();await app.gotoLandmark(targets[0]);await settle();rounds.push({round:i+1,...sample()});}
 return {buildAsset:window.shanghaiStartup?.files?.module?.split('/').at(-1)||performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/index-.*\.js$/.test(n))?.split('/').at(-1),initial,warmupRounds:2,measuredRounds:10,rounds,errors:app.errors};
});
await evidenceFs.writeFile(evidenceRoot+'/lifecycle.json',JSON.stringify(result,null,2));expect(result.errors).toEqual([]);const tail=result.rounds.slice(-5);for(const key of ['geometries','textures','attributes','storageAttributes','uniformBuffers','programs'])expect(new Set(tail.map(r=>r.memory[key])).size,'stable '+key).toBeLessThanOrEqual(1);
return {rounds:result.measuredRounds,lastFive:tail.map(r=>({round:r.round,tiles:r.tiles,geometries:r.memory.geometries,textures:r.memory.textures,bytes:r.memory.total,attributes:r.memory.attributes,uniformBuffers:r.memory.uniformBuffers,programs:r.memory.programs})),errors:result.errors};
