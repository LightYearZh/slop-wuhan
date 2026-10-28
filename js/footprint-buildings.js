import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {pointInPolygon} from './core.js';

export function footprintRings(building){return building.rings||[building.footprint];}
export function renderParts(building){return building.massingParts?.length?building.massingParts.map((p,i)=>({...building,...p,id:building.id+':part:'+i,massingParts:null,footprint:p.rings[0],frontages:[]})):[building];}
export function buildingColliders(building){return renderParts(building).map(footprintCollider);}
export function footprintCollider(building){
 const rings=footprintRings(building),xs=rings[0].map(p=>p[0]),zs=rings[0].map(p=>p[1]);
 return {id:building.id,rings,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),minY:2+(building.baseY||0),maxY:2+(building.baseY||0)+building.h};
}

// Keep the exact courtyard and concave outline for collision as well as rendering.
export function footprintPush(x,z,radius,rings){
 let best=null;
 for(const ring of rings)for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz;
  if(!len2)continue;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len2));
  const px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(x-px,z-pz);
  if(!best||d<best.d)best={x:px,z:pz,d,dx,dz};
 }
 if(!best)return null;
 const inside=pointInPolygon(x,z,rings);
 if(!inside&&best.d>=radius)return null;
 let nx=(x-best.x)/(best.d||1),nz=(z-best.z)/(best.d||1);
 if(inside){nx=-nx;nz=-nz;}
 if(best.d<1e-7){
  const l=Math.hypot(best.dx,best.dz);nx=-best.dz/l;nz=best.dx/l;
  if(pointInPolygon(best.x+nx*.02,best.z+nz*.02,rings)){nx=-nx;nz=-nz;}
 }
 return {x:best.x+nx*(radius+.025),z:best.z+nz*(radius+.025),nx,nz};
}

export function createFootprintGeometry(building){
 const rings=footprintRings(building);
 const shape=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));
 for(const hole of rings.slice(1))shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));
 const geo=new THREE.ExtrudeGeometry(shape,{depth:building.h,bevelEnabled:false,steps:1,curveSegments:1});
 geo.rotateX(-Math.PI/2);geo.translate(0,2+(building.baseY||0),0);
 return geo;
}

export function createFootprintMeshes(buildings,wall,roof){
 const group=new THREE.Group(),caps=[],walls=[];
 for(const b of buildings.flatMap(renderParts)){
  const geo=createFootprintGeometry(b);
  for(const source of geo.groups){
   const part=new THREE.BufferGeometry();
   for(const name of ['position','normal','uv']){
    const attr=geo.getAttribute(name),begin=source.start*attr.itemSize,end=(source.start+source.count)*attr.itemSize;
    part.setAttribute(name,new THREE.Float32BufferAttribute(attr.array.slice(begin,end),attr.itemSize));
   }
   (source.materialIndex===0?caps:walls).push(part);
  }
  geo.dispose();
 }
 for(const [geos,mat]of [[caps,roof],[walls,wall]]){
  if(!geos.length)continue;
  const merged=mergeGeometries(geos,false);for(const g of geos)g.dispose();
  const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 return group;
}
