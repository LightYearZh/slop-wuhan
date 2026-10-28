import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),dir=path.join(root,'docs/acceptance'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const car=read('car-performance.json'),modeIds=['person','cyclist','helicopter'],modes=modeIds.map(id=>read('modes/'+id+'.json')),cold=read('cold-start.json'),life=read('lifecycle.json'),stable=read('stability.json'),geo=read('geography.json'),shots=read('screenshots.json'),landmarkShots=read('landmark-screenshots.json'),visual=read('visual-review.json'),net=read('network-audit.json'),release=read('release-audit.json'),build=read('builds/final.json');
const operation=read('four-modes-operation.json');if(!operation.done||operation.error||operation.steps.length!==4)throw Error('Incomplete four-mode video proof');
const suite=read('suite-progress-final.json'),reproduction=read('source-reproduction.json'),dataAudit=JSON.parse(fs.readFileSync(path.join(root,'docs/data-audit.json')));
if(visual.needsRetake?.length)throw Error('Unresolved visual evidence retakes');
if(!suite.done||suite.error||reproduction.status!=='passed')throw Error('Final build suite or source reproduction is incomplete');
const f=n=>Number(n).toFixed(2),link=(label,name)=>`[${label}](${path.join(dir,name)})`,pic=(label,name)=>`![${label}](${path.join(dir,name)})`;
const runs=[{name:'汽车',id:'car',...car},...modes.map((m,i)=>({name:['步行','骑行','直升机'][i],id:modeIds[i],...m}))];
if(runs.some(r=>r.buildAsset!==build.asset||r.sampleDuration<300000||r.metrics.p95>33.3||r.errors?.length||r.metrics.errors.length))throw Error('A required mode/performance check failed');
const startup=cold.runs.map(r=>r.operableMs).sort((a,b)=>a-b);if(startup.some(v=>!Number.isFinite(v))||startup[1]>15000)throw Error('Missing/failed navigation-to-operable cold-start evidence');
if(stable.buildAsset!==build.asset||life.buildAsset!==build.asset||stable.duration<1800000||stable.errors.length||stable.visibilityChanges.length||shots.length!==18||landmarkShots.length!==16||net.externalRequests.length||net.failedResources.length)throw Error('Incomplete acceptance evidence');
const drives=fs.readdirSync(path.join(dir,'drives')).filter(n=>n.endsWith('.json')).map(file=>({file,...read('drives/'+file)}));
const clips=[];for(const d of drives.filter(d=>d.buildAsset===build.asset&&d.record)){const p=path.join(dir,'recordings',d.label+'.json');if(!fs.existsSync(p))continue;const clip=JSON.parse(fs.readFileSync(p));if(!clip.errors.length&&clip.duration>=d.duration/1000*.97&&d.errors.length===0){if(!fs.existsSync(path.join(dir,'recordings',d.label+'.mp4')))throw Error('Missing encoded video '+d.label);clips.push({...d,clip});}}
for(const direction of ['east','west'])if(clips.filter(d=>d.direction===direction).length<3)throw Error('Fewer than three complete recordings for '+direction);
if(!clips.some(c=>c.direction==='east'&&c.groundApproach)||!clips.some(c=>c.direction==='west'&&c.groundApproach))throw Error('Missing physical ground-to-bore-to-ground driving evidence');
const labels={east:'浦西→浦东',west:'浦东→浦西'},times={midday:'白天',golden:'黄昏',midnight:'夜间'};
const summary={version:'0.1.0',technicalStatus:'已列核心技术验收通过',contractStatus:'有保留：普通路网完整方向/层级属性未取得，普通楼宇有程序补齐，最终人工美术验收待用户确认',build,hardware:{model:'MacBook Pro Mac14,9',chip:'Apple M2 Pro',memoryGB:16,macOS:'27.0.1',tabbit:'1.18.21.0',chromium:'154.0.8037.58',node:'23.11.0',renderer:'WebGPU',quality:'medium',canvas:[1920,1080],rendererDPR:1},geography:{controls:geo.count,maxSelectedSourceErrorM:geo.maxErrorMetres,landmarks:8,sourcedBuildingFootprints:dataAudit.realBuildings,proceduralBuildings:dataAudit.proceduralBuildings},performance:runs.map(r=>({name:r.name,sampleSeconds:r.sampleDuration/1000,frames:r.metrics.frames,p50:r.metrics.p50,p95:r.metrics.p95,p99:r.metrics.p99})),coldStart:{runsMs:cold.runs.map(r=>r.operableMs),medianMs:startup[1],network:cold.network},stabilityMinutes:stable.duration/60000,completeDrivingRecordings:clips.map(c=>c.label),screenshots:shots.length,landmarkScreenshots:landmarkShots.length,lifecycleRounds:life.measuredRounds,releaseFiles:release.manifestFilesVerified,externalRequests:net.externalRequests.length,sourceReproduction:{passed:true,filesCompared:reproduction.filesCompared,citySHA256:reproduction.regeneratedCitySHA256}};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
const table=runs.map(r=>`| ${r.name} | ${f(r.sampleDuration/1000)} s | ${r.metrics.frames} | ${f(r.metrics.p50)} | ${f(r.metrics.p95)} | ${f(r.metrics.p99)} | 通过 |`).join('\n');
const routeTable=clips.map(r=>`| ${r.label} | ${labels[r.direction]}／${times[r.time]} | ${f(r.duration/1000)} s | ${f(r.maxCrossTrack)} m | ${f(r.minCameraClearance)} m | ${r.groundApproach?'地面驶入／驶出':'入口起步'} | ${link('录像','recordings/'+r.label+'.mp4')}／${link('轨迹','drives/'+r.file)} |`).join('\n');
const rows=life.rounds.slice(-5).map(r=>`| ${r.round} | ${r.tiles} | ${r.memory.geometries} | ${r.memory.attributes} | ${r.memory.uniformBuffers} | ${r.memory.textures} | ${f(r.memory.total/1048576)} MiB |`).join('\n');
const md=`# 上海漫游 0.1.0 验收报告

本地可玩版和静态包已交付，下面列出的核心玩法、跨江、加载、性能和稳定性检查已执行。**完整合同仍有保留：源缓存缺失普通道路方向与桥隧层级；最终画风与城市辨识度需用户按截图做人工确认。** 没有把这些项目标为已核验。

## 环境与版本

MacBook Pro／Apple M2 Pro／16 GB，macOS27.0.1，Tabbit1.18.21.0（Chromium154.0.8037.58）。WebGPU、中档、实际画布1920×1080、renderer DPR=1；全程前台。Node23.11.0，Vite8.3.5，Three.js187dev固定revision。最终构建 ${build.asset}，SHA256：\`${build.sha256}\`。

正式四模式性能、连续运行、六次双向驾驶与资源往返均在上面同一个最终构建执行。最终版本包含完整车体碰撞、地下镜头与加载修复、近处人车池和上海夜景倒影。早期构建与压力／工具中断记录保留在builds和technical-trial，不把它们混入最终通过数字。Tabbit站点缩放90%，通过viewport仿真得到实际1920×1080画布；截图为原生clip输出，没有改图补景。

## 验收逐项结果

| 项目 | 结果和证据 |
|---|---|
| 地理 | ${dataAudit.realBuildings}个源建筑轮廓＋${dataAudit.proceduralBuildings}个程序补建筑，不能解释为真实唯一楼栋覆盖率。${geo.count}个控制点，独立ECEF→ENU对照最大${f(geo.maxErrorMetres)}m；只针对选定源。${link('控制点CSV','control-points.csv')}、${link('叠合图','geography-overlay.svg')}、${link('审计JSON','geography.json')} |
| 地标 | 8个独立模型，普通楼宇预留排重；16张近远截图，4塔轮廓逐项检查。${link('视觉检查','visual-review.json')} |
| 画风 | 6固定机位×白天／黄昏／夜间=18图，复用原站程序立面、玻璃、光照、角色和后处理；差异见下文。最终人工美术确认待用户进行 |
| 双向过江 | 两方向各至少3段完整视频，实际物理控制，无途中位置重设；轨迹包含连续负高程、表面ID与相机位置 |
| 分层／碰撞 | 地面和地下按高度分离；洞壁夹框按真实洞线，车体含后视镜／号牌。${link('车体夹具','vehicle-wall.json')}、${link('地下回归','underground-regressions.json')} |
| 四模式 | 步行、汽车、骑行、飞行均实际操作超过5分钟，切换、停止与镜头操作通过；非汽车模式禁止在洞中切换 |
| 地图／昼夜 | 8个地标搜索和安全落点、位置标记、三档时间、三相机、输入不驾驶、Escape关闭搜索并归还焦点。${link('四模式操作录像','recordings/four-modes-release.mp4')}、${link('操作与停止记录','four-modes-operation.json')}、${link('交互','interactions.json')}、${link('落点','landings.json')}、${link('键盘','map-keyboard.json')} |
| 加载异常 | 注入失败保留有效位置，可重试；新跳转优先；显式加载lease、跨界180m碰撞halo与空水域块通过。${link('跳转回归','arrival-regressions.json')}、${link('移动门控','loading-gate.json')} |
| 性能 | 四模式预热后有效样本均超过300秒，P95≤33.3ms，见下表及原始帧数据 |
| 冷启动 | 50Mbps／80ms RTT、清站点数据且绕过HTTP缓存，导航开始到可操作中位数${f(startup[1]/1000)}秒，目标≤15秒。${link('3次原始记录','cold-start.json')} |
| 稳定／资源 | 连续${f(stable.duration/60000)}分钟，无应用错误、页面隐藏、崩溃、黑屏或控制丢失；2轮预热+10次往返资源检查，见下表 |
| 发布 | ${release.manifestFilesVerified}个文件哈希核对、${release.necessaryFilesServed}个必要HTTP资源成功；游玩无外部请求。${link('发布审计','release-audit.json')}、${link('网络','network-audit.json')} |
| 测试 | 根目录23/23；固定上游97/97。${link('上海测试日志','tests-shanghai.log')}、${link('上游测试日志','tests-upstream.log')}、${link('独立审查与修复','code-review.md')} |
| 源码复现 | 干净目录npm ci、23项测试、源数据再生成与Vite构建通过，${reproduction.filesCompared}个运行文件逐字节一致。Python复用已锁定依赖的现有虚拟环境。${link('复现记录','source-reproduction.json')}、${link('日志','source-reproduction.log')} |

## 帧耗时

性能采样与证据录像分开：汽车排除首10秒预热，其余连续样本超过5分钟；步行先30秒预热，前25秒仅作功能录像。骑行与飞行在从未开启录屏的新页面中预热30秒，再连续采样301秒。每一帧保留原始数值。

| 模式 | 有效采样 | 帧数 | P50 ms | P95 ms | P99 ms | 目标 |
|---|---:|---:|---:|---:|---:|---|
${table}

${pic('四模式性能','performance.png')}

${link('汽车原始帧','car-performance.json')}、${modeIds.map(id=>link(id+'原始帧','modes/'+id+'.json')).join('、')}。

高频CDP录屏压力试验曾使夜间长路线P95升至65.04ms；最终西向黄昏的录屏与后台编码并行时P95为47.64ms，**这些结果未作为正式无录屏性能通过依据**。停录屏后10秒窗口回到20.81ms；正式无录屏汽车样本见上表。压力数据和A/B数据保留，后续证据使用每12帧采样的低频录像，不以录像编码帧率代替应用帧率。${link('压力路线','drives/east-2-midnight.json')}、${link('A/B恢复','recording-cost-recovered.json')}、${link('最终西向录屏轨迹','drives/west-golden-release.json')}。

正式汽车采样时系统同时运行其他开发任务，环境快照保留在${link('environment-load.json','environment-load.json')}；没有关闭用户进程，也没有从采样中删除慢帧。P99一并列出，达到P95目标不代表持续60fps。骑行曾在前一个长测会话测得P95 44.04ms未达标，该失败样本和短时对照均保留；没有把降低画质或隐藏人车的诊断结果作为通过依据。后续仅在恢复中档、完整人车和界面后进行新页面无录屏复测。${link('骑行失败原始帧','technical-trial/cyclist-foreground-failed.json')}、${link('短时对照','technical-trial/cyclist-ab-notes.json')}。

## 连续驾驶证据

路线地理端点均接入地面道路，四处路面接缝高差0m。纵断面／净高是已标记的视觉估算，不是测绘结果。轨迹按约200ms采样；入口菜单只用于开始每次测试，通行中没有调用跳转。

| 记录 | 方向／时段 | 连续时长 | 洞线横向偏离 | 最小相机顶板余量 | 起终点 | 文件 |
|---|---|---:|---:|---:|---|---|
${routeTable}

本表只计最终构建的六段完整录像。黄昏两趟从真实源道路的外侧点起步，使用正常路面采样驶入，再驶出到另一岸地面道路；未预先给车辆指定隧道表面，表面切换的最大单步高差为${f(Math.max(...clips.filter(c=>c.groundApproach).map(c=>c.maxTransitionStep)))}m。地面连接源道路ID保留在轨迹groundConnection中。

早期west-2-midnight因A/B诊断只录6秒，未计入；验收工具曾因空闲会话到期把页面放到后台，该段长时与不完整驾驶也已排除，之后以保活会话完成正式前台长测。诊断详见${link('工具中断记录','technical-trial/validation-lease-interruption.json')}。

${pic('双向轨迹','driving-trajectories.png')}

## 稳定性与区域往返

最终构建连续${f(stable.duration/60000)}分钟、${stable.series.length}条5秒资源记录，页面始终前台，应用error/unhandledrejection为0。该序列覆盖正式驾驶和四模式长测，运行没有崩溃或黑屏。早期录屏压力及后台中断在单独文件中披露。

${pic('长时资源','stability.png')}

完成2次预热后，再完成10次和平饭店—上海中心往返；每次返回相同落点，等待挂载／卸载与GPU提交完成。后5轮资源如下：

| 轮次 | 活跃块 | 几何体 | 顶点属性 | uniform缓冲 | 纹理 | 跟踪GPU资源 |
|---|---:|---:|---:|---:|---:|---:|
${rows}

${pic('十次往返','lifecycle.png')}

这些计数反映渲染器跟踪的GPU资源，不等于整个浏览器的显存；JS heap也不代替显存。完整数据：${link('资源往返','lifecycle.json')}、${link('长时序列','stability.json')}。

## 视觉对照与保留项

${visual.notes.map(n=>'- '+n).join('\n')}

${pic('18张固定机位','fixed-views-contact.jpg')}

${pic('8地标近远景','landmarks-contact.jpg')}

原站参考图在${link('reference目录','reference')}。这次完成了逐项视觉检查和差异记录，用户尚未进行最终人工美术验收。

普通路网方向、原OSM对象ID和完整桥隧层级在选定缓存中缺失；核心隧道按真实缓存端点拼接并通过实际驾驶，但不将这些测试推论为全区交通属性完全真实。普通楼宇估算、简化街墙和地下高程均有来源标记。详见${link('范围','scope.json')}及[来源说明](${path.join(root,'docs/SOURCES.md')})。

## 交付与复现

[本地游玩](http://127.0.0.1:4187/)；[静态包](${path.join(root,'release/shanghai-waterfront-0.1.0.tar.gz')})；[完整源码包](${path.join(root,'release/shanghai-waterfront-0.1.0-source.tar.gz')})；[部署说明](${path.join(root,'docs/deployment.md')})。公开上线未执行。

源码中的tests/browser为Tabbit执行程序，tools包含数据构建、地理审计、静态包验证、视频编码和报告绘图；Node和Python依赖分别锁定。无需公共地图API即可游玩。
`;
fs.writeFileSync(path.join(dir,'REPORT.md'),md);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=runs.map(r=>`<article class="metric"><small>${r.name} · ${f(r.sampleDuration/1000)}s</small><strong>${f(r.metrics.p95)}<span> ms</span></strong><p>P95 / 目标 ≤33.3ms</p></article>`).join('');
const gallery=shots.map(s=>`<a class="shot" data-time="${s.time}" href="screenshots/${s.file}"><img loading="lazy" src="screenshots/${s.file}" alt="${esc(s.view.name)} ${times[s.time]}"><span>V${s.index+1} · ${esc(s.view.name)} / ${times[s.time]}</span></a>`).join('');
const videos=clips.map(c=>`<article><video controls preload="none" src="recordings/${c.label}.mp4"></video><p>${labels[c.direction]} · ${times[c.time]} · ${f(c.duration/1000)}秒 <a href="drives/${c.file}">原始轨迹</a></p></article>`).join('');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>上海漫游 · 验收记录</title><style>*{box-sizing:border-box}body{margin:0;color:#203633;background:#f3f1e8;font:15px/1.65 system-ui,-apple-system,'PingFang SC',sans-serif}main{max-width:1360px;margin:auto;padding:52px 32px}h1{font-size:42px;letter-spacing:3px;margin:10px 0}h2{font-size:24px;margin:48px 0 18px}p{max-width:1050px}a{color:#236d66;text-underline-offset:4px}small{color:#627773}.eyebrow{letter-spacing:3px;color:#8b6d2c}.status{border-left:4px solid #c89d43;background:#ebe4cd;padding:15px 20px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin:32px 0}.metric{background:#fffdf5;padding:22px;border:1px solid #d9dfd4;border-radius:10px}.metric strong{display:block;font-size:38px;font-variant-numeric:tabular-nums;margin:8px 0}.metric span{font-size:15px}.metric p{margin:0;font-size:12px;color:#657773}.charts{display:grid;grid-template-columns:1fr;gap:24px}.charts img,.wide{width:100%;border:1px solid #d9dfd4;border-radius:9px}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.shot{display:block;background:#fffdf7;padding:7px;text-decoration:none;border:1px solid #d8ded3;border-radius:8px}.shot img{width:100%;display:block}.shot span{display:block;font-size:12px;padding:10px 5px}.filters button{padding:9px 20px;border:1px solid #82998c;background:#fffdf7;border-radius:6px;cursor:pointer;margin:0 8px 18px 0}.filters button.active{background:#254b43;color:#fff}.videos{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.videos article{background:#fffdf7;padding:10px;border:1px solid #d8ded3;border-radius:8px}.videos video{width:100%;background:#172526}.videos p{font-size:12px;margin:10px}.note{font-size:13px;color:#657773}footer{margin-top:45px;border-top:1px solid #c8d0c4;padding-top:20px;font-size:12px}@media(max-width:850px){.grid{grid-template-columns:1fr 1fr}.gallery,.videos{grid-template-columns:1fr}main{padding:24px 18px}h1{font-size:30px}}</style><main><div class="eyebrow">SHANGHAI WATERFRONT · 0.1.0</div><h1>外滩—陆家嘴验收记录</h1><p>四种漫游、8个地标、延安东路隧道连续双向驾驶。参考机：Apple M2 Pro / 16 GB，Tabbit Chromium154，WebGPU，中档1920×1080 / DPR1。</p><p class="status">核心技术检查已执行并通过。源缓存的普通道路方向／桥隧层级仍有缺口，最终人工美术验收待用户核对截图。<a href="REPORT.md">完整报告与保留项</a></p><p><a href="http://127.0.0.1:4187/">打开本地漫游</a>　<a href="summary.json">机器可读汇总</a>　<a href="control-points.csv">32个控制点</a>　<a href="release-audit.json">静态包审计</a></p><div class="grid">${cards}</div><p>冷启动导航到可操作中位数 <b>${f(startup[1]/1000)}秒</b>；连续运行 <b>${f(stable.duration/60000)}分钟</b> 无应用错误；两个方向各至少3段完整驾驶录像。</p><h2>性能与资源</h2><div class="charts"><img src="performance.png" alt="四模式性能"><img src="stability.png" alt="长时资源"><img src="lifecycle.png" alt="10次区域往返"></div><p class="note">正式性能采样不带录屏。高频CDP录屏曾造成夜间P95=65.04ms；停录后恢复，压力数据已保留于报告。渲染资源统计不等于全部浏览器显存。</p><h2>固定机位 · 18张原始截图</h2><div class="filters"><button data-filter="golden" class="active">黄昏</button><button data-filter="midday">白天</button><button data-filter="midnight">夜间</button><button data-filter="all">全部</button></div><div class="gallery">${gallery}</div><h2>地标近景与远景</h2><a href="landmarks-contact.jpg"><img class="wide" src="landmarks-contact.jpg" alt="八地标近远景"></a><h2>四模式操作</h2><video class="wide" controls preload="none" src="recordings/four-modes-release.mp4"></video><p class="note">步行、汽车、骑行、飞行：移动、三相机和停止。正式五分钟性能采样单独记录，不从录像帧率推算。</p><h2>双向连续驾驶</h2><div class="videos">${videos}</div><h2>真实布局与轨迹</h2><img class="wide" src="driving-trajectories.png" alt="双向路线与剖面"><p><a href="geography-overlay.svg">控制点叠合图</a>　<a href="geography.json">独立坐标／接缝审计</a>　<a href="opened-roads.csv">道路清单</a>　<a href="landmarks.csv">地标清单</a></p><footer>来源、版本与估算口径见工程docs/SOURCES.md。截图和录像均为本机真实运行证据；未公开上线。最终构建 ${esc(build.asset)}。</footer></main><script>function filter(value){document.querySelectorAll('.shot').forEach(el=>el.style.display=value==='all'||el.dataset.time===value?'block':'none');document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter===value));}document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>filter(el.dataset.filter));filter('golden');</script></html>`;
fs.writeFileSync(path.join(dir,'index.html'),html);console.log({modes:summary.performance,completeClips:clips.length,coldMedianMs:startup[1],minutes:summary.stabilityMinutes,contractStatus:summary.contractStatus});
