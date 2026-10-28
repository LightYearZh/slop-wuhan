# 武汉漫游 · Slop Wuhan 0.4.0

当前运行基础已切换为 [shwang1979/slop-taipei](https://github.com/shwang1979/slop-taipei)，复用其建筑与屋顶细节、街道、交通、角色、车辆、相机、地图、光照与音效系统。界面使用简体中文，地理内容使用武汉江汉路—沿江大道约 2×2 公里试验区。

台北参考仓库完整保存在 `../reference-taipei/`；上海参考仍保存在 `../reference-shanghai/`。上游版本见 [来源记录](docs/UPSTREAM.json)。上海运行版本保存在 `archive/shanghai-runtime-0.3.0` 分支，独立 Phase 0 保存在 `archive/standalone-pilot`。现有旧 `js/` 文件与测试暂时保留供数据工具和回退使用，当前网页入口是 `js/runtime/main.js`。

## 本地运行

需要 Node.js 22.12+。地理数据已经随仓库保存，日常浏览无需下载 PBF。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4799/ 。已有页面请刷新。

- `WASD` 移动，`Shift` 加速，鼠标拖动环顾。
- `1/2/3/4` 切换步行、汽车、踏板车、直升机；飞行时 `E/Space` 上升，`Q/C` 下降。
- `M` 打开地图，可搜索江汉路、沿江大道、江汉关等地点；地图点击传送。
- 顶部“传送”选择目的地；右下角相机菜单可选择江汉关、江汉路、江岸、汉口全景和空中环游。
- 顶部切换黄昏、正午、蓝调、夜晚，`N` 切换声音，`H` 隐藏界面。

## 这版实际做了什么

武汉源层保留 404 段道路、2,097 栋普通建筑、江汉关地标和 4 片水域。422 栋建筑轮廓来自 OSM，1,675 栋来自去重后的 Overture。源层有空间审计，保留对象 ID、院落、已有高度与文献依据。江汉关沿用已有简化模型；平安大厦保留裙房、塔楼、顶部三个体量，转换到台北运行接口后共 2,099 条建筑分部记录。

缺失高度的 2,081 栋在源层仍保留 12m 占位与缺失标记；**显示层改为按用途、面积和固定种子估算层数**，真实高度始终优先。推断高度不是逐栋实景数据，详见 `public/data/runtime-audit.json` 与生成模块的 `buildingMeta`。没有为了丰富度更改真实轮廓或添加虚构建筑。

立面、窗格、空调、屋顶设备、店面等复用台北的程序规则；建筑用途、现有资料与高度参与样式选择。212 条沿墙招牌记录混合源建筑名称与通用业态文字，外观及安装位置不是实测店招。通用细节仍保留上游风格，后续需继续校准为汉口建筑语言。

街树、路灯及停车候选使用武汉的建筑／水域／全路网／步行中部／其他街具统一避让。地面碰撞保留院落，地标坐标与专用景点相机换成武汉。没有导入台北地形、101、纪念堂或台北店名。车辆为上游简化模型，修改了文字与部分密度，尚非真实武汉车队。

## 数据重建与自动化

第一次在新机器生成需准备 Python 3.9+ 和湖北 PBF：

1. 从 https://download.geofabrik.de/asia/china/hubei.html 下载 `hubei-latest.osm.pbf`。
2. 放在项目 `data/hubei-latest.osm.pbf`。当前机器已有约 53MB 文件，不必重新下载。
3. 执行：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run data:build
npm run verify
```

`tools/build-wuhan.py` 保留上海来源的 PBF 提取和武汉合并、空间审计流程，输出可追溯源层。`tools/build-runtime.py` 接着转换为台北运行接口，生成 `js/runtime/wuhan-geodata.js`，分离源高度与显示推断。仅调整外观／显示规则可运行 `npm run data:runtime`。

固定版本 Overture 小范围提取已提交于 `data/source/overture-buildings.geojson`，不需要再次联网。来源快照：OSM 2026-10-27 21:23:59 UTC，Overture 2026-10-21.0。扩区入口仍是 `config/wuhan-pilot.json`，扩区前需要覆盖新范围的 Overture 文件，并验证新运行系统的性能。

## 验证与当前边界

`npm run verify` 运行 54 项 JavaScript 测试、13 项 Python 测试、源层空间审计和生产构建。包括保留的通用回归测试与新增的台北运行契约、来源／推断高度、建筑分部、路网方向及院落碰撞检查。还需浏览器验收实际加载、地图、模式和视角；构建通过不能替代画面验证。

当前仍是平地试验区，没有 DEM、跨江桥隧、武汉地铁或网约车任务；23 条非地面层级源道路未开放。台北运行系统将本试验区整体加载后分块合批／裁剪，**旧版 500m 流式加载不是当前运行路径**，不宜直接扩大全市。下一步先校准汉口普通建筑、店招与可靠楼高，再扩区。

代码保留 MIT 许可，来源见 [LICENSE](LICENSE)、[台北许可](docs/upstream/TAIPEI-LICENSE)、[运行系统迁移记录](docs/TAIPEI_RUNTIME_MIGRATION.md)。地理数据 © OpenStreetMap contributors、Overture Maps，见 [数据许可](public/data/DATA-LICENSE.md)。
