import {createFootprintMeshes,footprintCollider} from './footprint-buildings.js';
import {buildWuhanLandmarks} from './wuhan-landmarks.js';
import {buildWuhanStreetscape} from './wuhan-streetscape.js';
import {buildStrip as strip} from './road-geometry.js';
import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createFacadeBoxes,createCurtainWallMaterial,createPreWarBuildingMaterial,createRoadSurfaceMaterial,createSidewalkMaterial,createWaterMaterial,cityUniforms} from './tsl-materials.js';
import {createTreeField} from './trees.js';
import {BODY_SPECS,buildCarGeometry,buildSteerableWheelGeo,createLoftedCarMaterial} from './actor-models.js';
import {PersonCrowd,PersonRig} from './pedestrians.js';
import {pointInPolygon,closestOnSegment,CollisionWorld,SurfaceProvider} from './core.js';
import {disposeTileGeometry} from './resources.js';
import {nearbySites} from './nearby-sites.js';
import {buildTileStreets} from './tile-streets.js';
import {createMetroSystem} from './metro-scene.js';

function shapeGeo(rings){
 const ring=rings[0];const s=new THREE.Shape(ring.map(p=>new THREE.Vector2(p[0],-p[1])));
 for(const hole of rings.slice(1))s.holes.push(new THREE.Path(hole.map(p=>new THREE.Vector2(p[0],-p[1]))));
 const g=new THREE.ShapeGeometry(s);g.rotateX(-Math.PI/2);return g;
}
function flat(scene,polys,y,material,name){
 const geos=polys.map(shapeGeo);if(!geos.length)return null;
 const g=mergeGeometries(geos);for(const q of geos)q.dispose();
 const m=new THREE.Mesh(g,material);m.position.y=y;m.receiveShadow=true;m.name=name;scene.add(m);return m;
}

function random(seed){let x=seed|0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}

