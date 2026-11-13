/**
 * GM-only destination display hierarchy from validated native territory
 * metadata: City (including town/village/settlement) > Continent >
 * Uncategorized. A Road's surface/label is not the checkpoint's territory.
 * Does not modify Scene, native Regions or authored Checkpoint IDs.
 */
const cityKinds=new Set(["city","town","village","settlement"]);
const compare=(a,b)=>a.localeCompare(b,"en",{sensitivity:"base",numeric:true});
const clean=value=>typeof value==="string"?
  value.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,100):"";

/** A conflicting pair of native territories at the same tier is ambiguous;
 * try the next less-specific tier rather than arbitrarily choosing a city. */
export function checkpointGeographyGroups(territories,matches=[],links=[]){
  const all=new Map((territories??[]).filter(t=>t.linked&&!t.invalid&&
    t.geography&&clean(t.name)&&!t.hidden).map(t=>[t.id,t]));
  const candidates=new Map();
  const add=(checkpointId,regionId)=>{
    if(typeof checkpointId!=="string"||!checkpointId||!all.has(regionId))return;
    const territory=all.get(regionId),kind=territory.geography.kind;
    const level=cityKinds.has(kind)?0:kind==="continent"?1:null;
    if(level===null)return;
    if(!candidates.has(checkpointId))candidates.set(checkpointId,new Map());
    candidates.get(checkpointId).set(regionId,{id:regionId,
      level,name:clean(territory.name)});
  };
  for(const match of matches??[]){
    if(match.contains===true&&!match.invalid&&!match.ambiguous)
      add(match.checkpointId,match.regionId);
  }
  for(const link of links??[])
    if(!link.invalid&&link.link?.checkpointId)
      add(link.link.checkpointId,link.regionId);
  const output=new Map();
  for(const [checkpointId,items] of candidates){
    const values=[...items.values()];
    for(const level of [0,1]){
      const selected=values.filter(v=>v.level===level);
      if(selected.length===1){
        output.set(checkpointId,{level,name:selected[0].name});
        break;
      }
    }
  }
  return output;
}

/** A Checkpoint is listed exactly once, preserving its stable Atlas ID.
 * Group order: Cities alphabetically, Continents, Uncategorized last. */
export function checkpointDestinationGroups(atlas,{geography=new Map()}={}){
  const checkpoints=(atlas?.checkpoints??[]).filter(cp=>
    typeof cp?.id==="string"&&cp.id&&clean(cp.name));
  const counts=new Map();
  for(const cp of checkpoints){
    const name=clean(cp.name);
    counts.set(name,(counts.get(name)??0)+1);
  }
  const groups=new Map();
  for(const cp of checkpoints){
    const found=geography instanceof Map?geography.get(cp.id):geography?.[cp.id];
    const level=found?.level===0||found?.level===1?found.level:2;
    const heading=level===0?"City: "+clean(found?.name):
      level===1?"Continent: "+clean(found?.name):"Uncategorized";
    const key=JSON.stringify([level,heading]);
    if(!groups.has(key))groups.set(key,{level,label:heading,entries:[]});
    const name=clean(cp.name);
    groups.get(key).entries.push({id:cp.id,
      label:counts.get(name)>1?name+" · "+cp.id:name});
  }
  return [...groups.values()].sort((a,b)=>a.level-b.level||
    compare(a.label,b.label)).map(({label,entries})=>({
    label,entries:entries.sort((a,b)=>compare(a.label,b.label)||compare(a.id,b.id))
  }));
}
