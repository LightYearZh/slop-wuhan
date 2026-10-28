"""Topology diagnostics using retained OSM node IDs, with no guessed connectors."""
import collections, math


def audit_roads(roads,bounds,landmark):
    def graph_for(values):
        graph=collections.defaultdict(set);positions={};names=collections.defaultdict(set)
        for r in values:
            ids=r['nodeIds']
            for key,p in zip(ids,r['points']):positions[key]=(p[0],p[2]);names[key].add(r['name'])
            for a,b in zip(ids,ids[1:]):
                if a!=b:graph[a].add(b);graph[b].add(a)
        components=[];owner={}
        for node in graph:
            if node in owner:continue
            idx=len(components);stack=[node];owner[node]=idx;group=[]
            while stack:
                n=stack.pop();group.append(n)
                for nxt in graph[n]:
                    if nxt not in owner:owner[nxt]=idx;stack.append(nxt)
            components.append(group)
        return graph,positions,names,components,owner
    graph,positions,names,components,owner=graph_for(roads)
    car=graph_for([r for r in roads if r['mode']=='car'])
    terminal=[];boundary_ends=0
    for n,edges in graph.items():
        if len(edges)!=1:continue
        x,z=positions[n]
        if min(abs(x-bounds[0]),abs(x-bounds[2]),abs(z-bounds[1]),abs(z-bounds[3]))<2:
            boundary_ends+=1;continue
        near=[]
        for m,q in positions.items():
            if m==n or m in edges:continue
            d=math.dist((x,z),q)
            if d<4:near.append({'node':m,'distanceM':round(d,2),'roads':sorted(names[m])})
        if near:terminal.append({'node':n,'position':[x,z],'roads':sorted(names[n]),'nearbyUnconnected':sorted(near,key=lambda v:v['distanceM'])[:3]})
    jianghan={owner[n] for n in graph if any(name in ('江汉路','江汉路步行街') for name in names[n])}
    riverside={owner[n] for n in graph if '沿江大道' in names[n]}
    shared=bool(jianghan&riverside)
    return {'method':'Retained OSM node IDs; geometric crossings without shared nodes are not auto-connected',
        'walkableComponents':len(components),'largestWalkableComponentNodes':max(map(len,components),default=0),
        'carComponents':len(car[3]),'boundaryDeadEnds':boundary_ends,'nearbyUnconnectedEndpointCandidates':terminal,
        'jianghanToYanjiangConnected':shared,'guessedConnectors':0,
        'note':'Components include legitimate isolated paths and clipped edges. Candidate gaps require source review, not automatic snapping.'}
