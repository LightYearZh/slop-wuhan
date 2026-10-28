# 技术参考与差异

- [Slop New York](https://github.com/mrdoob/slop-newyork): 基础城市模拟、Three.js WebGPURenderer/TSL、建筑和道路管理、角色与车辆。下一阶段转入它的现成运行时。本阶段未复制源代码。
- [ShangHai](https://github.com/YakirLove/ShangHai): 原版 Slop 城市移植的中国实战。其 SOURCES.md 公开解释 OSM 固定缓存、缺失建筑估算、城市局部坐标、500m 块、平坦地形和无法验证的桥/隧通行。我们借鉴其来源可追踪、估算明确标注的策略，而不是把所有几何当真实地图。
- [London Loop](https://github.com/nelsonchris1/london-loop): OpenStreetMap 生成城市及交通玩法的改编。接送乘客、路网导航、公交任务属于 Phase 2。
- [Geofabrik Hubei](https://download.geofabrik.de/asia/china/hubei.html): OSM 最新湖北 PBF 快照下载。
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API): 小范围查询和速率限制。

## Phase 0 与最终 Slop Wuhan 的不同

这里先把 **来源正确、坐标正确、空间位置可视** 做成独立验证器，避免直接改造纽约道路数据时误把错误归因于渲染器。真正的 Slop 端口将在数据检查之后进行，承接原版交通/人物/WebGPU 系统。现有 WebGLRenderer 是验证设备，非最终引擎选型。

## 小范围样板的地理真实性层级

- A：OSM 可追溯 way 的道路和建筑轮廓。
- B：OSM `height` 或 `building:levels` 对应的楼高计算。
- C：没有楼高时的 12 米占位假设。
- 空白：没有数据的房屋不添加，不冒充真实信息。

如果发布公开网页，需要呈现 OSM 数据署名，以及核对 ODbL 对衍生数据库分享的要求。
