// Exercise normal UI and vehicle inputs; never force pickup, payment or trip state.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const args=process.argv.slice(2),opt=(k,f)=>{const i=args.indexOf(k);return i<0?f:args[i+1];};
const out=path.resolve(opt('--output','output/taxi'));await fs.mkdir(out,{recursive:true});
const modulePath=opt('--playwright',null);
const {chromium}=await import(modulePath?pathToFileURL(modulePath).href:'playwright');
const verify=args.includes('--verify'),browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=metal','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});page.setDefaultTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/js/runtime/main.js*',async route=>{
  const response=await route.fetch(),marker='  renderer.setAnimationLoop((now) => {';let body=await response.text();if(!body.includes(marker))throw Error('Animation entry changed');
  body=body.replace(marker,`  const captureLoop=renderer.setAnimationLoop.bind(renderer);
  renderer.setAnimationLoop=callback=>{let paused=false;window.wuhan.video={pause:()=>{paused=true;},step:async()=>{callback(lastTime+1000/30);await device?.queue.onSubmittedWorkDone();},simulate:async()=>{const saved=renderPipeline.render;try{renderPipeline.render=()=>{};callback(lastTime+1000/30);}finally{renderPipeline.render=saved;}await Promise.resolve();}};return captureLoop(now=>{if(!paused)callback(now);});};
`+marker);await route.fulfill({response,body});
 });
 console.log('Loading playable taxi scene…');await page.goto(opt('--url','http://127.0.0.1:4802/')+'?time=midday&mode=car');await page.waitForFunction(()=>window.wuhan?.ready&&window.wuhan?.video);
 await page.evaluate(()=>window.wuhan.video.pause());
 // Driver follows the same recommended road route shown to the player, using only throttle/brake/steer.
 await page.evaluate(()=>{
  window.__taxiDrive=()=>{
   const w=window.wuhan,c=w.controllers,e=c.getActiveEntity(),s=w.taxi.state;c.resetInput();
   if(!['pickup','ride'].includes(s.phase)||!s.route)return;
   const points=s.route.points;let best=null,along=0,total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.001)continue;const u=Math.max(0,Math.min(1,((e.position.x-a.x)*dx+(e.position.z-a.z)*dz)/(len*len))),x=a.x+dx*u,z=a.z+dz*u,d=Math.hypot(x-e.position.x,z-e.position.z);if(!best||d<best.d)best={i,u,len,d,remaining:total-along-u*len};along+=len;}
   if(!best)return;
   let j=best.i,station=best.u*best.len+8+Math.abs(e.speed)*.6;
   while(j<points.length-1){const len=Math.hypot(points[j].x-points[j-1].x,points[j].z-points[j-1].z);if(station<=len)break;station-=len;j++;}
   const a=points[j-1],b=points[j],q=Math.min(1,station/(Math.hypot(b.x-a.x,b.z-a.z)||1));let tx=a.x+(b.x-a.x)*q,tz=a.z+(b.z-a.z)*q;
   const target=s.phase==='pickup'?s.job.pickup:s.job.drop,d=Math.hypot(target.x-e.position.x,target.z-e.position.z);
   if(best.remaining<16){tx=target.x;tz=target.z;}
   let desired=Math.min(12,Math.sqrt(Math.max(0,best.remaining-3)*4));if(d<6)desired=0;
   const h=Math.atan2(tx-e.position.x,tz-e.position.z),error=Math.atan2(Math.sin(h-e.heading),Math.cos(h-e.heading));
   c.keys.left=d>3&&error>0?Math.min(1,error*3):0;c.keys.right=d>3&&error<0?Math.min(1,-error*3):0;
   c.keys.forward=desired>Math.abs(e.speed)+.2?1:0;c.keys.backward=e.speed>desired+.3?1:0;
  };
 });
 const reports=[];
 for(let attempt=0;attempt<(verify?3:1);attempt++){
  await page.evaluate(async index=>{
   const w=window.wuhan;if(w.taxi.state.phase!=='idle')document.getElementById('taxi-secondary').click();
   const stop=w.taxi.network.jobs[index].pickup,c=w.controllers;w.setMode('car');c.teleportActiveTo(stop.x-Math.sin(stop.heading)*45,stop.z-Math.cos(stop.heading)*45,stop.heading,stop.y);w.setView('chase');w.cameraSystem.zoomMultiplier=1.2;
   for(let i=0;i<60;i++)await w.video.step();
  },attempt);
  if(attempt===0){
   await page.screenshot({path:path.join(out,'desktop-idle.png')});await page.setViewportSize({width:800,height:900});await page.evaluate(async()=>{for(let i=0;i<20;i++)await wuhan.video.step();});await page.screenshot({path:path.join(out,'narrow-idle.png')});await page.setViewportSize({width:1920,height:1080});
  }
  let encoder,done,frames=0;
  if(!verify){encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','30','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'TX01_完整接单到送达.mp4')],{stdio:['pipe','ignore','inherit']});done=once(encoder,'close');}
  const trace=[],events=[];let lastPhase=null,finishedHold=0;
  for(let i=0;i<30*300;i++){
   if(i===30)await page.locator('#taxi-primary').click();
   if(i===90)await page.locator('#taxi-primary').click();
   const state=await page.evaluate(async simulate=>{
    window.__taxiDrive();const w=window.wuhan;await(simulate?w.video.simulate():w.video.step());const s=w.taxi.state,e=w.controllers.getActiveEntity();
    return{phase:s.phase,job:s.job?.id,position:e.position.toArray(),speed:e.speed,hold:s.hold,result:s.result,routePoints:s.route?.points.length,passengerMeshes:w.scene.children.filter(o=>o.name==='TaxiPassenger').map(o=>o.count),errors:w.metrics().errors};
   },verify);
   if(i%30===0)trace.push({t:i/30,...state});
   if(state.phase!==lastPhase){console.log('Trip',attempt+1,'at',i/30,'seconds:',state.phase);events.push({t:i/30,phase:state.phase});lastPhase=state.phase;if(verify)await page.evaluate(()=>wuhan.video.step());await page.screenshot({path:path.join(out,`trip${attempt+1}-${state.phase}.png`)});}
   if(!verify){const buffer=await page.screenshot({type:'jpeg',quality:94});if(!encoder.stdin.write(buffer))await once(encoder.stdin,'drain');frames++;}
   if(state.phase==='complete'){finishedHold++;if(finishedHold>=90)break;}
   if(i>90&&state.phase==='idle')throw Error('Trip unexpectedly cancelled; '+JSON.stringify(state));
   if(i&&i%600===0)console.log('Progress',attempt+1,i/30,'seconds',JSON.stringify({p:state.position,speed:state.speed,phase:state.phase}));
  }
  if(encoder){encoder.stdin.end();const [code]=await done;if(code!==0)throw Error('Encoding failed');}
  const result=await page.evaluate(()=>wuhan.taxi.state);if(result.phase!=='complete')throw Error('Trip did not complete: '+JSON.stringify(trace.at(-1)));
  if(errors.length)throw Error(errors.join('\n'));
  const report={job:result.job.id,events,trace,result:result.result,frames,seconds:frames/30,errors,method:'Normal start/accept controls and steering/throttle/brake input; no forced transitions or in-trip teleports; gameplay physics and traffic retained.'};
  reports.push(report);await fs.writeFile(path.join(out,'trip-'+(attempt+1)+'.json'),JSON.stringify(report,null,2));
 }
 await fs.writeFile(path.join(out,verify?'verification.json':'recording.json'),JSON.stringify(reports,null,2));
 console.log('COMPLETE',reports.map(r=>({job:r.job,result:r.result,seconds:r.seconds})));
}finally{await browser.close();}
