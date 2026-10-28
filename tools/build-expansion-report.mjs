import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.cwd(),dir=path.join(root,'docs/acceptance/0.2.0'),read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const data=JSON.parse(fs.readFileSync('public/data/city.json')),audit=JSON.parse(fs.readFileSync('docs/data-audit.json')),build=read('builds/final.json');
const names={person:'步行',car:'汽车',cyclist:'自行车',helicopter:'直升机'},modes=Object.keys(names).map(id=>({id,name:names[id],...read('modes/'+id+'.json')}));
const cold=read('cold-start.json'),geo=read('geography.json'),stable=read('stability.json'),life=read('lifecycle.json'),suite=read('suite-progress.json'),interaction=read('expansion-interactions.json'),net=read('network-audit.json'),release=read('release-audit.json'),source=read('source-reproduction.json'),operation=read('four-modes-operation.json'),visual=read('visual-review.json'),screens=[...read('screenshots.json'),...read('new-screenshots.json')],encoded=read('recordings/encoded-audit.json');
assert.equal(suite.done,true);assert.equal(suite.finalChecks,true);assert.equal(suite.error,null);assert.equal(source.status,'passed');assert.equal(visual.needsRetake.length,0);assert.equal(screens.length,33);
const loading=read('loading-failure.json'),gate=read('loading-gate.json'),landings=read('flying-landings.json'),lane=read('tianzifang-walk.json');assert.ok(loading.shift<.1&&loading.retryReady&&loading.retryDistance<350);assert.ok(gate.shift<.01&&gate.ready);assert.equal(landings.length,36);assert.ok(landings.every(r=>r.ready&&!r.water&&r.active===r.requested&&r.shift<.3));assert.ok(lane.distance>50&&lane.lateralDrift<.5);
const standalone=read('standalone-browser.json'),captureDiagnostics=read('screenshot-diagnostics.json');assert.equal(standalone.ready,true);assert.equal(standalone.asset,build.asset);assert.deepEqual(standalone.errors,[]);assert.deepEqual(standalone.externalRequests,[]);
for(const s of screens){assert.equal(s.width,1920);assert.equal(s.height,1080);assert.equal(s.buildAsset,build.asset);}
assert.equal(build.citySHA256,audit.citySHA256);assert.equal(source.expectedCitySHA256,build.citySHA256);
for(const r of modes){assert.equal(r.buildAsset,build.asset);assert.ok(r.sampleDuration>=300000);assert.ok(r.metrics.p95<=33.3);assert.deepEqual(r.errors,[]);assert.deepEqual(r.metrics.errors,[]);for(let i=1;i<r.trace.length;i++){const a=r.trace[i-1],b=r.trace[i];assert.ok(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)<30,'discontinuous mode evidence '+r.id);}}
const drives=['east','west'].flatMap(direction=>['midday','midnight','golden'].map(time=>read('drives/'+direction+'-'+time+'-release.json')));
for(const r of drives){assert.equal(r.buildAsset,build.asset);assert.equal(r.done,true);assert.deepEqual(r.errors,[]);assert.ok(r.maxCrossTrack<2.6&&r.minCameraClearance>.3&&r.minY<-20&&r.maxStep<8);assert.ok(encoded.videos.some(v=>v.label===r.label&&v.fullDecode==='passed'));}
for(const r of drives.filter(d=>d.groundApproach))assert.ok(r.maxTransitionStep<=.1);
assert.equal(cold.runs.length,3);assert.equal(cold.failure,null);const coldTimes=cold.runs.map(r=>r.operableMs).sort((a,b)=>a-b);assert.ok(coldTimes[1]<=15000);
assert.equal(stable.buildAsset,build.asset);assert.ok(stable.duration>=1800000);assert.deepEqual(stable.errors,[]);assert.deepEqual(stable.visibilityChanges,[]);assert.ok(stable.series.every(r=>r.visible&&r.errors===0));assert.deepEqual(stable.canvas,[1920,1080]);assert.equal(stable.pixelRatio,1);assert.equal(stable.webgpu,true);
assert.equal(life.buildAsset,build.asset);assert.equal(life.measuredRounds,10);for(const key of ['geometries','textures','attributes','storageAttributes','uniformBuffers','programs'])assert.equal(new Set(life.rounds.slice(-5).map(r=>r.memory[key])).size,1);
assert.equal(geo.count,32);assert.ok(geo.maxErrorMetres<=5);assert.equal(interaction.arrivals.length,19);assert.equal(data.landmarks.length,12);assert.equal(data.places.length,7);assert.deepEqual(net.externalRequests,[]);assert.deepEqual(net.failedResources,[]);assert.deepEqual(net.applicationErrors,[]);assert.equal(operation.done,true);assert.equal(operation.error,null);assert.equal(operation.steps.length,4);
const n=v=>Number(v).toFixed(2),link=(label,file)=>`[${label}](${file})`,timeNames={midday:'白天',golden:'黄昏',midnight:'夜间'};
const summary={version:'0.2.0',region:data.region,build,technicalStatus:'已列技术验证通过',contractReservations:['缓存未保留普通道路完整单行、层级与原始OSM对象ID；并非现实导航数据','普通补建筑、新增模型尺寸、里弄布局和地下纵断面含明确标记的视觉估算','最终画风和城市辨识度仍由用户结合原始截图确认'],hardware:{chip:'Apple M2 Pro',memoryGB:16,browser:cold.runs[0].versions,renderer:'WebGPU',quality:'medium',canvas:[1920,1080],rendererDPR:1},geography:{controls:geo.count,maxSelectedSourceErrorM:geo.maxErrorMetres,landmarks:12,neighbourhoodDestinations:7,sourcedBuildings:audit.realBuildings,proceduralBuildings:audit.proceduralBuildings,groundRoadObjects:audit.roads,tiles:audit.tiles},performance:modes.map(r=>({mode:r.id,name:r.name,sampleSeconds:r.sampleDuration/1000,distanceM:r.distance,frames:r.metrics.frames,p50:r.metrics.p50,p95:r.metrics.p95,p99:r.metrics.p99})),coldStart:{runsMs:cold.runs.map(r=>r.operableMs),medianMs:coldTimes[1],network:cold.network},stabilityMinutes:stable.duration/60000,lifecycleRounds:10,screenshots:33,completeDrivingRecordings:drives.length,releaseFiles:release.manifestFilesVerified,sourceReproduction:{filesCompared:source.filesCompared,citySHA256:source.regeneratedCitySHA256},externalRequests:net.externalRequests.length};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
const csv=rows=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
fs.writeFileSync(path.join(dir,'landmarks.csv'),csv([['id','name','lon','lat','height_m','height_source','model_source'],...data.landmarks.map(l=>[l.id,l.name,l.lon,l.lat,l.height,l.heightSource,l.modelSource||'procedural exterior'])]));
fs.writeFileSync(path.join(dir,'destinations.csv'),csv([['id','name','district','x_m','z_m','source'],...[...data.landmarks,...data.places].map(l=>[l.id,l.name,l.district,l.x,l.z,l.source])]));
fs.writeFileSync(path.join(dir,'opened-roads.csv'),csv([['id','name','width_m','source_direction_verified','kind'],...data.roads.map(r=>[r.id,r.name,r.width,false,'ground']),...data.tunnels.map(r=>[r.id,'延安东路隧道',r.width,'fixed-cache bore point order','tunnel'])]));
const perfTable=modes.map(r=>`| ${r.name} | ${n(r.sampleDuration/1000)} | ${n(r.distance)} | ${r.metrics.frames} | ${n(r.metrics.p50)} | ${n(r.metrics.p95)} | ${n(r.metrics.p99)} |`).join('\n');
const driveTable=drives.map(r=>`| ${r.direction==='east'?'浦西→浦东':'浦东→浦西'}／${timeNames[r.time]} | ${n(r.duration/1000)} | ${n(r.maxCrossTrack)} | ${n(r.minCameraClearance)} | ${r.groundApproach?'源道路驶入、另一岸驶出':'入口起步'} | ${link('视频','recordings/'+r.label+'.mp4')} · ${link('轨迹','drives/'+r.label+'.json')} |`).join('\n');
const lifeTable=life.rounds.slice(-5).map(r=>`| ${r.round} | ${r.tiles} | ${r.memory.geometries} | ${r.memory.attributes} | ${r.memory.uniformBuffers} | ${r.memory.textures} | ${n(r.memory.total/1048576)} |`).join('\n');
const md=`# 上海中心城区 B 档 · 0.2.0 验收报告

已交付68.66km²本地可玩版本、独立静态包与完整源码。保留双向10米游戏洞宽隧道，12个独立地标和7个街区目的地。下列玩法、性能、驾驶、加载和复现技术验证已执行。源道路方向／层级缺失和视觉估算继续明确披露；最终人工美术确认没有替用户判定通过。

## 范围与版本

WGS84边界：\`[121.440,31.200,121.540,31.265]\`，含水域68.66km²。新增静安寺、南京西路、淮海中路、田子坊、北外滩、南浦大桥地面周边、源深。新增独立外观为静安寺、上海博物馆人民广场馆、上海展览中心、田子坊里弄。南浦大桥桥面驾驶未纳入；跨黄浦江驾驶使用延安东路隧道。

最终脚本：\`${build.asset}\`；SHA256：\`${build.sha256}\`。城市数据SHA256：\`${build.citySHA256}\`。全部正式模式、驾驶、稳定性及资源回归使用同一脚本。固定源和估算说明见[来源文档](../../SOURCES.md)。

本机Apple M2 Pro／16GB，Tabbit Chromium154.0.8037.58，WebGPU、中档，画布1920×1080，renderer DPR=1。Tabbit90%站点缩放由viewport仿真得到以上真实画布，截图为原生clip。正式帧采样期间无录屏、无视频编码；虚拟手柄控制真实控制器，测试页暂时隔离人工键鼠，结束后恢复。

## 验收结果

| 项目 | 结果与证据 |
|---|---|
| 地理与开放范围 | ${audit.roads}个地面道路对象，${audit.realBuildings}个源建筑对象＋${audit.proceduralBuildings}个程序补体量，${audit.tiles}个500米块。不能解释为真实唯一楼栋覆盖率。[范围](../../../data/source/expansion-b.json)、[道路清单](opened-roads.csv) |
| 坐标与洞口 | 32个控制点，独立ECEF→ENU最大转换偏差${n(geo.maxErrorMetres)}m，目标≤5m；四个洞口接缝高差0m。这只校验选定源，不证明源地图本身无误差。[控制点](control-points.csv)、[叠合图](geography-overlay.svg)、[审计](geography.json) |
| 地标与碰撞 | 12地标无重复，新增四处具有不同外形；普通楼宇预留排除。新增模型与所有源道路进行全车宽间隔检查，里弄中央通道与展览中心前庭保持可通行。[地标清单](landmarks.csv)、[独立审查与修复](code-review.md) |
| 目的地与界面 | 19目的地全部到达有效、干燥、已加载道路；搜索静安寺／新天地、输入不触发驾驶、晚到请求不覆盖新目标，地图19标记与新边界通过。[交互记录](expansion-interactions.json) |
| 加载异常 | 新区目标失败保持当前位置，重试可达；移动前方未就绪会停止，不进入空场景。加载lease、邻块碰撞halo和路线驻留有自动夹具覆盖。[加载异常](loading-failure.json)、[移动门控](loading-gate.json)、[31项测试](unit-tests.log) |
| 四模式 | 每种模式预热30秒后采样≥300秒，真实移动、停止、相机切换与三时段操作通过。[操作录像](recordings/four-modes-release.mp4)、[操作记录](four-modes-operation.json) |
| 连续双向过江 | 两方向各3次，覆盖白天／黄昏／夜间；六段完整轨迹、原生录屏；黄昏两趟从源地面道路驶入、另一岸驶出，接缝≤0.1m。见下表 |
| 模式性能 | 四种模式P95均≤33.3ms，原始帧和P99完整保留。步行、汽车、骑行走南京西路，飞行覆盖新增城区；没有用编码视频帧率代替应用帧率 |
| 冷启动 | 清站点数据并绕过HTTP缓存，50Mbps／80ms RTT，3次导航到可操作中位${n(coldTimes[1]/1000)}秒，目标≤15秒。[原始分项](cold-start.json) |
| 长时与资源 | 同一最终构建连续${n(stable.duration/60000)}分钟，始终visible，无应用错误；静安寺—源深2次预热＋10次往返，后5轮资源计数稳定。[长时记录](stability.json)、[往返记录](lifecycle.json) |
| 独立交付 | 静态包${release.manifestFilesVerified}文件哈希核对、${release.necessaryFilesServed}必要HTTP资源通过，游玩无外部API请求；隔离目录npm ci、31项测试、数据再生、构建，${source.filesCompared}个运行文件逐字节一致。[静态审计](release-audit.json)、[复现审计](source-reproduction.json)、[网络](network-audit.json) |
| 视觉证据 | 原6机位＋新5机位，各3时段，共33张1920×1080原始截图。逐项观察和差异见下文；最终画风由用户确认 |

## 五分钟帧耗时

| 模式 | 有效秒数 | 实际路程m | 帧数 | P50 ms | P95 ms | P99 ms |
|---|---:|---:|---:|---:|---:|---:|
${perfTable}

![四模式性能](performance.png)

${modes.map(r=>link(r.name+'原始帧与轨迹','modes/'+r.id+'.json')).join('、')}。

## 双向驾驶

| 方向／时段 | 秒数 | 最大洞线偏离m | 最小顶板余量m | 起终点 | 证据 |
|---|---:|---:|---:|---|---|
${driveTable}

驾驶中未调用跳转或重新加载，入口菜单只用于各次测试起步。轨迹保留表面ID、高程、约200ms位置及相机位置；全程地下最深到−26m。纵断面为视觉估算。六段录屏在正式四模式帧采样之后录制，录屏中的性能不作为P95通过依据。

![连续轨迹与高程](driving-trajectories.png)

## 稳定性与资源

长时记录共${stable.series.length}个5秒样本，连续${n(stable.duration/60000)}分钟，应用error／unhandledrejection为0，页面隐藏次数0。覆盖四模式、六趟驾驶及干净步行复测。

| 往返轮次 | 活跃块 | 几何体 | 顶点属性 | uniform缓冲 | 纹理 | 跟踪GPU资源MiB |
|---|---:|---:|---:|---:|---:|---:|
${lifeTable}

![长时与往返资源](resources.png)

资源计数是渲染器跟踪值，不等于浏览器全部显存；JS heap不代替显存。往返目标跨越新区两端，每次返回同一落点并等待加载与GPU提交完成。

## 视觉核对与限制

${visual.notes.map(s=>'- '+s).join('\n')}

![固定机位黄昏预览](contact-golden.jpg)

原始全尺寸截图与三个时段可在[交互验收页](index.html)查看。上游参考保留在[原站参考](../reference/)。普通楼宇高度、里弄布局、新增地标尺寸和隧道高程含视觉估算。缓存没有普通道路完整单行、原OSM ID和桥隧层级，不把范围扩张当作交通属性完整核验。

## 诊断记录与排除规则

初次阶段性冷启动诊断曾停在浏览器WebGPU设备初始化，恢复网络并重新导航后可运行；最终构建正式三次均启动成功，未删除诊断：[超时记录](cold-start-timeout.json)。

固定机位截图初次受浏览器viewport恢复影响出现黑边，已改用原生Page.captureScreenshot重拍全部33张。截图保留浏览器悬浮按钮，未修改画面像素。其间的扩展节点恢复／画布读取专用探测发生标签崩溃（原生界面错误代码5），未区分具体触发调用；该探测在全部正式游玩与功能检查完成后进行，应用正常流程不运行它。已停止这些探测，使用原生重新加载恢复，并重新核对独立静态包和正常游玩页面。[截图诊断与恢复](screenshot-diagnostics.json)、[重拍程序](capture-fixed-views.js)、[独立包浏览器检查](standalone-browser.json)、[恢复页面](restored-playable-page.json)。

第一段步行采样受到地点点击干扰，出现约2.67km瞬移；该段不计入最终通过数字，保留在[受干扰原始样本](technical-trial/person-click-interrupted.json)。随后隔离测试页人工输入，在同一最终构建重新完成连续步行五分钟；最终表格仅使用干净复测。没有裁掉慢帧、降低画质或把诊断短样本当作正式结果。

## 交付

[打开本地漫游](http://127.0.0.1:4187/) · [静态包](../../../release/shanghai-waterfront-0.2.0.tar.gz) · [完整源码包](../../../release/shanghai-waterfront-0.2.0-source.tar.gz) · [部署说明](../../deployment.md)。本次未公开上线。验收报告、截图、录像和原始数据随工程目录单独提供，不打入源码归档。
`;
fs.writeFileSync(path.join(dir,'REPORT.md'),md);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=summary.performance.map(r=>`<article><small>${r.name} · ${n(r.sampleSeconds)}秒</small><strong>${n(r.p95)} <span>ms</span></strong><p>P95 ≤33.3ms</p></article>`).join('');
const gallery=screens.map(s=>`<a class="shot" data-time="${s.time}" href="screenshots/${s.file}"><img loading="lazy" src="screenshots/${s.file}" alt="${esc(s.view.name)}"><span>${esc(s.view.name)} · ${timeNames[s.time]}</span></a>`).join('');
const clips=drives.map(r=>`<article><video controls preload="none" src="recordings/${r.label}.mp4"></video><p>${r.direction==='east'?'浦西→浦东':'浦东→浦西'} · ${timeNames[r.time]} · ${n(r.duration/1000)}秒　<a href="drives/${r.label}.json">轨迹</a></p></article>`).join('');
fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>上海中心城区 · B档验收</title><style>*{box-sizing:border-box}body{margin:0;background:#f0eee4;color:#233e38;font:15px/1.65 system-ui,'PingFang SC',sans-serif}main{max-width:1360px;margin:auto;padding:40px 28px}h1{font-size:38px;margin:8px 0}h2{margin:38px 0 16px}a{color:#236d66}small{color:#627773}.status{background:#e5e8d8;border-left:4px solid #bc9550;padding:16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}article{background:#fffdf5;border:1px solid #ccd4c5;padding:18px;border-radius:10px}strong{display:block;font-size:34px}strong span{font-size:16px}.wide,video{width:100%;display:block;border-radius:8px}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.shot{background:#fffdf5;padding:7px;border:1px solid #ccd4c5;border-radius:8px;text-decoration:none}.shot img{width:100%;display:block}.shot span{display:block;padding:8px;font-size:12px}.videos{display:grid;grid-template-columns:1fr 1fr;gap:16px}.videos p{font-size:12px}button{padding:8px 18px;margin:0 8px 18px 0;background:#fffdf5;border:1px solid #8da294;border-radius:6px;color:#233e38;cursor:pointer}button.active{background:#233e38;color:#fff}.note{font-size:13px;color:#627773}footer{margin-top:35px;border-top:1px solid #ccd4c5;padding-top:18px}@media(max-width:800px){.grid{grid-template-columns:1fr 1fr}.gallery,.videos{grid-template-columns:1fr}main{padding:24px 16px}}</style><main><small>SHANGHAI CENTRAL · 0.2.0</small><h1>B档，中心城区68.66km²</h1><p>12地标 · 7街区目的地 · 四模式 · 10米洞宽双向过江。新增静安寺、上海博物馆人民广场馆、上海展览中心、田子坊里弄。南浦大桥仅地面周边。</p><p class="status">所列技术检查已通过；源道路属性缺失和视觉估算继续披露，最终人工画风确认待用户核对。<a href="REPORT.md">完整报告</a> · <a href="summary.json">原始汇总</a> · <a href="http://127.0.0.1:4187/">本地游玩</a></p><div class="grid">${cards}</div><p>清缓存冷启动中位数${n(coldTimes[1]/1000)}秒；连续${n(stable.duration/60000)}分钟无应用错误；32控制点最大转换误差${n(geo.maxErrorMetres)}米。</p><img class="wide" src="performance.png" alt="四模式五分钟性能"><h2>固定机位 · 33张原始截图</h2><div id="filters"><button data-time="golden" class="active">黄昏</button><button data-time="midday">白天</button><button data-time="midnight">夜间</button><button data-time="all">全部</button></div><div class="gallery">${gallery}</div><h2>四模式实际操作</h2><video controls preload="none" src="recordings/four-modes-release.mp4"></video><h2>连续双向驾驶</h2><div class="videos">${clips}</div><h2>轨迹与资源</h2><img class="wide" src="driving-trajectories.png" alt="双向轨迹和高程"><img class="wide" src="resources.png" alt="长时与往返资源"><footer><a href="source-reproduction.json">源码复现</a> · <a href="release-audit.json">静态包审计</a> · <a href="control-points.csv">控制点</a> · <a href="landmarks.csv">地标</a> · <a href="destinations.csv">目的地</a><p class="note">正式帧采样不带录屏；受点击干扰的早期步行样本已排除并保留。原始截图和录像来自实际运行，未公开上线。最终脚本 ${esc(build.asset)}。</p></footer></main><script>function filter(time){document.querySelectorAll('.shot').forEach(s=>s.hidden=time!=='all'&&s.dataset.time!==time);document.querySelectorAll('#filters button').forEach(b=>b.classList.toggle('active',b.dataset.time===time));}document.querySelectorAll('#filters button').forEach(b=>b.onclick=()=>filter(b.dataset.time));filter('golden');</script></html>`);
console.log({performance:summary.performance,coldMedianSeconds:coldTimes[1]/1000,stabilityMinutes:summary.stabilityMinutes,drives:drives.length,screenshots:screens.length,sourceFiles:source.filesCompared});
