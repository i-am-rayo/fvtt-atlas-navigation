import { MODULE_ID,readAtlas } from "./atlas-storage.js";
import { toAtlasPoint, toCanvasPoint } from "./road-coordinates.js";
import { calculateSceneRoadRoute } from "./navigation-foundry.js";
import { roadStrokeSpans } from "./road-appearance.js";
import { drawNavigationLine, drawNavigationMarker } from "./navigation-graphics.js";
import { navigationCanvasLegPaths } from "./navigation-render-path.js";
import { createGuidedTokenWaypoints } from "./navigation-token-travel.js";
import { partyTokenCanvasCenter } from "./navigation-party-origin.js";
import { planGuidedTravelChunks, waitForTokenTravelAnimation,MAX_GUIDED_CHUNKS }
  from "./navigation-movement-lifecycle.js";
import { GuidedTravelDayTracker,estimateNavigationTotalTrip,
  splitGuidedChunkAtDistance,MAX_GUIDED_REST_EVENTS } from "./navigation-travel-day.js";
import { annotateJourneyDirections,projectJourneyTiming }
  from "./navigation-journey-timeline.js";
import { resolveNavigationTravelRules } from "./navigation-rules-profile.js";
import { GuidedJourneyClock, readNavigationWorldClockSetting, formatGuidedWorldTime }
  from "./navigation-world-clock.js";
import { calculateGuidedPlayback,formatPlaybackDuration,readGuidedPlaybackSetting }
  from "./navigation-playback.js";
import { NAVIGATION_SPEED_SETTING, DEFAULT_NAVIGATION_SPEED,
  navigationHours, formatNavigationDuration }
  from "./navigation-time.js";
import { buildNavigationSteps, NAVIGATION_ARROWS } from "./navigation-instructions.js";
import { navigationPointIntent } from "./navigation-selection.js";
import { createNavigationItinerary } from "./navigation-itinerary.js";
import { REGION_ROUTING_ORDER_FLAG } from "./navigation-terrain.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import { resolveNavigationTravelSpeed } from "./navigation-party-speed.js";
import { atlasDebug,atlasWarn } from "./atlas-debug.js";
import { createJourneyRecord,checkpointJourneyRecord,resumeJourneyRecord,
  validateJourneyRecord,eligibleJourneyRecord,findRecoverableJourney,saveJourneyJournal,
  JOURNEY_JOURNAL_FLAG } from "./navigation-journey-journal.js";

const el = (tag, content) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
};

