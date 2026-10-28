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
  const W=l.w,D=l.d,front=D/2;
  // Rusticated base, cornices and roof parapet.
  for(const [y,h,extra]of [[.6,1.2,.5],[3.4,.45,.65],[15.7,.65,.85],[18.3,.7,1.25],[19.15,.55,1.65]])box(W+extra,h,D+extra,0,y,0,trim);
  box(W,.3,D,0,19.6,0,roof);
  // Eight tall columns, with shaft taper, bases and carved-leaf inspired capitals.
  for(let i=0;i<8;i++){
   const x=-W*.405+i*W*.81/7,z=front+.75;
   box(1.65,.4,1.65,x,3.85,z,trim);cyl(.84,.89,.45,x,4.25,z);
   cyl(.58,.72,10.2,x,9.55,z);
   cyl(.92,.6,.7,x,15,z);box(1.7,.35,1.7,x,15.5,z,trim);
   for(let a=0;a<8;a++){const angle=a*Math.PI/4;add(new THREE.SphereGeometry(.18,5,4),trim,x+Math.cos(angle)*.73,15.1,z+Math.sin(angle)*.73);}
  }
  box(W+2,1.1,3.3,0,16.25,front+.65,trim);
  // Deep windows and stone surrounds on front and side elevations.
  for(const side of [1,-1]){
   const facade=new THREE.Group();facade.rotation.y=side===1?0:Math.PI;g.add(facade);
   for(let floor=0;floor<3;floor++)for(let i=0;i<9;i++){
    const x=-W*.4+i*W*.8/8,y=5.6+floor*4.05,z=side*(front+.12);
    if(floor===0&&i===4)continue;
    box(2.15,2.8,.25,x,y,z,dark);box(2.6,.22,.55,x,y+1.55,z,trim);box(2.5,.18,.55,x,y-1.45,z,trim);
    box(.1,2.8,.32,x,y,z+side*.05,trim);box(2.15,.1,.32,x,y+.15,z+side*.05,trim);
   }
  }
  for(const side of [-1,1])for(let floor=0;floor<3;floor++)for(let i=0;i<7;i++){
   const z=-D*.37+i*D*.74/6,y=5.6+floor*4.05,x=side*(W/2+.08);
   box(.24,2.8,2.1,x,y,z,dark);box(.5,.22,2.55,x,y+1.55,z,trim);box(.3,2.8,.1,x,y,z,trim);
  }
  // Recessed entrance arch and broad granite stairs.
  box(3.1,5,.3,0,5.7,front+.18,dark);
  const arch=new THREE.TorusGeometry(1.65,.32,6,20,Math.PI);add(arch,trim,0,7.9,front+.35);
  for(let step=0;step<7;step++)box(9.2+step*.48,.28,1.15,0,3.35-step*.28,front+1.5+step*.77,granite);
  // Balustrade and shallow roof on either side of the clock tower.
  for(const side of [-1,1]){
   box(W*.34,.45,.55,side*W*.3,20.5,front,trim);
   for(let i=0;i<10;i++)box(.18,.9,.25,side*(5+i*(W*.36/10)),20,front,trim);
   box(1.2,1.6,1.2,side*(W/2-.7),20,front,trim);
   const r=new THREE.CylinderGeometry(0,1,2,4);r.rotateY(Math.PI/4);r.scale(W*.29,1,D*.35);add(r,roof,side*W*.28,20.2,-D*.1);
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
  const label=new THREE.Mesh(new THREE.PlaneGeometry(7.4,1.8),new THREE.MeshStandardNodeMaterial({map:new THREE.CanvasTexture(c),roughness:.8}));label.position.set(0,17.6,front+2.35);g.add(label);
  g.updateWorldMatrix(true,true);
  const inverse=g.matrixWorld.clone().invert();
  for(const clock of g.children.filter(o=>o.userData.bake)){
   clock.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(geo);o.geometry.dispose();});g.remove(clock);
  }
  for(const [mat,geos]of buckets){const merged=mergeGeometries(geos);for(const geo of geos)geo.dispose();const m=new THREE.Mesh(merged,mat);m.castShadow=m.receiveShadow=true;g.add(m);}
 }
 return {groups,update(night){clockFace.emissiveIntensity=.12+night*.9;},materials:[stone,trim,granite,dark,roof,gold,clockFace]};
}
