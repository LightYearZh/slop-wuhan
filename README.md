# Slop Wuhan — Phase 0 / 武汉漫游数据与基础三维原型

本工程是 **Slop Wuhan 的第一阶段验证包**：以真实 OSM 道路及建筑占地为骨架，在浏览器中以 1:1 米制尺度展示汉口江汉路—沿江大道周边初始三维场景，并支持步行和飞行查看。

> **范围边界：** 这是独立 Three.js 数据验证器，**不是已经移植完成的 mrdoob/slop-newyork 原版运行时**。下一步才把通过验证的武汉地理数据接入 Slop 的 WebGPU/TSL、车辆和场景系统。打车玩法暂不实现。
>
> **真实数据边界：** 本包不内置武汉 OSM 数据。运行导入命令后才会生成 `web/data/city.json`。没有联网或缺失数据时，场景会显示“需要先导入 OSM”，不会伪造城市。

## 0. 先决条件

- macOS / Windows / Linux，Python 3.10+，Node.js 20+，npm。
- Chrome / Edge；本原型使用 Three.js WebGLRenderer，后续 Slop 原版将使用 WebGPU。
- 首次 `npm install` 需要联网；获取 OSM 也需要联网，或者手动下载 Geofabrik PBF。

## 1. 最快捷方式：Overpass 在线提取

```bash
cd slop-wuhan-phase0
python3 tools/fetch_osm.py
python3 tools/convert_osm.py --input data/wuhan_overpass.json
python3 tools/validate.py
npm install
npm run start
```

访问 `http://127.0.0.1:4799/web/`。

Windows PowerShell 将上述 `python3` 替换为 `py -3` 或 `python`，具体取决于安装方式。

**操作：** 点击画面锁定鼠标；鼠标环视，WASD 移动，Shift 加速，F 切换步行/飞行，飞行时 Space 上升、C 下降，Esc 释放鼠标。

首次提取使用预设范围（WGS84）：

- 南 `30.576`，西 `114.2826`，北 `30.594`，东 `114.3034`
- 约 2.0 × 2.0 公里，覆盖江汉路及向沿江大道的区域（实际几何覆盖以 OSM 返回为准）
- 中心经度纬度约 `114.2930, 30.5850`；不使用 GCJ-02/BD-09

若端点返回限流／网络错误，等待再试，或采用下一节离线流程。程序包含多端点回退，但不应大规模并发查询公共 Overpass 服务。

## 2. 更可靠的方式：Geofabrik 湖北 PBF + Osmium

1. 从 Geofabrik 下载湖北数据： https://download.geofabrik.de/asia/china/hubei.html
2. 安装 Osmium 命令行工具： https://osmcode.org/osmium-tool/
3. 执行（PBF 放在 `data/hubei-latest.osm.pbf`）：

```bash
osmium extract --bbox=114.2826,30.576,114.3034,30.594 --strategy=complete_ways data/hubei-latest.osm.pbf -o data/wuhan-cut.osm.pbf
osmium cat data/wuhan-cut.osm.pbf -o data/wuhan-cut.osm
python3 tools/convert_osm.py --input data/wuhan-cut.osm
python3 tools/validate.py
```

如果 `osmium` 命令提示输出已存在，可先删除以前生成的 `wuhan-cut` 文件再重试。`complete_ways` 会保留途经 AOI 的完整 OSM way，因此可略微超出场景边界。

**注意：** Geofabrik 湖北数据是整个湖北省，千万不要把 PBF 直接送入浏览器。请在本地裁剪后转换为静态 JSON。OSM XML 转换支持普通 `way` 和可拼接的 multipolygon 外环，但仍未处理洞孔和不完整的 relation。

## 3. 数据流和文件

```text
OSM Overpass JSON / Geofabrik PBF
  -> tools/fetch_osm.py (仅 Overpass 方式)
  -> osmium extract/cat (仅 PBF 方式)
  -> tools/convert_osm.py
  -> web/data/city.json + report.json
  -> web/main.js (500m 地块几何批处理、建筑体量、道路、水面、步行/飞行)
```

`data/source.json` 由 Overpass 下载流程生成，记录源、时间和查询内容。`web/data/report.json` 记录统计与模型缺陷。原始 OSM 下载数据请自行保留以确保可复现。

## 4. 已实现 / 未实现

### 已实现

- WGS84 转本地米制 `x=东，z=南`，以江汉路片区为原点。
- 真实 OSM 普通道路、步行街、部分建筑占地、水面及绿地处理；模型体量和道路宽度可视化。
- 解析 `height` / `building:levels`，无高度数据的建筑暂时使用 **12m 视觉占位值**，并记录来源。
- 基于 500m 网格对渲染几何进行批次合并，支持相机漫游。
- 批量数据有效性检查和 Python 单元测试。

### 尚未实现（不要误当成成品）

- **不是 Slop New York 原版引擎的直接武汉移植**。车辆、NPC、WebGPU/TSL 材质等将在下阶段集成。
- 目前平坦地面，不是武汉真实 DEM；没有桥梁、隧道、立交高差和精确岸线高程。
- 支持拼接 multipolygon relation 的外环，但暂未正确绘制内环（岛屿/孔洞）；复杂关系仍可能缺失或有误。长江水体必须通过实际数据质量检查。
- 高度数据缺失时是估算值；没有凭空补不存在于 OSM 的建筑轮廓，因而可能看到大片空白。
- 未处理准确建筑洞孔、楼顶轮廓、纹理与特色地标。
- 没有物理碰撞、可导航路网和接送乘客任务。

## 5. 后续移植到 Slop 的集成任务

- 阶段 1a：完成真实数据导入检查，完善 OSM multipolygon 水面孔洞和地图边界，并生成数据质量报告。
- 阶段 1b：审查 Slop 原版 `geo-*`、`buildings.js`、`road-network.js`，编写 Wuhan adapter，复用原来的角色和自由漫游系统。不要强行移植曼哈顿专用的道路网格逻辑。
- 阶段 1c：为有缺口的建筑引入 Overture 建筑轮廓；保持来源许可与高度可信度标签。
- 阶段 1d：引入具有合法使用许可的高程 DEM；用桥隧层级恢复立交，避免公路与江面穿插。
- 阶段 2：以伦敦项目为参考，增添网约车和任务系统（此时才进入游戏性）。

## 6. 许可与出处

- 本原型的新增脚本与实现代码为 MIT（见 LICENSE）。
- 真实地理数据来自 © OpenStreetMap contributors，ODbL 1.0。公开发布派生数据库时必须遵守 ODbL 相应要求。地理数据不因为应用代码 MIT 就自动变为 MIT。
- 参考项目： [mrdoob/slop-newyork](https://github.com/mrdoob/slop-newyork)（MIT）、[YakirLove/ShangHai](https://github.com/YakirLove/ShangHai)（MIT）、[Nelsonchris1/london-loop](https://github.com/Nelsonchris1/london-loop)（MIT）。本阶段没有复制这些项目源代码；只参考了公开架构思路。

## 7. 测试

```bash
python3 -m unittest discover -s tests -v
python3 tools/validate.py
```

第一次运行 `validate.py` 前需取得真实数据。以上脚本不会测试浏览器 WebGL 实际绘制，须人工在本机启动浏览器验证。
