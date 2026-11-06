import {MODULE_ID,readAtlas} from "./atlas-storage.js";
import {atlasAnnouncementPreview} from "./atlas-announcement-model.js";
import {AtlasAnnouncementPreviewRenderer} from "./atlas-announcement-view.js";
import {committedJourneyAnnouncement,matchesSavedJourneyAnnouncement}
  from "./atlas-announcement-commit.js";
import {JOURNEY_JOURNAL_FLAG} from "./navigation-journey-state-store.js";
import {readPartyExploration} from "./party-exploration-storage.js";
import {readCheckpointDiscoveryMethods,checkpointDiscoveryMethod}
  from "./checkpoint-discovery-method.js";
import {checkpointKnowledge} from "./party-exploration-model.js";
import {confirmedAutomaticCheckpointDiscovery,confirmedRoadVisibilityReveal}
  from "./atlas-announcement-discovery.js";
import {atlasDebug} from "./atlas-debug.js";
import {publicJourneyDestinationName} from "./atlas-announcement-destination.js";
import {publicRegionDestinationName} from "./atlas-announcement-region.js";

/** A one-slot, server-permissioned World setting distributes *public-safe*
 * display pulses. It is NOT movement history, an event queue, or recovery
 * authority, and no saved pulse is replayed when a client opens/reloads. */
export const ATLAS_ANNOUNCEMENT_PULSE="atlasAnnouncementPulse";
export const ATLAS_ANNOUNCEMENT_PULSE_SCHEMA=2;
const NAMED_PUBLIC_EVENTS=new Set(["journey.started","destination.reached"]);
const PUBLIC_SUBJECTS=Object.freeze({
  "checkpoint.discovered":"a new location",
  "road.discovered":"a new path",
  "journey.started":"your destination",
  "checkpoint.arrived":"a waypoint",
  "destination.reached":"your destination",
  "journey.ended":"Until the next adventure",
  "journey.paused":"Travel is on hold",
  "journey.awaiting-gm":"Travel is on hold",
  "journey.interrupted":"Travel is on hold",
  "break.started":"a rest",
  "break.ended":"The road awaits"
});
const MAX_SEEN=128;
const MAX_DIAGNOSTICS=32;

export function validatedAtlasAnnouncementPulse(value){
  if(!value||typeof value!=="object"||
      ![1,ATLAS_ANNOUNCEMENT_PULSE_SCHEMA].includes(value.schemaVersion)||
      typeof value.id!=="string"||!/^[a-zA-Z0-9_-]{12,64}$/.test(value.id)||
      !Object.hasOwn(PUBLIC_SUBJECTS,value.type))
    return null;
  const named=Object.hasOwn(value,"publicSubject");
  if((named&&(value.schemaVersion!==ATLAS_ANNOUNCEMENT_PULSE_SCHEMA||
      !NAMED_PUBLIC_EVENTS.has(value.type)||
      typeof value.publicSubject!=="string"||!value.publicSubject.trim()||
      value.publicSubject.length>120||
      /[\u0000-\u001f\u007f]/.test(value.publicSubject)))||
      Object.keys(value).sort().join(",")!==
        (named?"id,publicSubject,schemaVersion,type":"id,schemaVersion,type"))
    return null;
  return Object.freeze({...value});
}

export class AtlasAnnouncementRuntime {
  constructor({settings=globalThis.game?.settings,
    renderer=new AtlasAnnouncementPreviewRenderer(),
    canvasProvider=()=>globalThis.canvas,
    randomID=()=>globalThis.foundry?.utils?.randomID?.(24),
    user=()=>globalThis.game?.user,
    activeGM=()=>globalThis.game?.users?.activeGM,
    onWarning=error=>console.warn("Atlas announcement preview delivery failed",error)
  }={}){
    this.settings=settings;
    this.renderer=renderer;
    this.canvasProvider=canvasProvider;
    this.randomID=randomID;
    this.user=user;
    this.activeGM=activeGM;
    this.onWarning=onWarning;
    this.seen=new Set();
    this.sent=new Set();
    this.started=false;
    this.publicWrites=Promise.resolve();
    this.diagnostics=[];
  }

  remember(bucket,id){
    if(bucket.has(id))return false;
    bucket.add(id);
    if(bucket.size>MAX_SEEN)bucket.delete(bucket.values().next().value);
    return true;
  }

  getSettings(){return this.settings??globalThis.game?.settings;}

  /** Seed the current pointer to prevent reconnect/reload playback. */
  start(){
    try{
      const pulse=validatedAtlasAnnouncementPulse(
        this.getSettings()?.get(MODULE_ID,ATLAS_ANNOUNCEMENT_PULSE));
      if(pulse)this.remember(this.seen,pulse.id);
    }catch(error){this.onWarning(error);}
    this.started=true;
  }

