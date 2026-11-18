/** Read-only presentation and suggested-link policy for manual geography. */
const MATCHABLE_KINDS=new Set(["city","town","village","settlement"]);

const canonicalName=value=>typeof value==="string"?
  value.normalize("NFKC").trim().replace(/\s+/gu," ").toLocaleLowerCase():"";

/** Advisory matches only: a complete leading place name may have a descriptive
 * suffix, but unrelated names sharing letter prefixes are never suggestions. */
export function geographicLinkNameMatch(a,b){
  const first=canonicalName(a),second=canonicalName(b);
  if(!first||!second)return null;
  if(first===second)return "exact";
  const shorter=first.length<second.length?first:second;
  const longer=first.length<second.length?second:first;
  if(shorter.length<3||!longer.startsWith(shorter))return null;
  return /^[\s\-–—·:,(/]/u.test(longer.slice(shorter.length))?"prefix":null;
}

const candidateRank=candidate=>candidate.current?-1:candidate.disabled?3:
  candidate.match==="exact"?0:candidate.match==="prefix"?1:2;

function finalizeCandidates(candidates){
  candidates.sort((a,b)=>candidateRank(a)-candidateRank(b)||
    a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const available=candidates.filter(candidate=>!candidate.disabled);
  const best=available.some(candidate=>candidate.match==="exact")?"exact":"prefix";
  const suggested=available.filter(candidate=>candidate.match===best);
  return {candidates,suggestedId:suggested.length===1?suggested[0].id:null};
}

/** Type-exact, complete Checkpoint → Territory selector projection. Existing
 * links remain visible even when their old category is now incompatible. */
export function checkpointTerritoryChoices({checkpoint,kind,territories,links=[]}){
  const ownerByRegion=new Map(links.filter(link=>link.link)
    .map(link=>[link.regionId,link.link.checkpointId]));
  const currentId=links.find(link=>link.link?.checkpointId===checkpoint.id)?.regionId??null;
  const candidates=[];
  for(const territory of territories){
    if(!territory.linked||territory.invalid||!territory.geography)continue;
    const current=territory.id===currentId;
    if(territory.geography.kind!==kind&&!current)continue;
    const claimedBy=ownerByRegion.get(territory.id)??null;
    const disabledReason=current?null:claimedBy?"claimed":currentId?"unlink-first":null;
    candidates.push({id:territory.id,name:territory.name,current,
      kind:territory.geography.kind,claimedBy,disabled:Boolean(disabledReason),
      disabledReason,match:geographicLinkNameMatch(checkpoint.name,territory.name)});
  }
  return {...finalizeCandidates(candidates),currentId};
}

/** Symmetric Territory → Checkpoint selector: same kind, same availability
 * rules, and review-only close-name suggestions. */
export function territoryCheckpointChoices({territory,checkpoints,categoryFor,links=[]}){
  const currentId=links.find(link=>link.regionId===territory.id)?.link?.checkpointId??null;
  const ownerByCheckpoint=new Map(links.filter(link=>link.link)
    .map(link=>[link.link.checkpointId,link.regionId]));
  const candidates=[];
  for(const checkpoint of checkpoints){
    const kind=categoryFor(checkpoint.id),current=checkpoint.id===currentId;
    if(kind!==territory.geography?.kind&&!current)continue;
    const claimedBy=ownerByCheckpoint.get(checkpoint.id)??null;
    const disabledReason=current?null:claimedBy?"claimed":currentId?"unlink-first":null;
    candidates.push({id:checkpoint.id,name:checkpoint.name,current,kind,claimedBy,
      disabled:Boolean(disabledReason),disabledReason,
      match:geographicLinkNameMatch(checkpoint.name,territory.name)});
  }
  return {...finalizeCandidates(candidates),currentId};
}

/** Grouped GM-only option labels; disabled alternatives remain inspectable
 * in Foundry's serialized DialogV2 form. */
export function territoryLinkOptionGroups(candidates,{noneLabel,ownerNameFor=()=>"another location"}={}){
  const option=candidate=>{
    const suffix=candidate.current?
      (candidate.match?" — Currently linked":" — Currently linked (check type)"):
      candidate.disabledReason==="claimed"?
        ` — Already linked to ${ownerNameFor(candidate.claimedBy)}`:
      candidate.disabledReason==="unlink-first"?
        " — Unlink your current association first":
      candidate.match==="exact"?" — Suggested: exact name":
      candidate.match==="prefix"?" — Suggested: similar starting name":"";
    return [candidate.id,candidate.name+suffix,{disabled:candidate.disabled}];
  };
  return [
    {label:null,options:[["",noneLabel??"No association"]]},
    {label:"Current association",options:candidates.filter(c=>c.current).map(option)},
    {label:"Suggested names · review before linking",options:candidates.filter(c=>
      !c.current&&!c.disabled&&c.match).map(option)},
    {label:"Other compatible locations",options:candidates.filter(c=>
      !c.current&&!c.disabled&&!c.match).map(option)},
    {label:"Unavailable · shown for reference",options:candidates.filter(c=>
      !c.current&&c.disabled).map(option)}
  ].filter(group=>group.options.length>0);
}

/** Conservative candidates, never automatic document writes. */
export function suggestTerritoryCheckpointLinks(territories,checkpoints,categoryFor){
  const matches=[];
  for(const territory of territories){
    const kind=territory.geography?.kind;
    if(!territory.linked||territory.invalid||!MATCHABLE_KINDS.has(kind))continue;
    const name=canonicalName(territory.name);
    if(!name)continue;
    for(const checkpoint of checkpoints){
      if(canonicalName(checkpoint.name)===name && categoryFor(checkpoint.id)===kind)
        matches.push({regionId:territory.id,checkpointId:checkpoint.id});
    }
  }
  // Only one-to-one, unambiguous suggestions. No guessing by proximity alone.
  const regions=new Map(),points=new Map();
  for(const match of matches){
    regions.set(match.regionId,(regions.get(match.regionId)??0)+1);
    points.set(match.checkpointId,(points.get(match.checkpointId)??0)+1);
  }
  return matches.filter(match=>regions.get(match.regionId)===1&&points.get(match.checkpointId)===1);
}

export function effectiveCheckpointLabelMode(mode,regionNameVisible){
  return mode==="always"&&regionNameVisible?"hover":mode;
}

/** A linked Checkpoint supplies the GM-only geographic label's identity. */
export function territoryDisplayName(regionName,linkedCheckpoint){
  return linkedCheckpoint?.name??regionName;
}
