// Canonical 18-shot supplement: time-of-day match cuts and night driving.
// Landmark night lighting is applied by the runtime; no geometry or collision changes here.
import fs from 'node:fs';
const city=JSON.parse(fs.readFileSync(new URL('../public/data/city.json',import.meta.url)));
const road=id=>city.roads.find(r=>r.id===id).points.map(([x,y,z])=>[x,y-2.12,z]);
const heading=p=>Math.atan2(p[1][0]-p[0][0],p[1][2]-p[0][2]);
const bridge=road('osm-way-455183575');
const river=road('osm-way-128479428-part-0');
const walk=road('osm-way-128398503-part-0');

const fixed=(id,name,time,view,camera,target,duration=6)=>({
 id,name,time,view,camera,cameraEnd:camera,target,targetEnd:target,duration,hud:false,
});

export const shots=[
 fixed('T01','江汉关_正午_定点','midday','jianghanguan',[-36,49,576],[-95.65,24,711.59]),
 fixed('T02','江汉关_黄金_定点','golden','jianghanguan',[-36,49,576],[-95.65,24,711.59]),
 fixed('T03','江汉关_蓝调_定点','twilight','jianghanguan',[-36,49,576],[-95.65,24,711.59]),
 fixed('T04','江汉关_夜晚_定点','midnight','jianghanguan',[-36,49,576],[-95.65,24,711.59]),

 fixed('T05','长江大桥_正午_定点','midday','bridge',[-500,240,3100],[-850,25,3650]),
 fixed('T06','长江大桥_黄金_定点','golden','bridge',[-500,240,3100],[-850,25,3650]),
 fixed('T07','长江大桥_蓝调_定点','twilight','bridge',[-500,240,3100],[-850,25,3650]),

 fixed('T09','黄鹤楼_黄金_定点','golden','yellow-crane',[120,120,4430],[388,64,4210]),
 fixed('T10','黄鹤楼_蓝调_定点','twilight','yellow-crane',[120,120,4430],[388,64,4210]),
 fixed('T11','黄鹤楼_夜晚_定点','midnight','yellow-crane',[120,120,4430],[388,64,4210]),

 fixed('T12G','龟山塔_黄金_定点','golden','guishan',[-1250,200,3500],[-1730,150,3000]),
 fixed('T13','龟山塔_夜晚_定点','midnight','guishan',[-1250,200,3500],[-1730,150,3000]),
 fixed('T15M','两江_夜晚_中角度','midnight','overview',[300,80,3000],[-900,75,2400]),

 {id:'N01',name:'沿江大道_夜晚_出租车',duration:10,time:'midnight',hud:true,mode:'car',start:river[0],heading:heading(river),path:river,speed:12,zoom:1.2},
 {id:'N02',name:'长江大桥_夜晚_驾车',duration:10,time:'midnight',hud:true,mode:'car',start:bridge[2],heading:heading(bridge.slice(2)),path:bridge.slice(2),speed:20,zoom:1.3},
 {id:'N03',name:'江汉路_夜晚_步行',duration:10,time:'midnight',hud:true,mode:'person',start:walk[0],heading:heading(walk),path:walk,speed:4.4,zoom:1.15},
 {id:'N04',name:'直升机_夜晚_沿江',duration:10,time:'midnight',hud:true,mode:'helicopter',start:[1300,190,2900],heading:-2.1,move:{forward:.35,up:.1},zoom:1.4},
 {id:'N04C',name:'直升机_夜晚_沿江_干净',duration:6,time:'midnight',hud:false,mode:'helicopter',start:[1300,190,2900],heading:-2.1,move:{forward:.35,up:.1},zoom:1.4},
];
