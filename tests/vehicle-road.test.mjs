import test from 'node:test';import assert from 'node:assert/strict';
test('tunnel wall clearance contains the entire taxi for straight and sideways headings',async()=>{
 const {vehicleLateralLimit,TAXI_FOOTPRINT}=await import('../js/vehicle-road.js').catch(()=>({}));assert.equal(typeof vehicleLateralLimit,'function');
 for(let angle=0;angle<Math.PI;angle+=.02){const limit=vehicleLateralLimit(angle,0,10,8),extent=Math.abs(Math.sin(angle))*TAXI_FOOTPRINT.halfLength+Math.abs(Math.cos(angle))*TAXI_FOOTPRINT.halfWidth;assert.ok(limit+extent<=3.89,'taxi corner crossed the wall');}
 assert.equal(vehicleLateralLimit(0,0,10,8),2.5);assert.ok(vehicleLateralLimit(Math.PI/2,0,10,8)<1.61);
});
test('a 10m bore gives the taxi one extra metre on each side without letting its corners cross a wall',async()=>{
 const {vehicleLateralLimit,TAXI_FOOTPRINT}=await import('../js/vehicle-road.js');
 assert.equal(vehicleLateralLimit(0,0,10,10),3.5);
 for(let angle=0;angle<Math.PI;angle+=.02){
  const extent=Math.abs(Math.sin(angle))*TAXI_FOOTPRINT.halfLength+Math.abs(Math.cos(angle))*TAXI_FOOTPRINT.halfWidth;
  const wide=vehicleLateralLimit(angle,0,10,10),narrow=vehicleLateralLimit(angle,0,10,8);
  assert.ok(Math.abs(wide-narrow-1)<1e-9,'widening did not expand the usable driving corridor');
  assert.ok(wide+extent<=4.89,'taxi corner crossed the widened wall');
 }
});
