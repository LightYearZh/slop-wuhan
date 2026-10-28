await page.evaluate(()=>{document.getElementById('map-modal').hidden=true;document.getElementById('places').hidden=true;document.body.classList.add('clean');shanghai.controllers.clearGamepadInput();});
const shots=[],times=await page.evaluate(()=>window.screenshotTimes||['midday','golden','midnight']);await evidenceFs.mkdir(evidenceRoot+'/screenshots',{recursive:true});
const count=await page.evaluate(()=>shanghai.views.length);
for(let i=6;i<count;i++)for(const time of times){
 const view=await page.evaluate(async({i,time})=>{const app=shanghai,v=app.views[i],dx=v.target[0]-v.position[0],dz=v.target[2]-v.position[2],len=Math.hypot(dx,dz)||1;await app.teleport(v.position[0]-dx/len*120,v.position[2]-dz/len*120);await app.loader.ensureAt({x:v.position[0],z:v.position[2]},'person');app.setTime(time);app.setView(i);document.getElementById('toast').hidden=true;await new Promise(resolve=>{let n=0;const next=()=>++n>=12?resolve():requestAnimationFrame(next);requestAnimationFrame(next);});return v;},{i,time});
 const shot=await page.screenshot({clip:{x:0,y:0,width:1728,height:972},scale:'css'}),file='V'+(i+1)+'-'+time+'.png';await evidenceFs.copyFile(shot.path,evidenceRoot+'/screenshots/'+file);shots.push({file,view,time,width:shot.width,height:shot.height,sha256:shot.sha256});
}
await evidenceFs.writeFile(evidenceRoot+'/new-screenshots.json',JSON.stringify(shots,null,2));await page.evaluate(()=>{document.body.classList.remove('clean');shanghai.follow();});return {count:shots.length,files:shots.map(s=>s.file)};
