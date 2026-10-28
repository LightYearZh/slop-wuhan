"""Restore OSM vertical massing without extruding a whole podium to tower height."""
import collections
from shapely.geometry import Polygon
from shapely.strtree import STRtree
from shapely import make_valid
from building_attributes import height_from_tags

def rings(p):
    return [[[round(x,3),round(z,3)] for x,z in r.coords] for r in [p.exterior,*p.interiors]]

def apply_parts(buildings,parts,evidence):
    shapes=[make_valid(Polygon(b['rings'][0],b['rings'][1:])) for b in buildings]
    tree=STRtree(shapes);groups=collections.defaultdict(list);stats=collections.Counter();refs={r['osmId']:r for r in evidence['records']}
    for row in parts:
        top,source=height_from_tags(row.get('tags',{}));ref=refs.get(row['id'])
        if ref and row.get('name','')!=ref.get('expectedName',''):raise ValueError('Part reference identity mismatch: '+row['id'])
        if ref and ref.get('totalHeightM'):top=ref['totalHeightM'];source='reference:architectural-total'
        try:base=float(row.get('tags',{}).get('min_height',0))
        except (TypeError,ValueError):stats['invalid_base']+=1;continue
        if not 0<=base<top<=650:stats['missing_or_invalid_height']+=1;continue
        for rr in row['polygons']:
            p=make_valid(Polygon(rr[0],rr[1:]));candidates=[]
            for j in tree.query(p):
                j=int(j);overlap=p.intersection(shapes[j]).area/p.area
                if overlap>=.95 and shapes[j].area>p.area*1.01:candidates.append((shapes[j].area,j))
            if not candidates:stats['no_containing_parent']+=1;continue
            _,j=min(candidates);b=buildings[j]
            if b.get('massingParts'):stats['existing_reference_massing_retained']+=1;continue
            # Source outlines have small independent survey / simplification errors.
            # Clip to the selected parent so a tower cannot invade a reserved road.
            clipped=make_valid(p.intersection(shapes[j]))
            pieces=[clipped] if clipped.geom_type=='Polygon' else [g for g in clipped.geoms if g.geom_type=='Polygon']
            for piece in pieces:
                if piece.area<1:continue
                groups[j].append({'rings':rings(piece),'baseY':base,'h':top-base,'role':'tower' if top>35 else 'mapped-part',
                                  'sourceId':row['id'],'heightSource':source,'heightReference':ref.get('source') if ref else None,
                                  'heightNote':row.get('tags',{}).get('source:height') or row.get('tags',{}).get('height:source'),'facadeProfile':ref.get('facadeProfile') if ref else None})
    for j,rows in groups.items():
        b=buildings[j];original=b['h'];positive=[p['baseY'] for p in rows if p['baseY']>0]
        # Min-height is the mapped podium attachment; otherwise retain a low mapped
        # podium, rather than turning an entire compound footprint into a tower.
        podium=min(original,min(positive) if positive else 12)
        b['massingParts']=[{'rings':b['rings'],'baseY':0,'h':podium,'role':'podium','heightSource':b['heightSource'] if podium==original else 'visual-estimate:part-base-podium'},*rows]
        b['heightBeforeParts']={'h':original,'heightSource':b['heightSource']};b['h']=max(p['baseY']+p['h'] for p in b['massingParts'])
        b['heightSource']='OSM:parts-max';b['massingSource']='OSM:building-parts';b['heightEvidence']={'confidence':'source-parts;not-surveyed','sourceIds':[p['sourceId'] for p in rows]}
        stats['parents_restored']+=1;stats['rendered_parts']+=len(rows)
    return dict(stats)
