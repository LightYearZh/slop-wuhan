import {clamp} from './core.js';
export function assertModeAllowed(state,mode){if(state.inTunnel&&mode!=='car')throw Error('驶出隧道后可切换漫游模式');}
export function createDestinationNavigator({getState,prepare,arrive,maxAltitude=1200,nextRevision,isCurrent}){
 let revision=0;nextRevision??=()=>++revision;isCurrent??=r=>r===revision;
 return {cancel(){nextRevision();},async travel(target,{mode=getState().mode,heading=0}={}){
  if(!['person','car','cyclist','helicopter'].includes(mode))throw Error('未知漫游模式');
  assertModeAllowed(getState(),mode);
  const request=nextRevision();let point;try{point=await prepare(target,mode,request);}catch(error){if(!isCurrent(request))return false;throw error;}
  if(!point||!isCurrent(request))return false;
  assertModeAllowed(getState(),mode);
  const y=mode==='helicopter'?clamp(getState().position.y,180,maxAltitude):(point.y??2.12);arrive({...point,y},mode,heading);return true;
 }};
}
