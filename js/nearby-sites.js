// Fixed actor pools follow the viewer without allocating more scene objects.
// Occupied sites and a minimum radius keep replacements out of the near field.
export function nearbySites(sites,position,count,radius,minDistance=0,occupied=new Set()){
 const min2=minDistance*minDistance,max2=radius*radius;
 const candidates=sites instanceof SpatialSites?sites.within(position,radius):sites;
 return candidates.filter(site=>!occupied.has(site)).map(site=>({site,d2:(site.x-position.x)**2+(site.z-position.z)**2})).filter(p=>p.d2>=min2&&p.d2<=max2).sort((a,b)=>a.d2-b.d2).slice(0,count).map(p=>p.site);
}

export class SpatialSites{
 constructor(sites,size=500){this.cells=new Map();this.size=size;for(const site of sites){const key=Math.floor(site.x/size)+':'+Math.floor(site.z/size);if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(site);}}
 within({x,z},radius){const n=this.size,out=[];for(let ix=Math.floor((x-radius)/n);ix<=Math.floor((x+radius)/n);ix++)for(let iz=Math.floor((z-radius)/n);iz<=Math.floor((z+radius)/n);iz++)out.push(...(this.cells.get(ix+':'+iz)||[]));return out;}
}
