const run=await page.evaluate(()=>({...driveRun,timer:undefined}));
if(run.fullFrameTimes?.length){run.frameTimes=run.fullFrameTimes;delete run.fullFrameTimes;const sorted=run.frameTimes.slice().sort((a,b)=>a-b);Object.assign(run.metrics,{frames:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)]});}
expect(run.done).toBe(true);expect(run.errors).toEqual([]);expect(run.minY).toBeLessThan(-20);expect(run.maxCrossTrack).toBeLessThan(2.6);expect(run.maxStep).toBeLessThan(8);expect(run.minCameraClearance).toBeGreaterThan(.3);expect(run.metrics.errors).toEqual([]);
if(run.groundApproach){expect(run.maxTransitionStep).toBeLessThanOrEqual(.1);expect(run.surfaceChanges.some(s=>run.groundConnection.sourceRoads.includes(s.from)&&s.to===run.route)).toBe(true);expect(run.surfaceChanges.some(s=>s.from===run.route&&run.groundConnection.sourceRoads.includes(s.to))).toBe(true);}
if(recording)await endRecording();
await evidenceFs.mkdir(evidenceRoot+'/drives',{recursive:true});await evidenceFs.writeFile(evidenceRoot+'/drives/'+run.label+'.json',JSON.stringify(run,null,2));
return {label:run.label,duration:run.duration,maxCrossTrack:run.maxCrossTrack,maxStep:run.maxStep,minCameraClearance:run.minCameraClearance,p95:run.metrics.p95,frames:run.metrics.frames,trace:run.trace.length};
