/** UI-only display order; never mutate authored Checkpoint or graph order. */
export function roadCheckpointsAlphabetical(checkpoints,roadId){
  return (checkpoints??[]).filter(item=>item.roadId===roadId)
    .sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"})||
      a.id.localeCompare(b.id));
}
