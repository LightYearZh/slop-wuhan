import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync}from'node:child_process';
const root=process.argv[2]||'docs/acceptance',labels=process.argv.length>3?process.argv.slice(3):['east-midday-release','west-midday-release','east-midnight-release','west-midnight-release','east-golden-release','west-golden-release','four-modes-release'],results=[];
for(const label of labels){
 const file=path.join(root,'recordings',label+'.mp4'),metadata=JSON.parse(fs.readFileSync(path.join(root,'recordings',label+'.json')));
 const probe=JSON.parse(execFileSync('rtk',['proxy','ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height,avg_frame_rate','-of','json',file],{encoding:'utf8'}));
 const video=probe.streams.find(s=>s.codec_type==='video');if(!video||video.codec_name!=='h264'||video.width<960||video.width>1280||video.height<540||video.height>720)throw Error('Unexpected native screencast format '+label);
 if(Number(probe.format.duration)<metadata.duration*.97)throw Error('Incomplete encoded duration '+label);
 execFileSync('rtk',['proxy','ffmpeg','-v','error','-xerror','-threads','2','-i',file,'-f','null','-'],{stdio:['ignore','ignore','pipe']});
 results.push({label,file,sourceSeconds:metadata.duration,encodedSeconds:Number(probe.format.duration),bytes:Number(probe.format.size),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),stream:video,fullDecode:'passed'});
}
fs.writeFileSync(path.join(root,'recordings/encoded-audit.json'),JSON.stringify({at:new Date().toISOString(),videos:results},null,2));console.log(results.map(r=>({label:r.label,seconds:r.encodedSeconds,fullDecode:r.fullDecode})));
