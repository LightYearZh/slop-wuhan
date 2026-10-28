import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {metroParts,metroColliders,metroFloorRoad} from './metro-layout.js';
function stationTexture(station){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const c=canvas.getContext('2d');
 c.fillStyle='#f4f3e8';c.fillRect(0,0,768,192);c.fillStyle='#dc243b';c.fillRect(0,176,768,16);
 c.beginPath();c.arc(78,80,51,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.font='900 66px Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('M',78,83);
 c.fillStyle='#202e32';c.textAlign='left';c.font=`700 ${Math.min(58,560/station.name.length)}px system-ui,sans-serif`;c.fillText(station.name,151,69);
 c.fillStyle='#536268';c.font='25px system-ui,sans-serif';c.fillText('地铁入口  ↓  '+station.lines.map(n=>n==='41'?'浦江线':n+'号线').join(' / '),151,132);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function createMetroSystem(stations=[]){
 const byTile=new Map();for(const s of stations){const id=s.entrance.tileId;if(!byTile.has(id))byTile.set(id,[]);byTile.get(id).push(s);}
 const materials={steel:new THREE.MeshStandardNodeMaterial({color:0x56686b,metalness:.45,roughness:.4}),glass:new THREE.MeshStandardNodeMaterial({color:0x9ebbc3,transparent:true,opacity:.32,roughness:.25,side:THREE.DoubleSide,depthWrite:false}),floor:new THREE.MeshStandardNodeMaterial({color:0x7c8785,roughness:.85}),inside:new THREE.MeshStandardNodeMaterial({color:0x101e25,roughness:1}),stripe:new THREE.MeshBasicNodeMaterial({color:0xe4be4e}),light:new THREE.MeshBasicNodeMaterial({color:0xffefcb})};
 function mountTile(group,id){
  const local=byTile.get(id)||[],geometries=new Map(),owned=[],colliders=[];
  for(const station of local){
   const e=station.entrance,matrix=new THREE.Matrix4().makeRotationY(e.heading);matrix.setPosition(e.x,e.y,e.z);colliders.push(...metroColliders(station));
   for(const p of metroParts(e)){
    if(p.hidden)continue;const g=new THREE.BoxGeometry(...p.size);g.translate(...p.center);g.applyMatrix4(matrix);if(!geometries.has(p.kind))geometries.set(p.kind,[]);geometries.get(p.kind).push(g);
   }
   const texture=stationTexture(station),material=new THREE.MeshBasicNodeMaterial({map:texture,side:THREE.DoubleSide}),sign=new THREE.Mesh(new THREE.PlaneGeometry(e.width-.2,.9),material);
   sign.position.set(e.x+Math.sin(e.heading)*(e.depth/2+.12),e.y+2.37,e.z+Math.cos(e.heading)*(e.depth/2+.12));sign.rotation.y=e.heading;sign.name='Metro sign: '+station.name;sign.userData.metroStationId=station.id;group.add(sign);owned.push({texture,material});
  }
  for(const [kind,items]of geometries){const mesh=new THREE.Mesh(mergeGeometries(items),materials[kind]);mesh.name='Metro '+kind;mesh.receiveShadow=kind!=='glass';mesh.castShadow=kind==='steel';group.add(mesh);for(const g of items)g.dispose();}
  return {colliders,floorRoads:local.map(metroFloorRoad),stations:local,dispose(){for(const {texture,material}of owned){texture.dispose();material.dispose();}}};
 }
 return {byTile,mountTile};
}
