// A dependency-free static preview for the delivered bundle.
import http from 'node:http';import {promises as fs} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.basename(here)==='tools'?path.join(here,'..','dist'):here;
const portIndex=process.argv.indexOf('--port'),port=Number(portIndex<0?4187:process.argv[portIndex+1]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Shanghai roaming: http://127.0.0.1:'+port));
