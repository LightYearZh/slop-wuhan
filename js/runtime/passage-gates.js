import * as THREE from 'three/webgpu';
import {modelBuilder,curvedRoof} from './landmark-craft.js';
import {createFootprintGeometry} from '../footprint-buildings.js';

// Render the very same openings/solids whose vertical slices supply the colliders.
// These are estimated exterior models; opening widths are aligned to mapped paths.
export function buildPassageGate(p){
  const root=new THREE.Group(),m={
    stone:new THREE.MeshStandardNodeMaterial({color:0x81786a,roughness:.95}),
    pale:new THREE.MeshStandardNodeMaterial({color:0xb3b0a1,roughness:.88}),
    roof:new THREE.MeshStandardNodeMaterial({color:0x404b45,roughness:.85}),
    red:new THREE.MeshStandardNodeMaterial({color:0x783f31,roughness:.88}),
    green:new THREE.MeshStandardNodeMaterial({color:0x31554f,roughness:.85}),
    dark:new THREE.MeshStandardNodeMaterial({color:0x263a37,roughness:.65})
  },builder=modelBuilder(root),f=p.frame;
  if(p.kind==='city-gate'){
    const W=f.w,D=f.d,wallTop=13,s=new THREE.Shape();s.moveTo(-W/2,0);
    for(const o of p.openings){
      s.lineTo(o.u-o.width/2,0);s.lineTo(o.u-o.width/2,o.spring);
      for(let i=1;i<=32;i++){const a=Math.PI*(1-i/32);s.lineTo(o.u+o.width/2*Math.cos(a),o.spring+(o.crown-o.spring)*Math.sin(a));}
      s.lineTo(o.u+o.width/2,0);
    }
    s.lineTo(W/2,0);s.lineTo(W/2,wallTop);s.lineTo(-W/2,wallTop);s.closePath();
    const wall=new THREE.ExtrudeGeometry(s,{depth:D,bevelEnabled:false,steps:1,curveSegments:1});wall.translate(0,0,-D/2);builder.add(wall,m.stone);
    for(const side of [-1,1]){
      builder.box(W+.2,.4,.35,0,12.8,side*D/2,m.pale);
      // Arch rim: a continuous curve with a shallow stone surround, never a face filling the opening.
      for(const o of p.openings){
        const at=a=>[o.u+o.width/2*Math.cos(a),o.spring+(o.crown-o.spring)*Math.sin(a),side*(D/2+.035)];
        for(let i=0;i<32;i++)builder.beam(at(i*Math.PI/32),at((i+1)*Math.PI/32),.17,m.pale);
        for(const x of [o.u-o.width/2-.10,o.u+o.width/2+.10])builder.box(.22,o.spring,.18,x,o.spring/2,side*(D/2+.04),m.pale);
      }
      for(let i=0;i<18;i++)builder.box(W/25,.65,.55,-W/2+.8+i*(W-1.6)/17,13.3,side*(D/2-.25),m.stone);
    }
    // Two-storey red-column pavilion and grey-tiled double eaves above the gate platform.
    builder.box(19,.4,8.5,0,13.5,0,m.pale);
    for(const side of [-1,1])for(let i=0;i<7;i++){
      const x=-10+i*20/6;builder.cyl(.22,.27,4.5,x,15.8,side*4.5,m.red);
      builder.box(2.45,2.6,.1,x,15.9,side*3.8,m.dark);
    }
    builder.box(21,.45,9.3,0,18.15,0,m.green);
    curvedRoof(builder,{w:29,d:14.3,y:18.4,rise:2.9,lift:.8,material:m.roof,trim:m.green});
    builder.box(15,2.8,6.4,0,21.4,0,m.red);
    for(const side of [-1,1])for(let i=0;i<7;i++)builder.box(1.35,1.7,.12,-6+i*2,21.4,side*3.23,m.dark);
    curvedRoof(builder,{w:22,d:10.6,y:23.1,rise:3.2,lift:.7,material:m.roof,trim:m.green});
    builder.finish();root.position.set(f.x,p.groundY,f.z);root.rotation.y=-Math.atan2(f.uz,f.ux);
  }else{
    for(const v of p.parts){
      const g=createFootprintGeometry({rings:v.rings,h:v.h,baseY:v.baseY});g.translate(0,p.groundY-2,0);
      builder.add(g,v.role==='gate-post'?m.pale:m.roof);
    }
    builder.finish();
    if(p.kind==='ceremonial-gate'){
      const top=new THREE.Group(),b=modelBuilder(top);
      const tile=new THREE.MeshStandardNodeMaterial({color:p.sourceTags['roof:colour']==='orange'?0xb17a28:0x464f49,roughness:.86});
      curvedRoof(b,{w:f.w+.8,d:Math.max(2.4,f.d+.6),y:p.height-.6,rise:1.6,lift:.45,material:tile,trim:m.green});b.finish();
      top.position.set(f.x,p.groundY,f.z);top.rotation.y=-Math.atan2(f.uz,f.ux);root.add(top);
    }
  }
  root.name='PassageGate_'+p.sourceId;root.userData.passage={id:p.sourceId,name:p.name,kind:p.kind,clearanceM:p.clearanceM,openings:p.openings};return root;
}
