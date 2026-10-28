import * as THREE from 'three/webgpu';
import {BODY_SPECS,buildCarGeometry,buildSteerableWheelGeo,createLoftedCarMaterial} from './actor-models.js';
import {nearbySites,SpatialSites} from './nearby-sites.js';
import {pointInPolygon} from './core.js';

export function createShanghaiTraffic(scene,roads,rampCuts=[]){
 const cars=[],matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1);
 const spec=BODY_SPECS.taxi,geo=buildCarGeometry(spec,false),wheelGeos=[buildSteerableWheelGeo(spec,-1),buildSteerableWheelGeo(spec,1)];
 const colors=[0xc7d9d5,0x343d43,0xc0b8aa,0xa0c8d5];
 const batches=colors.map(color=>{
  const mat=createLoftedCarMaterial(spec,color),body=new THREE.InstancedMesh(geo,mat,30);
  const wheels=wheelGeos.map(g=>new THREE.InstancedMesh(g,mat,60));scene.add(body,...wheels);body.castShadow=true;body.frustumCulled=false;for(const w of wheels)w.frustumCulled=false;return {body,wheels,count:0};
 });
 const startKey=p=>Math.round(p[0]/3)+':'+Math.round(p[2]/3);let next=new Map(),siteIndex=new SpatialSites([]);
 for(let i=0;i<100;i++)cars.push({road:null,segment:0,t:0,speed:6+(i%9),color:i%4,site:null,x:Infinity,z:Infinity});
 function setRoads(values){
  const candidates=values.filter(r=>r.name&&['major','minor','local'].includes(r.class)&&!r.points.some(p=>rampCuts.some(cut=>pointInPolygon(p[0],p[2],cut))));
  next=new Map();const sites=[];
  for(const r of candidates){const k=startKey(r.points[0]);if(!next.has(k))next.set(k,[]);next.get(k).push(r);}
  for(const road of candidates)for(let segment=0;segment<road.points.length-1;segment++){
   const a=road.points[segment],b=road.points[segment+1],length=Math.hypot(b[0]-a[0],b[2]-a[2]);
   for(let d=12;d<length-6;d+=48){const t=d/length;sites.push({road,segment,t,x:a[0]+(b[0]-a[0])*t,z:a[2]+(b[2]-a[2])*t});}
  }
  siteIndex=new SpatialSites(sites);for(const car of cars){car.road=null;car.site=null;car.x=car.z=Infinity;}origin=null;
 }
 let origin=null,refresh=0;
 function update(dt,player,observer=player){
  refresh+=dt;
  if(!origin||refresh>2||Math.hypot(observer.x-origin.x,observer.z-origin.z)>70){
   const occupied=new Set(cars.filter(c=>c.road&&Math.hypot(c.x-observer.x,c.z-observer.z)<650).map(c=>c.site));
   const available=nearbySites(siteIndex,observer,100,600,origin?260:0,occupied);let index=0;
   for(const car of cars)if(!car.road||Math.hypot(car.x-observer.x,car.z-observer.z)>650){const site=available[index++];if(!site){car.road=null;continue;}Object.assign(car,{road:site.road,segment:site.segment,t:site.t,site,x:site.x,z:site.z});}
   origin={x:observer.x,z:observer.z};refresh=0;
  }
  for(const b of batches)b.count=0;
  for(const car of cars){
   if(!car.road)continue;
   let ps=car.road.points,a=ps[car.segment],b=ps[car.segment+1];
   const len=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
   const x=a[0]+(b[0]-a[0])*car.t,z=a[2]+(b[2]-a[2])*car.t;
   car.x=x;car.z=z;
   const nearPlayer=Math.hypot(player.x-x,player.z-z)<10&&Math.abs(player.y-2)<4;
   car.t+=dt*(nearPlayer?0:car.speed)/len;
   if(car.t>1){car.t=0;car.segment++;if(car.segment>=ps.length-1){const options=next.get(startKey(ps.at(-1)))||[];if(options.length)car.road=options[(car.color+car.segment)%options.length];else car.road={...car.road,points:ps.slice().reverse()};car.segment=0;}continue;}
   const dx=(b[0]-a[0])/len,dz=(b[2]-a[2])/len,side=Math.min(2,car.road.width/4);
   const batch=batches[car.color],id=batch.count++;if(id>=30)continue;
   pos.set(x-dz*side,a[1]+(b[1]-a[1])*car.t,z+dx*side);q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(dx,dz));matrix.compose(pos,q,scale);batch.body.setMatrixAt(id,matrix);
   for(let s=0;s<2;s++)for(let end=0;end<2;end++){
    const local=new THREE.Vector3((s?1:-1)*spec.wheelX,spec.wheelRadius,(end?1:-1)*spec.wheelZ).applyQuaternion(q).add(pos);
    matrix.compose(local,q,scale);batch.wheels[s].setMatrixAt(id*2+end,matrix);
   }
  }
  for(const b of batches){b.body.count=Math.min(30,b.count);b.body.instanceMatrix.needsUpdate=true;for(const w of b.wheels){w.count=b.body.count*2;w.instanceMatrix.needsUpdate=true;}}
 }
 setRoads(roads);
 return {cars,update,setRoads};
}
