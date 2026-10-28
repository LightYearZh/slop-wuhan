import * as THREE from 'three/webgpu';
import {GEO} from './wuhan-geodata.js';
import {buildWuhanLandmarks} from '../wuhan-landmarks.js';

// The previous model uses ground y=2; the Taipei runtime uses street y=0.
export function buildLandmarks(scene){
  const group=new THREE.Group();group.name='WuhanLandmarks';group.position.y=-2;scene.add(group);
  const system=buildWuhanLandmarks(group,GEO.wuhanLandmarks);
  const colliders=GEO.wuhanLandmarks.map(l=>{
    const ring=l.footprint[0],xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
    return {minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),
      minY:-Infinity,maxY:l.height,poly:ring.flat(),rings:l.footprint.map(r=>new Float32Array(r.flat()))};
  });
  return {group,colliders,system};
}
