武汉试验区地理数据库源自 © OpenStreetMap contributors 与 Overture Maps Foundation，采用 ODbL 1.0。

- OSM 湖北源：https://download.geofabrik.de/asia/china/hubei.html
- Overture 建筑：https://docs.overturemaps.org/guides/buildings/
- 固定提取来源、版本、哈希与上游数据集来源标签：data/source/overture-source.json、data/source/overture-buildings.geojson。
- 构建来源与估算标签：wuhan-audit.json；路网审计：road-audit.json。
- 地标平面来自 OSM way/128400530；外观代码为基于公开实景的简化解释，非测绘数据。

生成器：tools/import-citywide.py、tools/build-wuhan.py、tools/road_audit.py。应用代码 MIT 不改变地理数据库的 ODbL 许可。Overture 原始数据集中每项 sources 字段保留其上游出处。
