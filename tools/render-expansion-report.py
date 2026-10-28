"""Plots from immutable 0.2.0 evidence; original screenshots are left untouched."""
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/acceptance/0.2.0'
def read(name):return json.loads((OUT/name).read_text())
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.grid':True,'grid.alpha':.18,'figure.facecolor':'#f8f7f2','axes.facecolor':'#f8f7f2','savefig.facecolor':'#f8f7f2'})
ids=['person','car','cyclist','helicopter'];names=['Walking','Driving','Cycling','Flying'];colors=['#236e67','#d3923b','#5b76a6','#986a80']
runs=[read('modes/'+id+'.json') for id in ids]
fig,axs=plt.subplots(1,2,figsize=(12,4),layout='constrained')
for label,r,color in zip(names,runs,colors):
    s=np.sort(r['frameTimes']);axs[0].plot(s,np.arange(1,len(s)+1)/len(s),label=label,color=color)
axs[0].axvline(33.3,color='#a94e43',ls='--',label='33.3 ms target');axs[0].set(xlim=(0,70),ylim=(.5,1),xlabel='Frame time (ms)',ylabel='Cumulative fraction',title='Five-minute continuous samples');axs[0].legend(fontsize=8)
values=[r['metrics']['p95'] for r in runs];axs[1].bar(names,values,color=colors,width=.58);axs[1].axhline(33.3,color='#a94e43',ls='--');axs[1].set(ylabel='P95 frame time (ms)',ylim=(0,max(38,max(values)*1.2)),title='Medium / 1920x1080 / WebGPU')
for i,v in enumerate(values):axs[1].text(i,v+.7,f'{v:.2f}',ha='center')
fig.savefig(OUT/'performance.png',dpi=170);plt.close(fig)

stable=read('stability.json');life=read('lifecycle.json');s=stable['series'];fig,axs=plt.subplots(2,2,figsize=(12,7),layout='constrained')
minutes=[r['ms']/60000 for r in s];axs[0,0].plot(minutes,[r['memory']['total']/1048576 for r in s],color=colors[0]);axs[0,0].set(xlabel='Session minutes',ylabel='Tracked GPU MiB',title='Foreground continuous session')
axs[0,1].plot(minutes,[r['tiles'] for r in s],color=colors[2]);axs[0,1].set(xlabel='Session minutes',ylabel='Loaded tiles',title='Streaming across B region')
for ax,key,label in [(axs[1,0],'geometries','Geometries'),(axs[1,1],'uniformBuffers','Uniform buffers')]:
    ax.plot([r['round'] for r in life['rounds']],[r['memory'][key] for r in life['rounds']],marker='o',color=colors[0]);ax.axvspan(.5,2.5,color='#ddd4b8',alpha=.4);ax.set(xlabel='Jingan - Yuanshen round trip',ylabel='Count',title=label);ax.set_xticks(range(2,13,2))
fig.savefig(OUT/'resources.png',dpi=170);plt.close(fig)

data=json.loads((ROOT/'public/data/city.json').read_text());fig,axs=plt.subplots(1,2,figsize=(12,5.5),layout='constrained')
for rings in data['water']:axs[0].add_patch(Polygon(rings[0],facecolor='#bdd8dc',edgecolor='none'))
for r in data['roads']:
    if any(-2000<p[0]<1000 and -1200<p[2]<1000 for p in r['points']):axs[0].plot([p[0] for p in r['points']],[p[2] for p in r['points']],color='#c4c4b8',lw=.35,zorder=0)
for i,t in enumerate(data['tunnels']):
    p=np.array(t['points']);axs[0].plot(p[:,0],p[:,2],color=colors[i],lw=2,label=t['id']);distance=np.r_[0,np.cumsum(np.sqrt(np.diff(p[:,0])**2+np.diff(p[:,2])**2))];axs[1].plot(distance,p[:,1],color=colors[i],lw=2,label=t['id'])
for direction in ['east','west']:
    for time in ['midday','golden','midnight']:
        r=read(f'drives/{direction}-{time}-release.json');p=np.array([[p['x'],p['z']] for p in r['trace']]);axs[0].plot(p[:,0],p[:,1],color='#a44d3f',lw=.5,alpha=.4)
axs[0].set(xlim=(-2000,1000),ylim=(1000,-1200),xlabel='East (m)',ylabel='South (m)',title='Six physical trips, no in-trip teleport',aspect='equal');axs[0].legend();axs[1].axhline(0,color='#8c948a',lw=.7);axs[1].set(xlabel='Route chainage (m)',ylabel='Road height (m)',title='Bore profiles: marked visual estimate');axs[1].legend();fig.savefig(OUT/'driving-trajectories.png',dpi=170);plt.close(fig)

shots=read('screenshots.json')+read('new-screenshots.json')
for time in ['midday','golden','midnight']:
    selected=[s for s in shots if s['time']==time];w,h=384,216;sheet=Image.new('RGB',(w*4,(h+28)*3),'#f3f1e9');draw=ImageDraw.Draw(sheet)
    for i,item in enumerate(selected):
        with Image.open(OUT/'screenshots'/item['file']) as image:
            assert image.size==(1920,1080),item['file'];thumb=image.convert('RGB');thumb.thumbnail((w,h));x,y=(i%4)*w,(i//4)*(h+28);sheet.paste(thumb,(x,y));draw.text((x+9,y+h+7),item['file'].removesuffix('.png'),fill='#243b3b')
    sheet.save(OUT/f'contact-{time}.jpg',quality=92)
print('Rendered performance, resource histories, six driving traces, and three contact sheets.')
