// Camera paths select existing runtime geometry; no geometry, heights or collision rules are changed.
import fs from 'node:fs';
const city=JSON.parse(fs.readFileSync(new URL('../public/data/city.json',import.meta.url)));
const road=id=>city.roads.find(r=>r.id===id).points.map(([x,y,z])=>[x,y-2.12,z]);
const heading=p=>Math.atan2(p[1][0]-p[0][0],p[1][2]-p[0][2]);
const bridge=road('osm-way-455183575');
const river=road('osm-way-128479428-part-0');
const walk=road('osm-way-128398503-part-0');
const gate=road('osm-way-1055558222-part-0');
const gx=gate[1][0]-gate[0][0],gz=gate[1][2]-gate[0][2],gl=Math.hypot(gx,gz);
const gatePath=[[gate[0][0]-gx/gl*28,gate[0][1],gate[0][2]-gz/gl*28],[gate[1][0]+gx/gl*40,gate[1][1],gate[1][2]+gz/gl*40]];
const tunnel=city.tunnels[0].points.map(([x,y,z])=>[x,y-2.12,z]);
export const shots=[
 {id:'W01',name:'两江三镇全景_干净画面',duration:24,view:'overview',camera:[2700,2200,6100],cameraEnd:[2300,2050,5750],target:[-650,0,2300]},
 {id:'W03A',name:'江汉关钟楼_慢推',duration:22,view:'jianghanguan',camera:[-36,49,576],cameraEnd:[-48,43,610],target:[-95.65,24,711.59]},
 {id:'W04A',name:'汉口历史街区_沿江立面',duration:24,view:'hankou-heritage',camera:[210,58,340],cameraEnd:[130,45,280],target:[78,16,220]},
 {id:'W06',name:'黄鹤楼与蛇山_缓慢环绕',duration:24,view:'yellow-crane',camera:[120,120,4430],cameraEnd:[50,128,4270],target:[388,64,4210]},
 {id:'W07',name:'龟山电视塔_山体全景',duration:24,view:'guishan',camera:[-1250,200,3500],cameraEnd:[-1140,225,3420],target:[-1730,150,3000]},
 {id:'W02A',name:'武汉长江大桥_空中侧景',duration:24,view:'bridge',camera:[-500,240,3100],cameraEnd:[-700,220,3000],target:[-850,25,3650]},
 {id:'W12A',name:'汉口滨江天际线',duration:22,view:'hankou-skyline',camera:[-600,160,2350],cameraEnd:[-400,180,2280],target:[-1400,55,1300]},
 {id:'W12B',name:'南岸嘴与晴川饭店',duration:22,view:'qingchuan-skyline',camera:[-500,170,2400],cameraEnd:[-430,185,2550],target:[-1250,45,2800]},
 {id:'W12C',name:'积玉桥滨江高楼',duration:22,view:'jiyuqiao-skyline',camera:[-200,240,2600],cameraEnd:[-80,220,2680],target:[1050,70,1850]},
 {id:'W01B',name:'两江三镇_黄昏片尾',duration:20,time:'golden',view:'overview',camera:[2500,2050,5800],cameraEnd:[2700,2200,6100],target:[-650,0,2300]},
 {id:'W02B',name:'长江大桥_连续驾车',duration:38,hud:true,mode:'car',start:bridge[2],heading:heading(bridge.slice(2)),path:bridge.slice(2),speed:20,zoom:1.3},
 {id:'W05',name:'沿江大道_出租车行驶',duration:30,hud:true,mode:'car',start:river[0],heading:heading(river),path:river,speed:12,zoom:1.2},
 {id:'W04B',name:'江汉路_步行看街景',duration:24,hud:true,mode:'person',start:walk[0],heading:heading(walk),path:walk,speed:4.4,zoom:1.15},
 {id:'W10A',name:'沿江大道_骑行',duration:25,hud:true,mode:'scooter',start:river[0],heading:heading(river),path:river,speed:8,zoom:1.2},
 {id:'W09',name:'铁门关_连续驾车穿门',duration:18,hud:true,mode:'car',start:gatePath[0],heading:heading(gatePath),path:gatePath,speed:5.5,zoom:1.5},
 {id:'W08',name:'长江隧道_汉口到武昌完整行驶',duration:165,hud:true,mode:'car',start:tunnel[0],heading:heading(tunnel),path:tunnel,speed:23,zoom:1.15},
 {id:'W10B',name:'四种移动方式_操作演示',duration:24,hud:true,mode:'person',at:'jianghan-road',actions:[{time:5,mode:'car'},{time:10,mode:'scooter'},{time:15,mode:'helicopter'}]},
 {id:'W11',name:'地图搜索与地标传送',duration:18,hud:true,mode:'car',at:'jianghanguan',actions:[{time:2,click:'btn-open-map'},{time:5,search:'黄鹤楼'},{time:10,destination:'yellow-crane'}]},
 {id:'W01C',name:'直升机_沿江飞行',duration:24,hud:true,mode:'helicopter',start:[1300,190,2900],heading:-2.1,move:{forward:.35,up:.1},zoom:1.4},
 {id:'W01D',name:'两江交汇_低空全景',duration:22,view:'overview',camera:[450,480,3350],cameraEnd:[700,520,3200],target:[-900,75,2400],targetEnd:[-800,75,2400]},
 {id:'W06B',name:'黄鹤楼_中近景',duration:20,view:'yellow-crane',camera:[215,92,4345],cameraEnd:[205,95,4250],target:[388,65,4204]},
 {id:'W09P',name:'铁门关_驾驶座连续穿门',duration:14,hud:true,mode:'car',view:'pov',start:gatePath[0],heading:heading(gatePath),path:gatePath,speed:5.5},
];
