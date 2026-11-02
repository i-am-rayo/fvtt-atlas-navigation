import { MODULE_ID } from "./atlas-storage.js";
import { formatNavigationDuration } from "./navigation-time.js";
import { annotateJourneyDirections } from "./navigation-journey-timeline.js";

/** A Journal Entry owns the recoverable record and a generated human-readable page.
 * No Scene flag, token flag, or second persistent journey store is needed. */
export const JOURNEY_JOURNAL_FLAG="guidedJourney";
export const JOURNEY_JOURNAL_SCHEMA=1;
export const JOURNEY_JOURNAL_PAGE="Atlas Journey Summary";
const RECOVERABLE=new Set(["moving","paused","interrupted"]);
const STATUSES=new Set([...RECOVERABLE,"completed","ended"]);
const point=p=>({x:Number(p.x),y:Number(p.y)});
const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
})[char]);

/** Copy only the itinerary fields needed for a readable history and recovery.
 * The road solver is authoritative for any future token movement. */
export function journeyLegFromItinerary(itinerary){
  if(itinerary?.schemaVersion!==1||!validPoint(itinerary.endpoints?.departure)||
      !validPoint(itinerary.endpoints?.destination)||
      !Array.isArray(itinerary.directions)||itinerary.directions.length>4096)
    throw Error("A versioned Atlas itinerary is required for a Journey Journal.");
  return {
    sceneName:String(itinerary.scene?.name??"Scene"),
    departure:point(itinerary.endpoints.departure),
    destination:point(itinerary.endpoints.destination),
    units:String(itinerary.scene?.units??"units"),
    distance:itinerary.measurements.distance,
    movingHours:itinerary.measurements.travelHours,
    speedPerHour:itinerary.travel.speedPerHour,
    terrainAware:Boolean(itinerary.measurements.terrainAware),
    directions:itinerary.directions.map(step=>({
      instruction:String(step.instruction),distance:step.distance,
      cost:step.cost,kind:step.kind,
      terrain:String(step.terrain??""),roadId:step.roadId??null
    })),
    completedMovingHours:0,completedPercent:0,events:[],
    worldTravelSeconds:0,worldRestSeconds:0
  };
}

export function createJourneyRecord({sceneId,tokenId,atlasRevision,itinerary,now=new Date().toISOString()}={}){
  if(!sceneId||!tokenId||!Number.isSafeInteger(atlasRevision))
    throw Error("Journey recovery requires a Scene, assigned token, and Atlas revision.");
  const leg=journeyLegFromItinerary(itinerary);
  return {
    schemaVersion:JOURNEY_JOURNAL_SCHEMA,status:"moving",
    sceneId:String(sceneId),tokenId:String(tokenId),atlasRevision,
    destination:point(leg.destination),createdAt:now,updatedAt:now,
    legs:[leg],day:{todayHours:0,permittedExtraUntil:0,restEvents:0,lastForcedCheck:null}
  };
}

/** Validating untrusted Journal flags must fail closed, never move a token. */
export function validateJourneyRecord(value){
  if(!value||value.schemaVersion!==JOURNEY_JOURNAL_SCHEMA||
      !STATUSES.has(value.status)||!value.sceneId||!value.tokenId||
      !Number.isSafeInteger(value.atlasRevision)||!validPoint(value.destination)||
      !Array.isArray(value.legs)||!value.legs.length||value.legs.length>24||
      value.legs.some(leg=>!validPoint(leg.departure)||!validPoint(leg.destination)||
        !Number.isFinite(leg.movingHours)||leg.movingHours<=0||
        !Number.isFinite(leg.speedPerHour)||leg.speedPerHour<=0||
        !Number.isFinite(leg.distance)||leg.distance<0||
        !Number.isFinite(leg.completedMovingHours)||leg.completedMovingHours<0||
        leg.completedMovingHours>leg.movingHours+1e-4||
        !Number.isFinite(leg.completedPercent)||leg.completedPercent<0||leg.completedPercent>100||
        !Array.isArray(leg.events)||leg.events.length>2048||
        !Array.isArray(leg.directions)||leg.directions.length>4096)||
      !Number.isFinite(value.day?.todayHours)||value.day.todayHours<0||
      value.day.todayHours>24||
      !Number.isFinite(value.day?.permittedExtraUntil)||
      value.day.permittedExtraUntil<0||value.day.permittedExtraUntil>24||
      !Number.isSafeInteger(value.day?.restEvents)||value.day.restEvents<0||
      value.day.restEvents>48)
    throw Error("This Atlas Journey Journal has invalid recovery metadata.");
  return structuredClone(value);
}

