// Night-light verification plates for the landmark floodlighting pass.
import fs from 'node:fs';
const city=JSON.parse(fs.readFileSync(new URL('../public/data/city.json',import.meta.url)));
const road=id=>city.roads.find(r=>r.id===id).points.map(([x,y,z])=>[x,y-2.12,z]);
const heading=p=>Math.atan2(p[1][0]-p[0][0],p[1][2]-p[0][2]);
const bridge=road('osm-way-455183575');
const fixed=(id,name,time,view,camera,target,duration=6)=>({
 id,name,time,view,camera,cameraEnd:camera,target,targetEnd:target,duration,hud:false,
});
export const shots=[
 fixed('T03L','江汉关_蓝调_灯光','twilight','jianghanguan',[-36,49,576],[-95.65,24,711.59]),
 fixed('T04L','江汉关_夜晚_灯光','midnight','jianghanguan',[-36,49,576],[-95.65,24,711.59]),
 fixed('T10L','黄鹤楼_蓝调_灯光','twilight','yellow-crane',[120,120,4430],[388,64,4210]),
 fixed('T11L','黄鹤楼_夜晚_灯光','midnight','yellow-crane',[120,120,4430],[388,64,4210]),
 fixed('T13L','龟山塔_夜晚_灯光','midnight','guishan',[-1250,200,3500],[-1730,150,3000]),
 fixed('T15ML','两江_夜晚_灯光','midnight','overview',[300,80,3000],[-900,75,2400]),
 fixed('T08L','长江大桥_夜晚_灯光_定点','midnight','bridge',[-500,240,3100],[-850,25,3650]),
 {id:'N02L',name:'长江大桥_夜晚_灯光_驾车',duration:10,time:'midnight',hud:true,mode:'car',start:bridge[2],heading:heading(bridge.slice(2)),path:bridge.slice(2),speed:20,zoom:1.3},
];
