import { MODULE_ID } from "./atlas-storage.js";
import { formatNavigationDuration } from "./navigation-time.js";
import { atlasDisplayDistance } from "./navigation-measure-units.js";
import { confirmedJourneyDirections } from "./navigation-journey-timeline.js";
import {isRestUnderway,validatePassengerRestMetadata,confirmedJourneyMovingHours}
  from "./navigation-passenger-rest.js";
import {validateTransportJourneyInfo,confirmedTransportJourneyLines} from "./navigation-transport-journal.js";
import {validateJourneyTargets,validateJourneyAnchor,confirmJourneyTarget}
  from "./navigation-route-targets.js";
import {validatePendingNativeMove}
  from "./navigation-native-movement-reconciliation.js";
import {JOURNEY_JOURNAL_FLAG,persistJourneyState}
  from "./navigation-journey-state-store.js";
import {JOURNEY_JOURNAL_PAGE,publishJourneySummary}
  from "./navigation-journey-summary-writer.js";

/** A Journal Entry owns the recoverable record and a generated human-readable page.
 * No Scene flag, token flag, or second persistent journey store is needed. */
export { JOURNEY_JOURNAL_FLAG, JOURNEY_JOURNAL_PAGE };
export const JOURNEY_JOURNAL_SCHEMA=1;
export const JOURNEY_JOURNAL_FOLDER="Atlas Navigation Logs";
const JOURNEY_FOLDER_FLAG="journeyLogFolder";
const RECOVERABLE=new Set(["moving","paused","interrupted"]);
const STATUSES=new Set([...RECOVERABLE,"completed","ended"]);
const point=p=>({x:Number(p.x),y:Number(p.y)});
const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
})[char]);

/** Copy only the itinerary fields needed for a readable history and recovery.
 * The road solver is authoritative for any future token movement. */
const isTransportJourneyInfo=value=>{try{validateTransportJourneyInfo(value);return true;}catch{return false;}};
const validJourneyMethod=value=>Boolean(value&&typeof value==="object"&&
  typeof value.id==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(value.id)&&
  typeof value.name==="string"&&value.name.trim()&&value.name.length<=240&&
  !/[\u0000-\u001f]/.test(value.name)&&
  ["owned","hire"].includes(value.arrangement)&&
  ["normal","overtime","continuous"].includes(value.operation));

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
    worldTravelSeconds:0,worldRestSeconds:0,
    ...(itinerary.transport?{transport:validateTransportJourneyInfo(itinerary.transport)}
      :itinerary.travel?.methodId&&itinerary.travel.methodId!=="walking"?
        {travelMethod:{
          id:String(itinerary.travel.methodId),
          name:String(itinerary.travel.methodName??itinerary.travel.methodId),
          arrangement:String(itinerary.travel.arrangement??"owned"),
          operation:String(itinerary.travel.operation??"normal")
        }}:{})
  };
}

export function createJourneyRecord({sceneId,tokenId,atlasRevision,itinerary,
  journeyDestination=null,title=null,startedWorldTime=null,startedTimeLabel=null,
  routeTargets=null,initialAnchor=null,now=new Date().toISOString()}={}){
  if(!sceneId||!tokenId||!Number.isSafeInteger(atlasRevision))
    throw Error("Journey recovery requires a Scene, assigned token, and Atlas revision.");
  const leg=journeyLegFromItinerary(itinerary);
  const selectedDestination=journeyDestination??leg.destination;
  if(!validPoint(selectedDestination))throw Error("Journey destination must be a valid Point B.");
  return {
    schemaVersion:JOURNEY_JOURNAL_SCHEMA,status:"moving",
    sceneId:String(sceneId),tokenId:String(tokenId),atlasRevision,
    destination:point(selectedDestination),createdAt:now,updatedAt:now,
    ...(routeTargets?{routeTargets:validateJourneyTargets(routeTargets)}:{}),
    ...(initialAnchor?{lastConfirmedAnchor:validateJourneyAnchor(initialAnchor)}:{}),
    ...(title?{title:String(title).trim()}:{}),
    ...(Number.isFinite(startedWorldTime)?{startedWorldTime}:{}),
    ...(startedTimeLabel?{startedTimeLabel:String(startedTimeLabel)}:{}),
    legs:[leg],day:{todayHours:0,permittedExtraUntil:0,restEvents:0,lastForcedCheck:null}
  };
}

