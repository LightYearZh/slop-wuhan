# 首个公开体验版与发布入口

更新日期：2026-11-01。应用版本：**0.8.5**。

| 入口 | 地址 |
| --- | --- |
| 在线体验 | https://lightyearzh.github.io/slop-wuhan/ |
| 公开源码仓库 | https://github.com/LightYearZh/slop-wuhan |
| 自动部署与安全检查 | https://github.com/LightYearZh/slop-wuhan/actions |
| 项目介绍、操作和来源 | [README](../README.md) |
| 部署配置与开发操作 | [开发说明](DEVELOPMENT.md#静态发布) |
| 公开前后敏感信息检查记录 | [安全检查记录](SECURITY_AUDIT.md) |

## 本次发布

2026-11-01发布首个公开体验版，版本号沿用 **0.8.5**，没有因为增加部署而提升应用版本。这里的“发布”指源码公开并通过 GitHub Pages 上线，**未另行创建 GitHub Release 或版本标签**。

- `7eb37d8`：公开版 README、截图和来源说明。
- `d23962e`：清理当前文件中的本机路径，加入敏感信息扫描与推送前检查。首次公开早于这次扫描，历史隐私元数据的边界见安全检查记录。
- `3d7c0e3`：加入 GitHub Pages 自动构建和部署。[首次部署成功记录](https://github.com/LightYearZh/slop-wuhan/actions/runs/41291382917)。
- `de0190a`：README补上已验证的在线体验地址；该次推送也触发了自动部署。

首次云端构建的安全扫描、111项JavaScript测试、静态构建和部署均通过。已在桌面Chrome打开正式HTTPS地址，确认场景完成加载、飞行方式切换、黄鹤楼传送及地图打开；传送后保留飞行方式。此项为线上基本检查，不代表全部设备或全区通行都经过完整游玩验收。

## 后续更新

推送到 `main` 自动执行 `.github/workflows/pages.yml`；也可从 Actions 手动运行 **Deploy Wuhan to GitHub Pages**。敏感信息扫描、测试、构建通过后只发布 `dist/`。失败时停止部署，已有站点保留。使用GitHub提供的短期部署凭据，不上传本机SSH私钥，不需要另配个人访问令牌。

公开地址保持不变，站点会跟随主分支更新；首个公开版的代码可根据上述提交追溯。录视频时记录所用应用版本，发布视频前再实测链接。版本更新、实际公网加载速度与本地测量结果分开表述。

## 视频简介可用信息

项目名：**Slop 武汉 · Wuhan Roam**。真实地理数据驱动、1:1水平距离的武汉核心区漫游原型，可步行、开车、骑行和飞行；当前还没有完整剧情、接单与计费任务。

在线体验：https://lightyearzh.github.io/slop-wuhan/  
源码：https://github.com/LightYearZh/slop-wuhan

建议使用支持WebGPU的桌面浏览器，首次进入需要加载地图并编译着色器。地图约4.34 MB、首次资源正文约4.98 MB是0.8.5本地测量口径，不是公网速度承诺。

保留Slop New York、上海、台北等来源署名与数据归属，详见README。口播可以说：“源码和在线体验的链接，我放在简介里。感兴趣可以自己进去开一开，也可以拿去改，试试做自己的城市。”
