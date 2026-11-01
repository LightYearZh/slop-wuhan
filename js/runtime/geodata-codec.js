// WUH1 adapts mrdoob/slop-newyork's NYB1 separate gzip asset and zigzag/varint
// strategy to Wuhan's richer schema. MIT upstream; see docs/LOADING_OPTIMIZATION.md.
// Integer/millimetre encoding is used only when it reconstructs the exact Number.
export function decodeGeodata(data){
 if(!(data instanceof Uint8Array)||data.length<5||String.fromCharCode(...data.subarray(0,4))!=='WUH1')throw Error('武汉地图数据格式错误');
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength),text=new TextDecoder('utf-8',{fatal:true});let cursor=4;
 const invalid=()=>{throw Error('武汉地图数据不完整或格式错误');};
 function uint(){let n=0;for(let i=0;i<5;i++){if(cursor>=data.length)invalid();const b=data[cursor++];if(i===4&&b>15)invalid();n+=(b&127)*2**(i*7);if(!(b&128))return n;}invalid();}
 const signed=()=>{const n=uint();return (n>>>1)^-(n&1);};
 const count=()=>{const n=uint();if(n>data.length-cursor)invalid();return n;};
 const strings=Array.from({length:count()},()=>{const n=count(),s=text.decode(data.subarray(cursor,cursor+n));cursor+=n;return s;});
 const string=()=>{const id=uint();if(id>=strings.length)invalid();return strings[id];};
 function value(depth=0){
  if(depth>100||cursor>=data.length)invalid();
  const type=data[cursor++];
  if(type===0)return null;if(type===1)return false;if(type===2)return true;
  if(type===3)return signed();if(type===4)return signed()/1000;
  if(type===5){if(cursor+8>data.length)invalid();const n=view.getFloat64(cursor,true);cursor+=8;if(!Number.isFinite(n))invalid();return n;}
  if(type===6)return string();
  if(type===7)return Array.from({length:count()},()=>value(depth+1));
  if(type===8){const obj={},n=count();for(let i=0;i<n;i++){const key=string();if(key==='__proto__'||Object.hasOwn(obj,key))invalid();obj[key]=value(depth+1);}return obj;}
  if(type===10)return Array.from({length:count()},signed);
  if(type===9){const n=count(),out=new Array(n),previous=[0,0];for(let i=0;i<n;i++){previous[i%2]+=signed();out[i]=previous[i%2]/1000;}return out;}
  invalid();
 }
 const result=value();if(cursor!==data.length)invalid();return result;
}

export async function unpackGeodata(bytes,{decodedBytes}={}){
 // Upstream 2813f08: a host may apply Content-Encoding:gzip, in which case
 // fetch has already inflated the asset. Inspect magic bytes, not its suffix.
 const raw=bytes[0]===0x1f&&bytes[1]===0x8b
  ?new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
  :bytes;
 if(decodedBytes!==undefined&&raw.length!==decodedBytes)throw Error('武汉地图资源长度与版本不一致，请刷新重试');
 return decodeGeodata(raw);
}
