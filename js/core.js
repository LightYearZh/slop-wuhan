// Shared metre-based geography and runtime contracts. No rendering dependencies.
export const ORIGIN = [114.293, 30.585];
const RAD = Math.PI / 180;
const A = 6378137, E2 = 6.69437999014e-3;
const sin = Math.sin(ORIGIN[1] * RAD);
const eastScale = RAD * A / Math.sqrt(1 - E2 * sin * sin) * Math.cos(ORIGIN[1] * RAD);
const northScale = RAD * A * (1 - E2) / (1 - E2 * sin * sin) ** 1.5;
export const projectWgs84 = (lon, lat) => ({ x: (lon - ORIGIN[0]) * eastScale || 0, z: -(lat - ORIGIN[1]) * northScale || 0 });
export const unprojectWorld = (x, z) => ({ lon: ORIGIN[0] + x / eastScale, lat: ORIGIN[1] - z / northScale });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function closestOnSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const t = clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz || 1),0,1);
  return {x:a[0]+dx*t, z:a[2]+dz*t, height:a[1]+(b[1]-a[1])*t, t, distance:Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t)};
}
export function pointInRing(x,z,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function pointInPolygon(x,z,rings) {return pointInRing(x,z,rings[0])&&!rings.slice(1).some(r=>pointInRing(x,z,r));}

// Index immutable source segments once. Queries keep exact segment projections;
// the grid only narrows the work, including streets spanning several cells.
class RoadSegments {
  constructor(roads,size=128){
    this.size=size;this.cells=new Map();this.segments=[];this.minX=this.minZ=Infinity;this.maxX=this.maxZ=-Infinity;
    for(const road of roads)for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i],s={road,a,b,segment:i-1,order:this.segments.length};this.segments.push(s);
      const x0=Math.floor(Math.min(a[0],b[0])/size),x1=Math.floor(Math.max(a[0],b[0])/size),z0=Math.floor(Math.min(a[2],b[2])/size),z1=Math.floor(Math.max(a[2],b[2])/size);
      this.minX=Math.min(this.minX,x0);this.maxX=Math.max(this.maxX,x1);this.minZ=Math.min(this.minZ,z0);this.maxZ=Math.max(this.maxZ,z1);
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+':'+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(s);}
    }
  }
  within(x,z,radius){
    const found=new Set(),n=this.size;
    for(let ix=Math.floor((x-radius)/n);ix<=Math.floor((x+radius)/n);ix++)for(let iz=Math.floor((z-radius)/n);iz<=Math.floor((z+radius)/n);iz++)for(const s of this.cells.get(ix+':'+iz)||[])found.add(s);
    return [...found].sort((a,b)=>a.order-b.order);
  }
  nearest(x,z,filter){
    if(!this.segments.length)return null;
    const n=this.size,cx=Math.floor(x/n),cz=Math.floor(z/n),seen=new Set();let best=null;
    const visit=s=>{if(seen.has(s))return;seen.add(s);if(!filter(s.road))return;const p=closestOnSegment(x,z,s.a,s.b);if(!best||p.distance<best.distance||p.distance===best.distance&&s.order<best.order)best={...s,...p};};
    // Outside the indexed region a full pass is bounded by source size, rather
    // than the arbitrarily large number of empty cells to a remote query.
    if(cx<this.minX||cx>this.maxX||cz<this.minZ||cz>this.maxZ){for(const s of this.segments)visit(s);return best;}
    const max=Math.max(cx-this.minX,this.maxX-cx,cz-this.minZ,this.maxZ-cz);
    for(let r=0;r<=max;r++){
      for(let ix=cx-r;ix<=cx+r;ix++)for(const iz of r?[cz-r,cz+r]:[cz])for(const s of this.cells.get(ix+':'+iz)||[])visit(s);
      for(let iz=cz-r+1;iz<cz+r;iz++)for(const ix of [cx-r,cx+r])for(const s of this.cells.get(ix+':'+iz)||[])visit(s);
      const outsideDistance=Math.min(x-(cx-r)*n,(cx+r+1)*n-x,z-(cz-r)*n,(cz+r+1)*n-z);
      if(best&&best.distance<outsideDistance)return best;
    }
    return best;
  }
}

