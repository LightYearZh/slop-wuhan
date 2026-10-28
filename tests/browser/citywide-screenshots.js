if(!acceptanceSuite.done||acceptanceSuite.error)throw Error('Finish the formal suite before taking screenshots');
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
const cdp=globalThis.cityCDP||await context.newCDPSession(page),root=evidenceRoot;
await fs.mkdir(root+'/screenshots',{recursive:true});const shots=[];
async function capture(file,details){
 await page.waitForFunction(()=>{const app=shanghai,e=app.controllers.getActiveEntity(),near=app.surface.nearest(e.position.x,e.position.z,r=>!!r.name),expected=e.surface?.tunnel?'延安东路隧道':near?.distance<500?near.road.name:app.surface.isWater(e.position.x,e.position.z)?'上海水域':'上海街区';return document.getElementById('road-label').textContent===expected;},null,{timeout:15000});
 await page.evaluate(()=>new Promise(resolve=>{let n=0;function next(){if(++n>=60)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);}));
 const state=await page.evaluate(()=>({player:shanghai.controllers.getActiveEntity().position.toArray(),view:shanghai.fixedView,road:document.getElementById('road-label').textContent,canvas:[shanghai.renderer.domElement.width,shanghai.renderer.domElement.height],renderCalls:shanghai.renderer.info.render.calls,ready:shanghai.loader.readyAt(shanghai.controllers.getActiveEntity().position),asset:performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/index-.*\.js/.test(n)),errors:shanghai.errors.slice()}));
 const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});const bytes=Buffer.from(data,'base64');await fs.writeFile(root+'/'+file,bytes);shots.push({file,...details,...state,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
await page.evaluate(async()=>{shanghai.controllers.clearGamepadInput();await shanghai.setMode('car');document.getElementById('map-modal').hidden=true;document.getElementById('places').hidden=true;document.body.classList.add('clean');});
for(let i=0;i<6;i++)for(const time of ['midday','golden','midnight']){
 await page.evaluate(async({i,time})=>{const app=shanghai,v=app.views[i],dx=v.target[0]-v.position[0],dz=v.target[2]-v.position[2],len=Math.hypot(dx,dz)||1;await app.teleport(v.position[0]-dx/len*120,v.position[2]-dz/len*120);await app.loader.ensureAt({x:v.position[0],z:v.position[2]},'person');app.setTime(time);app.setView(i);document.getElementById('toast').hidden=true;},{i,time});
 await capture('screenshots/V'+(i+1)+'-'+time+'.png',{index:i,time,kind:'fixed-core'});
}
await page.evaluate(()=>document.body.classList.remove('clean'));
for(const id of ['zhujiajiao','chongming','hengsha','dishui','hongqiao','jinshan']){
 await page.evaluate(async id=>{const app=shanghai;await app.setMode('helicopter');await app.gotoLandmark(id);const e=app.controllers.getActiveEntity();await app.loader.ensureAt(e.position,'helicopter');app.setTime('golden');app.setView({name:app.data.places.find(l=>l.id===id).name,position:[e.position.x+230,250,e.position.z+300],target:[e.position.x,15,e.position.z]});document.getElementById('toast').hidden=true;},id);
 await capture(id+'.png',{id,time:'golden',kind:'citywide-destination'});
}
await page.evaluate(async()=>{await shanghai.setMode('car');await shanghai.gotoLandmark('peace');shanghai.follow();shanghai.setTime('golden');document.getElementById('toast').hidden=true;});await capture('initial-waterfront.png',{kind:'initial-waterfront',time:'golden'});
await page.evaluate(()=>{document.getElementById('map-modal').hidden=false;document.getElementById('map-fit').click();document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input',{bubbles:true}));});await capture('full-map.png',{kind:'full-city-map'});
await fs.writeFile(root+'/screenshots.json',JSON.stringify(shots,null,2));await page.evaluate(()=>{document.getElementById('map-modal').hidden=true;shanghai.follow();});return {count:shots.length,files:shots.map(s=>s.file),errors:shots.flatMap(s=>s.errors)};
