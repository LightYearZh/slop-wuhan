const config=await page.evaluate(()=>window.nextMode);
await page.evaluate(async config=>{
 const app=shanghai,mode=config.mode;
 if(config.destination){await app.gotoLandmark(config.destination);app.loader.update(app.controllers.getActiveEntity().position,mode);const end=performance.now()+15000;while([...app.loader.records.values()].some(r=>r.state==='loading')){if(performance.now()>end)throw Error('Citywide mode tiles did not settle');await new Promise(r=>requestAnimationFrame(r));}}
 const origin=app.controllers.getActiveEntity().position.clone(),roadPool=[...app.data.roads,...[...app.city.streetTiles.values()].flatMap(t=>t.roads)];
 if(mode==='helicopter'&&!config.flightPoints)config.flightPoints=[[origin.x,350,origin.z],[origin.x+1200,350,origin.z],[origin.x+1200,350,origin.z+900],[origin.x,350,origin.z+900]];
 function safe(p,radius){if(app.surface.isWater(p[0],p[2]))return false;return !app.world.query({minX:p[0]-radius,maxX:p[0]+radius,minY:2,maxY:5,minZ:p[2]-radius,maxZ:p[2]+radius}).some(c=>{if(!c.obb)return true;const o=c.obb,dx=p[0]-o.cx,dz=p[2]-o.cz;return Math.abs(dx*o.cs-dz*o.sn)<o.hx+radius&&Math.abs(dx*o.sn+dz*o.cs)<o.hz+radius;})&&!app.data.buildings.some(b=>{const dx=p[0]-b.x,dz=p[2]-b.z,cs=Math.cos(b.ry),sn=Math.sin(b.ry);return Math.abs(dx*cs-dz*sn)<b.w/2+radius&&Math.abs(dx*sn+dz*cs)<b.d/2+radius;})&&!(app.world.tiles.get('landmarks')||[]).some(b=>p[0]>b.minX-radius&&p[0]<b.maxX+radius&&p[2]>b.minZ-radius&&p[2]<b.maxZ+radius);}
 let route;
 if(config.road){
  const roads=roadPool.filter(r=>r.name===config.road),nodes=new Map(),key=p=>p[0]+':'+p[2];
  for(const r of roads)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],ka=key(a),kb=key(b);if(!nodes.has(ka))nodes.set(ka,{point:a,edges:[]});if(!nodes.has(kb))nodes.set(kb,{point:b,edges:[]});nodes.get(ka).edges.push(kb);nodes.get(kb).edges.push(ka);}
  const ordered=[...nodes].sort((a,b)=>a[1].point[0]-b[1].point[0]),start=ordered[0][0],end=ordered.at(-1)[0],queue=[start],previous=new Map([[start,null]]);
  for(const key of queue){if(key===end)break;for(const next of nodes.get(key).edges)if(!previous.has(next)){previous.set(next,key);queue.push(next);}}
  if(!previous.has(end))throw Error('Named road is not connected: '+config.road);const path=[];for(let key=end;key!==null;key=previous.get(key))path.push(nodes.get(key).point);path.reverse();route={name:config.road+' · 源数据连续街道',points:path};
 }else if(mode==='helicopter')route={name:config.destination?'全市飞行环线':'浦江上空环线',points:config.flightPoints||[[-650,180,-700],[-450,180,350],[180,180,550],[300,180,-300],[-650,180,-700]]};
 else{
  const candidates=roadPool.filter(r=>r.name&&!r.bridge&&r.width>=12&&Math.hypot(r.points[0][0]-origin.x,r.points[0][2]-origin.z)<1800&&r.points.every(p=>p[0]>app.data.bounds[0]+20&&p[0]<app.data.bounds[2]-20&&p[2]>app.data.bounds[1]+20&&p[2]<app.data.bounds[3]-20)).map(r=>({...r,length:r.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-r.points[i][0],p[2]-r.points[i][2]),0)})).sort((a,b)=>b.length-a.length);
  route=candidates.find(r=>r.length>=200&&r.points.every((p,i)=>{const q=r.points[Math.max(0,i-1)],len=Math.hypot(p[0]-q[0],p[2]-q[2]);for(let d=0;d<=len;d+=8){const u=len?d/len:0;if(!safe([q[0]+(p[0]-q[0])*u,2.12,q[2]+(p[2]-q[2])*u],mode==='person'?.75:mode==='car'?2.6:1.4))return false;}return true;}));
  if(!route)throw Error('No clear ground benchmark route');
 }
 const first=route.points[0],second=route.points[1];await app.teleport(first[0],first[2],Math.atan2(second[0]-first[0],second[2]-first[2]));await app.setMode(mode);
 if(mode==='helicopter')await app.teleport(first[0],first[2],Math.atan2(second[0]-first[0],second[2]-first[2]));
 const e=app.controllers.getActiveEntity();e.heading=Math.atan2(second[0]-first[0],second[2]-first[2]);app.follow();app.setTime('golden');
 const ps=route.points,run=window.modeRun={mode,buildAsset:window.shanghaiStartup?.files?.module?.split('/').at(-1)||performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/index-.*\.js$/.test(n))?.split('/').at(-1),start:performance.now(),route:route.name,points:ps,index:1,direction:1,trace:[],fullFrameTimes:[],collecting:false,errors:[],done:false,distance:0,lastPosition:e.position.clone(),lastTrace:0,warmed:false,cameraChanges:0};
 window.activeFrameRun=run;if(!app.frameRecorderInstalled){app.frameRecorderInstalled=true;app.samples.push=function(...values){const r=window.activeFrameRun;if(r?.collecting&&!r.done)r.fullFrameTimes.push(...values);return Array.prototype.push.apply(this,values);};}
 if(window.modeTimer)clearInterval(modeTimer);const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 window.modeTimer=setInterval(()=>{try{
  const now=performance.now(),elapsed=now-run.start,e=app.controllers.getActiveEntity();if(app.controllers.activeMode!==mode)throw Error('Mode changed during benchmark');const step=e.position.distanceTo(run.lastPosition);if(step>30)throw Error('Position discontinuity during benchmark: '+step);run.maxStep=Math.max(run.maxStep||0,step);run.distance+=step;run.lastPosition.copy(e.position);
  if(!run.warmed&&elapsed>=(config.warmupMs??30000)){run.warmed=true;run.collecting=true;app.samples.length=0;run.sampleStart=now;}
  const p=ps[run.index];if(Math.hypot(e.position.x-p[0],e.position.z-p[2])<Math.max(6,Math.abs(e.speed)*.5)){
   if(mode==='helicopter')run.index=(run.index+1)%ps.length;
   else{if(run.index===ps.length-1)run.direction=-1;if(run.index===0)run.direction=1;run.index+=run.direction;}
  }
  const target=ps[run.index],error=wrap(Math.atan2(target[0]-e.position.x,target[2]-e.position.z)-e.heading),steer=Math.max(-1,Math.min(1,error*2));
  app.controllers.setGamepadInput('left',Math.max(0,steer));app.controllers.setGamepadInput('right',Math.max(0,-steer));
  if(mode==='person')app.controllers.setGamepadInput('forward',Math.abs(error)>.65?0:.85);
  else{const desired=Math.abs(error)>.65?1:mode==='helicopter'?22:9;app.controllers.setGamepadInput('forward',e.speed<desired?.35:0);app.controllers.setGamepadInput('backward',e.speed>desired+3?.4:0);}
  if(mode==='helicopter'){const altitude=(config.altitude||200)+(config.altitudeAmplitude??30)*Math.sin(elapsed/35000);app.controllers.setGamepadInput('up',e.position.y<altitude-3?.4:0);app.controllers.setGamepadInput('down',e.position.y>altitude+3?.4:0);}
  const preview=Math.floor(elapsed/6000);if(elapsed<25000&&preview>(run.previewChanges||0)){run.previewChanges=preview;document.getElementById('camera-button').click();}
  const cameraChange=Math.floor(elapsed/60000);if(cameraChange>run.cameraChanges){run.cameraChanges=cameraChange;document.getElementById('camera-button').click();if(cameraChange===2)app.setTime('midnight');if(cameraChange===4)app.setTime('midday');}
  if(now-run.lastTrace>=500){run.lastTrace=now;run.trace.push({ms:elapsed,mode:app.controllers.activeMode,x:e.position.x,y:e.position.y,z:e.position.z,speed:e.speed,heading:e.heading,surface:e.surfaceId,camera:app.cameras.activePresetId});}
  if(run.warmed&&now-run.sampleStart>=(config.sampleMs??301000)){clearInterval(modeTimer);app.controllers.clearGamepadInput();run.done=true;run.duration=elapsed;run.sampleDuration=now-run.sampleStart;run.metrics=app.metrics();run.frameTimes=run.fullFrameTimes.slice();const sorted=run.frameTimes.slice().sort((a,b)=>a-b);Object.assign(run.metrics,{frames:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)]});delete run.fullFrameTimes;}
 }catch(e){run.errors.push(String(e));clearInterval(modeTimer);app.controllers.clearGamepadInput();run.done=true;}},25);
},config);
if(config.record){await beginRecording(config.label);setTimeout(async()=>{if(recording?.label===config.label)await endRecording();},25000);}
return await page.evaluate(()=>({mode:modeRun.mode,route:modeRun.route,started:true}));
