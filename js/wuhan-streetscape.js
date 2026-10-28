import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildStrip} from './road-geometry.js';

// Street furniture is illustrative dressing, not a surveyed street inventory.
export function buildWuhanStreetscape(scene,data,placement){
 const focus=data.landmarks.find(l=>l.id==='jianghanguan');if(!focus)return;
 const buckets=new Map();
 const materials={stone:new THREE.MeshStandardNodeMaterial({color:0x8c8e83,roughness:.9}),paving:new THREE.MeshStandardNodeMaterial({color:0x847c6b,roughness:.95}),metal:new THREE.MeshStandardNodeMaterial({color:0x304241,roughness:.6,metalness:.35}),wood:new THREE.MeshStandardNodeMaterial({color:0x69513a,roughness:.88}),glass:new THREE.MeshStandardNodeMaterial({color:0xe9dab1,emissive:0x75623f,emissiveIntensity:.25,roughness:.5}),leaf:new THREE.MeshStandardNodeMaterial({color:0x506344,roughness:.95})};
 function add(geo,key,x=0,y=0,z=0,ry=0){geo.rotateY(ry);geo.translate(x,y,z);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(geo);}
 function bench(x,z,angle){
  add(new THREE.BoxGeometry(2.1,.14,.55),'wood',x,2.6,z,angle);
  const dx=Math.sin(angle)*.3,dz=Math.cos(angle)*.3;
  add(new THREE.BoxGeometry(2.1,.52,.1),'wood',x-dx,2.94,z-dz,angle);
  for(const side of [-1,1])add(new THREE.BoxGeometry(.12,.48,.5),'metal',x+Math.cos(angle)*side*.8,2.3,z-Math.sin(angle)*side*.8,angle);
 }
 const lines=data.roads.filter(r=>r.name==='江汉路'&&r.mode==='person');
 for(const road of lines)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(length<2)continue;
  const dx=(b[0]-a[0])/length,dz=(b[2]-a[2])/length,nx=-dz,nz=dx,angle=Math.atan2(dx,dz);
  // Narrow stone bands distinguish a walking street from asphalt carriageways.
  for(const side of [-1,1]){
   const p=[a[0]+nx*side*(road.width/2-.65),2.145,a[2]+nz*side*(road.width/2-.65)],q=[b[0]+nx*side*(road.width/2-.65),2.145,b[2]+nz*side*(road.width/2-.65)];
   add(buildStrip([p,q],.35),'paving');
  }
  for(let d=8;d<length-3;d+=7){
   const x=a[0]+dx*d,z=a[2]+dz*d;if(Math.hypot(x-focus.x,z-focus.z)>520)continue;
   add(buildStrip([[x-nx*(road.width/2-.7),2.14,z-nz*(road.width/2-.7)],[x+nx*(road.width/2-.7),2.14,z+nz*(road.width/2-.7)]],.08),'paving');
  }
  for(let d=15;d<length-10;d+=33){
   const x=a[0]+dx*d,z=a[2]+dz*d;if(Math.hypot(x-focus.x,z-focus.z)>520)continue;
   for(const side of [-1,1]){
    const px=x+nx*side*(road.width/2+1.35),pz=z+nz*side*(road.width/2+1.35);
    if(placement.reserve('planter-tree',px,pz,2)){
    add(new THREE.BoxGeometry(2.8,.35,2.8),'stone',px,2.22,pz);
    add(new THREE.CylinderGeometry(.12,.2,3.7,7),'wood',px,4.02,pz);
    const crown=new THREE.IcosahedronGeometry(1.7,1);crown.scale(1,1.25,1);add(crown,'leaf',px,6.5,pz);
    }
    const lx=px-dx*4,lz=pz-dz*4;
    if(placement.reserve('heritage-lamp',lx,lz,.55)){add(new THREE.CylinderGeometry(.06,.12,5.5,7),'metal',lx,4.85,lz);
    add(new THREE.BoxGeometry(.55,.75,.55),'glass',lx,7.85,lz);add(new THREE.BoxGeometry(.75,.12,.75),'metal',lx,8.27,lz);}
    if(placement.reserve('bench',px+dx*6,pz+dz*6,1.15))bench(px+dx*6,pz+dz*6,angle+Math.PI/2);
   }
  }
 }
 // Low plaza bollards protect the museum forecourt while leaving the main entrance approach open.
 for(const road of data.roads.filter(r=>r.name==='沿江大道'))for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]),dx=(b[0]-a[0])/(length||1),dz=(b[2]-a[2])/(length||1);
  for(let d=2;d<length;d+=5){const x=a[0]+dx*d-dz*(road.width/2+1),z=a[2]+dz*d+dx*(road.width/2+1);
   if(Math.hypot(x-focus.x,z-focus.z)>105||!placement.reserve('bollard',x,z,.2))continue;
   add(new THREE.CylinderGeometry(.13,.18,.85,8),'stone',x,2.5,z);
  }
 }
 const group=new THREE.Group();group.name='江汉路示范段 · 装饰性街具';
 for(const [key,geos]of buckets){const merged=mergeGeometries(geos);for(const geo of geos)geo.dispose();const m=new THREE.Mesh(merged,materials[key]);m.castShadow=true;m.receiveShadow=true;group.add(m);}
 scene.add(group);return group;
}
