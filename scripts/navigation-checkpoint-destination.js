/** GM-only destination picker. Map clicks and named checkpoints set the
 * same transient Point B and use the same authorized route-calculation path. */
import {checkpointDestinationGroups,checkpointSettlementNames}
  from "./navigation-destination-groups.js";
import {roadAppearanceMode} from "./road-appearance.js";
import {TRAVEL_PRESET_SETTING,validateTravelPresets,defaultTravelPresets}
  from "./travel-preset-model.js";
import {MODULE_ID} from "./atlas-storage.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {inspectCheckpointTerritoryMembership} from "./territory-checkpoint-membership.js";
import {territoryCheckpointLinks} from "./territory-checkpoint-link.js";

const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};

/** Read-only adapter: unavailable native geography never prevents a GM from
 * selecting a known Atlas Checkpoint by its stable ID. */
function groupedOptions(scene,atlas){
  let roadModes=new Map(),settlements=new Map();
  try{
    const presets=validateTravelPresets(globalThis.game?.settings?.get?.(MODULE_ID,
      TRAVEL_PRESET_SETTING)??defaultTravelPresets()).presets;
    roadModes=new Map((atlas.roads??[]).map(road=>[
      road.id,roadAppearanceMode(road,presets)]));
  }catch(error){
    console.warn("[fvtt-atlas-navigation] Destination terrain categories unavailable",error);
  }
  try{
    const territories=listSceneGeography(scene);
    const matches=inspectCheckpointTerritoryMembership(scene);
    settlements=checkpointSettlementNames(territories,
      matches.available?matches.items:[],territoryCheckpointLinks(scene));
  }catch(error){
    console.warn("[fvtt-atlas-navigation] Destination territory categories unavailable",error);
  }
  return checkpointDestinationGroups(atlas,{roadModes,settlements});
}

/** Map and checkpoint selection remain mutually exclusive preview methods;
 * neither creates or resumes a Journey, moves a token or commits World time. */
export function checkpointDestinationControl(planner){
  const scene=planner.scene;
  const locked=()=>planner.travelSession||planner.pendingTransfer||planner.recoveryRecord||
    planner.recoverableJourney||planner.completedRecord||planner.completedRoute;
  if(!scene||locked())return null;
  const atlas=planner.atlasProvider(scene);
  const root=el("div");
  root.className="atlas-navigation-destination-choice";
  root.style.cssText="display:grid;gap:.4rem;min-width:0;";

  const methodLabel=el("label","Choose destination by");
  methodLabel.htmlFor="atlas-navigation-destination-method";
  const method=el("select");
  method.id="atlas-navigation-destination-method";
  method.style.width="100%";
  for(const [value,label] of [["map","Click a location on the map"],
    ["checkpoint","Select from checkpoint list"]]){
    const item=el("option",label);item.value=value;method.appendChild(item);
  }
  method.value=planner.destinationMode==="checkpoint"?"checkpoint":"map";
  methodLabel.appendChild(method);
  root.appendChild(methodLabel);

  const help=el("small","Map: click Point B once Point A is set. Alt/Option+click "+
    "replaces Point B. Checkpoints use their saved Atlas Node.");
  help.style.cssText="opacity:.8;line-height:1.35;";
  root.appendChild(help);

  const checkpointLabel=el("label","Destination checkpoint");
  checkpointLabel.htmlFor="atlas-navigation-destination-checkpoint";
  const select=el("select");
  select.id="atlas-navigation-destination-checkpoint";
  select.style.cssText="width:100%;min-width:0;";
  const placeholder=el("option",(atlas.checkpoints??[]).length?
    "Choose a checkpoint":"No checkpoints on this Scene");
  placeholder.value="";
  select.appendChild(placeholder);
  for(const group of groupedOptions(scene,atlas)){
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
  select.value=remembered&&(atlas.checkpoints??[]).some(c=>c.id===remembered)?
    remembered:"";
  select.disabled=!planner.start||!(atlas.checkpoints??[]).length;
  checkpointLabel.appendChild(select);
  checkpointLabel.hidden=method.value!=="checkpoint";
  root.appendChild(checkpointLabel);

  method.addEventListener("change",()=>{
    if(locked()||planner.scene!==scene)return;
    const next=method.value;
    if(!["map","checkpoint"].includes(next))return;
    const view=planner.canvasProvider();
    if(!game.user?.isGM||!view?.ready||view.scene?.id!==scene.id||
        !scene.canUserModify?.(game.user,"update"))return;
    const current=planner.atlasProvider(scene);
    const hadDestination=Boolean(planner.end);
    planner.destinationMode=next;
    planner.selectedCheckpointId=null;
    planner.notice="";
    // Replacing the *preview* Point B is deliberate; no active/approved
    // Journey is present. Preserve the party token or Map Point A.
    planner.end=null;
    if(hadDestination)planner.calculateRoute(view,current);
    planner.draw();
    void planner.render(true);
  });

  select.addEventListener("change",async()=>{
    const view=planner.canvasProvider();
    if(!select.value||method.value!=="checkpoint"||locked()||!planner.start||
        planner.scene!==scene||!game.user?.isGM||!view?.ready||
        view.scene?.id!==scene.id||!scene.canUserModify?.(game.user,"update"))return;
    try{
      const current=planner.atlasProvider(scene);
      const cp=current.checkpoints.find(item=>item.id===select.value);
      const node=cp&&current.nodes.find(item=>item.id===cp.nodeId);
      if(!Number.isFinite(node?.x)||!Number.isFinite(node?.y))
        throw Error("This checkpoint is no longer available.");
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
