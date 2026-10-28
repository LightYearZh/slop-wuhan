# 武汉核心区地理数据来源与许可

应用代码MIT不改变以下数据许可。整合地理数据库继续按ODbL 1.0提供，保留来源、参考年份、哈希与处理方法。

- © OpenStreetMap contributors，ODbL 1.0：https://www.openstreetmap.org/copyright 。湖北源：https://download.geofabrik.de/asia/china/hubei.html 。
- Overture Maps Foundation Buildings，固定2026-10-21.0提取，ODbL，保留每条sources上游标签：https://docs.overturemaps.org/guides/buildings/ 。
- 3D-GloBFP，Che, Y.等，2024，3D-GloBFP: the first global three-dimensional building footprint dataset，Earth System Science Data 16, 5357–5374，https://doi.org/10.5194/essd-16-5357-2024 。2020参考年份遥感模型高度，CC BY 4.0：https://creativecommons.org/licenses/by/4.0/ 。裁剪并匹配到OSM/Overture轮廓，原模型高度不是实测。湖北块：https://figshare.com/articles/dataset/28906499 ，file 54107378。元数据在data/source/globfp-source.json。
- Terrain Tiles / Mapzen；全球地形数据归属：global terrain data courtesy of the U.S. Geological Survey。分发与条款：https://registry.opendata.aws/terrain-tiles/ 、https://github.com/tilezen/joerd/blob/master/docs/attribution.md 。已裁剪、插值、滤波，并在两山声明包络中应用相对高差，非本地精密测绘。

江汉关、黄鹤楼、龟山电视塔、晴川阁平面来自OSM；外观为程序化简化表达，没有打包第三方照片或贴图。高度依据和视觉估计分开记录。桥梁工程高程、通用街具、立面和缺失楼高均含推断。

完整引用、版本、下载、重建和局限见docs/CORE_EXPANSION.md、public/data/wuhan-audit.json和public/data/runtime-audit.json。
