export const TRAVEL_MODES=['person','car','scooter','helicopter'];

// Destination metadata describes a useful arrival, not permission to replace the vehicle.
export function travelMode(current,explicit){
  return TRAVEL_MODES.includes(explicit)?explicit:TRAVEL_MODES.includes(current)?current:'car';
}
export function travelAltitude(mode,destinationY){
  // null lets the controller keep the helicopter's existing altitude and terrain clearance.
  return mode==='helicopter'?null:destinationY??null;
}
