import * as THREE from 'three/webgpu';
import {createFootprintGeometry} from '../footprint-buildings.js';
import {modelBuilder,craftTexture} from './landmark-craft.js';

export function buildRedHouse(root,l){
 const brick=new THREE.MeshStandardNodeMaterial({color:0xffffff,map:craftTexture('brick'),roughness:.91});
 const stone=new THREE.MeshStandardNodeMaterial({color:0xc5b79e,roughness:.88}),roof=new THREE.MeshStandardNodeMaterial({color:0x8d4933,roughness:.8}),dark=new THREE.MeshStandardNodeMaterial({color:0x28383a,roughness:.5});
 const cs=Math.cos(l.ry),sn=Math.sin(l.ry),rings=l.footprint.map(r=>r.map(([x,z])=>{x-=l.x;z-=l.z;return [cs*x-sn*z,sn*x+cs*z];}));
 const b=modelBuilder(root),{box,cyl}=b,W=Math.max(l.w,l.d),D=Math.min(l.w,l.d),front=Math.cos(l.ry)<0?-1:1;
 const body=createFootprintGeometry({rings,h:9.6});body.translate(0,-2,0);b.add(body,brick);
 const gable=(w,d,y,x,z,ry=0)=>{const a=[[-w/2,y,-d/2],[-w/2,y,d/2],[-w/2,y+2.8,0],[w/2,y,-d/2],[w/2,y,d/2],[w/2,y+2.8,0]],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a.flat(),3));g.setIndex([0,3,5,0,5,2,2,5,4,2,4,1,0,2,1,3,4,5]);g.computeVertexNormals();b.add(g,roof,x,0,z,ry);};
 gable(W*.96,D*.31,9.6,0,front*D*.27);gable(W*.44,D*.31,9.6,0,-front*D*.26);
 for(const side of [-1,1])gable(D*.74,W*.12,9.6,side*W*.43,-D*.05,Math.PI/2);
 for(const y of [0.5,4.9,9.3])box(W*.98,.25,.4,0,y,front*D*.48,stone);
 for(let i=0;i<13;i++){
  const x=(i-6)*W*.073;
  for(const y of [2.8,7.1]){
   const arch=new THREE.Shape();arch.moveTo(-1.15,-1.4);arch.lineTo(1.15,-1.4);arch.lineTo(1.15,.4);arch.absarc(0,.4,1.15,0,Math.PI,false);arch.closePath();b.add(new THREE.ShapeGeometry(arch,12),dark,x,y,front*D*.478,front<0?Math.PI:0);box(2.65,.15,.25,x,y-1.4,front*D*.48,stone);
   box(.11,2.8,.2,x,y,front*D*.48,stone);box(2.3,.12,.2,x,y,front*D*.48,stone);
  }
  box(.38,9,.44,x+W*.037,4.8,front*D*.48,stone);
 }
 // Central portico and the characteristic raised lookout, all dimensions illustrative.
 box(12,.6,5.8,0,10.2,front*D*.42,stone);
 for(const x of [-4.7,0,4.7])cyl(.35,.42,8.8,x,4.9,front*D*.48,stone);
 box(6.4,4.4,5.5,0,13.1,front*D*.27,brick);box(6.9,.35,5.9,0,15.45,front*D*.27,stone);
 box(2.5,2.6,.1,0,13.3,front*D*.34,dark);gable(7,5.8,15.2,0,front*D*.27);
 b.finish();root.userData.modelReference={heightM:18,source:l.source,detail:'mapped-concave-footprint;photo-referenced-red-brick-exterior;estimated-roof'};return root;
}
