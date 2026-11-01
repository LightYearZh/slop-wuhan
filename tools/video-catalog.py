"""Verify captured MP4s and create an editable shot list, contact sheet and local preview page."""
import argparse,csv,html,json,math,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

parser=argparse.ArgumentParser();parser.add_argument('directory');args=parser.parse_args()
root=Path(args.directory).resolve();rows=[]
uses={'W01':'开头、两江格局、地图范围','W03A':'开头、江汉关地标与单独建模','W04A':'历史街区风貌与当前局限','W06':'游览、黄鹤楼简化模型','W07':'两山地形与武汉辨识度','W02A':'大桥过渡与交通段','W12A':'楼高与汉口天际线','W12B':'两江交汇与南岸嘴','W12C':'滨江楼群与估算高度','W01B':'片尾、黄昏补充','W02B':'开头、驾驶证明、桥面通行','W05':'出租车玩法、后续任务设想','W04B':'步行与街景游览','W10A':'骑行与载具演示','W09':'实心盒子变门洞，保留连续穿越','W08':'过江隧道，完整连续路线供选段','W10B':'四种移动方式与选中状态','W11':'地图搜索、传送、真实位置','W01C':'开头、直升机与飞行玩法','W01D':'开头、低空看两江交汇',
'T01':'江汉关时段匹配_正午','T02':'江汉关时段匹配_黄金','T03':'江汉关时段匹配_蓝调','T04':'江汉关时段匹配_夜晚',
'T05':'长江大桥时段匹配_正午','T06':'长江大桥时段匹配_黄金','T07':'长江大桥时段匹配_蓝调','T08':'长江大桥时段匹配_夜晚',
'T09':'黄鹤楼时段匹配_黄金','T10':'黄鹤楼时段匹配_蓝调','T11':'黄鹤楼时段匹配_夜晚',
'T12':'龟山塔时段匹配_蓝调','T12G':'龟山塔时段匹配_黄金','T13':'龟山塔时段匹配_夜晚','T14':'两江时段匹配_蓝调','T15':'两江时段匹配_夜晚','T15M':'两江时段匹配_夜晚中角度',
'N01':'夜晚沿江出租车','N02':'夜晚长江大桥驾车','N03':'夜晚江汉路步行','N04':'夜晚直升机沿江','N04C':'夜晚直升机沿江_干净版'}
verify_dir=root/'抽检帧';verify_dir.mkdir(exist_ok=True)
for file in sorted(root.glob('*.mp4')):
    if file.name.startswith('样片_'):continue
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration:format=duration,size','-of','json',str(file)]))
    video=next(s for s in probe['streams'] if s['codec_type']=='video')
    assert (video['width'],video['height'],video['r_frame_rate'])==(1920,1080,'30/1'),file.name
    duration=float(probe['format']['duration']);assert duration>5,file.name
    identifier=file.stem.split('_')[0];meta_path=root/(identifier+'.json')
    meta=json.loads(meta_path.read_text()) if meta_path.exists() else {}
    assert not meta.get('errors'),file.name
    images=[]
    for label,t in [('start',.15),('middle',duration/2),('end',max(0,duration-.2))]:
        target=verify_dir/(identifier+'_'+label+'.jpg')
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(file),'-frames:v','1','-q:v','2',str(target)],check=True)
        with Image.open(target) as im:assert im.size==(1920,1080)
        images.append(target.name)
    trace=meta.get('trace',[]);travel=round(sum(math.dist(a['p'],b['p']) for a,b in zip(trace,trace[1:])),1) if trace else 0
    notes='无声画面；游戏原声另存，未逐镜同步。'
    if identifier=='W01':notes+=' 高空可见矩形地图边界，适合说明范围。'
    if identifier=='W08':notes+=' 完整行驶是否出洞以轨迹末点和抽检画面核对。'
    rows.append({'编号':identifier,'文件':file.name,'时长秒':round(duration,3),'规格':'1920×1080 / 30fps / H.264','用途':uses.get(identifier,'补充镜头'),'录制方式':meta.get('method','derived cut'),'轨迹路程米':travel,'备注':notes,'抽检帧':images,'字节':int(probe['format']['size'])})
if not rows:raise SystemExit('No final MP4s found')
with (root/'素材清单.csv').open('w',encoding='utf-8-sig',newline='') as f:
    fields=['编号','文件','时长秒','规格','用途','录制方式','轨迹路程米','备注'];writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader();writer.writerows(rows)
(root/'验收.json').write_text(json.dumps({'clips':len(rows),'durationSeconds':sum(r['时长秒'] for r in rows),'bytes':sum(r['字节'] for r in rows),'checks':'ffprobe dimensions, constant frame rate, duration; decoded start/middle/end; runtime errors; trace distance','videos':rows},ensure_ascii=False,indent=2)+'\n')
fontpath='/System/Library/Fonts/Supplemental/Songti.ttc';font=ImageFont.truetype(fontpath,22);small=ImageFont.truetype(fontpath,18)
cols=4;cellw=480;cellh=320;contact=Image.new('RGB',(cols*cellw,math.ceil(len(rows)/cols)*cellh),'#151b20');draw=ImageDraw.Draw(contact)
for i,row in enumerate(rows):
    x=i%cols*cellw;y=i//cols*cellh
    image=Image.open(verify_dir/row['抽检帧'][1]);image.thumbnail((480,270));contact.paste(image,(x,y))
    draw.text((x+9,y+275),row['文件'][:-4],font=font,fill='white')
    draw.text((x+9,y+299),str(round(row['时长秒'],1))+'秒 · 1080p30',font=small,fill='#b5d6d1')
contact.save(root/'素材总览.jpg',quality=92)
cards='\n'.join('<article><video controls preload="none" poster="抽检帧/'+html.escape(r['抽检帧'][1],quote=True)+'" src="'+html.escape(r['文件'],quote=True)+'"></video><h2>'+html.escape(r['文件'][:-4])+'</h2><p>'+str(r['时长秒'])+'秒 · '+html.escape(r['用途'])+'</p><p>'+html.escape(r['备注'])+'</p></article>' for r in rows)
(root/'素材预览.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Slop 武汉 · 录制素材</title><style>body{background:#151b20;color:#eef5f3;font:16px/1.6 system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:#253038;padding:16px;border-radius:12px}video{width:100%}h2{font-size:20px}p{color:#c6d4d2}</style><h1>Slop 武汉 · 0.8.5 录制素材</h1><p>1080p / 30fps / H.264 · '+str(len(rows))+'段，共'+str(round(sum(r['时长秒'] for r in rows),1))+'秒。画面无声，独立游戏原声见音频目录。可直接打开MP4导入剪辑软件。</p><main>'+cards+'</main></html>')
print(json.dumps({'clips':len(rows),'seconds':round(sum(r['时长秒'] for r in rows),2),'sizeMB':round(sum(r['字节'] for r in rows)/1e6,1)},ensure_ascii=False))
