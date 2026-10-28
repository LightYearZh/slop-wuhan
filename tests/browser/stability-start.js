await page.waitForFunction(()=>window.shanghai?.ready);
return await page.evaluate(()=>{
 const app=shanghai;if(window.stabilityRun?.timer)clearInterval(stabilityRun.timer);
 const run=window.stabilityRun={buildAsset:performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/index-.*\.js$/.test(n))?.split('/').at(-1),start:performance.now(),startedAt:new Date().toISOString(),url:location.href,series:[],visibilityChanges:[],errorsAtStart:app.errors.slice(),canvas:[app.renderer.domElement.width,app.renderer.domElement.height],pixelRatio:app.renderer.getPixelRatio(),webgpu:!!app.renderer.backend.isWebGPUBackend};
 const collect=()=>{const e=app.controllers.getActiveEntity(),m=app.metrics();run.series.push({ms:performance.now()-run.start,mode:app.controllers.activeMode,position:{x:e.position.x,y:e.position.y,z:e.position.z},visible:!document.hidden,memory:{...m.memory},tiles:m.loadedTiles,collisionTiles:app.world.tiles.size,loaderRecords:app.loader.records.size,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,errors:app.errors.length});};
 collect();run.timer=setInterval(collect,5000);document.addEventListener('visibilitychange',()=>run.visibilityChanges.push({ms:performance.now()-run.start,visible:!document.hidden}));return {startedAt:run.startedAt,...run,timer:undefined};
});
