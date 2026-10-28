import {BootProgress,BOOT_STAGES,nextPaint} from './loading-progress.js';
export const formatBytes=n=>n>=1000000?(n/1000000).toFixed(1)+' MB':Math.round(n/1000)+' KB';
export function createLoadingUI(){
 const $=id=>document.getElementById(id),marks=[];let lastStage='',scheduled=false;
 const progress=new BootProgress({onChange(){if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;draw();});}}});
 const steps=$('loading-stages');steps.replaceChildren(...BOOT_STAGES.map(s=>{const item=document.createElement('li');item.dataset.stage=s.id;item.textContent=s.label;return item;}));
 function draw(){const s=progress.snapshot(),percent=Math.floor(s.percent);$('loading-percent').textContent=percent+'%';$('loading-progress').setAttribute('aria-valuenow',String(percent));$('loading-fill').style.width=s.percent+'%';$('loading-step').textContent=`步骤 ${s.index+1} / ${s.stages.length}`;$('loading-text').textContent=s.error?'暂时未能启动':s.stage.label;$('loading-detail').textContent=s.error||s.detail;$('loading-elapsed').textContent=`已用 ${(s.elapsedMs/1000).toFixed(1)} 秒`;$('loading-count').textContent=s.stage.total?`${Math.round(s.stage.loaded)} / ${s.stage.total} ${s.stage.id==='download'?'字节':s.stage.id==='render'?'项光影任务':'项'}`:'正在准备…';
  if(s.stage.id==='download'&&s.stage.total)$('loading-count').textContent=`${formatBytes(s.stage.loaded)} / ${formatBytes(s.stage.total)}`;
  for(const li of steps.children){const stage=s.stages.find(p=>p.id===li.dataset.stage);li.classList.toggle('complete',stage.done);li.classList.toggle('current',stage.id===s.stage.id&&!stage.done);}
  $('loading-retry').hidden=!s.error;$('loading').classList.toggle('failed',!!s.error);if(s.stage.id!==lastStage){lastStage=s.stage.id;marks.push({stage:s.stage.id,text:s.stage.label,ms:s.elapsedMs});}
 }
 const timer=setInterval(draw,200);$('loading-retry').onclick=()=>location.reload();draw();
 return {progress,marks,data:null,files:null,paint:nextPaint,fail(error){clearInterval(timer);progress.fail(error);draw();console.error(error);},async finish(){progress.complete('render','城市已就绪，可以出发');progress.markReady();draw();await nextPaint();$('loading').hidden=true;clearInterval(timer);}};
}
