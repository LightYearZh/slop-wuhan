// Metres across and along the nearest source pedestrian segment, following actual bends.
export function pavingCoordinates(x,z,paths){
  let best=Infinity,out=[0,0];
  for(const path of paths){let distance=0;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.001)continue;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(length*length))),px=a[0]+t*dx,pz=a[1]+t*dz,d=(x-px)**2+(z-pz)**2;
      if(d<best){best=d;out=[((x-px)*-dz+(z-pz)*dx)/length,distance+t*length];}
      distance+=length;
    }
  }
  return out;
}
