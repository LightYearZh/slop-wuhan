"""Keep the current foreground Tabbit acceptance session leased; no scene mutations."""
from pathlib import Path
import subprocess,json,time,sys
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--task',default='上海漫游验收');parser.add_argument('--output',default='docs/acceptance');parser.add_argument('--diagnostic',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
cli='/Users/wuyanji/.local/bin/tabbit-cli'
program="return {phase:globalThis.acceptanceSuite?.phase,done:globalThis.acceptanceSuite?.done,error:globalThis.acceptanceSuite?.error,visible:await page.evaluate(()=>document.visibilityState),url:page.url()};"
previous=None;diagnostic=args.diagnostic
with (root/args.output/'browser-heartbeat.jsonl').open('a') as log:
 for i in range(240):
  stop=root/'.cache/stop-browser-heartbeat'
  if stop.exists():stop.unlink();break
  result=subprocess.run(['rtk','proxy',cli,'nodejs','--task',args.task,'--request-id','test-lease-'+str(time.time_ns())],input=program,text=True,capture_output=True)
  try:
   receipt=json.loads(result.stdout);value=receipt.get('result',{}).get('value',{});row={'at':time.time(),'status':receipt.get('status'),**value}
   log.write(json.dumps(row,ensure_ascii=False)+'\n');log.flush()
   if result.returncode or (value.get('error') and not diagnostic) or value.get('url')!='http://127.0.0.1:4187/' or value.get('visible')!='visible':print(row,flush=True);sys.exit(1)
   if value.get('phase')!=previous:print(row,flush=True);previous=value.get('phase')
   if value.get('done') and not diagnostic:break
  except Exception as error:print(result.stdout,result.stderr,str(error),flush=True);sys.exit(1)
  time.sleep(25)
