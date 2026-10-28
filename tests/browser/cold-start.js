if(globalThis.acceptCDP)try{await acceptCDP.detach();}catch{}if(globalThis.captureCDP)try{await captureCDP.detach();}catch{}globalThis.captureCDP=null;
globalThis.coldRuns=[];globalThis.networkLog=[];globalThis.acceptCDP=await context.newCDPSession(page);
await acceptCDP.send('Network.enable');acceptCDP.on('Network.requestWillBeSent',e=>networkLog.push({url:e.request.url,type:e.type,at:e.timestamp}));
await acceptCDP.send('Network.setCacheDisabled',{cacheDisabled:true});await acceptCDP.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:6250000,uploadThroughput:1250000,connectionType:'wifi'});
await acceptCDP.send('Emulation.setDeviceMetricsOverride',{width:1728,height:972,deviceScaleFactor:1.1111111111,mobile:false});
let failure=null;try{
for(let i=0;i<3;i++){
 await acceptCDP.send('Storage.clearDataForOrigin',{origin:'http://127.0.0.1:4187',storageTypes:'all'});
 await page.goto('http://127.0.0.1:4187/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.shanghai?.ready,null,{timeout:45000});
 coldRuns.push(await page.evaluate(async()=>({operableMs:performance.now(),bootMs:shanghai.bootMs,marks:shanghai.bootMarks,navigation:performance.getEntriesByType('navigation')[0].toJSON(),resources:performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).map(r=>({url:new URL(r.name).pathname,startTime:r.startTime,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})),webgpu:!!shanghai.renderer.backend.isWebGPUBackend,canvas:[shanghai.renderer.domElement.width,shanghai.renderer.domElement.height],pixelRatio:shanghai.renderer.getPixelRatio(),visibility:document.visibilityState,quality:shanghai.quality,ua:navigator.userAgent,versions:await navigator.userAgentData.getHighEntropyValues(['fullVersionList','platformVersion','architecture']),errors:shanghai.errors})));
}
}catch(error){failure={message:String(error),state:await page.evaluate(()=>({url:location.href,loading:document.getElementById('loading-text')?.textContent,marks:window.shanghai?.bootMarks,resources:performance.getEntriesByType('resource').map(r=>r.toJSON())}))};}finally{
await acceptCDP.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await acceptCDP.send('Network.setCacheDisabled',{cacheDisabled:false});
}
const fs=await import('node:fs/promises');await fs.writeFile((globalThis.evidenceRoot||'/Users/wuyanji/Desktop/上海漫游/docs/acceptance')+'/cold-start.json',JSON.stringify({network:{mbps:50,rttMs:80,cache:'site storage cleared; HTTP cache bypassed'},runs:coldRuns,failure},null,2));if(failure)throw Error(failure.message);return coldRuns.map(r=>({operableMs:r.operableMs,bootMs:r.bootMs,canvas:r.canvas,webgpu:r.webgpu,errors:r.errors}));
