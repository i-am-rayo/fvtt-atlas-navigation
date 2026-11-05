import { MODULE_ID } from "./atlas-storage.js";

/** The versioned Journey flag is the only persisted source of confirmed
 * progress. The readable JournalEntryPage is a separately published view.
 * This adapter receives a validated snapshot; it does not derive progress or
 * write TokenDocuments, World time, or an independent Scene/World store. */
export const JOURNEY_JOURNAL_FLAG="guidedJourney";

export async function persistJourneyState(journal,record){
  if(!globalThis.game?.user?.isGM)
    throw Error("Only a GM may save an Atlas Journey Journal.");
  if(!journal?.id||typeof journal.update!=="function")
    throw Error("A persisted Journey Journal is required for checkpoint updates.");
  await journal.update({[`flags.${MODULE_ID}.${JOURNEY_JOURNAL_FLAG}`]:record});
  return journal;
}

/** Only confirmed leg arrival and deliberate terminal decisions are public
 * history milestones. Mid-leg rests, pauses, interrupts, and animations are
 * retained in the recovery flag without rewriting the managed Journal page. */
export function journeySummaryDue({status,completedPercent=0,pendingNativeMove=null}={}){
  if(status==="completed"||status==="ended")return !pendingNativeMove;
  return status==="paused"&&!pendingNativeMove&&
    Number.isFinite(completedPercent)&&completedPercent>=99.999;
}
