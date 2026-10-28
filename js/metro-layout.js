// Local +Z is the open front. All dimensions are metres above the road surface.
export function metroParts(entrance){
 const w=entrance.width,d=entrance.depth,parts=[
  {kind:'floor',center:[0,-.015,0],size:[w+.2,.03,d+.2]},
  {kind:'glass',center:[-w/2+.2,1.25,0],size:[.08,2.5,d-.12],collision:true},
  {kind:'glass',center:[w/2-.2,1.25,0],size:[.08,2.5,d-.12],collision:true},
  {kind:'inside',center:[0,1.3,-d/2+.1],size:[w-.3,2.6,.18],collision:true},
  {kind:'glass',center:[0,2.88,0],size:[w+.25,.06,d+.25]},
  {kind:'steel',center:[0,2.92,d/2],size:[w+.35,.18,.18]},
  {kind:'steel',center:[0,2.92,-d/2],size:[w+.35,.18,.18]},
  {kind:'steel',center:[-w/2,2.92,0],size:[.18,.18,d+.18]},
  {kind:'steel',center:[w/2,2.92,0],size:[.18,.18,d+.18]},
  {kind:'roof',center:[0,2.94,0],size:[w+.35,.16,d+.35],collision:true,hidden:true},
  {kind:'light',center:[0,2.76,.4],size:[w-.7,.04,.16]},
  {kind:'stripe',center:[0,.035,d/2-.12],size:[w-.4,.025,.24]}
 ];
 for(const x of [-1,1])for(const z of [-1,1])parts.push({kind:'steel',center:[x*(w/2-.08),1.4,z*(d/2-.08)],size:[.16,2.8,.16]});
 for(const x of [-1,1])parts.push({kind:'steel',center:[x*(w/2-.35),.85,-.3],size:[.045,.045,d-.8]});
 return parts;
}
export function metroColliders(station){
 const e=station.entrance,cs=Math.cos(e.heading),sn=Math.sin(e.heading);
 return metroParts(e).filter(p=>p.collision).map((p,i)=>{
  const [x,y,z]=p.center,[w,h,d]=p.size,cx=e.x+x*cs+z*sn,cz=e.z-x*sn+z*cs,ex=Math.abs(cs)*w/2+Math.abs(sn)*d/2,ez=Math.abs(sn)*w/2+Math.abs(cs)*d/2;
  return {id:station.id+':entry:'+i,minX:cx-ex,maxX:cx+ex,minY:e.y+y-h/2,maxY:e.y+y+h/2,minZ:cz-ez,maxZ:cz+ez,obb:{cx,cz,cs,sn,hx:w/2,hz:d/2}};
 });
}
export function metroFloorRoad(station){
 const e=station.entrance,point=z=>[e.x+Math.sin(e.heading)*z,e.y,e.z+Math.cos(e.heading)*z];
 return {id:station.id+'-floor',name:station.name,points:[point(-e.depth/2+.75),point(e.depth/2+.05)],width:e.width-.6,mode:'person',layer:0,bridge:false,isMetroFloor:true,heightSource:'visual-estimate-entrance-floor'};
}
export function metroArrivalTarget(station,mode){return mode==='person'||mode==='cyclist'?{x:station.entrance.x,z:station.entrance.z}:station.entrance.approach;}