export class SurfaceProvider {
  constructor(roads=[],water=[],rampCuts=[]) {
    this.tileWater=new Map();this.roadTiles=new Map();
    this.rampCuts=rampCuts;this.rampBounds=rampCuts.map(r=>r[0].reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]));
    this.roads=roads;this.water=water;this.index=new RoadSegments(roads);this.sampleRadius=roads.reduce((m,r)=>Math.max(m,r.width||8),8)/2+1;
    this.waterBounds=water.map(r=>r[0].reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]));
  }
  nearest(x,z,filter=()=>true) {
    let best=null;
    for(const s of this.segmentsNear(x,z,256)){if(!filter(s.road))continue;const p=closestOnSegment(x,z,s.a,s.b);if(!best||p.distance<best.distance)best={...s,...p};}
    if(best&&best.distance<256)return best;
    for(const index of [this.index,...[...this.roadTiles.values()].map(t=>t.index)]){const p=index.nearest(x,z,filter);if(p&&(!best||p.distance<best.distance))best=p;}
    return best;
  }
  segmentsNear(x,z,radius){const result=this.index.within(x,z,radius);for(const {bounds:b,index}of this.roadTiles.values())if(x>=b[0]-radius&&x<=b[2]+radius&&z>=b[1]-radius&&z<=b[3]+radius)result.push(...index.within(x,z,radius));return result;}
  setTileRoads(meta,roads){this.roadTiles.set(meta.id,{bounds:meta.bounds,index:new RoadSegments(roads)});this.sampleRadius=roads.reduce((m,r)=>Math.max(m,(r.width||8)/2+1),this.sampleRadius);}
  removeTileRoads(id){this.roadTiles.delete(id);}
  canTraverse({x,z,y=2.12,mode='person'}){
    if(mode==='car'||mode==='helicopter'||Math.abs(y-2.12)>1)return true;
    const radius=mode==='cyclist'?1.6:.6;
    if(this.rampCuts.length)return !this.rampCuts.some((poly,i)=>{const b=this.rampBounds[i];return x>=b[0]-radius&&x<=b[2]+radius&&z>=b[1]-radius&&z<=b[3]+radius&&[[x,z],[x-radius,z],[x+radius,z],[x,z-radius],[x,z+radius]].some(p=>pointInPolygon(p[0],p[1],poly));});
    return !this.segmentsNear(x,z,this.sampleRadius+radius).some(s=>{if(!s.road.tunnel)return false;const p=closestOnSegment(x,z,s.a,s.b);return p.height>-3&&p.height<2.11999&&p.distance<s.road.width/2+radius;});
  }
  landingCandidates(x,z,mode='car') {
    const out=[],seen=new Set();
    for(const {road,a,b} of this.segmentsNear(x,z,350)){if(road.tunnel||mode==='car'&&road.mode==='person')continue;
      const p=closestOnSegment(x,z,a,b);if(p.distance>350)continue;
      const len=Math.hypot(b[0]-a[0],b[2]-a[2])||1,nx=-(b[2]-a[2])/len,nz=(b[0]-a[0])/len;
      for(const offset of [0,-road.width/4,road.width/4]){const q={x:p.x+nx*offset,z:p.z+nz*offset,y:road.bridge?p.height:2.12,road},key=Math.round(q.x*2)+':'+Math.round(q.z*2);if(seen.has(key))continue;seen.add(key);q.distance=Math.hypot(q.x-x,q.z-z);out.push(q);}
    }
    return out.sort((a,b)=>a.distance-b.distance).slice(0,160);
  }
  sample({x,z,y=2,mode='person',surfaceId=null}) {
    let best=null,score=Infinity;
    // Open ramps replace the street surface inside their cut-out. Retaining an
    // old street ID here would hold the car above the ramp and then drop it.
    const segments=mode!=='helicopter'?this.segmentsNear(x,z,this.sampleRadius):[];
    let mouth=null;for(const s of segments)if(s.road.tunnel){const p=closestOnSegment(x,z,s.a,s.b);if(!mouth||p.distance<mouth.distance)mouth={...p,road:s.road};}
    const inMouth=mode==='car'&&mouth&&mouth.height>-3&&mouth.distance<mouth.road.width/2-.2&&Math.abs(mouth.height-y)<4;
    for(const {road,a,b} of segments) {
      if(mode==='car'&&road.mode==='person'||mode!=='car'&&road.tunnel)continue;
      if(inMouth&&road.id!==mouth.road.id)continue;
        const p=closestOnSegment(x,z,a,b);
        if(p.distance>(road.width||8)/2+1)continue;
        const s=Math.abs(p.height-y)+p.distance*2+(surfaceId===road.id?-100:0);
        if(s<score && (surfaceId===road.id||Math.abs(p.height-y)<4)) {
          score=s;const slope=(b[1]-a[1])/(Math.hypot(b[0]-a[0],b[2]-a[2])||1);
          const len=Math.hypot(b[0]-a[0],b[2]-a[2])||1,n=Math.sqrt(1+slope*slope);
          best={height:p.height,normal:{x:-slope*(b[0]-a[0])/len/n,y:1/n,z:-slope*(b[2]-a[2])/len/n},surfaceId:road.id,tunnel:!!road.tunnel&&p.height<0,road,projection:p};
        }
    }
    return best||{height:2,normal:{x:0,y:1,z:0},surfaceId:'ground',tunnel:false};
  }
  setTileWater(meta,water){this.tileWater.set(meta.id,{bounds:meta.bounds,water});}
  removeTileWater(id){this.tileWater.delete(id);}
  isWater(x,z) {
    for(const {bounds:b,water}of this.tileWater.values())if(x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3])return water.some(r=>pointInPolygon(x,z,r));
    return this.water.some((r,i)=>{const b=this.waterBounds[i];return x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3]&&pointInPolygon(x,z,r);});
  }
}

