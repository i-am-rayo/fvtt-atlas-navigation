import {ATLAS_LEVEL_USE_CASES,planAtlasNativeLevels}
  from "./navigation-native-level-model.js";

// Scene Config rerenders must not discard a GM's unsaved proposal.
const drafts=new Map();
const label=(tag,text)=>{const element=document.createElement(tag);element.textContent=text;return element;};
const nativeLevels=scene=>(scene.levels?.contents??[]).map(level=>({
  name:level.name,elevation:{bottom:level.elevation?.bottom,top:level.elevation?.top}
}));

/** An opt-in editor for native Scene Levels, not a second Atlas elevation store. */
export function atlasNativeLevelSetup(scene){
  const container=label("fieldset","");
  container.dataset.atlasNativeLevelSetup="";
  container.appendChild(label("legend","Native Scene Levels (GM setup)"));
  container.appendChild(label("p","Propose elevation bands in this Scene's native " +
    (scene.grid?.units||"distance units")+". Land, sea and ocean may share the Surface band. " +
    "This does not assign road elevations, move tokens, or change Regions."));
  const previous=drafts.get(scene.id)??{};
  const state={...previous};drafts.set(scene.id,state);
  for(const category of ATLAS_LEVEL_USE_CASES){
    const row=label("div","");row.className="form-group";
    const toggle=label("label","");
    const checked=document.createElement("input");checked.type="checkbox";
    checked.checked=Boolean(state[category.id]?.selected);
    checked.addEventListener("change",()=>{
      state[category.id]??={};state[category.id].selected=checked.checked;
      clearPreview();
    });
    toggle.append(checked,document.createTextNode(" "+category.name));
    toggle.title=category.hint;
    row.appendChild(toggle);
    for(const edge of ["bottom","top"]){
      const input=document.createElement("input");input.type="number";
      input.step="any";input.placeholder=edge==="bottom"?"Lower elevation":"Upper elevation";
      input.setAttribute("aria-label",category.name+" "+edge+" elevation");
      input.value=state[category.id]?.[edge]??"";
      input.addEventListener("input",()=>{
        state[category.id]??={};state[category.id][edge]=input.value;
        clearPreview();
      });
      row.appendChild(input);
    }
    container.appendChild(row);
  }
  const controls=label("div","");controls.className="form-fields";
  const previewButton=label("button","Preview native Levels");previewButton.type="button";
  const createButton=label("button","Create reviewed Levels");createButton.type="button";
  createButton.disabled=true;
  const output=label("p","No changes proposed. Existing Levels are never overwritten.");
  output.className="hint";output.setAttribute("aria-live","polite");
  let preview=null;
  function clearPreview(){preview=null;createButton.disabled=true;output.textContent="Preview required before creation.";}
  const requested=()=>ATLAS_LEVEL_USE_CASES.filter(item=>state[item.id]?.selected).map(item=>{
    const bottom=state[item.id]?.bottom,top=state[item.id]?.top;
    if(bottom===""||top===""||bottom===undefined||top===undefined)
      throw Error("Enter both elevations for "+item.name+" before previewing.");
    return {id:item.id,elevation:{bottom:Number(bottom),top:Number(top)}};
  });
  const plan=()=>planAtlasNativeLevels({requested:requested(),existing:nativeLevels(scene)});
  previewButton.addEventListener("click",event=>{
    event.preventDefault();
    try{
      if(!game.user?.isGM||!scene.canUserModify?.(game.user,"update"))
        throw Error("GM Scene edit permission is required to propose native Levels.");
      const selected=plan();
      preview={proposal:structuredClone(selected),existing:JSON.stringify(nativeLevels(scene))};
      createButton.disabled=false;
      output.textContent="Review: " + selected.create.map(item=>item.name+" ("+
        item.elevation.bottom+" to "+item.elevation.top+")").join(", ")+". " +
        "Only these native Level documents will be created after confirmation.";
    }catch(error){clearPreview();output.textContent=error.message;}
  });
  createButton.addEventListener("click",async event=>{
    event.preventDefault();
    try{
      if(!preview||!game.user?.isGM||!scene.canUserModify?.(game.user,"update"))
        throw Error("GM review and Scene edit permission are required.");
      const selected=plan();
      if(JSON.stringify(selected)!==JSON.stringify(preview.proposal)||
          JSON.stringify(nativeLevels(scene))!==preview.existing)
        throw Error("The native Level proposal is stale. Preview again before creating.");
      const approval=await foundry.applications.api.DialogV2.confirm({
        window:{title:"Create native Foundry Levels"},
        content:"Create " +selected.create.length+" new native Scene Level(s): " +
          selected.create.map(item=>item.name+" ("+item.elevation.bottom+" to "+
          item.elevation.top+")").join(", ")+"? Existing Levels and Regions remain unchanged.",
        rejectClose:false,modal:true
      });
      if(!approval)return;
      if(!game.user?.isGM||!scene.canUserModify?.(game.user,"update")||
          JSON.stringify(nativeLevels(scene))!==preview.existing||
          JSON.stringify(plan())!==JSON.stringify(preview.proposal))
        throw Error("Scene Levels or permissions changed during confirmation. Preview again.");
      await scene.createEmbeddedDocuments("Level",selected.create);
      drafts.delete(scene.id);clearPreview();
      output.textContent="Native Levels created. Review their geometry and visibility in Foundry's Levels tab.";
    }catch(error){clearPreview();output.textContent=error.message;
      ui.notifications?.warn?.(error.message);}
  });
  controls.append(previewButton,createButton);
  container.append(controls,output);
  return container;
}