/** Validating untrusted Journal flags must fail closed, never move a token. */
export function validateJourneyRecord(value){
  if(!value||value.schemaVersion!==JOURNEY_JOURNAL_SCHEMA||
      !STATUSES.has(value.status)||!value.sceneId||!value.tokenId||
      !Number.isSafeInteger(value.atlasRevision)||!validPoint(value.destination)||
      (value.title!==undefined&&(typeof value.title!=="string"||
        !value.title.trim()||value.title.length>240))||
      ["startedWorldTime","arrivedWorldTime"].some(key=>
        value[key]!==undefined&&!Number.isFinite(value[key]))||
      ["startedTimeLabel","arrivedTimeLabel"].some(key=>
        value[key]!==undefined&&(typeof value[key]!=="string"||
          !value[key].trim()||value[key].length>100))||
      !Array.isArray(value.legs)||!value.legs.length||value.legs.length>24||
      value.legs.some(leg=>!validPoint(leg.departure)||!validPoint(leg.destination)||
        !Number.isFinite(leg.movingHours)||leg.movingHours<=0||
        !Number.isFinite(leg.speedPerHour)||leg.speedPerHour<=0||
        !Number.isFinite(leg.distance)||leg.distance<0||
        !Number.isFinite(leg.completedMovingHours)||leg.completedMovingHours<0||
        leg.completedMovingHours>leg.movingHours+1e-4||
        !Number.isFinite(leg.completedPercent)||leg.completedPercent<0||leg.completedPercent>100||
        !Array.isArray(leg.events)||leg.events.length>2048||
        leg.events.some(event=>!event||typeof event!=="object"||
          ["startedWorldTime","endedWorldTime"].some(key=>
            event[key]!==undefined&&!Number.isFinite(event[key]))||
          ["startedTimeLabel","endedTimeLabel"].some(key=>
            event[key]!==undefined&&(typeof event[key]!=="string"||
              event[key].length>100)))||
        !Array.isArray(leg.directions)||leg.directions.length>4096||
        (leg.transport!==undefined&&!isTransportJourneyInfo(leg.transport))||
        (leg.travelMethod!==undefined&&!validJourneyMethod(leg.travelMethod))||
        (leg.transport!==undefined&&leg.travelMethod!==undefined))||
      !Number.isFinite(value.day?.todayHours)||value.day.todayHours<0||
      value.day.todayHours>24||
      !Number.isFinite(value.day?.permittedExtraUntil)||
      value.day.permittedExtraUntil<0||value.day.permittedExtraUntil>24||
      !Number.isSafeInteger(value.day?.restEvents)||value.day.restEvents<0||
      value.day.restEvents>48)
    throw Error("This Atlas Journey Journal has invalid recovery metadata.");
  if(value.passengerRest!==undefined)validatePassengerRestMetadata(value.passengerRest);
  if(value.pendingNativeMove!==undefined&&value.pendingNativeMove!==null)
    validatePendingNativeMove(value.pendingNativeMove);
  // Optional in schema 1: existing Journeys continue to load without a forced
  // migration or a write-on-read. Newly created Journeys use A/B/C targets.
  if(value.routeTargets!==undefined)validateJourneyTargets(value.routeTargets);
  if(value.lastConfirmedAnchor!==undefined)
    validateJourneyAnchor(value.lastConfirmedAnchor);
  return structuredClone(value);
}

