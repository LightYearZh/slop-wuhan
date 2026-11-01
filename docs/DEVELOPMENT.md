# 开发与数据重建

普通游玩与静态构建只需要Node.js，见[README](../README.md)。生成数据、图形依赖和当前压缩地图包均随源码保存。

## 检查

首次开发请运行 `npm run security:setup` 启用本仓库的推送前敏感信息检查；日常可运行 `npm run security`。范围、限制与报告说明见[安全检查](../SECURITY.md)。

```sh
npm test
npm run build
```

包含数据规则与空间审计的完整检查还需要Python环境：

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm run verify
```

当前0.8.5记录为111项JavaScript测试、44项Python测试，另有空间审计及浏览器实测；这是该版本的结果，不代表未来所有变更自动通过。

## 从已有城市数据重新打包

```sh
npm run data:runtime
```

从 `public/data/city.json` 重建运行包与审计；输出 `js/runtime/wuhan-geodata.js` 和 `js/runtime/wuhan-geodata.bin.gz`。需保留两者的版本一致，不要单独替换压缩包。WUH1打包保持坐标、孔洞、楼高等运行字段精度，见[加载格式](LOADING_OPTIMIZATION.md)。

## 重建地理数据

湖北PBF体积较大，未纳入Git。准备固定原始文件 `data/hubei-latest.osm.pbf` 后：

```sh
npm run data:build
npm run verify
```

默认区域是 `config/wuhan-core.json`。Overture、3D-GloBFP和高程的裁剪结果随仓库提供；从原始大包准备这些裁剪文件时使用 `npm run data:prepare`。数据来源、文件位置、校验和与下载方法见[扩区记录](CORE_EXPANSION.md)。

旧试验区 `config/wuhan-pilot.json` 用于历史复现。`WUHAN_PROFILE=config/wuhan-pilot.json npm run data:build` 会把当前生成数据替换成旧区域，执行前先保存现有工作；完整版本回退优先使用Git基线。

## 入口与来源

- 当前应用入口：`js/runtime/main.js`。
- 武汉地理适配：`tools/build-wuhan.py`、`tools/build-runtime.py`。
- 历史建筑参数：`config/hankou-heritage.json`；江汉关邻近街区的人工校正单独记录。
- 地图范围：`config/wuhan-core.json`。每单位1米，WGS84原点保持不变。
- 当前运行系统源于台北；早期上海版和独立验证器分别保留在 `archive/shanghai-runtime-0.3.0`、`archive/standalone-pilot`。
- NY参考库的近期加载优化版本、各基线见 [UPSTREAM.json](UPSTREAM.json)。`docs/upstream/SOURCES.md`是上海旧基线的继承说明，其中上海范围和数据限制不代表当前武汉数据。
- 当前武汉源码不包括完整外部参考仓库目录，它们不是本地运行的必要条件。引用和许可保存在本仓库。

## 静态发布

`npm run build`输出`dist/`，相对资源路径支持项目子目录部署。必须同时发布代码块、压缩地图资产、样式和公开数据归属文件。

GitHub Pages使用仓库的 `.github/workflows/pages.yml` 自动发布：推送到 `main`，或在 Actions 中手动运行 **Deploy Wuhan to GitHub Pages**。发布前先扫描敏感信息、安装锁定依赖、运行 JavaScript 测试并构建，只上传 `dist/`。构建或扫描失败时不会部署，已有线上版本保留。

仓库 Settings → Pages 的 Source 需为 **GitHub Actions**。部署使用 GitHub 自动提供的短期凭据，不需要配置个人访问令牌或上传本机 SSH 私钥。Pages 发布写权限只授予部署任务。Vite 的相对资源路径支持 `/slop-wuhan/` 项目子目录；地图包通过模块相对 URL 加载。

查看 [Actions 发布记录](https://github.com/LightYearZh/slop-wuhan/actions)，确认部署成功后，再检查页面初次进入、载具切换、地标传送与地图。GitHub Pages 上的实际加载速度与本地测量不同。

## 工作记录

[项目历程](PROJECT_HISTORY.md) · [城市工作流程](CITY_WORKFLOW.md) · [加载优化验收](LOADING_OPTIMIZATION.md) · [江汉关修正](acceptance/jianghanguan-context/README.md)
