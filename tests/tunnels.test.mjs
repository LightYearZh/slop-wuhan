import test from 'node:test';
import assert from 'node:assert/strict';
import {createTunnelSystem} from '../js/runtime/tunnel-surfaces.js';
import {GEO} from '../js/runtime/wuhan-geodata.js';
const system=createTunnelSystem(GEO.tunnels);
test('two full source-connected bores stay within bounds and have surface connections at both portals',()=>{
 assert.equal(GEO.tunnels.length,2);
 for(const t of GEO.tunnels){assert.equal(t.points[0][1],0);assert.equal(t.points.at(-1)[1],0);assert.ok(t.length>3000&&t.length<3600);assert.ok(t.portalConnections.every(p=>p.roads.length&&GEO.nodeSourceIds.includes(String(p.nodeId))));assert.equal(t.widths.length,t.points.length);assert.ok(t.widths.every(w=>w>=4.8&&w<=8));assert.ok(Math.min(...t.widths)<7);
  for(const [x,y,z]of t.points){assert.ok(x>=GEO.bounds.minX&&x<=GEO.bounds.maxX&&z>=GEO.bounds.minZ&&z<=GEO.bounds.maxZ);assert.ok(y<=0&&y>=-28);}
 }
});
test('surface traffic never snaps to a buried tunnel; tunnel vehicles retain signed contact in either direction',()=>{
 for(const t of GEO.tunnels){const mid=t.points[Math.floor(t.points.length/2)];assert.equal(system.sample(mid[0],mid[2],0),null);
  for(const reverse of [false,true]){const ps=reverse?t.points.slice().reverse():t.points;let y=0,id=null;
   for(let i=0;i<ps.length;i++){const p=ps[i],s=system.sample(p[0],p[2],y,id);assert.ok(s,`${t.id} station ${i}`);assert.ok(Math.abs(s.height-p[1])<.002);assert.ok(Math.abs(s.height-y)<1);y=s.height;id=s.surfaceId;}
  }
 }
});
test('vehicle corners stay inside the bore and camera stays below the roof',()=>{
 for(const t of GEO.tunnels){const p=t.points[Math.floor(t.points.length/2)],c={position:{x:p[0]+7,y:p[1],z:p[2]},heading:Math.PI/2,tunnelId:t.id,vx:5,vz:5};
  const s=system.move(c);assert.ok(s);assert.ok(system.floorAt(c.position.x,c.position.z,t.id)!==null);const n=system.provider.nearest(c.position.x,c.position.z,r=>r.id===t.id);assert.ok(n.distance<=2.5+.001);
  const camera=system.camera({x:c.position.x+20,y:10,z:c.position.z+20},c);assert.ok(camera.y<c.position.y+t.clearance);assert.ok(camera.y>c.position.y);
 }
});
test('contact equals rendered floor triangles through bends and grades',()=>{
 for(const {road,vertices:v}of system.surfaces)for(let i=0;i<v.length-2;i+=2){for(const tri of [[v[i],v[i+1],v[i+2]],[v[i+1],v[i+3],v[i+2]]]){const p=tri[0].map((n,k)=>n*.2+tri[1][k]*.3+tri[2][k]*.5);assert.ok(Math.abs(system.floorAt(p[0],p[2],road.id)-p[1])<.003);}}
});

test('runtime water barrier permits a supported underground car but still rejects a surface car on the river',async()=>{
 const {ThirdPersonControllerManager}=await import('../js/runtime/controllers.js');
 const {WATER}=await import('../js/runtime/city-config.js');
 const t=GEO.tunnels[0],p=t.points.find(p=>p[1]<-20&&WATER.contains(p[0],p[2]));assert.ok(p);
 const manager=Object.create(ThirdPersonControllerManager.prototype),car={position:{x:p[0],y:p[1],z:p[2]},tunnelId:t.id,speed:10,vx:0,vz:0};manager.entities={car};
 manager.keepOutOfWater(car,100,100);assert.equal(car.position.x,p[0]);assert.ok(manager.getGroundHeight(p[0],p[2],'car',p[1])< -20);
 car.tunnelId=null;car.position.y=0;manager.keepOutOfWater(car,100,100);assert.equal(car.position.x,100);assert.equal(car.position.z,100);
 assert.ok(manager.getGroundHeight(p[0],p[2],'car',0)>=0);
});
