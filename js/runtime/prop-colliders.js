// Physical dimensions of rendered street furniture, never placement reservation radii.
export function streetPropCollider(site){
 const {x,z,kind}=site,y=site.groundY||0,angle=site.yaw||0;
 const spec={tree:[.25,8],lamp:[.12,9.2],signal:[.13,6.6],'heritage-lamp':[.12,6.5],bollard:[.18,.95]};
 let poly,top;
 if(spec[kind]){const [r,h]=spec[kind];top=h;poly=Array.from({length:12},(_,i)=>[x+Math.cos(i*Math.PI/6)*r,z+Math.sin(i*Math.PI/6)*r]).flat();}
 else {
  const [hw,hl,h]=({'planter-tree':[1.4,1.4,8],bench:[1.05,.35,1.2],'parked-scooter':[.33,.9125,1.095]})[kind]||[];
  if(!hw)return null;top=h;
  const c=Math.cos(angle),s=Math.sin(angle),offset=kind==='parked-scooter'?-.0175:0;poly=[[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]].flatMap(([a,b])=>[x+c*a+s*(b+offset),z-s*a+c*(b+offset)]);
 }
 return {kind,minX:Math.min(...poly.filter((_,i)=>i%2===0)),maxX:Math.max(...poly.filter((_,i)=>i%2===0)),minZ:Math.min(...poly.filter((_,i)=>i%2)),maxZ:Math.max(...poly.filter((_,i)=>i%2)),minY:y,maxY:y+top,poly:new Float32Array(poly)};
}
export function streetPropColliders(site,{trees=true}={}){
 const body=streetPropCollider(site);if(!body)return [];
 if(site.kind!=='planter-tree')return [body];
 body.maxY=body.minY+.4;
 return trees?[body,streetPropCollider({...site,kind:'tree'})]:[body];
}
