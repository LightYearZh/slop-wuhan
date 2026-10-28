import * as THREE from 'three/webgpu';
export function buildStrip(points,width,offset=0){
 const p=[],indices=[];
 for(let i=0;i<points.length;i++){
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],len=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
  const nx=-(b[2]-a[2])/len,nz=(b[0]-a[0])/len;
  for(const side of [-1,1])p.push(points[i][0]+nx*(side*width/2+offset),points[i][1],points[i][2]+nz*(side*width/2+offset));
  if(i<points.length-1){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
