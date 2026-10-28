// Set window.nextDrive={direction:'east'|'west',time:'midday'|'midnight',label} before running.
await page.waitForFunction(()=>window.shanghai?.ready);
const config=await page.evaluate(()=>window.nextDrive||{direction:'east',time:'midday',label:'east-1'});
if(globalThis.recordCitywideDrives)config.record=true;
if(config.label.endsWith('-release')&&config.time==='golden')config.groundApproach=true;
await page.evaluate(time=>shanghai.setTime(time),config.time);
if(config.groundApproach){
 await page.evaluate(async config=>{
  const app=shanghai,t=app.data.tunnels.find(t=>(t.points[0][0]<0)===(config.direction==='east')),road=id=>app.data.roads.find(r=>r.id===id);
  const sourceRoads=config.direction==='east'?['osm-cache-road-19604','osm-cache-road-19122']:['osm-cache-road-18308','osm-cache-road-19630','osm-cache-road-19803'];
  const prefix=config.direction==='east'?[road(sourceRoads[0]).points.at(-2)]:road(sourceRoads[0]).points.slice();
  const suffix=[road(sourceRoads.at(-1)).points.at(-1)];window.driveApproach={prefix,suffix,sourceRoads};
  const first=prefix[0],next=prefix[1]||t.points[0];await app.setMode('car');await app.teleport(first[0],first[2],Math.atan2(next[0]-first[0],next[2]-first[2]));document.getElementById('places').hidden=true;
 },config);
 await page.waitForFunction(()=>shanghai.controllers.activeMode==='car'&&!shanghai.controllers.getActiveEntity().surface?.tunnel);
}else{
 await page.evaluate(()=>{window.driveApproach=null;window.acceptanceAllowUI=true;});
 try{await page.locator('#places-button').click();await page.getByRole('button',{name:config.direction==='east'?'驾车过江 · 浦西入口':'驾车过江 · 浦东入口',exact:true}).click();}finally{await page.evaluate(()=>window.acceptanceAllowUI=false);}
 await page.waitForFunction(direction=>{const app=shanghai,t=app.data.tunnels.find(t=>(t.points[0][0]<0)===(direction==='east')),e=app.controllers.getActiveEntity();return app.controllers.activeMode==='car'&&e.surfaceId===t.id&&Math.hypot(e.position.x-t.points[0][0],e.position.z-t.points[0][2])<2;},config.direction);
}
if(config.record)await beginRecording(config.label);
return await page.evaluate(config=>{
 const app=shanghai,route=app.data.tunnels.find(t=>(t.points[0][0]<0)===(config.direction==='east')),approach=window.driveApproach,ps=approach?[...approach.prefix,...route.points,...approach.suffix]:route.points;
 if(window.driveRun?.timer)clearInterval(driveRun.timer);
 const run=window.driveRun={...config,groundConnection:approach,buildAsset:window.shanghaiStartup?.files?.module?.split('/').at(-1)||performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/index-.*\.js$/.test(n))?.split('/').at(-1),route:route.id,start:performance.now(),index:0,trace:[],fullFrameTimes:[],collecting:true,done:false,maxCrossTrack:0,maxTransitionStep:0,surfaceChanges:[],minY:2,minCameraClearance:Infinity,errors:[],lastTrace:0,maxStep:0,previous:null};
 window.activeFrameRun=run;if(!app.frameRecorderInstalled){app.frameRecorderInstalled=true;app.samples.push=function(...values){const r=window.activeFrameRun;if(r?.collecting&&!r.done)r.fullFrameTimes.push(...values);return Array.prototype.push.apply(this,values);};}
 app.samples.length=0;app.follow();app.cameras.activePresetId='chase';
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 run.timer=setInterval(()=>{try{
  const e=app.controllers.getActiveEntity();let nearest=run.index,best=Infinity;
  for(let i=Math.max(0,run.index-3);i<Math.min(ps.length,run.index+24);i++){const d=Math.hypot(e.position.x-ps[i][0],e.position.z-ps[i][2]);if(d<best){best=d;nearest=i;}}
  run.index=Math.max(run.index,nearest);const projected=app.surface.nearest(e.position.x,e.position.z,r=>r.id===route.id);if(!approach||e.surface?.tunnel)run.maxCrossTrack=Math.max(run.maxCrossTrack,projected.distance);run.minY=Math.min(run.minY,e.position.y);
  if(run.lastSurface&&run.lastSurface.id!==e.surfaceId){const step=Math.abs(e.position.y-run.lastSurface.y);run.maxTransitionStep=Math.max(run.maxTransitionStep,step);run.surfaceChanges.push({from:run.lastSurface.id,to:e.surfaceId,heightStep:step,x:e.position.x,y:e.position.y,z:e.position.z});}run.lastSurface={id:e.surfaceId,y:e.position.y};
  const target=Math.min(ps.length-1,run.index+Math.max(1,Math.round((6+Math.abs(e.speed)*.7)/8))),aim=ps[target],angle=Math.atan2(aim[0]-e.position.x,aim[2]-e.position.z),error=wrap(angle-e.heading),steer=Math.max(-1,Math.min(1,error*2.4));
  app.controllers.setGamepadInput('left',Math.max(0,steer));app.controllers.setGamepadInput('right',Math.max(0,-steer));const desired=Math.abs(error)>.3?Math.min(7,config.cruise||15):(config.cruise||15);app.controllers.setGamepadInput('forward',e.speed<desired?.65:0);app.controllers.setGamepadInput('backward',e.speed>desired+3?.25:0);
  const now=performance.now(),camera=app.cameras.camera.position;
  if(e.surface?.tunnel){const cp=app.surface.nearest(camera.x,camera.z,r=>r.id===route.id);run.minCameraClearance=Math.min(run.minCameraClearance,cp.height+5.8-camera.y);}
  if(!run.previous||now-run.lastTrace>200){if(run.previous)run.maxStep=Math.max(run.maxStep,Math.hypot(e.position.x-run.previous.x,e.position.y-run.previous.y,e.position.z-run.previous.z));const p={ms:now-run.start,x:e.position.x,y:e.position.y,z:e.position.z,speed:e.speed,index:run.index,surface:e.surfaceId,camera:{x:camera.x,y:camera.y,z:camera.z}};run.trace.push(p);run.previous=p;run.lastTrace=now;}
  if(run.index>=ps.length-2&&Math.hypot(e.position.x-ps.at(-1)[0],e.position.z-ps.at(-1)[2])<10){clearInterval(run.timer);app.controllers.clearGamepadInput();run.done=true;run.duration=now-run.start;run.metrics=app.metrics();run.frameTimes=app.samples.slice();}
  if(now-run.start>Math.max(270000,route.length/(config.cruise||15)*1800+30000)){clearInterval(run.timer);app.controllers.clearGamepadInput();run.errors.push('route timed out');run.done=true;}
 }catch(e){run.errors.push(String(e));clearInterval(run.timer);app.controllers.clearGamepadInput();run.done=true;}},25);
 return {started:true,label:config.label,route:route.id,length:route.length,points:ps.length};
},config);
