// Measured model bounds (including mirrors and plates, excluding the AO quad).
export const TAXI_FOOTPRINT=Object.freeze({halfWidth:1.07,halfLength:2.28});
// Reserve room for the taxi's
// projected corners when the driver turns across the bore near a wall.
export function vehicleLateralLimit(heading,dx,dz,width=8){
 const angle=heading-Math.atan2(dx,dz),extent=Math.abs(Math.sin(angle))*TAXI_FOOTPRINT.halfLength+Math.abs(Math.cos(angle))*TAXI_FOOTPRINT.halfWidth;
 return Math.max(.1,Math.min(width/2-1.5,width/2-.12-extent));
}
