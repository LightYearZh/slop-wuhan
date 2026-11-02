import test from 'node:test';
import assert from 'node:assert/strict';
import {TaxiRoadRouter,projectPath} from '../js/runtime/taxi-routing.js';
import {TaxiTrip,taxiFare} from '../js/runtime/taxi-trip.js';
import {createTaxiNetwork,taxiTunnelLinks} from '../js/runtime/taxi-network.js';
import {createTaxiDispatcher} from '../js/runtime/taxi-dispatch.js';
import {CLS,LINK_FLAG,WATER,groundHeightAt,TELEPORT_LOCATIONS,districtAt} from '../js/runtime/city-config.js';
const edge=(a,b,x1,z1,x2,z2,oneway=1)=>({a,b,oneway,w:6.5,len:Math.hypot(x2-x1,z2-z1),pts:new Float32Array([x1,0,z1,x2,0,z2]),cum:new Float32Array([0,Math.hypot(x2-x1,z2-z1)]),name:'路'});
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
const seeded=(seed=731)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
test('random dispatch accepts long reachable trips, refuses islands, and honors stop eligibility',()=>{
 const nodes=[{x:0,z:0},{x:0,z:200},{x:0,z:14200},{x:200,z:0},{x:200,z:200}];
 const links=[edge(0,1,0,0,0,200),edge(1,2,0,200,0,14200,0),edge(3,4,200,0,200,200,0)],r=new TaxiRoadRouter(nodes,links);
 const stop=(id,l,s)=>({...r.stopAt(id,l,s),id});
 const pickup=stop('near',links[0],100),drop=stop('far',links[1],13000),island=stop('island',links[2],100);
 const dispatch=createTaxiDispatcher(r,[pickup,drop,island],{rng:()=>0});
 const offer=dispatch.offer({x:0,y:0,z:20});assert.ok(offer);assert.equal(offer.job.pickup.id,'near');assert.equal(offer.job.drop.id,'far');assert.ok(offer.job.trip.length>13000);assert.ok(offer.path.length<100);
 assert.equal(createTaxiDispatcher(r,[pickup,drop,island],{rng:()=>0,validStop:s=>s.id!=='far'}).offer({x:0,y:0,z:20}),null);
 assert.equal(dispatch.offer({x:900,y:0,z:900}),null);
});
test('roadside stops put each legal direction beside its own kerb',()=>{
 const l={...edge(0,1,0,0,0,200,0),w:8},r=new TaxiRoadRouter([{x:0,z:0},{x:0,z:200}],[l]);
 const a=r.stopAt('a',l,80,1),b=r.stopAt('b',l,80,-1);
 assert.ok(a.x<0&&a.curb.x<a.x);assert.ok(b.x>0&&b.curb.x>b.x);assert.ok(Math.abs(a.heading-b.heading)===Math.PI);
 const one={...l,oneway:-1},single=new TaxiRoadRouter(r.nodes,[one]);assert.equal(single.stopAt('wrong',one,80,1),null);
});
test('tunnel routing uses source portal identities and never snaps to a nearby unrelated node',()=>{
 const nodes=[{x:0,y:0,z:0},{x:0,y:0,z:100}],t={id:'bore',name:'Tunnel',sourceNodeIds:['a','b'],points:[[0,0,0],[0,-20,50],[0,0,100]],width:10,oneway:1};
 const links=taxiTunnelLinks(nodes,['a','b'],[t]);assert.equal(links.length,1);assert.equal(links[0].oneway,1);assert.equal(links[0].pts[4],-20);
 assert.equal(taxiTunnelLinks(nodes,['a','other'],[t]).length,0);
 assert.equal(taxiTunnelLinks([{...nodes[0],x:10},nodes[1]],['a','b'],[t]).length,0);
});
test('random Wuhan offers cover all three towns with long, directed bridge and tunnel routes',()=>{
 const {dispatcher,stops,stats}=createTaxiNetwork({rng:seeded()});assert.ok(stops.length>1000);assert.equal(stats.tunnelLinks,2);
 const districts=new Set(),pairs=new Set();let longest=0,viaTunnel=0,viaBridge=0,shortest=Infinity;
 for(let i=0;i<160;i++){
  const offer=dispatcher.offer(TELEPORT_LOCATIONS.jianghanguan);assert.ok(offer);
  const {job,path}=offer;pairs.add(job.pickup.id+'>'+job.drop.id);longest=Math.max(longest,job.trip.length);shortest=Math.min(shortest,job.trip.length);
  districts.add(districtAt(job.drop.x,job.drop.z));
  for(const s of[job.pickup,job.drop]){assert.ok(s.curb);assert.ok(!(s.link.flags&(LINK_FLAG.ELEVATED|LINK_FLAG.SLIP|LINK_FLAG.NO_CARS)));assert.ok(s.link.cls>=CLS.primary&&s.link.cls<CLS.pedestrian);assert.ok(!WATER.contains(s.x,s.z)&&!WATER.contains(s.curb.x,s.curb.z));assert.ok(Math.abs(groundHeightAt(s.x,s.z)-s.y)<.001);}
  for(const route of[path,job.trip])for(const e of route.edges){assert.ok(e.end>=e.start?e.link.oneway>=0:e.link.oneway<=0);assert.ok(Array.from(e.link.pts).every(Number.isFinite));}
  if(job.trip.edges.some(e=>e.link.tunnelId))viaTunnel++;
  if(job.trip.edges.some(e=>e.link.name.includes('武汉长江大桥')))viaBridge++;
 }
 assert.ok(longest>10000);assert.ok(shortest<2000);assert.ok(pairs.size>140);assert.ok(viaTunnel>0&&viaBridge>0);for(const district of['汉口','武昌','汉阳'])assert.ok(districts.has(district));
});

test('roads rejected by scene collision validation cannot supply random passenger stops',()=>{
 const {dispatcher,stops,stats}=createTaxiNetwork({validRoad:()=>false});assert.equal(stops.length,0);assert.equal(stats.motorLinks,0);assert.equal(dispatcher.offer(TELEPORT_LOCATIONS.jianghanguan),null);
});
