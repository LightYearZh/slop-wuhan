export class MapViewport{
 constructor(bounds,{aspect=(bounds[2]-bounds[0])/(bounds[3]-bounds[1]),minWidth=500}={}){this.bounds=bounds;this.aspect=aspect;this.minWidth=minWidth;this.reset();}
 reset(){const b=this.bounds;this.w=Math.max(b[2]-b[0],(b[3]-b[1])*this.aspect);this.h=this.w/this.aspect;this.x=(b[0]+b[2]-this.w)/2;this.z=(b[1]+b[3]-this.h)/2;}
 setAspect(aspect){if(!(aspect>0))return;const x=this.x+this.w/2,z=this.z+this.h/2;this.aspect=aspect;this.h=this.w/aspect;this.x=x-this.w/2;this.z=z-this.h/2;this.constrain();}
 fitBounds(b,{padding=.15,minWidth=this.minWidth}={}){const width=Math.max(b[2]-b[0],(b[3]-b[1])*this.aspect)*(1+padding*2);this.centerOn({x:(b[0]+b[2])/2,z:(b[1]+b[3])/2},Math.max(this.minWidth,minWidth,width));}
 zoom(factor,anchor={x:this.x+this.w/2,z:this.z+this.h/2}){
  const u=(anchor.x-this.x)/this.w,v=(anchor.z-this.z)/this.h;
  if(!(factor>0))return;const maximum=Math.max(this.bounds[2]-this.bounds[0],(this.bounds[3]-this.bounds[1])*this.aspect),w=Math.max(this.minWidth,Math.min(maximum,this.w/factor)),ratio=w/this.w;
  this.w=w;this.h*=ratio;this.x=anchor.x-u*this.w;this.z=anchor.z-v*this.h;this.constrain();
 }
 pan(dx,dz){this.x+=dx;this.z+=dz;this.constrain();}
 centerOn(p,width=5000){this.w=Math.max(this.minWidth,Math.min(Math.max(this.bounds[2]-this.bounds[0],(this.bounds[3]-this.bounds[1])*this.aspect),width));this.h=this.w/this.aspect;this.x=p.x-this.w/2;this.z=p.z-this.h/2;this.constrain();}
 constrain(){const b=this.bounds;this.x=this.w>=b[2]-b[0]?(b[0]+b[2]-this.w)/2:Math.max(b[0],Math.min(b[2]-this.w,this.x));this.z=this.h>=b[3]-b[1]?(b[1]+b[3]-this.h)/2:Math.max(b[1],Math.min(b[3]-this.h,this.z));}
 get box(){return [this.x,this.z,this.w,this.h].join(' ');}
}
