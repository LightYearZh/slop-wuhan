from pathlib import Path
import argparse,subprocess,json,csv,html
parser=argparse.ArgumentParser(description='Build the NYC-to-Wuhan cut from captured original clips.')
parser.add_argument('material_root',type=Path)
root=parser.parse_args().material_root.resolve()
out=root/'2026-11-01_纽约来源与过渡'
ny=out/'NY01_原版纽约出租车_带界面.mp4'
wuhan=root/'2026-11-01_1080p30/W05_沿江大道_出租车行驶.mp4'
font='/System/Library/Fonts/Supplemental/Songti.ttc'
Path('/tmp/wuhan-ny-label.txt').write_text('纽约 · Slop New York 原版')
Path('/tmp/wuhan-wh-label.txt').write_text('武汉 · Slop Wuhan')
filters="[0:v]fps=30,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[a];[1:v]fps=30,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[b];[a][b]xfade=transition=fade:duration=0.5:offset=3.5,format=yuv420p[v]"
base=['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','1','-t','4','-i',str(ny),'-ss','6','-t','4.5','-i',str(wuhan)]
encode=['-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart']
clean=out/'TR01_纽约切到武汉_8秒过渡_无额外字幕.mp4'
subprocess.run(base+['-filter_complex',filters,'-map','[v]']+encode+[str(clean)],check=True)
labelled=out/'TR02_纽约切到武汉_8秒过渡_带城市名.mp4'
from PIL import Image,ImageDraw,ImageFont
for title,name in [('纽约 · Slop New York 原版','ny'),('武汉 · Slop Wuhan','wh')]:
 im=Image.new('RGBA',(700,86),(0,0,0,0));draw=ImageDraw.Draw(im);face=ImageFont.truetype(font,40)
 box=draw.textbbox((0,0),title,font=face);w=box[2]-box[0]
 draw.rounded_rectangle((0,0,w+36,80),radius=12,fill=(0,0,0,150));draw.text((18,13),title,font=face,fill='white')
 im.save('/tmp/wuhan-'+name+'-label.png')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(clean),'-loop','1','-i','/tmp/wuhan-ny-label.png','-loop','1','-i','/tmp/wuhan-wh-label.png','-filter_complex',"[0:v][1:v]overlay=x=65:y=145:enable='lt(t,3.5)'[a];[a][2:v]overlay=x=65:y=145:enable='gte(t,4)'[v]",'-map','[v]','-t','8']+encode+[str(labelled)],check=True)

