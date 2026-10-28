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

当前生成 383 段道路、290 栋 OSM 建筑体量、4 片水域、16 个 500m 建筑块。数据快照为 2026-10-27 21:23:59 UTC。原始轮廓、道路方向、对象 ID 和来源标签由上海 PBF 导入器读取；局部坐标原点为 WGS84 `[114.293, 30.585]`，1 单位为 1 米，x 向东、z 向南。

当前建筑数据稀疏，**284 栋楼高为 12m 估值，5 栋由层数换算，1 栋直接读取高度**。沿用上海运行时的旋转矩形建筑体量，不能当成精确建筑形状。132 个矩形包围盒会挤占道路的建筑被排除；不以虚构建筑掩盖数据空白。

地面平坦，未接 DEM；19 条桥梁、隧道或非地面层级道路暂不开放。长江水面来自 OSM 面几何与内环，不用直线代替岸线；有 5 个源几何在导入时跳过，需后续专项核查。没有手工地标、武汉地铁数据或网约车任务。车辆造型沿用上海资源，尚未还原武汉实际车型与涂装。

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

Python 3.9+；Windows 可使用 `.venv/Scripts/python tools/build-wuhan.py`。生成器沿用上海的 OSM/pyosmium 提取逻辑，使用 Shapely 组装内外环、裁剪水域和道路，并输出上海运行系统的数据契约。`data/derived/wuhan.json` 是按源文件哈希检查的缓存，调试导入逻辑后可删除它重新生成。

## 后续顺序

1. 核查武汉江岸、道路宽度、缺失建筑与来源几何；改善沿江空间与出发视角。
2. 在原系统内改善建筑轮廓、补可靠建筑数据，逐项检查桥隧高差。
3. 逐步扩展武汉范围与地标；最后再参考 London Loop 加入接单、导航与任务。

## 测试与许可

```sh
npm test
npm run build
```

当前测试包含上海的通用控制器、碰撞、加载、材质、地图导航测试以及武汉的数据与出发点检查。`tests/` 中保留的其他上海专用验收测试不属于武汉的默认测试集；原始上海发布工具仅作参考，武汉使用 `tools/build-wuhan.py`。

代码保留上海项目和 mrdoob/Slop New York 的 MIT 声明，详见 [LICENSE](LICENSE)、[docs/upstream/SOURCES.md](docs/upstream/SOURCES.md) 与 `vendor/slop-newyork/`。地理数据库为 © OpenStreetMap contributors，采用 ODbL 1.0，见 [public/data/DATA-LICENSE.md](public/data/DATA-LICENSE.md)。
