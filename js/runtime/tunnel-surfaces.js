import {tunnelHasSides} from './surface-barriers.js';
// Reuse Shanghai's signed surface selection, vehicle clearance and camera rules.
// The same strip vertices feed both the renderer and exact triangle contact.
import {SurfaceProvider,constrainTunnelCamera} from '../core.js';
import {vehicleLateralLimit} from '../vehicle-road.js';
import {triangleHeight} from './bridge-surfaces.js';
export function createTunnelSystem(routes=[],rampCuts=[]){
 const provider=new SurfaceProvider(routes,[],rampCuts),surfaces=routes.map(road=>{
  const vertices=[];
  road.points.forEach((p,i)=>{const a=road.points[Math.max(0,i-1)],b=road.points[Math.min(road.points.length-1,i+1)];
   const normal=(a,b)=>{const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1;return [-dz/len,dx/len];};
   const n0=normal(i?p:road.points[0],b),n1=normal(a,i<road.points.length-1?p:road.points.at(-1));
   if(i===0){n1[0]=n0[0];n1[1]=n0[1];}if(i===road.points.length-1){n0[0]=n1[0];n0[1]=n1[1];}
   const len=Math.hypot(n0[0]+n1[0],n0[1]+n1[1])||1,nx=(n0[0]+n1[0])/len,nz=(n0[1]+n1[1])/len,miter=1/Math.max(.5,nx*n0[0]+nz*n0[1]);
   for(const side of [-1,1])vertices.push([p[0]+nx*miter*side*(road.widths?.[i]||road.width)/2,p[1],p[2]+nz*miter*side*(road.widths?.[i]||road.width)/2]);
  });return {road,vertices};
 }),byId=new Map(surfaces.map(s=>[s.road.id,s]));
 function floorAt(x,z,id){const s=byId.get(id);if(!s)return null;
  const near=provider.nearest(x,z,r=>r.id===id);if(!near)return null;
  // Small local search handles station mitres at corners as well as the nearest segment.
  const idx=near.segment;
  for(let i=Math.max(0,idx-3);i<Math.min(s.road.points.length-1,idx+4);i++){
   const j=i*2,v=s.vertices;for(const tri of [[v[j],v[j+1],v[j+2]],[v[j+1],v[j+3],v[j+2]]]){const y=triangleHeight(...tri,x,z);if(y!==null)return y;}
  }return null;
 }
 function sample(x,z,y,id=null){const s=provider.sample({x,z,y,mode:'car',surfaceId:id});if(!s.road)return null;const height=floorAt(x,z,s.surfaceId);return height===null?null:{...s,height};}
 function move(car){
  let s=sample(car.position.x,car.position.z,car.position.y,car.tunnelId);
  if(!s&&car.tunnelId){const n=provider.nearest(car.position.x,car.position.z,r=>r.id===car.tunnelId);
   // Shallow surface connections may be left sideways. Deeper walls retain the car.
   if(n&&tunnelHasSides(n.height)){s={road:n.road,surfaceId:n.road.id};}
  }
  if(!s){car.tunnelId=null;return null;}
  const n=provider.nearest(car.position.x,car.position.z,r=>r.id===s.road.id),dx=n.b[0]-n.a[0],dz=n.b[2]-n.a[2];
  const widths=s.road.widths,width=widths?widths[n.segment]+(widths[n.segment+1]-widths[n.segment])*n.t:s.road.width;
  const limit=vehicleLateralLimit(car.heading,dx,dz,width);
  if(tunnelHasSides(n.height)&&n.distance>limit){const k=limit/n.distance;car.position.x=n.x+(car.position.x-n.x)*k;car.position.z=n.z+(car.position.z-n.z)*k;car.vx=car.vz=0;}
  const h=floorAt(car.position.x,car.position.z,s.road.id);
  if(h===null){car.tunnelId=null;return null;}
  car.tunnelId=s.road.id;car.position.y=h;return {...s,height:h};
 }
 function camera(position,car){const road=byId.get(car.tunnelId)?.road;if(!road||car.position.y> -1)return null;const p=constrainTunnelCamera(position,{...car.position,heading:car.heading},Math.min(road.width,...(road.widths||[road.width])),road.clearance,road);p.y=Math.min(p.y,car.position.y+2.9);return p;}
 return {provider,surfaces,floorAt,sample,move,camera};
}
