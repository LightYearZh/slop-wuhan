# 武汉漫游 · Slop Wuhan

本项目直接基于 [YakirLove/ShangHai](https://github.com/YakirLove/ShangHai) 改造，复用其 Three.js WebGPU/TSL、光照、建筑材质、角色、车辆、相机、碰撞、分块加载与中文地图系统。第一版覆盖汉口江汉路—沿江大道约 2 × 2 公里，使用真实武汉 OSM 数据。

原上海参考仓库完整保存在 `../reference-shanghai/`，保持独立 Git 历史。采用的版本见 [docs/UPSTREAM.json](docs/UPSTREAM.json)。原来的独立 Phase 0 验证器保存在当前仓库的 `archive/standalone-pilot` 分支；主分支开发路线已改为上海项目的武汉改编，不再继续独立造引擎。

## 本地运行

需要 Node.js 22.12+（本机为 24）。武汉生成数据已随项目保存，日常浏览无需下载原始 PBF。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4799/ 。也可以运行 `npm start`。旧地址 `/web/` 已停用。

- `1 / 2 / 3 / 4`：步行、驾驶、骑行、直升机。
- `W / S`：前后移动；`A / D`：转向；`Shift`：加速；拖动鼠标：环视。
- 飞行 `E / Q`：上升、下降；`V`：切换相机。
- `M`：地图。地点菜单可到达江汉路、沿江大道、中山大道、北京路、南京路和洞庭街。
- 右上角切换白天、黄昏、夜间或画质。

## 真实数据与当前限制

当前生成 **404 段道路、2,097 栋普通建筑体量、江汉关地标、4 片水域和 16 个 500m 建筑块**。普通建筑中 422 栋来自 OSM，1,675 栋来自去重后的 Overture Maps 补充轮廓，保持来源与原始 ID。OSM 快照为 2026-10-27 21:23:59 UTC；Overture 固定版本为 2026-10-21.0。

建筑采用原始多边形外环与内院生成，碰撞也跟随轮廓，不再用矩形包围盒替代整栋建筑。缺少高度的 **2,081 栋仍以 12m 估算**，另有 11 栋由 OSM 层数换算、3 栋读取 OSM 高度、2 栋补入文献总高或历史层数换算；补充轮廓并没有自动解决楼高问题。窗户、立面风格及屋顶材质是视觉表现，不是逐栋实景采集。

江汉关使用 OSM `way/128400530` 平面定位，以公开实景参考制作约 45.85m 的简化外观，包含石材主楼、8 根正面廊柱、四面钟盘与钟楼。地图搜索“江汉关”可到达建筑外的道路落点。比例与细部有视觉估算，不是文物测绘模型。主楼高度来源与差异记录在 [街景任务说明](docs/STREETSCAPE_PLAN.md)。

江汉路改为独立步行铺装，不绘制机动车道线；末段加入石带、树列、路灯、座椅等示意街具。街具数量与位置不是实测。道路优先读取 OSM width，或由 lanes × 3.25m 估算宽度，缺失时使用分类型估值。保留 OSM 节点 ID 的连通审计确认江汉路到沿江大道相连；全区仍包含裁剪边缘、孤立小径等多个连通分量，尚未逐处全部核查。

地面仍平坦，未接 DEM；23 条桥梁、隧道或非地面层级源道路暂不开放。没有武汉地铁数据或网约车任务，驾驶也尚未实现完整交通规则。车辆造型沿用上海资源。

完整统计、来源、SHA-256 和限制见 [public/data/wuhan-audit.json](public/data/wuhan-audit.json)。

## 重建武汉数据

首次下载已完成，原始湖北文件放在 `data/hubei-latest.osm.pbf`（约 53MB，未提交 Git）。如果换机器或需要你手动下载：

1. 打开 https://download.geofabrik.de/asia/china/hubei.html 。
2. 下载 **hubei-latest.osm.pbf**，不是 Shapefile ZIP。
3. 将文件放到项目 `data/` 目录，保持上述文件名。
4. 运行以下命令；不需要你手动裁剪、坐标转换或使用 Osmium 命令行。

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run data:build
npm test
npm run build
```

Python 3.9+；Windows 可使用 `.venv/Scripts/python tools/build-wuhan.py`。生成器沿用上海的 OSM/pyosmium 提取逻辑，使用 Shapely 组装内外环、裁剪水域和道路，并输出上海运行系统的数据契约。`data/derived/wuhan.json` 缓存同时检查源文件与导入器哈希，修改导入器后会自动重建。

Overture 的约 2MB 原始小范围提取及来源清单已随仓库提交，离线重建不需要再次联网。如需重新下载固定版本，使用 Python 3.12+ 单独建立下载环境：

```sh
python3 -m venv .data-venv
.data-venv/bin/python -m pip install -r requirements-download.txt
.data-venv/bin/overturemaps download --release=2026-10-21.0 \
  --bbox=114.2826,30.576,114.3034,30.594 -f geojson --type=building \
  -o data/source/overture-buildings.geojson
npm run data:build
```

详情见 [data/source/overture-source.json](data/source/overture-source.json)。公开实景照片只在本地作为造型参考，不作为应用贴图或随代码分发。

## 后续顺序

1. 补可靠楼高与建筑用途，改善重点街段的首层商铺、立面样式和屋顶层次。
2. 继续核查江岸、道路宽度和孤立路段，逐项恢复具有高程依据的桥隧。
3. 逐步扩展武汉范围与地标；最后再参考 London Loop 加入接单、导航与任务。

## 测试与许可

```sh
npm test
npm run build
```

当前 50 项 JavaScript 测试与 10 项 Python 数据规则测试包含多边形屋顶面积、内院碰撞、武汉数据来源与路网连通检查，以及上海的通用控制器、碰撞、加载、材质、地图导航测试以及武汉的数据与出发点检查。`tests/` 中保留的其他上海专用验收测试不属于武汉的默认测试集；原始上海发布工具仅作参考，武汉使用 `tools/build-wuhan.py`。

代码保留上海项目和 mrdoob/Slop New York 的 MIT 声明，详见 [LICENSE](LICENSE)、[docs/upstream/SOURCES.md](docs/upstream/SOURCES.md) 与 `vendor/slop-newyork/`。地理数据库为 © OpenStreetMap contributors，采用 ODbL 1.0，见 [public/data/DATA-LICENSE.md](public/data/DATA-LICENSE.md)。

## 自动化生成与空间检查 · 0.2.1

数据、普通建筑和街具按规则批量生成，江汉关为专门制作的地标外观。完整流程、纽约与上海的实现差异以及扩区入口见 [生成流程说明](docs/GENERATION_PIPELINE.md)。

新增统一空间规则，保留真实建筑、裁剪压楼的估算路面，暂时关闭并报告 3 处未经确认的穿楼地面段；街具避让所有相交道路、建筑、水面和其他街具。已生成地面路面与建筑相交面积为 0；这并不等于测绘级还原或所有交通关系已核实。

区域配置集中在 `config/wuhan-pilot.json`；扩区时需要匹配范围的补充建筑资料。生成和检查命令：

```sh
npm run data:build
npm run verify
```

`public/data/spatial-audit.json` 记录自动处理与待复核来源；运行时街具检查为 `window.wuhan.city.placement.audit()`。

## 建筑属性与自动临街表现 · 0.3.0

导入器进一步保留历史、年代、用途和楼内 POI。楼内 POI 与用地推断分别标记，按分类生成住宅、商业、公建、历史建筑等通用外观；210 栋建筑自动生成面向道路的首层细节，窗、门和招牌底板不代表逐店复原。

补充资料按 OSM ID 和名称双重匹配；佳丽广场（平安大厦）采用文献总高 251m，分为估算的裙楼/内缩塔身/顶部退台，璇宫饭店按文献记载的历史主体五层换算。两者已加入地点菜单，搜索“佳丽广场”可找到平安大厦。多数楼高依然未知，这次没有以随机高楼替代缺失数据。

详见 [建筑属性说明](docs/BUILDING_ATTRIBUTES.md) 和 `public/data/building-attributes-audit.json`；来源目录为 `data/source/building-evidence.json`。
