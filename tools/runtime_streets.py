"""Taipei-style junction graph and source-backed road details for Wuhan."""
import collections,math

CLASSES=['motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','service','pedestrian']

def road_graph(roads,street_nodes=()):
    uses=collections.Counter(str(n) for r in roads for n in r['nodeIds'])
    forced={str(n['id']) for n in street_nodes if n['tags'].get('highway')=='traffic_signals'}
    names=[''];nodes=[];links=[];sources=[];shape_ids=[];node_ids=[];indices={}
    def node(identifier,p):
        identifier=str(identifier)
        if identifier not in indices:
            indices[identifier]=len(nodes)//4;nodes.extend([p[0],p[2],0,0]);node_ids.append(identifier)
        return indices[identifier]
    for r in roads:
        if r['name'] not in names:names.append(r['name'])
        highway=r['highway'].removesuffix('_link')
        cls=CLASSES.index(highway) if highway in CLASSES else 8
        if r['mode']=='person':cls=9
        points=r['points'];ids=[str(n) for n in r['nodeIds']]
        split={0,len(points)-1}|{i for i,n in enumerate(ids) if uses[n]>1 or n in forced}
        if ids[0]==ids[-1] and len(split)==2:split.add(len(points)//2)
        cuts=sorted(split)
        for start,end in zip(cuts,cuts[1:]):
            shape=points[start:end+1]
            if sum(math.hypot(b[0]-a[0],b[2]-a[2]) for a,b in zip(shape,shape[1:]))<.1:continue
            a=node(ids[start],shape[0]);b=node(ids[end],shape[-1])
            raw_lanes=r.get('lanesTag') or ''
            lanes=int(raw_lanes) if raw_lanes.isdigit() and 1<=int(raw_lanes)<=10 else max(1,round(r['width']/3.25))
            flags=(4 if r['mode']=='person' else 0)|(1 if r['highway'].endswith('_link') else 0)
            links.append([a,b,names.index(r['name']),cls,r['width'],lanes,1 if r['oneway'] else 0,flags,[v for p in shape for v in (p[0],p[2])]])
            sources.append(r['id']);shape_ids.append(ids[start:end+1])
    attached=collections.defaultdict(list)
    for i,l in enumerate(links):attached[l[0]].append(i);attached[l[1]].append(i)
    for n,adj in attached.items():
        # A bend or the end of an OSM way is not automatically an intersection.
        if len(adj)>=3:nodes[n*4+3]=max(links[i][4]/2 for i in adj)+.5
    return {'names':names,'nodes':nodes,'links':links,'roadSourceIds':sources,'roadShapeNodeIds':shape_ids,'nodeSourceIds':node_ids}

def road_details(graph,street_nodes):
    nodes=graph['nodes'];links=graph['links'];segments=[];attached=collections.defaultdict(list)
    for li,l in enumerate(links):
        attached[l[0]].append(li);attached[l[1]].append(li)
        if l[7]&4 or l[3]>6:continue
        pts=list(zip(l[8][::2],l[8][1::2]))
        for a,b in zip(pts,pts[1:]):segments.append((li,a,b))
    def nearest(x,z):
        best=None
        for li,a,b in segments:
            dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz)
            if not length:continue
            t=max(0,min(1,((x-a[0])*dx+(z-a[1])*dz)/(length*length)))
            px,pz=a[0]+dx*t,a[1]+dz*t;d=math.hypot(x-px,z-pz)
            if best is None or d<best[0]:best=(d,li,px,pz,math.atan2(dx,dz))
        return best
    crossings=[];cross_meta=[];signal_members=collections.defaultdict(list);rejected=collections.Counter()
    index={identifier:i for i,identifier in enumerate(graph['nodeSourceIds'])}
    for row in street_nodes:
        t=row['tags'];x,z=row['x'],row['z']
        if t.get('highway')=='crossing':
            if t.get('crossing') in ('no','informal','unmarked') or t.get('crossing:markings')=='no':
                rejected['unmarked_crossing']+=1;continue
            match=nearest(x,z)
            if not match or match[0]>1.5:rejected['crossing_not_on_carriageway']+=1;continue
            _,li,px,pz,angle=match
            if any(math.hypot(c[0]-px,c[1]-pz)<5 for c in crossings):continue
            crossings.append([round(px,2),round(pz,2),round(angle,4),links[li][4]])
            cross_meta.append({'sourceId':'osm-node-'+str(row['id']),'roadSourceId':graph['roadSourceIds'][li],'method':'OSM-crossing-projected-to-mapped-road'})
        if t.get('highway')!='traffic_signals':continue
        ni=index.get(str(row['id']));method='OSM-node'
        if ni is None or len([li for li in attached[ni] if not links[li][7]&4])<2:
            candidates=[i for i,ls in attached.items() if len(ls)>=3 and sum(not links[li][7]&4 for li in ls)>=2]
            ni=min(candidates,key=lambda i:math.hypot(nodes[i*4]-x,nodes[i*4+1]-z)) if candidates else None
            if ni is None or math.hypot(nodes[ni*4]-x,nodes[ni*4+1]-z)>18:
                rejected['signal_without_usable_ground_node']+=1;continue
            method='OSM-signal-nearest-junction-within-18m'
        signal_members[ni].append({'sourceId':'osm-node-'+str(row['id']),'method':method})
    groups=[]
    remaining=set(signal_members)
    while remaining:
        group={min(remaining)};remaining-=group
        changed=True
        while changed:
            changed=False
            for j in sorted(remaining):
                if any(math.hypot(nodes[i*4]-nodes[j*4],nodes[i*4+1]-nodes[j*4+1])<45 and
                       any(j in links[li][:2] for li in attached[i]) for i in group):
                    group.add(j);remaining.remove(j);changed=True
        groups.append(sorted(group))
    signals=[[round(sum(nodes[i*4] for i in g)/len(g),2),round(sum(nodes[i*4+1] for i in g)/len(g),2),g] for g in groups]
    meta=[{'sources':[s for i in g for s in signal_members[i]],'timingSource':'visual-estimate:Taipei-two-phase-controller'} for g in groups]
    return {'crossings':crossings,'crossingMeta':cross_meta,'signals':signals,'signalMeta':meta,'detailRejected':dict(rejected)}
