import test from 'node:test';
import assert from 'node:assert/strict';
import {pavingCoordinates} from '../js/runtime/paving-coordinates.js';

test('stone centre strip follows real street bends and retains metre distances',()=>{
  const paths=[[[0,0],[0,20],[20,20]]];
  assert.deepEqual(pavingCoordinates(0,10,paths),[0,10]);
  assert.deepEqual(pavingCoordinates(-3,10,paths),[3,10]);
  assert.deepEqual(pavingCoordinates(10,20,paths),[0,30]);
  assert.deepEqual(pavingCoordinates(10,23,paths),[3,30]);
});

test('Jianghan bluestone constructs its colour, roughness and normal graph',async()=>{
  const {createHeritagePavingMaterial}=await import('../js/runtime/tsl-materials.js');
  const m=createHeritagePavingMaterial();
  assert.ok(m.colorNode);assert.ok(m.normalNode);assert.ok(m.roughnessNode);m.dispose();
});
