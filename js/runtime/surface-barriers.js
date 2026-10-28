// Side protection begins only once the road has separated from the street.
// Display and contact use the same threshold; reservation clearances are not walls.
export const SURFACE_CONNECTION_HEIGHT=.75;
export const tunnelHasSides=y=>y< -SURFACE_CONNECTION_HEIGHT;
export function barrierSpan(a,b,groundA=0,groundB=0,{underground=false}={}){
 const sign=underground?-1:1,da=sign*(a[1]-groundA),db=sign*(b[1]-groundB),h=SURFACE_CONNECTION_HEIGHT;
 if(Math.max(da,db)<=h)return null;
 const at=t=>a.map((v,k)=>v+(b[k]-v)*t);
 return [da<h?at((h-da)/(db-da)):a,db<h?at((h-da)/(db-da)):b];
}
