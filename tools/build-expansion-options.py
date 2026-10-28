"""Build an offline comparison map; this does not change playable game bounds."""
from pathlib import Path
import json, math
from shapely.geometry import LineString, Polygon, box
from shapely import make_valid

root=Path(__file__).resolve().parents[1]
base=json.loads((root/'data/source/shanghai-basemap.json').read_text())
lat=31.237;rad=math.pi/180;e2=6.69437999014e-3;s=math.sin(lat*rad)
sx=rad*6378137/math.sqrt(1-e2*s*s)*math.cos(lat*rad)
sz=rad*6378137*(1-e2)/(1-e2*s*s)**1.5
options=[
 {'id':'A','name':'经典城区','bounds':[121.465,31.212,121.525,31.258],'places':'人民广场 · 南京东路西侧街区 · 新天地 · 北外滩更多街区','impact':'保留为原方案对照，用户最终选择更大的B档。'},
 {'id':'B','name':'中心城区','bounds':[121.44,31.20,121.54,31.265],'places':'再加入静安寺—南京西路 · 淮海路 · 田子坊 · 南浦大桥地面周边 · 源深','impact':'用户已选B，0.2.0按此范围实施。新增四处独立外观，保留10米游戏洞宽隧道。'},
 {'id':'C','name':'浦江城市漫游','bounds':[121.43,31.185,121.57,31.285],'places':'再加入徐家汇 · 世博滨江 · 世纪公园 · 杨浦滨江部分区段','impact':'适合分期扩展。先把道路、水面和远景按块加载，再逐区补充细节与地标。'}
]
current=[121.477,31.22,121.52,31.25]
def area(b):return round((b[2]-b[0])*(b[3]-b[1])*sx*sz/1e6,1)
for opt in options:
 opt['area']=area(opt['bounds']);opt['ratio']=round(opt['area']/area(current),1)
extent=box(*options[-1]['bounds'])
def lines(g):
 if g.geom_type=='LineString':return [list(g.coords)]
 return [v for sub in getattr(g,'geoms',[]) for v in lines(sub)]
def polys(g):
 if g.geom_type=='Polygon':return [[list(g.exterior.coords)]+[list(r.coords) for r in g.interiors]]
 return [v for sub in getattr(g,'geoms',[]) for v in polys(sub)]
roads=[];water=[];parks=[]
for road in base['roads']:
 line=LineString(road['p'])
 if line.intersects(extent):roads.extend(lines(line.intersection(extent)))
for a in base['areas']:
 if a['c'] not in ('water','park','green'):continue
 try:g=make_valid(Polygon(a['p'])).intersection(extent)
 except:continue
 (water if a['c']=='water' else parks).extend(polys(g))
