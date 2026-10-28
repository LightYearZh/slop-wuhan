const origin='http://127.0.0.1:4187',urls=[...new Set(networkLog.map(r=>r.url))],externalRequests=urls.filter(url=>/^https?:/.test(url)&&!url.startsWith(origin+'/'));
const failedResources=[...networkFailures.filter(r=>!r.cancelled),...networkResponses.filter(r=>r.status>=400)];
const result={origin,uniqueRequests:urls.length,urls,externalRequests,failedResources,cancelledRequests:networkFailures.filter(r=>r.cancelled),browserErrors,responsesObserved:networkResponses.length,at:new Date().toISOString(),applicationErrors:await page.evaluate(()=>shanghai.errors)};
expect(externalRequests).toEqual([]);expect(failedResources).toEqual([]);expect(result.applicationErrors).toEqual([]);expect(browserErrors).toEqual([]);
await evidenceFs.writeFile(evidenceRoot+'/network-audit.json',JSON.stringify(result,null,2));return {...result,urls:undefined,cancelledRequests:result.cancelledRequests.length};
