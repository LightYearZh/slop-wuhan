import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildStrip} from './road-geometry.js';
import {pointInPolygon} from './core.js';

// A tile owns only geometry and its optional sign texture. Materials are shared
// by the city, so travelling to another district never grows a material cache.
export function buildTileStreets(group,tile,materials){
 const roads=[],marks=[],railings=[],sites=[],treeSites=[];
 const inside=(x,z)=>tile.land.some(p=>pointInPolygon(x,z,p));
 const clear=(x,z)=>inside(x,z)&&!tile.buildings.some(b=>Math.abs(x-b.x)<b.w*.65+1&&Math.abs(z-b.z)<b.d*.65+1);
 for(const r of tile.roads||[]){
  if(r.points.length<2)continue;
  roads.push(buildStrip(r.points,r.width));
  for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],len=Math.hypot(b[0]-a[0],b[2]-a[2]);if(len<3)continue;
   const dx=(b[0]-a[0])/len,dz=(b[2]-a[2])/len;
   for(let d=4;d<len-2;d+=18){const t=d/len,u=Math.min(len-1,d+6)/len,p=a.map((v,k)=>v+(b[k]-v)*t),q=a.map((v,k)=>v+(b[k]-v)*u);p[1]+=.025;q[1]+=.025;marks.push(buildStrip([p,q],.14));}
   if(r.bridge){for(const side of [-1,1]){const points=[a,b].map(p=>[p[0]-dz*side*(r.width/2-.2),p[1]+1.1,p[2]+dx*side*(r.width/2-.2)]);railings.push(buildStrip(points,.24));}continue;}
   if(r.width<10)continue;
   for(let d=20;d<len-2;d+=55){
    const t=d/len,side=(Math.floor(d/55)+i)%2?1:-1,x=a[0]+dx*d-dz*(r.width/2+2.5)*side,z=a[2]+dz*d+dx*(r.width/2+2.5)*side;
    if(!clear(x,z))continue;
    sites.push({x,z,angle:Math.atan2(dx,dz)});
    const tx=x-dz*3*side,tz=z+dx*3*side;
    if(clear(tx,tz))treeSites.push({x:tx,z:tz,y:2,scale:.85,species:0,yaw:Math.atan2(dx,dz)});
   }
  }
 }
 for(const [geos,material,name]of [[roads,materials.road,'Road surfaces'],[marks,materials.paint,'Lane markings'],[railings,materials.rail,'Bridge parapets']]){
  if(!geos.length)continue;const mesh=new THREE.Mesh(mergeGeometries(geos),material);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);for(const g of geos)g.dispose();
 }
 if(sites.length){
  const poles=new THREE.InstancedMesh(materials.poleGeo,materials.pole,sites.length),bulbs=new THREE.InstancedMesh(materials.bulbGeo,materials.bulb,sites.length),m=new THREE.Matrix4();
  // Clone shared geometry so tile disposal cannot invalidate another tile.
  poles.geometry=materials.poleGeo.clone();bulbs.geometry=materials.bulbGeo.clone();
  sites.forEach((p,i)=>{poles.setMatrixAt(i,m.makeTranslation(p.x,5.5,p.z));bulbs.setMatrixAt(i,m.makeTranslation(p.x,9.1,p.z));});group.add(poles,bulbs);
 }
 let signTexture=null,signMaterial=null;
 const named=(tile.roads||[]).find(r=>r.name&&!r.bridge&&r.points.length>1);
 if(named){
  const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#245344';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#d9e4d5';ctx.lineWidth=4;ctx.strokeRect(5,5,502,86);ctx.fillStyle='#fff';ctx.font='bold 42px system-ui';ctx.textAlign='center';ctx.fillText(named.name,256,63);
  signTexture=new THREE.CanvasTexture(c);signMaterial=new THREE.MeshBasicNodeMaterial({map:signTexture,side:THREE.DoubleSide});const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.3,1),signMaterial),p=named.points[0];sign.position.set(p[0]+named.width/2+1,5,p[2]);group.add(sign);
 }
 return {pedSites:sites,treeSites,dispose(){signTexture?.dispose();signMaterial?.dispose();}};
}
