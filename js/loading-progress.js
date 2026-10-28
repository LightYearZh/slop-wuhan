export const BOOT_STAGES=[{id:'download',label:'读取程序与地图'},{id:'data',label:'整理城市数据'},{id:'engine',label:'准备图形引擎'},{id:'scene',label:'构建城市场景'},{id:'tiles',label:'准备出发街区'},{id:'render',label:'准备光影与首帧'}];
export class BootProgress{
 constructor({now=()=>performance.now(),onChange=()=>{}}={}){this.now=now;this.onChange=onChange;this.started=now();this.active=BOOT_STAGES[0].id;this.activeStarted=this.started;this.states=new Map(BOOT_STAGES.map(s=>[s.id,{...s,loaded:0,total:null,done:false}]));this.ready=false;this.error=null;this.detail='正在连接本地资源…';}
 emit(){this.onChange(this.snapshot());}
 begin(id,total=null,detail=''){if(!this.states.has(id))throw Error('Unknown startup stage');this.active=id;this.activeStarted=this.now();this.detail=detail;const s=this.states.get(id);s.total=total>0?total:null;this.emit();}
 update(id,loaded,total,detail){const s=this.states.get(id);if(!s||this.error||this.ready)return;s.total=total>0?total:null;s.loaded=Math.max(0,Math.min(s.total??Infinity,loaded));if(detail!==undefined)this.detail=detail;this.emit();}
 complete(id,detail){const s=this.states.get(id);if(!s)throw Error('Unknown startup stage');s.done=true;s.total=s.total||1;s.loaded=s.total;if(detail!==undefined)this.detail=detail;this.emit();}
 fail(error){this.error=String(error?.message||error);this.emit();}
 markReady(){if(this.error||[...this.states.values()].some(s=>!s.done))throw Error('Startup is not complete');this.ready=true;this.emit();}
 snapshot(){const stages=[...this.states.values()].map(s=>({...s,ratio:s.done?1:s.total?s.loaded/s.total:0})),stage=stages.find(s=>s.id===this.active);return {stages,stage,index:stages.indexOf(stage),percent:this.ready?100:Math.min(99,stages.reduce((n,s)=>n+s.ratio,0)/stages.length*100),ready:this.ready,error:this.error,detail:this.detail,elapsedMs:this.now()-this.started,stageElapsedMs:this.now()-this.activeStarted};}
}
export async function fetchTrackedBytes(url,{expectedBytes=null,onProgress=()=>{},signal,fetchImpl=fetch}={}){
 let response;try{response=await fetchImpl(url,{signal});}catch(error){if(error.name==='AbortError')throw error;throw Error(`资源未能读取，请重试 · ${url}`,{cause:error});}if(!response.ok)throw Error(`HTTP ${response.status} · ${url}`);
 const header=Number(response.headers.get('Content-Length'));const total=expectedBytes>0?expectedBytes:!response.headers.get('Content-Encoding')&&header>0?header:null;
 let loaded=0;const chunks=[];onProgress({loaded,total,done:false});
 if(response.body){const reader=response.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;loaded+=value.byteLength;chunks.push(value);onProgress({loaded,total,done:false});}}finally{reader.releaseLock();}}
 else{const value=new Uint8Array(await response.arrayBuffer());loaded=value.length;chunks.push(value);onProgress({loaded,total,done:false});}
 if(total!==null&&loaded!==total)throw Error(`资源长度与版本不一致，请重试 · ${url}`);
 const bytes=new Uint8Array(loaded);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}onProgress({loaded,total,done:true});return bytes;
}
export const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
