import * as THREE from 'three';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa6c5d8);
scene.fog = new THREE.FogExp2(0xa6c5d8,0.00030);
const camera = new THREE.PerspectiveCamera(68,window.innerWidth/window.innerHeight,.15,10000);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xecf4ff,0x7a8d73,2.2));
const sun = new THREE.DirectionalLight(0xfff0ce,2.6);
sun.position.set(-250,400,-350);scene.add(sun);
const terrain = new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshLambertMaterial({color:0xabb49c}));
terrain.rotation.x=-Math.PI/2;terrain.position.y=-.18;scene.add(terrain);

const tiles = new Map();
const terrainLimit=2500;
const TILE_SIZE = 500;
function tileFor(x,z){return `${Math.floor(x/TILE_SIZE)}_${Math.floor(z/TILE_SIZE)}`;}
function batch(key,category){
  if(!tiles.has(key))tiles.set(key,{});
  const t=tiles.get(key);
  return t[category] ??= {positions:[],colors:[]};
}
function rgb(hex){let c=new THREE.Color(hex);return [c.r,c.g,c.b];}
function tri(target, a,b,c, color){
  const {positions,colors}=target;
  positions.push(...a,...b,...c);
  for(let i=0;i<3;i++)colors.push(...color);
}
function stableColor(id){
  let h=2166136261;
  for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
function closeRing(points){
  if(points.length>1 && points[0][0]===points.at(-1)[0] && points[0][1]===points.at(-1)[1])return points.slice(0,-1);
  return points;
}
function polygon(target,points,y,color){
  const ring=closeRing(points);
  if(ring.length<3 || ring.length>3000)return;
  const vertices=ring.map(([x,z])=>new THREE.Vector2(x,z));
  try {
    const faces=THREE.ShapeUtils.triangulateShape(vertices,[]);
    for(const [a,b,c] of faces)tri(target,[ring[a][0],y,ring[a][1]],[ring[b][0],y,ring[b][1]],[ring[c][0],y,ring[c][1]],color);
  }catch(e){/* malformed OSM geometry: skip polygon, don't invent shape */}
}
function makeRoad(road){
  const pts=road.points;
  if(road.tunnel!=='no' && road.tunnel!==undefined)return; // not exposed above surface
  const w=Math.max(1.4,Number(road.width)||5)/2;
  const color=rgb(road.type==='pedestrian'||road.type==='footway'||road.type==='path'?0xcac5b8:0x555d68);
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i];
    const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
    if(d<.05)continue;
    const nx=-dz/d*w,nz=dx/d*w;
    const target=batch(tileFor((a[0]+b[0])/2,(a[1]+b[1])/2),'road');
    const A=[a[0]+nx,.055,a[1]+nz], B=[a[0]-nx,.055,a[1]-nz],
          C=[b[0]+nx,.055,b[1]+nz], D=[b[0]-nx,.055,b[1]-nz];
    tri(target,A,B,C,color);tri(target,B,D,C,color);
  }
}
function makeBuilding(item){
  const ring=closeRing(item.points);
  if(ring.length<3||ring.length>400)return;
  const h=Math.max(2,Math.min(650,Number(item.height)||12));
  let cx=0,cz=0;for(const p of ring){cx+=p[0];cz+=p[1];}cx/=ring.length;cz/=ring.length;
  const tile=tileFor(cx,cz), seed=stableColor(item.id);
  const materialColors=[0xcab8a3,0xbcc3ba,0xb9c9d2,0xd5ccb8,0xc4b6ab,0xbdbeb9];
  const wall=rgb(materialColors[seed%materialColors.length]);
  const roof=rgb([0x696f70,0x8c867d,0x68746d,0x8d7d76][seed%4]);
  polygon(batch(tile,'roof'),ring,h+.07,roof);
  const b=batch(tile,'building');
  for(let i=0;i<ring.length;i++){
    const [ax,az]=ring[i],[bx,bz]=ring[(i+1)%ring.length];
    const A=[ax,0,az],B=[bx,0,bz],C=[ax,h,az],D=[bx,h,bz];
    tri(b,A,B,C,wall);tri(b,B,D,C,wall);
  }
}
function makeArea(obj,kind){
  const pts=closeRing(obj.points);if(pts.length<3)return;
  let cx=0,cz=0;for(const p of pts){cx+=p[0];cz+=p[1];}cx/=pts.length;cz/=pts.length;
  const isWater=kind==='water';
  polygon(batch(tileFor(cx,cz),kind),pts,isWater?-.07:-.11,rgb(isWater?0x4c9db7:0x5e956d));
}
function commitBatches(){
  const colors={building:0xffffff,roof:0xffffff,road:0xffffff,water:0xffffff,park:0xffffff};
  let draws=0,vertices=0;
  for(const groups of tiles.values())for(const [kind,data] of Object.entries(groups)){
    if(!data.positions.length)continue;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
    geometry.computeVertexNormals();
    const material=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:kind==='water',opacity:kind==='water'?.87:1,depthWrite:kind!=='water'});
    const mesh=new THREE.Mesh(geometry,material);
    // Geometry is world-coordinate and batches are keyed by 500m tile. Three.js frustum-culls tiles.
    mesh.frustumCulled=true;scene.add(mesh);draws++;vertices+=data.positions.length/3;
    delete data.positions;delete data.colors;
  }
  return {draws,vertices};
}
let fly=true, yaw=0,pitch=-.27;
const keys = new Set();
camera.position.set(0,115,280);
function updateCameraRotation(){camera.rotation.set(pitch,yaw,0,'YXZ');}
updateCameraRotation();
$('mode').addEventListener('click',toggleMode);
function toggleMode(){fly=!fly;camera.position.y=fly?85:1.75;pitch=fly?-.22:0;updateCameraRotation();$('mode').textContent=fly?'切换为步行视角（F）':'切换为飞行视角（F）';}
window.addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyF'&&!e.repeat)toggleMode();if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>keys.clear());
renderer.domElement.addEventListener('click',()=>renderer.domElement.requestPointerLock?.());
document.addEventListener('pointerlockchange',()=>{$('crosshair').style.display=document.pointerLockElement===renderer.domElement?'block':'none';});
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==renderer.domElement)return;
  yaw-=e.movementX*.0022;pitch=Math.max(-1.4,Math.min(1.4,pitch-e.movementY*.0022));updateCameraRotation();
});
let previous=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-previous)/1000);previous=now;
  const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?4:1)*(fly?45:6)*dt;
  let forward=0,right=0;
  if(keys.has('KeyW'))forward++;if(keys.has('KeyS'))forward--;
  if(keys.has('KeyD'))right++;if(keys.has('KeyA'))right--;
  let norm=Math.hypot(forward,right)||1;forward/=norm;right/=norm;
  camera.position.x+=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed;
  camera.position.z+=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed;
  if(fly){if(keys.has('Space'))camera.position.y+=speed;if(keys.has('KeyC'))camera.position.y-=speed;camera.position.y=Math.max(2,camera.position.y);}
  else camera.position.y=1.75;
  renderer.render(scene,camera);
}
requestAnimationFrame(loop);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
async function load(){
  try{
    const response=await fetch('/web/data/city.json',{cache:'no-store'});
    if(!response.ok)throw Error(`数据文件未生成（HTTP ${response.status}）`);
    const data=await response.json();
    if(!data.roads?.length)throw Error('OSM 数据为空或未包含道路');
    $('status').textContent='已加载真实 OSM 几何数据（高程与部分楼高为估算）';
    for(const p of data.parks||[])makeArea(p,'park');
    for(const p of data.water||[])makeArea(p,'water');
    for(const p of data.roads||[])makeRoad(p);
    for(const p of data.buildings||[])makeBuilding(p);
    const batches=commitBatches();
    const estimated=data.buildings.filter(x=>x.height_source==='visual_estimate').length;
    $('metrics').textContent=`范围 ${data.width_m} × ${data.depth_m}m · 道路 ${data.roads.length} · OSM建筑 ${data.buildings.length}（高度估算 ${estimated}） · 水面 ${data.water.length} · 图形批次 ${batches.draws}`;
    if(!data.water.length)$('metrics').textContent+=' · 注意：OSM没有返回水域面（可能为multipolygon）';
  }catch(e){$('status').textContent='需要先导入 OSM';$('missing').style.display='block';console.warn(e);}
}
load();
