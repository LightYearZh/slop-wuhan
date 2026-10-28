import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try{
    const raw=decodeURIComponent((req.url||'/').split('?')[0]);
    const requestPath=raw==='/'?'/web/':raw;
    const name=path.resolve(root,`.${requestPath}`);
    if(name!==root&&!name.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const st=await fs.stat(name).catch(()=>null);
    const file=st?.isDirectory()?path.join(name,'index.html'):name;
    const data=await fs.readFile(file);
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});
    res.end(data);
  }catch(e){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');}
});
const port=Number(process.env.PORT||4799);
server.listen(port,'127.0.0.1',()=>console.log(`Slop Wuhan → http://127.0.0.1:${port}/web/`));