rows=[]
for f in sorted(out.glob('*.mp4')):
 d=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size','-of','json',str(f)]))
 v=next(s for s in d['streams'] if s['codec_type']=='video')
 assert (v['width'],v['height'],v['r_frame_rate'])==(1920,1080,'30/1')
 duration=float(d['format']['duration']);assert duration>=7.9
 kind='剪辑示例（来自已有原片，不计新增独立画面时长）' if f.name.startswith('TR') else '原始实录'
 rows.append({'文件':f.name,'秒':duration,'规格':'1920×1080 / 30fps / H.264','类型':kind})
 for label,t in [('start',.15),('middle',duration/2),('end',duration-.15)]:
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(f),'-frames:v','1','-q:v','2',str(out/'检查帧'/(f.stem+'_'+label+'.jpg'))],check=True)
with (out/'新增素材清单.csv').open('w',encoding='utf-8-sig',newline='')as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
(out/'说明.md').write_text('''# 纽约原版、GitHub页面与武汉过渡

## 先用哪个

- **TR02_纽约切到武汉_8秒过渡_带城市名.mp4**：直接可用的8秒示例，纽约出租车约4秒，经0.5秒叠化转到武汉出租车；两边都是黄色出租车跟随视角。
- **TR01_纽约切到武汉_8秒过渡_无额外字幕.mp4**：同一剪辑但不加额外城市名，方便按你的字幕样式再做。
- **NY01**：原版纽约8秒，带游戏界面。**NY02**：原版纽约8秒，隐藏操作界面，方便另剪。
- **G01**：原版GitHub页面8秒滚动，从仓库首页到README；另有首页、README两张PNG。
- **G02**：武汉GitHub页面8秒滚动；同样保留两张PNG。

## 来源与录制

纽约来自原作者正式体验地址 https://mrdoob.github.io/slop-newyork/ ，本次自己操作、录制，没有搬用社交平台上他人的演示视频。录制时核对的main为e35c06c0d896052a80ff117aefe8b99e978913d4，与本机固定参考一致。只在录制浏览器中增加逐帧控制，保留原始场景和车辆物理。

原版仓库：https://github.com/mrdoob/slop-newyork  
武汉仓库：https://github.com/LightYearZh/slop-wuhan  
武汉体验：https://lightyearzh.github.io/slop-wuhan/

GitHub页面在独立、未登录的浏览器中实际打开并滚动，没有编辑页面内容；截图为1920×1080。页面和仓库信息为录制当天状态。纽约原版代码使用MIT许可；README明确邀请制作动画和影片，数据仍保留NYC Open Data、OpenStreetMap等归属。简介里保留mrdoob与原项目链接。

过渡武汉侧取自W05原片第6秒起的4.5秒。TR片是两个真实运行镜头的剪辑叠化，不是城市几何实际变形、一键生成过程或同一条连续驾驶路线。它适合配在“我看到纽约的这个项目，就想换成武汉试试”附近。保持视频中原作与武汉的身份清楚，不把纽约镜头算作武汉场景。

六段MP4均为1080p30无声音轨；四张PNG可单独用。TR01与TR02为派生剪辑，不重复累计原始素材时长。网页首页和README截图可以任选一种，不必在成片里全部放。
''')
cards=''.join('<article><h2>'+html.escape(r['文件'])+'</h2><video controls preload="none" src="'+html.escape(r['文件'],quote=True)+'"></video><p>'+str(r['秒'])+'秒 · '+r['类型']+'</p></article>'for r in rows)
images=''.join('<article><h2>'+html.escape(f.name)+'</h2><a href="'+html.escape(f.name,quote=True)+'"><img src="'+html.escape(f.name,quote=True)+'"></a></article>'for f in sorted(out.glob('*.png')))
(out/'素材预览.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>纽约到武汉 · 补录素材</title><style>body{background:#151b20;color:#eef5f3;font:16px/1.6 system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{padding:16px;background:#253038;border-radius:12px}h2{font-size:18px}img,video{width:100%}p{color:#c6d4d2}</style><h1>纽约原版 → 武汉 · 补录素材</h1><p>4段原始画面、2个8秒过渡剪辑、4张网页PNG。均为1080p，视频30fps无声。原作画面与武汉画面已分别标明。</p><main>'+cards+images+'</main></html>')
summary={'videos':rows,'stills':[f.name for f in sorted(out.glob('*.png'))],'originalSource':'https://mrdoob.github.io/slop-newyork/','upstreamCommit':'e35c06c0d896052a80ff117aefe8b99e978913d4','transition':'NY01[1:5] + W05[6:10.5], 0.5-second crossfade; derivative examples, no synchronized audio'}
(out/'验收.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
rootnote=root/'先看这里-素材说明.md'
s=rootnote.read_text();marker='## 新增：纽约原版与仓库页面'
if marker not in s:
 s+='\n'+marker+'\n\n新增目录：`2026-11-01_纽约来源与过渡/`。内有原版纽约两段8秒实录、原版与武汉GitHub页面各一段8秒滚动及首页/README截图，并提供两个纽约→武汉的8秒过渡剪辑。打开该目录的`素材预览.html`或`说明.md`选用。原有两批39段的统计不包含本次新增；过渡为派生剪辑，不重复计算原始时长。\n'
 rootnote.write_text(s)
preview=root/'总素材预览.html'
s=preview.read_text();link='<p><a href="2026-11-01_纽约来源与过渡/素材预览.html">新增：纽约原版 → 武汉过渡、两个GitHub页面及截图</a></p>'
if '纽约原版 → 武汉过渡' not in s:s=s.replace('</h1>','</h1>'+link,1);preview.write_text(s)
print(json.dumps({'videos':len(rows),'stills':len(summary['stills']),'transitionSeconds':8},ensure_ascii=False))
