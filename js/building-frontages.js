import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Generic facade details follow source wall edges; they do not occupy pavement or create fictional shop names.
export function createFrontageDetails(buildings,materials){
 const group=new THREE.Group(),buckets=new Map();group.name='Attributed street facades';
 function box(w,h,d,x,y,z,angle,kind){const g=new THREE.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);if(!buckets.has(kind))buckets.set(kind,[]);buckets.get(kind).push(g);}
 for(const b of buildings){
  for(const front of b.frontages||[]){
   const a=front.a,c=front.b,n=front.normal,dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),angle=Math.atan2(n[0],n[1]);
   const cx=(a[0]+c[0])/2,cz=(a[1]+c[1])/2,groundHeight=Math.min(3.5,b.h*.55);
   const bays=Math.min(16,Math.max(1,Math.floor((length-.8)/3.2)));
   if(front.kind==='shop'){
    const width=(length-.8)/bays;
    for(let j=0;j<bays;j++){
     const t=(.4+(j+.5)*width)/length,x=a[0]+dx*t,z=a[1]+dz*t;
     box(width-.18,groundHeight-.65,.05,x+n[0]*.035,2.35+(groundHeight-.65)/2,z+n[1]*.035,angle,'glass');
     box(.07,groundHeight-.65,.08,x+n[0]*.06,2.35+(groundHeight-.65)/2,z+n[1]*.06,angle,'frame');
    }
    box(length-.6,.42,.08,cx+n[0]*.07,2+groundHeight+.18,cz+n[1]*.07,angle,'sign');
   }else{
    box(1.5,2.7,.06,cx+n[0]*.03,3.35,cz+n[1]*.03,angle,'glass');
    box(2.1,.18,.12,cx+n[0]*.045,4.86,cz+n[1]*.045,angle,'trim');
   }
   if(b.category==='historic'){
    for(let y=6;y<b.h-.5;y+=3.8)box(length-.3,.13,.13,cx+n[0]*.035,2+y,cz+n[1]*.035,angle,'trim');
   }
   if(b.roofStyle==='parapet')box(length-.15,.3,.12,cx-n[0]*.035,2+b.h-.15,cz-n[1]*.035,angle,'trim');
  }
 }
 for(const [key,geos]of buckets){const merged=mergeGeometries(geos);for(const g of geos)g.dispose();const mesh=new THREE.Mesh(merged,materials[key]);mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);}
 return group;
}
