// Dry-road tuning. This layer describes tire rolling, never rain or water spray.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
export function dryRoadNoise(speed,load=0,{bus=false,doppler=1}={}){
 const velocity=Math.abs(Number.isFinite(speed)?speed:0);
 const rolling=clamp((velocity-1.5)/28,0,1.25);
 return {
  gain:Math.pow(rolling,1.5)*(bus ? .08 : .055)*(1-clamp(load,0,1)*.12),
  cutoff:(750+Math.min(1,rolling)*900)*clamp(doppler,.5,2)
 };
}
export function motionWindExposure(mode){return mode==='car' ? .18 : 1;}
