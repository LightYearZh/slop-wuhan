"""Small, auditable local reconstructions; preserve OSM originals and mark human evidence."""
def pedestrian_road(road,review):
    match=next((r for r in review['pedestrianRoads'] if r['sourceId']==road['id']),None)
    if match is None:return road
    return {**road,'mode':'person','highway':'pedestrian','class':'local','oneway':False,
            'accessReview':{'original':{k:road.get(k) for k in ('mode','highway','class','oneway','widthTag')},
                            'source':'user-site-observation:2026-10-29','meaning':match['meaning'],'widthM':match['widthM']}}

def appearance_profile(item,review):
    match=next((b for b in review['appearanceBuildings'] if b['sourceId']==item['id']),None)
    if match is None:return None
    if item['name']!=match['expectedName']:raise ValueError('Streetscape identity changed: '+item['id'])
    return match
