import * as THREE from 'three/webgpu';
import {createCurtainWallMaterial,createPreWarBuildingMaterial} from './tsl-materials.js';

// Reusable appearance presets. Category provenance lives in city data; colours are illustrative.
export function createBuildingMaterials(){
 const masonry=(stone,trim,bay,floor,seed,ratio=.52)=>createPreWarBuildingMaterial({stoneColor:stone,trimColor:trim,windowWidth:bay,floorHeight:floor,windowRatioX:ratio,boxLocal:false,seed});
 const walls=[
  createCurtainWallMaterial({glassTint:0x304b58,frameTint:0x77847e,windowWidth:2.2,floorHeight:3.8,boxLocal:false,seed:2}),
  masonry(0xb9b7a9,0x8c897b,2.4,3.8,8),
  masonry(0xc4b796,0x8f856d,2.6,3.6,10),
  masonry(0x9f8170,0xc5b7a3,2.0,3.3,14),
  masonry(0xb6b1a4,0x7c817b,2.5,3.0,18,.64),
  masonry(0xc6c8bc,0x89958e,3.0,3.7,21,.58),
  masonry(0x989f9c,0x6c7979,3.5,3.4,25,.6),
  masonry(0xc0b9a9,0x8b8f86,2.3,3.2,31,.55)
 ];
 const roofs=[0x5e6d73,0x777b77,0x7d786c,0x676d6c,0x787b78,0x90938b,0x737d7d,0x8b887d].map(color=>new THREE.MeshStandardNodeMaterial({color,roughness:.9}));
 const details={glass:new THREE.MeshStandardNodeMaterial({color:0x263b3c,roughness:.25,metalness:.35}),
  frame:new THREE.MeshStandardNodeMaterial({color:0x8f9388,roughness:.8}),
  sign:new THREE.MeshStandardNodeMaterial({color:0x354c4a,roughness:.82}),
  trim:new THREE.MeshStandardNodeMaterial({color:0xbcb5a3,roughness:.9})};
 return {walls,roofs,details};
}