export class CollisionWorld {
  constructor() {this.tiles=new Map();this.cells=new Map();this.size=64;}
  keys(b) {
    const out=[];for(let x=Math.floor(b.minX/this.size);x<=Math.floor(b.maxX/this.size);x++)for(let z=Math.floor(b.minZ/this.size);z<=Math.floor(b.maxZ/this.size);z++)out.push(x+':'+z);return out;
  }
  addTile(id,colliders) {this.removeTile(id);this.tiles.set(id,colliders);for(const c of colliders)for(const k of this.keys(c)){if(!this.cells.has(k))this.cells.set(k,new Set());this.cells.get(k).add(c);}}
  removeTile(id) {for(const c of this.tiles.get(id)||[])for(const k of this.keys(c)){const s=this.cells.get(k);s?.delete(c);if(!s?.size)this.cells.delete(k);}this.tiles.delete(id);}
  query(b) {
    const set=new Set();for(const k of this.keys(b))for(const c of this.cells.get(k)||[])if(c.minX<=b.maxX&&c.maxX>=b.minX&&c.minY<=b.maxY&&c.maxY>=b.minY&&c.minZ<=b.maxZ&&c.maxZ>=b.minZ)set.add(c);return [...set];
  }
}

export class TileLoader {
  constructor(manifest,fetchTile,mountTile) {
    this.manifest=manifest;this.fetchTile=fetchTile;this.mountTile=mountTile;this.records=new Map();this.disposed=false;this.pinned=new Set();this.leases=new Map();
    this.tileSize=manifest.tileSizeM||500;this.tileMap=new Map();this.tileCells=new Map();
    for(const t of manifest.tiles){this.tileMap.set(t.id,t);const b=t.bounds,n=this.tileSize;for(let x=Math.floor(b[0]/n);x<=Math.floor(b[2]/n);x++)for(let z=Math.floor(b[1]/n);z<=Math.floor(b[3]/n);z++){const key=x+':'+z;if(!this.tileCells.has(key))this.tileCells.set(key,[]);this.tileCells.get(key).push(t);}}
  }
  nearbyTiles(x,z,radius){
    const n=this.tileSize,found=new Set();
    for(let ix=Math.floor((x-radius)/n);ix<=Math.floor((x+radius)/n);ix++)for(let iz=Math.floor((z-radius)/n);iz<=Math.floor((z+radius)/n);iz++)for(const t of this.tileCells.get(ix+':'+iz)||[])found.add(t);
    return [...found].filter(t=>x>=t.bounds[0]-radius&&x<=t.bounds[2]+radius&&z>=t.bounds[1]-radius&&z<=t.bounds[3]+radius);
  }
  tilesAt({x,z}) {
    const b=this.manifest.bounds;if(b&&(x<b[0]||z<b[1]||x>b[2]||z>b[3]))return [];
    if(this.manifest.playableBoundary&&!this.manifest.playableBoundary.some(p=>pointInPolygon(x,z,p)))return [];
    const halo=this.manifest.collisionHaloM||0;
    return this.nearbyTiles(x,z,halo);
  }
  readyAt(position) {const ts=this.tilesAt(position);return !this.disposed&&ts.length>0&&ts.every(t=>this.records.get(t.id)?.state==='ready');}
  async ensure(id) {
    if(this.disposed)throw Error('loader disposed');
    let r=this.records.get(id);if(r?.state==='ready')return;if(r?.promise)return r.promise;
    const tile=this.tileMap.get(id);if(!tile)throw Error('unknown tile '+id);
    r={state:'loading',controller:new AbortController()};this.records.set(id,r);
    r.promise=(async()=>{try{
      const data=await this.fetchTile(tile,r.controller.signal);
      if(this.disposed||this.records.get(id)!==r)throw Error('loader disposed or superseded');
      r.handle=this.mountTile(data,tile);r.state='ready';
    }catch(e){r.state='error';throw e;}finally{r.promise=null;}})();return r.promise;
  }
  async ensureAt({x,z},mode) {
    const tiles=this.tilesAt({x,z});
    if(!tiles.length)throw Error('outside playable area');for(const t of tiles)this.leases.set(t.id,(this.leases.get(t.id)||0)+1);
    try{await Promise.all(tiles.map(t=>this.ensure(t.id)));}finally{for(const t of tiles){const n=this.leases.get(t.id)||0;if(n<=1)this.leases.delete(t.id);else this.leases.set(t.id,n-1);}}
  }
  async ensureRoute(id) {const route=this.manifest.routes?.find(r=>r.id===id);if(!route)throw Error('unknown route');for(const tid of route.tiles)this.pinned.add(tid);await Promise.all(route.tiles.map(t=>this.ensure(t)));}
  async update({x,z},mode) {
    const wanted=new Set(this.nearbyTiles(x,z,800).map(t=>t.id));
    for(const id of wanted)this.ensure(id).catch(()=>{});
    for(const [id,r]of this.records)if(!wanted.has(id)&&!this.pinned.has(id)&&!this.leases.has(id)){r.controller.abort();r.handle?.dispose();this.records.delete(id);}
  }
  dispose() {this.disposed=true;for(const r of this.records.values()){r.controller.abort();r.handle?.dispose();}this.records.clear();}
}

