async (page) => {
 await page.waitForFunction(()=>window.wuhan?.ready);
 return await page.evaluate(async()=>{
  const app=wuhan,controller=app.controllers,results=[];
  for(const name of ['沿江大道','中山大道','京汉大道']){
   const roads=app.data.placementData.roads.filter(r=>r.name===name&&!r.bridge);
   const sites=app.placement.sites.filter(p=>p.kind==='tree');
   let best=null;
   for(const road of roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],x=(a[0]+b[0])/2,z=(a[2]+b[2])/2;
    const trees=sites.filter(p=>Math.hypot(p.x-x,p.z-z)<35).length;
    if(!best||trees>best.trees)best={x,z,heading:Math.atan2(b[0]-a[0],b[2]-a[2]),trees};
   }
   if(!best?.trees)throw Error('No roadside tree probe: '+name);
   app.gotoLandmark('jianghanguan',{mode:'car'});
   controller.teleportActiveTo(best.x,best.z,best.heading,0);controller.resetInput();
   app.cameraSystem.resetForTeleport();
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const group=app.scene.getObjectByName('Trees');if(!group?.parent)throw Error('Tree visuals are detached from the scene');
   const drawn=[];
   for(const mesh of group.children)if(mesh.visible&&mesh.count){
    const e=mesh.instanceMatrix.array;
    for(let i=0;i<mesh.count;i++)drawn.push({x:e[i*16+12],z:e[i*16+14],lod:mesh.name});
   }
   const p=controller.entities.car.position;
   const nearby=app.placement.sites.filter(s=>['tree','planter-tree'].includes(s.kind)&&Math.hypot(s.x-p.x,s.z-p.z)<40);
   const missing=nearby.filter(s=>!drawn.some(v=>Math.hypot(v.x-s.x,v.z-s.z)<.02));
   if(!nearby.length||missing.length)throw Error(name+': '+missing.length+' missing of '+nearby.length+' nearby trees');
   results.push({road:name,position:{...p},nearbyTrees:nearby.length,missing:missing.length,drawnInstances:drawn.length});
  }
  return {results,errors:app.metrics().errors};
 });
}
