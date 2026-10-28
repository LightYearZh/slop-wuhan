[out:json][timeout:120];(
way["highway"](30.576,114.2826,30.594,114.3034);
way["building"](30.576,114.2826,30.594,114.3034);
way["natural"="water"](30.576,114.2826,30.594,114.3034);
way["waterway"="riverbank"](30.576,114.2826,30.594,114.3034);
way["landuse"="reservoir"](30.576,114.2826,30.594,114.3034);
way["leisure"="park"](30.576,114.2826,30.594,114.3034);
way["landuse"~"^(grass|forest|meadow|recreation_ground)$"](30.576,114.2826,30.594,114.3034);
rel["type"="multipolygon"]["natural"="water"](30.576,114.2826,30.594,114.3034);
rel["type"="multipolygon"]["waterway"="riverbank"](30.576,114.2826,30.594,114.3034);
rel["type"="multipolygon"]["landuse"="reservoir"](30.576,114.2826,30.594,114.3034);
rel["type"="multipolygon"]["leisure"="park"](30.576,114.2826,30.594,114.3034);
);out geom;