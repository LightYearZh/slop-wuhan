// Load once through tabbit-cli nodejs. Captures only this owned page via CDP.
globalThis.evidenceFs=await import('node:fs/promises');
globalThis.evidenceRoot='/Users/wuyanji/Desktop/上海漫游/docs/acceptance';
globalThis.evidenceCDP=globalThis.acceptCDP||await context.newCDPSession(page);
globalThis.recording=null;
globalThis.beginRecording=async label=>{
 if(recording)throw Error('recording already active');const directory=evidenceRoot+'/recordings/raw-'+label;await evidenceFs.mkdir(directory,{recursive:true});
 const r=recording={label,directory,frames:[],pending:[],failed:[]};
 r.listener=event=>{
  const name='frame-'+String(r.frames.length).padStart(6,'0')+'.jpg';r.frames.push({name,time:event.metadata.timestamp});
  const p=evidenceFs.writeFile(directory+'/'+name,Buffer.from(event.data,'base64')).catch(e=>r.failed.push(String(e)));r.pending.push(p);
  evidenceCDP.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(e=>r.failed.push(String(e)));
 };
 evidenceCDP.on('Page.screencastFrame',r.listener);await evidenceCDP.send('Page.startScreencast',{format:'jpeg',quality:65,maxWidth:1280,maxHeight:720,everyNthFrame:12});return {label,directory};
};
globalThis.endRecording=async()=>{
 const r=recording;if(!r)return null;await evidenceCDP.send('Page.stopScreencast');evidenceCDP.off('Page.screencastFrame',r.listener);await Promise.all(r.pending);
 const lines=['ffconcat version 1.0'];for(let i=0;i<r.frames.length;i++){lines.push("file '"+r.frames[i].name+"'");if(i<r.frames.length-1)lines.push('duration '+Math.max(.001,r.frames[i+1].time-r.frames[i].time));}
 if(r.frames.length)lines.push("file '"+r.frames.at(-1).name+"'");await evidenceFs.writeFile(r.directory+'/frames.ffconcat',lines.join('\n'));
 const summary={label:r.label,frames:r.frames.length,duration:r.frames.length>1?r.frames.at(-1).time-r.frames[0].time:0,errors:r.failed,format:'CDP owned-page native JPEG, maximum bounds 1280x720; actual dimensions in encoded-audit.json; timestamps preserved in VFR encode'};
 await evidenceFs.writeFile(evidenceRoot+'/recordings/'+r.label+'.json',JSON.stringify(summary,null,2));recording=null;return summary;
};
return {ready:true};