  receive(value){
    if(!this.started)return false;
    const pulse=validatedAtlasAnnouncementPulse(value);
    if(!pulse||!this.remember(this.seen,pulse.id))return false;
    // The received World setting contains NO Journal, token, road,
    // checkpoint ID, destination name, hidden POI or free-form client text.
    const spec=atlasAnnouncementPreview(pulse.type,{
      subject:pulse.publicSubject??PUBLIC_SUBJECTS[pulse.type]});
    const queued=this.renderer.enqueue(spec.type,{subject:spec.subject});
    atlasDebug("announcement","Player-safe announcement received",{
      type:pulse.type,queued},{level:"verbose"});
    return queued;
  }

  /** Browser-local, GM-only status history for the preview panel. Never a
   * persisted flag or transmitted payload. No coordinates or Actor data. */
  diagnostic({type,subject,from,to,method,decision}){
    if(!this.user()?.isGM)return;
    const item=Object.freeze({at:new Date().toLocaleTimeString(),type,
      subject:String(subject??"(unnamed)").slice(0,160),from,to,method,decision});
    this.diagnostics.push(item);
    if(this.diagnostics.length>MAX_DIAGNOSTICS)this.diagnostics.shift();
    atlasDebug("announcement","Discovery status / banner decision",item,{level:"verbose"});
  }

  recentDiagnostics(){return this.user()?.isGM?this.diagnostics.map(item=>({...item})):[];}

  /** One server-permissioned World setting can only hold the latest pointer;
   * serialize writes so a burst of discoveries is delivered in order. */
  dispatch(type,subject,{publicSubject=null}={}){
    let queued=false;
    try{queued=this.renderer.enqueue(type,{subject});}
    catch(error){this.onWarning(error);}
    const pulse=validatedAtlasAnnouncementPulse({
      schemaVersion:ATLAS_ANNOUNCEMENT_PULSE_SCHEMA,id:this.randomID(),type,
      ...(publicSubject?{publicSubject}:{})});
    const settings=this.getSettings();
    if(!pulse||typeof settings?.set!=="function")return queued;
    this.remember(this.seen,pulse.id);
    const write=()=>Promise.resolve().then(()=>
      settings.set(MODULE_ID,ATLAS_ANNOUNCEMENT_PULSE,{...pulse}))
      .catch(error=>this.onWarning(error));
    this.publicWrites=this.publicWrites.then(write,write);
    return queued;
  }

  /** GM-only discovery projections after a native Scene flag has committed.
   * The caller supplies its before/after snapshots; verify the saved Scene
   * again before notifying clients. A failed banner never rolls back a Scene. */
  publishDiscovery({scene,kind,recordId,previous,committed}={}){
    const type=kind==="checkpoint"?"checkpoint.discovered":
      kind==="road"?"road.discovered":null;
    const me=this.user(),active=this.activeGM();
    if(!type||!me?.isGM||me.id!==active?.id||!scene?.id||
        !scene.canUserModify?.(me,"update")){
      if(type&&me?.isGM)this.diagnostic({type,subject:recordId,
        from:"unknown",to:"unknown",method:"authorization",
        decision:"Banner blocked: only the active, Scene-authorized GM may publish"});
      return false;
    }
    let subject,valid=false;
    try{
      const atlas=readAtlas(scene);
      if(kind==="checkpoint"){
        const checkpoint=atlas.checkpoints.find(item=>item.id===recordId);
        const stored=readPartyExploration(scene);
        const method=checkpointDiscoveryMethod(readCheckpointDiscoveryMethods(scene),recordId);
        valid=Boolean(checkpoint)&&
          JSON.stringify(committed)===JSON.stringify(stored)&&
          confirmedAutomaticCheckpointDiscovery(previous,stored,{
            checkpointId:recordId,method,exists:Boolean(checkpoint)});
        subject=checkpoint?.name;
        this.diagnostic({type,subject,from:checkpointKnowledge(previous,recordId),
          to:checkpointKnowledge(stored,recordId),method,
          decision:valid?"Verified Scene visit":"Rejected: no matching automatic visit"});
      }else{
        const road=atlas.roads.find(item=>item.id===recordId);
        valid=Boolean(road)&&JSON.stringify(committed)===JSON.stringify(atlas)&&
          confirmedRoadVisibilityReveal(previous,atlas,recordId);
        subject=road?.name;
        this.diagnostic({type,subject,from:previous?.roads?.find(item=>item.id===recordId)?.playerVisible===true?
          "shown":"hidden",to:road?.playerVisible===true?"shown":"hidden",
        method:"GM visibility setting",decision:valid?"Verified Scene visibility":"Rejected: no saved reveal transition"});
      }
    }catch(error){this.onWarning(error);return false;}
    if(!valid)return false;
    // An authored empty name is not a valid banner subject. Use safe fallback.
    let queued=false;
    try{queued=this.dispatch(type,typeof subject==="string"&&subject.trim()?
      subject:(kind==="road"?"a new path":"a new location"));}
    catch(error){this.onWarning(error);}
    this.diagnostic({type,subject,from:kind==="checkpoint"?"Unknown":"Hidden",
      to:kind==="checkpoint"?"Seen / Visited":"Shown to players",
      method:kind==="checkpoint"?"Automatic proximity":"GM visibility setting",
      decision:queued?"GM banner queued; public pulse scheduled":
        "GM banner unavailable; public pulse attempted"});
    return queued;
  }

