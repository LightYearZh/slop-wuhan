import * as THREE from 'three/webgpu';
import {createFootprintGeometry} from '../footprint-buildings.js';
import {modelBuilder} from './landmark-craft.js';

// Small reusable vocabulary, bound to reviewed OSM identities by the data pipeline.
// No district-wide "European" randomizer; modern banks deliberately omit classical ornament.
const CLASSICAL = new Set(['taiwan-bank','hsbc-bank','citibank','corner-cupola','classical-commercial']);
const COLONNADE = new Set(['taiwan-bank','hsbc-bank','citibank','corner-cupola']);

function masonryTexture(){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d');if(!ctx)return null;
  ctx.fillStyle='#a9a69c';ctx.fillRect(0,0,512,512);
  for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
    const x=col*128+(row%2)*64,y=row*64,shade=177+((row*13+col*19+59)%17);
    ctx.fillStyle=`rgb(${shade+8},${shade+5},${shade-5})`;ctx.fillRect(x+1,y+1,126,62);
    ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(x+2,y+2,124,1);
    for(let i=0;i<80;i++){
      const px=x+(i*37+row*17)%126,py=y+(i*23+col*7+70)%62;
      ctx.fillStyle=i%2?'rgba(54,48,35,.12)':'rgba(255,255,255,.18)';ctx.fillRect(px,py,1,1);
    }
  }
  const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}

let materials;
export function heritageMaterials(){
  if(!materials)materials={
    stone:new THREE.MeshStandardNodeMaterial({color:0xe6e0d1,map:masonryTexture(),roughness:.9}),
    trim:new THREE.MeshStandardNodeMaterial({color:0xbab6a8,roughness:.86}),
    pale:new THREE.MeshStandardNodeMaterial({color:0xd4cfc0,roughness:.9}),
    glass:new THREE.MeshStandardNodeMaterial({color:0x273332,roughness:.42,metalness:.15}),
    recess:new THREE.MeshStandardNodeMaterial({color:0x45473f,roughness:.96}),
    iron:new THREE.MeshStandardNodeMaterial({color:0x393e38,roughness:.66,metalness:.35}),
    roof:new THREE.MeshStandardNodeMaterial({color:0x777c71,roughness:.8,metalness:.15})
  };
  return materials;
}

export function facadeEdges(flat){
  const pts=[];
  for(let i=0;i<flat.length;i+=2)if(!pts.length||Math.hypot(flat[i]-pts.at(-1)[0],flat[i+1]-pts.at(-1)[1])>.02)pts.push([flat[i],flat[i+1]]);
  if(pts.length>1&&Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<.02)pts.pop();
  // Collapse survey subdivisions along one straight facade, without changing the body/collider rings.
  let changed=true;
  while(changed&&pts.length>3){changed=false;for(let i=0;i<pts.length;i++){
    const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];
    if(Math.abs(u[0]*v[1]-u[1]*v[0])<.06*Math.hypot(c[0]-a[0],c[1]-a[1])&&u[0]*v[0]+u[1]*v[1]>0){pts.splice(i,1);changed=true;break;}
  }}
  return pts.map((a,i)=>{const p=pts[(i+1)%pts.length],L=Math.hypot(p[0]-a[0],p[1]-a[1]),ux=(p[0]-a[0])/L,uz=(p[1]-a[1])/L;return {a,b:p,L,ux,uz,nx:uz,nz:-ux,yaw:Math.atan2(-uz,ux)};}).filter(e=>e.L>.05);
}

// Upper wall set back *inside* the mapped facade for real balcony/colonnade depth.
export function recessRing(flat,edge,depth){
  const pts=[];for(let i=0;i<flat.length;i+=2)pts.push([flat[i],flat[i+1]]);
  const limit=edge.nx*edge.a[0]+edge.nz*edge.a[1]-depth,out=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length],da=a[0]*edge.nx+a[1]*edge.nz-limit,db=b[0]*edge.nx+b[1]*edge.nz-limit;
    if(da<=0)out.push(a);
    if((da<=0)!==(db<=0)){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }
  return out.flat();
}

function planarUV(g){
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=[];
  for(let i=0;i<p.count;i++)uv.push((Math.abs(n.getX(i))>.7?p.getZ(i):p.getX(i))/8,p.getY(i)/4);
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}

