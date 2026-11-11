/** Read-only Territory -> Checkpoint -> native Journal presentation bridge.
 * A Territory never owns/copies the Checkpoint's Journal association. */
import {readTerritoryCheckpointLink} from "./territory-checkpoint-link.js";
import {journalUuidFor,canOpenAtlasJournal} from "./atlas-journal-links.js";

export function territoryCheckpointJournal(region,checkpointsById,links){
  if(!region||!checkpointsById?.get||!links)return null;
  try{
    const association=readTerritoryCheckpointLink(region);
    if(!association)return null;
    const checkpoint=checkpointsById.get(association.checkpointId);
    if(!checkpoint)return null;
    const uuid=journalUuidFor(links,"checkpoint",checkpoint.id);
    return uuid?{uuid,checkpointId:checkpoint.id,checkpointName:checkpoint.name}:null;
  }catch{return null;} // Invalid or stale links must not create an icon.
}

/** One user-facing status model, only for an authorized GM editor. */
export async function territoryJournalBadgeData(uuid,{viewer=globalThis.game?.user,
  users=globalThis.game?.users}={}){
  if(!viewer?.isGM||!await canOpenAtlasJournal(uuid,viewer))return null;
  const players=[...(users??[])].filter(user=>user&&!user.isGM);
  if(!players.length)return {text:"📖 —",status:"Journal linked; no player users configured"};
  const access=await Promise.all(players.map(user=>canOpenAtlasJournal(uuid,user)));
  const count=access.filter(Boolean).length;
  if(count===players.length)return {text:"📖 ✓",status:"All players have Observer access"};
  if(count)return {text:"📖 ◐",status:`${count} of ${players.length} players have Observer access`};
  return {text:"📖 🔒",status:"Journal linked; players cannot view it"};
}
