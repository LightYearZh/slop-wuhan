# 建筑属性与可复用街景规则 · 0.3.0

这轮保持原有汉口试验区范围，继续解决自动生成的质量，而不扩展面积。

## 属性保留与证据等级

OSM 导入器现在保留建筑用途、historic/heritage、start_date、原始高度/层数、屋顶等标签，并保留店铺、公共设施等 POI。只有 POI 确实落在建筑平面内时才关联，附近但不在楼内的店铺不强行挂靠。

高度区分：

- `OSM:height`：源 height/building:height。数字及米/英尺单位严格解析，异常值不截取数字冒充有效高度。
- `OSM:levels`：源层数 × 3.2m，记录楼层高度是假设。
- `reference:architectural-total`：有明确来源的建筑总高，不称为测绘屋顶高程。
- `reference:storeys-derived`：公开资料记载层数，再换算体量高度，仍属估算。
- `visual-estimate`：无资料，继续明确使用 12m 占位，不随机编造“真实楼高”。

用途与风格分开：OSM 明确用途、楼内 POI 和历史标签属于源证据；按住宅/商业用地推断的分类标为 `context-estimate:OSM-landuse`；没有依据的仍为 unknown。立面颜色、橱窗、门、檐线及屋顶材质均为通用视觉表现，不等同于实景采集。场景维持同一光照、操控与整体视觉体系。

## 可追溯的补充资料

`data/source/building-evidence.json` 按 OSM ID 与预期名称双重匹配，防止同名误套：

1. **佳丽广场／平安大厦**：江汉区政府转载长江日报记载总高 251m、59 层，地下至地上 8 层为商业部分。OSM 原始平面覆盖约 1.3 万平方米的建筑群，不能整片拉成 251m 高墙。生成器保留全部源平面作低裙楼，再生成内缩塔身及顶部退台。裙楼层高、塔楼位置、退台平面和比例为明确标记的体量估算，不能作为该楼精确模型使用。
   来源：https://www.jianghan.gov.cn/xwzx/mtbd/201808/t20180801_3416.shtml
2. **璇宫饭店**：武汉消防资料记载历史主体地上 5 层；以 3.6m 假设层高形成 18m 的主体体量。屋顶塔亭、后期改建和现状完整层数没有据此宣称还原。
   来源：https://www.thepaper.cn/newsDetail_forward_13355836

来源记录包含发布单位、日期和高度口径。未来新增可靠数据主要补充属性目录或导入器，而不是逐栋改渲染代码。建筑体量分层也同步进入碰撞，避免低裙楼上空出现覆盖整片平面的不可见高墙。

GlobalBuildingAtlas 也已查阅：其模型/高度目前有 CC BY-NC 4.0 部分，且属于机器学习推断。此次没有混入当前 ODbL 建筑层；并未用它来宣称已补齐武汉的精确高度。
参考：https://github.com/zhu-xlab/GlobalBuildingAtlas

## 通用生成器

- `tools/building_attributes.py`：高度解析、证据优先级、用途分类、楼内 POI 关联、体量组合、临街边线选择。
- `js/building-materials.js`：玻璃办公、浅色历史石材、商业、住宅、公建、灰色普通建筑等可复用外观预设。
- `js/building-frontages.js`：只沿朝向附近道路的源墙面生成首层入口、无品牌橱窗、招牌底板和檐线；不侵占路面。
- `js/footprint-buildings.js`：按分层体量生成几何与碰撞，保留真实外环与院落。
- `public/data/building-attributes-audit.json`：分类数量、分类来源、POI 关联、临街建筑数量及资料匹配记录。

大多数楼高依然缺失。街景多样性提高主要来自保留属性、分类与通用细节，并非已获得大量可靠新楼高；下一阶段仍需拓展许可兼容、可核查的高度来源。
