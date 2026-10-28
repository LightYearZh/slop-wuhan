import {projectWgs84} from './core.js';
const a=projectWgs84(114.2826,30.594), b=projectWgs84(114.3034,30.576);
export const ISLAND_BOUNDS={minX:a.x,maxX:b.x,minZ:a.z,maxZ:b.z,waterLevel:0,sidewalkHeight:2};
export const CENTRAL_PARK_BOUNDS={minX:1e8,maxX:1e8+1,minZ:1e8,maxZ:1e8+1};
export const getIslandBoundsAtZ=()=>({westX:ISLAND_BOUNDS.minX,eastX:ISLAND_BOUNDS.maxX});
export const NJ_SHORELINE_POLYGON=[]; export const LONG_ISLAND_POLYGONS=[];
export const blockAt=()=>null; export const streetZ=()=>0;
export const isTypingInField=(e)=>/INPUT|TEXTAREA|SELECT/.test((e?.target||document.activeElement)?.tagName)||!!(e?.target||document.activeElement)?.isContentEditable;
