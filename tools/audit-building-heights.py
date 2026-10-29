"""Scan every generated building; review flags are candidates, never automatic height overrides."""
import csv,json,re,collections,hashlib
from pathlib import Path
from shapely.geometry import Polygon
ROOT=Path(__file__).resolve().parents[1]
def audit(city):
 rows=[]
 for b in city['buildings']:
  area=Polygon(b['rings'][0],b['rings'][1:]).area;reasons=[];priority=0
  business=bool(re.search('大厦|广场|金融|中心',b['name'])) and not re.search('旧址|教学|学校|实验|动物|游客|服务|博物|科普|计量|传媒',b['name']) and b['category']!='historic'
  if b['heightSource']=='visual-estimate' and business:reasons.append('有名称的商务或公共建筑仍使用占位高度');priority+=3
  if b['heightSource'].startswith('3D-GloBFP') and business and b['h']<35:reasons.append('有名称的商务建筑仅有低矮模型估计');priority+=2
  if b['h']>=120 and area>=4500 and not b.get('massingParts'):reasons.append('大占地整体等高挤出，需核对塔楼与裙房');priority+=2
  if b['heightSource']=='OSM:levels' and b['h']>=120:reasons.append('高层米数仅由楼层换算，需核对层高和用途');priority+=1
  if reasons:rows.append({'id':b['id'],'name':b['name']or'未命名','x':b['x'],'z':b['z'],'heightM':b['h'],'heightSource':b['heightSource'],'footprintAreaM2':round(area,1),'priority':priority,'reviewReasons':reasons,'status':'待核对；非确认错误'})
 rows.sort(key=lambda b:(-b['priority'],b['name'],b['id']))
 return {'scannedBuildings':len(city['buildings']),'flaggedCandidates':len(rows),'heightSources':dict(collections.Counter(b['heightSource'] for b in city['buildings'])),'rule':'Flags identify review candidates, not ground truth; no automatic multiplication or matching relaxation.','boundsWgs84':city['region']['boundsWgs84'],'candidates':rows}
def main():
 source=ROOT/'public/data/city.json';city=json.loads(source.read_text());report=audit(city);report['sourceCitySha256']=hashlib.sha256(source.read_bytes()).hexdigest()
 out=ROOT/'docs/acceptance/0.8.0';out.mkdir(parents=True,exist_ok=True)
 (out/'height-scan.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 with (out/'height-review.csv').open('w')as f:
  w=csv.writer(f);w.writerow(['建筑ID','名称','当前高度m','来源','占地面积m²','局部X','局部Z','核对原因','状态'])
  for b in report['candidates']:w.writerow([b['id'],b['name'],b['heightM'],b['heightSource'],b['footprintAreaM2'],b['x'],b['z'],'；'.join(b['reviewReasons']),b['status']])
 print(json.dumps({k:v for k,v in report.items()if k!='candidates'},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
