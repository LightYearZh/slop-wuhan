import * as THREE from 'three/webgpu';
import {createCurtainWallMaterial,createPreWarBuildingMaterial} from './tsl-materials.js';

export function buildLandmarks(scene,landmarks) {
  const glass=createCurtainWallMaterial({glassTint:0x42647a,windowWidth:2.2,floorHeight:4,seed:7});
  const stone=createPreWarBuildingMaterial({stoneColor:0xc9b99a,windowWidth:2.6,floorHeight:4.1,seed:12});
  const silver=new THREE.MeshStandardNodeMaterial({color:0xc0c3c5,metalness:.65,roughness:.28});
  const pink=new THREE.MeshStandardNodeMaterial({color:0xaf587e,metalness:.55,roughness:.28,emissive:0x762046,emissiveIntensity:.12});
  const copper=new THREE.MeshStandardNodeMaterial({color:0x39716a,metalness:.45,roughness:.5});
  const gold=new THREE.MeshStandardNodeMaterial({color:0xcba854,metalness:.65,roughness:.32,emissive:0x704314,emissiveIntensity:.08});
  const brick=createPreWarBuildingMaterial({stoneColor:0x936e58,trimColor:0xcab89d,windowWidth:1.3,floorHeight:3,seed:31});
  const tile=new THREE.MeshStandardNodeMaterial({color:0x41474a,roughness:.88});
  const groups=[],accents=[];
  function mesh(g,geo,mat,x=0,y=0,z=0) {const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
  const box=(g,w,h,d,x,y,z,mat=stone)=>mesh(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const cylinder=(g,rt,rb,h,x,y,z,mat=silver,n=24)=>mesh(g,new THREE.CylinderGeometry(rt,rb,h,n),mat,x,y,z);
  const ball=(g,r,x,y,z,mat=pink)=>mesh(g,new THREE.SphereGeometry(r,32,24),mat,x,y,z);
  function rod(g,a,b,r,mat=silver){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),m=cylinder(g,r,r,av.distanceTo(bv),0,0,0,mat,12);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return m;}
  function roof(g,w,d,y,h,mat=gold){const geo=new THREE.ConeGeometry(1,1,4);geo.rotateY(Math.PI/4);const m=mesh(g,geo,mat,0,y+h/2,0);m.scale.set(w/Math.SQRT2,h,d/Math.SQRT2);return m;}
  function part(g,x,z){const p=new THREE.Group();p.position.set(x,0,z);g.add(p);(g.userData.collisionParts??=[]).push(p);return p;}
  function sign(g,text,x,y,z){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#373a31';ctx.fillRect(0,0,512,128);ctx.fillStyle='#e4d0a1';ctx.font='bold 80px serif';ctx.textAlign='center';ctx.fillText(text,256,96);return mesh(g,new THREE.PlaneGeometry(8,2),new THREE.MeshBasicNodeMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide}),x,y,z);}
  for(const l of landmarks) {
    const g=new THREE.Group();g.name=l.name;g.position.set(l.x,2,l.z);groups.push(g);scene.add(g);
    if(l.modelFit){g.scale.fromArray(l.modelFit.scale);g.position.add(new THREE.Vector3(...l.modelFit.offsetM));}
    if(l.type==='pearl') {
      cylinder(g,22,36,15,0,7.5,0,stone);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(g,[Math.cos(a)*55,0,Math.sin(a)*55],[Math.cos(a)*12,94,Math.sin(a)*12],5);rod(g,[Math.cos(a)*11,90,Math.sin(a)*11],[Math.cos(a)*11,275,Math.sin(a)*11],4);ball(g,7,Math.cos(a)*40,48,Math.sin(a)*40);}
      ball(g,25,0,94,0);ball(g,20,0,272,0);ball(g,8,0,350,0);
      cylinder(g,4,7,78,0,316,0);cylinder(g,.7,3,110,0,411,0);
      for(const [y,r]of [[87,25],[100,25],[266,20],[277,20]]){const band=mesh(g,new THREE.TorusGeometry(r,1.8,8,48),silver,0,y,0);band.rotation.x=Math.PI/2;}
      accents.push(pink);
    } else if(l.type==='tower') {
      const pos=[],uv=[],idx=[],N=48,S=36,H=620;
      for(let j=0;j<=N;j++)for(let i=0;i<=S;i++){
        const t=j/N,a=i/S*Math.PI*2+t*Math.PI*.66;
        const r=(42-26*t)*(1+.14*Math.cos(i/S*Math.PI*6));pos.push(Math.cos(a)*r,H*t,Math.sin(a)*r);uv.push(i/S,j/N);
        if(j<N&&i<S){const a=j*(S+1)+i,b=a+S+1;idx.push(a,b,a+1,a+1,b,b+1);}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();mesh(g,geo,glass);
      cylinder(g,15,18,12,0,626,0,silver,36);box(g,95,15,85,0,7.5,0,glass);
      for(let j=0;j<12;j++){const a=j/12*Math.PI*2;rod(g,[Math.cos(a)*42,0,Math.sin(a)*42],[Math.cos(a+Math.PI*.66)*15,620,Math.sin(a+Math.PI*.66)*15],.4,silver);}
    } else if(l.type==='swfc') {
      const shape=new THREE.Shape();shape.moveTo(-31,0);shape.lineTo(31,0);shape.lineTo(25,420);shape.lineTo(17,492);shape.lineTo(-17,492);shape.lineTo(-25,420);shape.closePath();
      const hole=new THREE.Path();hole.moveTo(-13,441);hole.lineTo(-11,476);hole.lineTo(11,476);hole.lineTo(13,441);hole.closePath();shape.holes.push(hole);
      const m=mesh(g,new THREE.ExtrudeGeometry(shape,{depth:30,bevelEnabled:false}),glass,0,0,-15);g.rotation.y=Math.PI/2-.25;box(g,88,13,62,0,6.5,0,glass);
      for(const x of [-31,31])rod(g,[x,0,0],[Math.sign(x)*17,492,0],.65,silver);
    } else if(l.type==='jinmao') {
      box(g,88,15,78,0,7.5,0,stone);
      let y=15;for(let i=0;i<17;i++){const h=18.5,w=55*(1-i*.033);box(g,w,h,w,0,y+h/2,0,glass);box(g,w+4,2.4,w+4,0,y+h,0,silver);y+=h;}
      for(let i=0;i<7;i++){const w=22-i*2.6;box(g,w,8,w,0,y+4,0,silver);y+=8;}
      cylinder(g,.4,3,420.5-y,0,(420.5+y)/2,0);
    } else if(l.type==='conference') {
      box(g,170,21,67,0,10.5,0,stone);box(g,190,2,78,0,22,0,silver);
      for(const x of [-63,63]){ball(g,20,x,28,0,glass);cylinder(g,21,21,5,x,7,0,stone);}
      for(let x=-45;x<=45;x+=9)box(g,2,15,3,x,10,35,silver);g.rotation.y=-.16;
    } else if(l.type==='temple') {
      // Courtyard, halls and stacked gold eaves form an exterior impression.
      box(g,122,.14,142,0,.07,0,new THREE.MeshStandardNodeMaterial({color:0x999588,roughness:.95}));
      const hall=(x,z,w,d,h)=>{const p=part(g,x,z);box(p,w,h,d,0,h/2,0,stone);box(p,w+2,.8,d+2,0,h,0,gold);roof(p,w+8,d+8,h,5);roof(p,w+5,d+5,h+4,4);for(let x=-w/2+4;x<w/2;x+=7)cylinder(p,.6,.7,h-2,x,h/2,d/2+.5,gold,8);return p;};
      hall(0,-26,58,35,20);hall(-43,9,24,73,11);hall(43,9,24,73,11);hall(0,53,52,18,10);
      const pagoda=part(g,0,-54);for(let i=0;i<5;i++){box(pagoda,16-i*1.7,5,16-i*1.7,0,24+i*4,0,stone);roof(pagoda,23-i*2.2,23-i*2.2,26+i*4,3);}
      cylinder(pagoda,0,2,3,0,46.5,0,gold,12);sign(g,'静安寺',0,9,63);
    } else if(l.type==='museum') {
      box(g,96,14,84,0,7,0,stone);box(g,104,2,92,0,1,0,stone);
      cylinder(g,40,44,6,0,17,0,stone,64);cylinder(g,40,40,1.5,0,20.75,0,copper,64);
      for(const x of [-30,30]){const handle=mesh(g,new THREE.TorusGeometry(8,1.4,8,32,Math.PI),stone,x,20.1,0);handle.rotation.y=Math.PI/2;}
      for(let x=-36;x<=36;x+=9)box(g,2,9,4,x,7,43,silver);
      for(let i=0;i<4;i++)box(g,48+i*7,.5,8+i*2,0,.25+i*.5,48-i*2,stone);
      sign(g,'上海博物馆',0,10,43.2);
    } else if(l.type==='exhibition') {
      const central=part(g,0,0),cross=part(g,0,-12);
      box(central,58,26,55,0,13,0,stone);box(cross,200,17,38,0,8.5,0,stone);
      for(const x of [-82,82]){const wing=part(g,x,20);box(wing,32,20,92,0,10,0,stone);box(wing,36,3,96,0,21.5,0,stone);}
      box(central,64,4,60,0,28,0,stone);cylinder(central,16,21,28,0,44,0,stone,8);cylinder(central,14,18,4,0,60,0,gold,8);
      cylinder(central,7,12,18,0,71,0,stone,8);cylinder(central,5,9,5,0,82.5,0,gold,8);cylinder(central,.5,3.8,20,0,95,0,gold,12);
      const star=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?2:5;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();mesh(central,new THREE.ExtrudeGeometry(star,{depth:.8,bevelEnabled:false}),gold,0,105,-.4);
      for(let x=-23;x<=23;x+=6)cylinder(central,.8,1,18,x,13,29,stone,12);
      for(let x=-72;x<=72;x+=9){if(Math.abs(x)<36)continue;cylinder(cross,.6,.8,12,x,10,21,stone,8);}
      sign(g,'上海展览中心',0,23,30.1);
    } else if(l.type==='lane') {
      const pavement=new THREE.MeshStandardNodeMaterial({color:0x7c8078,roughness:.95});box(g,108,.1,114,0,.05,0,pavement);
      for(const x of [-38,-14,14,38])for(const z of [-36,-10,16,42]){
        const p=part(g,x,z);box(p,17,9,19,0,4.5,0,brick);roof(p,19,21,9,3,tile);
        box(p,3.4,5,.35,0,2.5,9.7,stone);box(p,2.3,4.5,.4,0,2.25,9.95,tile);
      }
      for(const z of [-25,1,27]){rod(g,[-8,8,z],[8,8,z],.035,tile);for(const x of [-6,-2,2,6])ball(g,.35,x,7.5,z,gold);}
      sign(g,'田子坊',0,5,-52);g.userData.walkableLane=true;
    } else {
      const w=l.type==='hsbc'?86:70,d=l.type==='peace'?63:52,h=l.type==='customs'?29:l.type==='hsbc'?30:39;
      box(g,w,h,d,0,h/2,0);for(let y=8;y<h;y+=8)box(g,w+2,1.2,d+2,0,y,0);
      box(g,w+4,2.5,d+4,0,h+1,0);
      for(let x=-w/2+5;x<w/2;x+=7){cylinder(g,1.1,1.4,13,x,9,-d/2-1,stone,12);box(g,2.6,1,3,x,16,-d/2-1);}
      if(l.type==='hsbc'){cylinder(g,17,20,10,0,37,0,stone);mesh(g,new THREE.SphereGeometry(17,32,16,0,Math.PI*2,0,Math.PI/2),silver,0,44,0);}
      if(l.type==='customs'){
        box(g,19,39,20,0,49,0);box(g,23,3,24,0,69,0);box(g,15,14,16,0,77,0);cylinder(g,0,12,7,0,87,0,stone,4);
        const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#dcd5b9';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#302b23';ctx.lineWidth=4;ctx.beginPath();ctx.arc(64,64,57,0,Math.PI*2);ctx.stroke();for(let j=0;j<12;j++){const a=j/12*Math.PI*2;ctx.beginPath();ctx.moveTo(64+Math.sin(a)*47,64-Math.cos(a)*47);ctx.lineTo(64+Math.sin(a)*54,64-Math.cos(a)*54);ctx.stroke();}ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(64,64);ctx.lineTo(64,26);ctx.moveTo(64,64);ctx.lineTo(90,78);ctx.stroke();
        const clock=new THREE.MeshBasicNodeMaterial({map:new THREE.CanvasTexture(c)});for(let i=0;i<4;i++){const m=mesh(g,new THREE.PlaneGeometry(11,11),clock,Math.sin(i*Math.PI/2)*8.1,77,Math.cos(i*Math.PI/2)*8.1);m.rotation.y=i*Math.PI/2;}
      }
      if(l.type==='peace'){box(g,32,17,34,10,49,0);box(g,25,6,26,10,60,0);const roof=cylinder(g,0,19,15,10,69.5,0,copper,4);roof.rotation.y=Math.PI/4;}
      // Historical facades face the Huangpu to the east.
      g.rotation.y=-Math.PI/2-.08;
    }
  }
  return {groups,update(night){pink.emissiveIntensity=.12+night*1.1;gold.emissiveIntensity=.08+night*.55;},materials:[glass,stone,silver,pink,copper,gold,brick,tile]};
}
