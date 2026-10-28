import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three/webgpu';
test('unloading an instanced tile releases its instance buffers and geometry but preserves shared materials',async()=>{
 const {disposeTileGeometry}=await import('../js/resources.js').catch(()=>({}));assert.equal(typeof disposeTileGeometry,'function');
 const group=new THREE.Group(),geo=new THREE.BoxGeometry(),mat=new THREE.MeshStandardNodeMaterial(),mesh=new THREE.InstancedMesh(geo,mat,4);group.add(mesh);
 let geometry=0,instance=0,material=0;geo.addEventListener('dispose',()=>geometry++);mesh.addEventListener('dispose',()=>instance++);mat.addEventListener('dispose',()=>material++);
 disposeTileGeometry(group);assert.equal(geometry,1);assert.equal(instance,1);assert.equal(material,0);
});
test('unloading a regular tile mesh notifies WebGPU render objects before disposing geometry',async()=>{
 const {disposeTileGeometry}=await import('../js/resources.js');
 const group=new THREE.Group(),geometry=new THREE.PlaneGeometry(),material=new THREE.MeshStandardNodeMaterial(),mesh=new THREE.Mesh(geometry,material);group.add(mesh);
 const events=[];mesh.addEventListener('dispose',()=>events.push('object'));geometry.addEventListener('dispose',()=>events.push('geometry'));material.addEventListener('dispose',()=>events.push('material'));
 disposeTileGeometry(group);assert.deepEqual(events,['object','geometry']);
});
