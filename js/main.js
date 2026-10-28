import {footprintPush} from './footprint-buildings.js';
import * as THREE from 'three/webgpu';
import {pass,mrt,output,normalView,positionView,metalness,roughness,vec2,vec3,smoothstep} from 'three/tsl';
import {ssr} from 'three/addons/tsl/display/SSRNode.js';
import {LightingSystem} from './lighting.js';
import {createPostProcessing} from './post-processing.js';
import {ThirdPersonControllerManager,HELICOPTER_MAX_ALTITUDE} from './controllers.js';
import {CameraSystem} from './cameras.js';
import {cityUniforms} from './tsl-materials.js';
import {createCityScene} from './city-scene.js';
import {createShanghaiTraffic} from './traffic-shanghai.js';
import {createMap} from './map.js';
import {vehicleLateralLimit} from './vehicle-road.js';
import {metroArrivalTarget} from './metro-layout.js';
import {fetchTrackedBytes,nextPaint} from './loading-progress.js';
import {createDestinationNavigator,assertModeAllowed} from './destination-navigation.js';
import {SurfaceProvider,CollisionWorld,TileLoader,projectWgs84,unprojectWorld,constrainTunnelCamera,clamp} from './core.js';

const $=id=>document.getElementById(id),boot=window.shanghaiStartup,start=boot?.progress.started??performance.now();
const bootMarks=[];function status(text){$('loading-text').textContent=text;bootMarks.push({text,ms:performance.now()-start});}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3500);}
async function init(){
 status('读取汉口试验区道路与城市块…');
 const [data,manifest,metro]=boot?.data?[boot.data.city,boot.data.manifest,boot.data.metro]:await Promise.all(['./data/city.json','./data/manifest.json','./data/metro.json'].map(async u=>{const r=await fetch(u);if(!r.ok)throw Error('城市数据加载失败');return r.json();}));
 data.metroStations=metro.stations;
 status('准备天空、光线和材质…');boot?.progress.begin('engine',2,'正在连接图形设备…');await nextPaint();
 const renderer=new THREE.WebGPURenderer({antialias:true,powerPreference:'high-performance',reversedDepthBuffer:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
 renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;$('scene').append(renderer.domElement);await renderer.init();
 boot?.progress.update('engine',1,2,'图形设备已连接');await nextPaint();const scene=new THREE.Scene(),lighting=new LightingSystem(scene,renderer);lighting.sunLight.shadow.mapSize.set(2048,2048);lighting.sky.scale.setScalar(600000);
 const surface=new SurfaceProvider([...data.roads,...data.tunnels],data.water,data.rampCuts),world=new CollisionWorld();
 boot?.progress.complete('engine');boot?.progress.begin('scene',8,'正在构建武汉天际线与街道…');await nextPaint();
 const city=await createCityScene(scene,data,world,surface,async(done,label)=>{boot?.progress.update('scene',done,8,label);await nextPaint();}),traffic=createShanghaiTraffic(scene,data.schemaVersion>=3?[]:data.roads,data.rampCuts);
 const controllers=new ThirdPersonControllerManager(scene,[]);controllers.surfaceProvider=surface;controllers.worldBounds=data.bounds;
 controllers.nearColliders=(x,z,r)=>world.query({minX:x-r,maxX:x+r,minY:controllers.getActiveEntity().position.y-1,maxY:controllers.getActiveEntity().position.y+3,minZ:z-r,maxZ:z+r});
 const cameras=new CameraSystem(renderer.domElement,controllers);boot?.progress.update('scene',7,8,'人物、车辆与相机已准备');await nextPaint();
 let startupTiles=new Set(),startupReady=new Set();
 const loader=new TileLoader(manifest,async(t,signal)=>{if(t.inline){const b=t.bounds;return {id:t.id,buildings:[],roads:[],land:[],parks:[],shoulders:[],water:t.inline==='water'?[[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]]]:[]};}if(boot&&!boot.progress.ready){const bytes=await fetchTrackedBytes(t.url,{signal,expectedBytes:t.bytes,onProgress:p=>boot.progress.update('tiles',startupReady.size,startupTiles.size,`街区 ${t.id} · 已读取 ${Math.round(p.loaded/1000)} / ${Math.round(p.total/1000)} KB`)});const tile=JSON.parse(new TextDecoder().decode(bytes));await nextPaint();return tile;}const r=await fetch(t.url,{signal});if(!r.ok)throw Error('街区暂时未能加载');return r.json();},(tile,meta)=>{const handle=city.mountTile(tile,meta);if(startupTiles.has(meta.id)){startupReady.add(meta.id);boot?.progress.update('tiles',startupReady.size,startupTiles.size,`出发街区 ${startupReady.size} / ${startupTiles.size} 已就绪`);}return handle;});
 const rootRoad=surface.nearest(data.spawn.x,data.spawn.z,r=>r.mode==='car'&&!r.tunnel);
 if(!rootRoad)throw Error('武汉数据没有可用出发道路');
 const spawn={x:rootRoad.x,z:rootRoad.z,y:2.12};
 for(const [i,e]of Object.values(controllers.entities).entries()){e.position.set(spawn.x+i*4,2.12,spawn.z);e.heading=data.spawn.heading||0;e.mesh.rotation.order='YXZ';}
 controllers.entities.car.position.set(spawn.x,2.12,spawn.z);controllers.entities.helicopter.position.y=110;
 startupTiles=new Set([...loader.tilesAt(spawn).map(t=>t.id),...(manifest.routes||[]).flatMap(r=>r.tiles)]);boot?.progress.complete('scene');boot?.progress.begin('tiles',startupTiles.size,'正在读取初始街区与跨江线路…');await nextPaint();await loader.ensureAt(spawn,'car');await Promise.all(data.tunnels.map(t=>loader.ensureRoute(t.id)));boot?.progress.complete('tiles');boot?.progress.begin('render',null,'正在准备光影材质与第一帧画面…');await nextPaint();
 const camera=cameras.camera;camera.near=.15;camera.far=16000;camera.updateProjectionMatrix();
 const scenePass=pass(scene,camera);scenePass.setMRT(mrt({output,normal:normalView,metalRough:vec2(metalness,roughness)}));
 const reflections=ssr(scenePass.getTextureNode('output'),scenePass.getTextureNode('depth'),scenePass.getTextureNode('normal'),{metalnessNode:scenePass.getTextureNode('metalRough').r,roughnessNode:scenePass.getTextureNode('metalRough').g,camera});
 reflections.resolutionScale=.35;reflections.quality.value=.25;reflections.maxDistance.value=48;reflections.intensity.value=.4;reflections.blurQuality=1;
 const post=createPostProcessing(renderer,scenePass.getTextureNode('output'),reflections),pipeline=new THREE.RenderPipeline(renderer,post.outputNode);
 let fixedView=null,last=performance.now(),elapsed=0,frame=0,lastHud=0,quality='medium',ready=false,lastBlocked=0,lastModeHint=0,loadingAhead=false;
 const samples=[],errors=[],longTasks=[];let maxSamples=24000;
 new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.duration>200)longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
 function setTime(id){lighting.applyPreset(id);post.applyPreset(id);document.querySelectorAll('[data-time]').forEach(b=>b.classList.toggle('active',b.dataset.time===id));}
 function resetCamera(){fixedView=null;cameras.initialized=false;cameras.activePresetId='chase';cameras.orbitYawOffset=0;cameras.orbitPitchOffset=.09;$('camera-label').textContent='第三人称跟随';}
 let arrivalRevision=0;
 async function prepareLanding(x,z,mode,revision){
  await loader.ensureAt({x,z},mode);if(revision!==arrivalRevision)return false;
  const radius={person:.6,cyclist:1.2,car:2.6,helicopter:3}[mode]||2.6;
  for(const p of surface.landingCandidates(x,z,mode)){
   if(!loader.tilesAt(p).length)continue;
   try{await loader.ensureAt(p,mode);}catch(e){if(revision!==arrivalRevision)return false;throw e;}
   if(revision!==arrivalRevision)return false;
   const b={minX:p.x-radius,maxX:p.x+radius,minY:p.y??2.12,maxY:(p.y??2.12)+2,minZ:p.z-radius,maxZ:p.z+radius};
   const occupied=world.query(b).some(c=>{if(c.rings)return !!footprintPush(p.x,p.z,radius,c.rings);if(!c.obb)return true;const o=c.obb,dx=p.x-o.cx,dz=p.z-o.cz;return Math.abs(dx*o.cs-dz*o.sn)<o.hx+radius&&Math.abs(dx*o.sn+dz*o.cs)<o.hz+radius;});
   if(!occupied&&surface.canTraverse({...p,mode})&&(p.road?.bridge||!surface.isWater(p.x,p.z)))return p;
  }
  throw Error('附近暂无安全落点');
 }
 function arrive(p,mode,heading,surfaceId=null){
  controllers.setMode(mode);const e=controllers.getActiveEntity();e.position.set(p.x,p.y??2.12,p.z);e.heading=heading;e.surfaceId=surfaceId;e.surface=null;e.speed=e.verticalVel=e.verticalSpeed=e.vx=e.vz=e.angularVel=0;
  controllers.resetInput();controllers.clearGamepadInput();resetCamera();document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));return e.position;
 }
 const navigator=createDestinationNavigator({maxAltitude:HELICOPTER_MAX_ALTITUDE,nextRevision:()=>++arrivalRevision,isCurrent:r=>r===arrivalRevision,getState:()=>({mode:controllers.activeMode,position:controllers.getActiveEntity().position,inTunnel:!!controllers.getActiveEntity().surface?.tunnel}),prepare:(target,mode,revision)=>prepareLanding(target.x,target.z,mode,revision),arrive});
 async function teleport(x,z,heading=0,mode=controllers.activeMode){return navigator.travel({x,z},{mode,heading});}
 const baseDestinations=[...data.landmarks,...(data.places||[])],destinations=[...baseDestinations,...data.metroStations];
 async function gotoLandmark(id,{mode=controllers.activeMode}={}){const l=destinations.find(l=>l.id===id);if(!l)return false;try{const target=l.metro?metroArrivalTarget(l,mode):l.arrival?{...l,...l.arrival}:l;if(!await teleport(target.x,target.z,l.metro?l.entrance.heading+Math.PI:l.arrival?Math.atan2(l.x-target.x,l.z-target.z):0,mode))return false;$('map-modal').hidden=true;$('places').hidden=true;$('search').blur();toast('已到达 '+l.name+(mode==='helicopter'?' 上空':l.metro?' 入口附近':' 附近'));return true;}catch(e){toast(e.message+'，请重试');return false;}}
 async function setMode(mode){
  if(!controllers.entities[mode])return false;
  if(mode===controllers.activeMode){arrivalRevision++;return true;}
  const previous=controllers.getActiveEntity();if(previous.surface?.tunnel&&mode!=='car'){toast('驶出隧道后可切换漫游模式');return false;}
  const revision=++arrivalRevision,old=previous.position.clone(),heading=previous.heading;
  try{const p=mode==='helicopter'?{x:old.x,z:old.z,y:Math.max(80,old.y)}:await prepareLanding(old.x,old.z,mode,revision);if(!p)return false;await loader.ensureAt(p,mode);if(revision!==arrivalRevision)return false;assertModeAllowed({inTunnel:!!controllers.getActiveEntity().surface?.tunnel},mode);arrive(p,mode,heading);return true;}catch(e){if(revision===arrivalRevision)toast(e.message+'，请重试');return false;}
 }
 const map=createMap(data,gotoLandmark,()=>city.streetTiles,{cancelTravel:()=>navigator.cancel()});
 for(const l of baseDestinations){const b=document.createElement('button');b.textContent=l.name;b.onclick=()=>gotoLandmark(l.id);$('places').append(b);}
 const metroButton=document.createElement('button');metroButton.textContent='M 地铁站查询';metroButton.onclick=()=>{$('places').hidden=true;controllers.resetInput();map.open({type:'metro'});};$('places').append(metroButton);
 for(const t of data.tunnels){const b=document.createElement('button');b.textContent=t.points[0][0]<0?'驾车过江 · 浦西入口':'驾车过江 · 浦东入口';b.onclick=async()=>{const revision=++arrivalRevision;try{await loader.ensureRoute(t.id);if(revision!==arrivalRevision)return;const p=t.points[0],q=t.points[1];arrive({x:p[0],y:p[1],z:p[2]},'car',Math.atan2(q[0]-p[0],q[2]-p[2]),t.id);$('places').hidden=true;toast('沿坡道驶入，可连续驾车过江');}catch(e){if(revision===arrivalRevision)toast('跨江线路未就绪，停留在当前道路。请重试');}};$('places').append(b);}
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
 document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>setTime(b.dataset.time));
 function toggleMap(){const m=$('map-modal');if(m.hidden){controllers.resetInput();map.open();}else{m.hidden=true;$('search').blur();}}
 $('map-button').onclick=toggleMap;$('mini-map').onclick=toggleMap;$('close-map').onclick=()=>{$('map-modal').hidden=true;$('search').blur();};
 $('places-button').onclick=()=>$('places').hidden=!$('places').hidden;
 const presets=['chase','action','pov'],labels=['第三人称跟随','低机位跟随','第一人称视角'];function cycleCamera(){fixedView=null;let i=(presets.indexOf(cameras.activePresetId)+1)%3;cameras.activePresetId=presets[i];$('camera-label').textContent=labels[i];}
 $('camera-button').onclick=cycleCamera;$('hide-ui').onclick=()=>document.body.classList.toggle('clean');
 $('quality').onchange=e=>{quality=e.target.value;renderer.setPixelRatio(quality==='low'?.75:quality==='high'?1.25:1);reflections.intensity.value=quality==='low'?.1:.4;renderer.shadowMap.enabled=quality!=='low';};
 document.addEventListener('keydown',e=>{if(e.code==='Escape'){$('map-modal').hidden=true;$('places').hidden=true;$('search').blur();document.body.classList.remove('clean');return;}if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const modes=['person','car','cyclist','helicopter'];if(/^[1-4]$/.test(e.key))setMode(modes[+e.key-1]);if(e.code==='KeyM')toggleMap();if(e.code==='KeyV')cycleCamera();});
 addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);cameras.onResize(innerWidth,innerHeight);});
 const views=[
  {name:'汉口试验区俯瞰',position:[0,1500,1000],target:[0,0,0]},
  {name:'江汉关钟楼近景',position:[data.landmarks[0].x+32,24,data.landmarks[0].z-67],target:[data.landmarks[0].x,24,data.landmarks[0].z]},
  {name:'江汉路望江汉关',position:[-187.747,7,632.529],target:[data.landmarks[0].x,20,data.landmarks[0].z]},
  {name:'沿江大道出发点',position:[spawn.x-45,28,spawn.z+55],target:[spawn.x,5,spawn.z]},
 ];
 const app={data,manifest,renderer,scene,lighting,controllers,cameras,surface,world,loader,city,traffic,map,views,bootMarks,samples,errors,longTasks,teleport,gotoLandmark,setMode,setTime,
  get ready(){return ready;},get quality(){return quality;},get fixedView(){return fixedView;},
  setView(index){const v=typeof index==='number'?views[index]:index;fixedView=v;camera.position.set(...v.position);camera.lookAt(...v.target);},
  follow(){resetCamera();},metrics(){const sorted=samples.slice().sort((a,b)=>a-b);return {frames:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],memory:renderer.info.memory,render:renderer.info.render,loadedTiles:city.loaded.size,errors:errors.slice(),bootMs:app.bootMs};}
 };
 window.wuhan=app;window.shanghai=app; // Upstream inspection compatibility.
 addEventListener('error',e=>errors.push(String(e.message)));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 function advance(dt){
  const e=controllers.getActiveEntity(),prev=e.position.clone(),old=e.surface;
  controllers.update(dt,elapsed);
  if(!surface.canTraverse({x:e.position.x,y:e.position.y,z:e.position.z,mode:controllers.activeMode})){e.position.copy(prev);e.speed=0;const stamp=performance.now();if(stamp-lastModeHint>2000){lastModeHint=stamp;toast('隧道仅限汽车通行，请切换驾驶模式');}}
  if(!loader.readyAt(e.position)){
   const pending={x:clamp(e.position.x,data.bounds[0],data.bounds[2]),z:clamp(e.position.z,data.bounds[1],data.bounds[3])};e.position.copy(prev);e.speed=0;
   if(!loadingAhead&&performance.now()-lastBlocked>1500){loadingAhead=true;lastBlocked=performance.now();loader.ensureAt(pending,controllers.activeMode).catch(()=>toast('前方街区未就绪，已停在有效道路。请稍后重试')).finally(()=>loadingAhead=false);}
  }
  if(controllers.activeMode==='car'&&(old?.road?.tunnel||old?.road?.bridge)){
   const p=surface.nearest(e.position.x,e.position.z,r=>r.id===old.road.id);
   const atEnd=p.segment===old.road.points.length-2&&p.t>=1||p.segment===0&&p.t<=0;
   if(!atEnd){
    const limit=vehicleLateralLimit(e.heading,p.b[0]-p.a[0],p.b[2]-p.a[2],old.road.width);
    if(p.distance>limit){const factor=limit/p.distance;e.position.x=p.x+(e.position.x-p.x)*factor;e.position.z=p.z+(e.position.z-p.z)*factor;e.speed*=.85;}
    e.surface=surface.sample({x:e.position.x,z:e.position.z,y:p.height,mode:'car',surfaceId:old.road.id});e.surfaceId=e.surface.surfaceId;e.position.y=e.surface.height;
   }
  }
  if(controllers.activeMode!=='helicopter'&&e.surfaceId==='ground'&&surface.isWater(e.position.x,e.position.z)){e.position.copy(prev);e.speed=0;}
  if(controllers.activeMode==='car'&&e.surface){const n=e.surface.normal;e.mesh.rotation.x=Math.atan2(n.x*Math.sin(e.heading)+n.z*Math.cos(e.heading),n.y);}
  e.mesh.position.copy(e.position);
 }
 // Match the scene pass's target and MRT while warming its actual visible materials.
 for(const [mode,entity]of Object.entries(controllers.entities))entity.mesh.visible=mode===controllers.activeMode;
 controllers.poseCharacters(0);lighting.update(controllers.getActiveEntity().position);cameras.update(0,0);city.update(0,camera);const previousTarget=renderer.getRenderTarget(),previousMRT=renderer.getMRT();
 renderer.setRenderTarget(scenePass.renderTarget);renderer.setMRT(scenePass.getMRT());
 try{await renderer.compileAsync(scene,camera,null,event=>boot?.progress.update('render',event.loaded,event.total+1,`光影材质 ${event.loaded} / ${event.total} 已准备`));}finally{renderer.setRenderTarget(previousTarget);renderer.setMRT(previousMRT);}
 for(let i=0;i<3;i++){pipeline.render();if(renderer.backend.device?.queue)await renderer.backend.device.queue.onSubmittedWorkDone();await nextPaint();}
 ready=true;app.bootMs=performance.now()-start;if(boot){bootMarks.unshift(...boot.marks);await boot.finish();}else $('loading').hidden=true;toast('欢迎来到武汉 · W A S D 自由漫游');last=performance.now();
 renderer.setAnimationLoop(()=>{
  const now=performance.now(),ms=now-last;last=now;const dt=Math.min(.06,ms/1000);elapsed+=dt;frame++;
  if(ready&&!document.hidden){samples.push(ms);if(samples.length>maxSamples)samples.splice(0,1000);}
  for(let remaining=dt;remaining>.00001;){const d=Math.min(remaining,1/60);advance(d);remaining-=d;}
  const e=controllers.getActiveEntity();for(const [mode,entity]of Object.entries(controllers.entities))entity.mesh.visible=mode===controllers.activeMode;controllers.poseCharacters(dt);lighting.update(e.position);
  if(!fixedView){cameras.update(dt,elapsed);if(e.surface?.tunnel){const p=constrainTunnelCamera(camera.position,{...e.position,heading:e.heading},e.surface.road.width,5.8,e.surface.road);camera.position.set(p.x,p.y,p.z);camera.lookAt(e.position.x+Math.sin(e.heading)*5,e.position.y+1.4,e.position.z+Math.cos(e.heading)*5);}}
  city.update(elapsed,camera);if(traffic.streetRevision!==city.streetRevision&&data.schemaVersion>=3){traffic.setRoads([...city.streetTiles.values()].flatMap(t=>t.roads));traffic.streetRevision=city.streetRevision;}traffic.update(dt,e.position,camera.position);
  if(frame%30===0)loader.update(e.position,controllers.activeMode);
  if(now-lastHud>250){
   lastHud=now;const mode=controllers.activeMode;const names={person:'滨江步行',car:'武汉出租车',cyclist:'城市骑行',helicopter:'长江观光直升机'};
   $('mode-label').textContent=names[mode];$('speed').textContent=Math.round(Math.abs(e.speed)*3.6);$('speed-meter').style.width=Math.min(100,Math.abs(e.speed)*3.6)+'%';$('fps').textContent=Math.round(1000/ms)+' fps';$('altitude').textContent=mode==='helicopter'?Math.round(e.position.y)+' m':e.surface?.tunnel?'隧道内':'';
   const near=surface.nearest(e.position.x,e.position.z,r=>!!r.name&&!r.tunnel);$('road-label').textContent=e.surface?.tunnel?'未开放隧道':near?.distance<500?near.road.name:surface.isWater(e.position.x,e.position.z)?'武汉水域':'武汉街区';
   $('controls-hint').innerHTML=mode==='helicopter'?'<kbd>W</kbd><kbd>S</kbd> 俯仰　<kbd>A</kbd><kbd>D</kbd> 偏航　<kbd>E</kbd> 上升　<kbd>Q</kbd> 下降　拖动环视':'<kbd>W</kbd><kbd>S</kbd> 前进 / 后退　<kbd>A</kbd><kbd>D</kbd> 转向　<kbd>Shift</kbd> 加速　拖动环视';map.update(e.position,e.heading);
  }
  pipeline.render();
 });
}
init().catch(e=>{if(boot)boot.fail(e);else{console.error(e);$('loading-text').textContent='暂时未能启动：'+e.message;$('loading-retry').hidden=false;}});
