import {pointInPolygon} from '../core.js';

export const roofRings=flatRings=>flatRings.map(r=>Array.from({length:r.length/2},(_,i)=>[r[i*2],r[i*2+1]]));
export function roofRectangle(x,z,ux,uz,hx,hz){
  return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([u,v])=>[x+ux*u-uz*v,z+uz*u+ux*v]);
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function intersects(a,b,c,d){
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b),eps=1e-7;
  if(Math.max(a[0],b[0])+eps<Math.min(c[0],d[0])||Math.max(c[0],d[0])+eps<Math.min(a[0],b[0])||
     Math.max(a[1],b[1])+eps<Math.min(c[1],d[1])||Math.max(c[1],d[1])+eps<Math.min(a[1],b[1]))return false;
  return abC*abD<=eps&&cdA*cdB<=eps;
}
export function roofRectangleFits(rings,x,z,ux,uz,hx,hz,margin=.2){
  const rect=roofRectangle(x,z,ux,uz,hx+margin,hz+margin);
  if(!rect.every(p=>pointInPolygon(...p,rings)))return false;
  for(const ring of rings){
    if(ring.some(p=>pointInPolygon(...p,[rect])))return false; // also rejects an enclosed courtyard
    for(let i=0;i<ring.length;i++)for(let j=0;j<4;j++){
      if(intersects(ring[i],ring[(i+1)%ring.length],rect[j],rect[(j+1)%4]))return false;
    }
  }
  return true;
}
export function fitRoofShed(rings,box,r2,r3){
  const targetX=box.hx*(.55+r2*.35),targetZ=box.hz*(.6+r3*.3);
  // The old candidate touched a bounding-box edge exactly, so containment rejected almost every rectangular roof.
  // Inset it, then shrink / move within the actual polygon instead of discarding all roof detail.
  for(const shrink of [1,.8,.6,.45]){
    const sx=targetX*shrink,sz=targetZ*shrink;
    if(sx<1.5||sz<1.25)continue;
    const end=Math.max(0,box.hx-sx*1.04-.5)*(r3<.5?-1:1);
    for(const [u,v] of [[end,0],[0,0],[-end,0],[0,box.hz*.35],[0,-box.hz*.35]]){
      const x=box.cx+box.ux*u-box.uz*v,z=box.cz+box.uz*u+box.ux*v;
      // Include the roof's 4% / 8% eaves, not only the shed's walls.
      if(roofRectangleFits(rings,x,z,box.ux,box.uz,sx*1.04,sz*1.08))return {x,z,w:sx*2,d:sz*2};
    }
  }
  return null;
}
