import test from 'node:test';import assert from 'node:assert/strict';import {createWaterMaterial} from '../js/tsl-materials.js';
test('Shanghai water material constructs its physical waves and light graph without unresolved TSL functions',()=>{let material;assert.doesNotThrow(()=>material=createWaterMaterial());assert.ok(material.normalNode);assert.ok(material.emissiveNode);material.dispose();});
