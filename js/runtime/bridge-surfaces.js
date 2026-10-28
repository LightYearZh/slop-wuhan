// One geometric contract for bridge rendering, contact queries and outer rails.
// Pair the two mapped carriageways; their internal gap is part of the same deck.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
function route(points){
  const cum=[0];for(let i=1;i<points.length;i++)cum.push(cum.at(-1)+distance(points[i-1],points[i]));
  return {length:cum.at(-1),at(t){const s=t*cum.at(-1);let i=1;while(i<cum.length-1&&cum[i]<s)i++;const f=(s-cum[i-1])/(cum[i]-cum[i-1]||1);return points[i].map((v,k)=>points[i-1][k]+(v-points[i-1][k])*f);}};
}
export function triangleHeight(a,b,c,x,z){
  const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-10)return null;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
  if(u< -1e-7||v< -1e-7||u+v>1+1e-7)return null;
  return u*a[1]+v*b[1]+(1-u-v)*c[1];
}
export function createBridgeSurfaces(models,{step=5}={}){
  const groups=new Map(),surfaces=[],roadIds=new Set(),grid=new Map(),cell=40;
  for(const m of models){if(!groups.has(m.name))groups.set(m.name,[]);groups.get(m.name).push(m);}
  for(const [name,pair]of groups){
    if(!name||pair.length!==2)continue;
    const [a,b]=pair;let bp=b.points;
    if(distance(a.points[0],bp[0])>distance(a.points[0],bp.at(-1)))bp=bp.slice().reverse();
    const ra=route(a.points),rb=route(bp);
    if(Math.min(ra.length,rb.length)/Math.max(ra.length,rb.length)<.85)continue;
    // Only nearby parallel carriageways, never two distinct remote crossings.
    if([0,.25,.5,.75,1].some(t=>distance(ra.at(t),rb.at(t))>35))continue;
    const count=Math.ceil(Math.max(ra.length,rb.length)/step),left=[],right=[],centres=[];
    for(let i=0;i<=count;i++){
      const t=i/count,p=ra.at(t),q=rb.at(t),before=ra.at(Math.max(0,t-1/count)),after=ra.at(Math.min(1,t+1/count));
      const dx=after[0]-before[0],dz=after[2]-before[2],len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
      const cx=(p[0]+q[0])/2,cz=(p[2]+q[2])/2;
      const pa=(p[0]-cx)*nx+(p[2]-cz)*nz,pb=(q[0]-cx)*nx+(q[2]-cz)*nz;
      const lo=Math.min(pa-a.width/2-.6,pb-b.width/2-.6),hi=Math.max(pa+a.width/2+.6,pb+b.width/2+.6);
      const y=(p[1]+q[1])/2-2.12,slope=Math.abs(pa-pb)>.1?(p[1]-q[1])/(pa-pb):0;
      // Tie both mapped lanes to their own approach heights, instead of creating
      // a vertical step at the lower abutment when averaging the deck elevations.
      left.push([cx+nx*lo,y+slope*lo,cz+nz*lo]);right.push([cx+nx*hi,y+slope*hi,cz+nz*hi]);centres.push([cx,y,cz]);
    }
    const surface={name,roadIds:[a.sourceId,b.sourceId],left,right,centres,triangles:[]};
    for(let i=1;i<left.length;i++){
      for(const tri of [[left[i-1],left[i],right[i]],[left[i-1],right[i],right[i-1]]]){
        surface.triangles.push(tri);
        for(let ix=Math.floor(Math.min(...tri.map(p=>p[0]))/cell);ix<=Math.floor(Math.max(...tri.map(p=>p[0]))/cell);ix++)
          for(let iz=Math.floor(Math.min(...tri.map(p=>p[2]))/cell);iz<=Math.floor(Math.max(...tri.map(p=>p[2]))/cell);iz++){
            const key=ix+':'+iz;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(tri);
          }
      }
    }
    surface.roadIds.forEach(id=>roadIds.add(id));surfaces.push(surface);
  }
  return {surfaces,roadIds,heightAt(x,z,maxY=Infinity){let best=null;for(const tri of grid.get(Math.floor(x/cell)+':'+Math.floor(z/cell))||[]){const y=triangleHeight(...tri,x,z);if(y!==null&&y<=maxY&&(best===null||y>best))best=y;}return best;}};
}
