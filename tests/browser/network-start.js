globalThis.networkFailures=[];globalThis.networkResponses=[];globalThis.browserErrors=[];
acceptCDP.on('Network.loadingFailed',event=>networkFailures.push({requestId:event.requestId,cancelled:!!event.canceled,error:event.errorText,type:event.type}));
acceptCDP.on('Network.responseReceived',event=>networkResponses.push({url:event.response.url,status:event.response.status,type:event.type}));
page.on('pageerror',error=>browserErrors.push({kind:'pageerror',message:String(error)}));
page.on('console',message=>{if(message.type()==='error')browserErrors.push({kind:'console',message:message.text()});});
await page.evaluate(()=>{if(window.stabilityRun)stabilityRun.buildAsset=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/assets\/index-.*\.js$/.test(n))?.split('/').at(-1);});
return {tracking:true};
