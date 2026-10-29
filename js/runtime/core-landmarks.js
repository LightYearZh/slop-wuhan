import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildYellowCrane} from './yellow-crane.js';
import {buildRedHouse} from './red-house.js';

// Real mapped positions, documented total heights; these are illustrative procedural exteriors.
export function buildCoreLandmarks(scene,landmarks,bridges=[]){
  const stone=new THREE.MeshStandardNodeMaterial({color:0xb8b19d,roughness:.85});
  const red=new THREE.MeshStandardNodeMaterial({color:0x833d2d,roughness:.78});
  const gold=new THREE.MeshStandardNodeMaterial({color:0xb88b39,roughness:.55,metalness:.15});
  const dark=new THREE.MeshStandardNodeMaterial({color:0x39464b,roughness:.5,metalness:.2});
  const roofMat=new THREE.MeshStandardNodeMaterial({color:0x4d625d,roughness:.78});
  const glass=new THREE.MeshStandardNodeMaterial({color:0x467783,roughness:.3,metalness:.45});
  const steel=new THREE.MeshStandardNodeMaterial({color:0x81918a,roughness:.65,metalness:.45});
  const bridgeRed=new THREE.MeshStandardNodeMaterial({color:0xc8442f,roughness:.44,metalness:.38});
  const bridgeSteel=new THREE.MeshStandardNodeMaterial({color:0x79877f,roughness:.52,metalness:.5});
  const bridgeConcrete=new THREE.MeshStandardNodeMaterial({color:0x9d9b92,roughness:.92});
  gold.side=roofMat.side=THREE.DoubleSide;
  const groups=[];
  const make=root=>{
    const parts=new Map();
    const add=(g,mat,x=0,y=0,z=0)=>{g.translate(x,y,z);if(!parts.has(mat))parts.set(mat,[]);parts.get(mat).push(g);};
    const box=(w,h,d,x,y,z,m=stone)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
    const cyl=(rt,rb,h,x,y,z,m=stone,n=24)=>add(new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z);
    const beam=(a,b,r=.25,m=steel)=>{
      const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),v=to.clone().sub(from),g=new THREE.CylinderGeometry(r,r,v.length(),6);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));
      const c=from.add(to).multiplyScalar(.5);add(g,m,c.x,c.y,c.z);
    };
    // Square hipped roofs with lifted corners and a second curved tier along the eaves.
    const roof=(w,d,y,m)=>{
      const pos=[],idx=[],steps=12;
      for(const side of [-1,1])for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){
        const points=[];
        for(const [u,v] of [[i,j],[i+1,j],[i+1,j+1],[i,j+1]]){
          const t=u/steps*2-1,s=v/steps;points.push([t*w/2,y+3.4*(1-s)**1.4+Math.abs(t)**5*s*s*.9,side*(s*d/2)]);
        }
        const n=pos.length/3;pos.push(...points.flat());idx.push(n,n+1,n+2,n,n+2,n+3);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();add(g,m);
      // End gables and ridge ornaments make the silhouette legible from across the river.
      for(const side of [-1,1])box(.45,.5,d,side*w/2,y+.25,0,m);
      box(w+1,.5,.6,0,y+3.5,0,m);
    };
    const finish=()=>{for(const [mat,geos]of parts){const normalized=geos.map(g=>{g.deleteAttribute('uv');if(g.index){const n=g.toNonIndexed();g.dispose();return n;}return g;});const geometry=mergeGeometries(normalized);if(!geometry)throw new Error('Cannot merge landmark geometry');const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);for(const g of normalized)g.dispose();}};
    return {add,box,cyl,beam,roof,finish};
  };
  for(const l of landmarks){
    if(l.type==='jianghanguan')continue;
    const group=new THREE.Group();group.name=l.name;group.position.set(l.x,l.groundY||0,l.z);group.rotation.y=l.ry||0;scene.add(group);groups.push(group);
    const {box,cyl,beam,roof,finish}=make(group);
    if(l.type==='yellow-crane'){
      buildYellowCrane(group);
    }else if(l.type==='red-house'){
      buildRedHouse(group,l);
    }else if(l.type==='tv-tower'){
      box(21,5,21,0,2.5,0);
      // Three tapered concrete legs merge into the shaft below the observation deck.
      for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3;beam([Math.sin(a)*13,0,Math.cos(a)*13],[Math.sin(a)*3,82,Math.cos(a)*3],2.1,stone);
      }
      cyl(3.8,5.5,132,0,70,0);
      cyl(13.5,8.2,8,0,131,0);cyl(13,13.5,8,0,139,0,glass);cyl(6.7,13,6,0,146,0);
      cyl(2.2,3.8,30,0,164,0);cyl(8.2,7.2,5,0,178,0);cyl(7,8.2,5,0,183,0,glass);
      cyl(.65,2.2,30,0,202,0);cyl(.12,.65,4.2,0,219.1,0,red);
      for(const y of [194,200,206,212])cyl(.9,.9,.8,0,y,0,red,12);
    }else if(l.type==='qingchuange'){
      const w=l.w,d=l.d;box(w,1.2,d,0,.6,0);
      for(let floor=0;floor<2;floor++){
        const y=1.2+floor*7;box(w*.8,5,d*.8,0,y+2.5,0,red);
        for(const side of [-1,1])for(let i=0;i<7;i++)cyl(.25,.3,5.6,-w*.43+i*w*.86/6,y+2.8,side*d*.43,red,8);
        roof(w+1,d+1,y+4.8,roofMat);
      }
    }
    finish();
  }
  // Add the characteristic steel trusses below the Yangtze bridge's mapped road deck.
  // The inherited Taipei module provides the traversable deck; do not add blocking landmark colliders here.
  const bridge=bridges.find(b=>b.name==='武汉长江大桥');
  if(bridge){
    const group=new THREE.Group();group.name='武汉长江大桥钢桁架';scene.add(group);groups.push(group);
    const {beam,box,finish}=make(group),pts=bridge.points;
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(!length)continue;
      const rx=-(b[2]-a[2])/length,rz=(b[0]-a[0])/length,n=Math.ceil(length/32);
      for(let j=0;j<n;j++){
        const at=t=>[a[0]+(b[0]-a[0])*t,a[1]-2.12+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
        const p=at(j/n),q=at((j+1)/n);
        if(Math.min(p[1],q[1])<10)continue;
        for(const side of [-1,1]){
          const off=side*(bridge.width*.5+3),top=v=>[v[0]+rx*off,v[1]-1.7,v[2]+rz*off],bottom=v=>[v[0]+rx*off,v[1]-10,v[2]+rz*off];
          beam(top(p),top(q),.3);beam(bottom(p),bottom(q),.35);beam(top(p),bottom(q),.22);beam(bottom(p),top(q),.22);beam(top(p),bottom(p),.22);
        }
      }
    }
    finish();
  }
  // The two Han River crossings are skyline landmarks in their own right: Qingchuan is a red tied arch,
  // Jianghan a steel truss. They share the traversable deck built by bridge-surfaces.js; these are visual only.
  const routeOf=(points)=>{
    const cum=[0];
    for(let i=1;i<points.length;i++)cum.push(cum[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
    const length=cum.at(-1);
    const at=(t)=>{const s=Math.max(0,Math.min(1,t))*length;let i=1;while(i<cum.length-1&&cum[i]<s)i++;const span=cum[i]-cum[i-1]||1,f=(s-cum[i-1])/span;return points[i].map((v,k)=>points[i-1][k]+(v-points[i-1][k])*f);};
    const tangent=(t)=>{const d=1/Math.max(1,length),a=at(Math.max(0,t-d)),b=at(Math.min(1,t+d)),dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz)||1;return[dx/L,dz/L];};
    return {length,at,tangent};
  };
  const pairRoute=(name)=>{
    const pair=bridges.filter(b=>b.name===name).sort((a,b)=>b.points.length-a.points.length);
    if(!pair.length)return null;
    if(pair.length===1)return {route:routeOf(pair[0].points),width:Math.max(24,pair[0].width*2)};
    let a=pair[0].points,b=pair[1].points;
    if(Math.hypot(a[0][0]-b[0][0],a[0][2]-b[0][2])>Math.hypot(a[0][0]-b.at(-1)[0],a[0][2]-b.at(-1)[2]))b=b.slice().reverse();
    const separation=Math.min(Math.hypot(a[0][0]-b[0][0],a[0][2]-b[0][2]),Math.hypot(a.at(-1)[0]-b.at(-1)[0],a.at(-1)[2]-b.at(-1)[2]));
    if(separation>80)return {route:routeOf(pair[0].points),width:Math.max(24,pair[0].width*2)};
    const ra=routeOf(a),rb=routeOf(b),n=Math.max(24,Math.ceil(Math.max(ra.length,rb.length)/6)),pts=[];
    for(let i=0;i<=n;i++){const t=i/n,p=ra.at(t),q=rb.at(t);pts.push([(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2]);}
    const mid=Math.hypot(ra.at(.5)[0]-rb.at(.5)[0],ra.at(.5)[2]-rb.at(.5)[2]);
    return {route:routeOf(pts),width:Math.min(30,Math.max(24,mid+(pair[0].width+pair[1].width)/2))};
  };
  const bridgeRoot=(name)=>{
    const group=new THREE.Group();group.name=name;scene.add(group);groups.push(group);
    return {group,...make(group)};
  };
  const addPier=(box,route,t,w)=>{
    const p=route.at(t),top=p[1]-2.12;
    if(top>1.2)box(w,top,w*.55,p[0],top/2,p[2],bridgeConcrete);
  };

  const qingchuan=pairRoute('晴川桥');
  if(qingchuan){
    const {beam,box,finish}=bridgeRoot('晴川桥钢拱');
    const {route,width}=qingchuan,rise=55,t0=.36,t1=.64,n=Math.max(20,Math.ceil((t1-t0)*route.length/7)),ribs=[[],[]];
    for(let side=0;side<2;side++){
      const sign=side?1:-1;
      for(let i=0;i<=n;i++){
        const t=t0+(t1-t0)*i/n,p=route.at(t),tan=route.tangent(t),nx=-tan[1],nz=tan[0];
        ribs[side].push([p[0]+nx*sign*width*.5,p[1]-2.12+rise*Math.sin(Math.PI*i/n),p[2]+nz*sign*width*.5]);
      }
      for(let i=1;i<=n;i++)beam(ribs[side][i-1],ribs[side][i],1.15,bridgeRed);
      for(let i=1;i<n;i++){
        const t=t0+(t1-t0)*i/n,deckY=route.at(t)[1]-2.12;
        if(ribs[side][i][1]-deckY>2)beam([ribs[side][i][0],deckY,ribs[side][i][2]],ribs[side][i],.12,bridgeSteel);
      }
    }
    for(let i=2;i<n;i+=2)beam(ribs[0][i],ribs[1][i],.18,bridgeRed);
    addPier(box,route,t0,width*.7);addPier(box,route,t1,width*.7);
    finish();
  }

  const jianghan=pairRoute('江汉桥');
  if(jianghan){
    const {beam,box,finish}=bridgeRoot('江汉桥钢桁架');
    const {route,width}=jianghan;
    for(const [s0,s1,height] of [[0,.365,7],[.365,.635,11],[.635,1,7]]){
      const n=Math.max(8,Math.ceil((s1-s0)*route.length/6)),sides=[];
      for(let side=0;side<2;side++){
        const sign=side?1:-1,top=[],bot=[];
        for(let i=0;i<=n;i++){
          const t=s0+(s1-s0)*i/n,p=route.at(t),tan=route.tangent(t),nx=-tan[1],nz=tan[0],deckY=p[1]-2.12,off=sign*width*.5;
          top.push([p[0]+nx*off,deckY+height*Math.sin(Math.PI*i/n),p[2]+nz*off]);
          bot.push([p[0]+nx*off,deckY,p[2]+nz*off]);
        }
        for(let i=1;i<=n;i++){beam(top[i-1],top[i],.28,bridgeSteel);beam(bot[i-1],bot[i],.34,bridgeSteel);}
        for(let i=0;i<=n;i++)beam(bot[i],top[i],.15,bridgeSteel);
        for(let i=1;i<=n;i++)beam(bot[i-1],top[i],.14,bridgeSteel);
        sides.push(top);
      }
      for(let i=1;i<n;i+=2)beam(sides[0][i],sides[1][i],.16,bridgeSteel);
      addPier(box,route,s0,width*.55);
    }
    addPier(box,route,1,width*.55);
    finish();
  }
  return {groups,materials:[stone,red,gold,dark,roofMat,glass,steel,bridgeRed,bridgeSteel,bridgeConcrete]};
}
