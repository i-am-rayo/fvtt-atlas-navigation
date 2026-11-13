/**
 * Pure display grouping for the GM destination selector: land, water, air,
 * or uncategorized. Neither Roads nor native territory names are included in
 * headings, and no Checkpoint is hidden because its Road association is absent.
 */
const LABELS=Object.freeze({land:"Land",water:"Water",air:"Air"});
const ORDER=["Land","Water","Air","Uncategorized"];
const clean=value=>typeof value==="string"?
  value.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,100):"";
const compare=(a,b)=>a.localeCompare(b,"en",{sensitivity:"base",numeric:true});
const valueAt=(map,key)=>map instanceof Map?map.get(key):map?.[key];

export function checkpointDestinationGroups(atlas,{roadModes=new Map()}={}){
  const roads=new Set((atlas?.roads??[]).map(road=>road.id));
  const checkpoints=(atlas?.checkpoints??[]).filter(cp=>
    typeof cp?.id==="string"&&cp.id&&clean(cp.name));
  const counts=new Map();
  for(const cp of checkpoints){
    const name=clean(cp.name);
    counts.set(name,(counts.get(name)??0)+1);
  }
  const groups=new Map(ORDER.map(name=>[name,[]]));
  for(const cp of checkpoints){
    const mode=roads.has(cp.roadId)?valueAt(roadModes,cp.roadId):null;
    const terrain=LABELS[mode]??"Uncategorized";
    const name=clean(cp.name);
    groups.get(terrain).push({id:cp.id,
      label:counts.get(name)>1?name+" · "+cp.id:name});
  }
  return ORDER.filter(name=>groups.get(name).length).map(label=>({
    label,entries:groups.get(label).sort((a,b)=>
      compare(a.label,b.label)||compare(a.id,b.id))
  }));
}