export function buildRoadGraph(roads) {
  const nodes=new Map(),edges=[];
  for(const road of roads)for(let i=1;i<road.points.length;i++) {
    const layer=road.layer||0,from=layer+':'+road.nodeIds[i-1],to=layer+':'+road.nodeIds[i];
    nodes.set(from,{id:from,point:road.points[i-1]});nodes.set(to,{id:to,point:road.points[i]});
    const e={from,to,roadId:road.id,modes:road.mode==='person'?['person','cyclist']:['person','cyclist','car']};edges.push(e);if(!road.oneway)edges.push({...e,from:to,to:from});
  }
  return {nodes:[...nodes.values()],edges};
}

export function constrainTunnelCamera(position, target, width=8, height=5.5, road=null) {
  const dx=position.x-target.x,dz=position.z-target.z;
  const forward=dx*Math.sin(target.heading)+dz*Math.cos(target.heading);
  const side=clamp(dx*Math.cos(target.heading)-dz*Math.sin(target.heading),-width/2+1.2,width/2-1.2);
  const back=clamp(forward,-7,3);
  const p={x:target.x+Math.sin(target.heading)*back+Math.cos(target.heading)*side,z:target.z+Math.cos(target.heading)*back-Math.sin(target.heading)*side,y:clamp(position.y,target.y+.8,target.y+height-.7)};
  if(road){
    let nearest=null;for(let i=1;i<road.points.length;i++){const q=closestOnSegment(p.x,p.z,road.points[i-1],road.points[i]);if(!nearest||q.distance<nearest.distance)nearest=q;}
    if(nearest){const margin=width/2-.8;if(nearest.distance>margin){const ratio=margin/nearest.distance;p.x=nearest.x+(p.x-nearest.x)*ratio;p.z=nearest.z+(p.z-nearest.z)*ratio;}p.y=clamp(p.y,nearest.height+.8,nearest.height+height-.7);}
  }
  return p;
}
