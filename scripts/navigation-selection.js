/**
 * Pure click policy for Atlas navigation. A completed A/B route is locked
 * against unmodified map clicks. Other Foundry tools receive ignored clicks.
 * No DOM, Scene flag or token writes are performed here.
 */
export function navigationPointIntent(event,{start=null,end=null}={}) {
  if(event?.button!==0 || event.ctrlKey || event.metaKey ||
      (event.shiftKey && event.altKey))return null;
  if(event.shiftKey)return "start";
  if(event.altKey)return start ? "end" : null;
  if(!start)return "start";
  if(!end)return "end";
  return null;
}
