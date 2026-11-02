import {ROAD_NODES,ROAD_LINKS,CLS,LINK_FLAG,BOUNDS,WATER,groundHeightAt,deckHeightAt,buildingAt,districtAt} from './city-config.js';
import {GEO} from './wuhan-geodata.js';
import {TaxiRoadRouter,pointAt} from './taxi-routing.js';
import {createTaxiDispatcher} from './taxi-dispatch.js';

// Join rendered tunnel bores by their recorded OSM portal node identities, never by proximity.
export function taxiTunnelLinks(nodes,sourceNodeIds,tunnels){
 const ids=new Map(sourceNodeIds.map((id,i)=>[String(id),i]));
 return tunnels.flatMap(t=>{
  const a=ids.get(String(t.sourceNodeIds?.[0])),b=ids.get(String(t.sourceNodeIds?.at(-1)));
  if(a===undefined||b===undefined||t.points.length<2)return[];
  for(const [id,p]of[[a,t.points[0]],[b,t.points.at(-1)]])if(Math.hypot(nodes[id].x-p[0],nodes[id].z-p[2])>.5||Math.abs(nodes[id].y-p[1])>1)return[];
  const pts=new Float32Array(t.points.flat()),cum=new Float32Array(t.points.length);
  for(let i=1;i<cum.length;i++)cum[i]=cum[i-1]+Math.hypot(pts[i*3]-pts[i*3-3],pts[i*3+2]-pts[i*3-1]);
  return[{id:'taxi-'+t.id,tunnelId:t.id,a,b,pts,cum,len:cum.at(-1),name:t.name,cls:CLS.primary,w:Math.min(t.width,...(t.widths||[t.width])),oneway:t.oneway,flags:LINK_FLAG.ELEVATED}];
 });
}
function motorRoad(link){
 if(link.flags&LINK_FLAG.NO_CARS||link.cls>=CLS.pedestrian||link.len<.01)return false;
 // Unsupported water crossings and mismatched terrain layers must not become navigation shortcuts.
 const count=Math.ceil(link.len/35);
 for(let i=0;i<=count;i++){
  const p=pointAt(link,link.len*i/count),ground=groundHeightAt(p.x,p.z),deck=deckHeightAt(p.x,p.z,p.y+1.2);
  if(WATER.contains(p.x,p.z)&&deck<.6)return false;
  if(Math.abs(Math.max(ground,deck)-p.y)>3.5)return false;
 }
 return true;
}
function safeStop(stop){
 for(const p of[stop,stop.curb]){
  if(p.x<BOUNDS.minX+25||p.x>BOUNDS.maxX-25||p.z<BOUNDS.minZ+25||p.z>BOUNDS.maxZ-25||WATER.contains(p.x,p.z)||buildingAt(p.x,p.z,.65))return false;
  if(Math.abs(groundHeightAt(p.x,p.z)-p.y)>1)return false;
 }
 const p=pointAt(stop.link,stop.s),a=pointAt(stop.link,stop.s-6),b=pointAt(stop.link,stop.s+6);
 if(Math.abs(b.y-a.y)>.8||Math.abs(stop.curb.y-stop.y)>.5)return false;
 const bend=Math.atan2(Math.sin(Math.atan2(p.x-a.x,p.z-a.z)-Math.atan2(b.x-p.x,b.z-p.z)),Math.cos(Math.atan2(p.x-a.x,p.z-a.z)-Math.atan2(b.x-p.x,b.z-p.z)));
 return Math.abs(bend)<.25&&deckHeightAt(stop.x,stop.z,stop.y+1.2)<stop.y+1;
}
export function createTaxiNetwork(options={}){
 const surface=ROAD_LINKS.filter(motorRoad).filter(options.validRoad||(()=>true));
 const tunnels=taxiTunnelLinks(ROAD_NODES,GEO.nodeSourceIds,GEO.tunnels||[]);
 const router=new TaxiRoadRouter(ROAD_NODES,[...surface,...tunnels]);
 const stops=[];
 for(const link of surface){
  // Motorways, bridge decks and tunnels are transit only, not passenger pickup locations.
  if(link.cls<CLS.primary||link.flags&(LINK_FLAG.ELEVATED|LINK_FLAG.SLIP)||link.w<3||link.len<60)continue;
  const count=Math.max(1,Math.floor((link.len-52)/150));
  for(let i=0;i<count;i++)for(const direction of link.oneway?[link.oneway]:[1,-1]){
   const s=26+(link.len-52)*(i+.5)/count,stop=router.stopAt('',link,s,direction);
   stop.id=`stop-${link.id}-${i}-${direction}`;
   if(!safeStop(stop))continue;
   stop.y=groundHeightAt(stop.x,stop.z);stop.curb.y=groundHeightAt(stop.curb.x,stop.curb.z);
   const district=districtAt(stop.x,stop.z);stop.name=[district,link.name||'未命名支路'].filter(Boolean).join(' · ')+'路边';
   stops.push(stop);
  }
 }
 const dispatcher=createTaxiDispatcher(router,stops,options);
 return{router,stops,dispatcher,stats:{motorLinks:surface.length,tunnelLinks:tunnels.length,stops:stops.length}};
}
