import {promises as fs} from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
const args=process.argv.slice(2),rootIndex=args.indexOf('--root'),evidence=rootIndex<0?'docs/acceptance':args.splice(rootIndex,2)[1],root=path.join(evidence,'recordings');
const requested=new Set(args);
for(const d of (await fs.readdir(root)).filter(n=>n.startsWith('raw-')&&(!requested.size||requested.has(n.slice(4))))){const dir=path.join(root,d),label=d.slice(4);if(!await fs.access(path.join(dir,'frames.ffconcat')).then(()=>true,()=>false))continue;
 const rawDrive=path.join(evidence,'drives',label+'.json');let trim=[];if(await fs.access(rawDrive).then(()=>true,()=>false)){const run=JSON.parse(await fs.readFile(rawDrive));trim=['-t',String(run.duration/1000+2)];}
 await new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(dir,'frames.ffconcat'),...trim,'-fps_mode','vfr','-c:v','libx264','-threads','2','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',path.join(root,label+'.mp4')],{stdio:'inherit'});p.on('exit',c=>c===0?resolve():reject(Error('ffmpeg '+c)));});
 const stat=await fs.stat(path.join(root,label+'.mp4'));if(stat.size<1000)throw Error('empty recording');await fs.rm(dir,{recursive:true});console.log(label,stat.size);
}
