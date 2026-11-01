import {ROAD_NODES,ROAD_LINKS,CLS,LINK_FLAG} from './city-config.js';
import {TaxiRoadRouter} from './taxi-routing.js';
export function createTaxiNetwork(){
 const allowed=l=>!(l.flags&(LINK_FLAG.NO_CARS|LINK_FLAG.ELEVATED))&&l.cls<CLS.pedestrian&&[ROAD_NODES[l.a],ROAD_NODES[l.b]].every(p=>p.x>-2400&&p.x<750&&p.z>-1000&&p.z<1600&&Math.abs(p.y)<2.5);
 const router=new TaxiRoadRouter(ROAD_NODES,ROAD_LINKS,{allowed});
 const anchors=[
  ['航运中心附近 · 沿江大道',{x:-220,z:1100}],
  ['江汉关附近 · 沿江大道',{x:-45,z:740}],
  ['汉口江滩 · 沿江大道',{x:80,z:400}],
  ['巴公房子附近 · 沿江大道',{x:330,z:-210}],
  ['领事馆旧址街区 · 沿江大道',{x:560,z:-780}],
 ];
 const stops=anchors.map(([name,p])=>router.stop(name,p));
 const pairs=[[1,3],[0,2],[2,4]];
 const jobs=pairs.map(([a,b],i)=>{const pickup=stops[a],drop=stops[b];if(!pickup||!drop)return null;const trip=router.route(pickup,drop);return trip&&trip.length>450?{id:'hankou-'+(i+1),passenger:['陈女士','李先生','周女士'][i],pickup,drop,trip}:null;}).filter(Boolean);
 return{router,stops,jobs};
}
