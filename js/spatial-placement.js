import {pointInPolygon} from './core.js';

function ringDistance(x,z,rings){
 let best=Infinity;
 for(const ring of rings)for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
 }
 return best;
}
class SpatialIndex{
 constructor(size=64){this.size=size;this.cells=new Map();}
 insert(item,b){const n=this.size;for(let x=Math.floor(b[0]/n);x<=Math.floor(b[2]/n);x++)for(let z=Math.floor(b[1]/n);z<=Math.floor(b[3]/n);z++){const k=x+':'+z;if(!this.cells.has(k))this.cells.set(k,new Set());this.cells.get(k).add(item);}}
 query(x,z,r){const n=this.size,out=new Set();for(let ix=Math.floor((x-r)/n);ix<=Math.floor((x+r)/n);ix++)for(let iz=Math.floor((z-r)/n);iz<=Math.floor((z+r)/n);iz++)for(const item of this.cells.get(ix+':'+iz)||[])out.add(item);return out;}
}
const bounds=rings=>rings[0].reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
export class SpatialPlacement{
 constructor(data){
  this.bounds=data.bounds;this.land=data.land;this.water=data.water;this.rampCuts=data.rampCuts||[];
  this.buildings=new SpatialIndex();this.roads=new SpatialIndex();this.occupied=new SpatialIndex();
  this.sites=[];this.rejected={};
  for(const b of data.buildings){const rings=b.rings||[b.footprint];this.buildings.insert({rings},bounds(rings));}
  for(const b of data.landmarks||[])this.buildings.insert({rings:b.footprint},bounds(b.footprint));
  for(const road of data.roads)for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],width=road.mode==='person'?Math.min(road.width,Math.max(2,road.width-4)):road.width;
   const half=width/2,item={a,b,half,roadId:road.id,mode:road.mode};
   this.roads.insert(item,[Math.min(a[0],b[0])-half,Math.min(a[2],b[2])-half,Math.max(a[0],b[0])+half,Math.max(a[2],b[2])+half]);
  }
 }
 check(x,z,radius,{ignoreOccupancy=false}={}){
  if(![x,z,radius].every(Number.isFinite)||radius<0)return 'invalid';
  const b=this.bounds;if(x-radius<b[0]||x+radius>b[2]||z-radius<b[1]||z+radius>b[3])return 'boundary';
  if(this.land?.length&&!this.land.some(p=>pointInPolygon(x,z,p)))return 'outside-land';
  for(const p of this.rampCuts)if(pointInPolygon(x,z,p)||ringDistance(x,z,p)<radius+.25)return 'tunnel-ramp';
  for(const p of this.water)if(pointInPolygon(x,z,p)||ringDistance(x,z,p)<radius+.2)return 'water';
  for(const {rings}of this.buildings.query(x,z,radius+.25))if(pointInPolygon(x,z,rings)||ringDistance(x,z,rings)<radius+.25)return 'building';
  for(const s of this.roads.query(x,z,radius+.35)){
   const dx=s.b[0]-s.a[0],dz=s.b[2]-s.a[2],t=Math.max(0,Math.min(1,((x-s.a[0])*dx+(z-s.a[2])*dz)/(dx*dx+dz*dz||1)));
   if(Math.hypot(x-s.a[0]-dx*t,z-s.a[2]-dz*t)<s.half+radius+.35)return s.mode==='car'?'carriageway':'walking-corridor';
  }
  if(!ignoreOccupancy)for(const p of this.occupied.query(x,z,radius+.2))if(Math.hypot(x-p.x,z-p.z)<radius+p.radius+.2)return 'other-prop';
  return null;
 }
 reserve(kind,x,z,radius){
  const reason=this.check(x,z,radius);if(reason){this.rejected[reason]=(this.rejected[reason]||0)+1;return false;}
  const site={kind,x,z,radius};this.sites.push(site);this.occupied.insert(site,[x-radius,z-radius,x+radius,z+radius]);return true;
 }
 audit(){return {accepted:this.sites.length,byKind:this.sites.reduce((out,p)=>(out[p.kind]=(out[p.kind]||0)+1,out),{}),rejected:{...this.rejected},remainingConflicts:this.sites.filter(p=>this.check(p.x,p.z,p.radius,{ignoreOccupancy:true})).length};}
}
