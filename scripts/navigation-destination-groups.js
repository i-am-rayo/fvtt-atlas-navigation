/**
 * Pure grouping for the GM destination selector. Group order is
 * terrain > named settlement/territory > owning Road, where available.
 * One Checkpoint is one selectable stable ID even if several Regions contain it.
 * This is display metadata, never route/permission/canvas authority.
 */
const TERRAIN_LABELS=Object.freeze({land:"Land",water:"Water",air:"Air"});
const TERRAIN_ORDER=Object.freeze(["Land","Water","Air","Unclassified terrain"]);
const clean=value=>typeof value==="string"?
  value.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,100):"";
const compare=(a,b)=>a.localeCompare(b,"en",{sensitivity:"base",numeric:true});
const keyValue=(map,key)=>map instanceof Map?map.get(key):map?.[key];

/**
 * @param {object} atlas Authored Atlas graph (read-only)
 * @param {object} options
 * @param {Map|object} options.roadModes Road ID -> land, air or water
 * @param {Map|object} options.settlements Checkpoint ID -> native territory name
 * @returns {{label:string,entries:{id:string,label:string}[]}[]}
 */
export function checkpointDestinationGroups(atlas,{roadModes=new Map(),
  settlements=new Map()}={}){
  const byRoad=new Map((atlas?.roads??[]).map(road=>[road.id,road]));
  const items=(atlas?.checkpoints??[]).filter(cp=>
    typeof cp?.id==="string"&&cp.id&&clean(cp.name));
  const duplicateNames=new Map();
  for(const cp of items){
    const name=clean(cp.name);
    duplicateNames.set(name,(duplicateNames.get(name)??0)+1);
  }
  const groups=new Map();
  for(const cp of items){
    const road=byRoad.get(cp.roadId);
    const mode=road?keyValue(roadModes,road.id):null;
    const terrain=TERRAIN_LABELS[mode]??"Unclassified terrain";
    const settlement=clean(keyValue(settlements,cp.id))||"Other locations";
    const roadName=clean(road?.name)||"No linked road";
    const id=JSON.stringify([terrain,settlement,roadName]);
    if(!groups.has(id))groups.set(id,{terrain,settlement,roadName,entries:[]});
    const name=clean(cp.name);
    groups.get(id).entries.push({id:cp.id,
      label:duplicateNames.get(name)>1?name+" · "+cp.id:name});
  }
  return [...groups.values()].sort((a,b)=>
    TERRAIN_ORDER.indexOf(a.terrain)-TERRAIN_ORDER.indexOf(b.terrain)||
    compare(a.settlement,b.settlement)||compare(a.roadName,b.roadName))
    .map(group=>({label:group.terrain+" › "+group.settlement+
      " › "+group.roadName,
      entries:group.entries.sort((a,b)=>compare(a.label,b.label)||
        compare(a.id,b.id))}));
}

/**
 * Choose the most specific uniquely identified native territory for display.
 * Never invent a city when territory metadata is absent or ambiguous.
 */
export function checkpointSettlementNames(territories,matches,explicitLinks){
  const all=new Map((territories??[]).filter(t=>t.linked&&!t.invalid&&
    t.geography&&typeof t.name==="string").map(t=>[t.id,t]));
  const rank={city:0,town:0,village:0,settlement:0,area:1,continent:2};
  const candidates=new Map();
  const attach=(checkpointId,regionId,priority)=>{
    const territory=all.get(regionId);
    if(!territory||!Object.hasOwn(rank,territory.geography.kind))return;
    if(!candidates.has(checkpointId))candidates.set(checkpointId,[]);
    candidates.get(checkpointId).push({id:regionId,name:territory.name,
      rank:rank[territory.geography.kind],priority});
  };
  for(const item of matches??[]){
    if(item.contains)attach(item.checkpointId,item.regionId,1);
  }
  for(const item of explicitLinks??[]){
    if(item.link?.checkpointId)attach(item.link.checkpointId,item.regionId,0);
  }
  const names=new Map();
  for(const [checkpointId,possibilities] of candidates){
    const distinct=[...new Map(possibilities.map(item=>[item.id,item])).values()];
    distinct.sort((a,b)=>a.rank-b.rank||a.priority-b.priority||
      compare(a.name,b.name));
    const best=distinct[0];
    if(!best)continue;
    // Overlap between equally specific native territories is a real ambiguity.
    if(distinct.some(t=>t.id!==best.id&&t.rank===best.rank))
      continue;
    const value=clean(best.name);
    if(value)names.set(checkpointId,value);
  }
  return names;
}
