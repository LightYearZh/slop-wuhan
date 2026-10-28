import {barrierSpan} from './surface-barriers.js';
import * as THREE from 'three/webgpu';
// Shanghai-style continuous road, retaining walls, covered bore and ceiling lamps.
// Shared strip vertices are also the vehicle-contact triangles.
export function buildTunnels(scene,system){
 const group=new THREE.Group();group.name='Wuhan Yangtze Tunnel';scene.add(group);
 const floorMat=new THREE.MeshStandardNodeMaterial({color:0x42474a,roughness:.95,side:THREE.DoubleSide,emissive:0x24282c,emissiveIntensity:.6});
 const wallMat=new THREE.MeshStandardNodeMaterial({color:0x9eaaa8,roughness:.9,side:THREE.DoubleSide,emissive:0x616d70,emissiveIntensity:.55});
 const lampMat=new THREE.MeshBasicNodeMaterial({color:0xffe8b4}),markMat=new THREE.MeshBasicNodeMaterial({color:0xe4cf91});
 function mesh(positions,mat,name){if(!positions.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;group.add(m);}
 function quad(out,a,b,c,d){out.push(...a,...b,...c,...a,...c,...d);}
 for(const {road,vertices:v}of system.surfaces){
  const portal=new THREE.Group(),p=road.points[0],q=road.points[1];portal.position.set(p[0],0,p[2]);portal.rotation.y=Math.atan2(q[0]-p[0],q[2]-p[2]);group.add(portal);
  const portalW=road.widths?.[0]||road.width;
  const postMat=new THREE.MeshStandardNodeMaterial({color:0x727c7a,roughness:.9});
  for(const x of [-portalW/2-.25,portalW/2+.25]){const post=new THREE.Mesh(new THREE.BoxGeometry(.3,5,.3),postMat);post.position.set(x,2.5,0);portal.add(post);}
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#115a42';ctx.fillRect(0,0,1024,128);ctx.strokeStyle='#e8f0e8';ctx.lineWidth=5;ctx.strokeRect(5,5,1014,118);ctx.fillStyle='#ffffff';ctx.font='bold 46px "Noto Sans SC",sans-serif';ctx.textAlign='center';ctx.fillText('武汉长江隧道  → '+(road.direction==='hankou-to-wuchang'?'武昌':'汉口'),512,80);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(portalW+.6,1.08),new THREE.MeshBasicNodeMaterial({map:new THREE.CanvasTexture(canvas),side:THREE.DoubleSide}));sign.position.y=4.65;sign.rotation.y=Math.PI;portal.add(sign);
  const floor=[],shell=[],marks=[],lamps=[];
  for(let i=1;i<road.points.length;i++){
   const j=(i-1)*2,a=v[j],b=v[j+1],c=v[j+2],d=v[j+3],p=road.points[i-1],q=road.points[i];
   // Precisely the same diagonal as floorAt, including corners and slopes.
   floor.push(...a,...b,...c,...b,...d,...c);
   const top=p=>[p[0],p[1]+(p[1]>-6.4?Math.max(.5,.45-p[1]):road.clearance),p[2]];
   for(const [start,end]of [[a,c],[b,d]]){const span=barrierSpan(start,end,0,0,{underground:true});if(span){const [s,e]=span;quad(shell,s,e,top(e),top(s));}}
   if(Math.max(p[1],q[1])<=-6.4)quad(shell,top(a),top(b),top(d),top(c));
   if(i%3===0){const lerp=(x,y,t,dy=.025)=>[x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t+dy,x[2]+(y[2]-x[2])*t];quad(marks,lerp(a,b,.49),lerp(a,b,.51),lerp(c,d,.51),lerp(c,d,.49));}
   if(i%4===0&&p[1]<-7){for(const t of [.13,.87])lamps.push([a[0]+(b[0]-a[0])*t,p[1]+road.clearance-.09,a[2]+(b[2]-a[2])*t]);}
  }
  mesh(floor,floorMat,road.id+' floor');mesh(shell,wallMat,road.id+' walls and roof');mesh(marks,markMat,road.id+' lane dashes');
  const light=new THREE.InstancedMesh(new THREE.BoxGeometry(.35,.07,1.8),lampMat,lamps.length),matrix=new THREE.Matrix4();lamps.forEach((p,i)=>light.setMatrixAt(i,matrix.makeTranslation(...p)));light.name='Tunnel ceiling lights';group.add(light);
 }
 return group;
}