export function checkpointJourneyRecord(record,{schedule,progress,status,
  worldTravelSeconds=0,worldRestSeconds=0,
  arrivedWorldTime=null,arrivedTimeLabel=null,confirmedAnchor=null,
  arrivedCheckpoint=null,checkpointTolerancePixels=.01,
  now=new Date().toISOString()}={}){
  const next=validateJourneyRecord(record);
  if(!STATUSES.has(status)||!Number.isFinite(progress)||progress<0||progress>100||
      !schedule||!Number.isFinite(schedule.completedHours)||
      !Number.isFinite(worldTravelSeconds)||!Number.isFinite(worldRestSeconds))
    throw Error("Invalid confirmed journey checkpoint.");
  // Terminal decisions are durable GM history, never a transient animation
  // phase. A late canvas teardown or pending UI callback cannot reopen them.
  if(["completed","ended"].includes(next.status)&&status!==next.status)
    throw Error("A finalized Journey cannot return to an active or interrupted state.");
  if(status==="completed"&&next.pendingNativeMove)
    throw Error("A pending native TokenDocument move cannot be marked as arrived.");
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
  if(confirmedAnchor)next.lastConfirmedAnchor=validateJourneyAnchor(confirmedAnchor);
  if(next.routeTargets&&progress>=99.999&&arrivedCheckpoint?.id){
    next.routeTargets=confirmJourneyTarget(next.routeTargets,{
      checkpointId:arrivedCheckpoint.id,position:arrivedCheckpoint.point,
      tolerancePixels:checkpointTolerancePixels,
      transport:leg.transport
    });
  }
  if(status==="completed"&&next.routeTargets&&progress>=99.999)
    next.routeTargets.nextTargetIndex=next.routeTargets.targets.length;
  if(status==="completed"){
    if(Number.isFinite(arrivedWorldTime))next.arrivedWorldTime=arrivedWorldTime;
    if(arrivedTimeLabel)next.arrivedTimeLabel=String(arrivedTimeLabel);
  }
  return validateJourneyRecord(next);
}

export function resumeJourneyRecord(record,{itinerary,atlasRevision,
  journeyDestination=null,now=new Date().toISOString()}={}){
  const next=validateJourneyRecord(record);
  if(!RECOVERABLE.has(next.status)||atlasRevision!==next.atlasRevision||
      next.legs.length>=24)throw Error("This journey cannot safely resume. Plan a new route.");
  next.legs.push(journeyLegFromItinerary(itinerary));
  // The final Point B is independent of each checkpoint-bound travel leg.
  // A new destination may replace it only after an explicit GM route choice.
  if(journeyDestination!==null){
    if(!validPoint(journeyDestination))throw Error("Journey destination must be a valid Point B.");
    next.destination=point(journeyDestination);
  }
  next.status="moving";next.updatedAt=now;
  // A recovered active leg is not an arrival, even if an older beta left a
  // terminal stamp in otherwise recoverable metadata. Do not repeat it on the
  // following leg or display a false arrival after an interruption.
  delete next.arrivedWorldTime;
  delete next.arrivedTimeLabel;
  return validateJourneyRecord(next);
}

/** A canvas interruption must finish the approved leg before proceeding to Point B. */
export function isUnfinishedJourneyLeg(record){
  const leg=record?.legs?.at(-1);
  return Boolean(leg&&Number.isFinite(leg.completedPercent)&&
    leg.completedPercent<99.999);
}

/** Resolve the safe re-entry target without mutating saved Journal metadata. */
export function journeyRecoveryRouteDestination(record){
  const saved=validateJourneyRecord(record);
  const current=isUnfinishedJourneyLeg(saved)?saved.legs.at(-1):saved;
  return point(current.destination);
}

export function eligibleJourneyRecord(record,{sceneId,tokenId,atlasRevision}={}){
  try{
    const saved=validateJourneyRecord(record);
    return RECOVERABLE.has(saved.status)&&saved.sceneId===sceneId&&
      saved.tokenId===tokenId&&saved.atlasRevision===atlasRevision;
  }catch{return false;}
}

