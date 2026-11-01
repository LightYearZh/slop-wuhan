// Port of mrdoob/slop-newyork showLoadingStage: hidden tabs must not wait forever
// on requestAnimationFrame; foreground stages still yield once to paint their labels.
export async function yieldLoadingStage({hidden=typeof document!=='undefined'&&document.hidden,requestFrame=globalThis.requestAnimationFrame,schedule=setTimeout,cancel=clearTimeout}={}){
 if(hidden)return;
 await new Promise(resolve=>{
  const timeout=schedule(resolve,100);
  requestFrame(()=>{cancel(timeout);schedule(resolve,0);});
 });
}
