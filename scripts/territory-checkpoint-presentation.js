/** Read-only presentation and suggested-link policy for manual geography. */
const MATCHABLE_KINDS=new Set(["city","town","village"]);

const canonicalName=value=>typeof value==="string"?
  value.normalize("NFKC").trim().replace(/\s+/gu," ").toLocaleLowerCase():"";

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