payload={'options':options,'current':current,'currentArea':area(current),'roads':roads,'water':water,'parks':parks,'scale':[sx,sz]}
template='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>上海漫游 · 扩区方案对照</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#ece8dd;color:#173e3c;font:15px/1.7 system-ui,"PingFang SC",sans-serif}main{max-width:1320px;margin:auto;padding:36px}header{display:flex;justify-content:space-between;align-items:end;gap:24px}h1{font-size:32px;letter-spacing:.04em;margin:0}header p{margin:8px 0 0;color:#57716d}.tag{border:1px solid #b4c7bf;padding:6px 12px;white-space:nowrap;border-radius:30px}section{display:grid;grid-template-columns:320px 1fr;gap:24px;margin-top:28px}.choices{display:grid;gap:12px;align-content:start}button{font:inherit;text-align:left;color:inherit;border:1px solid #b3c1b7;background:#f7f6ef;padding:20px;cursor:pointer;border-radius:12px}button.active{background:#173e3c;color:#fff;border-color:#173e3c}button strong{font-size:23px;display:block}button small{display:block;opacity:.78}button:focus-visible{outline:3px solid #c47c41;outline-offset:3px}.map{position:relative;border:1px solid #b5c2b8;border-radius:12px;background:#f8f5eb;overflow:hidden}canvas{display:block;width:100%;height:590px}.legend{position:absolute;top:16px;left:16px;background:#fffef3e8;border:1px solid #cbd2c3;padding:9px 12px;border-radius:7px;font-size:12px}.legend i{display:inline-block;width:24px;height:3px;background:#ba713a;vertical-align:middle;margin-right:5px}.legend i.current{background:#173e3c}.detail{margin-top:20px;padding:20px 24px;background:#f8f6ed;border-radius:12px}.detail h2{margin:0 0 6px;font-size:20px}.detail p{margin:5px 0}.note{font-size:12px;color:#61716a;margin:20px 0 0}a{color:#1e6765}@media(max-width:850px){main{padding:20px}header{display:block}.tag{display:inline-block;margin-top:12px}section{grid-template-columns:1fr}.choices{grid-template-columns:repeat(3,1fr);gap:8px}button{padding:12px}button strong{font-size:18px}button small{font-size:11px}canvas{height:460px}}
</style><main><header><div><h1>下一段，开到哪里？</h1><p>以当前外滩—陆家嘴为起点，比较三档扩展范围。</p></div><div class="tag">当前开放约 13.6 km²</div></header><section><nav class="choices" aria-label="扩区方案"></nav><div class="map"><canvas aria-label="上海道路、水系与候选范围示意图"></canvas><div class="legend"><i class="current"></i>当前开放　<i></i>所选方案<br>北 ↑ · 源数据：OpenStreetMap</div></div></section><article class="detail" aria-live="polite"></article><p class="note">此图仅用于范围选择，尚未扩大游戏区域。面积是候选矩形的含水域面积，边缘会按道路连接调整。地理底图来自已固定的 OSM 缓存，街区名称与标签为范围提示；范围纳入不等于所有建筑都制作专门模型。新增桥隧是否可驾驶需随所选方案单列核验。<br>© OpenStreetMap contributors · ODbL 1.0 · 资料日期 2026-09-08。<a href="https://lhsr.sh.gov.cn/ywdt/20241119/cb242c12-5ff5-456e-ac08-61c34df6ad39.html">经典城区街区参考</a> · <a href="https://www.shanghai.gov.cn/shanghai/newshanghai/shgl2025.pdf">上海旅游地标参考</a></p></main><script>
const data=__DATA__;let active=0;const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),nav=document.querySelector('nav'),detail=document.querySelector('.detail');
data.options.forEach((o,i)=>{const b=document.createElement('button');b.innerHTML=`<strong>${o.id} · 约 ${Math.round(o.area)} km²</strong><span>${o.name}${i===0?' · 推荐':''}</span><small>当前的 ${o.ratio} 倍 · 点击查看范围</small>`;b.onclick=()=>{active=i;render()};nav.append(b)});
function render(){const opt=data.options[active];[...nav.children].forEach((b,i)=>{b.classList.toggle('active',i===active);b.setAttribute('aria-pressed',i===active)});detail.innerHTML=`<h2>${opt.id} · ${opt.name} / ${opt.area} km²</h2><p>${opt.places}</p><p>${opt.impact}</p>`;
const w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#f8f5eb';ctx.fillRect(0,0,w,h);
const b=opt.bounds,cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,scale=Math.min((w-70)/((b[2]-b[0])*data.scale[0]),(h-70)/((b[3]-b[1])*data.scale[1]));const p=q=>[w/2+(q[0]-cx)*data.scale[0]*scale,h/2-(q[1]-cy)*data.scale[1]*scale];
function path(rings){ctx.beginPath();for(const ring of rings){ring.forEach((q,i)=>{const t=p(q);i?ctx.lineTo(...t):ctx.moveTo(...t)});ctx.closePath()}}
for(const poly of data.parks){path(poly);ctx.fillStyle='#d2ddc3';ctx.fill('evenodd')}for(const poly of data.water){path(poly);ctx.fillStyle='#a4c8c9';ctx.fill('evenodd')}
ctx.strokeStyle='#c9cebf';ctx.lineWidth=.65;ctx.beginPath();for(const line of data.roads)line.forEach((q,i)=>{const t=p(q);i?ctx.lineTo(...t):ctx.moveTo(...t)});ctx.stroke();
function rect(r,color,fill){const a=p([r[0],r[3]]),z=p([r[2],r[1]]);if(fill){ctx.fillStyle=fill;ctx.fillRect(a[0],a[1],z[0]-a[0],z[1]-a[1])}ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.strokeRect(a[0],a[1],z[0]-a[0],z[1]-a[1])}
rect(opt.bounds,'#ba713a','#ba713a0b');rect(data.current,'#173e3c','#173e3c14');
const labels=[['外滩',121.485,31.238],['陆家嘴',121.504,31.239],['人民广场',121.476,31.230],['新天地',121.475,31.219],['北外滩',121.504,31.254],['静安寺',121.445,31.223],['田子坊',121.469,31.210],['源深',121.533,31.234],['徐家汇',121.437,31.194],['世博滨江',121.489,31.190],['世纪公园',121.553,31.215],['杨浦滨江',121.544,31.259]];
ctx.font='12px system-ui';ctx.textBaseline='middle';for(const [name,lon,lat]of labels){if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue;const [x,y]=p([lon,lat]);ctx.fillStyle='#173e3c';ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='#f8f5eb';ctx.strokeText(name,x+6,y-8);ctx.fillText(name,x+6,y-8)}
const km=active===0?1:2,l=km*1000*scale;ctx.strokeStyle='#173e3c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w-28-l,h-25);ctx.lineTo(w-28,h-25);ctx.stroke();ctx.fillText(km+' km',w-28-l,h-39);
}new ResizeObserver(render).observe(canvas);render();
</script></html>'''
template=(template.replace('下一段，开到哪里？','B档已选，中心城区扩展')
 .replace('以当前外滩—陆家嘴为起点，比较三档扩展范围。','以扩区前外滩—陆家嘴为基线，保留三档决策对照。')
 .replace('当前开放约 13.6 km²','0.2.0 · B档约 68.7 km²')
 .replace('当前开放　','扩区前开放　')
 .replace('此图仅用于范围选择，尚未扩大游戏区域。','用户已选择B。此图保留范围决策对照；0.2.0的实际验收见同目录acceptance/0.2.0/REPORT.md。')
 .replace('let active=0','let active=1').replace("i===0?' · 推荐'","i===1?' · 已选'"))
(root/'docs/expansion-options.html').write_text(template.replace('__DATA__',json.dumps(payload,ensure_ascii=False,separators=(',',':'))))
print(json.dumps({'currentArea':area(current),'options':options,'roads':len(roads),'water':len(water)},ensure_ascii=False,indent=2))
