import {MODULE_ID} from "./atlas-storage.js";
import {atlasAnnouncementPreview} from "./atlas-announcement-model.js";
import {AtlasAnnouncementPreviewRenderer} from "./atlas-announcement-view.js";
import {committedJourneyAnnouncement,matchesSavedJourneyAnnouncement}
  from "./atlas-announcement-commit.js";
import {JOURNEY_JOURNAL_FLAG} from "./navigation-journey-state-store.js";

/** A one-slot, server-permissioned World setting distributes *public-safe*
 * display pulses. It is NOT movement history, an event queue, or recovery
 * authority, and no saved pulse is replayed when a client opens/reloads. */
export const ATLAS_ANNOUNCEMENT_PULSE="atlasAnnouncementPulse";
export const ATLAS_ANNOUNCEMENT_PULSE_SCHEMA=1;
const PUBLIC_SUBJECTS=Object.freeze({
  "journey.started":"new horizons",
  "checkpoint.arrived":"a waypoint",
  "destination.reached":"your destination",
  "journey.ended":"Until the next adventure",
  "journey.paused":"Travel is on hold"
});
const MAX_SEEN=128;

export function validatedAtlasAnnouncementPulse(value){
  if(!value||typeof value!=="object"||
      value.schemaVersion!==ATLAS_ANNOUNCEMENT_PULSE_SCHEMA||
      typeof value.id!=="string"||!/^[a-zA-Z0-9_-]{12,64}$/.test(value.id)||
      !Object.hasOwn(PUBLIC_SUBJECTS,value.type)||
      Object.keys(value).sort().join(",")!=="id,schemaVersion,type")
    return null;
  return Object.freeze({...value});
}

export class AtlasAnnouncementRuntime {
  constructor({settings=globalThis.game?.settings,
    renderer=new AtlasAnnouncementPreviewRenderer(),
    randomID=()=>globalThis.foundry?.utils?.randomID?.(24),
    user=()=>globalThis.game?.user,
    activeGM=()=>globalThis.game?.users?.activeGM,
    onWarning=error=>console.warn("Atlas announcement preview delivery failed",error)
  }={}){
    this.settings=settings;
    this.renderer=renderer;
    this.randomID=randomID;
    this.user=user;
    this.activeGM=activeGM;
    this.onWarning=onWarning;
    this.seen=new Set();
    this.sent=new Set();
    this.started=false;
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
      subject:PUBLIC_SUBJECTS[pulse.type]});
    return this.renderer.enqueue(spec.type,{subject:spec.subject});
  }

  /** GM-only, best-effort presentation AFTER Journal save/verification.
   * A failed visual delivery cannot stop/replay native movement, clock or fares. */
  publish({journal,previous=null,committed,type,subject,manualPause=false,
    checkpointId=null}={}){
    const me=this.user(),active=this.activeGM();
    if(!me?.isGM||me.id!==active?.id||!journal?.id||
        typeof journal.getFlag!=="function")return false;
    const plan=committedJourneyAnnouncement(previous,committed,{
      type,manualPause,checkpointId});
    if(!plan)return false;
    let stored;
    try{stored=journal.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG);}
    catch(error){this.onWarning(error);return false;}
    if(!matchesSavedJourneyAnnouncement(committed,stored))return false;
    const key=`${journal.id}|${plan.key}`;
    if(!this.remember(this.sent,key))return false;
    try{this.renderer.enqueue(type,{subject});}
    catch(error){this.onWarning(error);}
    const id=this.randomID();
    const pulse=validatedAtlasAnnouncementPulse({
      schemaVersion:ATLAS_ANNOUNCEMENT_PULSE_SCHEMA,id,type});
    const settings=this.getSettings();
    if(!pulse||typeof settings?.set!=="function")return true;
    // The World-setting onChange also fires on its originating GM. Prevent
    // the generic public projection from replacing the GM's specific banner.
    this.remember(this.seen,pulse.id);
    try{
      Promise.resolve(settings.set(MODULE_ID,ATLAS_ANNOUNCEMENT_PULSE,{...pulse}))
        .catch(error=>this.onWarning(error));
    }catch(error){this.onWarning(error);}
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
