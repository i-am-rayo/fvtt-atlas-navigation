/** Journey-only physical mount inventory and explicit vessel boarding. */
const id=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const name=v=>typeof v==="string"&&v.trim().length>0&&v.length<=120&&
  !/[\u0000-\u001f]/.test(v);
const count=v=>Number.isInteger(v)&&v>=0&&v<=100;

/** Every resource uses its actual native Group Actor ID, never the display name. */
export function groupLivestockResources(roster){
  if(!Array.isArray(roster?.members))throw Error("Cannot inspect native Group livestock.");
  const resources=roster.members.filter(m=>m.role==="mount"&&m.enabled!==false)
    .map(m=>({actorId:m.actorId,name:String(m.actorName??"").slice(0,120),
      quantity:m.quantity,assignedTo:m.assignedTo??null}));
  if(resources.length>150||new Set(resources.map(m=>m.actorId)).size!==resources.length||
      resources.some(m=>!id(m.actorId)||!name(m.name)||
        !Number.isInteger(m.quantity)||m.quantity<1||m.quantity>100||
        m.assignedTo!==null&&!id(m.assignedTo)))
    throw Error("Invalid Group livestock Actor IDs or physical quantities.");
  return resources;
}

/** Verify a complete decision before quoting; partial drafts have no fare authority. */
export function countJourneyLivestock(roster,decisions){
  const mounts=groupLivestockResources(roster),ids=new Set(mounts.map(m=>m.actorId));
  if(!decisions||typeof decisions!=="object"||Array.isArray(decisions)||
    Object.keys(decisions).some(key=>!ids.has(key)))
    throw Error("The livestock boarding draft no longer matches the Group.");
  if(mounts.some(m=>!Object.hasOwn(decisions,m.actorId)))
    throw Error("Decide Embark or Stay behind for every mount before approval.");
  for(const m of mounts)if(!count(decisions[m.actorId])||decisions[m.actorId]>m.quantity)
    throw Error("Mount boarding cannot exceed its native Group quantity.");
  return mounts.reduce((sum,m)=>sum+decisions[m.actorId],0);
}

/** Restrict only the transient transport inventory; never modify native Group data. */
export function projectAccompanyingLivestock(roster,decisions){
  countJourneyLivestock(roster,decisions);
  return {...roster,members:roster.members.flatMap(member=>
    member.role!=="mount"||member.enabled===false?[member]:
    decisions[member.actorId]>0?[{...member,quantity:decisions[member.actorId]}]:[])};
}

/** Separate passenger seats from animal accommodation; unknown == no boarding. */
export function planJourneyLivestock(roster,decisions,{surface,methodId,
  units,capacityPerUnit,fareCp=0}={}){
  if(!["land","water","air"].includes(surface)||!id(methodId)||
    !Number.isInteger(units)||units<1||units>1000||
    !Number.isFinite(fareCp)||fareCp<0||fareCp>Number.MAX_SAFE_INTEGER||
    !decisions||typeof decisions!=="object"||Array.isArray(decisions))
    throw Error("Invalid vessel boarding plan.");
  countJourneyLivestock(roster,decisions);
  const mounts=groupLivestockResources(roster);
  const resources=mounts.map(m=>{
    const aboard=decisions[m.actorId];
    if(!count(aboard)||aboard>m.quantity)
      throw Error("Mount boarding cannot exceed its native Group quantity.");
    return {...m,aboard};
  });
  const aboard=resources.reduce((n,m)=>n+m.aboard,0);
  if(surface==="land"&&(units!==1||capacityPerUnit!==null||fareCp!==0))
    throw Error("Land livestock accompaniment cannot invent a vessel or fare.");
  if(surface!=="land"&&aboard>0&&(!Number.isInteger(capacityPerUnit)||capacityPerUnit<1||
    capacityPerUnit>1000||aboard>capacityPerUnit*units))
    throw Error("The vessel has insufficient verified animal accommodation.");
  return validateJourneyLivestock({schemaVersion:1,methodId,surface,units,
    capacityPerUnit:capacityPerUnit??null,resources,estimatedFareCp:fareCp});
}

export function validateJourneyLivestock(raw){
  if(!raw||raw.schemaVersion!==1||!id(raw.methodId)||
    !["land","water","air"].includes(raw.surface)||
    !Number.isInteger(raw.units)||raw.units<1||raw.units>1000||
    !(raw.capacityPerUnit===null||
      Number.isInteger(raw.capacityPerUnit)&&raw.capacityPerUnit>=0&&
        raw.capacityPerUnit<=1000)||
    !Number.isFinite(raw.estimatedFareCp)||raw.estimatedFareCp<0||
    raw.estimatedFareCp>Number.MAX_SAFE_INTEGER||
    !Array.isArray(raw.resources)||raw.resources.length>150)
    throw Error("Invalid approved Journey livestock manifest.");
  const seen=new Set();let aboard=0;
  for(const m of raw.resources){
    if(!id(m?.actorId)||seen.has(m.actorId)||!name(m.name)||
      !Number.isInteger(m.quantity)||m.quantity<1||m.quantity>100||
      !count(m.aboard)||m.aboard>m.quantity||
      !(m.assignedTo===null||id(m.assignedTo)))
      throw Error("Invalid saved livestock resource.");
    seen.add(m.actorId);aboard+=m.aboard;
  }
  if(raw.surface==="land"&&(raw.units!==1||raw.capacityPerUnit!==null||
    raw.estimatedFareCp!==0))
    throw Error("Land livestock has no separate vessel price or stalls.");
  if(raw.surface!=="land"&&aboard>0&&(!Number.isInteger(raw.capacityPerUnit)||
    raw.capacityPerUnit<1||aboard>raw.units*raw.capacityPerUnit))
    throw Error("Approved livestock exceeds available vessel stalls.");
  return structuredClone(raw);
}

/** Only a draft suggestion: the next vessel leg requires new GM approval. */
export function suggestedLivestockBoarding(record,roster){
  const resources=groupLivestockResources(roster);
  const prior=record?.legs?.at(-1);
  const last=prior?.livestock?validateJourneyLivestock(prior.livestock):null;
  const boarded=new Map(last?.resources.map(m=>[m.actorId,m.aboard])??[]);
  if(!last){
    const used=new Set(prior?.convoy?.methods?.flatMap(m=>m.resourceIds??[])??[]);
    for(const m of resources)if(used.has(m.actorId))boarded.set(m.actorId,m.quantity);
  }
  if([...boarded.keys()].some(key=>!resources.some(m=>m.actorId===key)))
    throw Error("The saved livestock roster no longer matches the Group.");
  return Object.fromEntries(resources.filter(m=>boarded.has(m.actorId)).map(m=>{
    const amount=boarded.get(m.actorId);
    if(amount>m.quantity)throw Error("The native Group livestock quantity changed.");
    return [m.actorId,amount];
  }));
}

/** Restarting an unfinished voyage cannot silently change its boarded mounts. */
export function assertRecoveredLivestock(record,roster){
  const snapshot=record?.legs?.at(-1)?.livestock;
  if(!snapshot)return null;
  const approved=validateJourneyLivestock(snapshot);
  const live=groupLivestockResources(roster);
  if(approved.resources.length!==live.length||
    approved.resources.some(m=>!live.some(item=>item.actorId===m.actorId&&
      item.quantity===m.quantity&&item.assignedTo===m.assignedTo)))
    throw Error("Approved livestock differs from the native Group; recovery is blocked.");
  return approved;
}
