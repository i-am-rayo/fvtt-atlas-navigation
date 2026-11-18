import {ATLAS_LEVEL_USE_CASES,ATLAS_SCENE_LEVELS_FLAG,
  defaultNativeLevelRanges,planAtlasNativeLevels}
  from "./navigation-native-level-model.js";

const MODULE_ID="fvtt-atlas-navigation";
// Scene Config rerenders never silently discard the GM's unsaved proposal.
const drafts=new Map();
const label=(tag,text)=>{const element=document.createElement(tag);element.textContent=text;return element;};
const nativeLevels=scene=>(scene.levels?.contents??[]).map(level=>({
  id:level.id,name:level.name,
  elevation:{bottom:level.elevation?.bottom,top:level.elevation?.top},
  environment:level.getFlag?.(MODULE_ID,"environment")??
    level.flags?.[MODULE_ID]?.environment??null
}));
const sceneEnabled=scene=>scene.getFlag?.(MODULE_ID,ATLAS_SCENE_LEVELS_FLAG)===true||
  scene.flags?.[MODULE_ID]?.[ATLAS_SCENE_LEVELS_FLAG]===true;
const canEdit=scene=>Boolean(game.user?.isGM&&scene.canUserModify?.(game.user,"update"));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const rangeLabel=item=>item.name+" ["+item.elevation.bottom+", "+item.elevation.top+"]";

