import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {projectWgs84,SurfaceProvider} from '../js/core.js';

test('whole-city expansion preserves B region arrivals at all newly selected neighbourhoods and preserves the old waterfront',()=>{
 const data=JSON.parse(fs.readFileSync('public/data/city.json'));
 const places=[[121.44073,31.22541],[121.448056,31.226667],[121.470561,31.230281],[121.46413,31.21023],[121.533,31.234],[121.50,31.211],[121.501246,31.235505]];
 for(const [lon,lat]of places){const p=projectWgs84(lon,lat);assert.ok(p.x>=data.bounds[0]&&p.x<=data.bounds[2]&&p.z>=data.bounds[1]&&p.z<=data.bounds[3],'destination outside playable B region: '+lon+','+lat);}
 const area=(data.bounds[2]-data.bounds[0])*(data.bounds[3]-data.bounds[1])/1e6;assert.ok(area>5000);assert.ok(data.centralRegion.areaKm2>68&&data.centralRegion.areaKm2<70);
 for(const id of ['pearl','tower','swfc','jinmao','conference','customs','hsbc','peace','jingan','museum','exhibition','tianzifang'])assert.ok(data.landmarks.some(l=>l.id===id),'missing landmark '+id);
 for(const name of ['南京西路','淮海中路','源深路','泰康路'])assert.ok(data.roads.some(r=>r.name===name),'missing selected street '+name);
});

test('nearest road query stays local as a city grows and still finds distant filtered streets',()=>{
 const roads=[{id:'local',width:10,points:[[0,2,0],[0,2,100]]},...Array.from({length:12000},(_,i)=>({id:'far-'+i,width:10,points:[[3000+(i%120)*40,2,3000+Math.floor(i/120)*40],[3010+(i%120)*40,2,3010+Math.floor(i/120)*40]]}))];
 const s=new SurfaceProvider(roads);let examined=0;const p=s.nearest(2,50,r=>{examined++;return true;});assert.equal(p.road.id,'local');assert.equal(p.distance,2);assert.ok(examined<40,'nearest scanned '+examined+' distant roads');
 const q=s.nearest(2,50,r=>r.id==='far-0');assert.equal(q.road.id,'far-0');assert.equal(q.x,3000);assert.equal(q.z,3000);
 assert.equal(s.nearest(-1000,-1000,r=>r.id==='missing'),null);
});

test('indexed surface lookup keeps elevation and excludes remote road work',()=>{
 let widthsRead=0;const roads=[{id:'ground',width:8,points:[[0,2,0],[0,2,100]]},{id:'tunnel',width:10,tunnel:true,points:[[0,-26,0],[0,-26,100]]},...Array.from({length:6000},(_,i)=>({id:'remote-'+i,get width(){widthsRead++;return 8;},points:[[4000+i,2,0],[4000+i,2,100]]}))];
 const s=new SurfaceProvider(roads);widthsRead=0;
 assert.equal(s.sample({x:1,z:50,y:-26,mode:'car',surfaceId:'tunnel'}).height,-26);
 assert.equal(s.sample({x:1,z:50,y:2,mode:'car',surfaceId:'ground'}).height,2);
 assert.ok(widthsRead<40,'surface sampling inspected '+widthsRead+' remote widths');
});
