// Pure trip state machine. Prices are fictional gameplay values, not Wuhan tariff claims.
export const TAXI_STOP={radius:7,speed:1.1,hold:1.8,height:2.2};
export const taxiFare=(metres,seconds)=>Math.round((8+metres/1000*2+seconds/60*.35)*10)/10;
export class TaxiTrip{
 constructor(){this.phase='idle';this.job=null;this.route=null;this.distance=0;this.seconds=0;this.hold=0;this.animation=0;this.earned=0;this.completed=0;this.result=null;this.last=null;this.events=[];this.revision=0;this.message='自由漫游，随时开始接送';}
 get active(){return ['pickup','boarding','ride','alighting'].includes(this.phase);}
 get target(){return this.phase==='pickup'||this.phase==='boarding'?this.job?.pickup:this.phase==='ride'||this.phase==='alighting'?this.job?.drop:null;}
 offer(job,approach){this.job=job;this.route=approach;this.phase='offer';this.result=null;this.message='新订单，沿道路去接乘客';this.last=null;this.revision++;}
 accept(){if(this.phase!=='offer')return false;this.phase='pickup';this.last=null;this.distance=this.seconds=this.hold=0;this.events.push({type:'accepted'});this.revision++;return true;}
 cancel(message='已取消，本单不计费'){if(this.phase==='idle'){this.message=message;this.revision++;return;}this.phase='idle';this.job=null;this.route=null;this.last=null;this.hold=0;this.message=message;this.revision++;this.events.push({type:'cancelled',message});}
 update(dt,entity,{mode='car',paused=false}={}){
  if(!this.active)return;
  if(mode!=='car'){this.cancel('已结束本单：切换了移动方式');return;}
  const p=entity.position,speed=Math.abs(entity.speed||0);
  const step=this.last?Math.hypot(p.x-this.last.x,p.z-this.last.z):0;
  if(this.last&&step>Math.max(9,speed*Math.max(dt,.001)*2+3)){this.cancel('已结束本单：传送不计入接送行程');return;}
  this.last={x:p.x,y:p.y,z:p.z};if(paused)return;
  dt=Math.min(.1,Math.max(0,dt));
  if(this.phase==='ride'){this.distance+=step;this.seconds+=dt;}
  if(this.phase==='boarding'||this.phase==='alighting'){
   const t=this.target;
   if(speed>=TAXI_STOP.speed||Math.hypot(p.x-t.x,p.z-t.z)>TAXI_STOP.radius||Math.abs(p.y-t.y)>TAXI_STOP.height){this.phase=this.phase==='boarding'?'pickup':'ride';this.animation=0;this.hold=0;this.revision++;return;}
   this.animation+=dt;
   if(this.animation>=2){
    if(this.phase==='boarding'){this.phase='ride';this.distance=this.seconds=0;this.route=this.job.trip;this.events.push({type:'boarded'});}
    else{const fare=taxiFare(this.distance,this.seconds);this.result={fare,distance:this.distance,seconds:this.seconds,from:this.job.pickup.name,to:this.job.drop.name};this.earned=Math.round((this.earned+fare)*10)/10;this.completed++;this.phase='complete';this.route=null;this.events.push({type:'paid',...this.result});}
    this.hold=0;this.revision++;
   }return;
  }
  const target=this.target;
  const stopped=target&&Math.hypot(p.x-target.x,p.z-target.z)<TAXI_STOP.radius&&Math.abs(p.y-target.y)<TAXI_STOP.height&&speed<TAXI_STOP.speed;
  this.hold=stopped?this.hold+dt:0;
  if(this.hold>=TAXI_STOP.hold){this.phase=this.phase==='pickup'?'boarding':'alighting';this.animation=0;this.hold=0;this.revision++;this.events.push({type:this.phase});}
 }
}
