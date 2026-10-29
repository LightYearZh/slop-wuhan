import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAVEL_MODES,travelMode,travelAltitude} from '../js/runtime/travel-state.js';

test('ordinary destination visits preserve every travel mode; only explicit valid overrides change it',()=>{
  for(const current of TRAVEL_MODES){
    assert.equal(travelMode(current,null),current);
    assert.equal(travelMode(current,'unknown'),current);
    for(const explicit of TRAVEL_MODES)assert.equal(travelMode(current,explicit),explicit);
  }
  assert.equal(travelMode('unknown',null),'car');
});
test('flight arrivals retain controller altitude instead of being forced onto a ground entrance',()=>{
  for(const destination of [null,undefined,0,-25,80])assert.equal(travelAltitude('helicopter',destination),null);
  for(const mode of ['car','person','scooter']){
    assert.equal(travelAltitude(mode,0),0);
    assert.equal(travelAltitude(mode,-25),-25);
    assert.equal(travelAltitude(mode,undefined),null);
  }
});