  /** GM-only, best-effort presentation AFTER Journal save/verification.
   * A failed visual delivery cannot stop/replay native movement, clock or fares. */
  publish({journal,scene=null,previous=null,committed,type,subject,manualPause=false,
    checkpointId=null,canvasRecovery=false,gmReviewRequired=false}={}){
    const me=this.user(),active=this.activeGM();
    if(!me?.isGM||me.id!==active?.id||!journal?.id||
        typeof journal.getFlag!=="function")return false;
    const plan=committedJourneyAnnouncement(previous,committed,{
      type,manualPause,checkpointId,canvasRecovery,gmReviewRequired});
    if(!plan){
      this.diagnostic({type,subject,from:previous?.status,to:committed?.status,
        method:"Journey Journal",decision:"Rejected: missing approved transition"});
      return false;
    }
    let stored;
    try{stored=journal.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG);}
    catch(error){this.onWarning(error);return false;}
    if(!matchesSavedJourneyAnnouncement(committed,stored,{
      verifyRest:type==="break.started"||type==="break.ended",
      allowPendingInterruption:type==="journey.interrupted"&&canvasRecovery})){
      this.diagnostic({type,subject,from:previous?.status,to:committed?.status,
        method:"Journey Journal",decision:"Rejected: saved Journal receipt mismatch"});
      return false;
    }
    let publicSubject=null,displaySubject=subject;
    if(NAMED_PUBLIC_EVENTS.has(type)&&scene){
      // Never treat GM's free-form subject or Journal title as player-safe.
      // Re-read the actual Scene and party visibility after Journal verification.
      displaySubject=PUBLIC_SUBJECTS[type];
      try{
        if(scene.id===stored.sceneId&&scene.id===committed.sceneId&&
            scene.canUserModify?.(me,"update")&&
            stored.atlasRevision===committed.atlasRevision&&
            JSON.stringify(stored.destination)===JSON.stringify(committed.destination)&&
            JSON.stringify(stored.routeTargets??null)===
              JSON.stringify(committed.routeTargets??null)){
          const atlas=readAtlas(scene);
          publicSubject=publicJourneyDestinationName({
            atlas,exploration:readPartyExploration(scene),
            record:stored,gridSize:scene.grid?.size});
          // Public Region fallback is explicit GM opt-in and native-contained.
          // It cannot name an arbitrary unapproved Region or closest POI.
          if(!publicSubject)publicSubject=publicRegionDestinationName({
            scene,view:this.canvasProvider(),atlas,record:stored});
          if(publicSubject)displaySubject=publicSubject;
        }
      }catch(error){this.onWarning(error);}
    }
    const key=`${journal.id}|${plan.key}`;
    if(!this.remember(this.sent,key))return false;
    let displayed=false;
    try{displayed=this.dispatch(type,displaySubject,{publicSubject});}
    catch(error){this.onWarning(error);}
    this.diagnostic({type,subject,from:previous?.status,to:committed?.status,
      method:"Journey Journal",decision:displayed?
        "Verified Journal; GM banner queued; public pulse scheduled":
        "Verified Journal; GM renderer unavailable"});
    return true;
  }
}

export const atlasAnnouncementRuntime=new AtlasAnnouncementRuntime();

export function registerAtlasAnnouncementDelivery(){
  globalThis.game.settings.register(MODULE_ID,ATLAS_ANNOUNCEMENT_PULSE,{
    name:"Atlas — Last Public Announcement (display only)",
    hint:"A transient, public-safe announcement pointer; not Journey history.",
    scope:"world",config:false,type:Object,
    default:{schemaVersion:ATLAS_ANNOUNCEMENT_PULSE_SCHEMA,id:"",type:""},
    onChange:value=>atlasAnnouncementRuntime.receive(value)
  });
}

export function publishAtlasJourneyAnnouncement(payload){
  return atlasAnnouncementRuntime.publish(payload);
}
