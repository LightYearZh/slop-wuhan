import * as THREE from 'three/webgpu';
import {PersonCrowd,PersonRig} from './pedestrians.js';
import {groundHeightAt,isTypingInField} from './city-config.js';
import {createTaxiNetwork} from './taxi-network.js';
import {TaxiTrip,taxiFare,TAXI_STOP} from './taxi-trip.js';
import {projectPath} from './taxi-routing.js';
import './taxi-fare.css';

const metres=n=>n>=1000?`${(n/1000).toFixed(1)} 公里`:`${Math.round(n)} 米`;
const money=n=>`¥${n.toFixed(1)}`;
const duration=s=>`${Math.floor(s/60)}分${Math.floor(s%60).toString().padStart(2,'0')}秒`;
const ground=(_owner,x,z)=>groundHeightAt(x,z);
export function createTaxiService(scene,{controllers,getMap,goToStand}){
 const {router,jobs,stops}=createTaxiNetwork(),trip=new TaxiTrip();
 const root=new THREE.Group();root.name='WuhanTaxiService';scene.add(root);
 const color=0xffc61a;
 const marker=new THREE.Group();
 const markerMaterial=new THREE.MeshBasicNodeMaterial({color,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide});
 const ring=new THREE.Mesh(new THREE.RingGeometry(2.4,3,48),markerMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.18;marker.add(ring);
 const tip=new THREE.Mesh(new THREE.ConeGeometry(.5,1,16),markerMaterial);tip.rotation.z=Math.PI;tip.position.y=4;marker.add(tip);root.add(marker);marker.visible=false;
 const routeMaterial=new THREE.MeshBasicNodeMaterial({color,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
 const ribbon=new THREE.Mesh(new THREE.BufferGeometry(),routeMaterial);root.add(ribbon);ribbon.visible=false;
 const crowd=new PersonCrowd(1,{farDistance:Infinity}),rig=new PersonRig({seed:35.4,female:true,hair:.42,scale:1,girth:1});
 crowd.meshes.forEach(m=>{m.name='TaxiPassenger';scene.add(m);});crowd.begin();crowd.end();
 let passengerPlaced=false,passengerPosition=null,lastPhase='idle',lastRevision=-1,refresh=0,routeRemaining=0,offRoute=false,lastJob=null,lastNav=null;

 const panel=document.createElement('section');panel.id='taxi-service';panel.setAttribute('aria-label','出租车接送任务');
 panel.innerHTML=`<header><h2>出租车接送</h2><span id="taxi-shift">当班 ¥0.0 · 0单</span></header><p id="taxi-status" role="status" aria-live="polite">自由漫游，随时接单</p><h3 id="taxi-place">沿着江岸，送一程</h3><p id="taxi-detail">汉口短途 · 有乘客和道路导航</p><div id="taxi-hold" hidden><span></span></div><div id="taxi-actions"><button id="taxi-primary" type="button">开始接单 <kbd>T</kbd></button><button id="taxi-secondary" type="button" hidden>取消本单</button><button id="taxi-stand" type="button" hidden>前往江汉关候客区</button></div>`;
 document.body.append(panel);
 const status=panel.querySelector('#taxi-status'),place=panel.querySelector('#taxi-place'),detail=panel.querySelector('#taxi-detail'),primary=panel.querySelector('#taxi-primary'),secondary=panel.querySelector('#taxi-secondary'),stand=panel.querySelector('#taxi-stand'),hold=panel.querySelector('#taxi-hold');
 let needsStand=false;
 function offer(){
  if(controllers.activeMode!=='car')return;
  const car=controllers.getActiveEntity();
  const choices=jobs.map(job=>({job,path:router.route(car.position,job.pickup)})).filter(o=>o.path&&o.path.length<2500).sort((a,b)=>a.path.length-b.path.length);
  const candidate=choices.find(o=>o.job.id!==lastJob)||choices[0];
  if(!candidate){trip.cancel('请先到汉口沿江大道候客区');needsStand=true;render();return;}
  needsStand=false;lastJob=candidate.job.id;trip.offer(candidate.job,candidate.path);refresh=0;render();
 }
 primary.onclick=()=>{if(trip.phase==='offer')trip.accept();else if(trip.phase==='idle'||trip.phase==='complete')offer();render();};
 secondary.onclick=()=>{trip.cancel('已结束接送，可以继续自由漫游');needsStand=false;render();};
 stand.onclick=()=>{trip.cancel();goToStand(stops[0]);needsStand=false;render();};
 const onKey=e=>{if(e.code==='KeyT'&&!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!isTypingInField(e)&&controllers.activeMode==='car'){e.preventDefault();if(!primary.hidden)primary.click();}};
 window.addEventListener('keydown',onKey);
 function render(){
  panel.hidden=controllers.activeMode!=='car';panel.dataset.phase=trip.phase;
  panel.querySelector('#taxi-shift').textContent=`当班 ${money(trip.earned)} · ${trip.completed}单`;
  primary.hidden=trip.active;secondary.hidden=trip.phase==='idle';stand.hidden=!needsStand;
  if(trip.phase==='idle'){
   status.textContent=trip.message;place.textContent='沿着江岸，送一程';detail.textContent='汉口短途 · 有乘客和道路导航';primary.textContent='开始接单  T';
  }else if(trip.phase==='offer'){
   status.textContent=`短途订单 · ${trip.job.passenger}`;place.textContent=trip.job.pickup.name;detail.textContent=`送往 ${trip.job.drop.name} · ${metres(trip.job.trip.length)} · 约${Math.ceil(trip.job.trip.length/8/60)}分钟 · 预计${money(taxiFare(trip.job.trip.length,trip.job.trip.length/8))}`;primary.textContent='接这一单  T';
  }else if(trip.phase==='pickup'||trip.phase==='ride'){
   const pickup=trip.phase==='pickup';status.textContent=pickup?`去接 ${trip.job.passenger}`:`乘客在车上 · 已行驶${metres(trip.distance)}`;place.textContent=trip.target.name;
   detail.textContent=offRoute?'已偏离推荐路线，正在重新规划':`${metres(routeRemaining)} · ${routeRemaining<12?'停稳约2秒即可'+(pickup?'接客':'送达'):'跟随地图与路面导航'}${pickup?'':` · 已用时${duration(trip.seconds)}`}`;
  }else if(trip.phase==='boarding'||trip.phase==='alighting'){
   status.textContent=trip.phase==='boarding'?'乘客正在上车，请保持停车':'乘客正在下车，请保持停车';place.textContent=trip.target.name;detail.textContent=trip.phase==='boarding'?`下一站：${trip.job.drop.name}`:'即将结算本次行程';
  }else{
   status.textContent=`行程完成 · 收入 ${money(trip.result.fare)}`;place.textContent='谢谢，路上辛苦了';detail.textContent=`${metres(trip.result.distance)} · ${duration(trip.result.seconds)} · 已送达${trip.result.to}`;primary.textContent='再接一单  T';secondary.textContent='结束接送';
  }
  if(trip.phase!=='complete')secondary.textContent='取消本单';
  hold.hidden=!(trip.hold>0);hold.firstElementChild.style.transform=`scaleX(${Math.min(1,trip.hold/TAXI_STOP.hold)})`;
 }
 function drawRibbon(points){
  const positions=[];let length=0;
  for(let i=1;i<points.length&&length<260;i++){
   const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<.05)continue;length+=l;
   const nx=-dz/l*.45,nz=dx/l*.45,y=.16;
   positions.push(a.x+nx,a.y+y,a.z+nz,a.x-nx,a.y+y,a.z-nz,b.x+nx,b.y+y,b.z+nz,b.x+nx,b.y+y,b.z+nz,a.x-nx,a.y+y,a.z-nz,b.x-nx,b.y+y,b.z-nz);
  }
  ribbon.geometry.dispose();ribbon.geometry=new THREE.BufferGeometry();ribbon.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));ribbon.geometry.computeBoundingSphere();ribbon.visible=positions.length>0;
 }
 function navigation(){
  const target=trip.target;if(!target||!trip.route){marker.visible=ribbon.visible=false;lastNav=null;getMap()?.setTaxiNavigation(null);return;}
  const car=controllers.getActiveEntity(),projected=projectPath(trip.route.points,car.position);
  offRoute=!projected||projected.distance>22;
  if(offRoute){const replacement=router.route(car.position,target);if(replacement){trip.route=replacement;offRoute=false;}}
  const progress=projectPath(trip.route.points,car.position);routeRemaining=progress?progress.remaining:trip.route.length;
  const points=progress?[{x:progress.x,y:progress.y,z:progress.z},...trip.route.points.slice(progress.index)]:trip.route.points;
  const tint=trip.phase==='pickup'||trip.phase==='boarding'?0xffc61a:0x72d7e4;markerMaterial.color.setHex(tint);routeMaterial.color.setHex(tint);
  marker.position.set(target.x,target.y,target.z);marker.visible=true;drawRibbon(points);
  lastNav={points,target,color:trip.phase==='pickup'||trip.phase==='boarding'?'#ffc61a':'#72d7e4',label:trip.phase==='pickup'||trip.phase==='boarding'?'接':'送'};getMap()?.setTaxiNavigation(lastNav);
 }
 function updatePassenger(dt){
  const phase=trip.phase,target=trip.target;
  if(!trip.job||phase==='idle'||phase==='offer'||phase==='ride'){crowd.begin();crowd.end();passengerPlaced=false;return;}
  const car=controllers.getActiveEntity(),end=phase==='complete'?trip.job.drop.curb:target?.curb;if(!end)return;
  let p=end;
  if(phase==='boarding'){
   const u=Math.min(1,trip.animation/2);p={x:end.x+(car.position.x-end.x)*u,y:end.y,z:end.z+(car.position.z-end.z)*u};
  }else if(phase==='alighting'){
   const u=Math.min(1,trip.animation/2);p={x:car.position.x+(end.x-car.position.x)*u,y:end.y,z:car.position.z+(end.z-car.position.z)*u};
  }
  const yaw=passengerPosition?Math.atan2(p.x-passengerPosition.x,p.z-passengerPosition.z):trip.job.pickup.heading;
  if(!passengerPlaced){rig.reset(p.x,p.z,yaw,ground,controllers);passengerPlaced=true;}
  rig.update(dt,p.x,p.z,yaw,ground,controllers);passengerPosition={...p};crowd.begin();crowd.add(rig);crowd.end();
 }
 function update(dt,elapsed){
  if(controllers.activeMode!=='car'&&(trip.active||trip.phase==='offer'))trip.cancel('已结束本单：切换了移动方式');
  trip.update(dt,controllers.getActiveEntity(),{mode:controllers.activeMode,paused:document.hidden||getMap()?.isFullMapOpen});
  if(trip.phase!==lastPhase){lastPhase=trip.phase;refresh=0;}
  refresh-=dt;if(refresh<=0||trip.revision!==lastRevision){navigation();render();refresh=.5;lastRevision=trip.revision;}
  if(trip.hold>0){hold.hidden=false;hold.firstElementChild.style.transform=`scaleX(${trip.hold/TAXI_STOP.hold})`;}else hold.hidden=true;
  updatePassenger(dt);tip.position.y=4+Math.sin(elapsed*2)*.12;
 }
 render();
 return{update,cancelForTravel:message=>{if(trip.active||trip.phase==='offer')trip.cancel(message);},get state(){return{phase:trip.phase,job:trip.job,route:trip.route,result:trip.result,hold:trip.hold,events:trip.events,earned:trip.earned,completed:trip.completed};},get network(){return{jobs,stops};}};
}
