import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {decodeGeodata,unpackGeodata} from '../js/runtime/geodata-codec.js';
import {yieldLoadingStage} from '../js/runtime/startup-yield.js';

const fixture={city:'武汉',negative:-42,small:.001,fraction:Math.PI,large:2**40,empty:[],bool:[true,false,null],
 rings:[[[0,0],[12.34,0],[12.34,16.789],[0,0]],[[2,2],[2,3],[3,3],[2,2]]],
 integers:[-2147483648,2147483647,0,1,-1],precise:[.000000123,-3.141592653589793],nested:{same:'武汉',heightSource:'model-estimate'}};
function encode(value,json=JSON.stringify(value)){return new Uint8Array(execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'tools');from runtime_package import encode_runtime;sys.stdout.buffer.write(encode_runtime(json.load(sys.stdin)))"],{input:json}));}

test('WUH1 roundtrip retains exact numeric precision, unicode, courtyard rings and source labels',()=>{
 assert.deepEqual(decodeGeodata(encode(fixture)),fixture);
 assert.deepEqual(encode(fixture),encode(fixture),'package encoding is deterministic');
 const zero=decodeGeodata(encode(null,'{"value":-0.0}'));assert.ok(Object.is(zero.value,-0));
});

test('gzip loads on static hosts and when the host has already inflated the response',async()=>{
 const bytes=encode(fixture),compressed=new Uint8Array(gzipSync(bytes));
 assert.deepEqual(await unpackGeodata(compressed,{decodedBytes:bytes.length}),fixture);
 assert.deepEqual(await unpackGeodata(bytes,{decodedBytes:bytes.length}),fixture);
 await assert.rejects(unpackGeodata(bytes,{decodedBytes:bytes.length+1}),/长度/);
 await assert.rejects(unpackGeodata(compressed.slice(0,-5)),/./);
});

test('malformed, truncated and extra bytes fail instead of producing a partial city',()=>{
 const bytes=encode(fixture);
 assert.throws(()=>decodeGeodata(bytes.slice(0,-1)),/格式|完整/);
 assert.throws(()=>decodeGeodata(new Uint8Array([...bytes,0])),/格式/);
 const wrong=bytes.slice();wrong[0]=0;assert.throws(()=>decodeGeodata(wrong),/格式/);
 assert.throws(()=>decodeGeodata(new Uint8Array([87,85,72,49,255,255,255,255,255])),/格式/);
});

test('committed package matches its audit checksum and excludes the former huge JS literal',()=>{
 const bytes=readFileSync('js/runtime/wuhan-geodata.bin.gz'),audit=JSON.parse(readFileSync('public/data/runtime-audit.json')).runtimePackage;
 assert.equal(bytes.length,audit.gzipBytes);assert.equal(gunzipSync(bytes).length,audit.rawBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),audit.sha256);
 const module=readFileSync('js/runtime/wuhan-geodata.js','utf8');assert.ok(module.length<600);assert.match(module,/loadGeodata/);
 assert.ok(bytes.length<5_000_000,'runtime map download regressed above 5 MB');
});

test('background tabs do not block boot and foreground stages have a bounded paint wait',async()=>{
 let called=false;await yieldLoadingStage({hidden:true,requestFrame(){called=true;}});assert.equal(called,false);
 let fallback,cleared=false;
 const promise=yieldLoadingStage({hidden:false,requestFrame(){},schedule(fn,ms){assert.equal(ms,100);fallback=fn;return 7;},cancel(){cleared=true;}});
 fallback();await promise;assert.equal(cleared,false);
 let frame,finished=false;const timers=[];
 const painted=yieldLoadingStage({hidden:false,requestFrame(fn){frame=fn;},schedule(fn,ms){timers.push([fn,ms]);return 1;},cancel(){cleared=true;}}).then(()=>finished=true);
 frame();assert.equal(cleared,true);assert.equal(timers[1][1],0);timers[1][0]();await painted;assert.equal(finished,true);
});
