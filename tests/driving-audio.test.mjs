import test from 'node:test';
import assert from 'node:assert/strict';
import {dryRoadNoise,motionWindExposure} from '../js/runtime/driving-audio.js';
test('dry tires are silent at rest and creeping, then increase smoothly with speed',()=>{
 assert.equal(dryRoadNoise(0).gain,0);assert.equal(dryRoadNoise(1.5).gain,0);
 let last=0;for(let speed=2;speed<=50;speed+=.25){const n=dryRoadNoise(speed);assert.ok(n.gain>=last);assert.ok(n.gain<.08);last=n.gain;}
});
test('dry road noise is subdued and lower in frequency; releasing throttle cannot double the hiss',()=>{
 for(const speed of [5,10,20,28,40]){const a=dryRoadNoise(speed,1),b=dryRoadNoise(speed,0);assert.ok(b.gain/a.gain<1.15);assert.ok(b.cutoff<=1650);const old=Math.pow(Math.min(1.35,speed/28),1.25)*.36;assert.ok(b.gain<old*.2);}
 assert.ok(dryRoadNoise(20,0,{bus:true}).gain>dryRoadNoise(20).gain);
 assert.equal(dryRoadNoise(-20).gain,dryRoadNoise(20).gain);
});
test('closed-car motion wind is reduced without changing walking, scooter or helicopter wind',()=>{
 assert.equal(motionWindExposure('car'),.18);for(const mode of ['person','scooter','helicopter'])assert.equal(motionWindExposure(mode),1);
 for(const value of [NaN,Infinity,undefined]){const r=dryRoadNoise(value);assert.equal(r.gain,0);assert.ok(Number.isFinite(r.cutoff));}
});
