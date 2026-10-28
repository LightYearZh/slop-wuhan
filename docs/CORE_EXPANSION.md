# 0.5.0 两江三镇扩区与多源数据

日期：2026-10-28。保持真实位置和1:1距离，不压缩街区。扩展前干净的8f6de1c保存为baseline/0.4.1-hankou标签，没有制造空提交。

## 范围

config/wuhan-core.json：WGS84边界[114.252,30.54,114.336,30.5942]，原点[114.293,30.585]；8056.9×6008.7m、48.412km²，约4:3。保留原试验区，加入两江交汇和一桥两山；不追求本版覆盖二七滨江与鹦鹉洲大桥。

## 数据源与重建

1. OSM / Geofabrik湖北PBF：2026-10-27T21:23:59Z，SHA256为9ac8ca95008e29dcbdd7d247b7056cf71badcbb7c8744f3df2a651204f2ef087。保留真实节点ID、单向与层级。
2. Overture Buildings：2026-10-21.0版，同一边界，24,719候选。参数在overture-core-buildings.geojson.state，OSM优先去重，最终补充20,316栋。
3. 3D-GloBFP：Che等，2024，3D-GloBFP: the first global three-dimensional building footprint dataset，ESSD 16, 5357–5374，https://doi.org/10.5194/essd-16-5357-2024 。2020参考年份，CC BY 4.0。Figshare版本3：https://figshare.com/articles/dataset/28906499 ，湖北2322块：https://ndownloader.figshare.com/files/54107378 。ZIP校验和2ed38cc3dd7d91fc01d0f683d996b2bc235e42dc3cfab80a382d12bddde0e592。PRJ为WGS84，Height字段单位米，没有用途或立面属性。
4. Terrain Tiles / Mapzen / USGS全球高程：https://registry.opendata.aws/terrain-tiles/ ，原始块https://elevation-tiles-prod.s3.amazonaws.com/skadi/N30/N30E114.hgt.gz 。校验和、采样、网格尺寸保存在data/source/wuhan-core-terrain.json。条款和归属：https://github.com/tilezen/joerd/blob/master/docs/attribution.md 。不是武汉精密测绘资料。

Overture提取命令：

```sh
overturemaps download --bbox=114.252,30.54,114.336,30.5942 -r 2026-10-21.0 -f geojson -t building -o data/source/overture-core-buildings.geojson
```

从原始包重新裁剪：ZIP放data/reference/3d-globfp/hubei-2322.zip，并在同目录解压全部五个同名文件；HGT放data/reference/terrain/N30E114.hgt.gz。运行npm run data:prepare，再运行npm run data:build。大包忽略于Git；裁剪结果随仓库保存，普通构建不需要原始大包。

## 高度融合与质量观察

不凭最近中心点配楼。候选要求IoU≥0.65、面积比≥0.7、中心距离≤12m且≤面积平方根的1/4；前两候选IoU差不足0.15拒绝。保留候选ID、距离、IoU、年份、许可、方法和原高度证据。

34,710个裁剪候选中，20,140栋与现有轮廓通过匹配，2栋因歧义拒绝。20,127栋缺高时采用模型值，13栋保留已有层数换算；其余继续保留原证据或显示估算。不新增2020旧轮廓去覆盖2026轮廓。

**匹配率不是高度精度。** 13栋有层数换算的非随机小样本，绝对差中位数8.72m、均值29.42m；层数换算也不是独立实测真值，不能作为武汉总体误差指标。万达环球国际中心万达尊B座38层换算121.6m，而模型9.412m，已保留前者。高层低估仍明显，本轮只是可追溯的估计层试验，不能称为2万栋可靠楼高。

龟山电视塔OSM的311.4m标签与官方塔高221.2m、海拔标高311.4m冲突，专属地标按221.2m塔高建模，来源：https://www.wuhan.gov.cn/zjwh/whly/202602/t20260215_2730613.shtml 。黄鹤楼按官方51.4m，平面来自OSM，装饰尺寸估计：https://english.wuhan.gov.cn/travel/tourist4attractions4an4incomplete4list/202110/t20211026_1819226.shtml 。晴川阁18m仍为估计。

## 地形与桥梁

原始HGT裁成25m采样网格，保留绝对样本。显示层启用龟山、蛇山附近两条声明的山脊包络：3×3中值滤波，扣除24m估计低地基准，水域置零，边缘平滑。包络是视觉处理边界，不是测绘山界；25m采样不代表25m精度。全城DEM、精确堤岸高差与隧道尚未解决。

山体、建筑和地标基础、道路、人物碰撞共用双线性高度采样。坡面附近多边形细分50m，避免大三角穿山；道路折线保留源节点。远近细节管理不改变地理位置。

恢复三座桥及源节点连通的桥头高架，共26源段。所有汽车桥段接入主体汽车路网；全区仍有孤立分量，未虚构连接线。桥面与150m显示坡道为工程形态估计；共享节点高程一致。未核实的其他高架与隧道仍排除并计数，没有压成平地。

继承台北桥面、护栏和桥墩生成器，添加长江大桥下层钢桁架简化轮廓。黄鹤楼、电视塔、晴川阁为程序化简化模型；江汉关保留。不是精确测绘复原。

## 性能和未完成项

当前一次构建静态核心区，再按空间和距离裁剪；未声称恢复旧500m按需加载。生成模块约45MB，生产主包压缩约8MB；移除原始地理模块的重复预加载。

普通历史建筑专属立面、桥头精确坡度、全城DEM、武汉本地屋顶设施、其余高架隧道与低配置设备按需加载仍需完善。GABLE、CNBH和Overture Places未接入，不能记为本版增量。短时帧率不代表全区域或其他设备性能。
