/** Pure presentation decision for a Foundry canvas interruption. A recovery
 * banner may describe a saved Journey awaiting the GM, but never authorizes
 * movement, World time, rest, or a new leg. */
export function canvasRecoveryAnnouncementType({reason,phase,record,
  requiresGM=false,continuing=false}={}){
  if(!["canvasTearDown","canvasReady"].includes(reason)||
      !requiresGM||continuing||
      ["paused","ending"].includes(phase)||!record||
      !Array.isArray(record.legs)||!record.legs.length)return null;
  if(record.status==="paused"&&!record.pendingNativeMove)
    return "journey.awaiting-gm";
  if(record.status==="interrupted")
    return "journey.interrupted";
  return null;
}
