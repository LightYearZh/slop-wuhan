import {unpackGeodata} from './geodata-codec.js';

export async function loadGeodata(url,{decodedBytes}={}){
 const browser=typeof window!=='undefined';
 const status=message=>{if(browser){const label=document.getElementById('loading-status');if(label)label.textContent=message;}};
 const started=performance.now();
 try{
  let bytes;
  if(!browser&&typeof process!=='undefined'&&process.versions?.node){
   const moduleName='node:fs/promises';
   const {readFile}=await import(/* @vite-ignore */ moduleName);bytes=new Uint8Array(await readFile(url));
  }else{
   status('正在读取武汉地图…');
   const response=await fetch(url);if(!response.ok)throw Error(`地图读取失败（HTTP ${response.status}）`);
   const size=Number(response.headers.get('Content-Length'));
   const inflated=Boolean(response.headers.get('Content-Encoding'));
   const total=!inflated&&size>0?size:null;
   const chunks=[];let loaded=0;
   if(response.body){
    const reader=response.body.getReader();
    try{while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;status(inflated?'正在读取并解压武汉地图…':`正在读取武汉地图 · ${(loaded/1e6).toFixed(1)}${total?' / '+(total/1e6).toFixed(1):''} MB`);}}
    finally{reader.releaseLock();}
    bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   }else bytes=new Uint8Array(await response.arrayBuffer());
  }
  status('正在解包武汉地图…');
  const geo=await unpackGeodata(bytes,{decodedBytes});
  if(browser)window.wuhanDataLoad={url:url.href,bodyBytes:bytes.length,decodedBytes,elapsedMs:performance.now()-started};
  return geo;
 }catch(error){
  if(browser){
   status('武汉地图未能加载，请刷新重试。'+error.message);
   const overlay=document.getElementById('loading-overlay');overlay?.setAttribute('role','alert');
   const button=document.createElement('button');button.textContent='重新加载';button.className='tool-btn';button.addEventListener('click',()=>location.reload());overlay?.appendChild(button);
  }
  throw error;
 }
}