export function checkpointJourneyRecord(record,{schedule,progress,status,
  worldTravelSeconds=0,worldRestSeconds=0,now=new Date().toISOString()}={}){
  const next=validateJourneyRecord(record);
  if(!STATUSES.has(status)||!Number.isFinite(progress)||progress<0||progress>100||
      !schedule||!Number.isFinite(schedule.completedHours)||
      !Number.isFinite(worldTravelSeconds)||!Number.isFinite(worldRestSeconds))
    throw Error("Invalid confirmed journey checkpoint.");
  const leg=next.legs.at(-1);
  leg.completedMovingHours=schedule.completedHours;
  leg.completedPercent=progress;
  leg.events=structuredClone(schedule.events);
  leg.worldTravelSeconds=Math.max(0,Math.round(worldTravelSeconds));
  leg.worldRestSeconds=Math.max(0,Math.round(worldRestSeconds));
  next.day={todayHours:schedule.todayHours,
    permittedExtraUntil:schedule.permittedExtraUntil,
    restEvents:schedule.restEvents,
    lastForcedCheck:structuredClone(schedule.lastForcedCheck)};
  next.status=status;next.updatedAt=now;
  return validateJourneyRecord(next);
}

export function resumeJourneyRecord(record,{itinerary,atlasRevision,now=new Date().toISOString()}={}){
  const next=validateJourneyRecord(record);
  if(!RECOVERABLE.has(next.status)||atlasRevision!==next.atlasRevision||
      next.legs.length>=24)throw Error("This journey cannot safely resume. Plan a new route.");
  next.legs.push(journeyLegFromItinerary(itinerary));
  next.status="moving";next.updatedAt=now;
  return validateJourneyRecord(next);
}

export function eligibleJourneyRecord(record,{sceneId,tokenId,atlasRevision}={}){
  try{
    const saved=validateJourneyRecord(record);
    return RECOVERABLE.has(saved.status)&&saved.sceneId===sceneId&&
      saved.tokenId===tokenId&&saved.atlasRevision===atlasRevision;
  }catch{return false;}
}

