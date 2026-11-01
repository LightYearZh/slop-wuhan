// Local video export only: intercept this browser's main module; never change the public runtime.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const out=path.resolve(option('--output','output/video'));
const modulePath=option('--playwright',null);
const shotsPath=option('--shots',new URL('./video-shots.mjs',import.meta.url).pathname);
const {chromium}=await import(modulePath?pathToFileURL(path.resolve(modulePath)).href:'playwright');
const fps=30,width=1920,height=1080;
const sample=args.includes('--sample');
const requested=option('--only','').split(',').filter(Boolean);
await fs.mkdir(out,{recursive:true});
await fs.mkdir(path.join(out,'检查帧'),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=metal','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
const page=await context.newPage();
page.setDefaultTimeout(240000);
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
// Frame-by-frame export retains actual physics and city objects. The simulation only advances when asked.
await page.route('**/js/runtime/main.js*',async route=>{
 const response=await route.fetch();let body=await response.text();
 const marker='  renderer.setAnimationLoop((now) => {';
 if(!body.includes(marker))throw Error('Runtime animation entry changed; refusing to capture.');
 body=body.replace(marker,`  const __normalSetLoop=renderer.setAnimationLoop.bind(renderer);
  renderer.setAnimationLoop=callback=>{
    let paused=false;
    window.wuhan.video={pause:()=>{paused=true;},step:async()=>{callback(lastTime+1000/30);await device?.queue.onSubmittedWorkDone();},time:()=>elapsed};
    return __normalSetLoop(now=>{if(!paused)callback(now);});
  };
`+marker);
 await route.fulfill({response,body});
});
const all=await fs.readFile(path.join(out,'capture-summary.json'),'utf8').then(JSON.parse).catch(()=>[]);
try{
 console.log('Opening local scene, compiling WebGPU shaders…');
 await page.goto(option('--url','http://127.0.0.1:4801/')+'?render=video&camera=overview&time=midday',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.wuhan?.ready&&window.wuhan?.video);
 console.log('Scene ready.');
 await page.evaluate(()=>{
  const w=window.wuhan;w.video.pause();
  window.__videoCameraUpdate=w.cameraSystem.update.bind(w.cameraSystem);
  const style=document.createElement('style');style.textContent='body.hud-minimized .hud-top-right{visibility:hidden!important}';document.head.append(style);
 });
 const {shots}=await import(pathToFileURL(path.resolve(shotsPath)).href);
 for(const shot of shots.filter(s=>!requested.length||requested.includes(s.id))){
  const file=path.join(out,shot.id+'_'+shot.name+'.mp4');
  if(!sample&&await fs.access(file).then(()=>true,()=>false)){
   const previous=await fs.readFile(path.join(out,shot.id+'.json'),'utf8').then(JSON.parse).catch(()=>null);
   if(previous?.file!==path.basename(file)||previous.errors?.length)throw Error('Existing recording is not verified; move it aside or choose a new directory: '+shot.id);
   console.log('Already exists, skipping',shot.id);continue;
  }
  console.log('Preparing',shot.id,shot.name);
  await page.evaluate(async shot=>{
   const w=window.wuhan,cm=w.controllers,c=w.cameraSystem;
   cm.resetInput();c.update=window.__videoCameraUpdate;
   document.getElementById('close-fullmap-btn')?.click();
   document.body.classList.toggle('hud-minimized',!shot.hud);
   document.getElementById('time-'+(shot.time||'midday')).click();
   w.setMode(shot.mode||'car');
   if(shot.at)w.gotoLandmark(shot.at);
   if(shot.start)cm.teleportActiveTo(shot.start[0],shot.start[2],shot.heading||0,shot.start[1]);
   w.setView(shot.view||'chase');
   if(shot.zoom)c.zoomMultiplier=shot.zoom;
   if(shot.orbitYaw)c.orbitYawOffset=shot.orbitYaw;
   if(shot.camera){
    window.__videoShot=shot;window.__videoTime=0;
    c.update=function(dt,elapsed){
     window.__videoCameraUpdate(dt,elapsed);
     const s=window.__videoShot,t=Math.min(1,Math.max(0,window.__videoTime/s.duration));
     const ease=t*t*(3-2*t),pos=s.camera.map((v,i)=>v+(s.cameraEnd[i]-v)*ease);
     const target=s.target.map((v,i)=>v+((s.targetEnd||s.target)[i]-v)*ease);
     this.currentPos.set(...pos);this.currentLookAt.set(...target);this.camera.position.copy(this.currentPos);this.camera.lookAt(this.currentLookAt);
    };
   }
   window.__videoPathIndex=1;
   for(let i=0;i<60;i++)await w.video.step();
  },shot);
  const frames=sample?60:Math.round(shot.duration*fps);
  const targetFile=sample?path.join(out,'样片_'+shot.id+'.mp4'):file;
  const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',targetFile],{stdio:['pipe','ignore','pipe']});
  let encodeError='';encoder.stderr.on('data',b=>encodeError+=b.toString());
  const done=once(encoder,'close');
  const checkpoints=new Set([0,Math.floor(frames/2),frames-1]);
  const trace=[];const wallStart=Date.now();
  for(let i=0;i<frames;i++){
   const state=await page.evaluate(async ({shot,i,fps})=>{
    const w=window.wuhan,cm=w.controllers,ent=cm.getActiveEntity();window.__videoTime=i/fps;
    cm.resetInput();
    if(shot.path){
     const p=shot.path;let index=window.__videoPathIndex;
     while(index<p.length-1){const a=p[index-1],b=p[index],dx=b[0]-a[0],dz=b[2]-a[2],u=((ent.position.x-a[0])*dx+(ent.position.z-a[2])*dz)/(dx*dx+dz*dz);if(u>=1||Math.hypot(ent.position.x-b[0],ent.position.z-b[2])<4)index++;else break;}
     window.__videoPathIndex=index;
     const a=p[index-1],b=p[index],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
     const u=Math.max(0,Math.min(1,((ent.position.x-a[0])*dx+(ent.position.z-a[2])*dz)/(length*length)));
     let look=8+Math.abs(ent.speed)*.65,station=u*length+look,j=index;
     while(station>Math.hypot(p[j][0]-p[j-1][0],p[j][2]-p[j-1][2])&&j<p.length-1){station-=Math.hypot(p[j][0]-p[j-1][0],p[j][2]-p[j-1][2]);j++;}
     const aa=p[j-1],bb=p[j],q=Math.min(1,station/Math.hypot(bb[0]-aa[0],bb[2]-aa[2]));
     const target=[aa[0]+(bb[0]-aa[0])*q,0,aa[2]+(bb[2]-aa[2])*q],h=Math.atan2(target[0]-ent.position.x,target[2]-ent.position.z);
     const error=Math.atan2(Math.sin(h-ent.heading),Math.cos(h-ent.heading));
     const steer=Math.min(1,Math.abs(error)*3);
     cm.keys.forward=Math.abs(ent.speed)<(shot.speed||12)?1:0;
     cm.keys.backward=Math.abs(ent.speed)>(shot.speed||12)+2?.3:0;
     cm.keys.left=error>0?steer:0;cm.keys.right=error<0?steer:0;
     if(index===p.length-1&&Math.hypot(ent.position.x-p.at(-1)[0],ent.position.z-p.at(-1)[2])<8){cm.keys.forward=0;cm.keys.backward=ent.speed>.4?1:0;cm.keys.left=cm.keys.right=0;}
    }else if(shot.move){Object.assign(cm.keys,shot.move);}
    if(shot.actions){
     for(const action of shot.actions){if(i===Math.round(action.time*fps)){
      if(action.mode)w.setMode(action.mode);
      if(action.at)w.gotoLandmark(action.at);
      if(action.click)document.getElementById(action.click)?.click();
      if(action.search){const input=document.getElementById('fullmap-search');input.value=action.search;input.dispatchEvent(new Event('input',{bubbles:true}));}
      if(action.destination)document.querySelector(`[data-core-id="${action.destination}"]`)?.click();
     }}
    }
    await w.video.step();
    return i%30===0?{t:i/fps,mode:cm.activeMode,p:cm.getActiveEntity().position.toArray(),speed:cm.getActiveEntity().speed,pathIndex:window.__videoPathIndex}:null;
   },{shot,i,fps});
   if(state)trace.push(state);
   const buffer=await page.screenshot({type:'jpeg',quality:94,animations:'allow',timeout:60000});
   if(checkpoints.has(i))await fs.writeFile(path.join(out,'检查帧',shot.id+'_'+String(i).padStart(5,'0')+'.jpg'),buffer);
   if(!encoder.stdin.write(buffer))await once(encoder.stdin,'drain');
   if(i&&i%150===0)console.log(shot.id,`${i}/${frames} frames`,`${Math.round((Date.now()-wallStart)/1000)}s elapsed`);
  }
  encoder.stdin.end();const [code]=await done;if(code!==0)throw Error('Encoding failed: '+encodeError);
  const result={id:shot.id,name:shot.name,file:path.basename(targetFile),duration:frames/fps,width,height,fps,audio:'none',method:shot.camera?'camera-directed actual scene capture':'fixed-step actual gameplay capture; physics retained',source:'local 0.8.5 scene; export hook injected only in the capture browser',wallSeconds:(Date.now()-wallStart)/1000,trace,errors:[...errors]};
  const oldIndex=all.findIndex(s=>s.id===shot.id);if(oldIndex>=0)all.splice(oldIndex,1);all.push(result);await fs.writeFile(path.join(out,shot.id+'.json'),JSON.stringify(result,null,2));
  console.log('Finished',shot.id,JSON.stringify({seconds:result.duration,renderSeconds:result.wallSeconds,errors:errors.length}));
  await fs.writeFile(path.join(out,'capture-summary.json'),JSON.stringify(all,null,2));
  if(sample)break;
 }
}finally{await browser.close();}
