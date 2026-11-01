// Public upstream demo and repository-page material, recorded in a clean browser context.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const args=process.argv.slice(2),opt=(k,f)=>{const i=args.indexOf(k);return i<0?f:args[i+1];};
const out=path.resolve(opt('--output','output/video/origin'));
const modulePath=opt('--playwright',null);
const {chromium}=await import(modulePath?pathToFileURL(path.resolve(modulePath)).href:'playwright');
await fs.mkdir(out,{recursive:true});await fs.mkdir(path.join(out,'检查帧'),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=metal','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,colorScheme:'light',locale:'en-US'});
const reports=[];
async function encode(name,seconds,frame){
 const proc=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','30','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,name+'.mp4')],{stdio:['pipe','ignore','pipe']});
 let log='';proc.stderr.on('data',b=>log+=b);const done=once(proc,'close');
 for(let i=0;i<seconds*30;i++){
  const buffer=await frame(i,i/(seconds*30-1));
  if(i===0||i===Math.floor(seconds*15)||i===seconds*30-1)await fs.writeFile(path.join(out,'检查帧',name+'_'+i+'.jpg'),buffer);
  if(!proc.stdin.write(buffer))await once(proc.stdin,'drain');
 }
 proc.stdin.end();const [code]=await done;if(code!==0)throw Error(log);
 console.log('Saved',name,seconds+'s');
}
try{
 if(!args.includes('--nyc-only')){
  const page=await context.newPage();page.setDefaultTimeout(90000);
  for(const [id,repo] of [['G01','mrdoob/slop-newyork'],['G02','LightYearZh/slop-wuhan']]){
   const url='https://github.com/'+repo;console.log('Capturing repository',repo);
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('article.markdown-body').waitFor({state:'visible'});
   await page.evaluate(()=>document.fonts.ready);
   console.log('Visible headings:',await page.locator('article.markdown-body h1').allTextContents());
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,id+'_GitHub首页.png')});
   const target=await page.locator('article.markdown-body').evaluate(el=>Math.max(0,el.getBoundingClientRect().top+scrollY-85));
   await encode(id+'_GitHub页面滚动',8,async(i,t)=>{
    const u=t<.2?0:t>.8?1:(t-.2)/.6,ease=u*u*(3-2*u);
    await page.evaluate(y=>scrollTo(0,y),target*ease);
    return page.screenshot({type:'jpeg',quality:94});
   });
   await page.screenshot({path:path.join(out,id+'_README.png')});
   reports.push({id,repo,url,duration:8,format:'1920×1080 30fps H.264; PNG screenshots',method:'public page in fresh signed-out browser; actual scroll; no page content edits'});
  }
  await page.close();
 }
 if(!args.includes('--pages-only')){
  const page=await context.newPage();page.setDefaultTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let intercepted=false;
  await page.route('**/slop-newyork/js/main.js*',async route=>{
   const response=await route.fetch();let body=await response.text();const marker='  renderer.setAnimationLoop((now) => {';
   if(!body.includes(marker))throw Error('NYC loop has changed; inspect upstream before recording.');
   body=body.replace(marker,`  const originalLoop=renderer.setAnimationLoop.bind(renderer);
   renderer.setAnimationLoop=callback=>{
     let paused=false;
     window.__nyCapture={controllers:controllerManager,cameraSystem,ready:()=>warmedUp&&loadingOverlay.classList.contains('hidden'),pause:()=>{paused=true;},step:async()=>{callback(lastTime+1000/30);await renderer.backend.device?.queue.onSubmittedWorkDone();}};
     return originalLoop(now=>{if(!paused)callback(now);});
   };
`+marker);intercepted=true;await route.fulfill({response,body});
  });
  const url='https://mrdoob.github.io/slop-newyork/';console.log('Loading original NYC live demo…');
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__nyCapture?.ready());
  await page.evaluate(async()=>{const n=window.__nyCapture;n.pause();document.getElementById('mode-car').click();document.getElementById('time-midday').click();n.cameraSystem.setCameraPreset('chase',true);for(let i=0;i<60;i++)await n.step();});
  for(const [id,clean] of [['NY01',false],['NY02',true]]){
   const trace=[];
   await page.evaluate(clean=>{document.body.classList.toggle('hud-minimized',clean);const style=document.createElement('style');style.textContent='body.hud-minimized .hud-top-right{visibility:hidden!important}';document.head.append(style);},clean);
   await encode(id+'_原版纽约出租车'+(clean?'_干净画面':'_带界面'),8,async i=>{
    const state=await page.evaluate(async()=>{const n=window.__nyCapture,c=n.controllers;c.resetInput();c.keys.forward=true;await n.step();const e=c.getActiveEntity();return{p:e.position.toArray(),speed:e.speed};});
    if(i%30===0)trace.push({t:i/30,...state});return page.screenshot({type:'jpeg',quality:94});
   });
   reports.push({id,url,seconds:8,clean,trace,errors:[...errors],method:'self-recorded original public demo; recording loop injected in browser only; original physics and scene retained'});
  }
  if(!intercepted)throw Error('No source hook was installed');
  await page.close();
 }
 await fs.writeFile(path.join(out,'录制记录.json'),JSON.stringify({date:'2026-11-01',items:reports},null,2));
}finally{await browser.close();}