/** GM-only navigation. Travel uses an explicit, native v14 TokenDocument.move action. */
export class AtlasNavigationController extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-navigation-panel",
    window: { title: "Atlas — Navigation", resizable: true },
    position: { width: 420, height: 320, left: 100, top: 170 }
  };

  constructor({ canvasProvider = () => globalThis.canvas,
    routeCalculator=calculateSceneRoadRoute,atlasProvider=readAtlas,
    atlasPoint=toAtlasPoint,
    journeyJournalStore={save:saveJourneyJournal,find:findRecoverableJourney},
    partyTokenProvider=scene=>{
      const assignment=readPartyExploration(scene);
      return assignment.enabled?scene?.tokens?.get?.(assignment.tokenId):null;
    } } = {}) {
    super();
    this.canvasProvider = canvasProvider;
    this.routeCalculator=routeCalculator;
    this.atlasProvider=atlasProvider;
    this.atlasPoint=atlasPoint;
    this.partyTokenProvider=partyTokenProvider;
    this.journeyJournalStore=journeyJournalStore;
    this.scene = null;
    this.sourceMode = "map";
    this.start = null;
    this.end = null;
    this.result = null;
    this.itinerary=null;
    this.routeRevision=null;
    this.notice="";
    this.travelSession=null;
    this.travelNotice="";
    this.travelProgress=0;
    this.travelProgressUI=null;
    this.journeyTimeUI=null;
    this.worldTimeAdvancedSeconds=0;
    this.worldTravelAdvancedSeconds=0;
    this.worldRestAdvancedSeconds=0;
    this.worldTimeUI=null;
    this.journeySchedule=null;
    this.pointerTarget = null;
    this.overlay = null;
    this.pointerDown = this.onPointerDown.bind(this);
    this.closedByController = false;
    this.recoverableJourney=null;
    this.recoveryJournal=null;
    this.recoveryRecord=null;
    this.journeyJournal=null;
    this.journalStarting=false;
    this.autoResumePending=null;
    this.autoResumeAttempts=new Map();
    this.canvasTeardownClose=Promise.resolve();
  }

  get active() { return Boolean(this.scene); }

  activate() {
    const view = this.canvasProvider();
    if (!game.user?.isGM || !view?.ready || !view.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may navigate an active Atlas Scene.");
    }
    this.stop();
    this.scene = view.scene;
    atlasDebug("lifecycle","Navigation opened",{sceneId:this.scene.id});
    this.findRecoverableJournal();
    this.bindPointer();
    void this.render(true);
    this.draw();
  }

  bindPointer() {
    const view = this.canvasProvider();
    const target = view?.app?.canvas ?? view?.app?.view;
    if (!target?.addEventListener || typeof view.canvasCoordinatesFromClient !== "function") {
      throw new Error("Foundry canvas map selection is unavailable.");
    }
    this.pointerTarget = target;
    target.addEventListener("pointerdown", this.pointerDown, true);
  }

  /** Use one route calculation for both map-point and live party departures. */
  calculateRoute(view,atlas) {
    this.routeRevision=atlas.revision;
    this.result=null;
    this.itinerary=null;
    this.travelProgress=0;
    this.worldTimeAdvancedSeconds=0;
    this.worldTravelAdvancedSeconds=0;
    this.worldRestAdvancedSeconds=0;
    this.journeySchedule=null;
    this.journeyTimeUI=null;
    if(!this.start||!this.end)return;
    try{
      this.result=this.routeCalculator(view,this.scene,atlas,this.start,this.end);
      if(this.result?.status==="ok"){
        this.itinerary=createNavigationItinerary({
          sceneId:this.scene.id,sceneName:this.scene.name??"",
          sceneUnits:this.scene.grid?.units??"",atlasRevision:atlas.revision,
          route:this.result,roadName:id=>atlas.roads.find(road=>road.id===id)?.name??"Road",
          travel:this.resolveTravel().travel
        });
      }
    }catch(error){
      this.result={status:"error",reason:error.message||String(error)};
      ui.notifications.error(this.result.reason);
    }
  }

  /** Translate the actual placed TokenDocument center through the regular Atlas converter. */
  syncPartyDeparture(view,atlas) {
    const token=this.getPartyToken();
    if(!token || !token.canUserModify?.(game.user,"update"))
      throw Error("Assign a placed Atlas party explorer token that the GM may move.");
    const center=partyTokenCanvasCenter(token,this.scene?.grid?.size);
    const origin=this.atlasPoint(view,atlas,center);
    if(!Number.isFinite(origin?.x)||!Number.isFinite(origin?.y))
      throw Error("The party token location is outside the usable Atlas map.");
    const changed=!this.start||Math.hypot(origin.x-this.start.x,origin.y-this.start.y)>0.001;
    this.start=origin;
    return changed;
  }

  /** Switching departure modes leaves B intact but makes the chosen A explicit. */
  setSourceMode(mode) {
    if(this.travelSession||!this.scene||!["map","party"].includes(mode))return;
    const view=this.canvasProvider();
    if(!game.user?.isGM||!view?.ready||view.scene?.id!==this.scene.id)return;
    try{
      const atlas=this.atlasProvider(this.scene);
      if(mode==="party")this.syncPartyDeparture(view,atlas);
      else if(mode!==this.sourceMode)this.start=null;
      this.sourceMode=mode;
      this.notice="";
      this.travelNotice="";
      this.calculateRoute(view,atlas);
      this.draw();
      void this.render(true);
    }catch(error){ui.notifications.warn(error.message||String(error));}
  }

  refreshPartyDeparture() {
    if(this.sourceMode!=="party"||this.travelSession||!this.scene)return;
    const view=this.canvasProvider();
    try{
      const atlas=this.atlasProvider(this.scene);
      this.syncPartyDeparture(view,atlas);
      this.calculateRoute(view,atlas);
      this.draw();
      void this.render(true);
    }catch(error){ui.notifications.warn(error.message||String(error));}
  }

  onPointerDown(event) {
    if(!this.scene||this.travelSession)return;
    const intent=navigationPointIntent(event,this);
    if(!intent)return;
    const view = this.canvasProvider();
    if (!game.user?.isGM || !view?.ready || view.scene?.id !== this.scene.id ||
        !view.scene?.canUserModify?.(game.user,"update")) {
      this.stop();
      return;
    }
    const canvasPoint = view.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
    if (!Number.isFinite(canvasPoint?.x) || !Number.isFinite(canvasPoint?.y)) return;
    const rect = view.dimensions?.sceneRect;
    if (rect?.contains && !rect.contains(canvasPoint.x, canvasPoint.y)) return;
    // Resolve a valid Atlas position before intercepting Foundry's pointer event.
    let atlas,location;
    try{
      atlas=this.atlasProvider(this.scene);
      location=this.atlasPoint(view,atlas,canvasPoint);
      if(this.sourceMode==="party")this.syncPartyDeparture(view,atlas);
    }catch(error){
      ui.notifications.error(error.message||String(error));return;
    }
    if(!Number.isFinite(location?.x)||!Number.isFinite(location?.y))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.notice="";
    if(intent==="start") {
      this.start = location;
    } else {
      this.end = location;
    }
    this.calculateRoute(view,atlas);
    this.draw();
    void this.render(true);
    if (this.result?.status === "ok") {
      const viewport = globalThis.window;
      this.setPosition?.({
        width: Math.min(640, Math.max(380, (viewport?.innerWidth ?? 1000) - 64)),
        height: Math.min(790, Math.max(350, (viewport?.innerHeight ?? 900) - 90))
      });
    }
  }

  draw() {
    const view = this.canvasProvider();
    if (!this.scene || view?.scene?.id !== this.scene.id || !view.ready ||
        !globalThis.PIXI?.Graphics || !view.primary?.addChild) return;
    if (!this.overlay || this.overlay.destroyed) {
      this.overlay = new PIXI.Graphics();
      this.overlay.label = "Atlas Navigation Route";
      this.overlay.eventMode = "none";
      const layers = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
      this.overlay.sortLayer = layers.TILES + 1;
      this.overlay.sort = 1e100;
      view.primary.addChild(this.overlay);
    }
    const graphics = this.overlay;
    graphics.clear();
    const atlas = this.atlasProvider(this.scene);
    const canvasPoint = p => toCanvasPoint(view, atlas, p);
    const paths=navigationCanvasLegPaths(view,atlas,this.result);
    for (const {kind,points} of paths) {
      const spans = kind === "road" ? [points] : roadStrokeSpans(points, "dashed", 4);
      drawNavigationLine(graphics, spans, {
        color:0xffa51f, width:kind==="road"?6:3.5, alpha:0.95
      });
    }
    for (const [point,color] of [[this.start,0x16b9a1],[this.end,0xf34c4c]]) {
      if (!point) continue;
      const p=canvasPoint(point);
      drawNavigationMarker(graphics, p, color);
    }
  }

  /** A caller receives a copy; future Journal exports must not mutate live UI state. */
  getItinerarySnapshot(){return this.itinerary?structuredClone(this.itinerary):null;}

  /** Only the manually assigned Scene explorer can travel in this GM-only slice. */
  getPartyToken(){
    return this.scene?this.partyTokenProvider(this.scene):null;
  }

  findRecoverableJournal(){
    this.recoverableJourney=null;
    if(!this.scene||!game.user?.isGM)return;
    const token=this.getPartyToken();
    if(!token?.id)return;
    try{
      this.recoverableJourney=this.journeyJournalStore.find(
        game.journal?.contents??game.journal??[],{
          sceneId:this.scene.id,tokenId:token.id,
          atlasRevision:this.atlasProvider(this.scene).revision
        });
    }catch(error){atlasWarn("journey","Could not locate saved journey",error);}
  }

  /** Load a saved destination, but never start a token movement automatically. */
  recoverSavedJourney(){
    if(this.travelSession||this.journalStarting||!this.scene)return false;
    const journal=this.recoverableJourney;
    const record=journal?.getFlag?.(MODULE_ID,JOURNEY_JOURNAL_FLAG);
    const token=this.getPartyToken();
    const atlas=this.atlasProvider(this.scene);
    if(!eligibleJourneyRecord(record,{sceneId:this.scene.id,
      tokenId:token?.id,atlasRevision:atlas.revision}))
      throw Error("The saved journey no longer matches this Scene or party token.");
    const view=this.canvasProvider();
    if(!view?.ready||view.scene?.id!==this.scene.id)
      throw Error("Open the journey's original Scene before resuming.");
    const saved=validateJourneyRecord(record);
    this.sourceMode="party";
    this.syncPartyDeparture(view,atlas);
    this.end={...saved.destination};
    this.calculateRoute(view,atlas);
    if(this.result?.status!=="ok")
      throw Error("The remaining journey cannot be routed safely. Review the road network.");
    this.recoveryJournal=journal;
    this.recoveryRecord=saved;
    this.journeyJournal=journal;
    this.travelNotice="Saved journey loaded. Review the remaining route, then select Travel Route. "+
      "Atlas will not replay prior movement or World time.";
    atlasDebug("journey","Saved journey prepared for GM recovery",{
      sceneId:this.scene.id,journalId:journal.id
    });
    this.draw();void this.render(true);
    return true;
  }

  async saveJourneyCheckpoint(session,status,{updatePage=true}={}){
    if(!session?.journal||!session.journeyRecord)return;
    const saved=checkpointJourneyRecord(session.journeyRecord,{
      schedule:session.schedule,status,
      progress:Math.max(0,Math.min(100,100*session.completedDistance/session.totalDistance)),
      worldTravelSeconds:session.clock?.advancedSeconds??0,
      worldRestSeconds:session.clock?.restSeconds??0
    });
    session.journeyRecord=saved;
    // Scene redraws may interrupt an in-flight write. Serialize the final
    // interrupted state after any earlier checkpoint; last committed wins.
    session.journalQueue=(session.journalQueue??Promise.resolve()).catch(()=>{}).then(async()=>{
      await this.journeyJournalStore.save(saved,{journal:session.journal,updatePage});
    });
    await session.journalQueue;
  }

  /** Update the live progress display without re-rendering the scrollable directions. */
  setTravelProgress(percent){
    this.travelProgress=Math.max(0,Math.min(100,Number(percent)||0));
    const ui=this.travelProgressUI;
    if(ui){
      ui.bar.value=this.travelProgress;
      ui.label.textContent=`${Math.floor(this.travelProgress)}% complete`;
    }
    this.updateJourneyTiming();
  }

  updateJourneyTiming(){
    const ui=this.journeyTimeUI;
    if(!ui)return;
    const schedule=this.journeySchedule;
    const plan=schedule?.estimate??ui.plan;
    const timing=projectJourneyTiming({travelHours:ui.travelHours,
      percent:this.travelProgress,totalHours:plan.totalHours,
      breakHours:schedule?.breakHours??0});
    ui.moving.textContent=formatNavigationDuration(timing.movingHours,24);
    ui.elapsed.textContent=formatNavigationDuration(timing.elapsedHours,24);
    ui.eta.textContent=formatNavigationDuration(timing.etaHours,24);
  }

  worldTimeStatus(){
    const moving=formatGuidedWorldTime(this.worldTravelAdvancedSeconds);
    const rest=this.worldRestAdvancedSeconds;
    return `Foundry World time advanced: +${formatGuidedWorldTime(this.worldTimeAdvancedSeconds)} `+
      (rest?`(moving ${moving}; breaks ${formatGuidedWorldTime(rest)})`:
        "(moving only; no breaks yet)");
  }

  setWorldTimeAdvanced(movingSeconds,breakSeconds=0){
    this.worldTravelAdvancedSeconds=movingSeconds;
    this.worldRestAdvancedSeconds=breakSeconds;
    this.worldTimeAdvancedSeconds=movingSeconds+breakSeconds;
    if(this.worldTimeUI)this.worldTimeUI.textContent=
      this.worldTimeStatus();
  }

  async commitGuidedWorldTime(session,{force=false}={}){
    if(!session.clock)return 0;
    const delta=await session.clock.commit(session.completedDistance,{force});
    if(delta)atlasDebug("clock","Confirmed travel time advanced",{
      sceneId:session.sceneId,seconds:delta,
      totalMovingSeconds:session.clock.advancedSeconds,force
    },{level:"verbose"});
    if(this.travelSession===session)this.setWorldTimeAdvanced(
      session.clock.advancedSeconds,session.clock.restSeconds);
    return delta;
  }

  /** All rule interpretations flow through one pure World settings adapter. */
  resolveTravelRules(travel){
    return resolveNavigationTravelRules({settings:game.settings,
      systemId:game.system?.id,actorHoursPerDay:travel?.hoursPerDay});
  }

  /** The GM's choice is explicit; it cannot originate in a background timer. */
  chooseDailyTravelBreak(action){
    const session=this.travelSession;
    if(!session||session.phase!=="rest-choice"||!session.restWaiter)return false;
    session.phase="rest-applying";
    session.restCheckpointed=false;
    atlasDebug("journey","GM selected travel-day decision",{
      sceneId:session.sceneId,action,completedPercent:Math.floor(this.travelProgress)
    });
    const resolve=session.restWaiter;
    session.restWaiter=null;
    resolve(action);
    if(this.active)void this.render(true);
    return true;
  }

  async waitForDailyTravelChoice(session){
    if(!session.schedule.needsDecision)return true;
    session.phase="rest-checkpointing";
    // A daily-limit boundary is a durable confirmed stop, even if fewer than
    // five native movement stretches have completed since the last save.
    await this.saveJourneyCheckpoint(session,"paused");
    if(session.phase==="ending"||this.travelSession!==session)return false;
    session.phase="rest-choice";
    atlasDebug("journey","Daily travel limit reached",{
      sceneId:session.sceneId,todayHours:session.schedule.todayHours
    });
    const past=session.schedule.lastForcedCheck;
    const forced=past?` Resolve the hour-${past.extraHour} forced-march DC ${past.dc} `+
      "Constitution saves with your players; Atlas never applies exhaustion.":"";
    this.travelNotice=`Daily travel limit (${session.schedule.rules.dailyHours}h) reached. `+
      "Choose an overnight camp, a long or short rest, or continued travel."+forced;
    const choicePromise=new Promise(resolve=>{session.restWaiter=resolve;});
    if(this.active)await this.render(true);
    const action=await choicePromise;
    session.restWaiter=null;
    if(session.phase==="ending"||this.travelSession!==session||!action)return false;
    const choice=session.schedule.breakChoice(action);
    if(choice.hours>0){
      // Settle any remaining travel seconds before an independently confirmed
      // calendar break, preserving ledger order across Foundry time hooks.
      await this.commitGuidedWorldTime(session,{force:true});
      if(session.clock)await session.clock.commitBreak(Math.round(choice.hours*3600));
      atlasDebug("clock","GM-confirmed rest recorded",{
        sceneId:session.sceneId,action,hours:choice.hours,
        worldTimeAdvanced:Boolean(session.clock)
      });
    }
    session.schedule.applyBreak(choice);
    if(session.clock)this.setWorldTimeAdvanced(
      session.clock.advancedSeconds,session.clock.restSeconds);
    await this.saveJourneyCheckpoint(session,session.phase==="ending"?
      "interrupted":"moving");
    session.restCheckpointed=true;
    atlasDebug("journey","Rest decision and World-time checkpoint settled",{
      sceneId:session.sceneId,action,interrupted:session.phase==="ending",
      confirmedRestHours:session.schedule.breakHours
    });
    this.travelNotice=action==="continue"?
      "Forced travel approved for one more hour. Resolve required saves manually.":
      `${action==="overnight"?"Overnight camp":action==="long"?"Long rest":"Short rest"} `+
      `completed (${formatGuidedWorldTime(Math.round(choice.hours*3600))}). `+
      (choice.resetsDay?"Daily travel allowance reset.":"Daily travel hours are unchanged.");
    if(session.phase!=="ending")session.phase="moving";
    if(this.active)await this.render(true);
    return session.phase!=="ending";
  }

  /** Hold the next native move while the GM decides whether to resume or end. */
  async waitForGuidedTravelResume(session){
    if(session.phase==="pausing"){
      // A GM must see the confirmed World time before the paused state settles.
      await this.commitGuidedWorldTime(session,{force:true});
      await this.saveJourneyCheckpoint(session,"paused");
      if(session.phase==="ending"||this.travelSession!==session)return;
      session.phase="paused";
      this.travelNotice="Journey paused. Resume Travel continues from this position.";
      if(this.active)void this.render(true);
    }
    if(session.phase==="paused"){
      await new Promise(resolve=>{session.resumeWaiter=resolve;});
      session.resumeWaiter=null;
    }
  }

  /** Execute the already-previewed curve through Foundry's native movement pipeline. */
  async startGuidedTravel(){
    const view=this.canvasProvider();
    if(this.travelSession||this.journalStarting)
      throw Error("Guided travel is already in progress or being prepared.");
    if(!game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update")||
        !view?.ready||view.scene?.id!==this.scene?.id||this.result?.status!=="ok")
      throw Error("A GM must calculate a route on the active Scene before guided travel.");
    if(!this.result.legs?.some(leg=>leg.kind==="road"))
      throw Error("Guided travel requires a route containing an Atlas road.");
    const token=this.getPartyToken();
    if(!token||typeof token.move!=="function"||
        !token.canUserModify?.(game.user,"update"))
      throw Error("Assign a placed party explorer token with movement permission before travel.");
    const atlas=this.atlasProvider(this.scene);
    if(atlas.revision!==this.routeRevision)
      throw Error("The road network changed. Calculate a fresh route before traveling.");
    if(this.sourceMode==="party" && this.syncPartyDeparture(view,atlas)){
      // Re-read live token position before movement, never follow an outdated route.
      this.calculateRoute(view,atlas);
      this.draw();
      void this.render(true);
      if(this.result?.status!=="ok")throw Error("The party token's current position has no connected road route.");
    }
    const paths=navigationCanvasLegPaths(view,atlas,this.result);
    const waypoints=createGuidedTokenWaypoints(paths,token,this.scene.grid?.size);
    const travel=this.resolveTravel().travel;
    const playback=calculateGuidedPlayback({
      route:this.result,travel,paths,
      gridSize:this.scene.grid?.size,
      secondsPerHour:readGuidedPlaybackSetting(game.settings)
    });
    const chunks=planGuidedTravelChunks(waypoints,{
      movementSpeed:playback.movementSpeed,gridSize:this.scene.grid.size
    });
    const totalDistance=chunks.reduce((sum,chunk)=>sum+chunk.distance,0);
    const schedule=new GuidedTravelDayTracker({travelHours:playback.travelHours,
      rules:this.resolveTravelRules(travel)});
    const advanceWorldTime=readNavigationWorldClockSetting(game.settings);
    if(advanceWorldTime){
      if(game.users?.activeGM?.id!==game.user?.id||!game.user?.isGM)
        throw Error("Only Foundry's active GM can advance World time during an Atlas journey.");
      if(typeof game.time?.advance!=="function")
        throw Error("Foundry World time is unavailable for guided travel.");
    }
    const session={token,sceneId:this.scene.id,gridSize:this.scene.grid.size,
      phase:"moving",resumeWaiter:null,restWaiter:null,schedule,
      completedDistance:0,totalDistance,currentChunk:null,timer:null,clock:null,
      confirmedSegments:0,restCheckpointed:false};
    session.finished=new Promise(resolve=>{session.resolveFinished=resolve;});
    // The Journal is the one durable journey store. Create it before any
    // movement; a failed Journal write cannot leave an unrecorded trip.
    this.journalStarting=true;
    try{
      const recovered=this.recoveryRecord;
      const record=recovered?
        resumeJourneyRecord(recovered,{itinerary:this.itinerary,atlasRevision:atlas.revision}):
        createJourneyRecord({sceneId:this.scene.id,tokenId:token.id,
          atlasRevision:atlas.revision,itinerary:this.itinerary});
      if(recovered){
        schedule.todayHours=recovered.day.todayHours;
        schedule.permittedExtraUntil=recovered.day.permittedExtraUntil;
        schedule.restEvents=recovered.day.restEvents;
        schedule.lastForcedCheck=recovered.day.lastForcedCheck;
      }
      session.journal=await this.journeyJournalStore.save(record,{
        journal:this.recoveryJournal});
      session.journeyRecord=record;
      session.journalQueue=Promise.resolve();
      if(this.scene?.id!==session.sceneId||!this.canvasProvider()?.ready||
          this.routeRevision!==atlas.revision||this.result?.status!=="ok"){
        await this.saveJourneyCheckpoint(session,"interrupted");
        throw Error("The Scene or route changed while the journey was being prepared. Reopen Navigation to recover it.");
      }
      this.journeyJournal=session.journal;
      this.recoveryJournal=null;
      this.recoveryRecord=null;
      this.recoverableJourney=null;
    }finally{this.journalStarting=false;}
    if(advanceWorldTime)session.clock=new GuidedJourneyClock({
      travelHours:playback.travelHours,totalDistance,
      advance:seconds=>game.time.advance(seconds),
      authorize:()=>game.user?.isGM&&game.users?.activeGM?.id===game.user?.id&&
        readNavigationWorldClockSetting(game.settings)&&
        this.travelSession===session&&this.scene?.id===session.sceneId
    });
    this.travelSession=session;
    atlasDebug("journey","Guided journey started",{
      sceneId:session.sceneId,chunkCount:chunks.length,
      plannedTravelHours:Math.round(playback.travelHours*100)/100,
      worldClockEnabled:advanceWorldTime
    });
    this.journeySchedule=schedule;
    this.travelNotice="Guided travel in progress. Pause Travel stops at the next short stretch.";
    this.setTravelProgress(0);
    this.setWorldTimeAdvanced(0);
    try{
      // Render the controls before awaiting Foundry's long-running native move.
      await this.render(true);
      if(this.travelSession!==session)return false;
      const pixelsPerSecond=playback.movementSpeed*this.scene.grid.size;
      session.timer=setInterval(()=>{
        if(this.travelSession!==session)return;
        const chunk=session.currentChunk;
        const fraction=chunk?Math.min(.99,Math.max(0,
          (Date.now()-chunk.startedAt)/chunk.durationMs)):0;
        this.setTravelProgress(Math.min(99,100*(session.completedDistance+
          (chunk?.distance??0)*fraction)/session.totalDistance));
      },100);
      let reachedEnd=true,interruptedReason=null,clockFailed=false;
      for(let index=0;index<chunks.length;index++){
        if(this.travelSession!==session||session.phase==="ending"){
          reachedEnd=false;break;
        }
        try{await this.waitForGuidedTravelResume(session);}
        catch(error){
          reachedEnd=false;clockFailed=true;
          interruptedReason="World time could not advance: "+(error.message||String(error));
          break;
        }
        if(this.travelSession!==session||session.phase==="ending"){
          reachedEnd=false;break;
        }
        // A short rest advances the clock but does not replenish daily travel
        // hours. Offer another choice at the same boundary before any move.
        while(schedule.needsDecision){
          try{
            const approved=await this.waitForDailyTravelChoice(session);
            if(!approved){reachedEnd=false;break;}
          }catch(error){
            reachedEnd=false;clockFailed=true;
            interruptedReason="Travel break could not complete: "+(error.message||String(error));
            break;
          }
        }
        if(!reachedEnd)break;
        if(this.travelSession!==session||session.phase==="ending"){
          reachedEnd=false;break;
        }
        let chunk=chunks[index];
        const availableDistance=schedule.availableHours/playback.travelHours*totalDistance;
        if(Number.isFinite(availableDistance)&&availableDistance<chunk.distance-1e-5){
          if(chunks.length>=MAX_GUIDED_CHUNKS+MAX_GUIDED_REST_EVENTS)
            throw Error("The journey needs too many movement-day boundaries.");
          const halves=splitGuidedChunkAtDistance(chunk,availableDistance);
          chunks.splice(index,1,...halves);
          chunk=halves[0];
        }
        session.currentChunk={distance:chunk.distance,startedAt:Date.now(),
          durationMs:1000*chunk.distance/pixelsPerSecond};
        atlasDebug("movement","Native token move requested",{
          sceneId:session.sceneId,chunk:index+1,chunkCount:chunks.length,
          plannedDurationMs:Math.round(session.currentChunk.durationMs)
        },{level:"verbose"});
        const completed=await token.move(chunk.waypoints,{
          animate:true,autoRotate:false,showRuler:false,pan:false,
          animation:{movementSpeed:playback.movementSpeed}
        });
        // Native document updates can finish long before the visible movement.
        // Never submit the next stretch until this Canvas animation is finished.
        await waitForTokenTravelAnimation(token);
        if(this.travelSession!==session)return false;
        session.currentChunk=null;
        if(!completed){
          interruptedReason="Foundry stopped or blocked the current travel stretch.";
          reachedEnd=false;break;
        }
        const target=chunk.waypoints.at(-1);
        if(Math.hypot(token.x-target.x,token.y-target.y)>
            Math.max(1,session.gridSize/20)){
          interruptedReason="The token left the planned road path. Recalculate before traveling again.";
          reachedEnd=false;break;
        }
        // Credit progress only after Foundry confirms the expected destination.
        // An interrupted/redirected movement must never receive World time.
        session.completedDistance+=chunk.distance;
        atlasDebug("movement","Native movement confirmed",{
          sceneId:session.sceneId,chunk:index+1,
          completedPercent:Math.round(100*session.completedDistance/totalDistance)
        },{level:"verbose"});
        schedule.recordMovement(chunk.distance/totalDistance*playback.travelHours);
        session.confirmedSegments++;
        this.setTravelProgress(Math.min(99,100*session.completedDistance/totalDistance));
        try{await this.commitGuidedWorldTime(session);}
        catch(error){
          reachedEnd=false;clockFailed=true;
          interruptedReason="World time could not advance: "+(error.message||String(error));
          break;
        }
        if(this.travelSession!==session)return false;
        if(session.confirmedSegments%5===0){
          try{await this.saveJourneyCheckpoint(session,"moving");}
          catch(error){
            reachedEnd=false;
            interruptedReason="The Journey Journal could not save confirmed progress: "+
              (error.message||String(error));
            break;
          }
        }
      }
      if(this.travelSession===session){
        if(!clockFailed){
          try{await this.commitGuidedWorldTime(session,{force:true});}
          catch(error){
            clockFailed=true;
            interruptedReason="World time could not advance: "+(error.message||String(error));
          }
        }
        const arrived=reachedEnd&&session.phase!=="ending"&&!clockFailed;
        if(arrived){
          // The 100ms animation sampler clamps to 99% until arrival. Stop it
          // first so it cannot overwrite a confirmed 100% during Journal I/O.
          if(session.timer!==null){clearInterval(session.timer);session.timer=null;}
          this.setTravelProgress(100);
        }
        try{await this.saveJourneyCheckpoint(session,arrived?"completed":
          session.phase==="ending"?"ended":"interrupted");}
        catch(error){
          interruptedReason="The Journey Journal could not finalize: "+
            (error.message||String(error));
          atlasWarn("journey",interruptedReason);
        }
        this.travelNotice=arrived?"Arrived at destination."+
          (schedule.lastForcedCheck?` Resolve the latest forced-march DC `+
            `${schedule.lastForcedCheck.dc} Constitution saves manually.`:""):
          (interruptedReason??"Journey ended at the last completed road stretch.");
        atlasDebug("journey",arrived?"Journey arrived":
          "Journey stopped",{
          sceneId:session.sceneId,reason:arrived?"arrived":
            (interruptedReason??(session.phase==="ending"?"gm-ended":"interrupted")),
          completedPercent:Math.floor(this.travelProgress)
        });
        if(interruptedReason)atlasWarn("journey",interruptedReason);
        return arrived;
      }
      return false;
    }catch(error){
      atlasWarn("journey","Guided travel failed unexpectedly",error);
      atlasDebug("journey","Unexpected journey exception",{
        sceneId:session.sceneId,phase:session.phase,
        confirmedPercent:Math.floor(100*session.completedDistance/totalDistance)
      });
      if(this.travelSession===session){
        this.travelNotice="Journey interrupted: "+(error.message||String(error));
        try{await this.saveJourneyCheckpoint(session,"interrupted");}
        catch(saveError){atlasWarn("journey","Could not record interrupted journey",saveError);}
      }
      throw error;
    }finally{
      if(session.timer!==null)clearInterval(session.timer);
      session.resumeWaiter?.();
      session.restWaiter?.(null);
      if(this.travelSession===session){
        this.travelSession=null;
        if(this.active)void this.render(true);
      }
      session.resolveFinished?.();
    }
  }

  /** Pause at the next short native movement boundary (at most ~2s). */
  pauseGuidedTravel(){
    const session=this.travelSession;
    if(!session||session.phase!=="moving")return false;
    session.phase="pausing";
    atlasDebug("journey","Pause requested",{sceneId:session.sceneId});
    this.travelNotice="Pausing after the current short road stretch…";
    if(this.active)void this.render(true);
    return true;
  }

  resumeGuidedTravel(){
    const session=this.travelSession;
    if(!session||session.phase!=="paused"||!session.resumeWaiter)return false;
    session.phase="moving";
    atlasDebug("journey","Journey resumed",{sceneId:session.sceneId});
    this.travelNotice="Journey resumed.";
    session.resumeWaiter();
    if(this.active)void this.render(true);
    return true;
  }

  stopGuidedTravel({render=true}={}){
    const session=this.travelSession;
    if(!session)return false;
    session.phase="ending";
    atlasDebug("journey","End journey requested",{sceneId:session.sceneId});
    session.resumeWaiter?.();
    session.restWaiter?.(null);
    this.travelNotice="Ending journey after the current short road stretch…";
    if(render&&this.active)void this.render(true);
    return true;
  }

  /** Deliberate route reset without any Scene or token mutation. */
  clear(reason="") {
    if(reason)atlasDebug("lifecycle","Navigation route cleared",{
      sceneId:this.scene?.id??null,reason,journeyActive:Boolean(this.travelSession)
    });
    if(this.travelSession)this.stopGuidedTravel({render:false});
    this.start = null;
    this.end = null;
    this.result = null;
    this.itinerary=null;
    this.routeRevision=null;
    this.notice=reason;
    this.travelNotice="";
    this.travelProgress=0;
    this.worldTimeAdvancedSeconds=0;
    this.worldTravelAdvancedSeconds=0;
    this.worldRestAdvancedSeconds=0;
    this.journeySchedule=null;
    this.journeyTimeUI=null;
    this.recoveryJournal=null;
    this.recoveryRecord=null;
    this.recoverableJourney=null;
    this.journeyJournal=null;
    this.draw();
    if (this.active) void this.render(true);
  }

  /** Ignore unrelated Scene updates; revoke stale routes when roads/Grid change. */
  onSceneUpdated(scene,changes={}){
    if(!this.active||scene?.id!==this.scene?.id)return;
    if(changes.grid||changes.width!==undefined||changes.height!==undefined){
      this.clear("Scene Grid or dimensions changed. Select a new route.");return;
    }
    const regionOrderChanged=Object.keys(changes.flags?.["fvtt-atlas-navigation"]??{})
      .some(key=>key.replace(/^\-=/,"")===REGION_ROUTING_ORDER_FLAG);
    if(regionOrderChanged){
      this.clear("Terrain Region priority changed. Select a new route.");return;
    }
    if(this.routeRevision!==null &&
        this.atlasProvider(scene).revision!==this.routeRevision){
      this.clear("The road network changed. Select a new route.");return;
    }
    this.draw();
  }

  /** Native Region changes can alter route estimates without changing roads. */
  onRegionUpdated(region){
    if(region?.parent?.id===this.scene?.id&&(this.start||this.end)){
      this.clear("Terrain Regions changed. Select a new route.");
    }
  }

  stop() {
    if(this.scene)atlasDebug("lifecycle","Navigation stopped",{
      sceneId:this.scene.id,journeyActive:Boolean(this.travelSession)
    });
    if(this.travelSession){
      const session=this.travelSession;
      // A closed navigation window or canvas redraw is an interruption, not
      // an End Journey. Preserve the last confirmed position in its Journal.
      void this.saveJourneyCheckpoint(session,"interrupted").catch(error=>
        atlasWarn("journey","Journey interrupted but its Journal could not update",error));
      this.stopGuidedTravel({render:false});
    }
    this.travelSession=null;
    this.pointerTarget?.removeEventListener?.("pointerdown",this.pointerDown,true);
    this.pointerTarget = null;
    this.overlay?.parent?.removeChild?.(this.overlay);
    this.overlay?.destroy?.();
    this.overlay = null;
    this.scene = null;
    this.sourceMode = "map";
    this.start = null;
    this.end = null;
    this.result = null;
    this.itinerary=null;
    this.routeRevision=null;
    this.notice="";
    this.travelNotice="";
    this.travelProgress=0;
    this.travelProgressUI=null;
    this.worldTimeAdvancedSeconds=0;
    this.worldTravelAdvancedSeconds=0;
    this.worldRestAdvancedSeconds=0;
    this.worldTimeUI=null;
    this.journeySchedule=null;
    this.journeyTimeUI=null;
    this.recoverableJourney=null;
    this.recoveryJournal=null;
    this.recoveryRecord=null;
    this.journeyJournal=null;
    this.journalStarting=false;
  }

  tearDown(reason="requested") {
    const session=this.travelSession;
    atlasDebug("lifecycle","Navigation teardown",{
      reason,sceneId:this.scene?.id??null,journeyActive:Boolean(session),
      completedPercent:Math.floor(this.travelProgress),phase:session?.phase??null
    });
    if(reason==="canvasTearDown"&&["moving","rest-applying"].includes(session?.phase)&&
        session.journal?.id&&session.journeyRecord){
      const attempts=(this.autoResumeAttempts.get(session.journal.id)??0)+1;
      this.autoResumeAttempts.set(session.journal.id,attempts);
      if(attempts<=6){
        this.autoResumePending={sceneId:session.sceneId,tokenId:session.token.id,
          journalId:session.journal.id,revision:session.journeyRecord.atlasRevision,
          requiresRestCheckpoint:session.phase==="rest-applying",session};
      }else{
        this.autoResumePending=null;
        atlasWarn("journey","Automatic continuation stopped after repeated canvas rebuilds",{
          sceneId:session.sceneId,journalId:session.journal.id,attempts});
      }
    }
    if(session&&["canvasTearDown","canvasReady"].includes(reason)){
      const message=this.autoResumePending?
        "Atlas journey interrupted by a Foundry canvas redraw. Atlas will try to continue safely.":
        "Atlas journey interrupted by a Foundry canvas redraw. Reopen Navigation to recover it.";
      atlasWarn("lifecycle",message,{reason,sceneId:session.sceneId});
      globalThis.ui?.notifications?.warn?.(message);
    }
    this.stop();
    if (this.rendered) {
      this.closedByController = true;
      this.canvasTeardownClose=Promise.resolve(this.close()).catch(error=>
        atlasWarn("lifecycle","Navigation window could not close during canvas teardown",error));
    }
  }

  /** A native canvas replacement can interrupt an already-approved journey.
   * Continue only after its old movement/clock/Journal writes settle, using the
   * validated Journal and the live token. Manual pause and End never opt in. */
  async autoResumeAfterCanvasReady(){
    const pending=this.autoResumePending;
    if(!pending)return false;
    const view=this.canvasProvider();
    if(!game.user?.isGM||!view?.ready||view.scene?.id!==pending.sceneId){
      this.autoResumePending=null;return false;
    }
    let timeout;
    const settled=await Promise.race([
      Promise.all([pending.session.finished??Promise.resolve(),
        pending.session.journalQueue??Promise.resolve(),
        this.canvasTeardownClose]).then(()=>true,()=>false),
      new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),8000);})
    ]).finally(()=>clearTimeout(timeout));
    if(!settled||this.autoResumePending!==pending||this.active){
      if(this.autoResumePending===pending)this.autoResumePending=null;
      atlasWarn("journey","Automatic continuation skipped; recover the saved Journal manually",{
        sceneId:pending.sceneId,journalId:pending.journalId});
      return false;
    }
    if(pending.requiresRestCheckpoint&&!pending.session.restCheckpointed){
      this.autoResumePending=null;
      atlasWarn("journey","Automatic continuation withheld: rest/time checkpoint was not committed",{
        sceneId:pending.sceneId,journalId:pending.journalId});
      return false;
    }
    try{
      if(game.users?.activeGM?.id!==game.user.id)
        throw Error("Automatic continuation requires the active GM.");
      if(this.atlasProvider(view.scene).revision!==pending.revision)
        throw Error("The road network changed.");
      const token=this.partyTokenProvider(view.scene);
      if(token?.id!==pending.tokenId)
        throw Error("The assigned party token changed.");
      this.activate();
      if(this.recoverableJourney?.id!==pending.journalId)
        throw Error("The saved journey is no longer eligible for recovery.");
      this.recoverSavedJourney();
      this.autoResumePending=null;
      atlasDebug("journey","Automatically continuing after canvas rebuild",{
        sceneId:pending.sceneId,journalId:pending.journalId});
      void this.startGuidedTravel().catch(error=>{
        atlasWarn("journey","Automatic continuation failed; the Journal remains recoverable",error);
        globalThis.ui?.notifications?.warn?.(
          "Atlas could not continue automatically. Open Navigation to recover the journey.");
      });
      return true;
    }catch(error){
      this.autoResumePending=null;
      atlasWarn("journey","Automatic continuation unavailable; recover manually",error);
      globalThis.ui?.notifications?.warn?.(
        "Atlas paused after a canvas rebuild. Open Navigation to recover the journey.");
      return false;
    }
  }

  /** One canonical speed source for the live summary and itinerary snapshot. */
  resolveTravel(){
    const sceneUnit=this.scene?.grid?.units?.trim()||"Scene units";
    const configured=Number(game.settings.get("fvtt-atlas-navigation",NAVIGATION_SPEED_SETTING)
      ?? DEFAULT_NAVIGATION_SPEED);
    const assignment=this.scene?readPartyExploration(this.scene):null;
    const assignedToken=assignment?.enabled?this.scene?.tokens?.get?.(assignment.tokenId):null;
    let travel;
    try{
      travel=resolveNavigationTravelSpeed({token:assignedToken,sceneUnits:sceneUnit,
        systemId:game.system?.id,worldSpeed:configured});
    }catch{
      travel=resolveNavigationTravelSpeed({token:null,sceneUnits:sceneUnit,
        systemId:null,worldSpeed:DEFAULT_NAVIGATION_SPEED});
    }
    return {sceneUnit,travel};
  }

  async _renderHTML() {
    const root=el("section");
    root.style.cssText="display:flex;flex-direction:column;height:100%;max-height:100%;min-height:0;overflow:hidden;";
    const body=el("div");
    body.style.cssText="display:flex;flex-direction:column;gap:.85rem;padding:1rem;flex:1;min-height:0;overflow-y:auto;";
    const partyMode=this.sourceMode==="party";
    const status=!this.start ? (this.notice||(partyMode?
      "Party token location unavailable. Refresh its location before choosing B.":
      "Click the map to select Point A.")) :
      !this.end ? (partyMode?"Party token is Point A. Click the map to select Point B.":
        "Point A selected. Click the map to select Point B.") :
      this.result?.status==="ok" ? (partyMode?
        "Route calculated from party token. Alt/Option+click to change B.":
        "Route calculated. Shift+click changes A; Alt/Option+click changes B.") :
      (this.result?.reason ?? "No connected road route available.");
    const departure=el("div");
    departure.style.cssText="display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;";
    const departureLabel=el("label","Start from");
    departureLabel.htmlFor="atlas-navigation-departure";
    const departureSelect=el("select");
    departureSelect.id="atlas-navigation-departure";
    departureSelect.title="Choose the route departure source";
    departureSelect.disabled=Boolean(this.travelSession);
    departureSelect.style.cssText="flex:1;min-width:12rem;";
    for(const [value,label] of [["map","Map Point A"],["party","Party token location"]]){
      const option=el("option",label);option.value=value;departureSelect.appendChild(option);
    }
    departureSelect.value=this.sourceMode;
    departureSelect.addEventListener("change",()=>this.setSourceMode(departureSelect.value));
    departure.append(departureLabel,departureSelect);
    if(partyMode){
      const refresh=el("button","Refresh location");
      refresh.type="button";refresh.title="Recalculate from the party token's current location";
      refresh.disabled=Boolean(this.travelSession);
      refresh.addEventListener("click",()=>this.refreshPartyDeparture());
      departure.appendChild(refresh);
    }
    body.appendChild(departure);
    const statusLabel=el("p",status);
    statusLabel.style.cssText="margin:0;font-weight:600;flex:1;min-width:0;";
    const statusRow=el("div");
    statusRow.style.cssText="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;";
    statusRow.append(statusLabel);
    body.appendChild(statusRow);
    if(this.travelNotice){
      const message=el("p",this.travelNotice);
      message.style.cssText="margin:0;font-size:.85em;opacity:.85;";
      body.appendChild(message);
    }
    if(this.recoverableJourney&&!this.travelSession&&!this.recoveryRecord){
      const recovery=el("div");
      recovery.style.cssText="border:1px solid #b18b54;border-radius:8px;padding:.75rem;display:flex;flex-wrap:wrap;align-items:center;gap:.7rem;";
      const description=el("span","A saved Atlas journey is available. Recover its destination from the party token's current location.");
      description.style.cssText="flex:1;min-width:12rem;font-size:.85em;";
      const recover=el("button","Recover Saved Journey");
      recover.type="button";
      recover.title="Recalculate the remaining journey from the party token without moving it";
      recover.addEventListener("click",()=>{
        try{this.recoverSavedJourney();}
        catch(error){ui.notifications.warn(error.message||String(error));}
      });
      recovery.append(description,recover);
      body.appendChild(recovery);
    }
    const {sceneUnit,travel}=this.resolveTravel();
    const speed=travel.speed;
    const travelSource=travel.source==="party" ?
      `${travel.actorName} · ${travel.pace} pace · ${speed.toLocaleString(undefined,{maximumFractionDigits:2})} ${sceneUnit}/hour` :
      `Atlas default · ${speed.toLocaleString(undefined,{maximumFractionDigits:2})} ${sceneUnit}/hour`;
    const help=el("p",partyMode?
      "Atlas reads Point A from the assigned party token's Scene location. Click the map for B; Alt/Option+click changes B. Refresh location after moving the token.":
      "After choosing A and B, ordinary map clicks leave the route unchanged. Shift+click sets Point A; Alt/Option+click sets Point B.");
    help.style.cssText="margin:0;font-size:.8em;opacity:.75;line-height:1.35;";
    body.appendChild(help);
    if (this.result?.status === "ok") {
      const unit=this.scene?.grid?.units?.trim() || "units";
      const summary=el("div");
      summary.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem;";
      const metric=(label,value)=>{
        const card=el("div");card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:8px;padding:.75rem;min-width:0;";
        const small=el("div",label);small.style.cssText="font-size:.8em;opacity:.75;margin-bottom:.25rem;";
        const big=el("strong",value);big.style.cssText="font-size:1.15em;";
        card.append(small,big);summary.appendChild(card);
      };
      metric("Distance",`${this.result.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`);
      let tripExplanation=null;
      try{
        const weighted=this.result.terrainAware?this.result.cost:this.result.distance;
        const hours=navigationHours(weighted,speed);
        metric("Travel Time",formatGuidedWorldTime(Math.round(hours*3600)));
        const rules=this.resolveTravelRules(travel);
        const schedule=this.journeySchedule&&Math.abs(this.journeySchedule.travelHours-hours)<1e-5?
          this.journeySchedule:null;
        const plan=schedule?.estimate??estimateNavigationTotalTrip(hours,rules);
        metric("Total Trip",formatNavigationDuration(plan.totalHours,24));
        const explanation=rules.dailyHours===null?
          "Total Trip currently counts movement only; select D&D or Custom rules in Module Settings to plan rests.":
          `Plan: ${rules.dailyHours}h travel/day, ${rules.overnightHours}h overnight downtime `+
          `(including rest); ${plan.overnights} overnight stop${plan.overnights===1?"":"s"} remaining.`+
          (plan.breakHours?` ${formatGuidedWorldTime(Math.round(plan.breakHours*3600))} of confirmed breaks included.`:"")+
          " The GM's rest or forced-travel choices update this estimate.";
        tripExplanation=el("p",explanation);
        tripExplanation.style.cssText="margin:0;font-size:.8em;opacity:.75;";
      }catch(error){metric("Travel Time","Unavailable");metric("Total Trip","Unavailable");}
      body.appendChild(summary);
      if(tripExplanation)body.appendChild(tripExplanation);
      if(this.travelSession||this.travelProgress>0){
        const progressWrap=el("div");
        progressWrap.style.cssText="display:flex;flex-direction:column;gap:.35rem;padding:.45rem 0;";
        const progressHeader=el("div");
        progressHeader.style.cssText="display:flex;justify-content:space-between;gap:1rem;font-size:.85em;";
        const progressTitle=el("strong","Journey progress");
        const progressLabel=el("span",`${Math.floor(this.travelProgress)}% complete`);
        const progressBar=el("progress");
        progressBar.max=100;
        progressBar.value=this.travelProgress;
        progressBar.title="Journey progress";
        progressBar.setAttribute?.("aria-label","Journey progress");
        progressBar.style.cssText="width:100%;height:.75rem;accent-color:#16b9a1;";
        progressHeader.append(progressTitle,progressLabel);
        progressWrap.append(progressHeader,progressBar);
        body.appendChild(progressWrap);
        this.travelProgressUI={bar:progressBar,label:progressLabel};
        const status=el("div");
        status.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;font-size:.78em;";
        const timePart=label=>{
          const section=el("div");
          const heading=el("div",label);heading.style.cssText="opacity:.7;margin-bottom:.15rem;";
          const value=el("strong","—");
          section.append(heading,value);status.appendChild(section);
          return value;
        };
        this.journeyTimeUI={travelHours:navigationHours(
          this.result.terrainAware?this.result.cost:this.result.distance,speed),
          plan:estimateNavigationTotalTrip(navigationHours(
            this.result.terrainAware?this.result.cost:this.result.distance,speed),
            this.resolveTravelRules(travel)),
          moving:timePart("Travelled (moving)"),
          elapsed:timePart("Elapsed (with rests)"),
          eta:timePart("ETA remaining (in-game)")};
        progressWrap.appendChild(status);
        this.updateJourneyTiming();
      }else{this.travelProgressUI=null;this.journeyTimeUI=null;}
      if(this.travelSession?.phase==="rest-choice"){
        const schedule=this.travelSession.schedule,rules=schedule.rules;
        const routeHours=navigationHours(this.result.terrainAware?this.result.cost:
          this.result.distance,speed);
        const routeAverage=this.result.distance/routeHours;
        const upcomingExtra=Math.floor(Math.max(0,schedule.todayHours-rules.dailyHours)+1e-6)+1;
        const options=[
          `Overnight Camp: +${rules.overnightHours}h downtime; resets travel allowance to ${rules.dailyHours}h.`,
          `Long Rest: +${rules.longRestHours}h downtime; resets travel allowance to ${rules.dailyHours}h.`,
          `Short Rest: +${rules.shortRestHours}h downtime; does not restore daily travel hours.`,
          `Continue March: +1h moving (roughly ${routeAverage.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit} on this route).`+
            (rules.forcedMarch!=="custom"?` DC ${10+upcomingExtra} Constitution save afterward (GM adjudicates).`:"")
        ];
        const prompt=el("div");
        prompt.style.cssText="padding:.8rem;border:1px solid #d99c46;border-radius:8px;font-size:.85em;display:grid;gap:.3rem;";
        prompt.appendChild(el("strong","Daily travel limit reached — choose how to proceed:"));
        for(const option of options)prompt.appendChild(el("div",option));
        body.appendChild(prompt);
      }
      const clockAllowed=readNavigationWorldClockSetting(game.settings);
      const clockHint=el("p",clockAllowed?
        "Foundry World time advances for confirmed movement and GM-approved breaks. Actor rests and exhaustion remain manual; change the clock setting in Module Settings.":
        "Foundry World time stays unchanged. Planned breaks are still counted in Total Trip; enable clock advancement in Atlas Module Settings.");
      clockHint.style.cssText="margin:0;font-size:.77em;opacity:.7;";
      body.appendChild(clockHint);
      if(this.travelSession?.clock||this.worldTimeAdvancedSeconds>0){
        const clockStatus=el("p",this.worldTimeStatus());
        clockStatus.style.cssText="margin:0;font-size:.85em;font-weight:600;";
        this.worldTimeUI=clockStatus;
        body.appendChild(clockStatus);
      }else this.worldTimeUI=null;
      const sourceLabel=el("p",`Speed: ${travelSource}`);
      sourceLabel.style.cssText="margin:0;font-size:.85em;opacity:.85;";
      body.appendChild(sourceLabel);
      try{
        const playback=calculateGuidedPlayback({route:this.result,travel,
          paths:navigationCanvasLegPaths(this.canvasProvider(),this.atlasProvider(this.scene),this.result),
          gridSize:this.scene?.grid?.size,
          secondsPerHour:readGuidedPlaybackSetting(game.settings)});
        const animationLabel=el("p",`Token playback: about ${formatPlaybackDuration(playback.durationSeconds)} `+
          `(${playback.secondsPerHour} real seconds per in-game travel hour). `+
          "Playback speed is visual only and does not change travel hours.");
        animationLabel.style.cssText="margin:0;font-size:.8em;opacity:.75;";
        body.appendChild(animationLabel);
      }catch{
        // Invalid/missing canvas geometry must not conceal the route summary.
      }
      if (this.result.terrainAware) {
        const cost=el("p",`Terrain-weighted distance: ${this.result.cost.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}-equivalent`);
        cost.style.cssText="margin:0;font-size:.85em;";body.appendChild(cost);
      }
      const details=el("details");
      const summaryText=el("summary","How Atlas calculated this journey");
      summaryText.style.cursor="pointer";
      details.appendChild(summaryText);
      const calculation=el("p",this.result.terrainWarning ||
        (this.result.terrainAware?
          "Terrain-weighted distance applies the applicable Region movement cost first, " +
          "then the road's travel preset where no Region applies. " +
          "Overlapping Regions follow GM priority; short checkpoint Regions are included. " +
          "Travel time is an estimate and never changes native Token movement.":
          "No compatible terrain cost was available, so travel time uses physical distance."));
      calculation.style.cssText="font-size:.85em;opacity:.85;line-height:1.4;margin:.4rem 0;";
      details.appendChild(calculation);
      body.appendChild(details);
      const heading=el("h3","Directions");heading.style.cssText="margin:.2rem 0 0;";body.appendChild(heading);
      const list=el("div");list.style.cssText="display:flex;flex-direction:column;gap:.4rem;";
      const endpoint=(atStart)=>{
        const item=el("div");
        item.style.cssText="display:flex;align-items:center;gap:.8rem;padding:.8rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:8px;";
        const marker=el("span",atStart?"●":"◆");
        marker.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;font-weight:bold;color:white;background:"+
          (atStart?"#16a765":"#d83c49")+";";
        const body=el("div");
        const name=el("strong",atStart?"Depart from starting point":"Arrive at destination");
        const detail=el("div",atStart?"Starting location":"Final destination");
        detail.style.cssText="opacity:.7;font-size:.8em;margin-top:.2rem;";
        body.append(name,detail);item.append(marker,body);
        return item;
      };
      list.appendChild(endpoint(true));
      const baseSteps=this.itinerary?.directions??buildNavigationSteps(this.result.legs,
        id=>this.atlasProvider(this.scene).roads.find(road=>road.id===id)?.name??"Road");
      const steps=this.journeySchedule?.events?.length?
        annotateJourneyDirections(baseSteps,this.journeySchedule.events,{
          travelHours:navigationHours(this.result.terrainAware?this.result.cost:
            this.result.distance,speed),speed,
          terrainAware:Boolean(this.result.terrainAware)}):baseSteps;
      for (const step of steps) {
        if(step.kind==="journey-event"){
          const item=el("div");
          item.style.cssText="display:flex;align-items:center;gap:.8rem;padding:.8rem;border:1px solid #b18b54;border-radius:8px;background:rgba(177,139,84,.08);";
          const badge=el("span",step.action==="continue"?"➜":"☕");
          badge.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;background:#5c482c;";
          const content=el("div");
          const name=el("strong",step.label);
          const timeContext=`After ${formatNavigationDuration(step.atHours,24)} on this leg`+
            (step.todayHours!==null?
              ` · ${formatNavigationDuration(step.todayHours,24)} traveled today`:"");
          const detail=el("div",step.hours?
            `${formatNavigationDuration(step.hours,24)} downtime · ${timeContext}`:
            `One extra travel hour approved · ${timeContext}`);
          detail.style.cssText="opacity:.75;font-size:.85em;margin-top:.2rem;";
          content.append(name,detail);item.append(badge,content);list.appendChild(item);
          continue;
        }
        const item=el("div");item.style.cssText="display:flex;align-items:flex-start;gap:.8rem;padding:.8rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:8px;";
        const marker=el("span",NAVIGATION_ARROWS[step.direction]??"•");
        marker.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;background:var(--color-cool-4,#333);font-weight:bold;";
        marker.title=step.direction||"Route";
        const text=el("div");text.style.minWidth="0";
        const instruction=el("strong",step.instruction);instruction.style.display="block";
        const info=el("div",`${step.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit} · `+
          `${formatGuidedWorldTime(Math.round(navigationHours(this.result.terrainAware?step.cost:step.distance,speed)*3600))}`);
        info.style.cssText="opacity:.75;font-size:.85em;margin-top:.3rem;";
        const surface=el("div",[step.terrain === "Unspecified terrain" ? null : step.terrain,
          step.regionName && step.regionName!==step.terrain?step.regionName:null]
          .filter(Boolean).join(" · "));
        surface.style.cssText="opacity:.55;font-size:.72em;margin-top:.18rem;";
        text.append(instruction,info);
        if(surface.textContent)text.appendChild(surface);
        item.append(marker,text);list.appendChild(item);
      }
      list.appendChild(endpoint(false));
      body.appendChild(list);
    } else {
      const hint=el("p",`Travel estimates will use ${travelSource}.`);
      hint.style.cssText="margin:0;opacity:.8;font-size:.9em;";body.appendChild(hint);
    }
    const row=el("div");
    row.style.cssText="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;padding:.65rem 1rem;border-top:1px solid var(--color-border-light-tertiary,#555);background:var(--color-bg,#100e18);flex:none;";
    const newRoute=el("button","New Route");
    newRoute.type="button";
    newRoute.disabled=Boolean(this.travelSession||this.journalStarting);
    newRoute.title=partyMode?"Choose a new destination from the party token":"Clear route and choose a new Point A";
    newRoute.addEventListener("click",()=>{
      this.clear();
      if(partyMode)this.refreshPartyDeparture();
    });
    row.appendChild(newRoute);
    if(this.journeyJournal){
      const open=el("button","Open Journey Journal");
      open.type="button";
      open.title="Open the saved journey log and recovery record";
      open.addEventListener("click",()=>void this.journeyJournal.sheet?.render(true));
      row.appendChild(open);
    }
    if(this.result?.status==="ok"){
      const phase=this.travelSession?.phase;
      if(phase==="rest-choice"){
        const rules=this.travelSession.schedule.rules;
        for(const [action,label,title] of [
          ["overnight",`Overnight Camp (${rules.overnightHours}h)`,"Camp overnight and reset the daily travel allowance"],
          ["long",`Long Rest (${rules.longRestHours}h)`,"Record a long rest; Actor resources remain unchanged"],
          ["short",`Short Rest (${rules.shortRestHours}h)`,"Add a short rest without resetting daily travel hours"],
          ["continue","Continue March","Continue one more travel hour; adjudicate any Constitution saves manually"]]){
          const button=el("button",label);
          button.type="button";button.title=title;
          button.disabled=action==="continue"&&this.travelSession.schedule.todayHours>=24-1e-7;
          button.addEventListener("click",()=>this.chooseDailyTravelBreak(action));
          row.appendChild(button);
        }
      }else{
        const move=el("button",phase==="paused"?"Resume Travel":phase==="moving"?
          "Pause Travel":phase==="pausing"?"Pausing…":phase==="ending"?"Ending Journey…":
          phase==="rest-applying"?"Recording Break…":"Travel Route");
        move.type="button";
        move.disabled=this.journalStarting||phase==="ending"||
          phase==="pausing"||phase==="rest-applying";
        move.title=phase==="paused"?"Resume the paused journey":phase==="moving"?
          "Pause after the current short road stretch":"Move the assigned party token along this route";
        move.addEventListener("click",()=>{
          if(this.travelSession){
            const ok=this.travelSession.phase==="paused"?this.resumeGuidedTravel():
              this.pauseGuidedTravel();
            if(!ok)ui.notifications.warn("The token could not change its movement state yet.");
            return;
          }
          void this.startGuidedTravel().catch(error=>{
            this.travelNotice=error.message||String(error);
            ui.notifications.error(this.travelNotice);
            if(this.active)void this.render(true);
          });
        });
        row.appendChild(move);
      }
      if(this.travelSession){
        const end=el("button","End Journey");
        end.type="button";
        end.disabled=this.travelSession.phase==="ending";
        end.title="Stop this journey permanently at the token's current position";
        end.addEventListener("click",()=>{
          if(!this.stopGuidedTravel())ui.notifications.warn("The journey could not be ended.");
        });
        row.appendChild(end);
      }
    }
    const filler=el("span");filler.style.flex="1";row.appendChild(filler);
    const close=el("button","Exit Navigation");
    close.type="button";
    close.addEventListener("click",()=>void this.close());
    row.appendChild(close);
    root.append(body,row);
    return root;
  }

  _replaceHTML(result,content) { content.replaceChildren(result); }

  _onClose(options) {
    if(this.travelSession)atlasDebug("lifecycle","Navigation window closed during journey",{
      sceneId:this.scene?.id??null,phase:this.travelSession.phase
    });
    super._onClose?.(options);
    this.stop();
    this.closedByController = false;
  }
}
