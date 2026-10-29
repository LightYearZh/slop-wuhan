import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural reference materials, not photographs or surveyed ornament dimensions.
export function craftTexture(kind){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d');if(!c)return null;
  c.fillStyle=kind==='brick'?'#92513c':'#b87923';c.fillRect(0,0,512,512);
  if(kind==='brick'){
    for(let y=0;y<512;y+=32){c.fillStyle='#bf8b6a';c.fillRect(0,y,512,2);for(let x=(y/32%2)*32;x<512;x+=64)c.fillRect(x,y,2,32);}
  }else{
    for(let x=0;x<512;x+=32){c.fillStyle='#754710';c.fillRect(x,0,5,512);c.fillStyle='#e8af49';c.fillRect(x+7,0,4,512);}
    for(let y=0;y<512;y+=64){c.fillStyle='rgba(91,53,10,.34)';c.fillRect(0,y,512,3);}
  }
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

export function modelBuilder(root){
 const buckets=new Map();
 const add=(g,m,x=0,y=0,z=0,ry=0)=>{g.rotateY(ry);g.translate(x,y,z);if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g);};
 const box=(w,h,d,x,y,z,m,ry=0)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,ry);
 const cyl=(rt,rb,h,x,y,z,m,n=12)=>add(new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z);
 const beam=(a,b,r,m)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);if(v.length()<.001)return;const g=new THREE.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));const mid=p.add(q).multiplyScalar(.5);add(g,m,mid.x,mid.y,mid.z);};
 const finish=()=>{for(const [m,items]of buckets){const geos=items.map(g=>{if(!m.map)g.deleteAttribute('uv');const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();return n;});const g=mergeGeometries(geos);if(!g)throw Error('Landmark geometry attributes disagree');g.computeBoundingBox();const mesh=new THREE.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geos.forEach(g=>g.dispose());}};
 return {add,box,cyl,beam,finish};
}

// Four curved hip faces, a short ridge, lifted corners, ceramic tile UVs and eave trim.
export function curvedRoof(builder,{w,d,y,rise=3.2,x=0,z=0,material,trim,lift=1.25}){
 const pos=[],uv=[],idx=[],steps=12;
 const outer=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
 const inner=[[-w*.24,-d*.055],[w*.24,-d*.055],[w*.24,d*.055],[-w*.24,d*.055]];
 for(let face=0;face<4;face++){
  const next=(face+1)%4;
  const at=(u,t)=>{const a=inner[face].map((v,k)=>v+(inner[next][k]-v)*u),b=outer[face].map((v,k)=>v+(outer[next][k]-v)*u);return [x+a[0]+(b[0]-a[0])*t,y+rise*(1-t)**1.55+lift*Math.abs(2*u-1)**7*t**3,z+a[1]+(b[1]-a[1])*t];};
  for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){
   const base=pos.length/3;
   for(const [u,v]of [[i,j],[i+1,j],[i+1,j+1],[i,j+1]]){pos.push(...at(u/steps,v/steps));uv.push(u/steps*w/2,v/steps*d/2);}
   idx.push(base,base+2,base+1,base,base+3,base+2);
  }
  for(let i=0;i<steps;i++)builder.beam(at(i/steps,1),at((i+1)/steps,1),.085,trim);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();builder.add(g,material);
 builder.box(w*.48,.22,d*.11,x,y+rise,z,trim);
}
