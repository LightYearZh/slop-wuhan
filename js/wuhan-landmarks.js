import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createFootprintGeometry} from './footprint-buildings.js';

// Simplified photo-referenced Jianghanguan exterior. Plan is OSM, detail dimensions are visual estimates.
export function buildWuhanLandmarks(scene,landmarks){
 const stone=new THREE.MeshStandardNodeMaterial({color:0xaaa796,roughness:.88});
 const trim=new THREE.MeshStandardNodeMaterial({color:0xbfbba9,roughness:.84});
 const granite=new THREE.MeshStandardNodeMaterial({color:0x8a8b82,roughness:.95});
 const dark=new THREE.MeshStandardNodeMaterial({color:0x283a3d,roughness:.38,metalness:.25});
 const roof=new THREE.MeshStandardNodeMaterial({color:0x606c6c,metalness:.4,roughness:.68});
 const gold=new THREE.MeshStandardNodeMaterial({color:0xb0a383,metalness:.4,roughness:.55});
 const clockFace=new THREE.MeshStandardNodeMaterial({color:0xddd4ac,emissive:0xc4bc91,emissiveIntensity:.12,roughness:.7});
 const groups=[];
 for(const l of landmarks){
  if(l.type!=='jianghanguan')continue;
  const root=new THREE.Group();root.name=l.name;scene.add(root);groups.push(root);
  const mass=new THREE.Mesh(createFootprintGeometry({rings:l.footprint,h:18.6}),stone);mass.castShadow=mass.receiveShadow=true;root.add(mass);
  const g=new THREE.Group();g.position.set(l.x,2,l.z);g.rotation.y=l.ry;root.add(g);
  const buckets=new Map();
  function add(geo,mat,x,y,z,rotation=0){geo.rotateY(rotation);geo.translate(x,y,z);if(!buckets.has(mat))buckets.set(mat,[]);buckets.get(mat).push(geo);}
  const box=(w,h,d,x,y,z,mat=stone,rot=0)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,rot);
  const cyl=(rt,rb,h,x,y,z,mat=trim,n=12)=>add(new THREE.CylinderGeometry(rt,rb,h,n),mat,x,y,z);
  // Work in the source plan, including its concave party-wall notch.
  const co=Math.cos(l.ry),si=Math.sin(l.ry);
  const plan=l.footprint[0].slice(0,-1).map(([x,z])=>[(x-l.x)*co-(z-l.z)*si,(x-l.x)*si+(z-l.z)*co]);
  const edges=plan.map((a,i)=>{const b=plan[(i+1)%plan.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);return {a,b,length,dx:dx/length,dz:dz/length};});
  const frontEdge=edges.filter(e=>Math.abs(e.dz)<.12).sort((a,b)=>(b.a[1]+b.b[1])-(a.a[1]+a.b[1]))[0];
  const W=frontEdge.length,front=(frontEdge.a[1]+frontEdge.b[1])/2,frontX=(frontEdge.a[0]+frontEdge.b[0])/2;
  // Roof and horizontal courses must never fill the concave notch with a bounding box.
  for(const [y,h,mat]of [[.6,1.2,trim],[3.4,.45,trim],[15.7,.65,trim],[18.3,.7,trim],[19.15,.55,trim],[19.6,.3,roof]]){
   const slab=new THREE.Mesh(createFootprintGeometry({rings:l.footprint,h,baseY:y-h/2}),mat);
   slab.name='Jianghanguan footprint course';slab.userData.footprintCourse=true;
   slab.castShadow=slab.receiveShadow=true;root.add(slab);
  }
  // Eight tall columns, with shaft taper, bases and carved-leaf inspired capitals.
  for(let i=0;i<8;i++){
   const x=frontX-W*.405+i*W*.81/7,z=front+.75;
   box(1.65,.4,1.65,x,3.85,z,trim);cyl(.84,.89,.45,x,4.25,z);
   cyl(.58,.72,10.2,x,9.55,z);
   cyl(.92,.6,.7,x,15,z);box(1.7,.35,1.7,x,15.5,z,trim);
   for(let a=0;a<8;a++){const angle=a*Math.PI/4;add(new THREE.SphereGeometry(.18,5,4),trim,x+Math.cos(angle)*.73,15.1,z+Math.sin(angle)*.73);}
  }
  box(W,1.1,3.3,frontX,16.25,front+.65,trim);
  // Follow each real wall; a rectangular window grid creates floating facades in the notch.
  for(const edge of edges){
   if(edge.length<4)continue;
   const yaw=Math.atan2(-edge.dz,edge.dx),count=Math.max(1,Math.floor(edge.length/4.5));
   for(let floor=0;floor<3;floor++)for(let i=0;i<count;i++){
    const t=(i+.5)/count,x=edge.a[0]+(edge.b[0]-edge.a[0])*t,z=edge.a[1]+(edge.b[1]-edge.a[1])*t,y=5.6+floor*4.05;
    box(2.15,2.8,.25,x,y,z,dark,yaw);
    box(2.6,.22,.5,x,y+1.55,z,trim,yaw);box(2.5,.18,.5,x,y-1.45,z,trim,yaw);
    box(.1,2.8,.32,x,y,z,trim,yaw);box(2.15,.1,.32,x,y+.15,z,trim,yaw);
   }
  }
  // Recessed entrance arch and broad granite stairs.
  box(3.1,5,.3,frontX,5.7,front+.18,dark);
  const arch=new THREE.TorusGeometry(1.65,.32,6,20,Math.PI);add(arch,trim,frontX,7.9,front+.35);
  for(let step=0;step<7;step++)box(9.2+step*.48,.28,1.15,frontX,3.35-step*.28,front+1.5+step*.77,granite);
  // Keep the front balustrade within the surveyed frontage; no oversized hip roofs over neighbours.
  for(const side of [-1,1]){
   box(W*.31,.45,.55,frontX+side*W*.31,20.5,front-.3,trim);
   for(let i=0;i<9;i++)box(.18,.9,.25,frontX+side*(5+i*(W*.32/9)),20,front-.3,trim);
   box(1.2,1.6,1.2,frontX+side*(W/2-.8),20,front-.6,trim);
  }
  // Central clock shaft, four clock faces, open belfry, cornice and restrained dark roof.
  box(9.3,13,9.3,0,26.15,3,stone);
  for(const y of [20.2,21.2,32.5,33.4])box(10.4,.55,10.4,0,y,3,trim);
  for(const side of [-1,1]){
   box(.36,11.1,.55,side*4.8,26.6,7.75,trim);
   box(.36,11.1,.55,side*4.8,26.6,-1.75,trim);
  }
  for(let face=0;face<4;face++){
   const clock=new THREE.Group();clock.userData.bake=true;clock.position.set(0,29.5,3);clock.rotation.y=face*Math.PI/2;g.add(clock);
   const rim=new THREE.Mesh(new THREE.TorusGeometry(1.96,.17,8,48),gold);rim.position.z=4.76;clock.add(rim);
   const disc=new THREE.Mesh(new THREE.CircleGeometry(1.8,48),clockFace);disc.position.z=4.78;clock.add(disc);
   for(let tick=0;tick<60;tick++){
    const a=tick*Math.PI/30,m=new THREE.Mesh(new THREE.BoxGeometry(tick%5===0?.095:.045,tick%5===0?.3:.13,.04),dark);
    m.position.set(Math.sin(a)*1.55,Math.cos(a)*1.55,4.82);m.rotation.z=-a;clock.add(m);
   }
   const hands=[[.11,1.2,.55,-.7],[.075,1.55,.74,1.1]];
   for(const [w,h,dy,a]of hands){const pivot=new THREE.Group();pivot.rotation.z=a;clock.add(pivot);const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.08),dark);m.position.set(0,dy,4.88);pivot.add(m);}
   const inset=new THREE.Mesh(new THREE.BoxGeometry(.8,2.3,.13),dark);inset.position.set(0,-4.1,4.75);clock.add(inset);
  }
  box(8.25,6.1,8.25,0,36.5,3,dark);
  for(const x of [-3.8,3.8])for(const z of [-.8,6.8]){box(.75,6.4,.75,x,36.6,z,trim);box(1.2,.35,1.2,x,39.7,z,trim);}
  for(let side=0;side<4;side++){
   const a=side*Math.PI/2;for(const k of [-1.3,1.3]){
    const x=Math.sin(a)*4+Math.cos(a)*k,z=3+Math.cos(a)*4-Math.sin(a)*k;
    box(.3,5.6,.3,x,36.5,z,trim);
   }
  }
  box(9.5,.75,9.5,0,40.2,3,trim);
  const crown=new THREE.CylinderGeometry(1.6,6.1,2.4,4);crown.rotateY(Math.PI/4);add(crown,roof,0,41.8,3);
  box(2.4,.7,2.4,0,43.3,3,stone);cyl(.055,.065,2.15,0,44.55,3,dark,8);
  // Local sign is a model detail; no downloaded image is baked onto the building.
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#bfbba9';ctx.fillRect(0,0,512,128);ctx.fillStyle='#3b433f';ctx.font='bold 76px serif';ctx.textAlign='center';ctx.fillText('江 汉 关',256,94);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(7.4,1.8),new THREE.MeshStandardNodeMaterial({map:new THREE.CanvasTexture(c),roughness:.8}));label.position.set(frontX,17.6,front+2.35);g.add(label);
  g.updateWorldMatrix(true,true);
  const inverse=g.matrixWorld.clone().invert();
  for(const clock of g.children.filter(o=>o.userData.bake)){
   clock.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(geo);o.geometry.dispose();});g.remove(clock);
  }
  for(const [mat,geos]of buckets){const merged=mergeGeometries(geos);for(const geo of geos)geo.dispose();const m=new THREE.Mesh(merged,mat);m.castShadow=m.receiveShadow=true;g.add(m);}
 }
 return {groups,update(night){clockFace.emissiveIntensity=.12+night*.9;},materials:[stone,trim,granite,dark,roof,gold,clockFace]};
}
