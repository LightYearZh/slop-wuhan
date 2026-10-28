import {footprintPush} from '../footprint-buildings.js';

// Adapt the proven Wuhan hole-aware collision to Taipei's normal/depth contract.
export function circleFootprint(x,z,radius,collider){
  if(!collider.wuhanRings){
    collider.wuhanRings=(collider.rings||[collider.poly]).map(flat=>{
      const ring=Array.from({length:flat.length/2},(_,i)=>[flat[i*2],flat[i*2+1]]);
      ring.push([...ring[0]]);return ring;
    });
  }
  const hit=footprintPush(x,z,radius,collider.wuhanRings);
  return hit?{nx:hit.nx,nz:hit.nz,depth:Math.hypot(hit.x-x,hit.z-z)}:null;
}
