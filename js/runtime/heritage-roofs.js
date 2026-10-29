import * as THREE from 'three/webgpu';

// Source-clipped roof slopes plus an inset pavilion. All dimensions are display estimates.
export function appendHeritageRoof(builder,b,bodyH,m){
  const p=b.heritageProfile,detail=p.roofDetail,plan=p.roofPlan;
  if(!detail||!plan)return null;
  const reserve=detail.reserveM,y0=b.ground,positions=[];
  for(const t of plan.triangles){
    const pts=Array.from({length:3},(_,i)=>[t[i*3],y0+bodyH+t[i*3+1]*reserve,t[i*3+2]]);
    if((pts[1][2]-pts[0][2])*(pts[2][0]-pts[0][0])-(pts[1][0]-pts[0][0])*(pts[2][2]-pts[0][2])<0)pts.reverse();
    positions.push(...pts.flat());
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(Array.from({length:positions.length/3},(_,i)=>[positions[i*3]/8,positions[i*3+2]/8]).flat(),2));geo.computeVertexNormals();builder.add(geo,m.roof);
  const {x,z,radiusM:r}=plan.pavilion,oct=detail.kind==='octagonal-belvedere';
  const lo=y0+bodyH+reserve*.18,hi=y0+b.h,resH=hi-lo;
  const shaftH=resH*(oct?.85:.44),shaftR=r*.79;
  builder.cyl(shaftR,shaftR,shaftH,x,lo+shaftH/2,z,m.stone,8);
  for(const [y,rad,h] of [[lo,r*.91,.18],[lo+shaftH,r*.92,.18]])builder.cyl(rad,rad,h,x,y,z,m.trim,8);
  for(let i=0;i<8;i++){
    const a=(i+.5)*Math.PI/4,nx=Math.cos(a),nz=Math.sin(a),at=shaftR*Math.cos(Math.PI/8)+.025,yaw=Math.PI/2-a;
    builder.box(r*.52,shaftH*.62,.06,x+nx*at,lo+shaftH*.54,z+nz*at,m.glass,yaw);
    builder.box(.08,shaftH*.65,.09,x+nx*(at+.04),lo+shaftH*.54,z+nz*(at+.04),m.iron,yaw);
  }
  if(oct){
    // The lost historical spire is not re-created on the present-day consulate.
    builder.cyl(r*.88,r*.88,resH*.13,x,hi-resH*.065,z,m.trim,8);
    builder.cyl(r*.72,r*.72,.08,x,hi-.02,z,m.roof,8);
  }else{
    const profile=[[r*.97,0],[r*.9,.12],[r*.98,.28],[r*.8,.49],[r*.46,.68],[r*.14,.86],[.05,.95]].map(([radius,f])=>new THREE.Vector2(radius,f*(resH-shaftH)));
    const dome=new THREE.LatheGeometry(profile,24);builder.add(dome,m.copper,x,lo+shaftH,z);
    builder.cyl(.08,.12,(resH-shaftH)*.12,x,hi-(resH-shaftH)*.06,z,m.brass,8);
  }
  return {kind:detail.kind,triangles:plan.triangles.length,center:[x,z],radiusM:r};
}
