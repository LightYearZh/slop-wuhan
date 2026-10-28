if(!acceptanceSuite.done||acceptanceSuite.error)throw Error('Finish the driving/mode suite before changing fixed cameras');
await page.evaluate(async()=>{shanghai.controllers.clearGamepadInput();await shanghai.setMode('car');document.getElementById('map-modal').hidden=true;document.getElementById('places').hidden=true;document.getElementById('toast').hidden=true;document.body.classList.add('clean');});
await evidenceFs.mkdir(evidenceRoot+'/screenshots',{recursive:true});const shots=[];
for(let i=0;i<6;i++)for(const time of ['midday','golden','midnight']){
 const view=await page.evaluate(async({i,time})=>{const app=shanghai,v=app.views[i],dx=v.target[0]-v.position[0],dz=v.target[2]-v.position[2],len=Math.hypot(dx,dz)||1;await app.teleport(v.position[0]-dx/len*120,v.position[2]-dz/len*120);await app.loader.ensureAt({x:v.position[0],z:v.position[2]},'person');app.setTime(time);app.setView(i);document.getElementById('toast').hidden=true;await new Promise(resolve=>{let n=0;const next=()=>++n>=12?resolve():requestAnimationFrame(next);requestAnimationFrame(next);});return v;},{i,time});
 const shot=await page.screenshot({clip:{x:0,y:0,width:1728,height:972},scale:'css'}),name='V'+(i+1)+'-'+time+'.png';await evidenceFs.copyFile(shot.path,evidenceRoot+'/screenshots/'+name);shots.push({file:name,time,view,index:i,width:shot.width,height:shot.height,sha256:shot.sha256});
}
await evidenceFs.writeFile(evidenceRoot+'/screenshots.json',JSON.stringify(shots,null,2));await page.evaluate(()=>document.body.classList.remove('clean'));return {count:shots.length,files:shots.map(s=>s.file)};
