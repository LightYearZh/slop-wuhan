import test from 'node:test';
import assert from 'node:assert/strict';
import {TaxiRoadRouter,projectPath} from '../js/runtime/taxi-routing.js';
import {TaxiTrip,taxiFare} from '../js/runtime/taxi-trip.js';
import {createTaxiNetwork} from '../js/runtime/taxi-network.js';
const edge=(a,b,x1,z1,x2,z2,oneway=1)=>({a,b,oneway,len:Math.hypot(x2-x1,z2-z1),pts:new Float32Array([x1,0,z1,x2,0,z2]),cum:new Float32Array([0,Math.hypot(x2-x1,z2-z1)]),name:'路'});
test('routing obeys one-way topology and never draws a shortcut across disconnected roads',()=>{
 const nodes=[{x:0,z:0},{x:0,z:100},{x:10,z:0},{x:10,z:100}];const l=edge(0,1,0,0,0,100),other=edge(2,3,10,0,10,100);const r=new TaxiRoadRouter(nodes,[l,other]);
 assert.equal(r.route({...r.snap({x:0,z:20}),s:20},{...r.snap({x:0,z:80}),s:80}).length,60);
 assert.equal(r.route({x:0,z:80},{x:0,z:20}),null);
 assert.equal(r.route({x:0,z:20},{x:10,z:80}),null);
 assert.equal(r.snap({x:0,y:15,z:20}),null);
});
test('route follows bends and returns length along the street rather than direct distance',()=>{
 const nodes=[{x:0,z:0},{x:0,z:100},{x:100,z:100}],r=new TaxiRoadRouter(nodes,[edge(0,1,0,0,0,100),edge(1,2,0,100,100,100)]);
 const route=r.route({x:0,z:20},{x:80,z:100});assert.equal(route.length,160);assert.ok(route.points.some(p=>p.x===0&&p.z===100));
 assert.equal(projectPath(route.points,{x:0,y:0,z:70}).remaining,110);
});
const job={pickup:{x:0,y:0,z:0},drop:{x:0,y:0,z:100},trip:{points:[{x:0,y:0,z:0},{x:0,y:0,z:100}],length:100}};
const entity={position:{x:0,y:0,z:0},speed:0};
function start(){const t=new TaxiTrip();t.offer(job,{points:[],length:0});t.accept();return t;}
function wait(t,e=entity,n=45){for(let i=0;i<n;i++)t.update(.1,e);}
test('a complete trip requires held stops and boarding, bills only driven metres, and pays once',()=>{
 const t=start();wait(t);assert.equal(t.phase,'ride');
 for(let z=1;z<=100;z++)t.update(.1,{position:{x:0,y:0,z},speed:10});
 assert.equal(t.phase,'ride');assert.equal(t.distance,100);wait(t,{position:{x:0,y:0,z:100},speed:0});assert.equal(t.phase,'complete');
 assert.equal(t.result.fare,taxiFare(100,t.result.seconds));const income=t.earned;wait(t);assert.equal(t.earned,income);assert.equal(t.completed,1);
});
test('fast pass-bys, different road levels, and moving off during boarding cannot collect a passenger',()=>{
 for(const e of [{position:{x:0,y:0,z:0},speed:4},{position:{x:0,y:-20,z:0},speed:0}]){const t=start();wait(t,e);assert.equal(t.phase,'pickup');}
 const t=start();wait(t,entity,20);assert.equal(t.phase,'boarding');t.update(.1,{...entity,speed:2});assert.equal(t.phase,'pickup');
});
test('teleport and switching transport cancel active trips without payment; pausing cannot board',()=>{
 const t=start();wait(t);t.update(.1,{position:{x:0,y:0,z:100},speed:0});assert.equal(t.phase,'idle');assert.equal(t.earned,0);
 const mode=start();mode.update(.1,entity,{mode:'helicopter'});assert.equal(mode.phase,'idle');
 const paused=start();for(let i=0;i<100;i++)paused.update(.1,entity,{paused:true});assert.equal(paused.phase,'pickup');assert.equal(paused.hold,0);
});
test('three named Wuhan orders are all routed on connected ground-level motor roads with legal one-way edges',()=>{
 const {jobs}=createTaxiNetwork();assert.equal(jobs.length,3);
 for(const j of jobs){assert.ok(j.trip.length>700&&j.trip.length<1500);for(const e of j.trip.edges){assert.ok(e.end>=e.start?e.link.oneway>=0:e.link.oneway<=0);assert.ok(Array.from(e.link.pts).every(Number.isFinite));}assert.ok(j.pickup.curb&&j.drop.curb);assert.equal(j.pickup.y,0);}
});
