// Wuhan topology adapter. Inspired by London Loop's RoadGraph/RideLDN separation.
// Use surveyed node identities; never merge nearby crossings or invent a straight-line fallback.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function pointAt(link,s){
 s=Math.max(0,Math.min(link.len,s));let i=1;while(i<link.cum.length-1&&link.cum[i]<s)i++;
 const a=(i-1)*3,b=i*3,t=(s-link.cum[i-1])/(link.cum[i]-link.cum[i-1]||1);
 return{x:link.pts[a]+(link.pts[b]-link.pts[a])*t,y:link.pts[a+1]+(link.pts[b+1]-link.pts[a+1])*t,z:link.pts[a+2]+(link.pts[b+2]-link.pts[a+2])*t};
}
export function pathLength(points){return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);}
export function projectPath(points,p){
 let best=null,along=0,total=pathLength(points);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.001)continue;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(len*len))),q={x:a.x+dx*t,y:a.y+(b.y-a.y)*t,z:a.z+dz*t};
  const d=distance(q,p);if(Math.abs((p.y??q.y)-q.y)<4&&(!best||d<best.distance))best={...q,distance:d,along:along+t*len,remaining:total-along-t*len,index:i};along+=len;
 }
 return best;
}
export class TaxiRoadRouter{
 constructor(nodes,links,{allowed=()=>true}={}){
  this.nodes=nodes;this.links=links.filter(allowed);this.adj=Array.from(nodes,()=>[]);
  for(const l of this.links){if(l.oneway>=0)this.adj[l.a].push({to:l.b,cost:l.len,link:l,start:0,end:l.len});if(l.oneway<=0)this.adj[l.b].push({to:l.a,cost:l.len,link:l,start:l.len,end:0});}
 }
 snap(p,maxDistance=90,filter=()=>true){
  let best=null;
  for(const l of this.links){if(!filter(l))continue;
   for(let i=1;i<l.cum.length;i++){
    const a=(i-1)*3,b=i*3,dx=l.pts[b]-l.pts[a],dz=l.pts[b+2]-l.pts[a+2],len=l.cum[i]-l.cum[i-1];
    const u=Math.max(0,Math.min(1,((p.x-l.pts[a])*dx+(p.z-l.pts[a+2])*dz)/(dx*dx+dz*dz||1))),s=l.cum[i-1]+len*u,q=pointAt(l,s),d=distance(p,q);
    if(d<=maxDistance&&Math.abs((p.y??q.y)-q.y)<4&&(!best||d<best.distance))best={...q,link:l,s,distance:d,heading:Math.atan2(dx,dz)+(l.oneway<0?Math.PI:0)};
   }
  }return best;
 }
 route(from,to){
  const a=from.link?from:this.snap(from),b=to.link?to:this.snap(to);if(!a||!b)return null;
  const S=this.nodes.length,T=S+1,dist=new Map([[S,0]]),prev=new Map(),closed=new Set(),heap=[];
  const push=(id,cost)=>{let i=heap.length;heap.push({id,cost});while(i>0){const p=(i-1)>>1;if(heap[p].cost<=cost)break;heap[i]=heap[p];i=p;}heap[i]={id,cost};};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=last.cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
  const edge=(link,start,end,to)=>({link,start,end,to,cost:Math.abs(end-start)});
  const starts=[];if(a.link.oneway>=0)starts.push(edge(a.link,a.s,a.link.len,a.link.b));if(a.link.oneway<=0)starts.push(edge(a.link,a.s,0,a.link.a));
  if(a.link===b.link&&((b.s>=a.s&&a.link.oneway>=0)||(b.s<=a.s&&a.link.oneway<=0)))starts.push(edge(a.link,a.s,b.s,T));
  push(S,0);
  while(heap.length){const {id,cost}=pop();if(closed.has(id))continue;closed.add(id);if(id===T)break;
   const edges=id===S?[...starts]:[...this.adj[id]];
   if(id===b.link.a&&b.link.oneway>=0)edges.push(edge(b.link,0,b.s,T));
   if(id===b.link.b&&b.link.oneway<=0)edges.push(edge(b.link,b.link.len,b.s,T));
   for(const e of edges){const next=cost+e.cost;if(!closed.has(e.to)&&next<(dist.get(e.to)??Infinity)){dist.set(e.to,next);prev.set(e.to,{id,edge:e});push(e.to,next);}}
  }
  if(!dist.has(T))return null;
  const edges=[];for(let id=T;id!==S;){const item=prev.get(id);if(!item)return null;edges.push(item.edge);id=item.id;}edges.reverse();
  const points=[];for(const e of edges){const values=[e.start,...Array.from(e.link.cum).filter(s=>s>Math.min(e.start,e.end)+.01&&s<Math.max(e.start,e.end)-.01).sort((x,y)=>e.end>=e.start?x-y:y-x),e.end];for(const s of values){const p={...pointAt(e.link,s),road:e.link.name};if(!points.length||distance(points.at(-1),p)>.02)points.push(p);}}
  if(points.length<2)points.push({...b});
  return{points,length:pathLength(points),edges};
 }
 stop(name,anchor){
  const snap=this.snap(anchor,110,l=>l.name==='沿江大道'&&l.oneway!==0&&pointAt(l,l.len).z<pointAt(l,0).z);
  if(!snap)return null;
  const right={x:-Math.cos(snap.heading),z:Math.sin(snap.heading)},lane=Math.max(0,snap.link.w/2-1.65),kerb=snap.link.w/2+1.2;
  return{name,...snap,x:snap.x+right.x*lane,z:snap.z+right.z*lane,curb:{x:snap.x+right.x*kerb,y:snap.y,z:snap.z+right.z*kerb}};
 }
}
