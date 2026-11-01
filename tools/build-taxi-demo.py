"""Cut a concise demonstration from a verified continuous gameplay take."""
from pathlib import Path
import argparse, subprocess, json, html
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);root=p.parse_args().directory.resolve()
r=json.loads((root/'recording.json').read_text())[0]
e={v['phase']:v['t'] for v in r['events']}
segments=[('接单',.5,4.5),('靠边接客与上车',e['boarding']-3,e['ride']+.7),('导航行驶',e['ride']+24,e['ride']+34.5),('送达下车与结算',e['alighting']-6,min(r['seconds'],e['complete']+2.7))]
cmd=['ffmpeg','-hide_banner','-loglevel','error','-y'];filters=[]
for i,(_,a,b) in enumerate(segments):
 cmd+=['-ss',str(a),'-t',str(b-a),'-i',str(root/'TX01_完整接单到送达.mp4')]
 filters.append(f'[{i}:v]setpts=PTS-STARTPTS,fps=30,format=yuv420p[v{i}]')
filters.append(''.join(f'[v{i}]' for i in range(len(segments)))+f'concat=n={len(segments)}:v=1:a=0[v]')
out=root/'TX02_出租车接送_31秒展示.mp4'
subprocess.run(cmd+['-filter_complex',';'.join(filters),'-map','[v]','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
checks=root/'检查帧';checks.mkdir(exist_ok=True);rows=[]
for f in sorted(root.glob('*.mp4')):
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate:format=duration','-of','json',str(f)]))
 v=next(s for s in probe['streams'] if s['codec_type']=='video');duration=float(probe['format']['duration'])
 assert (v['width'],v['height'],v['r_frame_rate'])==(1920,1080,'30/1')
 if f==out: assert 25<=duration<=40
 for label,t in [('开头',.2),('中间',duration/2),('结尾',duration-.2)]:
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(f),'-frames:v','1',str(checks/(f.stem+'_'+label+'.jpg'))],check=True)
 rows.append({'file':f.name,'seconds':duration,'video':v})
(root/'剪辑记录.json').write_text(json.dumps({'videos':rows,'segments':segments,'result':r['result'],'errors':r['errors']},ensure_ascii=False,indent=2))
(root/'说明.md').write_text('''# 出租车接送实玩 · 0.9.0

优先使用 **TX02_出租车接送_31秒展示.mp4**：接单→靠边接客和上车→导航行驶→送达下车及结算。它从同一单连续实玩原片剪出，省略了部分路程，不是一镜到底。

**TX01_完整接单到送达.mp4** 保留整单过程。三条汉口订单已分别通过实际车辆物理验证，本片录江汉关附近至巴公房子附近的一单。录制程序只输入油门、方向和刹车，接单走正常界面；途中不传送，不强制接客或结算，交通和碰撞仍生效。录前准备机位及车辆位置。

两段都是1920×1080、30fps、H.264，无声音轨，可叠加口播或另录环境底声。乘客采用游戏现有角色，有简化上车和下车动作。虚拟计费不代表武汉现实运价。完整状态轨迹与收入见 recording.json；检查帧与剪辑区间另存。

这是小型玩法：仅三条汉口沿江大道短线，尚无随机全城派单、跨江接送或复杂评分。旧 taxi-demo 的X01—X03是静止流程原型，请以本目录的新片为正式素材。中断录制子目录不属于交付原片。
''')
cards=''.join(f'<article><h2>{html.escape(v["file"])}</h2><video controls preload="metadata" src="{html.escape(v["file"],quote=True)}"></video><p>{v["seconds"]:.2f}秒 · 1080p30 · 无声</p></article>' for v in rows)
(root/'素材预览.html').write_text('<!doctype html><meta charset="utf-8"><title>武汉出租车接送实玩</title><style>body{background:#161b20;color:white;font:16px system-ui;margin:32px}video{width:100%;max-width:1100px}article{margin-bottom:40px}</style><h1>出租车完整实玩与剪辑节选 · 0.9.0</h1>'+cards)
parent=root.parent;p=parent/'先看这里-素材说明.md';s=p.read_text();marker='## 新增：0.9.0出租车接送实玩'
if marker not in s:p.write_text(s+'\n'+marker+'\n\n打开 `2026-11-01_taxi-v0.9.0/素材预览.html`。TX02为约31秒的接单到结算剪辑，TX01为连续完整原片。无声，旧taxi-demo仅作原型参考，中断片不计入正式素材。\n')
p=parent/'总素材预览.html';s=p.read_text();link='<p><a href="2026-11-01_taxi-v0.9.0/素材预览.html">新增：0.9.0出租车完整实玩与31秒节选</a></p>'
if '2026-11-01_taxi-v0.9.0/素材预览.html' not in s:p.write_text(s+link)
print(json.dumps(rows,ensure_ascii=False))
