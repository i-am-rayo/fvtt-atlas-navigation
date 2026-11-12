/**
 * GM-only Scene Navigation launcher. It deliberately does not reproduce or
 * mutate Journey state. Scene Grid and Atlas graph are read-only summaries;
 * the existing NavigationController and World settings remain authoritative.
 */
import {readAtlas} from "./atlas-storage.js";
import {readSceneGridScale} from "./scene-grid.js";
import {readPartyExploration} from "./party-exploration-storage.js";

const element=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};
const action=(label,hint,handler)=>{
  const button=element("button",label);
  button.type="button";button.title=hint;
  button.setAttribute("aria-label",hint);
  button.addEventListener("click",async event=>{
    event.preventDefault();
    button.disabled=true;
    try{await handler();}catch(error){
      globalThis.ui?.notifications?.error?.(error.message??String(error));
    }finally{button.disabled=false;}
  });
  return button;
};

export function createAtlasWorkspaceNavigationPanel(scene,{
  onOpenNavigation,onOpenWorldTravelSettings
}={}){
  if(!game.user?.isGM||!scene?.id||
     !scene.canUserModify?.(game.user,"update"))
    throw Error("Only a Scene-authorized GM may manage Atlas Navigation.");
  const atlas=readAtlas(scene);
  const exploration=readPartyExploration(scene);
  const grid=readSceneGridScale(scene);
  const section=element("section");
  section.setAttribute("data-atlas-navigation-workspace","");
  section.appendChild(element("h3","Navigation & Journey"));
  section.appendChild(element("p","Atlas Navigation is an existing GM-controlled " +
    "Journey application. Opening it does not approve travel, move Tokens, " +
    "advance World time or write a Journal."));
  const list=element("dl");
  for(const [name,value] of [
    ["Authored Roads",String(atlas.roads?.length??0)],
    ["Saved Checkpoints",String(atlas.checkpoints?.length??0)],
    ["Scene grid",grid?
      grid.unitsPerSpace+" "+(grid.unit||"units")+" / "+grid.pixelsPerSpace+" px":
      "No valid native Scene Grid distance"],
    ["Assigned party token",exploration.enabled && exploration.tokenId?
      "Configured on Scene":"Not configured in Atlas exploration"]
  ]){
    const row=element("div");
    row.className="atlas-workspace-stat";
    row.append(element("dt",name),element("dd",value));
    list.appendChild(row);
  }
  section.appendChild(list);
  const controls=element("div");
  controls.className="atlas-workspace-navigation-actions";
  if(typeof onOpenNavigation==="function"){
    const button=action("Open Atlas Navigation",
      "Open the existing GM Journey panel for this active Scene",onOpenNavigation);
    if(!atlas.segments?.length||!grid)button.disabled=true;
    controls.appendChild(button);
  }
  if(typeof onOpenWorldTravelSettings==="function"){
    controls.appendChild(action("World Travel & Transportation Settings",
      "Open the existing GM-only World travel catalog and rule configuration",
      onOpenWorldTravelSettings));
  }
  section.appendChild(controls);
  section.appendChild(element("p","World travel rules, transport presets, " +
    "native Scene measurements, and authoritative Journey progress are " +
    "managed by their existing owners. No World setting is copied into Scene flags."));
  return section;
}
