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
import {planNativeCheckpointPath,anchorNativeTokenWaypoints,
  describeNativeCheckpointSources,NATIVE_CONTINUOUS_CHECKPOINT_SECONDS}
  from "./navigation-native-movement-plan.js";
import {coordinateNativeTokenMovement}
  from "./navigation-native-movement-coordinator.js";
import {validatePendingNativeMove}
  from "./navigation-native-movement-reconciliation.js";
import { GuidedTravelDayTracker,estimateNavigationTotalTrip,
  splitGuidedChunkAtDistance,MAX_GUIDED_REST_EVENTS,MAX_GUIDED_TRAVEL_EVENTS }
  from "./navigation-travel-day.js";
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
import { buildNavigationSteps } from "./navigation-instructions.js";
import { navigationPointIntent } from "./navigation-selection.js";
import { createNavigationItinerary } from "./navigation-itinerary.js";
import { REGION_ROUTING_ORDER_FLAG } from "./navigation-terrain.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import { resolveNavigationTravelSpeed,convertGroupSpeed } from "./navigation-party-speed.js";
import { availableNavigationTravelMethods,resolveNavigationMethodTravel,
  assessNavigationMethodRoute } from "./navigation-travel-method.js";
import { projectTransportationRouteLegs,transportationLegSelection,
  describeTransportationLeg } from "./navigation-transport-transitions.js";
import {prepareGuidedTransportLeg,confirmGuidedCheckpointArrival}
  from "./navigation-guided-transport-leg.js";
import {isJourneyDestinationCheckpoint,isRepeatedArrivalCheckpoint}
  from "./navigation-checkpoint-terminal.js";
import {restoreApprovedTransportPlan,hasUnfinishedApprovedTransport,
  approvedTransportRecoverySelection}
  from "./navigation-transport-recovery.js";
import {requestPassengerRest,confirmPassengerRest,beginPassengerRestMetadata,
  recoverPassengerRestRequest,confirmedJourneyMovingHours,isRestUnderway}
  from "./navigation-passenger-rest.js";
import { atlasDisplayDistance,atlasDisplaySpeed,atlasFormatMeasure }
  from "./navigation-measure-units.js";
import { readGroupTransportation,projectGroupTransportation,
  groupMethodCapacityStatus,groupMethodFareEstimate }
  from "./navigation-group-transport.js";
import { dndCurrencyBreakdown } from "./navigation-currency.js";
import { resolveTransportationOperation,quoteTransportationService }
  from "./navigation-transport-service.js";
import { openAtlasGroupTransportation } from "./navigation-group-transport-settings.js";
import { offersAtOrigin,checkpointOffers,saveCheckpointOffers,
  checkpointOfferMethod,transportationMethodOverrideDelta }
  from "./checkpoint-transportation.js";
import { TRAVEL_PRESET_SETTING,validateTravelPresets } from "./travel-preset-model.js";
import { atlasDebug,atlasWarn } from "./atlas-debug.js";
import { navigationJourneyTitle,journeyWorldStamp } from "./navigation-journey-title.js";
import { createJourneyRecord,checkpointJourneyRecord,resumeJourneyRecord,
  validateJourneyRecord,eligibleJourneyRecord,isUnfinishedJourneyLeg,
  journeyRecoveryRouteDestination,findRecoverableJourney,saveJourneyJournal,
  JOURNEY_JOURNAL_FLAG } from "./navigation-journey-journal.js";
import {buildJourneyTargets,assessJourneyAnchor,captureJourneyAnchor,
  nextJourneyTarget,isCheckpointBoundContinuation} from "./navigation-route-targets.js";
import {renderNavigationFooter} from "./navigation-footer.js";
import {NAVIGATION_STAGES,resolveNavigationStage} from "./navigation-stage-model.js";
import {createNavigationStageShell,renderNavigationStageIntro,
  renderNavigationCompletedOverview} from "./navigation-stage-view.js";
import {renderNavigationDepartureSelector,renderNavigationTravelMethodSelector}
  from "./navigation-selection-view.js";
import {renderRecoveredVoyageOperation,renderCurrentTransferMethodSelector}
  from "./navigation-transfer-controls-view.js";
import {renderTransportAdvisory,renderTransportCapacity,renderTransportQuote}
  from "./navigation-transport-summary-view.js";
import {renderNavigationSummaryMetrics,renderNavigationSummaryStatus}
  from "./navigation-summary.js";
import {renderNavigationDirections} from "./navigation-directions-view.js";
import {renderJourneyTargets} from "./navigation-targets-view.js";
import {renderRepeatedCheckpointNotice,renderCheckpointArrivalPrompt,
  renderDailyTravelPrompt} from "./navigation-prompts-view.js";
