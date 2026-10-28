import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialPlacement} from '../js/spatial-placement.js';
const base={bounds:[-100,-100,100,100],land:[],water:[],buildings:[],landmarks:[],roads:[]};
const road=(id,a,b,width=8,mode='car')=>({id,points:[[a[0],2.12,a[1]],[b[0],2.12,b[1]]],width,mode});
test('a lamp beside its owner road still rejects the intersecting road at a junction',()=>{
 const placement=new SpatialPlacement({...base,roads:[road('east-west',[-50,0],[50,0]),road('north-south',[0,-50],[0,50],6)]});
 assert.equal(placement.check(0,6,.55),'carriageway');
 assert.equal(placement.reserve('lamp',0,6,.55),false);
 assert.equal(placement.reserve('lamp',15,6,.55),true);
 assert.equal(placement.audit().remainingConflicts,0);
});
test('complete prop footprint avoids buildings, water, boundaries and nearby props',()=>{
 const rings=[[[10,10],[20,10],[20,20],[10,20],[10,10]]];
 const p=new SpatialPlacement({...base,buildings:[{rings}],water:[[[[-20,10],[-10,10],[-10,20],[-20,20],[-20,10]]]]});
 assert.equal(p.check(9,15,1.5),'building');assert.equal(p.check(-9,15,1.5),'water');
 assert.equal(p.check(99,0,2),'boundary');assert.ok(p.reserve('bench',0,0,1.2));
 assert.equal(p.reserve('lamp',1,0,.55),false);assert.equal(p.audit().remainingConflicts,0);
});
test('broad pedestrian streets retain a clear middle corridor while allowing edge furniture',()=>{
 const p=new SpatialPlacement({...base,roads:[road('walk',[-50,0],[50,0],16,'person')]});
 assert.equal(p.reserve('tree',0,0,1.7),false);assert.equal(p.reserve('bench',0,8,1.1),true);
});
