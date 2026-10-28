import {pointInPolygon} from './core.js';
export const LINE_COLORS={'1':'#c73945','2':'#65a336','3':'#dca529','4':'#8154a5','5':'#a05289','6':'#c95d98','7':'#d88035','8':'#4586c4','9':'#5ba7c8','10':'#9a89bf','11':'#9c4851','12':'#338b72','13':'#c389a7','14':'#7a8552','15':'#ae9c74','16':'#5eaaa0','17':'#ad735c','18':'#b69875','41':'#89908c'};
export const lineName=id=>String(id)==='41'?'浦江线':id+'号线';
const bounds=polygons=>polygons.flatMap(p=>p[0]).reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
export function buildMapCatalog(data){
 const districts=(data.districts||[]).map(d=>({...d,bounds:bounds(d.polygons)})),inside=(d,p)=>p.x>=d.bounds[0]&&p.x<=d.bounds[2]&&p.z>=d.bounds[1]&&p.z<=d.bounds[3]&&d.polygons.some(r=>pointInPolygon(p.x,p.z,r));
 const destinations=[...(data.landmarks||[]).map(p=>({...p,category:'landmark'})),...(data.places||[]).map(p=>({...p,category:'place'})),...(data.metroStations||[]).map(p=>({...p,category:'metro'}))].map(p=>{
  const district=districts.find(d=>inside(d,p));return {...p,districtId:district?.id||'',districtName:district?.name||'区域边界',lineIds:(p.lines||[]).map(String)};
 });
 const ids=[...new Set(destinations.flatMap(p=>p.lineIds))].sort((a,b)=>Number(a)-Number(b)),lines=ids.map(id=>({id,name:lineName(id),color:LINE_COLORS[id]||'#92b0a5',count:destinations.filter(p=>p.category==='metro'&&p.lineIds.includes(id)).length}));
 function filter({type='landmark',district='all',line='all',query=''}={}){const q=query.trim().normalize('NFKC').toLocaleLowerCase();return destinations.filter(p=>(type==='all'||p.category===type)&&(district==='all'||p.districtId===district)&&(line==='all'||p.category==='metro'&&p.lineIds.includes(String(line)))&&(!q||[p.name,p.stationName||'',p.districtName,p.district||'',...(p.aliases||[]),...p.lineIds.map(lineName)].some(n=>n.normalize('NFKC').toLocaleLowerCase().includes(q))));}
 return {destinations,districts,lines,filter};
}
export function clusterMapPoints(points,{pixelsPerWorld,radiusPx=40}){
 const scale=Math.max(1e-9,pixelsPerWorld),groups=[];
 for(const point of points){let group=groups.find(g=>Math.hypot(g.x-point.x,g.z-point.z)*scale<radiusPx);if(!group){group={x:point.x,z:point.z,members:[]};groups.push(group);}const n=group.members.length;group.x=(group.x*n+point.x)/(n+1);group.z=(group.z*n+point.z)/(n+1);group.members.push(point);}
 return groups;
}
