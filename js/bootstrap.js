import {fetchTrackedBytes,nextPaint} from './loading-progress.js';
import {createLoadingUI,formatBytes} from './loading-ui.js';
const boot=window.shanghaiStartup=createLoadingUI();
async function start(){
 const response=await fetch('./boot-manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('启动清单读取失败，请重新加载');const manifest=await response.json();boot.files=manifest;
 const files=[...manifest.runtime,...manifest.data],total=files.reduce((n,f)=>n+(f.bytes||0),0),loaded=new Map(),contents=new Map();boot.progress.begin('download',total,'正在读取程序和武汉地图…');await nextPaint();
 let cursor=0;const worker=async()=>{while(cursor<files.length){const f=files[cursor++],bytes=await fetchTrackedBytes(f.url,{expectedBytes:f.bytes,onProgress:p=>{loaded.set(f.url,p.loaded);const count=[...loaded.values()].reduce((a,b)=>a+b,0);boot.progress.update('download',count,total,`正在读取${f.label||'图形程序'} · ${formatBytes(count)} / ${formatBytes(total)}`);}});if(f.key)contents.set(f.key,bytes);}};
 await Promise.all(Array.from({length:Math.min(4,files.length)},worker));boot.progress.complete('download');boot.progress.begin('data',manifest.data.length,'正在核对地图数据…');boot.data={};let parsed=0;
 for(const f of manifest.data){await nextPaint();boot.data[f.key]=JSON.parse(new TextDecoder().decode(contents.get(f.key)));contents.delete(f.key);boot.progress.update('data',++parsed,manifest.data.length,`${f.label}已整理`);}boot.progress.complete('data');boot.progress.begin('engine',null,'正在启动3D图形引擎…');await nextPaint();
 await import(/* @vite-ignore */ new URL(manifest.module,location.href).href);
}
start().catch(error=>boot.fail(error));
