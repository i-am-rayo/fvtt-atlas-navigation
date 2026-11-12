/**
 * GM-only Scene Navigation launcher. It deliberately does not reproduce or
 * mutate Journey state. Scene Grid and Atlas graph are read-only summaries;
 * the existing NavigationController and World settings remain authoritative.
 */
import {readAtlas} from "./atlas-storage.js";
import {readSceneGridScale} from "./scene-grid.js";

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
  const grid=readSceneGridScale(scene);
  const section=element("section");
  section.setAttribute("data-atlas-navigation-workspace","");
  section.appendChild(element("h3","Travel"));
  const controls=element("div");
  controls.className="atlas-workspace-navigation-actions";
  if(typeof onOpenNavigation==="function"){
    const button=action("Plan a route",
      "Plan a route",onOpenNavigation);
    controls.appendChild(button);
    if (!atlas.segments?.length || !grid) {
      button.disabled = true;
      controls.appendChild(element("p", !atlas.segments?.length
        ? "Add a road to plan a route." : "Set the Scene grid distance to plan a route."));
    }
  }
  if(typeof onOpenWorldTravelSettings==="function"){
    controls.appendChild(action("World travel settings",
      "World travel settings",
      onOpenWorldTravelSettings));
  }
  section.appendChild(controls);
  return section;
}