export function formatJourneyJournalHTML(raw){
  const record=validateJourneyRecord(raw);
  const title=record.status==="completed"?"Completed":record.status==="ended"?"Ended":
    record.status==="interrupted"?"Interrupted — may resume":
    record.status==="paused"?"Paused — may resume":"In progress";
  const confirmedMoving=record.legs.reduce((sum,leg)=>sum+leg.completedMovingHours,0);
  const confirmedBreaks=record.legs.reduce((sum,leg)=>sum+
    leg.events.reduce((hours,event)=>hours+(Number(event.hours)||0),0),0);
  const clockMoving=record.legs.reduce((sum,leg)=>sum+leg.worldTravelSeconds,0);
  const clockBreaks=record.legs.reduce((sum,leg)=>sum+leg.worldRestSeconds,0);
  const legs=record.legs.map((leg,index)=>{
    const timeline=annotateJourneyDirections(leg.directions,leg.events,{
      travelHours:leg.movingHours,speed:leg.speedPerHour,
      terrainAware:leg.terrainAware});
    const rows=timeline.map(step=>step.kind==="journey-event"?
      `<li><strong>${escapeHTML(step.label)}</strong> after `+
      `${escapeHTML(formatNavigationDuration(step.atHours,24))} of travel`+
      (step.hours?` (+${escapeHTML(formatNavigationDuration(step.hours,24))})`:"")+"</li>":
      `<li>${escapeHTML(step.instruction)} — ${escapeHTML(Number(step.distance).toFixed(2))} `+
      `${escapeHTML(leg.units)}</li>`).join("");
    return `<section><h2>Leg ${index+1}: ${escapeHTML(leg.sceneName)}</h2>`+
      `<p>Distance: ${escapeHTML(Number(leg.distance).toFixed(2))} ${escapeHTML(leg.units)}; `+
      `Moving time: ${escapeHTML(formatNavigationDuration(leg.movingHours,24))}; `+
      `Confirmed progress: ${Math.floor(leg.completedPercent)}% `+
      `(${escapeHTML(formatNavigationDuration(leg.completedMovingHours,24))} moving).</p>`+
      `<h3>Directions and Confirmed Stops</h3><ol>${rows}</ol>`+"</section>";
  }).join("");
  return `<h1>Atlas Journey — ${escapeHTML(title)}</h1>`+
    `<p>Atlas automatically maintains this summary. Add personal notes as a separate Journal page.</p>`+
    `<p><strong>Last updated:</strong> ${escapeHTML(record.updatedAt)}</p>`+
    `<h2>Journey Overview</h2>`+
    `<p>Confirmed moving: ${escapeHTML(formatNavigationDuration(confirmedMoving,24))}; `+
      `confirmed downtime: ${escapeHTML(formatNavigationDuration(confirmedBreaks,24))}; `+
      `elapsed: ${escapeHTML(formatNavigationDuration(confirmedMoving+confirmedBreaks,24))}.</p>`+
    `<p>Foundry World time recorded: `+
      `${escapeHTML(formatNavigationDuration((clockMoving+clockBreaks)/3600,24))} `+
      `(moving ${escapeHTML(formatNavigationDuration(clockMoving/3600,24))}, `+
      `breaks ${escapeHTML(formatNavigationDuration(clockBreaks/3600,24))}).</p>`+legs;
}

export function findRecoverableJourney(journals,{sceneId,tokenId,atlasRevision}){
  const found=[...(journals??[])].filter(journal=>eligibleJourneyRecord(
    journal.getFlag?.(MODULE_ID,JOURNEY_JOURNAL_FLAG),
    {sceneId,tokenId,atlasRevision}));
  found.sort((a,b)=>String(b.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG).updatedAt)
    .localeCompare(String(a.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG).updatedAt)));
  return found[0]??null;
}

/** All writes go through one Journal; its Atlas flag is the recovery source.
 * Generated text lives in one dedicated managed page; users may add other pages. */
export async function saveJourneyJournal(record,{journal=null,create=null,updatePage=true}={}){
  if(!globalThis.game?.user?.isGM)throw Error("Only a GM may save an Atlas Journey Journal.");
  const state=validateJourneyRecord(record);
  const html=formatJourneyJournalHTML(state);
  if(!journal){
    const JournalEntry=globalThis.foundry?.documents?.JournalEntry;
    const creator=create??(JournalEntry?.create?.bind(JournalEntry));
    if(typeof creator!=="function")throw Error("Foundry Journal creation is unavailable.");
    const page={name:JOURNEY_JOURNAL_PAGE,type:"text",text:{
      format:globalThis.CONST?.JOURNAL_ENTRY_PAGE_FORMATS?.HTML??1,content:html
    }};
    const data={name:`Atlas Journey — ${state.legs[0].sceneName}`,
      ownership:{default:globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE??0},
      pages:[page],flags:{[MODULE_ID]:{[JOURNEY_JOURNAL_FLAG]:state}}};
    journal=await creator(data);
    if(!journal?.id)throw Error("Foundry did not create the Atlas Journey Journal.");
    return journal;
  }
  await journal.update({[`flags.${MODULE_ID}.${JOURNEY_JOURNAL_FLAG}`]:state});
  const page=updatePage?[...(journal.pages??[])].find(p=>p.name===JOURNEY_JOURNAL_PAGE):null;
  if(page)await journal.updateEmbeddedDocuments("JournalEntryPage",[
    {_id:page.id,"text.content":html}
  ]);
  return journal;
}
