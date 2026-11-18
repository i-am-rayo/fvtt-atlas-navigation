import {validateJourneyTargets} from "./navigation-route-targets.js";

/** Read-only GM presentation of durable Scene-local A/B/C intent. */
export function renderJourneyTargets(plan){
  const saved=validateJourneyTargets(plan);
  const details=document.createElement("details");
  details.className="atlas-journey-targets";
  const summary=document.createElement("summary");
  const next=saved.targets[saved.nextTargetIndex];
  summary.textContent="Saved journey targets: "+saved.targets.map(t=>t.id).join(" → ")+
    (next?" · next "+next.id:" · all targets confirmed");
  details.appendChild(summary);
  const list=document.createElement("ol");
  list.style.cssText="margin:.5rem 0 .25rem;padding-left:1.5rem;font-size:.85em;";
  for(const [index,target] of saved.targets.entries()){
    const item=document.createElement("li");
    const status=index<saved.nextTargetIndex?"confirmed":
      index===saved.nextTargetIndex?"next":"planned";
    const horizontal=target.point.x.toFixed(1)+", "+target.point.y.toFixed(1);
    item.textContent=target.id+" ("+status+"): ["+horizontal+"]"+
      (target.checkpointId?" · checkpoint "+target.checkpointId:"")+
      (target.roadId?" · road "+target.roadId:"")+
      (target.segmentId?" · segment "+target.segmentId:"")+
      (target.levelId?" · native Level "+target.levelId:"")+
      (Number.isFinite(target.elevation)?" · elevation "+target.elevation:"")+
      (target.approvedTransport?" · approved "+target.approvedTransport.methodId:"");
    list.appendChild(item);
  }
  details.appendChild(list);
  return details;
}
