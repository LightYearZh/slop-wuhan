import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootprintGeometry,footprintPush} from '../js/footprint-buildings.js';
const outline=[[0,0],[12,0],[12,4],[4,4],[4,12],[0,12],[0,0]];
test('concave building geometry preserves the L shape rather than closing its missing corner',()=>{
 const geo=createFootprintGeometry({rings:[outline],h:10});const p=geo.getAttribute('position');let topArea=0;
 for(let i=0;i<p.count;i+=3){
  if([0,1,2].every(j=>Math.abs(p.getY(i+j)-12)<1e-5)){
   const ax=p.getX(i),az=p.getZ(i),bx=p.getX(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cz=p.getZ(i+2);
   topArea+=Math.abs((bx-ax)*(cz-az)-(bz-az)*(cx-ax))/2;
  }
 }
 assert.ok(Math.abs(topArea-80)<.01);assert.equal(footprintPush(9,9,.5,[outline]),null);
 assert.ok(footprintPush(2,8,.5,[outline]));geo.dispose();
});
test('a real courtyard remains open for rendering and walking',()=>{
 const outer=[[0,0],[12,0],[12,12],[0,12],[0,0]],hole=[[4,4],[4,8],[8,8],[8,4],[4,4]];
 assert.equal(footprintPush(6,6,.5,[outer,hole]),null);
 const push=footprintPush(4.2,6,.5,[outer,hole]);assert.ok(push);assert.ok(push.x>4.5);
 const geometry=createFootprintGeometry({rings:[outer,hole],h:8});assert.ok(geometry.getAttribute('position').count>0);geometry.dispose();
});
