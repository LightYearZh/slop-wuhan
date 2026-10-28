import fs from 'node:fs';import {projectWgs84,closestOnSegment} from '../js/core.js';
const data=JSON.parse(fs.readFileSync('public/data/city.json')),manifest=JSON.parse(fs.readFileSync('public/data/manifest.json'));
const output=process.argv[2]||'docs/acceptance';
const rad=Math.PI/180,a=6378137,e2=6.69437999014e-3;
function ecef(lon,lat){lon*=rad;lat*=rad;const n=a/Math.sqrt(1-e2*Math.sin(lat)**2);return [n*Math.cos(lat)*Math.cos(lon),n*Math.cos(lat)*Math.sin(lon),n*(1-e2)*Math.sin(lat)];}
const origin=ecef(...data.origin),lo=data.origin[0]*rad,la=data.origin[1]*rad;
function independentENU(lon,lat){const p=ecef(lon,lat).map((v,i)=>v-origin[i]);return {x:-Math.sin(lo)*p[0]+Math.cos(lo)*p[1],z:Math.sin(la)*Math.cos(lo)*p[0]+Math.sin(la)*Math.sin(lo)*p[1]-Math.cos(la)*p[2]};}
const controlPoints=data.controlPoints.map(c=>{const p=independentENU(c.lon,c.lat),q=projectWgs84(c.lon,c.lat);return {...c,ecefENU:p,errorMetres:Math.hypot(c.x-p.x,c.z-p.z),runtimeErrorMetres:Math.hypot(c.x-q.x,c.z-q.z)};});
const seams=data.tunnels.map(t=>{
 const start=t.points[0],end=t.points.at(-1);
 const endpoints=[start,end].map(p=>{let nearest=null;for(const r of data.roads)for(let i=1;i<r.points.length;i++){const q=closestOnSegment(p[0],p[2],r.points[i-1],r.points[i]);if(!nearest||q.distance<nearest.distance)nearest={...q,name:r.name,roadId:r.id,width:r.width};}return {point:p,road:nearest.name,roadId:nearest.roadId,centreDistanceM:nearest.distance,withinRoadWidths:nearest.distance<nearest.width/2+t.width/2,seamHeightDifferenceM:Math.abs(nearest.height-p[1])};});
 const grades=t.points.slice(1).map((p,i)=>Math.abs(p[1]-t.points[i][1])/Math.hypot(p[0]-t.points[i][0],p[2]-t.points[i][2]));
 return {id:t.id,direction:t.points[0][0]<0?'浦西到浦东':'浦东到浦西',lengthM:t.length,ends:endpoints,maxGrade:Math.max(...grades),profileSource:t.heightSource,oneway:t.oneway};
});
const result={method:'Independent WGS84 ECEF-to-ENU compared with scene projection; selected-source accuracy only',sourceDate:data.source.fetchedAt,sourceLimitations:data.source.limitations,controlPoints,count:controlPoints.length,maxErrorMetres:Math.max(...controlPoints.map(c=>c.errorMetres)),seams,tiles:manifest.tiles.length,landmarkCount:data.landmarks.length};
if(result.count<20||result.maxErrorMetres>5||seams.some(t=>t.ends.some(e=>!e.withinRoadWidths||e.seamHeightDifferenceM>.1)))throw Error(JSON.stringify(result));
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/geography.json',JSON.stringify(result,null,2));
const lines=['name,source,lon,lat,world_x,world_z,independent_error_m',...controlPoints.map(c=>[c.name,c.source,c.lon,c.lat,c.x,c.z,c.errorMetres.toFixed(4)].join(','))];fs.writeFileSync(output+'/control-points.csv',lines.join('\n'));
const b=data.bounds,w=b[2]-b[0],h=b[3]-b[1];let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1300" viewBox="${b[0]-100} ${b[1]-100} ${w+200} ${h+200}"><rect x="${b[0]-100}" y="${b[1]-100}" width="${w+200}" height="${h+200}" fill="#e4dfcf"/>`;
for(const rings of data.water)svg+=`<path d="${rings.map(r=>'M'+r.map(p=>p.join(',')).join('L')+'Z').join(' ')}" fill="#78a6b0" fill-rule="evenodd"/>`;
for(const r of data.roads)svg+=`<path d="M${r.points.map(p=>p[0]+','+p[2]).join('L')}" fill="none" stroke="#879080" stroke-width="${r.width*.5}"/>`;
for(const t of data.tunnels)svg+=`<path d="M${t.points.map(p=>p[0]+','+p[2]).join('L')}" fill="none" stroke="#d36f36" stroke-width="10" stroke-dasharray="22 12"/>`;
controlPoints.forEach((c,i)=>{svg+=`<circle cx="${c.x}" cy="${c.z}" r="15" fill="none" stroke="#222" stroke-width="3"/><path d="M${c.ecefENU.x-18},${c.ecefENU.z}h36M${c.ecefENU.x},${c.ecefENU.z-18}v36" stroke="#f00" stroke-width="3"/><text x="${c.x+20}" y="${c.z-15}" font-size="29" fill="#102522">${i+1}</text>`;});
svg+='</svg>';fs.writeFileSync(output+'/geography-overlay.svg',svg);
console.log(JSON.stringify({count:result.count,maxErrorMetres:result.maxErrorMetres,seams},null,2));
