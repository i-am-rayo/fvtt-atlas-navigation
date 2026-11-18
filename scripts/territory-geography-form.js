/** GM geography configuration form; DOM only, never writes native Regions. */
import { createSettingsSelect } from "./settings-select.js";
import { GEOGRAPHY_KINDS,GEOGRAPHY_SCHEMA_VERSION }
  from "./territory-geography-model.js";

const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
function field(title,control){const row=make("label",title);row.className="form-group";
  row.appendChild(control);return row;}

export function buildTerritoryGeographyForm({region,current,territories,roads}) {
  const form=make("div");
  form.appendChild(make("p", "Geography groups the GM Road directory and " +
    "resolves overlaps between already-public Journey territory names. " +
    "A clear majority overlap automatically associates a City, Town, " +
    "Village or Settlement with a Continent when no parent is selected. An explicitly " +
    "selected parent overrides that inference. Classification never " +
    "publishes names, changes native Shapes or Behaviors, or modifies travel costs."));
  form.appendChild(field("Geographic kind",createSettingsSelect([
    ["","Unclassified — remove Atlas geography"],
    ...Object.entries(GEOGRAPHY_KINDS).map(([id,name])=>[id,name])
  ],{name:"kind",selectedId:current?.kind??"",ariaLabel:"Geographic kind"})));
  const eligible=territories.filter(entry=>entry.id!==region.id && entry.linked &&
    !entry.invalid && ["continent","area"].includes(entry.geography?.kind));
  form.appendChild(field("Parent territory",createSettingsSelect([
    ["","Automatic continent (when unassigned)"],
    ...eligible.map(entry=>[entry.id,entry.name+" ("+GEOGRAPHY_KINDS[entry.geography.kind]+")"])
  ],{name:"parentId",selectedId:current?.parentRegionId??"",
    ariaLabel:"Parent Atlas territory"})));
  form.appendChild(make("p", "Roads are associated automatically by geometric overlap " +
    "when their Scene canvas is active. Optionally correct one Road at a time below."));
  const entries=Object.entries(current?.roadOverrides??{});
  form.appendChild(make("p", entries.length ? "Existing corrections: "+entries.map(([id,mode])=>{
    const road=roads.find(item=>item.id===id);
    return (road?.name??id)+" → "+mode;
  }).join("; ") : "No manual Road corrections."));
  form.appendChild(field("Road to correct",createSettingsSelect([
    ["","No Road correction in this save"],
    ...roads.map(road=>[road.id,road.name])
  ],{name:"roadId",selectedId:"",ariaLabel:"Road for manual territory correction"})));
  form.appendChild(field("Correction",createSettingsSelect([
    ["","Leave unchanged"],["auto","Use geometry (clear correction)"],
    ["include","Always include Road"],["exclude","Always exclude Road"]
  ],{name:"roadMode",selectedId:"",ariaLabel:"Road territory association override"})));
  return form;
}

export function geographyFromForm(result,current) {
  const kind=String(result.kind??"");
  if(!kind)return null;
  const overrides={...(current?.roadOverrides??{})};
  const roadId=String(result.roadId??"");
  const mode=String(result.roadMode??"");
  if(roadId&&mode){if(mode==="auto")delete overrides[roadId];
    else overrides[roadId]=mode;}
  if(!roadId&&mode)throw Error("Select a Road before applying a correction.");
  return {schemaVersion:GEOGRAPHY_SCHEMA_VERSION,kind,
    parentRegionId:kind==="continent"?null:(String(result.parentId??"")||null),
    roadOverrides:overrides};
}