export function buildHeritageBuilding(root,b,m=heritageMaterials()){
  const p=b.heritageProfile;if(!p)return null;
  const builder=modelBuilder(root),H=b.h,y0=b.ground,edges=facadeEdges(b.rings[0]);
  const eligible=edges.filter(e=>e.L>10);
  const face=eligible.sort((a,c)=>(c.nx*p.frontHint[0]+c.nz*p.frontHint[1])*Math.sqrt(c.L)-(a.nx*p.frontHint[0]+a.nz*p.frontHint[1])*Math.sqrt(a.L))[0];
  if(!face)throw Error('No usable heritage facade: '+b.sourceId);
  const classical=CLASSICAL.has(p.template),colonnade=COLONNADE.has(p.template);
  const cupola=p.template==='corner-cupola',deco=p.template==='restrained-deco';
  const roofReserve=cupola?7.5:p.template==='hsbc-bank'?3.5:deco?1.8:.7;
  const bodyH=H-roofReserve,baseH=bodyH*(p.template==='citibank'?.23:.30),atticH=bodyH*.12;
  const setback=colonnade?Math.min(1.8,face.L*.055):0;
  const prism=(rings,lo,hi,mat)=>{
    if(hi<=lo)return;
    const g=createFootprintGeometry({rings:rings.map(r=>{const a=[];for(let i=0;i<r.length;i+=2)a.push([r[i],r[i+1]]);return a;}),h:hi-lo});
    g.translate(0,y0+lo-2,0);builder.add(planarUV(g),mat);
  };
  if(colonnade){
    prism(b.rings,0,baseH,m.stone);
    const inset=recessRing(b.rings[0],face,setback);prism([inset,...b.rings.slice(1)],baseH,bodyH-atticH,m.stone);
    prism(b.rings,bodyH-atticH,bodyH,m.stone);
  }else prism(b.rings,0,bodyH,m.stone);

  // Every trim follows a real edge. Only 0.38m of shallow relief projects outside the footprint.
  const wall=(e,u,y,depth=0)=>[e.a[0]+e.ux*u+e.nx*depth,y0+y,e.a[1]+e.uz*u+e.nz*depth];
  const box=(e,u,y,w,h,d,mat,depth=0)=>builder.box(w,h,d,...wall(e,u,y,depth),mat,e.yaw);
  const segment=(e,a,c,thickness,mat)=>builder.beam(wall(e,...a),wall(e,...c),thickness,mat);
  const arch=(e,u,y,w,h,depth,mat)=>{
    const s=new THREE.Shape(),r=w/2,shoulder=h/2-r;s.moveTo(-r,-h/2);s.lineTo(r,-h/2);s.lineTo(r,shoulder);s.absarc(0,shoulder,r,0,Math.PI,false);s.closePath();
    builder.add(new THREE.ShapeGeometry(s,10),mat,...wall(e,u,y,depth),e.yaw+Math.PI);
  };
  const window=(e,u,y,w,h,arched,depth)=>{
    const frame=.13;
    if(arched){
      arch(e,u,y,w+.3,h+.3,depth,m.trim);arch(e,u,y,w,h,depth+.025,m.glass);
      // Voussoirs around the arch are a shallow geometry detail, not a white painted semicircle.
      for(let i=0;i<=8;i++){const a=i*Math.PI/8,xx=u+Math.cos(a)*(w/2+.12),yy=y+h/2-w/2+Math.sin(a)*(w/2+.12);box(e,xx,yy,.22,.28,.12,m.trim,depth+.07);}
    }else{
      box(e,u,y,w+.3,h+.3,.10,m.trim,depth);box(e,u,y,w,h,.10,m.glass,depth+.065);
      box(e,u,y+h/2+.22,w+.7,.16,.32,m.pale,depth+.04);
    }
    box(e,u,y-h/2-.12,w+.48,.18,.32,m.pale,depth+.03);
    box(e,u,y,frame,h,.12,m.iron,depth+.14);box(e,u,y-.12,w,.09,.12,m.iron,depth+.14);
    if(h>2.5)box(e,u,y+h*.22,w,.07,.12,m.iron,depth+.14);
  };

  let bays=0;
  for(const e of edges){
    if(e.L<2)continue;
    const main=e===face,count=Math.max(1,Math.floor(e.L/(classical?4.2:3.5))),pitch=e.L/count;
    const floors=p.floors,fh=(bodyH-.8)/floors; bays+=count;
    for(const [yy,hh,dd]of [[.35,.65,.18],[baseH,.27,.28],[bodyH-.3,.38,.38],[bodyH+.1,.32,.34]])box(e,e.L/2,yy,e.L,hh,dd,m.trim,.025);
    if(classical){
      box(e,e.L/2,bodyH-.8,e.L,.22,.3,m.pale,.03);
      // Ground rustication, alternating quoin blocks, cornice dentils.
      for(let y=.9;y<baseH-.2;y+=.65)box(e,e.L/2,y,e.L,.035,.10,m.recess,.055);
      for(let u=.45;u<e.L-.2;u+=.85)box(e,u,bodyH-.48,.25,.22,.32,m.pale,.08);
      for(const u of [.35,e.L-.35])for(let y=.8;y<bodyH-.6;y+=.8)box(e,u,y,.62,.6,.16,m.pale,.07);
    }
    for(let f=0;f<floors;f++){
      const center=.65+fh*(f+.5),wh=Math.min(fh*.69,f===0?4.1:3.2),ww=Math.min(pitch*.54,2.35);
      // Recess the entire main middle facade, including windows, behind its real columns.
      const middle=colonnade&&main&&center>baseH&&center<bodyH-atticH;
      const depth=middle?-setback+.08:.10;
      for(let i=0;i<count;i++)window(e,(i+.5)*pitch,center,ww,wh,classical&&f===0,depth);
      if(middle){
        box(e,e.L/2,center-wh/2-.25,e.L,.22,setback, m.pale,-setback/2);
        for(const y of [center-wh/2+.1,center-wh/2+.8])box(e,e.L/2,y,e.L,.09,.1,m.iron,-.1);
        for(let u=.5;u<e.L;u+=.38)box(e,u,center-wh/2+.43,.045,.64,.06,m.iron,-.1);
      }
    }
    if(!colonnade&&classical)for(let i=1;i<count;i++){
      const u=i*pitch;box(e,u,baseH+(bodyH-baseH)/2,.38,bodyH-baseH-.7,.22,m.pale,.08);
      box(e,u,bodyH-.9,.72,.28,.3,m.trim,.08);
    }
    if(deco){
      for(let i=0;i<=count;i++)box(e,i*pitch,bodyH*.55,.32,bodyH*.87,.32,m.pale,.06);
      for(let i=0;i<3;i++)box(e,e.L/2,bodyH+i*.5,e.L*(.36-i*.08),.55,.24,m.trim,.02);
    }
  }
  if(colonnade){
    const n=p.columns||8,lo=baseH+.3,hi=bodyH-atticH-.3,r=Math.min(.55,face.L/(n*5));
    for(let i=0;i<n;i++){
      const u=face.L*(.08+.84*i/(n-1)),at=wall(face,u,(lo+hi)/2,-r*.72);
      builder.cyl(r*.86,r,hi-lo,...at,m.pale,14);
      for(const [yy,rr,hh]of [[lo,r*1.2,.22],[lo+.25,r*1.08,.15],[hi-.1,r*1.13,.19]])builder.cyl(rr,rr,hh,...wall(face,u,yy,-r*.72),m.trim,14);
      box(face,u,hi+.08,r*2.9,.28,r*2,m.trim,-r*.72);
      // Paired Ionic volutes, a simple geometric reading of the photographed capital.
      for(const side of [-1,1])builder.add(new THREE.TorusGeometry(r*.30,.07,5,10),m.pale,...wall(face,u+side*r*.8,hi+.1,-r*.72+r),face.yaw);
    }
  }
  // Main entry stays on the facade; steps and porticoes extend inward rather than across the pavement.
  const ew=Math.min(4.2,face.L*.18);
  window(face,face.L/2,baseH*.46,ew,baseH*.76,classical,.12);
  box(face,face.L/2,baseH-.35,ew+1.7,.45,.65,m.pale,-.12);
  for(let step=0;step<3;step++)box(face,face.L/2,.12+step*.16,ew+1.0-step*.25,.20,.6-step*.12,m.trim,-.3);
  if(p.template==='hsbc-bank'){
    // The raised central gable is the bank's signature; retain the ordinary flat parapets at the wings.
    const w=Math.min(12,face.L*.28),u=face.L/2;
    box(face,u,bodyH+1,w,2,.45,m.stone,-.1);window(face,u,bodyH+1,w*.55,1.5,true,.16);
    for(const [a,c]of [[[u-w*.55,bodyH+.6,.1],[u, H,.1]],[[u,H,.1],[u+w*.55,bodyH+.6,.1]]])segment(face,a,c,.19,m.trim);
  }
  if(cupola){
    // Only the photographed river/江汉路 corner receives a lantern dome, never every corner.
    const corner=[face.a,face.b].sort((a,c)=>(a[0]-b.cx)*(-.7)+(a[1]-b.cz)*.71-((c[0]-b.cx)*(-.7)+(c[1]-b.cz)*.71)).at(-1);
    const r=3.05,cx=corner[0]-face.nx*(r+.35)+face.ux*(corner===face.a?r:-r),cz=corner[1]-face.nz*(r+.35)+face.uz*(corner===face.a?r:-r);
    builder.cyl(r,r,3.7,cx,y0+bodyH+1.7,cz,m.pale,20);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,xx=cx+Math.cos(a)*(r+.035),zz=cz+Math.sin(a)*(r+.035);
      builder.box(1,2.6,.08,xx,y0+bodyH+1.8,zz,m.glass,Math.PI/2-a);
      builder.cyl(.12,.15,3,cx+Math.cos(a+Math.PI/8)*r, y0+bodyH+1.8,cz+Math.sin(a+Math.PI/8)*r,m.trim,8);
    }
    const dome=new THREE.SphereGeometry(r*1.12,24,12,0,Math.PI*2,0,Math.PI/2);dome.scale(1,.82,1);builder.add(dome,m.roof,cx,y0+H-3.1,cz);
    builder.cyl(.24,.34,.75,cx,y0+H-.4,cz,m.pale,10);
  }
  builder.finish();root.name='HankouHeritage_'+b.sourceId;
  root.userData.heritage={sourceId:b.sourceId,name:p.label,template:p.template,facadeBays:bays,mainNormal:[face.nx,face.nz],setbackM:setback,columns:colonnade?(p.columns||8):0,detailConfidence:p.detailConfidence};
  return root;
}
