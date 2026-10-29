// Shared by the representative-place menu and the map's core destination list.
const CORE_ORDER = ['yellow-crane','yangtze-bridge','jianghanguan','jianghan-road','qingchuange','guishan-tower','red-house','greenland-center','shipping-center','heartland-66'];
const rank = new Map(CORE_ORDER.map((id,i)=>[id,i]));

export function orderedCoreDestinations(destinations){
  return [...destinations].sort((a,b)=>(rank.get(a.id)??CORE_ORDER.length)-(rank.get(b.id)??CORE_ORDER.length));
}

// Alternate entries for places that already have a reviewed core arrival.
const CORE_ALIASES = new Set([
  'road-江汉路', 'building-osm-building-way-533413541-0',
  'building-osm-building-way-1013447170-0', 'building-osm-building-relation-13567167-0',
  'building-osm-building-relation-14117454-0', 'bridge-osm-way-28908192'
]);
const SECONDARY_ORDER = ['江汉桥','晴川桥','铁门关','江汉门','大巴公房子','璇宫饭店旧址','武汉长江中心','武汉万达中心','平安大厦','沿江大道','中山大道','汉口隧道入口','武昌隧道入口'];
const secondaryPriority=new Map(SECONDARY_ORDER.map((name,i)=>[name,i]));
const siteKey = destination => destination.id.match(/osm-building-(?:way|relation)-\d+/)?.[0] || destination.id;
const secondaryRank = destination => destination.id.startsWith('bridge-') ? 0
  : destination.id.startsWith('gate-') ? 1
  : destination.id.startsWith('building-') ? 2
  : destination.id.startsWith('heritage-') ? 3
  : destination.id.startsWith('road-') ? 4 : 5;

export function teleportMenuDestinations(coreDestinations, locations){
  const core=orderedCoreDestinations(coreDestinations).map(d=>locations[d.id]);
  const coreIds=new Set(core.map(d=>d.id));
  const entries=Object.values(locations);
  const heritageSites=new Set(entries.filter(d=>d.id.startsWith('heritage-')).map(siteKey));
  const secondary=entries.filter(d=>!coreIds.has(d.id)&&!CORE_ALIASES.has(d.id)&&!/银行/.test(d.name)
    &&!(d.id.startsWith('building-')&&heritageSites.has(siteKey(d))));
  secondary.sort((a,b)=>(secondaryPriority.get(a.name)??SECONDARY_ORDER.length+secondaryRank(a))-(secondaryPriority.get(b.name)??SECONDARY_ORDER.length+secondaryRank(b)));
  // No count cap: utility entrances and future destinations remain available after the main landmarks.
  return [...core,...secondary];
}
