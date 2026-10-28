// Shared materials outlive a tile. WebGPU also keeps per-object bindings:
// geometry.dispose() alone only releases vertex data, so notify every mesh.
export function disposeTileGeometry(group){group.traverse(o=>{if(o.isMesh){if(o.isInstancedMesh)o.dispose();else o.dispatchEvent({type:'dispose'});o.geometry.dispose();}});}
