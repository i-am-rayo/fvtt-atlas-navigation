/** GM-only destination choices, read-only native territory labels. */
import {checkpointDestinationGroups,checkpointGeographyGroups}
  from "./navigation-destination-groups.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {inspectCheckpointTerritoryMembership}
  from "./territory-checkpoint-membership.js";
import {territoryCheckpointLinks} from "./territory-checkpoint-link.js";

const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};

function groupsFor(scene,atlas){
  let geography=new Map();
  try{
    const territories=listSceneGeography(scene);
    const inspection=inspectCheckpointTerritoryMembership(scene);
    const matches=inspection.available?inspection.items:[];
    geography=checkpointGeographyGroups(territories,matches,
      territoryCheckpointLinks(scene));
  }catch(error){
    console.warn("[fvtt-atlas-navigation] Destination geography unavailable",error);
  }
  return checkpointDestinationGroups(atlas,{geography});
}

/** Rendering must never modify the Scene or initiate a Journey. */
export function checkpointDestinationControl(planner){
  const scene=planner.scene;
  const locked=()=>planner.travelSession||planner.pendingTransfer||planner.recoveryRecord||
    planner.recoverableJourney||planner.completedRecord||planner.completedRoute||
    planner.journalStarting;
  if(!scene||locked())return null;
  const atlas=planner.atlasProvider(scene);
  const root=el("div");
  root.className="atlas-navigation-destination-choice";
  root.style.cssText="display:grid;gap:.35rem;min-width:0;";
  const heading=el("strong","Destination");
  root.appendChild(heading);
  const row=el("div");
  row.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;";
  const label=el("label","Destination checkpoint");
  label.htmlFor="atlas-navigation-destination-checkpoint";
  label.style.cssText="flex:1;min-width:13rem;display:grid;gap:.25rem;font-size:.84em;";
  const select=el("select");
  select.id="atlas-navigation-destination-checkpoint";
  select.title="Choose a known Atlas Checkpoint by its saved Node";
  select.style.cssText="width:100%;min-width:0;font-size:1rem;";
  const placeholder=el("option",(atlas.checkpoints??[]).length?
    "Choose a checkpoint…":"No checkpoints on this Scene");
  placeholder.value="";
  select.appendChild(placeholder);
  for(const group of groupsFor(scene,atlas)){
    const optgroup=el("optgroup");
    optgroup.label=group.label;
    for(const cp of group.entries){
      const option=el("option",cp.label);
      option.value=cp.id;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  const remembered=planner.selectedCheckpointId;
  select.value=remembered&&(atlas.checkpoints??[]).some(cp=>cp.id===remembered)?
    remembered:"";
  select.disabled=!planner.start||!(atlas.checkpoints??[]).length;
  label.appendChild(select);
  const map=el("button","Pick on map");
  map.type="button";
  map.title="Minimize Navigation and select a destination anywhere on the Scene";
  map.setAttribute?.("aria-label","Pick destination location on map");
  map.style.cssText="align-self:end;min-height:2.5rem;white-space:nowrap;";
  map.disabled=!planner.start;
  map.addEventListener("click",()=>{
    if(locked()||planner.scene!==scene)return;
    const view=planner.canvasProvider();
    if(!globalThis.game?.user?.isGM||!view?.ready||view.scene?.id!==scene.id||
        !scene.canUserModify?.(game.user,"update"))return;
    planner.beginMapDestinationPick?.();
  });
  row.append(label,map);
  root.appendChild(row);
  if(planner.destinationMode==="map"&&planner.end&&!planner.selectedCheckpointId){
    const detail=el("small","Map location selected. Pick again to change it.");
    detail.style.opacity=".75";
    root.appendChild(detail);
  }

  select.addEventListener("change",async()=>{
    const view=planner.canvasProvider();
    if(!select.value||locked()||planner.scene!==scene||
        !globalThis.game?.user?.isGM||!view?.ready||view.scene?.id!==scene.id||
        !scene.canUserModify?.(game.user,"update"))return;
    try{
      const current=planner.atlasProvider(scene);
      const cp=current.checkpoints.find(item=>item.id===select.value);
      const node=cp&&current.nodes.find(item=>item.id===cp.nodeId);
      if(!Number.isFinite(node?.x)||!Number.isFinite(node?.y))
        throw Error("This checkpoint is no longer available.");
      // Only preview Point A/B change. Never write native Token position or
      // approve time/Journal as a consequence of selecting a destination.
      if(planner.sourceMode==="party")planner.syncPartyDeparture(view,current);
      if(!planner.start)return;
      planner.notice="";
      planner.destinationMode="checkpoint";
      planner.selectedCheckpointId=cp.id;
      planner.end={x:node.x,y:node.y};
      planner.calculateRoute(view,current);
      planner.draw();
      await planner.render(true);
    }catch(error){globalThis.ui?.notifications?.error?.(error.message??String(error));}
  });
  return root;
}