export function formatJourneyJournalHTML(raw,{settings=globalThis.game?.settings,
  systemId=globalThis.game?.system?.id}={}){
  const record=validateJourneyRecord(raw);
  const title=record.status==="completed"?"Completed":record.status==="ended"?"Ended":
    record.status==="interrupted"?"Interrupted — may resume":
    record.status==="paused"?"Paused — may resume":"In progress";
  const confirmedMoving=confirmedJourneyMovingHours(record);
  const underway=validatePassengerRestMetadata(record.passengerRest);
  const pendingRestText=underway?
    `<p><strong>Passenger rest aboard underway:</strong> ${escapeHTML(underway.action)} rest, `+
    `${escapeHTML(formatNavigationDuration(Math.max(0,underway.startedAtMovingHours+
      underway.hours-confirmedMoving),24))} of sailing time remaining. `+
    `Rest progress continues across a recovered voyage; no extra World time is added.</p>`:"";
  const confirmedBreaks=record.legs.reduce((sum,leg)=>sum+
    leg.events.reduce((hours,event)=>hours+(isRestUnderway(event.action)?0:(Number(event.hours)||0)),0),0);
  const clockMoving=record.legs.reduce((sum,leg)=>sum+leg.worldTravelSeconds,0);
  const clockBreaks=record.legs.reduce((sum,leg)=>sum+leg.worldRestSeconds,0);
  const legs=record.legs.map((leg,index)=>{
    // Render from retained native Scene units; never rewrite historical Journal flags.
    const displayDistance=amount=>{
      const display=atlasDisplayDistance(amount,leg.units,settings,systemId);
      return Number(display.value).toFixed(2)+" "+display.unit;
    };
    const timeline=confirmedJourneyDirections(leg.directions,leg.events,{
      travelHours:leg.movingHours,speed:leg.speedPerHour,
      terrainAware:leg.terrainAware,confirmedHours:leg.completedMovingHours});
    const transportLines=confirmedTransportJourneyLines(leg.transport,{
      movingHours:leg.completedMovingHours,
      complete:leg.completedPercent>=99.999}).map(line=>
      `<li>${escapeHTML(line)}</li>`).join("");
    const landMethod=leg.travelMethod&&leg.completedMovingHours>0?
      `<li>The party traveled using ${escapeHTML(leg.travelMethod.name)} (`+
        `${escapeHTML(leg.travelMethod.arrangement==="hire"?"hired":"party-owned")}).`+
        ` No automatic purchase, booking or currency deduction occurred.</li>`:"";
    const rows=timeline.map(step=>step.kind==="journey-event"?
      `<li><strong>${escapeHTML(step.label)}</strong> after `+
      `${escapeHTML(formatNavigationDuration(step.atHours,24))} on this leg`+
      (step.todayHours!==null?
        ` (${escapeHTML(formatNavigationDuration(step.todayHours,24))} traveled today)`:
        "")+
      (step.hours?(isRestUnderway(step.action)?
        ` — ${escapeHTML(formatNavigationDuration(step.hours,24))} resting while underway`:
        ` (+${escapeHTML(formatNavigationDuration(step.hours,24))})`):"")+
      (step.startedTimeLabel?` — World time: ${escapeHTML(step.startedTimeLabel)}`:"")+
      (step.endedTimeLabel&&step.endedTimeLabel!==step.startedTimeLabel?
        ` to ${escapeHTML(step.endedTimeLabel)}`:
        (step.hours&&!isRestUnderway(step.action)&&step.endedTimeLabel===step.startedTimeLabel?
          " (World clock unchanged)":""))+"</li>":
      `<li>${escapeHTML(step.instruction)} — ${escapeHTML(displayDistance(Number(step.distance)))}</li>`).join("");
    return `<section><h2>Leg ${index+1}: ${escapeHTML(leg.sceneName)}</h2>`+
      `<p>Distance: ${escapeHTML(displayDistance(Number(leg.distance)))}; `+
      `Moving time: ${escapeHTML(formatNavigationDuration(leg.movingHours,24))}; `+
      `Confirmed progress: ${Math.floor(leg.completedPercent)}% `+
      `(${escapeHTML(formatNavigationDuration(leg.completedMovingHours,24))} moving).</p>`+
      (transportLines||landMethod?
        `<h3>Confirmed Transportation and Transfers</h3><ul>${transportLines}${landMethod}</ul>`:"")+
      `<h3>Confirmed Directions and Stops</h3>`+
      `<p>The full planned route remains in this Journey's saved metadata. `+
      `Only confirmed travel and approved stops appear below.</p>`+
      `<ol>${rows}</ol>`+"</section>";
  }).join("");
  return `<h1>${escapeHTML(record.title??"Atlas Journey")} — ${escapeHTML(title)}</h1>`+
    `<p>Atlas automatically maintains this summary. Add personal notes as a separate Journal page.</p>`+
    `<p><strong>Last updated:</strong> ${escapeHTML(record.updatedAt)}</p>`+
    (record.startedTimeLabel?`<p><strong>Departed (World time):</strong> `+
      `${escapeHTML(record.startedTimeLabel)}</p>`:"")+
    (record.status==="completed"&&record.arrivedTimeLabel?
      `<p><strong>Arrived (World time):</strong> `+
      `${escapeHTML(record.arrivedTimeLabel)}</p>`:"")+
    `<h2>Journey Overview</h2>`+pendingRestText+
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

let folderCreation=null;
/** Keep Journal organization separate from persisted journey state. Existing
 * matching World folders are reused, and concurrent new journeys share one
 * in-flight folder creation. Never move the user's other Journal Entries. */
export async function ensureJourneyLogFolder({folders=globalThis.game?.folders,
  create=globalThis.foundry?.documents?.Folder?.create?.bind(
    globalThis.foundry?.documents?.Folder)}={}){
  if(!globalThis.game?.user?.isGM)throw Error("Only a GM may organize Atlas Journey Journals.");
  const entries=[...(folders?.contents??folders??[])];
  const existing=entries.find(folder=>folder.type==="JournalEntry"&&
    (folder.getFlag?.(MODULE_ID,JOURNEY_FOLDER_FLAG)===true||
      folder.name===JOURNEY_JOURNAL_FOLDER));
  if(existing)return existing;
  if(folderCreation)return folderCreation;
  if(typeof create!=="function")throw Error("Foundry Journal folder creation is unavailable.");
  folderCreation=Promise.resolve().then(()=>create({name:JOURNEY_JOURNAL_FOLDER,
    type:"JournalEntry",flags:{[MODULE_ID]:{[JOURNEY_FOLDER_FLAG]:true}}}));
  try{
    const created=await folderCreation;
    if(!created?.id)throw Error("Foundry did not create the Atlas Journey folder.");
    return created;
  }finally{folderCreation=null;}
}

/** All writes go through one Journal; its Atlas flag is the recovery source.
 * Generated text lives in one dedicated managed page; users may add other pages. */
export async function saveJourneyJournal(record,{journal=null,create=null,
  folderProvider=ensureJourneyLogFolder,updatePage=true}={}){
  if(!globalThis.game?.user?.isGM)throw Error("Only a GM may save an Atlas Journey Journal.");
  const state=validateJourneyRecord(record);
  // Native movement checkpoints update the authoritative flag frequently;
  // do not regenerate the display page until a visible Journal sync is due.
  const html=!journal||updatePage?formatJourneyJournalHTML(state):null;
  if(!journal){
    const folder=await folderProvider();
    const JournalEntry=globalThis.foundry?.documents?.JournalEntry;
    const creator=create??(JournalEntry?.create?.bind(JournalEntry));
    if(typeof creator!=="function")throw Error("Foundry Journal creation is unavailable.");
    const page={name:JOURNEY_JOURNAL_PAGE,type:"text",text:{
      format:globalThis.CONST?.JOURNAL_ENTRY_PAGE_FORMATS?.HTML??1,content:html
    }};
    const data={name:state.title??`Atlas Journey — ${state.legs[0].sceneName}`,
      folder:folder.id,
      ownership:{default:globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE??0},
      pages:[page],flags:{[MODULE_ID]:{[JOURNEY_JOURNAL_FLAG]:state}}};
    journal=await creator(data);
    if(!journal?.id)throw Error("Foundry did not create the Atlas Journey Journal.");
    return journal;
  }
  await persistJourneyState(journal,state);
  if(updatePage)await publishJourneySummary(journal,html);
  return journal;
}
