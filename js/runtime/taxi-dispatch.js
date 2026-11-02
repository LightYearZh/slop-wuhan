// Random pairs of legal roadside stops, not a list of pre-authored routes.
export function createTaxiDispatcher(router,stops,{rng=Math.random,validStop=()=>true}={}){
 let sequence=0,lastPair='';
 const random=()=>Math.max(0,Math.min(1-Number.EPSILON,Number(rng())||0));
 const take=(list,nearby=false)=>list.splice(Math.floor((nearby?random()**3:random())*list.length),1)[0];
 const near=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function offer(from){
  const start=router.snap(from);if(!start)return null;
  const reachable=router.reachable(start);
  // Nearby pickups are more likely, but there is no service-radius cutoff.
  const pickups=stops.filter(reachable).sort((a,b)=>near(a,from)-near(b,from));
  for(let i=0;i<12&&pickups.length;i++){
   const pickup=take(pickups,true);if(!validStop(pickup))continue;
   const approach=router.route(start,pickup);if(!approach)continue;
   const reachableDrop=router.reachable(pickup);
   const drops=stops.filter(s=>s.id!==pickup.id&&near(s,pickup)>35&&reachableDrop(s));
   for(let j=0;j<40&&drops.length;j++){
    const drop=take(drops),pair=pickup.id+'>'+drop.id;
    if(pair===lastPair||!validStop(drop))continue;
    const trip=router.route(pickup,drop);
    // Exclude effectively standing still, without imposing a maximum trip length.
    if(!trip||trip.length<80)continue;
    lastPair=pair;
    const passenger=['陈女士','李先生','周女士','王先生','张女士','刘先生','赵女士','吴先生'][Math.floor(random()*8)];
    return{job:{id:'wuhan-'+(++sequence),passenger,pickup,drop,trip},path:approach};
   }
  }
  return null;
 }
 function nearestStop(from){return stops.filter(validStop).reduce((best,s)=>!best||near(s,from)<near(best,from)?s:best,null);}
 return{offer,nearestStop};
}
