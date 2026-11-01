// Record the game's own Web Audio mix. Does not access a microphone or system audio.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const args=process.argv.slice(2),opt=(k,f)=>{const i=args.indexOf(k);return i<0?f:args[i+1];};
const out=path.resolve(opt('--output','output/video/audio'));
const modulePath=opt('--playwright',null);
const {chromium}=await import(modulePath?pathToFileURL(path.resolve(modulePath)).href:'playwright');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=metal','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(240000);
 await page.route('**/js/runtime/main.js*',async route=>{
  const response=await route.fetch();const body=(await response.text()).replace('  window.wuhan={ready:false','  window.__captureAudio=audioSystem;\n  window.wuhan={ready:false');
  await route.fulfill({response,body});
 });
 console.log('Preparing game audio scene…');
 await page.goto(opt('--url','http://127.0.0.1:4801/')+'?time=midday');
 await page.waitForFunction(()=>window.wuhan?.ready);
 if(await page.locator('#btn-sound').getAttribute('aria-pressed')!=='true')await page.locator('#btn-sound').click();
 await page.mouse.click(640,360);
 await page.waitForFunction(()=>window.__captureAudio?.context?.state==='running');
 const shots=[
  {id:'A01',name:'城市街道与步行',mode:'person',at:'jianghan-road',duration:25},
  {id:'A02',name:'出租车启动加速与滑行',mode:'car',start:[-175.3,0,1023.38],heading:2.758,duration:24},
  {id:'A03',name:'直升机飞行与风声',mode:'helicopter',start:[1300,190,2900],heading:-2.1,duration:25},
 ];
 for(const shot of shots){
  console.log('Recording audio',shot.id);
  const bytes=await page.evaluate(async shot=>{
   const w=window.wuhan,cm=w.controllers,a=window.__captureAudio;
   cm.resetInput();w.setMode(shot.mode);if(shot.at)w.gotoLandmark(shot.at);
   if(shot.start)cm.teleportActiveTo(shot.start[0],shot.start[2],shot.heading,shot.start[1]);
   const destination=a.context.createMediaStreamDestination();a.master.connect(destination);
   const chunks=[],recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:192000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.start();
   const start=performance.now();
   await new Promise(resolve=>{
    const timer=setInterval(()=>{
     const elapsed=(performance.now()-start)/1000;
     cm.keys.forward=elapsed>2&&elapsed<shot.duration-5?(shot.mode==='helicopter'?.3:1):false;
     if(elapsed>=shot.duration){clearInterval(timer);resolve();}
    },30);
   });
   cm.resetInput();await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});a.master.disconnect(destination);
   const data=new Uint8Array(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());
   let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);
  },shot);
  const raw=path.join(out,shot.id+'_'+shot.name+'.webm'),wav=path.join(out,shot.id+'_'+shot.name+'.wav');
  await fs.writeFile(raw,Buffer.from(bytes,'base64'));
  const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',raw,'-c:a','pcm_s24le','-ar','48000',wav],{stdio:'inherit'});const [code]=await once(ff,'close');if(code!==0)throw Error('Audio encode failed');
  console.log('Finished audio',shot.id);
 }
 await fs.writeFile(path.join(out,'说明.txt'),'原声来自0.8.5游戏自身的Web Audio混音，不含麦克风、系统其他应用声音或配乐。\n这三段为独立实时间录音，不与逐帧视频逐镜同步；用作环境底声或音效参考。WAV为48kHz/24bit，WebM为原始Opus录音。\n');
}finally{await browser.close();}
