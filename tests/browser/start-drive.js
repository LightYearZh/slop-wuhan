await page.waitForFunction(()=>window.shanghai?.ready);
await page.getByRole('button',{name:'⌖ 地点',exact:true}).click();
await page.getByRole('button',{name:'驾车过江 · 浦西入口',exact:true}).click();
return await page.evaluate(()=>{
 const app=shanghai;const route=app.data.tunnels.find(t=>t.points[0][0]<0);const ps=route.points;
 if(window.driveRun?.timer)clearInterval(driveRun.timer);
 const run=window.driveRun={route:route.id,start:performance.now(),index:0,trace:[],done:false,maxDeviation:0,minY:2,previous:null,error:null};
 app.samples.length=0;app.follow();
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 run.timer=setInterval(()=>{
  try{
   const e=app.controllers.getActiveEntity();let nearest=run.index,best=Infinity;
   for(let i=Math.max(0,run.index-3);i<Math.min(ps.length,run.index+24);i++){const d=Math.hypot(e.position.x-ps[i][0],e.position.z-ps[i][2]);if(d<best){best=d;nearest=i;}}
   run.index=Math.max(run.index,nearest);run.maxDeviation=Math.max(run.maxDeviation,best);run.minY=Math.min(run.minY,e.position.y);
   let target=Math.min(ps.length-1,run.index+Math.max(1,Math.round((6+Math.abs(e.speed)*.7)/8)));
   const aim=ps[target],angle=Math.atan2(aim[0]-e.position.x,aim[2]-e.position.z),error=wrap(angle-e.heading);
   const steer=Math.max(-1,Math.min(1,error*2.4));
   app.controllers.setGamepadInput('left',Math.max(0,steer));app.controllers.setGamepadInput('right',Math.max(0,-steer));
   const desired=Math.abs(error)>.3?7:15;
   app.controllers.setGamepadInput('forward',e.speed<desired?.65:0);
   app.controllers.setGamepadInput('backward',e.speed>desired+3?.25:0);
   const now=performance.now();if(!run.previous||now-run.previous>200){run.previous=now;run.trace.push({ms:now-run.start,x:e.position.x,y:e.position.y,z:e.position.z,speed:e.speed,index:run.index,surface:e.surfaceId,cameraY:app.cameras.camera.position.y});}
   if(run.index>=ps.length-2&&Math.hypot(e.position.x-ps.at(-1)[0],e.position.z-ps.at(-1)[2])<10){clearInterval(run.timer);app.controllers.clearGamepadInput();run.done=true;run.duration=now-run.start;run.metrics=app.metrics();}
   if(now-run.start>260000){clearInterval(run.timer);app.controllers.clearGamepadInput();run.error='route timed out';}
  }catch(e){run.error=String(e);clearInterval(run.timer);}
 },25);
 return {started:true,route:route.id,points:ps.length,position:app.controllers.getActiveEntity().position};
});