import {createNavigationTransferSection,createNavigationTransferLegCard,
  renderNavigationTransferRoadNames,renderNavigationTransferLegOutcome,
  renderNavigationLaterLegsPreview} from "./navigation-transfer-preview-view.js";

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
    this.travelMethod = "walking";
    this.transportArrangement="owned";
    this.transportOperation="normal";
    this.transportHireTerms=null;
    this.transportHireDenomination=null;
    this.transportJourneyOverrides=null;
    this.transferSelections={};
    this.transferLegOverrides={};
    this.pendingTransfer=null;
    this.start = null;
    this.end = null;
    this.result = null;
    this.itinerary=null;
    this.routeRevision=null;
    this.notice="";
    this.travelSession=null;
    this.travelNotice="";
    this.travelProgress=0;
    // Ephemeral control state: only a durably completed Journey locks its
    // finished route. A deliberate new route calculation releases the lock.
    this.completedRoute=false;
    this.completedRecord=null;
    this.travelProgressUI=null;
    this.journeyTimeUI=null;
    this.worldTimeAdvancedSeconds=0;
    this.worldTravelAdvancedSeconds=0;
    this.worldRestAdvancedSeconds=0;
    this.worldTimeUI=null;
    this.journeySchedule=null;
    this.pointerTarget = null;
    this.overlay = null;
    this.routePulseTicker=null;
    this.routePulseOwner=null;
    this.pointerDown = this.onPointerDown.bind(this);
    this.closedByController = false;
    this.recoverableJourney=null;
    this.recoveryJournal=null;
    this.recoveryRecord=null;
    this.recoveryOperationOverride=null;
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
    this.travelMethod="walking";
    this.transportArrangement="owned";
    this.transportOperation="normal";
    this.transportHireTerms=null;
    this.transportHireDenomination=null;
    this.transportJourneyOverrides=null;
    this.transferSelections={};
    this.transferLegOverrides={};
    this.pendingTransfer=null;
    // Favor the manually assigned Atlas party explorer when it can actually
    // provide a valid Scene-to-Atlas origin. Otherwise retain map-point mode.
    try{
      if(this.getPartyToken()){
        this.syncPartyDeparture(view,this.atlasProvider(this.scene));
        this.sourceMode="party";
      }
    }catch{this.sourceMode="map";this.start=null;}
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
    this.transferSelections={};
    this.transferLegOverrides={};
    this.result=null;
    this.itinerary=null;
    this.travelProgress=0;
    this.completedRoute=false;
    this.completedRecord=null;
    this.worldTimeAdvancedSeconds=0;
    this.worldTravelAdvancedSeconds=0;
    this.worldRestAdvancedSeconds=0;
    this.journeySchedule=null;
    this.journeyTimeUI=null;
    if(!this.start||!this.end)return;
    try{
      // Transport speeds are independent of native Walk/Swim terrain-action
      // costs. Until transport costs exist, estimate physical distance only.
      this.result=this.routeCalculator(view,this.scene,atlas,this.start,this.end,
        this.travelMethod==="walking"?{}:{terrainAware:false});
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

  /** Only owned Group resources or explicit offers at departure appear in Travel by. */
  transportAvailability(){
    const all=availableNavigationTravelMethods(game.settings,game.system?.id);
    const offered=this.scene&&this.start?offersAtOrigin(
      this.atlasProvider(this.scene),this.scene,this.start):[];
    const offers=new Map();
    for(const offer of offered){
      const preset=all.find(method=>method.id===offer.methodId);
      if(!preset||offers.has(offer.methodId))continue;
      try{
        if(checkpointOfferMethod({methodId:offer.methodId,mode:offer.mode,
          overrides:offer.overrides},preset).hireEnabled)offers.set(offer.methodId,offer);
      }catch(error){atlasWarn("navigation","Invalid checkpoint transportation offer",error);}
    }
    const owned=new Set();
    try{
      const group=this.getPartyToken()?.actor;
      if(game.system?.id==="dnd5e"&&group?.type==="group"){
        const roster=projectGroupTransportation(group,
          readGroupTransportation(game.settings),all);
        for(const method of all)if(method.id!=="walking"&&
          groupMethodCapacityStatus(roster,method).matched>0)owned.add(method.id);
      }
    }catch(error){atlasWarn("navigation","Could not list owned transport",error);}
    let compatible=null;
    if(this.result?.status==="ok"){
      try{
        const atlas=this.atlasProvider(this.scene);
        const catalog=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING));
        compatible=new Set(all.filter(method=>
          assessNavigationMethodRoute(method.id,this.result,atlas,catalog.presets,
            {settings:game.settings,systemId:game.system?.id}).compatible)
          .map(method=>method.id));
      }catch(error){
        atlasWarn("navigation","Route transportation surfaces could not be verified",error);
        compatible=new Set(["walking"]);
      }
    }
    const approvedLand=this.recoveryRecord&&isUnfinishedJourneyLeg(this.recoveryRecord)&&
      !this.recoveryRecord.legs.at(-1)?.transport?
      this.recoveryRecord.legs.at(-1)?.travelMethod:null;
    const approvedTransport=hasUnfinishedApprovedTransport(this.recoveryRecord)?
      this.recoveryRecord.legs.at(-1).transport:null;
    const preservingApprovedMethod=method=>Boolean(this.travelMethod===method.id&&
      (approvedLand?.id===method.id||
        approvedTransport?.methodId===method.id&&
        approvedTransport.kind===method.kind&&
        approvedTransport.surface===method.surface));
    const methods=all.filter(method=>
      (method.id==="walking"||owned.has(method.id)||offers.has(method.id)||
        Boolean(this.travelSession&&method.id===this.travelMethod)||
        preservingApprovedMethod(method))&&
      (!compatible||compatible.has(method.id)||
        Boolean(this.travelSession&&method.id===this.travelMethod)||
        preservingApprovedMethod(method)));
    return {methods,all,owned,offers};
  }
  effectiveTransportMethod(method,availability=null){
    const offer=this.transportArrangement==="hire"?
      (availability??this.transportAvailability()).offers.get(method.id):null;
    const baseline=offer?checkpointOfferMethod({methodId:offer.methodId,mode:offer.mode,
      overrides:offer.overrides},method):method;
    return method.id===this.travelMethod&&this.transportJourneyOverrides?
      {...baseline,...this.transportJourneyOverrides}:baseline;
  }

  /**
   * Read-only multi-surface journey plan. Authored road surfaces and checkpoint
   * offers are authoritative; assignments are transient Navigation choices.
   * No implicit purchase, hiring, boarding, Actor write or guided movement.
   */
  transportationTransitionPlan(){
    if(this.result?.status!=="ok"||!this.scene)return null;
    const atlas=this.atlasProvider(this.scene);
    const presets=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING));
    const projected=projectTransportationRouteLegs(this.result,atlas,presets.presets);
    const checkpointContinuation=isCheckpointBoundContinuation({
      record:this.recoveryRecord,route:this.result,projected,
      gridSize:this.scene.grid.size});
    const catalog=availableNavigationTravelMethods(game.settings,game.system?.id);
    const restored=restoreApprovedTransportPlan(this.result,projected,
      this.recoveryRecord,catalog,this.recoveryOperationOverride,{
        atlas,gridSize:this.scene.grid.size,gridDistance:this.scene.grid.distance});
    if(restored)return restored;
    const actor=this.getPartyToken()?.actor;
    let roster=null;
    if(game.system?.id==="dnd5e"&&actor?.type==="group")
      roster=projectGroupTransportation(actor,readGroupTransportation(game.settings),catalog);
    const owned=new Set(catalog.filter(method=>method.id!=="walking"&&roster&&
      groupMethodCapacityStatus(roster,method).matched>0).map(method=>method.id));
    const sceneUnit=this.scene?.grid?.units?.trim()||"";
    const configured=Number(game.settings.get(MODULE_ID,NAVIGATION_SPEED_SETTING)
      ??DEFAULT_NAVIGATION_SPEED);
    let walking;
    try{
      walking=resolveNavigationTravelSpeed({token:this.getPartyToken(),
        sceneUnits:sceneUnit,systemId:game.system?.id,worldSpeed:configured});
    }catch{
      walking=resolveNavigationTravelSpeed({token:null,sceneUnits:sceneUnit,
        systemId:null,worldSpeed:DEFAULT_NAVIGATION_SPEED});
    }
    let totalHours=0,totalElapsedHours=0,totalCp=0,complete=true;
    const legs=projected.legs.map((leg,index)=>{
      const errors=[];
      const offers=offersAtOrigin(atlas,this.scene,leg.start);
      const allSurfaces=leg.surface==="unspecified";
      const options=[...((leg.surface==="land"||allSurfaces)?[{
        value:"owned|walking",label:"Walking (party pace)",group:"Party",
        method:catalog.find(m=>m.id==="walking"),arrangement:"owned"
      }]:[])];
      for(const method of catalog.filter(m=>m.id!=="walking"&&
          (allSurfaces||m.surface===leg.surface))){
        if(owned.has(method.id))options.push({
          value:"owned|"+method.id,label:method.name,group:"Party",
          arrangement:"owned",method,world:method
        });
        const offer=offers.find(item=>item.methodId===method.id);
        if(offer){
          try{
            const offered=checkpointOfferMethod({methodId:offer.methodId,
              mode:offer.mode,overrides:offer.overrides},method);
            if(offered.hireEnabled)options.push({
              value:"hire|"+method.id,label:method.name,
              group:offer.checkpointName||"Nearby checkpoint",
              arrangement:"hire",method:offered,world:method,offer
            });
          }catch(error){atlasWarn("navigation","Invalid transfer checkpoint offer",error);}
        }
      }
      let selected=null;
      try{selected=transportationLegSelection(leg,this.transferSelections[index]);}
      catch(error){errors.push(error.message);}
      const option=selected&&options.find(item=>
        item.value===selected.arrangement+"|"+selected.methodId);
      if(option){
        const local=this.transferLegOverrides[index];
        if(local?.selection===option.value)
          option.method={...option.method,...local.overrides};
      }
      if(index>0&&!projected.legs[index-1].transferValid)
        errors.push("A transfer needs an authored checkpoint or landing at the connecting road node.");
      if(!option)errors.push(leg.surface==="land"?
        "Choose an available method for this route leg.":
        allSurfaces?"Select a method after confirming the unclassified terrain and landing.":
        "Select an available "+leg.surface+" method at the departure checkpoint.");
      const operation=option?.method?.continuousEnabled&&
        ["water","air"].includes(option.method.surface)&&
        option.method.kind==="vehicle"?"continuous":"normal";
      let hours=null,costCp=null;
      if(option){
        let speed=null;
        if(option.method?.id==="walking")speed=walking.speed;
        else if(option.arrangement==="owned"&&roster){
          const capacity=groupMethodCapacityStatus(roster,option.method);
          if(!capacity.sufficient)errors.push("Not enough party-owned seats for this leg.");
          const mph=capacity.effectiveSpeedMph??option.method.speedMph;
          speed=convertGroupSpeed(mph,"mph",sceneUnit);
        }else speed=convertGroupSpeed(option.method.speedMph,"mph",sceneUnit);
        if(!Number.isFinite(speed)||speed<=0)
          errors.push("This method needs compatible Scene distance units and a valid speed.");
        else{
          const weighted=option.method?.id==="walking"?
            leg.weightedDistance:leg.distance;
          hours=navigationHours(weighted,speed);
          if(option.method?.id==="walking")costCp=0;
          else{
            try{
              const distanceMi=convertGroupSpeed(leg.distance,sceneUnit,"mi");
              if(!Number.isFinite(distanceMi))
                throw Error("Transport pricing requires a Scene in miles or kilometers.");
              const ownedQuote=option.arrangement==="owned"&&roster?
                groupMethodFareEstimate(roster,option.method,{
                  hours,distanceMi,dayHours:8}):null;
              const quote=quoteTransportationService(option.method,{
                arrangement:option.arrangement,operation,
                movingHours:hours,distanceMi,travelers:roster?.travelers??1,
                ownedQuote,regularHours:8});
              costCp=quote.totalCp;
            }catch(error){errors.push(error.message??String(error));}
          }
        }
      }
      if(errors.length)complete=false;
      if(!errors.length){
        totalHours+=hours??0;
        const days=hours>0?Math.ceil(Math.max(0,hours-1e-7)/
          (operation==="continuous"?24:8)):0;
        totalElapsedHours+=(hours??0)+(operation==="continuous"?0:
          Math.max(0,days-1)*16);
        totalCp+=costCp??0;
      }
      return {...leg,options,selectedOption:option??null,operation,
        selectedValue:option?.value??"",
        methodName:option?.method?.name??null,
        narration:describeTransportationLeg(leg,option?{
          name:option.method.name,kind:option.method.kind,
          surface:leg.surface,arrangement:option.arrangement
        }:{}),errors,hours,costCp};
    });
    return {...projected,hasTransitions:projected.hasTransitions||checkpointContinuation,
      checkpointContinuation,legs,complete,totalHours:complete?totalHours:null,
      totalElapsedHours:complete?totalElapsedHours:null,
      totalCp:complete?totalCp:null};
  }

  /** Persist a local offer only with an explicit GM save and an unchanged source snapshot. */
  async saveNavigationCheckpointOffer({checkpointId,methodId,world,originalOffers,edited}){
    if(!this.scene||!game.user?.isGM||
        !this.scene.canUserModify?.(game.user,"update"))
      throw Error("Only a GM can update this checkpoint's transportation.");
    const currentWorld=availableNavigationTravelMethods(game.settings,game.system?.id)
      .find(method=>method.id===methodId);
    if(!currentWorld||JSON.stringify(currentWorld)!==JSON.stringify(world))
      throw Error("The World transportation preset changed. Reopen this editor.");
    const currentOffers=checkpointOffers(this.scene,checkpointId);
    if(JSON.stringify(currentOffers)!==JSON.stringify(originalOffers))
      throw Error("Checkpoint offers changed while you edited. Reopen to avoid overwriting them.");
    if(!currentOffers.some(offer=>offer.methodId===methodId))
      throw Error("This transportation offer is no longer assigned to the checkpoint.");
    const updated=currentOffers.map(offer=>offer.methodId===methodId?{
      ...offer,overrides:transportationMethodOverrideDelta(world,edited)
    }:offer);
    await saveCheckpointOffers(this.scene,checkpointId,updated);
    globalThis.ui?.notifications?.info?.("Checkpoint transportation settings saved.");
  }

  /** Reuse the World modal for a selected leg, preserving trip and checkpoint scopes. */
  async editTransportationLeg(index){
    if(!game.user?.isGM||this.travelSession||this.journalStarting)
      throw Error("Journey transportation can only be edited before travel begins.");
    const plan=this.transportationTransitionPlan();
    const leg=plan?.legs[index],option=leg?.selectedOption;
    if(index!==0||!option||option.method?.id==="walking")
      throw Error("Choose an available transportation method on the current leg.");
    const methodId=option.method.id,choice=option.value;
    const world=option.world;
    const origin=option.offer?
      checkpointOfferMethod({methodId,mode:option.offer.mode,
        overrides:option.offer.overrides},world):world;
    const checkpointId=option.offer?.checkpointId;
    const initialOffers=checkpointId?checkpointOffers(this.scene,checkpointId):null;
    const {openTransportationMethodEditor}=await import("./navigation-transport-settings.js");
    await openTransportationMethodEditor({
      method:option.method,scope:"journey",
      checkpointName:option.offer?.checkpointName??null,
      onReset:async()=>{
        delete this.transferLegOverrides[index];
        await this.render(true);
      },
      onSave:async edited=>{
        if(this.transferSelections[index]!==choice)
          throw Error("The transportation choice changed. Reopen its editor.");
        this.transferLegOverrides[index]={selection:choice,
          overrides:transportationMethodOverrideDelta(origin,edited)};
        await this.render(true);
        globalThis.ui?.notifications?.info?.("Transportation saved for this trip only.");
      },
      onSaveCheckpoint:checkpointId?async edited=>{
        if(this.transferSelections[index]!==choice)
          throw Error("The transportation choice changed. Reopen its editor.");
        await this.saveNavigationCheckpointOffer({checkpointId,methodId,world,
          originalOffers:initialOffers,edited});
        delete this.transferLegOverrides[index];
        await this.render(true);
      }:null
    });
  }

  /** One shared preset editor, with changes scoped to the current Journey. */
  async editJourneyTravelMethod(){
    if(!globalThis.game?.user?.isGM||this.travelSession||this.journalStarting)
      throw Error("Journey methods can only be edited before starting travel.");
    const availability=this.transportAvailability();
    const world=availability.methods.find(item=>item.id===this.travelMethod);
    if(!world||world.id==="walking")return;
    const id=this.travelMethod,arrangement=this.transportArrangement;
    const baseline=this.effectiveTransportMethod(world,availability);
    const offer=arrangement==="hire"?availability.offers.get(id):null;
    const original=offer?
      checkpointOfferMethod({methodId:id,mode:offer.mode,
        overrides:offer.overrides},world):world;
    const initialOffers=offer?checkpointOffers(this.scene,offer.checkpointId):null;
    const {openTransportationMethodEditor}=await import("./navigation-transport-settings.js");
    await openTransportationMethodEditor({
      method:baseline,scope:"journey",checkpointName:offer?.checkpointName??null,
      journeyOperation:this.transportOperation,
      onSaveCheckpoint:offer?async (edited,{operation}={})=>{
        if(this.travelMethod!==id||this.transportArrangement!=="hire")
          throw Error("The selected travel method changed. Reopen its settings.");
        await this.saveNavigationCheckpointOffer({
          checkpointId:offer.checkpointId,methodId:id,world,
          originalOffers:initialOffers,edited});
        this.transportJourneyOverrides=null;
        if(operation)this.transportOperation=operation;
        this.transportHireTerms=null;this.transportHireDenomination=null;
        this.calculateRoute(this.canvasProvider(),this.atlasProvider(this.scene));
        this.draw();await this.render(true);
      }:null,
      onReset:async()=>{
        this.transportJourneyOverrides=null;
        this.calculateRoute(this.canvasProvider(),this.atlasProvider(this.scene));
        this.draw();await this.render(true);
      },
      onSave:async (edited,{operation}={})=>{
        if(this.travelMethod!==id||this.transportArrangement!==arrangement)
          throw Error("The selected travel method changed. Reopen its settings.");
        this.transportJourneyOverrides=transportationMethodOverrideDelta(original,edited);
        if(operation)this.transportOperation=operation;
        this.transportHireTerms=null;this.transportHireDenomination=null;
        this.calculateRoute(this.canvasProvider(),this.atlasProvider(this.scene));
        this.draw();await this.render(true);
      }
    });
  }

  /** Method changes recalculate the estimate, never move a token or save data. */
  setTravelMethod(method,arrangement=null){
    if(this.travelSession||this.journalStarting||!this.scene||
      (method===this.travelMethod&&
        (!arrangement||arrangement===this.transportArrangement)))return;
    let methods;
    try{methods=this.transportAvailability().methods;}
    catch(error){ui.notifications.warn(error.message||String(error));return;}
    const selectedMethod=methods.find(item=>item.id===method);
    if(!selectedMethod)return;
    const view=this.canvasProvider();
    if(!game.user?.isGM||!view?.ready||view.scene?.id!==this.scene.id)return;
    try{
      if(method!=="walking")resolveNavigationMethodTravel(method,{speed:1},game.settings,
        this.scene?.grid?.units?.trim()||"");
    }catch(error){ui.notifications.warn(error.message||String(error));return;}
    // Prefer a matching owned Group resource; otherwise use a checkpoint hire.
    let ownsSelected=false;
    try{
      const partyActor=this.getPartyToken()?.actor;
      if(game.system?.id==="dnd5e"&&partyActor?.type==="group"){
        const roster=projectGroupTransportation(partyActor,
          readGroupTransportation(game.settings),methods);
        ownsSelected=groupMethodCapacityStatus(roster,selectedMethod).matched>0;
      }
    }catch(error){atlasWarn("navigation","Could not infer owned transport",error);}
    const offer=this.transportAvailability().offers.get(method);
    const preferred=arrangement==="hire"?"hire":arrangement==="owned"?"owned":
      ownsSelected?"owned":offer?"hire":"owned";
    if(preferred==="hire"&&!offer||preferred==="owned"&&method!=="walking"&&!ownsSelected)return;
    this.travelMethod=method;
    this.transportArrangement=method==="walking"?"owned":preferred;
    this.transportOperation="normal";
    this.transportHireTerms=null;
    this.transportHireDenomination=null;
    this.transportJourneyOverrides=null;
    this.travelNotice="";
    this.calculateRoute(view,this.atlasProvider(this.scene));
    this.draw();
    void this.render(true);
  }

  assessTravelMethod(){
    // A global method cannot silently traverse several road surfaces.
    // Beta.6 validates each transfer independently; beta.7 owns movement.
    if(this.result?.status==="ok"){
      try{
        const atlas=this.atlasProvider(this.scene);
        const presets=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING));
        const projection=Array.isArray(atlas.roads)&&Array.isArray(atlas.nodes)?
          projectTransportationRouteLegs(this.result,atlas,presets.presets):null;
        if(projection&&(projection.hasTransitions||this.travelMethod==="walking"&&
            projection.legs.some(leg=>leg.surface!=="land")))
          return {compatible:false,guided:false,
            reason:"This route crosses different travel surfaces. Use the transportation leg planner below; guided transfers are reserved for beta.7."};
      }catch(error){return {compatible:false,guided:false,
        reason:"Road surface verification failed: "+(error.message??String(error))};}
    }
    if(this.travelMethod==="walking")return {compatible:true,guided:true,reason:null};
    try{
      const atlas=this.atlasProvider(this.scene);
      const presets=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING));
      const result=assessNavigationMethodRoute(this.travelMethod,this.result,atlas,presets.presets,
        {settings:game.settings,systemId:game.system?.id});
      if(!result.guided)return result;
      if(this.sourceMode!=="party")return {...result,guided:false,
        reason:"Guided mount travel requires the assigned party token as Point A."};
      // Hired land journeys still require an authored checkpoint boundary.
      // This hotfix only removes the unnecessary terminal guard for owned mounts.
      if(this.transportArrangement!=="owned")return {...result,guided:false,
        reason:"Hired land services require an approved checkpoint leg for native movement."};
      const availability=this.transportAvailability();
      const permitted=availability.owned.has(this.travelMethod);
      if(!permitted)return {...result,guided:false,
        reason:"The selected transport is no longer owned or available at this departure."};
      const method=availability.methods.find(item=>item.id===this.travelMethod);
      const group=this.getPartyToken()?.actor;
      if(this.transportArrangement==="owned"&&method&&
          game.system?.id==="dnd5e"&&group?.type==="group"){
        const roster=projectGroupTransportation(group,
          readGroupTransportation(game.settings),availability.all);
        if(!groupMethodCapacityStatus(roster,method).sufficient)
          return {...result,guided:false,
            reason:"Not enough matching party-owned passenger seats for this land leg."};
      }
      return result;
    }catch{return {compatible:false,guided:false,
      reason:"Atlas could not verify the road travel surfaces. Check World presets."};}
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
      const spans=kind==="road"?[points]:roadStrokeSpans(points,"dashed",4);
      // A dark halo separates the active route from the underlying road art.
      // The cyan highlight stays legible against land and sea backgrounds.
      drawNavigationLine(graphics,spans,{
        color:0x071a2b,width:kind==="road"?15:12,alpha:0.95
      });
      drawNavigationLine(graphics,spans,{
        color:0x00edff,width:kind==="road"?9:7,alpha:1
      });
    }
    // Alpha-only pulsation does not rebuild or redraw the Foundry canvas.
    // Keep exactly one ticker callback and release it on Navigation teardown.
    if(this.routePulseOwner!==view.app&&this.routePulseTicker){
      this.routePulseOwner?.ticker?.remove?.(this.routePulseTicker);
      this.routePulseTicker=null;this.routePulseOwner=null;
    }
    if(!this.routePulseTicker&&view.app?.ticker?.add){
      const callback=()=>{
        if(this.overlay&&!this.overlay.destroyed)
          this.overlay.alpha=.82+.18*(.5+.5*Math.sin(Date.now()/380));
      };
      view.app.ticker.add(callback);
      this.routePulseTicker=callback;this.routePulseOwner=view.app;
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

  /** A live, explicitly selected Point B wins over legacy checkpoint-only metadata. */
  isAtJourneyDestination(checkpoint=this.pendingTransfer?.checkpoint){
    if(!this.recoveryRecord)return false;
    const destination=this.end&&Number.isFinite(this.end.x)&&Number.isFinite(this.end.y)?
      this.end:this.recoveryRecord.destination;
    return isJourneyDestinationCheckpoint({...this.recoveryRecord,destination},
      checkpoint,this.scene?.grid?.size);
  }

  /** Load a saved destination, but never start a token movement automatically. */
  recoverSavedJourney({automatic=false}={}){
    if(this.travelSession||this.journalStarting||!this.scene)return false;
    // A completed checkpoint is a durable Journey decision. If Continue
    // produced an invalid onward preview, allow the GM to reopen those same
    // choices from its Journal without inventing another movement leg.
    const completedCheckpoint=this.recoveryRecord?.status==="paused"&&
      this.recoveryRecord.legs?.at(-1)?.completedPercent>=99.999;
    const journal=this.recoverableJourney??
      (completedCheckpoint?this.recoveryJournal:null);
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
    if(saved.pendingNativeMove){
      const intent=saved.pendingNativeMove;
      throw Error("The saved Journey stopped during native checkpoint "+
        (intent.checkpointIndex+1)+" (movement "+intent.operationId+"). "+
        "The token may have advanced before the Journal was confirmed. "+
        "Do not replay this leg. Ask the GM to review the native Token movement " +
        "history, World time, and the Journal's last confirmed anchor.");
    }
    this.sourceMode="party";
    this.syncPartyDeparture(view,atlas);
    if(saved.lastConfirmedAnchor){
      const assessment=assessJourneyAnchor({anchor:saved.lastConfirmedAnchor,
        position:this.start,atlas,gridSize:this.scene.grid.size});
      if(!assessment.safe)
        throw Error("The party token differs from its last committed position and " +
          "is not on the recorded road/checkpoint. The Journal is intact; " +
          "ask the GM to resolve the token position before resuming.");
      if(automatic&&assessment.kind!=="coordinate")
        throw Error("Native token movement advanced beyond the last confirmed " +
          "Journey anchor during Canvas teardown. Automatic continuation is " +
          "withheld; the GM must review the saved anchor and Journal.");
      atlasDebug("journey","Native token recovery anchor checked",{
        sceneId:this.scene.id,kind:assessment.kind,
        driftPixels:Math.round(assessment.drift*100)/100
      });
    }
    const recent=saved.legs.at(-1),arrival=recent.transport;
    // Both checkpoint-bound transport and ordinary land travel must restore
    // their approved method BEFORE calculating the remaining road route.
    // A default Walking calculation may choose a different terrain-aware
    // path, which would then fail the original checkpoint safety guard.
    if(isUnfinishedJourneyLeg(saved)){
      const catalog=availableNavigationTravelMethods(game.settings,game.system?.id);
      const approved=approvedTransportRecoverySelection(saved,catalog);
      if(approved){
        this.travelMethod=approved.methodId;
        this.transportArrangement=approved.arrangement;
        this.transportOperation=approved.operation??"normal";
      }else if(recent.travelMethod){
        const selected=catalog.find(method=>method.id===recent.travelMethod.id);
        if(!selected||selected.surface!=="land")
          throw Error("The saved land transportation method is unavailable. Ask the GM to replan.");
        this.travelMethod=selected.id;
        this.transportArrangement=recent.travelMethod.arrangement;
        this.transportOperation=recent.travelMethod.operation;
      }
    }
    if(saved.status==="paused"&&recent.completedPercent>=99.999&&
        arrival?.arrivalCheckpointId){
      const checkpoint=atlas.checkpoints?.find(cp=>
        cp.id===arrival.arrivalCheckpointId);
      const node=atlas.nodes?.find(n=>n.id===checkpoint?.nodeId);
      if(!node||Math.hypot(node.x-this.start.x,node.y-this.start.y)>
          Math.max(.01,this.scene.grid.size*.75))
        throw Error("Move the assigned party token to its confirmed checkpoint before recovery.");
      this.pendingTransfer={sceneId:this.scene.id,atlasRevision:atlas.revision,
        tokenId:token.id,checkpoint:{id:checkpoint.id,name:checkpoint.name,
          point:{x:node.x,y:node.y}},journalId:journal.id};
      this.recoveryJournal=journal;this.recoveryRecord=saved;
      this.journeyJournal=journal;this.recoverableJourney=null;
      // Retain the final Point B across a checkpoint recovery; no replay occurs.
      this.end={...saved.destination};this.result=null;this.itinerary=null;
      this.travelNotice=this.isAtJourneyDestination(this.pendingTransfer.checkpoint)?
        "Reached "+checkpoint.name+". Complete the Journey here, or Continue "+
          "with an onward Point B if this was an intermediate checkpoint.":
        "Recovered at "+checkpoint.name+". Continue toward the saved destination "+
          "or stop and replan.";
      this.draw();void this.render(true);return true;
    }
    // During a partially confirmed checkpoint leg, only reroute to the approved
    // leg endpoint. The Journal's destination is the later, original Point B.
    // Restoring a multi-surface route directly to Point B would discard the
    // approved vessel selection and fail the checkpoint recovery guard.
    this.end=journeyRecoveryRouteDestination(saved);
    this.calculateRoute(view,atlas);
    if(this.result?.status!=="ok")
      throw Error("The remaining journey cannot be routed safely. Review the road network.");
    this.recoveryJournal=journal;
    this.recoveryRecord=saved;
    this.journeyJournal=journal;
    this.travelNotice=isUnfinishedJourneyLeg(saved)&&recent.transport?
      "Saved "+recent.transport.methodName+" voyage loaded toward "+
        recent.transport.arrivalCheckpointName+". Continue this approved leg; "+
        "the original destination and passenger rest are preserved.":
      "Saved journey loaded. Review the remaining route, then select Travel Route. "+
        "Atlas will not replay prior movement or World time.";
    atlasDebug("journey","Saved journey prepared for GM recovery",{
      sceneId:this.scene.id,journalId:journal.id
    });
    this.draw();void this.render(true);
    return true;
  }

  async saveJourneyCheckpoint(session,status,{updatePage=true}={}){
    if(!session?.journal||!session.journeyRecord)return;
    const arrival=status==="completed"?journeyWorldStamp(game.time):null;
    // The cached native Document anchor was sampled ONLY after a completed,
    // verified move. During an in-flight move the Document may be ahead of
    // credited progress, and canvas teardown makes live sampling impossible.
    const confirmedAnchor=session.lastConfirmedAnchor??null;
    const saved=checkpointJourneyRecord(session.journeyRecord,{
      schedule:session.schedule,status,
      progress:Math.max(0,Math.min(100,100*session.completedDistance/session.totalDistance)),
      worldTravelSeconds:session.clock?.advancedSeconds??0,
      worldRestSeconds:session.clock?.restSeconds??0,
      confirmedAnchor,
      arrivedCheckpoint:session.transportLeg&&
        status==="paused"&&session.completedDistance/session.totalDistance>=.99999?
          session.transportLeg.checkpoint:null,
      checkpointTolerancePixels:session.gridSize*.75,
      arrivedWorldTime:arrival?.seconds??null,
      arrivedTimeLabel:arrival?.label??null
    });
    session.journeyRecord=saved;
    // Scene redraws may interrupt an in-flight write. Serialize the final
    // interrupted state after any earlier checkpoint; last committed wins.
    session.journalQueue=(session.journalQueue??Promise.resolve()).catch(()=>{}).then(async()=>{
      await this.journeyJournalStore.save(saved,{journal:session.journal,updatePage});
    });
    await session.journalQueue;
  }

  /** Snapshot an authoritative TokenDocument position at a verified boundary.
   * Call at departure or after native move + animation + endpoint confirmation,
   * never while a chunk is pending or from a rendered Canvas sprite. */
  captureConfirmedJourneyAnchor(session,view,atlas){
    if(!view?.ready||view.scene?.id!==session.sceneId||
        !this.scene||this.scene.id!==session.sceneId)
      throw Error("The Scene changed before Atlas could confirm the native token position.");
    return captureJourneyAnchor({
      point:this.atlasPoint(view,atlas,
        partyTokenCanvasCenter(session.token,session.gridSize)),
      atlas,gridSize:session.gridSize,
      levelId:session.token.level?.id??session.token.level??null,
      elevation:session.token.elevation
    });
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

  async commitGuidedWorldTime(session,{force=false,
    completedDistance=session.completedDistance}={}){
    if(!session.clock)return 0;
    const delta=await session.clock.commit(completedDistance,{force});
    if(delta)atlasDebug("clock","Confirmed travel time advanced",{
      sceneId:session.sceneId,seconds:delta,
      totalMovingSeconds:session.clock.advancedSeconds,force
    },{level:"verbose"});
    if(this.travelSession===session)this.setWorldTimeAdvanced(
      session.clock.advancedSeconds,session.clock.restSeconds);
    return delta;
  }

  /**
   * Continuous transport uses one public v14 native movement, with each
   * checkpoint held until its intent, clock, and confirmed Journal are durable.
   * Land routes with GM rest/forced-march decisions retain their existing loop.
   */
  async runNativeContinuousLeg(session,{plan,playback,atlas,view,guidedLeg}){
    const operationId=foundry.utils.randomID();
    const pixelsPerSecond=playback.movementSpeed*session.gridSize;
    const shouldStop=()=>this.travelSession!==session||session.phase==="ending"||
      this.scene?.id!==session.sceneId||
      this.atlasProvider(this.scene)?.revision!==atlas.revision;
    const prepareCheckpoint=async checkpoint=>{
      if(shouldStop())throw Error("The approved native journey was interrupted.");
      await this.waitForGuidedTravelResume(session);
      if(shouldStop())throw Error("The approved native journey was stopped.");
      const worldTimeBefore=game.time?.worldTime;
      if(!Number.isSafeInteger(worldTimeBefore))
        throw Error("The current Foundry World time is not a safe integer.");
      const clock=session.clock;
      const target=clock?.targetSeconds(checkpoint.completedDistance)??0;
      const outstanding=target-(clock?.advancedSeconds??0);
      const worldAdvanceSeconds=clock&&outstanding>0&&
        (checkpoint.index===plan.checkpoints.length-1||
          outstanding>=clock.minimumStep)?outstanding:0;
      session.journeyRecord.pendingNativeMove=validatePendingNativeMove({
        schemaVersion:1,operationId,tokenId:session.token.id,
        checkpointIndex:checkpoint.index,from:checkpoint.from,to:checkpoint.point,
        nativeDistance:checkpoint.distance,movingHours:
          checkpoint.completedMovingHours-
          (plan.checkpoints[checkpoint.index-1]?.completedMovingHours??0),
        worldTimeBefore,worldAdvanceSeconds,atlasRevision:atlas.revision
      });
      session.currentChunk={distance:checkpoint.distance,startedAt:Date.now(),
        durationMs:1000*checkpoint.distance/pixelsPerSecond};
      // A crash between here and native TokenDocument.update leaves a valid
      // at-start intent. A crash after update leaves an unresolved intent,
      // never falsely credited Journey progress.
      await this.saveJourneyCheckpoint(session,"moving",{updatePage:false});
      atlasDebug("movement","Native checkpoint intent saved",{
        operationId,nativeCheckpointKey:`${operationId}:${checkpoint.index}`,
        atlasCheckpointId:checkpoint.atlasCheckpointId??null,
        roadId:checkpoint.roadId??null,segmentId:checkpoint.segmentId??null,
        nearestRoadId:checkpoint.nearestRoadId??null,
        routeSeparationPixels:checkpoint.routeSeparationPixels??null,
        expectedFrom:checkpoint.from,expectedTo:checkpoint.point
      },{level:"verbose"});
    };
    const confirmCheckpoint=async(checkpoint,movement)=>{
      if(shouldStop())throw Error("Native movement interrupted before confirmation.");
      const pending=session.journeyRecord.pendingNativeMove;
      if(pending?.operationId!==operationId||
          pending.checkpointIndex!==checkpoint.index)
        throw Error("The Journey's pending native checkpoint was replaced.");
      if(game.time.worldTime!==pending.worldTimeBefore)
        throw Error("World time changed while a native checkpoint was pending.");
      if(Math.hypot(session.token.x-checkpoint.point.x,
          session.token.y-checkpoint.point.y)>1)
        throw Error("The native TokenDocument missed its approved checkpoint.");
      const finalCheckpoint=checkpoint.index===plan.checkpoints.length-1;
      if(finalCheckpoint){
        const actual=this.atlasPoint(view,atlas,
          partyTokenCanvasCenter(session.token,session.gridSize));
        if(!confirmGuidedCheckpointArrival({token:session.token,
          gridSize:session.gridSize,atlasPoint:actual,
          expectedPoint:guidedLeg.checkpoint.point}))
          throw Error("The native voyage did not reach the authored arrival checkpoint.");
      }
      // Keep credited progress unchanged while the asynchronous World-clock
      // write runs. A concurrent canvas teardown must not persist uncredited
      // movement as confirmed simply because a TokenDocument advanced first.
      const delta=await this.commitGuidedWorldTime(session,{
        force:finalCheckpoint,
        completedDistance:checkpoint.completedDistance
      });
      if(delta!==pending.worldAdvanceSeconds)
        throw Error("The committed World time differs from the approved checkpoint intent.");
      if(shouldStop())
        throw Error("Canvas or GM interruption during checkpoint confirmation.");
      session.completedDistance=checkpoint.completedDistance;
      session.currentChunk=null;
      session.schedule.recordMovement(checkpoint.distance/plan.totalDistance*
        playback.travelHours);
      session.confirmedSegments++;
      session.lastConfirmedAnchor=this.captureConfirmedJourneyAnchor(session,view,atlas);
      if(session.pendingPassengerRest&&
          confirmPassengerRest(session.schedule,session.pendingPassengerRest)){
        this.travelNotice="Passenger rest completed aboard "+
          guidedLeg.transport.methodName+" while the vessel kept moving.";
        session.pendingPassengerRest=null;
        session.journeyRecord.passengerRest=null;
        if(this.active)void this.render(true);
      }
      // Predictable from the saved intent: no World time is advanced during
      // animation, and an unrelated GM clock change invalidates this step.
      session.journeyRecord.pendingNativeMove=null;
      // The last native checkpoint is already an approved dock arrival.
      // Commit transfer metadata *here* so a canvas redraw before the outer
      // move() promise resolves does not lose the durable C/D decision.
      await this.saveJourneyCheckpoint(session,finalCheckpoint?"paused":"moving",
        {updatePage:finalCheckpoint});
      this.setTravelProgress(Math.min(99,100*session.completedDistance/session.totalDistance));
      atlasDebug("movement","Native checkpoint durably confirmed",{
        operationId,nativeMovementId:movement.id,
        nativeCheckpointKey:`${operationId}:${checkpoint.index}`,
        atlasCheckpointId:checkpoint.atlasCheckpointId??null,
        roadId:checkpoint.roadId??null,segmentId:checkpoint.segmentId??null,
        nearestRoadId:checkpoint.nearestRoadId??null,
        expectedTo:checkpoint.point,
        observedTo:{x:session.token.x,y:session.token.y},
        checkpoint:checkpoint.index+1,checkpointCount:plan.checkpoints.length
      },{level:"verbose"});
    };
    session.nativeAbort=new AbortController();
    session.nativeActive=true;
    try{
      const result=await coordinateNativeTokenMovement({
        token:session.token,plan,operationId,movementSpeed:playback.movementSpeed,
        hooks:Hooks,prepareCheckpoint,confirmCheckpoint,shouldStop,
        signal:session.nativeAbort.signal,
        onCheckpointDiagnostics:({mismatch,details})=>{
          if(!game.user?.isGM)return;
          // Plain-text console exports otherwise collapse nested diagnostic
          // objects into "Object". This bounded, GM-only snapshot contains
          // only native movement identity, route IDs and coordinates.
          if(mismatch)atlasWarn("movement","Native checkpoint reconciliation blocked",
            JSON.stringify(details));
          else atlasDebug("movement","Native checkpoint observed",details,{level:"verbose"});
        }
      });
      return result.completed;
    }finally{
      session.nativeActive=false;session.nativeAbort=null;session.currentChunk=null;
    }
  }

  /** All rule interpretations flow through one pure World settings adapter. */
  resolveTravelRules(travel,approvedMethod=null,approvedOperation=null){
    const rules=resolveNavigationTravelRules({settings:game.settings,
      systemId:game.system?.id,actorHoursPerDay:travel?.hoursPerDay});
    if(!travel?.methodId||travel.methodId==="walking")return rules;
    const preset=approvedMethod??availableNavigationTravelMethods(game.settings,game.system?.id)
      .find(method=>method.id===travel.methodId);
    if(!preset)return rules;
    const normalHours=preset.surface==="land"?
      (rules.dailyHours??8):8;
    let operation=approvedOperation??this.transportOperation??"normal";
    let selected;
    try{selected=resolveTransportationOperation(preset,operation,normalHours);}
    catch{operation="normal";this.transportOperation="normal";
      selected=resolveTransportationOperation(preset,"normal",normalHours);}
    return {...rules,profile:"transport-service",label:"Transport service",
      // Crewed vessels may operate 24h by shifts; passengers choose their own
      // rest times without stopping the ship or triggering forced march.
      dailyHours:operation==="continuous"?null:selected.dailyHours,
      overnightHours:operation==="continuous"?0:selected.overnightHours,
      forcedMarch:"custom"};
  }

  /** A passenger can rest aboard a continuously operating vessel without
   * stopping its native movement or adding duplicate World-clock hours. */
  async choosePassengerRest(action){
    const session=this.travelSession;
    if(!session||session.phase!=="moving"||
        session.transportLeg?.transport?.operation!=="continuous"||
        session.pendingPassengerRest)return false;
    const request=requestPassengerRest(session.schedule,action);
    const previous=session.journeyRecord;
    session.pendingPassengerRest=request;
    session.journeyRecord={...previous,passengerRest:
      beginPassengerRestMetadata(previous,session.schedule,request)};
    this.travelNotice=(action==="long"?"Long":"Short")+" rest underway aboard "+
      session.transportLeg.transport.methodName+". The vessel keeps moving; "+
      "the rest is confirmed only after the required travel time elapses.";
    if(this.active)void this.render(true);
    try{await this.saveJourneyCheckpoint(session,"moving");}
    catch(error){
      // A rest request must be durable before relying on its cooldown.
      // Hold further native stretches if the Journal cannot save it.
      if(this.travelSession===session)session.phase="pausing";
      throw Error("Could not save passenger rest recovery state: "+
        (error.message??String(error)));
    }
    return true;
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

  /** A deliberate GM pause is a safe stop even before the day's travel limit. */
  async choosePausedTravelRest(action){
    const session=this.travelSession;
    if(!session||session.phase!=="paused"||session.pendingPassengerRest||
        !["short","long","overnight"].includes(action))return false;
    const choice=session.schedule.breakChoice(action,{allowEarly:true});
    if(session.schedule.events.length>=MAX_GUIDED_TRAVEL_EVENTS)
      throw Error("The journey has too many travel decisions. Plan a shorter route.");
    session.manualRestApplying=true;
    session.phase="rest-applying";
    this.travelNotice="Recording GM-approved "+action+" rest at the paused position…";
    if(this.active)void this.render(true);
    try{
      await this.commitGuidedTravelBreak(session,choice,()=>
        this.travelSession===session&&session.phase!=="ending"?
          "paused":"interrupted");
      if(this.travelSession!==session||session.phase==="ending")return false;
      session.phase="paused";
      this.travelNotice=(action==="overnight"?"Overnight camp":
        action==="long"?"Long rest":"Short rest")+
        " recorded ("+formatGuidedWorldTime(Math.round(choice.hours*3600))+
        "). The journey remains paused; resume when ready.";
      if(this.active)await this.render(true);
      return true;
    }catch(error){
      // An already approved World-clock update may not be reversible. Never
      // permit further movement or repeat the break if its Journal save fails.
      if(this.travelSession===session&&session.phase==="rest-applying"){
        session.phase="rest-error";
        this.travelNotice="The paused rest could not be fully checkpointed. "+
          "End and inspect the Journey Journal and World time before resuming.";
        if(this.active)void this.render(true);
      }
      throw error;
    }finally{
      session.manualRestApplying=false;
    }
  }

  /** The existing daily-limit and manual-pause paths share one clock/write order. */
  async commitGuidedTravelBreak(session,choice,status){
    await this.commitGuidedWorldTime(session,{force:true});
    const restStart=journeyWorldStamp(game.time);
    if(choice.hours>0){
      if(session.clock)await session.clock.commitBreak(Math.round(choice.hours*3600));
      atlasDebug("clock","GM-confirmed rest recorded",{
        sceneId:session.sceneId,action:choice.action,hours:choice.hours,
        worldTimeAdvanced:Boolean(session.clock)
      });
    }
    const restEnd=journeyWorldStamp(game.time);
    session.schedule.applyBreak(choice,{
      startedWorldTime:restStart.seconds,endedWorldTime:restEnd.seconds,
      startedTimeLabel:restStart.label,endedTimeLabel:restEnd.label});
    if(session.clock)this.setWorldTimeAdvanced(
      session.clock.advancedSeconds,session.clock.restSeconds);
    // Canvas teardown can occur while World time is being written. Resolve
    // the status only after those awaited writes, not at the call site.
    await this.saveJourneyCheckpoint(session,
      typeof status==="function"?status():status);
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
    // A break's start is after confirmed travel time and before downtime.
    await this.commitGuidedTravelBreak(session,choice,()=>session.phase==="ending"?
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
    if(this.completedRoute)
      throw Error("This Journey is completed. Choose New Route before traveling again.");
    if(this.pendingTransfer)
      throw Error("Finish the current checkpoint decision before starting another leg.");
    if(!game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update")||
        !view?.ready||view.scene?.id!==this.scene?.id||this.result?.status!=="ok")
      throw Error("A GM must calculate a route on the active Scene before guided travel.");
    if(!this.result.legs?.some(leg=>leg.kind==="road"))
      throw Error("Guided travel requires a route containing an Atlas road.");
    if(this.travelMethod!=="walking"&&this.sourceMode!=="party")
      throw Error("Guided mounted/sailing journeys require checkpoint transfers from the assigned party token.");
    const token=this.getPartyToken();
    if(!token||typeof token.move!=="function"||
        !token.canUserModify?.(game.user,"update"))
      throw Error("Assign a placed party explorer token with movement permission before travel.");
    const atlas=this.atlasProvider(this.scene);
    if(atlas.revision!==this.routeRevision)
      throw Error("The road network changed. Calculate a fresh route before traveling.");
    const approvedLandMethod=isUnfinishedJourneyLeg(this.recoveryRecord)&&
      !this.recoveryRecord.legs.at(-1)?.transport?
      this.recoveryRecord.legs.at(-1)?.travelMethod:null;
    if(approvedLandMethod&&this.travelMethod!==approvedLandMethod.id)
      throw Error("The saved "+approvedLandMethod.name+
        " journey cannot silently resume using another travel method. Recover or replan with the GM.");
    if(this.sourceMode==="party"&&this.syncPartyDeparture(view,atlas)){
      // A moved token invalidates the old route AND selected checkpoint offer.
      this.calculateRoute(view,atlas);this.draw();void this.render(true);
      throw Error("The party moved since the preview. Select transportation on the refreshed route.");
    }
    let guidedLeg=null,guidedOption=null;
    // Preserve the proven walking lifecycle. Other movement is permitted ONLY
    // to the next authored checkpoint, never across a guessed surface change.
    if(Array.isArray(atlas.roads)&&Array.isArray(atlas.nodes)&&
        atlas.roads.some(road=>road.travelPresetId)&&
        this.result.legs.every(leg=>Array.isArray(leg.points)&&leg.points.length>=2)){
      const presets=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING));
      const projected=projectTransportationRouteLegs(this.result,atlas,presets.presets);
      const resumingTransport=hasUnfinishedApprovedTransport(this.recoveryRecord);
      const checkpointContinuation=isCheckpointBoundContinuation({
        record:this.recoveryRecord,route:this.result,projected,
        gridSize:this.scene.grid.size});
      if(projected.hasTransitions||resumingTransport||checkpointContinuation){
        if(this.sourceMode!=="party")
          throw Error("Checkpoint-assisted movement requires the assigned party token as Point A.");
        const plan=this.transportationTransitionPlan();
        guidedLeg=prepareGuidedTransportLeg(this.result,plan?.legs[0]);
        if(isRepeatedArrivalCheckpoint(this.recoveryRecord,
          plan?.legs[0]?.arrivalCheckpoint))
          throw Error("Already arrived at "+plan.legs[0].arrivalCheckpoint.name+
            ". Atlas will not book another trip to the same checkpoint. "+
            "Choose an onward destination on land, or complete/stop the "+
            "Journey at the checkpoint.");
      }else if(projected.legs.some(leg=>leg.surface!=="land"))
        throw Error("Native guided movement for this water/air-only route needs a supported checkpoint leg.");
    }
    if(!guidedLeg&&this.travelMethod!=="walking"){
      const assessment=this.assessTravelMethod();
      if(!assessment.guided)
        throw Error(assessment.reason??
          "Guided transport needs a compatible land-only route or approved checkpoint leg.");
      const method=this.transportAvailability().methods
        .find(item=>item.id===this.travelMethod);
      if(!method||method.surface!=="land")
        throw Error("The chosen transport is not eligible for this land journey.");
      const approval=await foundry.applications.api.DialogV2.confirm({
        window:{title:"Confirm land travel"},
        content:el("div","GM confirmation: follow the authored land route using "+
          method.name+" ("+(this.transportArrangement==="hire"?"hired":"party-owned")+"). "+
          "The party token will move using Foundry's native movement and optional "+
          "World-time advancement. Costs are estimates; no automatic boarding, "+
          "resource changes or currency deductions occur. Continue?"),
        rejectClose:false,modal:true
      });
      if(!approval)return false;
      if(this.travelSession||this.pendingTransfer||this.scene?.id!==view.scene?.id||
          this.atlasProvider(this.scene).revision!==this.routeRevision||
          this.getPartyToken()?.id!==token.id)
        throw Error("The Scene, token or route changed during confirmation.");
      const current=this.atlasPoint(view,atlas,
        partyTokenCanvasCenter(token,this.scene.grid.size));
      if(Math.hypot(current.x-this.result.start.x,current.y-this.result.start.y)>
          Math.max(.01,this.scene.grid.size/50))
        throw Error("The party token moved during confirmation. Refresh its location.");
      if(!this.assessTravelMethod().guided)
        throw Error("The selected land transportation is no longer eligible.");
    }
    const route=guidedLeg??this.result;
    if(this.recoveryRecord?.routeTargets&&!isUnfinishedJourneyLeg(this.recoveryRecord)){
      const target=nextJourneyTarget(this.recoveryRecord.routeTargets);
      if(!target||Math.hypot(target.point.x-this.end.x,
          target.point.y-this.end.y)>Math.max(.01,this.scene.grid.size*.35))
        throw Error("This route no longer matches the saved next A/B/C target. " +
          "Use Stop and Replan rather than replaying a prior checkpoint.");
      if(guidedLeg?.checkpoint&&target.checkpointId&&
          guidedLeg.checkpoint.id!==target.checkpointId)
        throw Error("The next checkpoint differs from the saved A/B/C target. " +
          "No travel was committed; review the authored roads.");
    }
    let travel=this.resolveTravel().travel;
    if(guidedLeg){
      const option=this.transportationTransitionPlan()?.legs[0]?.selectedOption;
      guidedOption=option;
      const info=guidedLeg.transport;
      const speedDistance=info.methodId==="walking"&&route.terrainAware?
        route.cost:route.distance;
      const hours=this.transportationTransitionPlan()?.legs[0]?.hours;
      if(!Number.isFinite(hours)||hours<=0)throw Error("This leg has no valid operating speed.");
      travel={...travel,methodId:info.methodId,
        speed:speedDistance/hours,source:info.arrangement==="hire"?
          "checkpoint-service":"group-transport",hoursPerDay:8};
      const approval=await foundry.applications.api.DialogV2.confirm({
        window:{title:"Confirm travel to "+guidedLeg.checkpoint.name},
        content:el("div","GM confirmation: travel to "+guidedLeg.checkpoint.name+
          " using "+info.methodName+" ("+info.arrangement+"). "+
          "Native token movement and optional confirmed World-time advancement will occur. "+
          "Estimated fare is for reference only: no booking, currency deduction, "+
          "Actor mutation or forced terrain bypass occurs. Stop at the checkpoint?"),
        rejectClose:false,modal:true
      });
      if(!approval)return false;
      if(this.travelSession||this.pendingTransfer||this.scene?.id!==view.scene?.id||
          this.atlasProvider(this.scene).revision!==this.routeRevision||
          this.getPartyToken()?.id!==token.id)
        throw Error("The Scene, token or route changed during confirmation.");
      const current=this.atlasPoint(view,atlas,partyTokenCanvasCenter(token,this.scene.grid.size));
      if(Math.hypot(current.x-route.start.x,current.y-route.start.y)>Math.max(.01,this.scene.grid.size/50))
        throw Error("The party token moved during confirmation. Refresh its location.");
      const after=this.transportationTransitionPlan()?.legs[0];
      if(!after||JSON.stringify(after.selectedOption?.method)!==JSON.stringify(option?.method)||
          after.selectedValue!==option?.value||after.errors.length)
        throw Error("The selected transportation changed. Review the updated checkpoint offer.");
    }
    const paths=navigationCanvasLegPaths(view,atlas,route);
    const routeWaypoints=createGuidedTokenWaypoints(paths,token,this.scene.grid?.size);
    const nativeContinuous=guidedLeg?.transport?.operation==="continuous";
    const waypoints=nativeContinuous?anchorNativeTokenWaypoints(routeWaypoints,
      token,this.scene.grid.size):routeWaypoints;
    const snapshot=createNavigationItinerary({
      sceneId:this.scene.id,sceneName:this.scene.name??"",
      sceneUnits:this.scene.grid?.units??"",atlasRevision:atlas.revision,
      route,roadName:id=>atlas.roads.find(road=>road.id===id)?.name??"Road",travel
    });
    const itinerary=guidedLeg?{...snapshot,transport:guidedLeg.transport}:{
      ...snapshot,
      travel:{...snapshot.travel,
        methodId:travel.methodId??this.travelMethod,
        methodName:travel.methodLabel??this.travelMethod,
        arrangement:this.transportArrangement,operation:this.transportOperation}
    };
    const playback=calculateGuidedPlayback({
      route,travel,paths,
      gridSize:this.scene.grid?.size,
      secondsPerHour:readGuidedPlaybackSetting(game.settings)
    });
    const chunks=planGuidedTravelChunks(waypoints,{
      movementSpeed:playback.movementSpeed,gridSize:this.scene.grid.size
    });
    const totalDistance=chunks.reduce((sum,chunk)=>sum+chunk.distance,0);
    const schedule=new GuidedTravelDayTracker({travelHours:playback.travelHours,
      rules:this.resolveTravelRules(travel,guidedOption?.method,
        guidedLeg?.transport?.operation)});
    if(nativeContinuous&&(
      typeof token.pauseMovement!=="function"||
      typeof token.stopMovement!=="function"||
      typeof globalThis.Hooks?.on!=="function"||
      typeof globalThis.Hooks?.off!=="function"||
      typeof foundry.utils?.randomID!=="function"))
      throw Error("Continuous travel requires Foundry v14 native movement " +
        "checkpoints and Hooks. The token and Journal have not changed.");
    // Reject unsupported paths before even creating a Journey Journal.
    const nativePlan=nativeContinuous?describeNativeCheckpointSources(
      planNativeCheckpointPath(waypoints,{
      movementSpeed:playback.movementSpeed,gridSize:this.scene.grid.size,
      secondsPerCheckpoint:NATIVE_CONTINUOUS_CHECKPOINT_SECONDS,
      totalMovingHours:playback.travelHours
    }),{legPaths:paths,token,gridSize:this.scene.grid.size,
      arrivalCheckpointId:guidedLeg?.checkpoint?.id??null}):null;
    if(nativePlan&&Math.abs(nativePlan.totalDistance-totalDistance)>1e-3)
      throw Error("The native and approved route distances disagree.");
    const advanceWorldTime=readNavigationWorldClockSetting(game.settings);
    if(advanceWorldTime){
      if(game.users?.activeGM?.id!==game.user?.id||!game.user?.isGM)
        throw Error("Only Foundry's active GM can advance World time during an Atlas journey.");
      if(typeof game.time?.advance!=="function")
        throw Error("Foundry World time is unavailable for guided travel.");
    }
    const session={token,sceneId:this.scene.id,gridSize:this.scene.grid.size,
      phase:"moving",resumeWaiter:null,restWaiter:null,schedule,
      transportLeg:guidedLeg,pendingPassengerRest:null,
      completedDistance:0,totalDistance,currentChunk:null,timer:null,clock:null,
      confirmedSegments:0,restCheckpointed:false};
    session.finished=new Promise(resolve=>{session.resolveFinished=resolve;});
    // The Journal is the one durable journey store. Create it before any
    // movement; a failed Journal write cannot leave an unrecorded trip.
    this.journalStarting=true;
    try{
      const recovered=this.recoveryRecord;
      if(recovered?.passengerRest&&guidedLeg?.transport?.operation!=="continuous")
        throw Error("Restore continuous vessel operation before resuming a passenger rest.");
      const departureStamp=recovered?null:journeyWorldStamp(game.time);
      const routeTargets=!recovered?buildJourneyTargets({route:this.result,
        transitions:guidedLeg?projectTransportationRouteLegs(this.result,atlas,
          validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING)).presets):null,
        atlas}):null;
      const initialAnchor=this.captureConfirmedJourneyAnchor(session,view,atlas);
      session.lastConfirmedAnchor=initialAnchor;
      const record=recovered?
        resumeJourneyRecord(recovered,{itinerary,atlasRevision:atlas.revision,
          // The recovery target is the current leg checkpoint, not a GM edit
          // to the original Point B. Preserve the final destination on resume.
          journeyDestination:recovered.routeTargets||isUnfinishedJourneyLeg(recovered)?
            null:this.end}):
        createJourneyRecord({sceneId:this.scene.id,tokenId:token.id,
          atlasRevision:atlas.revision,itinerary,journeyDestination:this.end,
          routeTargets,initialAnchor,
          startedWorldTime:departureStamp?.seconds??null,
          startedTimeLabel:departureStamp?.label??null,
          title:navigationJourneyTitle({atlas,
            departure:this.itinerary?.endpoints?.departure??itinerary.endpoints.departure,
            destination:this.end??itinerary.endpoints.destination,
            dateLabel:departureStamp?.label??null,time:game.time})});
      if(recovered){
        schedule.todayHours=recovered.day.todayHours;
        schedule.permittedExtraUntil=recovered.day.permittedExtraUntil;
        schedule.restEvents=recovered.day.restEvents;
        schedule.lastForcedCheck=recovered.day.lastForcedCheck;
      }
      session.pendingPassengerRest=recovered?
        recoverPassengerRestRequest(record,schedule):null;
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
    this.recoveryOperationOverride=null;
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
      if(nativeContinuous){
        try{
          reachedEnd=await this.runNativeContinuousLeg(session,{
            plan:nativePlan,playback,atlas,view,guidedLeg
          });
        }catch(error){
          reachedEnd=false;
          interruptedReason="Native journey checkpoint could not be confirmed: "+
            (error.message||String(error));
          clockFailed=true;
        }
      }else for(let index=0;index<chunks.length;index++){
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
        // Keep the last VERIFIED native position in memory even between
        // periodic Journal writes. Canvas teardown checkpoints this anchor
        // alongside the credited distance, never the current in-flight token.
        session.lastConfirmedAnchor=this.captureConfirmedJourneyAnchor(session,
          this.canvasProvider(),this.atlasProvider(this.scene));
        // Credit progress only after Foundry confirms the expected destination.
        // An interrupted/redirected movement must never receive World time.
        session.completedDistance+=chunk.distance;
        atlasDebug("movement","Native movement confirmed",{
          sceneId:session.sceneId,chunk:index+1,
          completedPercent:Math.round(100*session.completedDistance/totalDistance)
        },{level:"verbose"});
        schedule.recordMovement(chunk.distance/totalDistance*playback.travelHours);
        let passengerRestFinished=false;
        if(session.pendingPassengerRest&&
            confirmPassengerRest(schedule,session.pendingPassengerRest)){
          atlasDebug("journey","Passenger rest completed while voyage continued",{
            sceneId:session.sceneId,action:session.pendingPassengerRest.action,
            hours:session.pendingPassengerRest.hours});
          this.travelNotice="Passenger rest completed aboard "+
            guidedLeg.transport.methodName+" while the vessel kept moving.";
          session.pendingPassengerRest=null;
          session.journeyRecord.passengerRest=null;
          passengerRestFinished=true;
        }
        session.confirmedSegments++;
        this.setTravelProgress(Math.min(99,100*session.completedDistance/totalDistance));
        try{await this.commitGuidedWorldTime(session);}
        catch(error){
          reachedEnd=false;clockFailed=true;
          interruptedReason="World time could not advance: "+(error.message||String(error));
          break;
        }
        if(this.travelSession!==session)return false;
        if(session.confirmedSegments%5===0||passengerRestFinished){
          try{await this.saveJourneyCheckpoint(session,"moving");}
          catch(error){
            reachedEnd=false;
            interruptedReason="The Journey Journal could not save confirmed progress: "+
              (error.message||String(error));
            break;
          }
        }
        // The pending rest was released after its confirmed sailing hours.
        // Refresh the footer once the completed event is durable in the Journal,
        // so its disabled controls are not left stale until the next checkpoint.
        if(passengerRestFinished&&this.travelSession===session&&this.active)
          void this.render(true);
      }
      if(this.travelSession===session){
        if(!clockFailed){
          try{await this.commitGuidedWorldTime(session,{force:true});}
          catch(error){
            clockFailed=true;
            interruptedReason="World time could not advance: "+(error.message||String(error));
          }
        }
        let arrived=reachedEnd&&session.phase!=="ending"&&!clockFailed;
        if(arrived&&guidedLeg){
          try{
            const actual=this.atlasPoint(view,atlas,
              partyTokenCanvasCenter(token,this.scene.grid.size));
            if(!confirmGuidedCheckpointArrival({token,gridSize:this.scene.grid.size,
              atlasPoint:actual,expectedPoint:guidedLeg.checkpoint.point}))
              throw Error("The token did not reach the authored checkpoint.");
          }catch(error){
            arrived=false;interruptedReason="Checkpoint arrival was not verified: "+
              (error.message??String(error));
          }
        }
        if(arrived){
          // Do not allow the animation sampler to overwrite confirmed arrival.
          if(session.timer!==null){clearInterval(session.timer);session.timer=null;}
          this.setTravelProgress(100);
          if(guidedLeg)session.phase="checkpoint-arrival";
        }
        try{await this.saveJourneyCheckpoint(session,arrived?
          (guidedLeg?"paused":"completed"):
          session.phase==="ending"&&!session.journeyRecord.pendingNativeMove?
            "ended":"interrupted");}
        catch(error){
          interruptedReason="The Journey Journal could not finalize: "+
            (error.message||String(error));
          arrived=false;atlasWarn("journey",interruptedReason);
        }
        if(arrived&&!guidedLeg&&session.journeyRecord?.status==="completed"){
          this.completedRoute=true;
          this.completedRecord=validateJourneyRecord(session.journeyRecord);
        }
        if(arrived&&guidedLeg){
          this.pendingTransfer={sceneId:session.sceneId,atlasRevision:atlas.revision,
            tokenId:token.id,checkpoint:guidedLeg.checkpoint,
            journalId:session.journal.id};
          this.recoveryRecord=session.journeyRecord;
          this.recoveryJournal=session.journal;
          this.recoverableJourney=null;
          // A recovered voyage temporarily routes Point B to its approved
          // checkpoint. At arrival, restore the Journal's original Point B
          // before deciding whether this checkpoint is the final destination.
          // The checkpoint remains the confirmed leg endpoint in the Journal.
          this.end={...session.journeyRecord.destination};
          // The old full-route preview must never look like an active next leg.
          this.result=null;this.itinerary=null;
          try{this.syncPartyDeparture(view,atlas);this.draw();}
          catch(error){atlasWarn("journey","Checkpoint arrived but preview origin did not refresh",error);}
          this.travelNotice=this.isAtJourneyDestination(this.pendingTransfer.checkpoint)?
            "Destination reached at "+guidedLeg.checkpoint.name+
              ". Complete the Journey here, or choose Continue for a new onward destination.":
            "Reached "+guidedLeg.checkpoint.name+
              ". Continue toward the saved destination or stop and replan. "+
              "No onward transport has been selected or paid for.";
        }else this.travelNotice=arrived?"Arrived at destination."+
          (schedule.lastForcedCheck?` Resolve the latest forced-march DC `+
            `${schedule.lastForcedCheck.dc} Constitution saves manually.`:""):
          (interruptedReason??"Journey ended at the last completed road stretch.");
        atlasDebug("journey",arrived?"Journey arrived":
          "Journey stopped",{
          sceneId:session.sceneId,reason:arrived?
            (guidedLeg?"checkpoint-arrived":"arrived"):
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

  /** The party must actually occupy its authored checkpoint before onward choice. */
  verifyPendingTransfer(){
    const pending=this.pendingTransfer;
    const view=this.canvasProvider(),token=this.getPartyToken();
    if(!pending||this.travelSession||this.journalStarting||
        !game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update")||
        !view?.ready||view.scene?.id!==pending.sceneId||
        this.atlasProvider(this.scene).revision!==pending.atlasRevision||
        token?.id!==pending.tokenId||!token.canUserModify?.(game.user,"update"))
      throw Error("The checkpoint decision is stale. Reopen the saved Journey.");
    const point=this.atlasPoint(view,this.atlasProvider(this.scene),
      partyTokenCanvasCenter(token,this.scene.grid.size));
    if(!confirmGuidedCheckpointArrival({token,gridSize:this.scene.grid.size,
      atlasPoint:point,expectedPoint:pending.checkpoint.point}))
      throw Error("The party is no longer at the confirmed checkpoint. Review the Journey.");
    return {pending,view,token};
  }

  /** End the confirmed Journal at this checkpoint; future destinations stay free. */
  async stopAndReplanAtCheckpoint(){
    const {pending}=this.verifyPendingTransfer();
    if(this.recoveryJournal?.id!==pending.journalId||!this.recoveryRecord)
      throw Error("The confirmed checkpoint Journal is unavailable.");
    const next=validateJourneyRecord(this.recoveryRecord);
    if(next.status!=="paused"||next.legs.at(-1)?.completedPercent<99.999)
      throw Error("Only a confirmed checkpoint can end this leg.");
    next.status="ended";next.updatedAt=new Date().toISOString();
    await this.journeyJournalStore.save(next,{journal:this.recoveryJournal});
    this.pendingTransfer=null;
    this.clear();
    this.travelNotice="Journey ended at "+pending.checkpoint.name+
      ". Choose a new destination when the party is ready.";
    await this.render(true);
    return true;
  }

  /** Completing a destination checkpoint changes only the saved Journal.
   * No new token movement or World-time advance is ever requested. */
  async completeJourneyAtCheckpoint(){
    const {pending}=this.verifyPendingTransfer();
    if(this.recoveryJournal?.id!==pending.journalId||!this.recoveryRecord||
        !this.isAtJourneyDestination(pending.checkpoint))
      throw Error("This is not the Journey's confirmed destination checkpoint.");
    const next=validateJourneyRecord(this.recoveryRecord);
    const arrived=journeyWorldStamp(game.time);
    next.status="completed";next.updatedAt=new Date().toISOString();
    if(Number.isFinite(arrived?.seconds))next.arrivedWorldTime=arrived.seconds;
    if(arrived?.label)next.arrivedTimeLabel=arrived.label;
    await this.journeyJournalStore.save(next,{journal:this.recoveryJournal});
    const completedJournal=this.recoveryJournal;
    this.pendingTransfer=null;
    this.clear();
    // Retain only a validated, in-memory read model for the finished screen.
    // The already-saved Journey Journal remains the sole durable record.
    this.completedRecord=next;
    this.completedRoute=true;
    this.journeyJournal=completedJournal;
    this.travelNotice="Journey completed at "+pending.checkpoint.name+
      ". No duplicate short travel leg was created.";
    await this.render(true);
    return true;
  }

  /** Resume toward original Point B, or explicitly choose a new one for legacy Journals. */
  async continueFromCheckpoint(){
    const {pending,view}=this.verifyPendingTransfer();
    const atDestination=this.isAtJourneyDestination(pending.checkpoint);
    const nextTarget=this.recoveryRecord?.routeTargets?
      nextJourneyTarget(this.recoveryRecord.routeTargets):null;
    const selectedEnd=nextTarget?.point??this.end??this.recoveryRecord?.destination;
    // Never create another tiny leg back to the checkpoint already occupied.
    this.end=atDestination?null:(selectedEnd?{...selectedEnd}:null);
    this.pendingTransfer=null;
    this.sourceMode="party";
    const atlas=this.atlasProvider(this.scene);
    this.syncPartyDeparture(view,atlas);
    this.calculateRoute(view,atlas);
    // Some map-click destinations near a dock resolve right back to that
    // same completed checkpoint. The safety guard must still forbid another
    // booking, but Continue should leave the GM free to choose a new Point B.
    // This is a preview-only check; approved Journal history is untouched.
    let duplicateArrival=false;
    if(this.result?.status==="ok"){
      try{
        const plan=this.transportationTransitionPlan();
        duplicateArrival=isRepeatedArrivalCheckpoint(this.recoveryRecord,
          plan?.legs?.[0]?.arrivalCheckpoint);
      }catch(error){
        atlasWarn("navigation","Could not inspect checkpoint continuation preview",error);
      }
    }
    if(duplicateArrival){
      this.end=null;
      this.calculateRoute(view,atlas);
    }
    this.travelNotice=this.end?
      "Continuing from "+pending.checkpoint.name+" toward the saved destination. "+
        "Select transportation for the next leg.":
      "Checkpoint confirmed at "+pending.checkpoint.name+". "+
        (duplicateArrival?"The saved Point B resolves back to this same checkpoint. ":"")+
        "Choose the next destination to continue this Journey without replaying past travel.";
    this.draw();await this.render(true);
    return true;
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
    // A single native v14 movement can span many checkpoints. Stopping Atlas
    // must stop that public TokenDocument operation, not merely its UI loop.
    if(session.nativeActive){
      session.nativeAbort?.abort();
      try{session.token.stopMovement();}
      catch(error){atlasWarn("movement","Native movement could not be stopped",error);}
    }
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
    this.completedRoute=false;
    this.completedRecord=null;
    this.worldTimeAdvancedSeconds=0;
    this.worldTravelAdvancedSeconds=0;
    this.worldRestAdvancedSeconds=0;
    this.journeySchedule=null;
    this.journeyTimeUI=null;
    this.transportHireTerms=null;
    this.transportHireDenomination=null;
    this.transportJourneyOverrides=null;
    this.recoveryJournal=null;
    this.recoveryRecord=null;
    this.recoveryOperationOverride=null;
    this.recoverableJourney=null;
    this.journeyJournal=null;
    this.pendingTransfer=null;
    if(this.sourceMode==="party"&&this.scene){
      try{this.syncPartyDeparture(this.canvasProvider(),this.atlasProvider(this.scene));}
      catch{this.start=null;}
    }
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
    const changedTransport=Object.keys(changes.flags?.[MODULE_ID]??{})
      .some(key=>key.replace(/^\-=/,"")==="checkpointTransportOffers");
    if(changedTransport&&!this.travelSession)void this.render(true);
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
      // A final native dock confirmation may already have durably committed
      // transfer metadata before move() resolves. Never downgrade that paused
      // checkpoint to an unconfirmed, partially travelled leg on redraw.
      const confirmedArrival=session.journeyRecord?.status==="paused"&&
        !session.journeyRecord.pendingNativeMove&&
        session.completedDistance/session.totalDistance>=.99999;
      void this.saveJourneyCheckpoint(session,confirmedArrival?
        "paused":"interrupted").catch(error=>
        atlasWarn("journey","Journey interrupted but its Journal could not update",error));
      this.stopGuidedTravel({render:false});
    }
    this.travelSession=null;
    this.pointerTarget?.removeEventListener?.("pointerdown",this.pointerDown,true);
    this.pointerTarget = null;
    if(this.routePulseTicker)this.routePulseOwner?.ticker?.remove?.(this.routePulseTicker);
    this.routePulseTicker=null;this.routePulseOwner=null;
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
    this.completedRoute=false;
    this.completedRecord=null;
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
    this.recoveryOperationOverride=null;
    this.journeyJournal=null;
    this.journalStarting=false;
    this.pendingTransfer=null;
  }

  tearDown(reason="requested") {
    const session=this.travelSession;
    atlasDebug("lifecycle","Navigation teardown",{
      reason,sceneId:this.scene?.id??null,journeyActive:Boolean(session),
      completedPercent:Math.floor(this.travelProgress),phase:session?.phase??null
    });
    if(reason==="canvasTearDown"&&["moving","rest-applying"].includes(session?.phase)&&
        !session.manualRestApplying&&
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
      this.recoverSavedJourney({automatic:true});
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
    let methodTravel=resolveNavigationMethodTravel(this.travelMethod,travel,game.settings,sceneUnit,
      {systemId:game.system?.id});
    // A partial, non-checkpoint land leg keeps its approved speed across a
    // canvas rebuild; World or Group preset changes cannot silently re-time it.
    const savedLeg=this.recoveryRecord?.legs?.at(-1);
    if(isUnfinishedJourneyLeg(this.recoveryRecord)&&!savedLeg?.transport&&
        savedLeg?.travelMethod?.id===this.travelMethod&&
        Number.isFinite(savedLeg.speedPerHour)&&savedLeg.speedPerHour>0)
      return {sceneUnit,travel:{...methodTravel,speed:savedLeg.speedPerHour,
        source:"recovered-method"}};
    if(this.travelMethod!=="walking"&&(this.transportArrangement==="hire"||
        this.transportJourneyOverrides?.speedMph!==undefined)){
      try{
        const world=this.transportAvailability().all.find(m=>m.id===this.travelMethod);
        const local=world&&this.effectiveTransportMethod(world);
        if(local?.speedMph!==world?.speedMph){
          const speed=convertGroupSpeed(local.speedMph,"mph",sceneUnit);
          if(speed>0)methodTravel={...methodTravel,speed,speedMph:local.speedMph,
            source:this.transportJourneyOverrides?"journey-method":"checkpoint-method"};
        }
      }catch(error){atlasWarn("navigation","Checkpoint travel speed unavailable",error);}
    }
    // Explicit journey speed edits take precedence over Group pace suggestions.
    if(this.transportJourneyOverrides?.speedMph!==undefined&&
        this.travelMethod!=="walking")return {sceneUnit,travel:methodTravel};
    // An owned mount/vehicle may have Group-only travel-speed overrides.
    // Hired transport and unowned World reference methods retain catalog speeds.
    if(this.travelMethod!=="walking"&&this.transportArrangement!=="hire"&&
        game.system?.id==="dnd5e"&&
        assignedToken?.actor?.type==="group"){
      try{
        const methods=availableNavigationTravelMethods(game.settings,game.system.id);
        const method=methods.find(candidate=>candidate.id===this.travelMethod);
        if(method&&method.kind!=="foot"&&
            !["coach-hire","ship-passage"].includes(method.id)){
          const roster=projectGroupTransportation(assignedToken.actor,
            readGroupTransportation(game.settings),methods);
          const capacity=groupMethodCapacityStatus(roster,method);
          if(capacity.sufficient&&capacity.effectiveSpeedMph!==null){
            const speed=convertGroupSpeed(capacity.effectiveSpeedMph,"mph",sceneUnit);
            if(speed!==null&&speed>0){
              return {sceneUnit,travel:{...methodTravel,speed,
                speedMph:capacity.effectiveSpeedMph,source:"group-method"}};
            }
          }
        }
      }catch(error){atlasWarn("navigation","Group speed override preview unavailable",error);}
    }
    return {sceneUnit,travel:methodTravel};
  }

  /** Read-only UI stage projection. It is not a journey state machine and does
   * not authorize, save, or replay any Journey transition. */
  navigationStage(){
    return resolveNavigationStage({pendingTransfer:this.pendingTransfer,
      travelSession:this.travelSession,completedRecord:this.completedRecord,
      completedRoute:this.completedRoute});
  }

  /** Each non-planning stage has its own view; source/method editors and
   * transient route estimates belong exclusively to destination planning. */
  async renderJourneyStage(stage){
    const {root,body}=createNavigationStageShell();
    const partyMode=this.sourceMode==="party";
    const session=this.travelSession;
    if(stage===NAVIGATION_STAGES.CHECKPOINT){
      const checkpoint=this.pendingTransfer?.checkpoint;
      body.append(...renderNavigationStageIntro({title:"Checkpoint decision",
        description:"The arriving leg is confirmed. Decide how to continue; no onward travel or payment is automatic.",
        notice:this.travelNotice||null}));
      if(checkpoint){
        const atDestination=this.isAtJourneyDestination(checkpoint);
        body.append(renderCheckpointArrivalPrompt({
          checkpointName:checkpoint.name,atDestination}));
      }
      if(game.user?.isGM&&this.recoveryRecord?.routeTargets)
        body.append(renderJourneyTargets(this.recoveryRecord.routeTargets));
      body.append(el("p","Continue retains the saved Point B and lets the GM choose the next eligible transportation method. Complete is available only at the confirmed final destination."));
      root.append(body,renderNavigationFooter(this,{partyMode}));
      return root;
    }
    if(stage===NAVIGATION_STAGES.COMPLETED){
      body.append(...renderNavigationStageIntro({title:"Journey completed",
        description:"Confirmed travel history from the saved Journey Journal. Start a new route to travel again.",
        notice:this.travelNotice||null}));
      const record=this.completedRecord;
      if(record?.status==="completed"){
        const moving=confirmedJourneyMovingHours(record);
        const downtime=record.legs.reduce((sum,leg)=>sum+leg.events.reduce(
          (rest,event)=>rest+(event.hours>0&&!isRestUnderway(event.action)?
            event.hours:0),0),0);
        const showHours=hours=>formatNavigationDuration(hours,24);
        const clockMoving=record.legs.reduce((sum,leg)=>
          sum+(leg.worldTravelSeconds||0),0);
        const clockRest=record.legs.reduce((sum,leg)=>
          sum+(leg.worldRestSeconds||0),0);
        body.append(renderNavigationCompletedOverview({
          title:record.title??"Confirmed Journey",
          departed:record.startedTimeLabel??"Recorded in Journey Journal",
          arrived:record.arrivedTimeLabel??"Recorded in Journey Journal",
          moving:showHours(moving),downtime:showHours(downtime),
          elapsed:showHours(moving+downtime),
          legs:record.legs.map((leg,index)=>({
            label:`Leg ${index+1} · ${leg.sceneName}`,
            details:`${atlasFormatMeasure(atlasDisplayDistance(leg.distance,
              leg.units||this.scene?.grid?.units||""))} · `+
              `${showHours(leg.completedMovingHours)} moving · `+
              `${leg.transport?.methodName??leg.travelMethod?.name??"On foot"}`
          }))}));
        const clock=el("p","Foundry World time recorded: "+
          formatGuidedWorldTime(clockMoving+clockRest)+" (moving "+
          formatGuidedWorldTime(clockMoving)+"; breaks "+
          formatGuidedWorldTime(clockRest)+").");
        clock.style.cssText="margin:0;font-size:.82em;opacity:.8;";
        body.append(clock);
      }else body.append(el("p","Open the Journey Journal for its confirmed record."));
      root.append(body,renderNavigationFooter(this,{partyMode}));
      return root;
    }
    if(stage!==NAVIGATION_STAGES.JOURNEY||!session)
      throw Error("The Navigation stage is no longer available.");

    const leg=session.transportLeg??this.result;
    const approvedLeg=session.journeyRecord?.legs?.at(-1);
    const approved=approvedLeg?.transport??session.transportLeg?.transport;
    const {sceneUnit,travel}=this.resolveTravel();
    const speed=Number.isFinite(approvedLeg?.speedPerHour)&&approvedLeg.speedPerHour>0?
      approvedLeg.speedPerHour:travel.speed;
    const showDistance=amount=>atlasFormatMeasure(atlasDisplayDistance(amount,sceneUnit));
    const showSpeed=amount=>atlasFormatMeasure(atlasDisplaySpeed(amount,sceneUnit));
    const hours=session.schedule.travelHours;
    const plan=session.schedule.estimate??
      estimateNavigationTotalTrip(hours,session.schedule.rules);
    body.append(...renderNavigationStageIntro({title:"Journey in progress",
      description:"Follow the approved leg. Pause, resume, end, or record GM-approved rests using the controls below.",
      notice:this.travelNotice||null}));
    if(approved){
      body.append(renderNavigationTravelMethodSelector({
        choices:[{value:"approved",label:approved.methodName,
          group:"Approved current Journey leg"}],selectedValue:"approved",
        disabled:true,onMethodChange:()=>{}}));
    }else{
      const method=el("p","Travel method: "+(approvedLeg?.travelMethod?.name??
        (this.travelMethod==="walking"?"Walking (party pace)":
          travel.methodLabel??"Current method")));
      method.style.cssText="margin:0;font-size:.87em;";
      body.append(method);
    }
    const summary=renderNavigationSummaryMetrics({metrics:[
      {label:"Current Leg Distance",value:showDistance(leg?.distance??this.result?.distance??0)},
      {label:"Travel Time",value:formatGuidedWorldTime(Math.round(hours*3600))},
      {label:"Total Trip",value:formatNavigationDuration(plan.totalHours,24)}
    ],explanation:"The saved approved Journey leg controls movement and recovery; these values are read-only.",
    progressPercent:this.travelProgress});
    body.append(...summary.nodes);
    this.travelProgressUI=summary.progressUI;
    this.journeyTimeUI=summary.timeUI?{travelHours:hours,plan,...summary.timeUI}:null;
    this.updateJourneyTiming();
    if(session.phase==="rest-choice"){
      const rules=session.schedule.rules;
      const routeAverage=hours>0?(leg?.distance??0)/hours:0;
      const upcomingExtra=Math.floor(Math.max(0,session.schedule.todayHours-rules.dailyHours)+1e-6)+1;
      body.append(renderDailyTravelPrompt([
        `Overnight Camp: +${rules.overnightHours}h downtime; resets travel allowance to ${rules.dailyHours}h.`,
        `Long Rest: +${rules.longRestHours}h downtime; resets travel allowance to ${rules.dailyHours}h.`,
        `Short Rest: +${rules.shortRestHours}h downtime; does not restore daily travel hours.`,
        `Continue March: +1h moving (roughly ${showDistance(routeAverage)} on this route).`+
          (rules.forcedMarch!=="custom"?` DC ${10+upcomingExtra} Constitution save afterward (GM adjudicates).`:"")
      ]));
    }
    const clockAllowed=readNavigationWorldClockSetting(game.settings);
    const approvedMethod=approved??approvedLeg?.travelMethod;
    const travelSource=approvedMethod?
      `${approvedMethod.methodName??approvedMethod.name} (approved ${approvedMethod.arrangement} Journey leg) · ${showSpeed(speed)}`:
      travel.source==="group-method"?
        `${travel.methodLabel} (party-owned convoy; slowest matching resource) · ${showSpeed(speed)}`:
      travel.source==="party"?
        `${travel.actorName} · ${travel.pace} pace · ${showSpeed(speed)}`:
      `${travel.methodLabel??"Atlas default"} · ${showSpeed(speed)}`;
    const status=renderNavigationSummaryStatus({
      clockHint:clockAllowed?
        "Foundry World time advances for confirmed movement and GM-approved breaks. Actor rests and exhaustion remain manual.":
        "Foundry World time remains unchanged; confirmed breaks still count toward Journey duration.",
      worldTimeStatus:session.clock||this.worldTimeAdvancedSeconds>0?
        this.worldTimeStatus():null,
      speedSource:"Speed: "+travelSource,
      terrainCostLabel:leg?.terrainAware?
        "Terrain-weighted distance: "+showDistance(leg.cost)+"-equivalent":null});
    body.append(...status.nodes);
    this.worldTimeUI=status.worldTimeUI;
    if(game.user?.isGM&&session.journeyRecord?.routeTargets)
      body.append(renderJourneyTargets(session.journeyRecord.routeTargets));
    const routeLegs=leg?.legs??this.result?.legs??[];
    const atlas=this.atlasProvider(this.scene);
    const steps=buildNavigationSteps(routeLegs,
      id=>atlas.roads?.find(road=>road.id===id)?.name??"Road");
    const journeySpeed=hours>0?
      (leg?.terrainAware?leg.cost:leg?.distance)/hours:speed;
    const annotated=this.journeySchedule?.events?.length?
      annotateJourneyDirections(steps,this.journeySchedule.events,{
        travelHours:hours,speed:journeySpeed,
        terrainAware:Boolean(leg?.terrainAware)}):steps;
    const rows=annotated.map(step=>step.kind==="journey-event"?{
      kind:"journey-event",label:step.label,
      marker:step.action==="continue"?"➜":"☕",
      detail:(step.hours?formatNavigationDuration(step.hours,24)+" "+
        (step.action?.endsWith("-underway")?"rest aboard while underway":"downtime")+" · ":"")+
        "After "+formatNavigationDuration(step.atHours,24)+" on this leg"
    }:{kind:"direction",direction:step.direction,instruction:step.instruction,
      info:showDistance(step.distance)+" · "+
        formatGuidedWorldTime(Math.round(navigationHours(
          leg?.terrainAware?step.cost:step.distance,speed)*3600)),
      surface:[step.terrain==="Unspecified terrain"?null:step.terrain,
        step.regionName&&step.regionName!==step.terrain?step.regionName:null]
        .filter(Boolean).join(" · ")});
    body.append(...renderNavigationDirections({
      calculation:"Only confirmed TokenDocument movement and Journal checkpoints affect recovery. The next checkpoint requires a separate GM decision.",
      transfer:Boolean(session.transportLeg),
      arrivalCheckpointName:session.transportLeg?.checkpoint?.name??null,rows}));
    root.append(body,renderNavigationFooter(this,{partyMode}));
    return root;
  }

  async _renderHTML(){
    const stage=this.navigationStage();
    if(stage!==NAVIGATION_STAGES.JOURNEY){
      // Drop references to the previous stage's detached DOM on transitions.
      // Never let an animation tick update stale progress/clock elements.
      this.travelProgressUI=null;
      this.journeyTimeUI=null;
      this.worldTimeUI=null;
    }
    if(stage!==NAVIGATION_STAGES.DESTINATION)
      return this.renderJourneyStage(stage);
    return this.renderDestinationStage();
  }

  async renderDestinationStage() {
    const root=el("section");
    root.style.cssText="display:flex;flex-direction:column;height:100%;max-height:100%;min-height:0;overflow:hidden;";
    const body=el("div");
    body.style.cssText="display:flex;flex-direction:column;gap:.85rem;padding:1rem;flex:1;min-height:0;overflow-y:auto;";
    body.append(...renderNavigationStageIntro({title:"Choose destination",
      description:"Select Point B on the map. Once a route is available, review transport and confirm travel; a checkpoint directory can be added without changing this workflow."}));
    const partyMode=this.sourceMode==="party";
    const status=this.pendingTransfer?
      "Checkpoint reached at "+this.pendingTransfer.checkpoint.name+
        ". Choose Continue, Complete Journey (if final), or Stop and replan.":
      !this.start ? (this.notice||(partyMode?
        "Party token location unavailable. Refresh its location before choosing B.":
        "Click the map to select Point A.")) :
      !this.end ? (partyMode?"Party token is Point A. Click the map to select Point B.":
        "Point A selected. Click the map to select Point B.") :
      this.result?.status==="ok" ? (partyMode?
        "Route calculated from party token. Alt/Option+click to change B.":
        "Route calculated. Shift+click changes A; Alt/Option+click changes B.") :
      (this.result?.reason ?? "No connected road route available.");
    let transferPlan=null;
    let recoveredPlanError=null;
    // During approved movement the transient preview/selection is no longer
    // authoritative. The Journal leg below supplies the selected method and
    // timing; avoid accidentally repainting a new transfer choice mid-voyage.
    if(this.result?.status==="ok"&&!this.travelSession?.transportLeg){
      try{transferPlan=this.transportationTransitionPlan();}
      catch(error){
        atlasWarn("navigation","Transportation leg planning unavailable",error);
        if(hasUnfinishedApprovedTransport(this.recoveryRecord))
          recoveredPlanError=error?.message??String(error);
      }
    }
    body.appendChild(renderNavigationDepartureSelector({
      sourceMode:this.sourceMode,partyMode,disabled:Boolean(this.travelSession),
      onSourceChange:mode=>this.setSourceMode(mode),
      onRefresh:()=>this.refreshPartyDeparture()
    }));
    // An unresolved native checkpoint is still an approved Journal leg. Do
    // not present the default Walking selection or an unrelated recalculated
    // route as permission to replay a failed vessel movement.
    let pendingNativeReview=null;
    if(this.recoverableJourney&&!this.travelSession&&!this.recoveryRecord){
      const raw=this.recoverableJourney.getFlag?.(MODULE_ID,JOURNEY_JOURNAL_FLAG);
      if(raw?.pendingNativeMove){
        try{
          pendingNativeReview=validateJourneyRecord(raw);
        }catch{
          // A corrupted pending intent is *more* reason to block movement.
          // Never trust its unvalidated coordinates or IDs for a preview.
          pendingNativeReview={pendingNativeMove:{}};
        }
      }
    }
    const pendingReviewLeg=pendingNativeReview?.legs?.at(-1)??null;
    const pendingReviewMethod=pendingReviewLeg?.transport??pendingReviewLeg?.travelMethod;
    const pendingReviewMethodName=pendingReviewMethod?.methodName??
      pendingReviewMethod?.name??"Previously approved travel method";
    const availability=this.transportAvailability();
    const methods=availability.methods;
    const approvedActiveTransport=this.travelSession?.transportLeg?
      (this.travelSession.journeyRecord?.legs.at(-1)?.transport??
        this.travelSession.transportLeg.transport):null;
    const approvedActiveLeg=approvedActiveTransport?
      this.travelSession.journeyRecord?.legs.at(-1):null;
    const approvedRecoveryTransport=hasUnfinishedApprovedTransport(this.recoveryRecord)?
      this.recoveryRecord.legs.at(-1).transport:null;
    if(!pendingNativeReview&&!approvedActiveTransport&&!approvedRecoveryTransport&&
        !methods.some(item=>item.id===this.travelMethod)){
      this.travelMethod="walking";this.transportArrangement="owned";
      this.transportHireTerms=null;this.transportHireDenomination=null;
      this.transportJourneyOverrides=null;
      this.transportOperation="normal";
    }
    const choices=[
      ...methods.filter(item=>item.id==="walking"||availability.owned.has(item.id)||
        approvedRecoveryTransport?.methodId===item.id)
        .map(method=>approvedRecoveryTransport?.methodId===method.id?{
          value:approvedRecoveryTransport.arrangement+"|"+method.id,
          label:approvedRecoveryTransport.methodName,group:"Approved saved Journey"
        }:{value:"owned|"+method.id,label:method.name,group:"Party"}),
      ...methods.flatMap(method=>{
        if(approvedRecoveryTransport?.methodId===method.id)return [];
        const offer=availability.offers.get(method.id);
        return offer?[{value:"hire|"+method.id,label:method.name,
          group:offer.checkpointName||"Nearby checkpoint"}]:[];
      })
    ];
    if(pendingNativeReview)
      body.appendChild(renderNavigationTravelMethodSelector({
        choices:[{value:"saved",label:pendingReviewMethodName,
          group:"Approved saved Journey — GM review required"}],
        selectedValue:"saved",disabled:true,onMethodChange:()=>{}
      }));
    else if(this.result?.status==="ok"&&approvedActiveTransport)
      body.appendChild(renderNavigationTravelMethodSelector({
        choices:[{value:"approved",label:approvedActiveTransport.methodName,
          group:"Approved current Journey leg"}],
        selectedValue:"approved",disabled:true,onMethodChange:()=>{}
      }));
    else if(this.result?.status==="ok"&&!transferPlan?.hasTransitions)
      body.appendChild(renderNavigationTravelMethodSelector({
        choices,selectedValue:this.transportArrangement+"|"+this.travelMethod,
        disabled:Boolean(this.travelSession||this.journalStarting||approvedRecoveryTransport),
        showEditor:this.travelMethod!=="walking"&&!approvedRecoveryTransport,
        onMethodChange:value=>{
          const [arrangement,method]=value.split("|",2);
          this.setTravelMethod(method,arrangement);
        },
        onEdit:()=>void this.editJourneyTravelMethod().catch(error=>
          globalThis.ui?.notifications?.error?.(error?.message??String(error)))
      }));
    if(!pendingNativeReview&&!approvedActiveTransport&&!approvedRecoveryTransport&&
        this.travelMethod!=="walking"&&!transferPlan?.hasTransitions){
      const worldMethod=methods.find(item=>item.id===this.travelMethod);
      const method=worldMethod&&this.effectiveTransportMethod(worldMethod,availability);
      if(method){
        if(this.transportArrangement==="hire"&&!availability.offers.has(method.id))
          this.transportArrangement="owned";
        if(!method.overtimeEnabled&&this.transportOperation==="overtime"||
           !method.continuousEnabled&&this.transportOperation==="continuous")
          this.transportOperation="normal";
        if(this.transportArrangement==="hire"){
          const offer=availability.offers.get(method.id);
          const note=el("small","Service offered at "+(offer?.checkpointName??"the departure checkpoint")+". Planning estimate only; no booking or payment occurs.");
          note.style.cssText="opacity:.8;";
          body.append(note);
        }
      }
    }
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
    if(pendingNativeReview){
      const pending=pendingNativeReview.pendingNativeMove;
      const checkpointLabel=Number.isSafeInteger(pending.checkpointIndex)?
        String(pending.checkpointIndex+1):"unknown";
      body.appendChild(renderTransportAdvisory(
        "The approved "+pendingReviewMethodName+" Journey is blocked at native " +
        "checkpoint "+checkpointLabel+" (operation "+
        (pending.operationId??"unverified")+"). " +
        "The Journal has not confirmed that movement. Review the token position, " +
        "World time and saved checkpoint before continuing; no new method, fare " +
        "or travel is authorized."));
    }
    if(recoveredPlanError)body.appendChild(renderTransportAdvisory(
      "Approved Journey cannot continue yet: "+recoveredPlanError));
    const savedTargets=this.travelSession?.journeyRecord?.routeTargets??
      this.recoveryRecord?.routeTargets;
    if(game.user?.isGM&&savedTargets)
      body.appendChild(renderJourneyTargets(savedTargets));
    if(this.recoverableJourney&&!this.travelSession&&!this.recoveryRecord){
      const recovery=el("div");
      recovery.style.cssText="border:1px solid #b18b54;border-radius:8px;padding:.75rem;display:flex;flex-wrap:wrap;align-items:center;gap:.7rem;";
      const description=el("span","A saved Atlas journey is available. Recover its destination from the party token's current location.");
      description.style.cssText="flex:1;min-width:12rem;font-size:.85em;";
      const recover=el("button","Recover Saved Journey");
      recover.type="button";
      recover.title="Recalculate the remaining journey from the party token without moving it";
      if(pendingNativeReview){
        description.textContent="Saved Journey requires GM checkpoint review. " +
          "Its approved transportation and Journal are preserved; " +
          "automatic recovery is not yet safe.";
        recover.disabled=true;
        recover.title="Native movement is unconfirmed; review the Journal before recovery";
      }
      recover.addEventListener("click",()=>{
        try{this.recoverSavedJourney();}
        catch(error){ui.notifications.warn(error.message||String(error));}
      });
      recovery.append(description,recover);
      body.appendChild(recovery);
    }
    if(pendingNativeReview){
      // No Walking-based summary, fare, route Directions or enabled Travel
      // control may be shown while the saved native movement is ambiguous.
      root.append(body,renderNavigationFooter(this,{partyMode,pendingNativeReview:true}));
      return root;
    }
    const {sceneUnit,travel}=this.resolveTravel();
    const speed=Number.isFinite(approvedActiveLeg?.speedPerHour)&&
      approvedActiveLeg.speedPerHour>0?approvedActiveLeg.speedPerHour:travel.speed;
    // Native Scene units remain authoritative for routing, timing and movement.
    // Only presentation is converted to the World Atlas measuring preference.
    const showDistance=amount=>atlasFormatMeasure(atlasDisplayDistance(amount,sceneUnit));
    const showSpeed=amount=>atlasFormatMeasure(atlasDisplaySpeed(amount,sceneUnit));
    const travelSource=approvedActiveTransport?
      `${approvedActiveTransport.methodName} (approved ${approvedActiveTransport.arrangement} Journey leg) · ${showSpeed(speed)}`:
      travel.source==="group-method"?
      `${travel.methodLabel} (party-owned convoy; slowest matching resource) · ${showSpeed(speed)}`:
      travel.source==="atlas-method"?
      `${travel.methodLabel} (World transportation preset) · ${showSpeed(speed)}`:
      travel.source==="party" ?
      `${travel.actorName} · ${travel.pace} pace · ${showSpeed(speed)}` :
      `Atlas default · ${showSpeed(speed)}`;
    const methodAssessment=this.assessTravelMethod();
    const repeatingCheckpoint=isRepeatedArrivalCheckpoint(this.recoveryRecord,
      transferPlan?.legs[0]?.arrivalCheckpoint);
    const assistedLegReady=Boolean(transferPlan?.hasTransitions&&
      !this.pendingTransfer&&this.sourceMode==="party"&&
      transferPlan.legs[0]?.selectedOption&&
      !transferPlan.legs[0]?.errors?.length&&
      transferPlan.legs[0]?.arrivalCheckpoint&&
      transferPlan.legs[0]?.transferValid&&!repeatingCheckpoint);
    if(repeatingCheckpoint&&!this.travelSession){
      body.appendChild(renderRepeatedCheckpointNotice(
        transferPlan.legs[0].arrivalCheckpoint.name));
    }
    if(!approvedActiveTransport&&!approvedRecoveryTransport&&
        this.travelMethod!=="walking"&&!transferPlan?.hasTransitions){
      body.appendChild(renderTransportAdvisory(methodAssessment.reason??
        "Transport planning only."));
    }
    if(!approvedActiveTransport&&!approvedRecoveryTransport&&
        this.travelMethod!=="walking"&&!transferPlan?.hasTransitions &&
        this.transportArrangement!=="hire" &&game.system?.id==="dnd5e" &&
        !["coach-hire","ship-passage"].includes(this.travelMethod)){
      // Show capacity as a read-only advisory; non-walking guided movement is
      // still forbidden until a GM authorizes checkpoint boarding.
      const selectedMethod=methods.find(item=>item.id===this.travelMethod);
      try{
        const party=readPartyExploration(this.scene);
        const group=party.enabled?this.scene?.tokens?.get?.(party.tokenId)?.actor:null;
        if(group?.type==="group"&&selectedMethod?.surface){
          const roster=projectGroupTransportation(group,readGroupTransportation(game.settings),methods);
          const capacity=groupMethodCapacityStatus(roster,selectedMethod);
          const capacityDescription=roster.travelers+" traveler(s); "+
            capacity.seats+" available "+selectedMethod.surface+" seat(s). "+
            (capacity.missing?capacity.missing+" additional seat(s) needed. ":
              capacity.sufficient?"Capacity meets party size. ":"")+
            (capacity.unknown?"Some transport capacities are not specified. ":"")+
            (roster.unclassified?roster.unclassified+" NPC role(s) still need GM review. ":"")+
            (capacity.matched?"Availability does not mean the party has boarded.":
              "No matching Group resource. Assign an owned mount or vehicle to this method.");
          body.appendChild(renderTransportCapacity({
            description:capacityDescription,warning:Boolean(capacity.missing),
            needsReview:Boolean(capacity.missing||roster.unclassified),
            onReview:()=>{
              try{openAtlasGroupTransportation(group.id);}catch(error){
                globalThis.ui?.notifications?.error?.(error.message??String(error));
              }
            },onRefresh:()=>void this.render()
          }));

        }
      }catch(error){atlasWarn("navigation","Group capacity preview unavailable",error);}
    }
    if(!approvedActiveTransport&&!approvedRecoveryTransport&&
        this.travelMethod!=="walking"&&this.result?.status==="ok"&&
        methodAssessment.compatible){
      try{
        const baseMethod=methods.find(item=>item.id===this.travelMethod);
        const method=baseMethod&&this.effectiveTransportMethod(baseMethod,availability);
        const distanceMi=convertGroupSpeed(this.result.distance,sceneUnit,"mi");
        if(method&&distanceMi!==null){
          const weighted=this.result.terrainAware?this.result.cost:this.result.distance;
          const movingHours=navigationHours(weighted,speed);
          const assignment=readPartyExploration(this.scene);
          const actor=assignment.enabled?this.scene?.tokens?.get?.(assignment.tokenId)?.actor:null;
          const roster=actor?.type==="group"?
            projectGroupTransportation(actor,readGroupTransportation(game.settings),methods):null;
          let ownedQuote=null;
          if(this.transportArrangement==="owned"&&roster){
            const capacity=groupMethodCapacityStatus(roster,method);
            if(capacity.sufficient)
              ownedQuote=groupMethodFareEstimate(roster,method,{hours:movingHours,
                distanceMi,dayHours:this.resolveTravelRules(travel).dailyHours??8});
          }
          if(this.transportArrangement==="hire"||ownedQuote){
            const normalRules=resolveNavigationTravelRules({settings:game.settings,
              systemId:game.system?.id,actorHoursPerDay:travel?.hoursPerDay});
            const normalHours=method.surface==="land"?(normalRules.dailyHours??8):8;
            const quoteArgs={arrangement:this.transportArrangement,
              operation:this.transportOperation,movingHours,distanceMi,
              travelers:roster?.travelers??1,ownedQuote,regularHours:normalHours};
            const quote=quoteTransportationService(method,{...quoteArgs,
              hireTerms:this.transportHireTerms});
            const original=this.transportArrangement==="hire"&&baseMethod?.hireEnabled?
              quoteTransportationService(baseMethod,{...quoteArgs,hireTerms:null}):null;
            const formatMoney=cp=>dndCurrencyBreakdown(cp,
              globalThis.CONFIG?.DND5E?.currencies).label;
            const disabled=Boolean(this.travelSession||this.journalStarting);
            body.append(renderTransportQuote({
              worldEstimate:original?"World preset estimate: "+
                formatMoney(original.totalCp):null,
              currentEstimate:"Current "+(quote.arrangement==="hire"?
                "hired service":"party-owned transport")+" estimate: "+
                formatMoney(quote.totalCp),
              breakdown:[
                quote.baseLabel+": "+formatMoney(quote.baseCp),
                "Paid crew: "+formatMoney(quote.crewWagesCp),
                "Overtime fare: "+formatMoney(quote.overtimeFareCp),
                "Overtime labor: "+formatMoney(quote.overtimeCrewCp)
              ].filter(Boolean).join(" · "),
              operatingSummary:quote.travelDays+" operating day(s) at "+
                quote.dailyHours+"h/day, "+quote.extraHours.toFixed(1)+
                " overtime hour(s), "+quote.units+" transport unit(s). "+
                (this.transportArrangement==="hire"?
                  "Checkpoint availability listed; booking not confirmed. ":"")+
                "No currency is deducted.",
              overrides:Boolean(this.transportJourneyOverrides&&
                Object.keys(this.transportJourneyOverrides).length),disabled,
              onReset:()=>{
                this.transportJourneyOverrides=null;
                this.calculateRoute(this.canvasProvider(),this.atlasProvider(this.scene));
                this.draw();void this.render(true);
              }
            }));
          }
        }
      }catch(error){
        atlasWarn("navigation","Transport service preview unavailable",error);
        body.append(renderTransportAdvisory("Transport cost estimate unavailable: "+
          (error.message??String(error))));
      }
    }
    const help=el("p",partyMode?
      "Atlas reads Point A from the assigned party token's Scene location. Click the map for B; Alt/Option+click changes B. Refresh location after moving the token.":
      "After choosing A and B, ordinary map clicks leave the route unchanged. Shift+click sets Point A; Alt/Option+click sets Point B.");
    help.style.cssText="margin:0;font-size:.8em;opacity:.75;line-height:1.35;";
    body.appendChild(help);
    if(this.pendingTransfer){
      const atDestination=isJourneyDestinationCheckpoint(this.recoveryRecord,
        this.pendingTransfer.checkpoint,this.scene.grid.size);
      body.append(renderCheckpointArrivalPrompt({
        checkpointName:this.pendingTransfer.checkpoint.name,atDestination}));
    }
    if(transferPlan?.hasTransitions&&!this.pendingTransfer){
      const section=createNavigationTransferSection({
        recovered:Boolean(transferPlan.legs[0]?.recovered)});
      const formatMoney=cp=>dndCurrencyBreakdown(cp,
        globalThis.CONFIG?.DND5E?.currencies).label;
      const leg=transferPlan.legs[0];
      if(leg){
        const card=createNavigationTransferLegCard(leg);
        if(leg.recovered&&this.recoveryRecord?.legs?.at(-1)?.transport?.operation==null&&
            ["water","air"].includes(leg.surface)&&
            leg.selectedOption?.method?.kind==="vehicle"){
          card.append(...renderRecoveredVoyageOperation({
            operation:leg.operation,
            disabled:Boolean(this.travelSession||this.journalStarting),
            onChange:value=>{
              this.recoveryOperationOverride=value;
              void this.render(true);
            }
          }));
        }
        card.append(renderNavigationTransferRoadNames(leg.roadNames));
        card.append(renderCurrentTransferMethodSelector({
          options:leg.options,selectedValue:leg.selectedValue,
          disabled:Boolean(this.travelSession||this.journalStarting||leg.recovered),
          editable:Boolean(!leg.recovered&&leg.selectedOption&&
            leg.selectedOption.method?.id!=="walking"),
          onChange:value=>{
            if(this.travelSession||this.journalStarting)return;
            this.transferSelections[0]=value;
            delete this.transferLegOverrides[0];
            void this.render(true);
          },
          onEdit:()=>void this.editTransportationLeg(0)
            .catch(error=>globalThis.ui?.notifications?.error?.(error.message??String(error)))
        }));
        card.append(...renderNavigationTransferLegOutcome({
          estimateLabel:leg.hours!==null&&leg.costCp!==null?
            showDistance(leg.distance)+" · "+
            formatNavigationDuration(leg.hours,24)+" moving · "+
            formatMoney(leg.costCp)+" estimated cost":null,
          narration:leg.narration,errors:leg.errors,
          arrivalCheckpointName:leg.arrivalCheckpoint?.name??null}));
        section.append(card);
      }
      if(transferPlan.legs.length>1){
        section.append(renderNavigationLaterLegsPreview(transferPlan.legs.slice(1)));
      }
      const current=transferPlan.legs[0];
      section.append(el("strong",current?.errors.length?
        "Choose a valid method and confirm the transfer before this leg can be estimated.":
        current?.hours!==null?
          "Current leg: "+formatNavigationDuration(current.hours,24)+" moving · "+
            formatMoney(current.costCp)+" estimated. Later legs are undecided.":
          "Current leg estimate pending."));
      body.append(section);
    }
    if (this.result?.status === "ok") {
      const metrics=[];
      const metric=(label,value)=>metrics.push({label,value});
      const activeLeg=transferPlan?.hasTransitions?transferPlan.legs[0]:null;
      metric(activeLeg?"Current Leg Distance":"Distance",
        showDistance(activeLeg?.distance??this.result.distance));
      let tripExplanation=null;
      try{
        const weighted=this.result.terrainAware?this.result.cost:this.result.distance;
        const hours=activeLeg?activeLeg.hours:approvedActiveTransport?
          this.travelSession.schedule.travelHours:navigationHours(weighted,speed);
        metric(activeLeg?"Current Leg Time":"Travel Time",
          hours===null?"Choose method":formatGuidedWorldTime(Math.round(hours*3600)));
        const rules=approvedActiveTransport?
          this.travelSession.schedule.rules:this.resolveTravelRules(travel);
        const schedule=approvedActiveTransport?this.travelSession.schedule:
          this.travelMethod==="walking"&&this.journeySchedule&&
          Math.abs(this.journeySchedule.travelHours-hours)<1e-5?
          this.journeySchedule:null;
        const plan=hours===null?null:schedule?.estimate??
          estimateNavigationTotalTrip(hours,rules);
        const activeContinuous=activeLeg?.operation==="continuous";
        const activeDays=hours>0?Math.ceil(Math.max(0,hours-1e-7)/8):0;
        const activeElapsed=hours===null?null:hours+
          (activeContinuous?0:Math.max(0,activeDays-1)*16);
        metric(activeLeg?"Current Leg Total":"Total Trip",
          activeLeg?(activeElapsed===null?"Choose method":
            formatNavigationDuration(activeElapsed,24)):
            formatNavigationDuration(plan.totalHours,24));
        const activeMethod=methods.find(method=>method.id===this.travelMethod);
        const transportPreview=this.travelMethod!=="walking"&&
          ["mount","vehicle"].includes(activeMethod?.kind)&&rules.dailyHours!==null;
        const explanation=approvedActiveTransport?
          "Confirmed current leg: "+approvedActiveTransport.methodName+" ("+
            approvedActiveTransport.arrangement+"). " +
            "Movement and remaining time use its saved approved speed; "+
            "no additional boarding or payment is implied by this preview.":
          transferPlan?.hasTransitions?
          "Only the current stretch is estimated. Later transport decisions are made at checkpoints. "+
          (activeLeg?.operation==="continuous"?
            "This vessel operates continuously. Passenger rests may overlap sailing time without stopping the vessel or adding duplicate World time.":
            "Standard travel estimates allow 8 hours/day with 16 hours overnight downtime; actual stops remain GM decisions."):
          transportPreview?
          "Transport service preview ("+this.transportOperation+"): "+
          rules.dailyHours+"h travel/day, "+rules.overnightHours+
          "h overnight downtime; "+plan.overnights+
          " overnight stop(s) planned. "+
          (this.transportOperation==="overtime"?
            "Extra operating hours may call for fatigue checks; Atlas does not apply exhaustion. ":
            this.transportOperation==="continuous"?
            "24h operation requires the GM to confirm capable crew or magic. ":"")+
          "Guided vehicle movement, boarding and payments are not automated.":
          rules.dailyHours===null?
          "Total Trip currently counts movement only; select D&D or Custom rules in Module Settings to plan rests.":
          "Plan: "+rules.dailyHours+"h travel/day, "+rules.overnightHours+
          "h overnight downtime (including rest); "+plan.overnights+
          " overnight stops remaining."+
          (plan.breakHours?" "+formatGuidedWorldTime(Math.round(plan.breakHours*3600))+
            " of confirmed breaks included.":"")+
          " The GM's rest or forced-travel choices update this estimate.";
        tripExplanation=explanation;
      }catch(error){metric("Travel Time","Unavailable");metric("Total Trip","Unavailable");}
      const summary=renderNavigationSummaryMetrics({metrics,
        explanation:tripExplanation,
        progressPercent:this.travelSession||this.travelProgress>0?
          this.travelProgress:null});
      body.append(...summary.nodes);
      this.travelProgressUI=summary.progressUI;
      if(summary.timeUI){
        // The full multi-surface route is only a preview. Its distance must not
        // replace the checkpoint-clipped native journey's timing projection.
        const activeGuidedLeg=this.travelSession?.transportLeg;
        const progressHours=activeGuidedLeg?this.travelSession.schedule.travelHours:
          navigationHours(this.result.terrainAware?this.result.cost:
            this.result.distance,speed);
        this.journeyTimeUI={travelHours:progressHours,
          plan:estimateNavigationTotalTrip(progressHours,
            activeGuidedLeg?this.travelSession.schedule.rules:this.resolveTravelRules(travel)),
          ...summary.timeUI};
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
          `Continue March: +1h moving (roughly ${showDistance(routeAverage)} on this route).`+
            (rules.forcedMarch!=="custom"?` DC ${10+upcomingExtra} Constitution save afterward (GM adjudicates).`:"")
        ];
        body.appendChild(renderDailyTravelPrompt(options));
      }
      const clockAllowed=readNavigationWorldClockSetting(game.settings);
      const clockHint=clockAllowed?
        "Foundry World time advances for confirmed movement and GM-approved breaks. Actor rests and exhaustion remain manual; change the clock setting in Module Settings.":
        "Foundry World time stays unchanged. Planned breaks are still counted in Total Trip; enable clock advancement in Atlas Module Settings.";
      let playbackLabel=null;
      try{
        if(transferPlan?.hasTransitions||approvedActiveTransport)
          throw Error("Use the active guided leg's confirmed playback state.");
        const playback=calculateGuidedPlayback({route:this.result,travel,
          paths:navigationCanvasLegPaths(this.canvasProvider(),this.atlasProvider(this.scene),this.result),
          gridSize:this.scene?.grid?.size,
          secondsPerHour:readGuidedPlaybackSetting(game.settings)});
        playbackLabel="Token playback: about "+formatPlaybackDuration(playback.durationSeconds)+" "+
          "("+playback.secondsPerHour+" real seconds per in-game travel hour). "+
          "Playback speed is visual only and does not change travel hours.";
      }catch{
        // Invalid/missing canvas geometry must not conceal the route summary.
      }
      const status=renderNavigationSummaryStatus({clockHint,
        worldTimeStatus:this.travelSession?.clock||this.worldTimeAdvancedSeconds>0?
          this.worldTimeStatus():null,
        speedSource:transferPlan?.hasTransitions?null:"Speed: "+travelSource,
        playbackLabel,terrainCostLabel:this.result.terrainAware?
          "Terrain-weighted distance: "+showDistance(this.result.cost)+"-equivalent":null});
      body.append(...status.nodes);
      this.worldTimeUI=status.worldTimeUI;
      const calculation=this.result.terrainWarning ||
        (approvedActiveTransport?
          "The active Journey uses its saved GM-approved transport and operating speed. " +
          "Only verified native movement and Journal checkpoints affect recovery; " +
          "this view never books, pays for, or replays travel.":
        transferPlan?.hasTransitions?
          "Every leg uses its selected method's speed, checkpoint offer, crew and upkeep settings. The route uses authored surfaces; transfers require checkpoints. No automatic payments or movement.":
        (this.travelMethod!=="walking"?
          "Transport planning uses physical route distance and the GM's method speed. " +
          "Native Walk/Swim cost Behaviors are not transport costs; transfer points and mode-specific rests are upcoming betas.":
          this.result.terrainAware?
          "Terrain-weighted distance applies the applicable Region movement cost first, " +
          "then the road's travel preset where no Region applies. " +
          "Overlapping Regions follow GM priority; short checkpoint Regions are included. " +
          "Travel time is an estimate and never changes native Token movement.":
          "No compatible terrain cost was available, so travel time uses physical distance."));
      const baseSteps=transferPlan?.hasTransitions?
        buildNavigationSteps(this.result.legs.slice(0,
          (transferPlan.legs[0]?.lastRouteLeg??0)+1),
          id=>this.atlasProvider(this.scene).roads.find(road=>road.id===id)?.name??"Road"):
        this.itinerary?.directions??buildNavigationSteps(this.result.legs,
          id=>this.atlasProvider(this.scene).roads.find(road=>road.id===id)?.name??"Road");
      const guidedTimeline=this.travelSession?.transportLeg;
      const journeyHours=guidedTimeline?this.travelSession.schedule.travelHours:
        navigationHours(this.result.terrainAware?this.result.cost:
          this.result.distance,speed);
      const journeySpeed=guidedTimeline?
        (guidedTimeline.terrainAware?guidedTimeline.cost:guidedTimeline.distance)/journeyHours:
        speed;
      const steps=this.journeySchedule?.events?.length?
        annotateJourneyDirections(baseSteps,this.journeySchedule.events,{
          travelHours:journeyHours,speed:journeySpeed,
          terrainAware:Boolean(guidedTimeline?.terrainAware??this.result.terrainAware)}):baseSteps;
      const rows=steps.map(step=>{
        if(step.kind==="journey-event"){
          const timeContext="After "+formatNavigationDuration(step.atHours,24)+
            " on this leg"+(step.todayHours!==null?
              " · "+formatNavigationDuration(step.todayHours,24)+" traveled today":"");
          return {kind:"journey-event",label:step.label,
            marker:step.action==="continue"?"➜":"☕",
            detail:step.hours?
              formatNavigationDuration(step.hours,24)+" "+
                (step.action?.endsWith("-underway")?
                  "rest aboard while underway":"downtime")+" · "+timeContext:
              "One extra travel hour approved · "+timeContext};
        }
        return {kind:"direction",direction:step.direction,instruction:step.instruction,
          info:showDistance(step.distance)+
            (transferPlan?.hasTransitions?" · See per-leg time above":" · "+
              formatGuidedWorldTime(Math.round(navigationHours(
                this.result.terrainAware?step.cost:step.distance,speed)*3600))),
          surface:[step.terrain==="Unspecified terrain"?null:step.terrain,
            step.regionName&&step.regionName!==step.terrain?step.regionName:null]
            .filter(Boolean).join(" · ")};
      });
      body.append(...renderNavigationDirections({calculation,
        transfer:Boolean(transferPlan?.hasTransitions),
        arrivalCheckpointName:transferPlan?.legs[0]?.arrivalCheckpoint?.name??null,
        rows}));
    } else {
      const hint=el("p",this.pendingTransfer?
        (this.isAtJourneyDestination()?
          "Complete the saved Journey here, or Continue to choose a new onward destination.":
          "Continue from this checkpoint toward the saved journey destination.") :
        this.result?.status==="ok"?
          `Travel estimates will use ${travelSource}.`:
          "Choose Point B to see available transportation and journey estimates.");
      hint.style.cssText="margin:0;opacity:.8;font-size:.9em;";body.appendChild(hint);
    }
    root.append(body,renderNavigationFooter(this,{partyMode,transferPlan,
      methodAssessment,assistedLegReady,repeatingCheckpoint}));
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
