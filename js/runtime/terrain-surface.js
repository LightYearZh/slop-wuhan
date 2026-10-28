// Same NW/SE cell triangles as tools/build-runtime.py. Bilinear interpolation is
// not the surface a GPU draws: a saddle-shaped cell consists of two planar faces.
export function sampleTerrain(h,x,z){
  const fx=(x-h.x0)/h.res,fz=(z-h.z0)/h.res,i=Math.floor(fx),j=Math.floor(fz);
  if(i<0||j<0||i>=h.nx-1||j>=h.nz-1)return 0;
  const tx=fx-i,tz=fz-j,k=j*h.nx+i,d=h.data;
  if(tx+tz<=1)return d[k]+(d[k+1]-d[k])*tx+(d[k+h.nx]-d[k])*tz;
  return d[k+h.nx+1]+(d[k+h.nx]-d[k+h.nx+1])*(1-tx)+(d[k+1]-d[k+h.nx+1])*(1-tz);
}