/** GM-owned native Scene Level editor. Enabling it never mutates native Levels. */
export function atlasNativeLevelSetup(scene,{onSceneToggle=()=>{}}={}){
  const container=label("fieldset","");
  container.dataset.atlasNativeLevelSetup="";
  container.appendChild(label("legend","Native Scene Levels (GM setup)"));
  const enabled=sceneEnabled(scene);
  const sceneToggle=label("label","");
  const checkbox=document.createElement("input");checkbox.type="checkbox";
  checkbox.checked=enabled;
  sceneToggle.append(checkbox,document.createTextNode(" Enable Atlas Level setup in this Scene"));
  container.appendChild(sceneToggle);
  const toggleMessage=label("p",enabled?
    "Native Levels belong to Foundry. Review every creation or update before applying.":
    "Off in this Scene. Native Foundry Levels, roads and token elevations are unchanged.");
  toggleMessage.className="hint";
  container.appendChild(toggleMessage);
  checkbox.addEventListener("change",async()=>{
    checkbox.disabled=true;
    try{
      if(!canEdit(scene)||typeof scene.setFlag!=="function")
        throw Error("GM Scene edit permission is required to enable native Level setup.");
      await scene.setFlag(MODULE_ID,ATLAS_SCENE_LEVELS_FLAG,checkbox.checked);
      drafts.delete(scene.id);
      onSceneToggle();
    }catch(error){checkbox.checked=!checkbox.checked;
      toggleMessage.textContent=error.message;ui.notifications?.warn?.(error.message);
    }finally{checkbox.disabled=false;}
  });
  if(!enabled)return container;

  const unit=scene.grid?.units?.trim()||"";
  const defaults=defaultNativeLevelRanges(unit);
  container.appendChild(label("p","Presets represent meters converted to this Scene's native "+
    (unit||"distance units")+". Surface includes land/sea/ocean; underwater and underground " +
    "are distinct Atlas environment labels on separate native Level IDs, even if their ranges overlap. " +
    "Road-to-Level assignment is not automated by this setup."));
  if(!defaults)container.appendChild(label("p",
    "Unknown Scene grid units. Enter native elevations explicitly; Atlas cannot convert meter presets."));
  const existing=nativeLevels(scene);
  const previous=drafts.get(scene.id)??{};
  const state={...previous};drafts.set(scene.id,state);
  const defaultLevel=existing.length===1&&existing[0].name==="Level"?
    existing[0]:null;
  let preview=null;
  const controls=label("div","");controls.className="form-fields";
  const previewButton=label("button","Preview native Levels");previewButton.type="button";
  const applyButton=label("button","Apply reviewed Levels");applyButton.type="button";
  applyButton.disabled=true;
  const output=label("p","No native Level changes proposed.");
  output.className="hint";output.setAttribute("aria-live","polite");
  function clearPreview(){preview=null;applyButton.disabled=true;
    output.textContent="Preview required before applying.";}

  for(const category of ATLAS_LEVEL_USE_CASES){
    const prior=existing.find(item=>item.environment===category.id)||
      existing.find(item=>item.name.toLowerCase()===category.name.toLowerCase());
    const initial=prior??(category.id==="surface"?defaultLevel:null);
    const values=state[category.id]??{
      selected:category.id==="surface"||Boolean(prior),
      bottom:prior?.elevation.bottom??defaults?.[category.id]?.bottom??"",
      top:prior?.elevation.top??defaults?.[category.id]?.top??"",
      targetLevelId:initial?.id??""
    };
    state[category.id]=values;
    const row=label("div","");row.className="form-group atlas-native-level-row";
    const toggle=label("label","");toggle.title=category.hint;
    const checked=document.createElement("input");checked.type="checkbox";
    checked.checked=Boolean(values.selected);
    checked.addEventListener("change",()=>{values.selected=checked.checked;clearPreview();});
    toggle.append(checked,document.createTextNode(" "+category.name));
    row.appendChild(toggle);
    for(const edge of ["bottom","top"]){
      const input=document.createElement("input");input.type="number";
      input.step="any";input.placeholder=edge==="bottom"?"Lower elevation":"Upper elevation";
      input.setAttribute("aria-label",category.name+" "+edge+" elevation ("+unit+")");
      input.value=values[edge];
      input.addEventListener("input",()=>{values[edge]=input.value;clearPreview();});
      const field=label("label",edge==="bottom"?"Bottom ("+unit+")":"Top ("+unit+")");
      field.className="atlas-native-level-field";
      field.appendChild(input);row.appendChild(field);
    }
    const select=document.createElement("select");
    select.setAttribute("aria-label",category.name+" native Level to create or adopt");
    const fresh=document.createElement("option");fresh.value="";
    fresh.textContent="Create new "+category.name+" Level";select.appendChild(fresh);
    for(const level of existing){
      if(!level.id)continue;
      const option=document.createElement("option");option.value=level.id;
      option.textContent="Adopt/update "+rangeLabel(level)+" (keeps native ID)";
      select.appendChild(option);
    }
    select.value=values.targetLevelId??"";
    select.addEventListener("change",()=>{values.targetLevelId=select.value;clearPreview();});
    const levelField=label("label","Native Level (adopt or create)");
    levelField.className="atlas-native-level-field";
    levelField.appendChild(select);
    row.appendChild(levelField);container.appendChild(row);
  }
  const requested=()=>ATLAS_LEVEL_USE_CASES.filter(item=>state[item.id]?.selected).map(item=>{
    const data=state[item.id];
    if(data.bottom===""||data.top===""||data.bottom===undefined||data.top===undefined)
      throw Error("Enter both native elevations for "+item.name+" before previewing.");
    return {id:item.id,elevation:{bottom:Number(data.bottom),top:Number(data.top)},
      targetLevelId:data.targetLevelId||null};
  });
  const plan=()=>planAtlasNativeLevels({requested:requested(),existing:nativeLevels(scene)});
  previewButton.addEventListener("click",event=>{
    event.preventDefault();
    try{
      if(!canEdit(scene)||!sceneEnabled(scene))
        throw Error("GM Scene edit permission and enabled Scene setup are required.");
      const selected=plan();
      preview={proposal:structuredClone(selected),existing:JSON.stringify(nativeLevels(scene))};
      applyButton.disabled=false;
      output.textContent="Review: create "+selected.create.length+" Level(s); update "+
        selected.update.length+" existing Level(s) in place. "+
        [...selected.create,...selected.update].map(rangeLabel).join(", ")+". "+
        (selected.warnings.length?"Warning: "+selected.warnings.join(" "):"No overlaps detected.")+
        " No changes occur until GM confirmation.";
    }catch(error){clearPreview();output.textContent=error.message;}
  });
  applyButton.addEventListener("click",async event=>{
    event.preventDefault();
    try{
      if(!preview||!canEdit(scene)||!sceneEnabled(scene))
        throw Error("GM review and Scene edit permission are required.");
      const selected=plan();
      if(!same(selected,preview.proposal)||
          JSON.stringify(nativeLevels(scene))!==preview.existing)
        throw Error("The native Level proposal is stale. Preview again before applying.");
      const review=label("div","Update "+selected.update.length+" existing native Level(s) "+
        "without deleting them, and create "+selected.create.length+" new Level(s)? "+
        "Any changed name, native elevation range and Atlas environment label will be saved. "+
        "Existing Level IDs, other flags and Regions are preserved. "+
        (selected.warnings.length?"Overlaps: "+selected.warnings.join(" "):""));
      const approval=await foundry.applications.api.DialogV2.confirm({
        window:{title:"Confirm native Foundry Level changes"},
        content:review,rejectClose:false,modal:true
      });
      if(!approval)return;
      if(!canEdit(scene)||!sceneEnabled(scene)||
          JSON.stringify(nativeLevels(scene))!==preview.existing||
          !same(plan(),preview.proposal))
        throw Error("Scene Levels or permissions changed during confirmation. Preview again.");
      // Update by ID instead of deleting Foundry's last default Level.
      // A partially failed batch must be reviewed afresh; never replay blindly.
      if(selected.update.length)await scene.updateEmbeddedDocuments("Level",selected.update);
      if(selected.create.length)await scene.createEmbeddedDocuments("Level",selected.create);
      drafts.delete(scene.id);clearPreview();
      output.textContent="Native Levels applied. Review their visibility in Foundry's Levels tab.";
    }catch(error){clearPreview();output.textContent=error.message+
      " If a batch partly succeeded, re-open and preview the current native Levels.";
      ui.notifications?.warn?.(error.message);}
  });
  controls.append(previewButton,applyButton);container.append(controls,output);
  return container;
}