export async function createCityScene(scene,data,collisionWorld,surfaceProvider=null,onProgress=async()=>{}){
 const streamed=data.schemaVersion>=3;
 const roadMat=createRoadSurfaceMaterial(),sidewalk=createSidewalkMaterial();
 if(data.outside)flat(scene,data.outside,1.99,new THREE.MeshStandardNodeMaterial({color:0x727c6e,roughness:1}),'Outside Shanghai boundary');
 flat(scene,data.land,2,new THREE.MeshStandardNodeMaterial({color:0xa39c86,roughness:.9}),'Shanghai land');
 flat(scene,data.parks,2.06,new THREE.MeshStandardNodeMaterial({color:0x536447,roughness:.95}),'Parks');
 flat(scene,data.shoulders,2.08,sidewalk,'Pavements');
 flat(scene,data.pedestrian||[],2.125,new THREE.MeshStandardNodeMaterial({color:0xb7ad99,roughness:.95}),'Pedestrian streets');
 const waterMat=createWaterMaterial();flat(scene,data.water,0,waterMat,'Huangpu and Suzhou water');
 flat(scene,data.asphalt,2.12,roadMat,'Shanghai roads');
 const lineGeo=[],rng=random(74821),treeSites=[],lampSites=[],pedSites=[];
 const plantingWorld=new CollisionWorld(),waterSurface=new SurfaceProvider([],data.water);
 plantingWorld.addTile('buildings',data.buildings.map(b=>({minX:b.x-b.w*.6,maxX:b.x+b.w*.6,minZ:b.z-b.d*.6,maxZ:b.z+b.d*.6,minY:0,maxY:1})));
 const noBuild=(x,z)=>!data.landmarks.some(l=>pointInPolygon(x,z,l.footprint))&&!waterSurface.isWater(x,z)&&!plantingWorld.query({minX:x,maxX:x,minZ:z,maxZ:z,minY:0,maxY:1}).length;
 for(const road of streamed?[]:data.roads){
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],len=Math.hypot(b[0]-a[0],b[2]-a[2]);if(len<12)continue;
   const dx=(b[0]-a[0])/len,dz=(b[2]-a[2])/len,nx=-dz,nz=dx;
   if(road.mode==='car'&&road.width>=5)for(let d=6;d<len-3;d+=14){const p=[a[0]+dx*d,2.14,a[2]+dz*d],q=[a[0]+dx*Math.min(d+5,len-2),2.14,a[2]+dz*Math.min(d+5,len-2)];if(data.rampCuts?.some(r=>pointInPolygon((p[0]+q[0])/2,(p[2]+q[2])/2,r)))continue;lineGeo.push(strip([p,q],.14));}
   if(road.width>10)for(let d=16;d<len;d+=42){
    const side=rng()<.5?-1:1,x=a[0]+dx*d+nx*(road.width/2+2.3)*side,z=a[2]+dz*d+nz*(road.width/2+2.3)*side;
    if(noBuild(x,z)){const site={x,z,angle:Math.atan2(dx,dz)};lampSites.push(site);pedSites.push(site);if(rng()<.8)treeSites.push({x:x+nx*3,z:z+nz*3,y:2,scale:.7+rng()*.5,species:0,yaw:rng()*Math.PI*2});rng();}
   }
  }
 }
 if(lineGeo.length){const m=new THREE.Mesh(mergeGeometries(lineGeo),new THREE.MeshStandardNodeMaterial({color:0xdad7b9,roughness:.8}));m.name='Lane markings';scene.add(m);for(const g of lineGeo)g.dispose();}
 await onProgress(1,'地面、水系与道路已构建');
 const tunnelLamps=new THREE.MeshBasicNodeMaterial({color:0xffe9b9});
 const panel=document.createElement('canvas');panel.width=256;panel.height=256;const pc=panel.getContext('2d');pc.fillStyle='#a8b0ad';pc.fillRect(0,0,256,256);pc.strokeStyle='#737d7c';pc.lineWidth=3;for(let y=0;y<=256;y+=64){pc.beginPath();pc.moveTo(0,y);pc.lineTo(256,y);pc.stroke();for(let x=(y%128?0:64);x<256;x+=128){pc.beginPath();pc.moveTo(x,y);pc.lineTo(x,y+64);pc.stroke();}}pc.fillStyle='#477c82';pc.fillRect(0,180,256,16);
 const panelMap=new THREE.CanvasTexture(panel);panelMap.colorSpace=THREE.SRGBColorSpace;panelMap.wrapS=panelMap.wrapT=THREE.RepeatWrapping;
 const tunnelMat=new THREE.MeshStandardNodeMaterial({map:panelMap,color:0xc5c7bc,roughness:.82,side:THREE.DoubleSide});
 const ceilingMat=new THREE.MeshStandardNodeMaterial({color:0x656e6d,roughness:.9,side:THREE.DoubleSide});
 const paintMat=new THREE.MeshStandardNodeMaterial({color:0xd5d0b3,roughness:.82});
 for(const t of data.tunnels){
  const g=new THREE.Group();g.name=t.id;scene.add(g);
  const m=new THREE.Mesh(strip(t.points,t.width),roadMat);m.receiveShadow=true;g.add(m);
  const wall=[],roof=[],paint=[];let distance=0;
  for(let i=1;i<t.points.length;i++){
   const a=t.points[i-1],b=t.points[i],len=Math.hypot(b[0]-a[0],b[2]-a[2]),nx=-(b[2]-a[2])/(len||1),nz=(b[0]-a[0])/(len||1);
   for(const side of [-1,1]){
    const ax=a[0]+nx*side*t.width/2,az=a[2]+nz*side*t.width/2,bx=b[0]+nx*side*t.width/2,bz=b[2]+nz*side*t.width/2;
    const verts=[ax,a[1],az,bx,b[1],bz,ax,a[1]+5.8,az,bx,b[1]+5.8,bz];const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([distance/4,0,(distance+len)/4,0,distance/4,1.45,(distance+len)/4,1.45],2));geo.setIndex([0,1,2,2,1,3]);geo.computeVertexNormals();wall.push(geo);
   }
   const elevated=[a,b].map(p=>[p[0],p[1]+.025,p[2]]);
   for(const side of [-1,1])paint.push(strip(elevated,.12,side*(t.width/2-.55)));
   if(i%2===0)paint.push(strip(elevated,.12));distance+=len;
   if(Math.max(a[1],b[1])< -3)roof.push(strip([a.map((v,j)=>j===1?v+5.8:v),b.map((v,j)=>j===1?v+5.8:v)],t.width+.4));
   if(i%4===0&&b[1]<-2){const l=new THREE.Mesh(new THREE.BoxGeometry(2.5,.06,.28),tunnelLamps);l.position.set(b[0],b[1]+5.25,b[2]);l.rotation.y=Math.atan2(b[0]-a[0],b[2]-a[2])+Math.PI/2;g.add(l);}
  }
  g.add(new THREE.Mesh(mergeGeometries(wall),tunnelMat));if(roof.length)g.add(new THREE.Mesh(mergeGeometries(roof),ceilingMat));g.add(new THREE.Mesh(mergeGeometries(paint),paintMat));
  for(const geo of [...wall,...roof,...paint])geo.dispose();
  // Portal signs at both banks. Inner lighting is completed by the player's headlights.
  for(const p of [t.points[0],t.points.at(-1)]){const sign=makeSign('未开放隧道  →',0x155658);sign.position.set(p[0],7.6,p[2]);g.add(sign);}
 }
 await onProgress(2,'跨江隧道已构建');
 const landmarkSystem=buildWuhanLandmarks(scene,data.landmarks);buildWuhanStreetscape(scene,data,noBuild);await onProgress(3,'江汉关与江汉路街景已构建');
 const styles=[
  createCurtainWallMaterial({glassTint:0x24445b,frameTint:0x53616b,boxLocal:false,seed:2}),
  createPreWarBuildingMaterial({stoneColor:0xb8b6ab,trimColor:0x807d72,windowWidth:2.1,floorHeight:3.1,boxLocal:false,seed:8}),
  createPreWarBuildingMaterial({stoneColor:0xc1ae89,trimColor:0x86775f,windowWidth:2.5,floorHeight:3.8,boxLocal:false,seed:10}),
  createPreWarBuildingMaterial({stoneColor:0x9f8170,trimColor:0xd0baa1,windowWidth:1.9,floorHeight:3.3,boxLocal:false,seed:14}),
  createCurtainWallMaterial({glassTint:0x354d54,frameTint:0x8a8c87,windowWidth:2.3,floorHeight:3.4,boxLocal:false,seed:19})
 ];
 const footprintRoof=new THREE.MeshStandardNodeMaterial({color:0x777b79,roughness:.88});
 const overview=new Map(),loaded=new Map();
 const overviewSize=streamed?1000:500,grouped=new Map();for(const b of data.buildings){const key=Math.floor(b.x/overviewSize)+'_'+Math.floor(b.z/overviewSize);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(b);}
 const distantMat=createCurtainWallMaterial({glassTint:0x51636c,frameTint:0x66747a,windowWidth:2.6,boxLocal:false,seed:22});
 let overviewMesh=null;const overviewMatrices=new Map();
 if(streamed&&data.buildings.length){
  overviewMesh=createFacadeBoxes(distantMat,data.buildings.map(b=>({...b,y:2+b.h/2})));overviewMesh.castShadow=false;overviewMesh.frustumCulled=false;scene.add(overviewMesh);
  data.buildings.forEach((b,i)=>{const id=Math.floor(b.x/overviewSize)+'_'+Math.floor(b.z/overviewSize);if(!overview.has(id))overview.set(id,[]);overview.get(id).push(i);const m=new THREE.Matrix4();overviewMesh.getMatrixAt(i,m);overviewMatrices.set(i,m);});
 }else for(const [id,bs]of grouped){const mesh=createFootprintMeshes(bs,distantMat,footprintRoof);scene.add(mesh);overview.set(id,mesh);}
 function showOverview(id,show){const entry=overview.get(id);if(!entry)return;if(!streamed){entry.visible=show;return;}for(const i of entry)overviewMesh.setMatrixAt(i,show?overviewMatrices.get(i):new THREE.Matrix4().makeScale(0,0,0));overviewMesh.instanceMatrix.needsUpdate=true;}
 await onProgress(4,'城市远景楼群已构建');
 const streetMaterials={road:roadMat,paint:new THREE.MeshStandardNodeMaterial({color:0xdad7b9,roughness:.8}),rail:new THREE.MeshStandardNodeMaterial({color:0xadb9b3,roughness:.7}),pole:new THREE.MeshStandardNodeMaterial({color:0x364640,roughness:.6}),bulb:new THREE.MeshStandardNodeMaterial({color:0xd4d5bd,emissive:0xffc66d,emissiveIntensity:.1}),poleGeo:new THREE.CylinderGeometry(.09,.14,7,6),bulbGeo:new THREE.SphereGeometry(.28,6,4),land:new THREE.MeshStandardNodeMaterial({color:0xa39c86,roughness:.9}),park:new THREE.MeshStandardNodeMaterial({color:0x536447,roughness:.95}),farm:new THREE.MeshStandardNodeMaterial({color:0x8a9460,roughness:1})};
 const streetTiles=new Map();let streetRevision=0;
 const metroSystem=createMetroSystem(data.metroStations||[]);
 function mountTile(tile,meta){
  const group=new THREE.Group();group.name='tile:'+meta.id;const colliders=[];
  if(streamed){
   flat(group,tile.land,2.015,streetMaterials.land,'Tile land');if(tile.farmland)flat(group,tile.farmland,2.035,streetMaterials.farm,'Farmland');flat(group,tile.water,.012,waterMat,'Tile water');flat(group,tile.parks,2.06,streetMaterials.park,'Tile parks');flat(group,tile.shoulders,2.08,sidewalk,'Tile pavements');
   streetTiles.set(meta.id,{...buildTileStreets(group,tile,streetMaterials),roads:tile.roads,water:tile.water});streetRevision++;surfaceProvider?.setTileWater(meta,tile.water);
  }
  for(let i=0;i<styles.length;i++){
   const bs=tile.buildings.filter(b=>b.style===i).map(b=>({...b,y:2+b.h/2}));if(!bs.length)continue;
   const mesh=createFootprintMeshes(bs,styles[i],footprintRoof);group.add(mesh);
  }
  for(const b of tile.buildings)colliders.push(footprintCollider(b));
  const metro=metroSystem.mountTile(group,meta.id);colliders.push(...metro.colliders);if(streamed)surfaceProvider?.setTileRoads(meta,[...tile.roads,...metro.floorRoads]);
  scene.add(group);showOverview(meta.id,false);loaded.set(meta.id,group);collisionWorld.addTile(meta.id,colliders);
  return {dispose(){scene.remove(group);disposeTileGeometry(group);metro.dispose();showOverview(meta.id,true);loaded.delete(meta.id);collisionWorld.removeTile(meta.id);streetTiles.get(meta.id)?.dispose?.();streetTiles.delete(meta.id);surfaceProvider?.removeTileWater(meta.id);surfaceProvider?.removeTileRoads(meta.id);streetRevision++;}};
 }
 // Landmark collision volumes remain present even when neighbouring detail tiles are unloaded.
 collisionWorld.addTile('landmarks',data.landmarks.map(l=>footprintCollider({id:l.id,rings:l.footprint,h:l.height})));
 await onProgress(5,'地铁入口与分层碰撞已准备');
 const trees=createTreeField(scene,treeSites.filter(p=>p.x>data.bounds[0]&&p.x<data.bounds[2]&&p.z>data.bounds[1]&&p.z<data.bounds[3]),streamed?{capacity:640}:{});
 const poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.14,7,8),new THREE.MeshStandardNodeMaterial({color:0x364640,roughness:.6}),lampSites.length);
 const bulbsMat=new THREE.MeshStandardNodeMaterial({color:0xd4d5bd,emissive:0xffc66d,emissiveIntensity:.1});
 const bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(.28,8,6),bulbsMat,lampSites.length),matrix=new THREE.Matrix4();
 lampSites.forEach((p,i)=>{poles.setMatrixAt(i,matrix.makeTranslation(p.x,5.5,p.z));bulbs.setMatrixAt(i,matrix.makeTranslation(p.x,9.1,p.z));});scene.add(poles,bulbs);
 const signCells=new Set();for(const r of (streamed?[]:data.roads).filter(r=>r.name&&r.points.length>2)){const p=r.points[1],key=Math.floor(p[0]/1000)+':'+Math.floor(p[2]/1000);if(signCells.has(key))continue;signCells.add(key);const sign=makeSign(r.name,0x245344);sign.position.set(p[0]+r.width/2+1,5,p[2]);scene.add(sign);}
 const crowd=new PersonCrowd(streamed?80:Math.min(80,pedSites.length));scene.add(...crowd.meshes);
 const walkers=Array.from({length:streamed?80:Math.min(80,pedSites.length)},(_,i)=>({site:null,rig:new PersonRig({seed:i*17+1})}));let crowdOrigin=null,treeOrigin=null,seenStreetRevision=-1;
 function update(time,camera){
  const radius=Math.min(6000,3500+Math.max(0,camera.position.y)*3);
  if(!streamed)for(const [id,mesh] of overview){const [ix,iz]=id.split('_').map(Number),dx=Math.max(ix*500-camera.position.x,0,camera.position.x-(ix+1)*500),dz=Math.max(iz*500-camera.position.z,0,camera.position.z-(iz+1)*500);mesh.visible=!loaded.has(id)&&dx*dx+dz*dz<radius*radius;}
  if(streamed&&(!treeOrigin||streetRevision!==seenStreetRevision||Math.hypot(camera.position.x-treeOrigin.x,camera.position.z-treeOrigin.z)>90)){
   const allTrees=[...streetTiles.values()].flatMap(t=>t.treeSites);trees.setSites(nearbySites(allTrees,camera.position,640,1100));treeOrigin={x:camera.position.x,z:camera.position.z};seenStreetRevision=streetRevision;
   pedSites.length=0;for(const t of streetTiles.values())pedSites.push(...t.pedSites);crowdOrigin=null;
  }
  const night=Math.max(0,Math.min(1,(cityUniforms.uInteriorGlow.value-.7)/1.3));bulbsMat.emissiveIntensity=.1+night*4;streetMaterials.bulb.emissiveIntensity=.1+night*4;landmarkSystem.update(night);trees.update(camera.position);
  if(!crowdOrigin||Math.hypot(camera.position.x-crowdOrigin.x,camera.position.z-crowdOrigin.z)>70){
   const occupied=new Set(walkers.filter(p=>p.site&&Math.hypot(p.site.x-camera.position.x,p.site.z-camera.position.z)<320).map(p=>p.site));
   const available=nearbySites(pedSites,camera.position,80,440,crowdOrigin?220:0,occupied);let index=0;
   for(const p of walkers)if(!p.site||Math.hypot(p.site.x-camera.position.x,p.site.z-camera.position.z)>320)p.site=available[index++]||null;
   crowdOrigin={x:camera.position.x,z:camera.position.z};
  }
  crowd.begin();walkers.forEach((p,i)=>{if(!p.site)return;const distance=Math.hypot(p.site.x-camera.position.x,p.site.z-camera.position.z);if(distance>240)return;const d=Math.sin(time*.3+i)*4;const x=p.site.x+Math.sin(p.site.angle)*d,z=p.site.z+Math.cos(p.site.angle)*d;p.rig.update(1/60,x,z,p.site.angle,()=>2,null);crowd.add(p.rig,distance);});crowd.end();
 }
 await onProgress(6,'绿化与行人已准备');
 return {mountTile,loaded,overview,update,landmarkSystem,trees,walkers,streetTiles,metroSystem,get streetRevision(){return streetRevision;}};
}

function makeSign(text,bg){
 const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#'+bg.toString(16).padStart(6,'0');ctx.fillRect(0,0,512,96);ctx.strokeStyle='#d9e4d5';ctx.lineWidth=4;ctx.strokeRect(5,5,502,86);ctx.fillStyle='#fff';ctx.font='bold 42px system-ui';ctx.textAlign='center';ctx.fillText(text,256,63);
 return new THREE.Mesh(new THREE.PlaneGeometry(5.3,1),new THREE.MeshBasicNodeMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide}));
}
