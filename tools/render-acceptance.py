"""Render reproducible acceptance plots and screenshot contact sheets."""
from pathlib import Path
import json,math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/acceptance'
def read(name):return json.loads((OUT/name).read_text())
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.grid':True,'grid.alpha':.18,'figure.facecolor':'#f8f7f2','axes.facecolor':'#f8f7f2','savefig.facecolor':'#f8f7f2'})
names={'car':'Driving','person':'Walking','cyclist':'Cycling','helicopter':'Flying'}
colors=['#236e67','#d3923b','#5b76a6','#986a80']
car=read('car-performance.json');runs=[car]+[read('modes/'+n+'.json') for n in ['person','cyclist','helicopter']]
fig,axs=plt.subplots(1,2,figsize=(12,4),layout='constrained')
values=[]
for i,run in enumerate(runs):
 samples=np.sort(run['frameTimes']);label=names['car' if i==0 else run['mode']];values.append(float(np.quantile(samples,.95,method='higher')))
 axs[0].plot(samples,np.arange(1,len(samples)+1)/len(samples),color=colors[i],label=label)
axs[0].axvline(33.3,color='#a94e43',ls='--',label='33.3 ms target');axs[0].set(xlim=(0,65),ylim=(.5,1),xlabel='Frame time (ms)',ylabel='Cumulative fraction',title='Five minute foreground samples');axs[0].legend(loc='lower right',fontsize=8)
axs[1].bar(names.values(),values,color=colors,width=.58);axs[1].axhline(33.3,color='#a94e43',ls='--');axs[1].set(ylabel='P95 frame time (ms)',ylim=(0,max(38,max(values)*1.2)),title='Medium / 1920×1080 / WebGPU')
for i,value in enumerate(values):axs[1].text(i,value+.7,f'{value:.2f}',ha='center')
fig.savefig(OUT/'performance.png',dpi=170);plt.close(fig)

stability=read('stability.json');s=stability['series'];minute=np.array([r['ms']/60000 for r in s])
fig,axs=plt.subplots(2,1,figsize=(12,6),sharex=True,layout='constrained')
axs[0].plot(minute,[r['memory']['total']/1024**2 for r in s],color=colors[0],label='Tracked GPU resources');axs[0].set(ylabel='MiB',title='Continuous session resource history');axs[0].legend()
axs[1].plot(minute,[r['memory']['geometries'] for r in s],color=colors[2],label='Geometries');r=axs[1].twinx();r.plot(minute,[v['tiles'] for v in s],color=colors[1],label='Loaded tiles');r.set_ylabel('Tiles');axs[1].set(xlabel='Session time (minutes)',ylabel='Geometries');axs[1].legend(loc='upper left');r.legend(loc='upper right');fig.savefig(OUT/'stability.png',dpi=170);plt.close(fig)

cycle=read('lifecycle.json');rs=cycle['rounds'];fig,axs=plt.subplots(1,3,figsize=(12,3.8),layout='constrained')
for ax,key,label in zip(axs,['geometries','uniformBuffers','textures'],['Geometries','Uniform buffers','Textures']):
 ax.plot([r['round'] for r in rs],[r['memory'][key] for r in rs],marker='o',color=colors[0]);ax.axvspan(.5,2.5,color='#ddd4b8',alpha=.4);ax.set(xlabel='Round trip',ylabel='Count',title=label);ax.set_xticks(range(2,13,2))
fig.suptitle('Same landing after two warmups + ten region round trips');fig.savefig(OUT/'lifecycle.png',dpi=170);plt.close(fig)

data=json.loads((ROOT/'public/data/city.json').read_text());fig,axs=plt.subplots(1,2,figsize=(12,5.5),layout='constrained')
for rings in data['water']:
 axs[0].add_patch(Polygon(rings[0],facecolor='#bdd8dc',edgecolor='none'))
for r in data['roads']:axs[0].plot([p[0] for p in r['points']],[p[2] for p in r['points']],color='#c4c4b8',lw=.4,zorder=0)
for i,t in enumerate(data['tunnels']):
 p=np.array(t['points']);axs[0].plot(p[:,0],p[:,2],color=colors[i],lw=2,label=t['id']);distance=np.r_[0,np.cumsum(np.sqrt(np.diff(p[:,0])**2+np.diff(p[:,2])**2))];axs[1].plot(distance,p[:,1],color=colors[i],lw=2,label=t['id'])
for file in (OUT/'drives').glob('*.json'):
 r=json.loads(file.read_text());ps=np.array([[p['x'],p['z']] for p in r.get('trace',[])]);
 if len(ps):axs[0].plot(ps[:,0],ps[:,1],color='#a44d3f',lw=.35,alpha=.4)
b=data['bounds'];axs[0].set(xlim=(b[0],b[2]),ylim=(b[3],b[1]),xlabel='East (m)',ylabel='South (m)',title='Recorded physical driving trajectories',aspect='equal');axs[0].legend();axs[1].axhline(0,color='#8c948a',lw=.7);axs[1].set(xlabel='Route chainage (m)',ylabel='Road height (m)',title='Two bores / marked visual height estimate');axs[1].legend();fig.savefig(OUT/'driving-trajectories.png',dpi=170);plt.close(fig)

shots=read('screenshots.json');thumbw,thumbh=384,216;canvas=Image.new('RGB',(thumbw*6,(thumbh+30)*3),(243,241,233));draw=ImageDraw.Draw(canvas)
for item in shots:
 row=['midday','golden','midnight'].index(item['time']);col=item['index'];im=Image.open(OUT/'screenshots'/item['file']).convert('RGB');im.thumbnail((thumbw,thumbh));x,y=col*thumbw,row*(thumbh+30);canvas.paste(im,(x,y));draw.text((x+10,y+thumbh+7),'V'+str(col+1)+' / '+item['time'],fill='#243b3b')
canvas.save(OUT/'fixed-views-contact.jpg',quality=92)
if (OUT/'landmark-screenshots.json').exists():
 lm=read('landmark-screenshots.json');canvas=Image.new('RGB',(thumbw*4,(thumbh+30)*4),(243,241,233));draw=ImageDraw.Draw(canvas)
 for i,item in enumerate(lm):
  im=Image.open(OUT/'screenshots'/item['file']).convert('RGB');im.thumbnail((thumbw,thumbh));x,y=i%4*thumbw,i//4*(thumbh+30);canvas.paste(im,(x,y));draw.text((x+10,y+thumbh+7),item['id']+' / '+item['distance'],fill='#243b3b')
 canvas.save(OUT/'landmarks-contact.jpg',quality=92)
print('Rendered performance, stability, lifecycle, trajectories, and visual contact sheets')
