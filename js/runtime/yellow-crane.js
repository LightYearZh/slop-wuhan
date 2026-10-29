import * as THREE from 'three/webgpu';
import {modelBuilder,curvedRoof,craftTexture} from './landmark-craft.js';

// Reference: 1985 tower, folded-square plan, five visible floors and 51.4m total.
// Small ornament dimensions and positions remain visual approximations.
export function buildYellowCrane(root){
 const material=(color,extra={})=>new THREE.MeshStandardNodeMaterial({color,roughness:.74,...extra});
 const red=material(0x982d20),wood=material(0x705545),stone=material(0xbcb3a0),dark=material(0x352c25),green=material(0x315750);
 const trim=material(0xd6a347,{roughness:.46,metalness:.2});
 const tile=material(0xffffff,{map:craftTexture('tile'),roughness:.5,metalness:.12,side:THREE.DoubleSide});
 const b=modelBuilder(root);const {box,cyl,beam}=b;
 box(31.5,1.5,31.5,0,.75,0,stone);box(30.4,.3,30.4,0,1.65,0,stone);
 for(let side=0;side<4;side++)for(let step=0;step<6;step++){
  const angle=side*Math.PI/2,dist=15.3+step*.38;
  box(8,(6-step)*.25,.45,Math.sin(angle)*dist,(6-step)*.125,Math.cos(angle)*dist,stone,angle);
 }
 const widths=[29.2,26.6,24.2,22,19.8],bases=[1.8,13.05,21.3,29.1,36.7],eaves=[10.8,18.8,26.7,34.5,42.5];
 for(let floor=0;floor<5;floor++){
  const w=widths[floor],base=bases[floor],eave=eaves[floor],h=eave-base;
  // Interlocking square and corner wings make the folded plan legible from all sides.
  box(w*.54,h,w*.54,0,base+h/2,0,red);
  for(const sx of [-1,1])for(const sz of [-1,1])box(w*.20,h,w*.20,sx*w*.255,base+h/2,sz*w*.255,red);
  box(w*.91,.35,w*.91,0,base+.12,0,stone);
  const perFace=floor===4?2:4;
  for(let side=0;side<4;side++){
   const a=side*Math.PI/2,cs=Math.cos(a),sn=Math.sin(a),point=(u,v)=>[u*cs+v*sn,-u*sn+v*cs];
   for(let i=0;i<perFace;i++){
    const u=(i/(perFace-1)-.5)*w*.72,[x,z]=point(u,w*.405);
    cyl(.25,.31,h,x,base+h/2,z,wood);box(.85,.32,.85,x,eave-.3,z,green);
    for(const dy of [.55,.98]){const [x2,z2]=point(u,w*.46);box(w/perFace*.85,.13,.13,x2,base+dy,z2,stone,a);}
   }
   if(floor===0)for(const u of [-4,0,4]){const [x,z]=point(u,w*.275);box(2.6,5.6,.12,x,base+3,z,dark,a);}
   const count=16;
   for(let i=0;i<=count;i++){
    const [x,z]=point((i/count-.5)*w*.87,w*.46);box(.13,.95,.13,x,base+.65,z,stone);
   }
   for(let i=0;i<7;i++){
    const u=(i-3)*w*.075,[x,z]=point(u,w*.274);
    box(w*.047,h*.56,.09,x,base+h*.49,z,dark,a);
    for(let j=1;j<4;j++){const [xx,zz]=point(u,w*.28);box(w*.045,.065,.09,xx,base+h*(.2+j*.14),zz,wood,a);}
   }
   const [fx,fz]=point(0,w*.425);box(w*.78,.28,.34,fx,eave-.5,fz,green,a);
  }
  curvedRoof(b,{w:w*.81,d:w*.81,y:eave,rise:floor===4?3.9:3.2,material:tile,trim,lift:1.45});
  for(const sx of [-1,1])for(const sz of [-1,1])curvedRoof(b,{w:w*.40,d:w*.40,x:sx*w*.35,z:sz*w*.35,y:eave-.8,rise:2.7,material:tile,trim,lift:1.3});
 }
 // 5m ceramic gourd finial above the upper ridge; total reaches exactly 51.4m.
 cyl(.22,.45,1.3,0,47.05,0,trim);cyl(.52,.48,.9,0,48.15,0,trim);cyl(.25,.5,.8,0,49,0,trim);cyl(.39,.28,.7,0,49.75,0,trim);cyl(0,.32,1.3,0,50.75,0,trim);
 b.finish();
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const c=canvas.getContext('2d');
  if(c){c.fillStyle='#241d18';c.fillRect(0,0,256,512);c.strokeStyle='#d2aa50';c.lineWidth=10;c.strokeRect(10,10,236,492);c.fillStyle='#e1b758';c.font='bold 125px serif';c.textAlign='center';c.textBaseline='middle';Array.from('黄鹤楼').forEach((t,i)=>c.fillText(t,128,96+i*158));const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshStandardNodeMaterial({map:t,roughness:.8});
   for(let side=0;side<4;side++){const a=side*Math.PI/2,sign=new THREE.Mesh(new THREE.PlaneGeometry(2.4,4.8),mat);sign.position.set(Math.sin(a)*6.6,41.3,Math.cos(a)*6.6);sign.rotation.y=a;root.add(sign);}
  }
 }
 root.userData.modelReference={visibleFloors:5,totalHeightM:51.4,columns:72,roofForm:'interlocking-square-and-corner-hip-roofs',detail:'procedural-photo-reference-not-survey'};
 return root;
}
