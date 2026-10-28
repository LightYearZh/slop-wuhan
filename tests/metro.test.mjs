import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const path='public/data/metro.json';
test('every officially referenced metro station inside Shanghai has one named entrance and safe placement evidence',()=>{
 assert.ok(fs.existsSync(path),'metro station data is missing');const data=JSON.parse(fs.readFileSync(path));assert.equal(data.stations.length,410);assert.equal(new Set(data.stations.map(s=>s.stationName)).size,410);assert.deepEqual(data.outsideScope.map(s=>s.stationName).sort(),['兆丰路','光明路','花桥']);assert.deepEqual(data.missingOfficialStations,[]);
 for(const s of data.stations){assert.ok(s.sourceIds.length);assert.ok(s.lines.length);assert.ok(s.name.includes(s.stationName));assert.ok([s.x,s.z,s.entrance.x,s.entrance.z,s.entrance.heading].every(Number.isFinite));assert.ok(s.entrance.safety.checkedBuildings&&s.entrance.safety.checkedRoads&&s.entrance.safety.checkedLand);assert.ok(s.entrance.tileId);assert.ok(s.entrance.distanceFromStation<350);}
 const l=data.stations.find(s=>s.stationName==='陆家嘴');assert.deepEqual(l.lines,['2','14']);assert.ok(l.lon>121.49&&l.lon<121.51&&l.lat>31.23&&l.lat<31.25);
 assert.ok(data.stations.some(s=>s.stationName==='蟠祥路·国家会计学院'));assert.ok(data.stations.some(s=>s.stationName==='康文路'));assert.ok(!data.stations.some(s=>s.stationName.includes('在建')));
});
