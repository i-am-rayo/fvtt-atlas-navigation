import {checkpointDestinationControl} from "./navigation-checkpoint-destination.js";
import {createNavigationMapPickPrompt} from "./navigation-map-pick-prompt.js";
import { MODULE_ID,readAtlas } from "./atlas-storage.js";
import { toAtlasPoint, toCanvasPoint } from "./road-coordinates.js";
import { calculateSceneRoadRoute } from "./navigation-foundry.js";
import { roadStrokeSpans } from "./road-appearance.js";
import { drawNavigationLine, drawNavigationMarker } from "./navigation-graphics.js";
import { navigationCanvasLegPaths } from "./navigation-render-path.js";
import {captureApprovedJourneyPath,assessApprovedRoutePosition} from "./navigation-approved-path.js";
import { createGuidedTokenWaypoints } from "./navigation-token-travel.js";
import { partyTokenCanvasCenter } from "./navigation-party-origin.js";
import { planGuidedTravelChunks,waitForTokenTravelAnimation,MAX_GUIDED_CHUNKS,
  coalesceSubpixelTravelChunks,hasNativePixelDisplacement }
  from "./navigation-movement-lifecycle.js";
import {planNativeCheckpointPath,anchorNativeTokenWaypoints,
  describeNativeCheckpointSources,NATIVE_CONTINUOUS_CHECKPOINT_SECONDS}
  from "./navigation-native-movement-plan.js";
import {coordinateNativeTokenMovement}
  from "./navigation-native-movement-coordinator.js";
import {validatePendingNativeMove,assessPendingNativeMove,assessBoundedNativeArrival,
  captureNativeArrivalEvidence,assessBoundedNativePartial}
  from "./navigation-native-movement-reconciliation.js";
import { GuidedTravelDayTracker,estimateNavigationTotalTrip,
  splitGuidedChunkAtDistance,MAX_GUIDED_REST_EVENTS,MAX_GUIDED_TRAVEL_EVENTS }
  from "./navigation-travel-day.js";
import { annotateJourneyDirections,projectJourneyTiming }
  from "./navigation-journey-timeline.js";
import { resolveNavigationTravelRules } from "./navigation-rules-profile.js";
import { GuidedJourneyClock, readNavigationWorldClockSetting, formatGuidedWorldTime }
  from "./navigation-world-clock.js";
import { calculateGuidedPlayback,formatPlaybackDuration,readGuidedPlaybackSetting,validatePlaybackSetting }
  from "./navigation-playback.js";
import { NAVIGATION_SPEED_SETTING, DEFAULT_NAVIGATION_SPEED,
  navigationHours, formatNavigationDuration }
  from "./navigation-time.js";
import { buildNavigationSteps } from "./navigation-instructions.js";
import {contextualDestinationRoadName} from "./navigation-road-naming.js";
import { navigationPointIntent } from "./navigation-selection.js";
import { createNavigationItinerary } from "./navigation-itinerary.js";
import { REGION_ROUTING_ORDER_FLAG } from "./navigation-terrain.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import { resolveNavigationTravelSpeed,convertGroupSpeed } from "./navigation-party-speed.js";
import { availableNavigationTravelMethods,resolveNavigationMethodTravel,
  assessNavigationMethodRoute } from "./navigation-travel-method.js";
import { projectTransportationRouteLegs,transportationLegSelection,
  describeTransportationLeg,summarizeTransportationOperatingSchedule }
  from "./navigation-transport-transitions.js";
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
import { atlasDisplayDistance,atlasDisplaySpeed,atlasFormatMeasure,
  atlasSceneSpeedFromDisplay }
  from "./navigation-measure-units.js";
import { readGroupTransportation,projectGroupTransportation,
  groupMethodCapacityStatus,groupMethodFareEstimate,groupMethodResourceInventory }
  from "./navigation-group-transport.js";
import { dndCurrencyBreakdown,mixedTransportFareBreakdown } from "./navigation-currency.js";
import { resolveTransportationOperation,draftTransportationOperation,quoteTransportationService,
  assessHiredTransportAvailability }
  from "./navigation-transport-service.js";
import { openAtlasGroupTransportation } from "./navigation-group-transport-settings.js";
import { offersAtOrigin,checkpointOffers,saveCheckpointOffers,
  checkpointOfferMethod,transportationMethodOverrideDelta }
  from "./checkpoint-transportation.js";
import { TRAVEL_PRESET_SETTING,validateTravelPresets } from "./travel-preset-model.js";
import { atlasDebug,atlasWarn } from "./atlas-debug.js";
import {publishAtlasJourneyAnnouncement} from "./atlas-announcement-runtime.js";
import { navigationJourneyTitle,journeyWorldStamp,verifiedJourneyDestinationName } from "./navigation-journey-title.js";
import { createJourneyRecord,checkpointJourneyRecord,resumeJourneyRecord,
  validateJourneyRecord,eligibleJourneyRecord,isUnfinishedJourneyLeg,
  journeyRecoveryRouteDestination,findRecoverableJourney,saveJourneyJournal,
  JOURNEY_JOURNAL_FLAG } from "./navigation-journey-journal.js";
import { journeySummaryDue } from "./navigation-journey-state-store.js";
import {mayCheckpointJourneyStatus,assessJourneyTeardown,
  mayAttemptCanvasJourneyRecovery,classifyRecoveredJourneyBoundary}
  from "./navigation-journey-lifecycle.js";
import {canvasRecoveryAnnouncementType} from "./navigation-canvas-announcement.js";
import {createVisualRestHold,visualRestDurationMs}
  from "./navigation-rest-playback.js";
import {buildJourneyTargets,assessJourneyAnchor,captureJourneyAnchor,
  nextJourneyTarget,isCheckpointBoundContinuation} from "./navigation-route-targets.js";
import {renderNavigationFooter} from "./navigation-footer.js";
import {NAVIGATION_STAGES,resolveNavigationStage} from "./navigation-stage-model.js";
import {createNavigationStageShell,renderNavigationStageIntro,
  renderNavigationCompletedOverview} from "./navigation-stage-view.js";
import {renderNavigationTravelMethodSelector,renderNavigationTravelMethodButtons}
  from "./navigation-selection-view.js";
import {renderRecoveredVoyageOperation,renderCurrentTransferMethodSelector}
  from "./navigation-transfer-controls-view.js";
import {renderTransportAdvisory,renderTransportCapacity,renderTransportQuote}
  from "./navigation-transport-summary-view.js";
import {renderNavigationSummaryMetrics,renderNavigationSummaryStatus}
  from "./navigation-summary.js";
import {renderNavigationDirections} from "./navigation-directions-view.js";
import {renderNavigationPlannerTabs,renderNavigationJourneyTabs}
  from "./navigation-planner-tabs-view.js";
import {renderNavigationActivePlayback} from "./navigation-active-playback-view.js";
import {liveJourneyPlayback,canAdjustLiveJourneyVisuals,expectedAdditionalTravelBreaks}
  from "./navigation-live-playback.js";
import {renderNavigationTravelRoster,renderNavigationPaceChoice}
  from "./navigation-traveler-deck-view.js";
import {suggestedTravelAssignments} from "./navigation-travel-allocation.js";
import {describeConfirmedTravelers} from "./navigation-journey-manifest.js";
import {isMixedLandTransport,mixedLandTransportMethod} from "./navigation-transport-journal.js";
import {planWalkingCargoConvoy,validateWalkingCargoConvoy} from "./navigation-mixed-convoy.js";
import {renderWalkingCargoControls} from "./navigation-mixed-convoy-view.js";
import {planMixedLandConvoy,validateMixedLandConvoy}
  from "./navigation-mixed-land.js";
import {planAggregateLandConvoy,validateAggregateLandConvoy}
  from "./navigation-theater-convoy.js";
import {renderNavigationMixedLandControls} from "./navigation-mixed-land-view.js";
import {projectPartyTravelSelection,describeTravelMethodCapacity,partyTravelerRoster}
  from "./navigation-party-selection.js";
import {createJourneyParticipation,priorJourneySelection}
  from "./navigation-journey-participation.js";
import {groupLivestockResources,countJourneyLivestock,planJourneyLivestock,
  suggestedLivestockBoarding,assertRecoveredLivestock,projectAccompanyingLivestock}
  from "./navigation-journey-livestock.js";
import {renderJourneyLivestockBoarding} from "./navigation-livestock-view.js";
import {navigationRouteMarkers,navigationDestinationCheckpoint} from "./navigation-direction-summary.js";
import {renderNavigationPlaybackControls} from "./navigation-playback-controls-view.js";
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
    position: { width: 900, height: 665, left: 70, top: 50 }
  };

  constructor({ canvasProvider = () => globalThis.canvas,
    routeCalculator=calculateSceneRoadRoute,atlasProvider=readAtlas,
    atlasPoint=toAtlasPoint,
    journeyJournalStore={save:saveJourneyJournal,find:findRecoverableJourney},
    announcementPublisher=publishAtlasJourneyAnnouncement,
    restHoldFactory=createVisualRestHold,
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
    this.announcementPublisher=announcementPublisher;
    this.restHoldFactory=restHoldFactory;
    this.scene = null;
    this.sourceMode = "map";
    this.travelMethod = "walking";
    this.transportArrangement="owned";
    this.transportOperation="normal";
    this.transportHireTerms=null;
    this.transportHireDenomination=null;
    this.transportJourneyOverrides=null;
    this.convoyEnabled=false;
    this.convoyCargoQuantities={};
    this.convoyPace=null;
    this.mixedKeys=[];
    this.mixedMethodOverrides={};
    this.mixedAssignments={};
    this.mixedRiderCounts={};
    this.mixedUnits={};
    this.livestockDecisions={};
    this.transferSelections={};
    this.transferLegOverrides={};
    this.transferLegOperations={};
    this.pendingTransfer=null;
    this.start = null;
    this.end = null;
    this.destinationMode="checkpoint";
    this.selectedCheckpointId=null;
    this.mapPickActive=false;
    this.mapPickPrompt=null;
    this.mapPickPrevious=null;
    this.playbackSecondsPerHourOverride=null;
    this.directionsExpanded=false;
    this.navigationTab="travel";
    this.journeyTab="journey";
    this.partySelectionMode="all";
    this.partySelectedIds=[];
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
    this.suspendedNativeSession=null;
    this.autoResumeAttempts=new Map();
    this.canvasTeardownClose=Promise.resolve();
    this.windowRestorePending=null;
    this.canvasRecoveryNotice=null;
    this.canvasRecoveryContinuing=null;
  }

  get active() { return Boolean(this.scene); }

  activate() {
    if(this.suspendedNativeSession)
      throw Error("Atlas is waiting for the submitted native movement and Journal writes to settle.");
    const view = this.canvasProvider();
    if (!game.user?.isGM || !view?.ready || !view.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may navigate an active Atlas Scene.");
    }
    this.stop();
    this.scene = view.scene;
    this.destinationMode="checkpoint";
    this.selectedCheckpointId=null;
    this.mapPickActive=false;
    this.mapPickPrompt=null;
    this.mapPickPrevious=null;
    this.playbackSecondsPerHourOverride=null;
    this.directionsExpanded=false;
    this.navigationTab="travel";
    this.partySelectionMode="all";
    this.partySelectedIds=[];
    this.travelMethod="walking";
    this.transportArrangement="owned";
    this.transportOperation="normal";
    this.transportHireTerms=null;
    this.transportHireDenomination=null;
    this.transportJourneyOverrides=null;
    this.convoyEnabled=false;
    this.convoyCargoQuantities={};
    this.convoyPace=null;
    this.mixedKeys=[];
    this.mixedMethodOverrides={};
    this.mixedAssignments={};
    this.mixedRiderCounts={};
    this.mixedUnits={};
    this.livestockDecisions={};
    this.transferSelections={};
    this.transferLegOverrides={};
    this.transferLegOperations={};
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

  /** Modeless preview choice; existing World/Journal state remains authoritative. */
  beginMapDestinationPick(){
    if(!this.scene||!this.start||this.mapPickActive||
        this.travelSession||this.journalStarting||this.recoveryRecord||
        this.recoverableJourney||this.pendingTransfer||this.completedRecord||
        this.completedRoute)return false;
    const view=this.canvasProvider();
    if(!globalThis.game?.user?.isGM||!view?.ready||
        view.scene?.id!==this.scene.id||
        !this.scene.canUserModify?.(game.user,"update"))return false;
    this.mapPickPrevious={mode:this.destinationMode,
      checkpointId:this.selectedCheckpointId};
    this.mapPickActive=true;
    this.destinationMode="map";
    try{
      const prompt=createNavigationMapPickPrompt({
        onCancel:()=>this.cancelMapDestinationPick()});
      this.mapPickPrompt=prompt;
      void this.minimize().then(()=>{
        if(this.mapPickActive&&this.mapPickPrompt===prompt)
          return prompt.render(true);
      }).catch(error=>{
        this.cancelMapDestinationPick();
        globalThis.ui?.notifications?.warn?.(error.message??String(error));
      });
      return true;
    }catch(error){
      this.cancelMapDestinationPick();
      globalThis.ui?.notifications?.warn?.(error.message??String(error));
      return false;
    }
  }

  cancelMapDestinationPick(){
    if(!this.mapPickActive)return;
    this.mapPickActive=false;
    const prompt=this.mapPickPrompt;
    this.mapPickPrompt=null;
    if(this.mapPickPrevious)this.destinationMode=this.mapPickPrevious.mode;
    this.mapPickPrevious=null;
    void prompt?.close?.();
    if(this.active)void this.maximize().catch(error=>
      atlasWarn("navigation","Could not restore Navigation from map selection",error));
  }

  completeMapDestinationPick(){
    if(!this.mapPickActive)return;
    this.mapPickActive=false;this.mapPickPrevious=null;
    const prompt=this.mapPickPrompt;
    this.mapPickPrompt=null;
    void prompt?.close?.();
    if(this.active)void this.maximize().catch(error=>
      atlasWarn("navigation","Could not restore Navigation after map selection",error));
  }

  /** Presentation-only names. Keep stored road names and journey targets authoritative. */
  roadNaming(atlas,route,destination=this.recoveryRecord?.destination??this.end){
    const permanent=id=>atlas.roads?.find(road=>road.id===id)?.name??"Road";
    let contextual=null;
    try{
      contextual=contextualDestinationRoadName({atlas,route,destination,
        exploration:readPartyExploration(this.scene)});
    }catch{ /* Invalid or absent knowledge state: never reveal the destination. */ }
    return {roadName:permanent,
      directionRoadName:contextual?()=>contextual:permanent,
      preferRoadName:Boolean(contextual)};
  }

  /** Use one route calculation for both map-point and live party departures. */
  calculateRoute(view,atlas,{terrainAware=null}={}) {
    this.routeRevision=atlas.revision;
    // A replan may depart from another Map Marker. Never carry a local hire
    // quote from the prior route into a different departure's preview.
    this.mixedMethodOverrides={};
    this.livestockDecisions={};
    this.transferSelections={};
    this.transferLegOverrides={};
    this.transferLegOperations={};
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
        (terrainAware??(this.travelMethod==="walking"&&
           (!this.mixedKeys.length||this.mixedKeys.includes("owned|walking"))))?
           {}:{terrainAware:false});
      if(this.result?.status==="ok"){
        if(this.mixedKeys.length&&this.canDraftTravelMethods()&&
            Array.isArray(atlas.roads)&&Array.isArray(atlas.nodes)){
          const presets=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING));
          const first=projectTransportationRouteLegs(this.result,atlas,presets.presets).legs[0];
          if(first?.surface!=="land"){
            this.mixedKeys=[];this.mixedMethodOverrides={};this.mixedAssignments={};this.mixedUnits={};
            this.mixedRiderCounts={};this.convoyPace=null;
          }
        }
        this.itinerary=createNavigationItinerary({
          sceneId:this.scene.id,sceneName:this.scene.name??"",
          sceneUnits:this.scene.grid?.units??"",atlasRevision:atlas.revision,
          route:this.result,...this.roadNaming(atlas,this.result),
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

  /** Native Group roster read only; never change members for a preview. */
  partyTravelSelection(methods){
    const actor=this.getPartyToken()?.actor;
    if(game.system?.id!=="dnd5e"||actor?.type!=="group")return null;
    try{
      const roster=projectGroupTransportation(actor,
        readGroupTransportation(game.settings),methods);
      const selected=projectPartyTravelSelection(roster,{
        mode:this.partySelectionMode,ids:this.partySelectedIds
      });
      const saved=this.recoveryRecord?.legs?.at(-1)?.livestock;
      if(saved&&!isUnfinishedJourneyLeg(this.recoveryRecord)){
        // A new land leg must never use a mount that was left at the last port.
        // Explicit rejoining only changes this transient preview inventory.
        selected.previewRoster=projectAccompanyingLivestock(
          selected.previewRoster,this.livestockDecisions);
      }
      return {roster,...selected};
    }catch(error){
      atlasWarn("navigation","Party selection preview unavailable",error);
      return null;
    }
  }

  /** A combined Group explorer travels as one unit. Selection and assignment
   * are drafts only; every resource is resolved again at GM confirmation.
   */
  canDraftTravelMethods(){
    return !this.travelSession&&!this.journalStarting&&!this.recoverableJourney&&
      !this.pendingTransfer&&(!this.recoveryRecord||
        this.recoveryRecord.status==="paused"&&!isUnfinishedJourneyLeg(this.recoveryRecord));
  }

  /** Current land stretch only; later surfaces are preview, not fare inputs. */
  currentLandTransferLeg(){
    if(this.result?.status!=="ok"||!Array.isArray(this.result.legs)||!this.scene)return null;
    const atlas=this.atlasProvider(this.scene);
    if(!Array.isArray(atlas?.roads)||!Array.isArray(atlas?.nodes))return null;
    const presets=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING));
    const projected=projectTransportationRouteLegs(this.result,atlas,presets.presets);
    const first=projected.legs[0];
    return first?.surface==="land"&&(projected.hasTransitions||isCheckpointBoundContinuation({
      record:this.recoveryRecord,route:this.result,projected,gridSize:this.scene.grid?.size}))?
      first:null;
  }

  mixedLandChoices(availability=this.transportAvailability()){
    return this.mixedKeys.map(key=>{
      const [arrangement,id]=key.split("|",2);
      const world=availability.methods.find(item=>item.id===id);
      if(!world||world.surface!=="land"||
          (arrangement==="hire"&&id==="walking"))
        throw Error("Selected mixed method is unavailable for this land route.");
      if(arrangement==="owned"){
        if(id!=="walking"&&!availability.owned.has(id))
          throw Error("The Group no longer owns the selected travel method.");
        return {key,arrangement,method:{...world,...this.mixedMethodOverrides?.[key]}};
      }
      const offer=availability.offers.get(id);
      if(!offer)throw Error("Selected hired service is no longer offered at departure.");
      const method=checkpointOfferMethod({methodId:offer.methodId,
        mode:offer.mode,overrides:offer.overrides},world);
      if(!method.hireEnabled)
        throw Error("Selected hired service is no longer available.");
      return {key,arrangement,
        method:{...method,...this.mixedMethodOverrides?.[key]},
        checkpointId:offer.checkpointId,units:this.mixedUnits[key]??undefined};
    });
  }

  /** Assignments use stable Group Actor IDs and method IDs, never display text.
   * NPCs sharing a seat still count as passengers when quoted per passenger.
   */
  mixedLandPlan(walkingTravel=null){
    if(this.mixedKeys.length<2||this.sourceMode!=="party"||
        this.result?.status!=="ok")
      throw Error("Choose two compatible travel methods for the assigned Group.");
    const available=this.transportAvailability();
    const party=this.partyTravelSelection(available.all);
    if(!party||party.empty)
      throw Error("Choose at least one traveler for this Journey preview.");
    const active=new Set(party.selectedIds);
    const travelers=partyTravelerRoster(party.previewRoster)
      .filter(m=>active.has(m.id)).map(m=>{
      const original=party.previewRoster.members.find(item=>item.actorId===m.id);
      return {actorId:m.id,name:m.name,seatsNeeded:m.seats,
        passengers:Math.max(1,original?.quantity??1)};
    });
    const selected=this.mixedLandChoices(available);
    const hired=selected.map(entry=>{
      if(entry.arrangement!=="owned"||entry.method.id==="walking")return entry;
      return {...entry,resources:groupMethodResourceInventory(
        party.previewRoster,entry.method)};
    });
    const sceneUnits=this.scene?.grid?.units?.trim()||"";
    const walking=walkingTravel??this.resolveTravel({excludeConvoy:true}).travel;
    const hours=this.resolveTravelRules(walking).dailyHours??8;
    const hasWalking=selected.some(x=>x.key==="owned|walking");
    const resources=Object.fromEntries(hired.filter(m=>m.resources)
      .map(m=>[m.key,m.resources]));
    const assignments=suggestedTravelAssignments(
      travelers.map(t=>({id:t.actorId})),selected,
      this.mixedAssignments,resources);
    const leg=this.currentLandTransferLeg();
    const distance=leg?.distance??this.result.distance;
    const weighted=leg?.weightedDistance??this.result.cost;
    return planMixedLandConvoy({travelers,
      assignments,methods:hired,
      walkingSpeed:walking.speed,sceneUnits,
      routeDistance:distance,
      weightedDistance:hasWalking&&this.result.terrainAware?weighted:distance,
      distanceMi:convertGroupSpeed(distance,sceneUnits,"mi"),
      paceOverride:this.convoyPace,regularHours:hours});
  }

  /** GM edits aggregate counts only. Native personal mount assignments are read-only. */
  /** One planning step: a single method shows checkboxes; mixed methods show
   * drag/drop assignments. The submitted Journey still owns one Group token.
   */
  renderTravelersAndPace(party,availability,{disabled=false,mixedFare=null,
    singleChoice=null,transferColumns=false,mountBoard=null}={}){
    const root=el("div");
    root.style.cssText="display:grid;gap:.6rem;padding-top:.45rem;";
    const all=partyTravelerRoster(party.previewRoster);
    const picked=new Set(party.selectedIds);
    const members=all.filter(t=>picked.has(t.id));
    const sceneUnits=this.scene?.grid?.units?.trim()||"";
    const showSpeed=n=>atlasDisplaySpeed(n,sceneUnits,game.settings,game.system?.id);
    const speedUnit=n=>n==="mi/hour"?"mph":n==="km/hour"?"kph":n;
    const walkingSpeed=this.resolveTravel({excludeConvoy:true}).travel.speed;
    const mixed=!singleChoice&&this.mixedKeys.length>1;
    let options=[],resources={};
    try{
      options=singleChoice?[{key:singleChoice.value,method:singleChoice.method,
        arrangement:singleChoice.arrangement,units:1}]:
        this.mixedKeys.length?this.mixedLandChoices(availability):
        (()=>{const method=availability.methods.find(m=>m.id===this.travelMethod);
          if(!method)return [];
          const key=this.transportArrangement+"|"+this.travelMethod;
          return [{key,method,arrangement:this.transportArrangement,
            units:this.mixedUnits[key]??1}];})();
      resources=Object.fromEntries(options.filter(o=>
        o.arrangement==="owned"&&o.method.id!=="walking")
        .map(o=>[o.key,groupMethodResourceInventory(
          party.previewRoster,o.method)]));
    }catch(error){
      root.append(el("small",error.message??String(error)));return root;
    }
    const assignments=suggestedTravelAssignments(members,options,
      this.mixedAssignments,resources);
    const descriptions=options.map(entry=>{
      const method=entry.method;
      const speed=method.id==="walking"?walkingSpeed:
        convertGroupSpeed(method.speedMph,"mph",sceneUnits);
      const shown=showSpeed(speed);
      const total=resources[entry.key]?.reduce((n,r)=>
        n+r.quantity*r.capacity,0)??0;
      const hires=entry.arrangement==="hire";
      const assignedSeats=members.filter(t=>assignments[t.id]===entry.key)
        .reduce((n,t)=>n+t.seats,0);
      const minimumUnits=hires?Math.max(1,Math.ceil(
        assignedSeats/Math.max(1,method.capacity))):null;
      const count=hires?this.mixedUnits[entry.key]??minimumUnits:null;
      const fare=mixedFare?.rows.find(row=>row.key===entry.key);
      const terms=hires?[{cost:method.hireCostCp,basis:method.hireBasis,applies:method.hireApplies}]:
        (resources[entry.key]??[]).filter(r=>fare?.resourceIds.includes(r.actorId))
          .map(r=>({cost:r.method.costCp,basis:r.method.costBasis,applies:r.method.costApplies}));
      const rates=[...new Set(terms.filter(r=>r.cost>0&&r.basis!=="none")
        .map(r=>r.cost+" CP/"+(r.applies==="passenger"?"passenger":"unit")+"/"+r.basis))];
      return {key:entry.key,name:method.name,arrangement:entry.arrangement,
        showUnits:!transferColumns,
        ...(mixed&&method.id!=="walking"?{
          costLabel:fare?.label??"Estimate unavailable",
          costDetail:fare?fare.units+" unit"+(fare.units===1?"":"s")+
            (rates.length?" · "+rates.join(" + "):""):null}:{}),
        speed,speedLabel:shown.value.toFixed(2)+" "+speedUnit(shown.unit),
        capacity:method.id==="walking"?null:hires?
          count*method.capacity:total,
        minimumUnits,
        available:hires?method.hireUnlimited===false?
          method.hireQuantity:null:null};
    });
    const setIncluded=(id,include)=>{
      if(disabled)return;
      const next=new Set(party.selectedIds);
      if(include)next.add(id);else next.delete(id);
      this.partySelectionMode=next.size===all.length?"all":"selected";
      this.partySelectedIds=next.size===all.length?[]:[...next];
      this.convoyPace=null;
      void this.render(true);
    };
    root.append(renderNavigationTravelRoster({
      travelers:all,selectedIds:party.selectedIds,
      methods:descriptions,assignments,
      units:this.mixedUnits,disabled,previewOnly:party.partial,
      transferColumns,mountBoard,onInclude:setIncluded,
      onAssign:(id,key)=>{
        if(disabled||!descriptions.some(m=>m.key===key))return;
        this.mixedAssignments={...this.mixedAssignments,[id]:key};
        if(!picked.has(id))setIncluded(id,true);
        else {this.convoyPace=null;void this.render(true);}
      },
      onUnits:(key,count)=>{
        const method=descriptions.find(m=>m.key===key);
        if(!method||method.arrangement!=="hire"||
            !Number.isInteger(count)||count<1||count>100||
            method.available!==null&&count>method.available){
          globalThis.ui?.notifications?.warn?.("Invalid hired vehicle quantity.");
          void this.render(true);return;
        }
        this.mixedUnits={...this.mixedUnits,[key]:count};
        this.convoyPace=null;void this.render(true);
      }
    }));
    if(mixed){
      const speeds=descriptions.map(d=>({...d,speed:showSpeed(d.speed).value}));
      const slowestVehicle=Math.min(...descriptions.filter(d=>
        d.key!=="owned|walking").map(d=>d.speed));
      const selected=this.convoyPace===null?null:showSpeed(this.convoyPace).value;
      const choice=renderNavigationPaceChoice({
        methods:speeds,selected,unit:speedUnit(showSpeed(walkingSpeed).unit),
        maxSpeed:showSpeed(slowestVehicle).value,disabled,
        onPace:value=>{
          this.convoyPace=value===null?null:atlasSceneSpeedFromDisplay(
            value,sceneUnits,game.settings,game.system?.id,slowestVehicle);
          void this.render(true);
        }
      });
      if(choice)root.append(choice);
    }
    return root;
  }

  /** Confirm an explicit per-rider manifest and then re-read every authority:
   * roster, Scene, route, hire inventory, mounts, pricing and chosen pace.
   */
  async confirmMixedLandJourney(view,token,guidedLeg=null){
    if(!game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update"))
      throw Error("Only an authorized GM may approve mixed travel.");
    if(!this.assessTravelMethod().guided)
      throw Error(this.assessTravelMethod().reason??
        "Mixed transportation is not ready for GM confirmation.");
    const routeBefore=this.result;
    const proposed=this.mixedLandPlan();
    const shown=atlasDisplaySpeed(proposed.speedPerHour,this.scene.grid.units,
      game.settings,game.system?.id);
    const units=shown.unit==="mi/hour"?"mph":
      shown.unit==="km/hour"?"km/h":shown.unit;
    const fare=mixedTransportFareBreakdown(proposed.methods,
      globalThis.CONFIG?.DND5E?.currencies);
    const manifest=describeConfirmedTravelers(proposed);
    const content=el("div");
    content.append(el("strong","Transportation summary"));
    if(guidedLeg)content.append(el("p","Current leg to "+guidedLeg.checkpoint.name));
    const table=el("table");
    const header=el("thead"),heading=el("tr");
    for(const label of ["Method","Travelers","Units","Cost"]){
      const cell=el("th",label);cell.scope="col";heading.append(cell);
    }
    header.append(heading);table.append(header);
    const body=el("tbody");
    for(const method of proposed.methods){
      const row=el("tr"),name=el("td");
      name.append(el("strong",method.methodName));
      const assignment=manifest.find(entry=>entry.key===method.key);
      if(assignment)name.append(el("div",assignment.travelers));
      else if(method.role==="cargo")name.append(el("div","Cargo only"));
      const walking=method.role==="walking";
      row.append(name,el("td",String(method.passengers)),
        el("td",walking?"—":String(method.units)),
        el("td",walking?"—":fare.rows.find(entry=>entry.key===method.key).label));
      body.append(row);
    }
    table.append(body);content.append(table);
    const totals=el("dl");
    for(const [label,value] of [
      ["Total travelers",String(proposed.methods.reduce((n,m)=>n+m.passengers,0))],
      ["Group travel speed",shown.value.toFixed(2)+" "+units],
      ["Estimated moving time",formatNavigationDuration(proposed.movingHours,24)],
      ["Estimated transportation cost",fare.total.label]
    ])totals.append(el("dt",label),el("dd",value));
    content.append(totals);
    if(proposed.gmWalkingPaceOverride){
      const ordinary=atlasDisplaySpeed(proposed.suggestedSpeedPerHour,
        this.scene.grid.units,game.settings,game.system?.id);
      content.append(el("p","Walking pace exception: recommended "+
        ordinary.value.toFixed(2)+" "+units+", approved "+
        shown.value.toFixed(2)+" "+units+
        ". Actor movement and exhaustion statistics are not modified automatically."));
    }
    content.append(el("p","All travelers remain together as one Group. "+
      "Transportation costs are estimates; no booking, boarding, payment or Actor changes occur automatically."));
    const confirmed=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Confirm mixed-party transportation"},
      content,rejectClose:false,modal:true
    });
    if(!confirmed)return null;
    if(this.travelSession||this.journalStarting||this.pendingTransfer||
        !game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update")||
        this.scene.id!==view.scene?.id||
        this.atlasProvider(this.scene).revision!==this.routeRevision||
        this.getPartyToken()?.id!==token.id||this.result!==routeBefore||this.result?.status!=="ok")
      throw Error("Scene, party explorer or route changed during mixed travel confirmation.");
    const current=this.atlasPoint(view,this.atlasProvider(this.scene),
      partyTokenCanvasCenter(token,this.scene.grid.size));
    if(Math.hypot(current.x-this.result.start.x,
        current.y-this.result.start.y)>Math.max(.01,this.scene.grid.size/50))
      throw Error("The party moved during mixed travel confirmation. Replan the route.");
    const updated=this.mixedLandPlan();
    if(guidedLeg){
      const party=this.partyTravelSelection(this.transportAvailability().all);
      if(party?.partial||party?.empty)
        throw Error("A subset preview cannot authorize movement of the entire Group.");
      if(JSON.stringify(prepareGuidedTransportLeg(this.result,
          this.transportationTransitionPlan()?.legs[0]))!==JSON.stringify(guidedLeg))
        throw Error("The checkpoint leg changed during mixed travel confirmation.");
    }
    if(JSON.stringify(updated)!==JSON.stringify(proposed))
      throw Error("Passenger assignments, vehicle stock, speeds, fares or "+
        "World/Scene rules changed during confirmation. Review the updated Journey.");
    return validateMixedLandConvoy(updated);
  }

  /** Only an explicitly offered, per-unit, land vehicle can accompany walkers as cargo. */
  cargoConvoyChoices(availability=this.transportAvailability()){
    return [...availability.offers.values()].flatMap(offer=>{
      const world=availability.methods.find(m=>m.id===offer.methodId);
      if(!world||world.kind!=="vehicle"||world.surface!=="land")return [];
      try{
        const method=checkpointOfferMethod({methodId:offer.methodId,
          mode:offer.mode,overrides:offer.overrides},world);
        if(!method.hireEnabled||method.hireApplies!=="unit")return [];
        return [{id:method.id,name:method.name,method,
          checkpointId:offer.checkpointId,unlimited:method.hireUnlimited!==false,
          available:method.hireUnlimited===false?method.hireQuantity:null,
          speedMph:method.speedMph}];
      }catch(error){
        atlasWarn("navigation","Invalid cargo checkpoint offer",error);
        return [];
      }
    });
  }

  /** No mutation: recompute an intent from current Group, road and Map Marker data. */
  mixedConvoyPlan(walkingTravel=null){
    if(!this.convoyEnabled||this.travelMethod!=="walking")return null;
    if(this.result?.status!=="ok"||this.sourceMode!=="party")
      throw Error("A walking cargo convoy requires a calculated party road route.");
    const availability=this.transportAvailability();
    const party=this.partyTravelSelection(availability.all);
    if(!party||party.partial||party.empty)
      throw Error("Assign the complete Group explorer before selecting cargo transportation.");
    const choices=this.cargoConvoyChoices(availability);
    const selected=Object.entries(this.convoyCargoQuantities);
    if(!selected.length)throw Error("Choose at least one hired cargo vehicle.");
    const hires=selected.map(([id,units])=>{
      const choice=choices.find(c=>c.id===id);
      if(!choice)throw Error("The selected cargo vehicle is no longer offered at departure.");
      if(!Number.isInteger(units)||units<1||units>100)
        throw Error("Choose a valid whole number of hired cargo units.");
      return {method:choice.method,checkpointId:choice.checkpointId,units};
    });
    const units=this.scene?.grid?.units?.trim()||"";
    const distanceMi=convertGroupSpeed(this.result.distance,units,"mi");
    const walker=walkingTravel??this.resolveTravel({excludeConvoy:true}).travel;
    const dailyHours=this.resolveTravelRules(walker).dailyHours??8;
    return planWalkingCargoConvoy({
      travelers:partyTravelerRoster(party.previewRoster)
        .map(m=>({actorId:m.id,seatsNeeded:m.seats})),
      walkingSpeed:walker.speed,sceneUnits:units,
      routeDistance:this.result.distance,
      weightedDistance:this.result.terrainAware?this.result.cost:this.result.distance,
      distanceMi,hires,paceOverride:this.convoyPace,regularHours:dailyHours
    });
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
        const current=this.currentLandTransferLeg();
        const route=current?{...this.result,legs:this.result.legs.slice(0,current.lastRouteLeg+1)}:
          this.result;
        compatible=new Set(all.filter(method=>
          assessNavigationMethodRoute(method.id,route,atlas,catalog.presets,
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

  /** Completed/suspended Journeys retain their approved operation. A fresh
   * route follows the effective edited vehicle's continuous setting. */
  plannedTravelOperation(method){
    return isUnfinishedJourneyLeg(this.recoveryRecord)?this.transportOperation:
      draftTransportationOperation(method,this.transportOperation);
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
    const currentParty=roster?projectPartyTravelSelection(roster,{
      mode:this.partySelectionMode,ids:this.partySelectedIds}):null;
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
    const worldRules=resolveNavigationTravelRules({settings:game.settings,
      systemId:game.system?.id,actorHoursPerDay:null});
    const regularHours=worldRules.dailyHours??8;
    const normalDowntime=worldRules.overnightHours??Math.max(0,24-regularHours);
    const legs=projected.legs.map((leg,index)=>{
      const errors=[];
      const activeRoster=index===0?(currentParty?.previewRoster??roster):roster;
      if(index===0&&currentParty?.empty)
        errors.push("Choose at least one traveler for the current Journey leg.");
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
      if(index===0&&this.mixedKeys.length&&leg.surface==="land"&&
          this.canDraftTravelMethods()&&(projected.hasTransitions||checkpointContinuation)){
        let convoy=null;
        if(!leg.transferValid||!leg.arrivalCheckpoint?.id)
          errors.push("A mixed convoy needs an authored arrival checkpoint for this leg.");
        try{convoy=this.mixedLandPlan();}
        catch(error){errors.push(error.message??String(error));}
        return {...leg,options,selectedOption:convoy&&!errors.length?{
          value:"mixed-land",arrangement:"mixed",method:mixedLandTransportMethod}:null,
          selectedValue:"mixed-land",methodName:mixedLandTransportMethod.name,operation:"normal",
          dailyHours:regularHours,overnightHours:normalDowntime,
          convoy,errors,hours:errors.length?null:convoy?.movingHours??null,
          costCp:errors.length?null:convoy?.totalCp??null,
          narration:["The Group travels together to the next checkpoint."]};
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
      // An enabled 24h vehicle runs continuously unless the Journey editor
      // explicitly chose eligible overtime. Never infer this for mixed walkers.
      const inheritedOperation=draftTransportationOperation(option?.method);
      const operation=this.transferLegOperations[index]??inheritedOperation;
      let operationRules=null;
      if(option?.method?.id==="walking"){
        if(operation!=="normal")errors.push("Walking has no crew operating schedule.");
        operationRules={dailyHours:regularHours,overnightHours:normalDowntime};
      }else if(option){
        try{operationRules=resolveTransportationOperation(option.method,operation,regularHours);}
        catch(error){errors.push(error.message??String(error));}
      }
      let hours=null,costCp=null,livestock=null;
      if(option){
        let speed=null;
        if(option.method?.id==="walking")speed=walking.speed;
        else if(option.arrangement==="owned"&&roster){
          const capacity=groupMethodCapacityStatus(activeRoster,option.method);
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
              const ownedQuote=option.arrangement==="owned"&&activeRoster?
                groupMethodFareEstimate(activeRoster,option.method,{
                  hours,distanceMi,dayHours:regularHours}):null;
              const vehicle=index===0&&roster&&
                ["land","water","air"].includes(leg.surface)&&
                option.method.kind==="vehicle";
              const mounts=vehicle?groupLivestockResources(roster):[];
              const count=mounts.length?
                countJourneyLivestock(roster,this.livestockDecisions):0;
              const quote=quoteTransportationService(option.method,{
                arrangement:option.arrangement,operation,
                movingHours:hours,distanceMi,travelers:activeRoster?.travelers??1,
                livestockCount:count,ownedQuote,regularHours});
              if(mounts.length)livestock=planJourneyLivestock(roster,this.livestockDecisions,{
                surface:leg.surface,methodId:option.method.id,
                units:quote.units,capacityPerUnit:option.method.livestockCapacity,
                fareCp:quote.livestockFareCp,
                carried:leg.surface==="land"});
              costCp=quote.totalCp;
            }catch(error){errors.push(error.message??String(error));}
          }
        }
      }
      return {...leg,options,selectedOption:option??null,operation,
        dailyHours:operationRules?.dailyHours??null,
        overnightHours:operationRules?.overnightHours??null,
        selectedValue:option?.value??"",
        methodName:option?.method?.name??null,
        livestock,
        narration:describeTransportationLeg(leg,option?{
          name:option.method.name,kind:option.method.kind,
          surface:leg.surface,arrangement:option.arrangement
        }:{}),errors,hours,costCp};
    });
    const globalSchedule=summarizeTransportationOperatingSchedule(legs);
    return {...projected,hasTransitions:projected.hasTransitions||checkpointContinuation,
      checkpointContinuation,legs,complete:globalSchedule.complete,
      globalSchedule,totalHours:globalSchedule.totalMovingHours,
      totalElapsedHours:globalSchedule.totalElapsedHours,
      totalCp:globalSchedule.totalFareCp};
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
    if(index!==0||!option||leg.recovered||option.method?.id==="walking"||option.method?.kind==="mixed")
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
      journeyOperation:leg.operation,
      onReset:async()=>{
        delete this.transferLegOverrides[index];
        delete this.transferLegOperations[index];
        await this.render(true);
      },
      onSave:async (edited,{operation}={})=>{
        if(this.transportationTransitionPlan()?.legs[index]?.selectedValue!==choice)
          throw Error("The transportation choice changed. Reopen its editor.");
        this.transferLegOverrides[index]={selection:choice,
          overrides:transportationMethodOverrideDelta(origin,edited)};
        if(operation)this.transferLegOperations[index]=operation;
        await this.render(true);
        globalThis.ui?.notifications?.info?.("Transportation saved for this trip only.");
      },
      onSaveCheckpoint:checkpointId?async (edited,{operation}={})=>{
        if(this.transportationTransitionPlan()?.legs[index]?.selectedValue!==choice)
          throw Error("The transportation choice changed. Reopen its editor.");
        await this.saveNavigationCheckpointOffer({checkpointId,methodId,world,
          originalOffers:initialOffers,edited});
        delete this.transferLegOverrides[index];
        if(operation)this.transferLegOperations[index]=operation;
        await this.render(true);
      }:null
    });
  }


  /** Edit one selected mixed-party method. Trip drafts are keyed by method and
   * arrangement. Only a separate Map Marker Save writes to the Scene. */
  async editMixedTravelMethod(key){
    if(!game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update")||
        this.travelSession||this.journalStarting||!this.canDraftTravelMethods())
      throw Error("Only an authorized GM may edit planned transportation.");
    if(!this.mixedKeys.includes(key)||this.mixedKeys.length<2)
      throw Error("Choose this method in the current mixed Journey first.");
    const [arrangement,id]=key.split("|",2);
    if(id==="walking"||!["owned","hire"].includes(arrangement))
      throw Error("Walking has no transportation editor.");
    const availability=this.transportAvailability();
    const world=availability.methods.find(method=>method.id===id);
    const offer=arrangement==="hire"?availability.offers.get(id):null;
    if(!world||world.surface!=="land"||
        arrangement==="hire"&&!offer||
        arrangement==="owned"&&!availability.owned.has(id))
      throw Error("The transportation method is no longer available.");
    const baseline=offer?checkpointOfferMethod({methodId:id,mode:offer.mode,
      overrides:offer.overrides},world):world;
    const initialOffers=offer?checkpointOffers(this.scene,offer.checkpointId):null;
    const sceneId=this.scene.id,revision=this.atlasProvider(this.scene).revision;
    const verify=()=>{
      if(!game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update")||
          this.scene.id!==sceneId||
          this.atlasProvider(this.scene).revision!==revision||
          this.travelSession||this.journalStarting||!this.mixedKeys.includes(key))
        throw Error("The Journey, Scene or party selection changed. Reopen.");
      const current=this.transportAvailability();
      if(JSON.stringify(current.all.find(method=>method.id===id)??null)!==
          JSON.stringify(world)||
          arrangement==="hire"&&JSON.stringify(current.offers.get(id)??null)!==
            JSON.stringify(offer))
        throw Error("Transportation settings changed. Reopen without overwriting.");
    };
    const {openTransportationMethodEditor}=await import("./navigation-transport-settings.js");
    await openTransportationMethodEditor({
      method:{...baseline,...this.mixedMethodOverrides[key]},scope:"journey",
      checkpointName:offer?.checkpointName??null,
      // A mixed convoy's one operating schedule is not decided by one vehicle.
      onSave:async edited=>{
        verify();
        this.mixedMethodOverrides[key]=transportationMethodOverrideDelta(baseline,edited);
        await this.render(true);
      },
      onReset:async()=>{
        verify();
        delete this.mixedMethodOverrides[key];
        await this.render(true);
      },
      onSaveCheckpoint:offer?async edited=>{
        verify();
        await this.saveNavigationCheckpointOffer({checkpointId:offer.checkpointId,
          methodId:id,world,originalOffers:initialOffers,edited});
        delete this.mixedMethodOverrides[key];
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
    this.mixedKeys=[];this.mixedMethodOverrides={};this.mixedAssignments={};
    this.mixedRiderCounts={};this.mixedUnits={};
    if(method!=="walking"){
      this.convoyEnabled=false;this.convoyCargoQuantities={};this.convoyPace=null;
    }
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

  /** GM checkbox choices stage a single roster-wide mixed assignment.
   * Mixed mode never infers seat assignments or writes Group/Token documents.
   */
  toggleTravelMethodChoice(value,checked){
    if(!game.user?.isGM||!this.scene||!this.canDraftTravelMethods()||
        !["owned","hire"].includes(value.split("|")[0]))return;
    const [arrangement,method]=value.split("|",2);
    if(checked&&arrangement==="owned"&&method==="mounted")return;
    const current=this.currentLandTransferLeg();
    const primary=current?this.transferSelections[0]??"owned|walking":
      this.transportArrangement+"|"+this.travelMethod;
    const selected=this.mixedKeys.length?this.mixedKeys:
      this.convoyEnabled?["owned|walking",...Object.keys(
        this.convoyCargoQuantities).map(id=>"hire|"+id)]:[primary];
    const wasSelected=selected.includes(value);
    if(checked===wasSelected)return;
    const next=checked?[...selected,value]:selected.filter(key=>key!==value);
    if(!next.length){
      globalThis.ui?.notifications?.warn?.("Choose at least one travel method.");
      void this.render(true);return;
    }
    if(next.length===1){
      this.mixedKeys=[];this.mixedMethodOverrides={};this.mixedAssignments={};
    this.mixedRiderCounts={};this.mixedUnits={};
      this.convoyEnabled=false;this.convoyCargoQuantities={};this.convoyPace=null;
      const [singleArrangement,singleMethod]=next[0].split("|",2);
      if(current){
        this.transferSelections[0]=next[0];
        delete this.transferLegOverrides[0];
        delete this.transferLegOperations[0];
        void this.render(true);return;
      }
      if(this.travelMethod===singleMethod&&
          this.transportArrangement===singleArrangement){
        void this.render(true);
      }else this.setTravelMethod(singleMethod,singleArrangement);
      return;
    }
    if(this.sourceMode!=="party"||!this.result||this.result.status!=="ok"){
      globalThis.ui?.notifications?.warn?.(
        "A mixed party requires an assigned explorer and calculated road route.");
      void this.render(true);return;
    }
    const available=this.transportAvailability();
    for(const key of next){
      const [source,id]=key.split("|",2);
      const world=available.methods.find(item=>item.id===id);
      if(!world||world.surface!=="land"||
         source==="hire"&&!available.offers.has(id)||
         source==="owned"&&id!=="walking"&&!available.owned.has(id)){
        globalThis.ui?.notifications?.warn?.(
          "Selected methods cannot travel together on this land route.");
        void this.render(true);return;
      }
    }
    const party=this.partyTravelSelection(available.all);
    if(!party||party.empty){
      globalThis.ui?.notifications?.warn?.(
        "Select at least one traveler to preview mixed transport.");
      void this.render(true);return;
    }
    this.mixedKeys=next;
    this.mixedMethodOverrides=Object.fromEntries(
      Object.entries(this.mixedMethodOverrides).filter(([key])=>next.includes(key)));
    this.mixedRiderCounts=Object.fromEntries(
      Object.entries(this.mixedRiderCounts).filter(([key])=>next.includes(key)));
    this.mixedUnits=Object.fromEntries(Object.entries(this.mixedUnits)
      .filter(([key])=>next.includes(key)));
    this.convoyEnabled=false;this.convoyCargoQuantities={};
    this.convoyPace=null;
    this.travelMethod="walking";this.transportArrangement="owned";
    this.travelNotice="";
    const view=this.canvasProvider();
    if(!current&&view?.ready&&view.scene?.id===this.scene.id)
      this.calculateRoute(view,this.atlasProvider(this.scene));
    if(current){delete this.transferLegOverrides[0];
      delete this.transferLegOperations[0];}
    this.draw();void this.render(true);
  }

  /** Read-only animal carriage estimate for one selected land vehicle.
   * An accompanying mount is not automatically treated as vehicle cargo. */
  planLandVehicleBoarding(method,arrangement,party){
    if(method?.kind!=="vehicle"||method.surface!=="land"||!party)return null;
    const mounts=groupLivestockResources(party.roster);
    if(!mounts.length)return null;
    const livestockCount=countJourneyLivestock(party.roster,this.livestockDecisions);
    const sceneUnits=this.scene?.grid?.units?.trim()||"";
    const distanceMi=convertGroupSpeed(this.result.distance,sceneUnits,"mi");
    const speed=this.resolveTravel().travel.speed;
    if(!Number.isFinite(distanceMi)||!Number.isFinite(speed)||speed<=0)
      throw Error("Cannot estimate land vehicle accommodation without valid route units.");
    const movingHours=navigationHours(this.result.distance,speed);
    const regularHours=resolveNavigationTravelRules({settings:game.settings,
      systemId:game.system?.id,actorHoursPerDay:null}).dailyHours??8;
    const quote=quoteTransportationService(method,{
      arrangement,operation:this.plannedTravelOperation(method),
      movingHours,distanceMi,travelers:party.travelerCount,
      livestockCount,regularHours});
    const manifest=planJourneyLivestock(party.roster,this.livestockDecisions,{
      surface:"land",carried:true,methodId:method.id,
      units:quote.units,capacityPerUnit:method.livestockCapacity,
      fareCp:quote.livestockFareCp});
    return {manifest,quote};
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
        if(this.mixedKeys.length&&this.currentLandTransferLeg()){
          const leg=this.transportationTransitionPlan()?.legs[0];
          const guided=Boolean(leg?.convoy&&leg?.selectedOption&&!leg.errors.length);
          return {compatible:guided,guided,reason:guided?null:
            leg?.errors.join(" ")||"Choose a valid mixed land checkpoint leg."};
        }
        if(projection&&(projection.hasTransitions||this.travelMethod==="walking"&&
            projection.legs.some(leg=>leg.surface!=="land")))
          return {compatible:false,guided:false,
            reason:"This route crosses different travel surfaces. Use the transportation leg planner below; guided transfers are reserved for beta.7."};
      }catch(error){return {compatible:false,guided:false,
        reason:"Road surface verification failed: "+(error.message??String(error))};}
    }
    if(this.travelMethod==="walking"){
      if(this.recoveryRecord?.legs?.at(-1)?.convoy&&
          isUnfinishedJourneyLeg(this.recoveryRecord))
        return {compatible:true,guided:true,reason:null};
      if(!this.mixedKeys.length&&!this.convoyEnabled)
        return {compatible:true,guided:true,reason:null};
      try{
        if(this.mixedKeys.length)this.mixedLandPlan();
        else this.mixedConvoyPlan();
        return {compatible:true,guided:true,reason:null};
      }catch(error){return {compatible:false,guided:false,
        reason:error.message??String(error)};}
    }
    try{
      const atlas=this.atlasProvider(this.scene);
      const presets=validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING));
      const result=assessNavigationMethodRoute(this.travelMethod,this.result,atlas,presets.presets,
        {settings:game.settings,systemId:game.system?.id});
      if(!result.guided)return result;
      if(this.sourceMode!=="party")return {...result,guided:false,
        reason:"Guided mount travel requires the assigned party token as Point A."};
      const availability=this.transportAvailability();
      const savedLeg=this.recoveryRecord?.legs?.at(-1);
      const approvedLand=isUnfinishedJourneyLeg(this.recoveryRecord)&&
        !savedLeg?.transport?savedLeg?.travelMethod:null;
      // A hired land service is authorized at a checkpoint departure. After
      // interruption, its already-approved arrangement remains authoritative
      // even when the token has moved outside the checkpoint's offer radius.
      if(approvedLand&&(approvedLand.id!==this.travelMethod||
          approvedLand.arrangement!==this.transportArrangement))
        return {...result,guided:false,
          reason:"Resume the previously approved land method and arrangement, or stop and replan."};
      if(this.transportArrangement==="hire"){
        if(!approvedLand&&!availability.offers.has(this.travelMethod))
          return {...result,guided:false,
            reason:"This hired land service is no longer offered at the departure checkpoint."};
      }else if(this.transportArrangement==="owned"){
        if(this.travelMethod!=="walking"&&!approvedLand&&
            !availability.owned.has(this.travelMethod))
          return {...result,guided:false,
            reason:"The selected transport is no longer owned or available at this departure."};
      }else return {...result,guided:false,
        reason:"Choose a valid party-owned or checkpoint-hired transportation arrangement."};
      const method=availability.methods.find(item=>item.id===this.travelMethod);
      const group=this.getPartyToken()?.actor;
      if(!approvedLand&&this.transportArrangement==="hire"){
        if(!method)return {...result,guided:false,
          reason:"The hired method is no longer available."};
        const travelers=game.system?.id==="dnd5e"&&group?.type==="group"?
          projectGroupTransportation(group,readGroupTransportation(game.settings),
            availability.all).travelers:1;
        const supply=assessHiredTransportAvailability(
          this.effectiveTransportMethod(method,availability),{travelers});
        if(!supply.sufficient)return {...result,guided:false,
          reason:supply.unknown?"Set a valid passenger capacity for this hired service.":
            "Insufficient hired transport: "+supply.requiredUnits+
            " unit(s) required, "+(supply.availableUnits??"unverified")+
            " available at the departure checkpoint."};
      }
      if(!approvedLand&&this.transportArrangement==="owned"&&method&&
          game.system?.id==="dnd5e"&&group?.type==="group"){
        const roster=projectGroupTransportation(group,
          readGroupTransportation(game.settings),availability.all);
        if(!groupMethodCapacityStatus(roster,method).sufficient)
          return {...result,guided:false,
            reason:"Not enough matching party-owned passenger seats for this land leg."};
      }
      if(!approvedLand&&method?.kind==="vehicle"&&method.surface==="land"){
        try{
          const party=this.partyTravelSelection(availability.all);
          if(party)this.planLandVehicleBoarding(
            this.effectiveTransportMethod(method,availability),
            this.transportArrangement,party);
        }catch(error){return {...result,guided:false,
          reason:error.message??String(error)};}
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
    // Never retarget a saved Journey while its native/Journal state is pending
    // recovery; only the preview-only map/checkpoint paths can set Point B.
    if(!this.scene||this.travelSession||this.pendingTransfer||
        this.recoveryRecord||this.recoverableJourney||
        this.completedRecord||this.completedRoute)return;
    // Party mode captures only an explicitly requested map destination.
    if(this.sourceMode==="party"&&!this.mapPickActive)return;
    const intent=this.mapPickActive?
      navigationPointIntent(event,{start:this.start,end:null,sourceMode:"party"}):
      navigationPointIntent(event,this);
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
      this.destinationMode="map";
      this.selectedCheckpointId=null;
      this.end = location;
    }
    this.calculateRoute(view,atlas);
    this.draw();
    this.completeMapDestinationPick();
    void this.render(true);
    if (this.result?.status === "ok") {
      const viewport = globalThis.window;
      this.setPosition?.({
        width: Math.min(640, Math.max(380, (viewport?.innerWidth ?? 1000) - 64)),
        height: Math.min(665, Math.max(350, (viewport?.innerHeight ?? 900) - 90))
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

  /** Only an unexecuted, stopped native checkpoint can be discarded. The
   * confirmed anchor, approved route, rest and time ledger remain unchanged.
   * At-end/ambiguous intents deliberately still require review. */
  canRecoverUnexecutedNativeMove(saved){
    try{
      if(!game.user?.isGM||game.users?.activeGM?.id!==game.user.id||
          !this.scene?.canUserModify?.(game.user,"update")||
          this.travelSession||this.journalStarting||this.pendingTransfer||
          saved?.status!=="interrupted"||!isUnfinishedJourneyLeg(saved)||
          !saved.lastConfirmedAnchor||!saved.pendingNativeMove)return false;
      const view=this.canvasProvider(),atlas=this.atlasProvider(this.scene);
      const token=this.getPartyToken(),movement=token?.movement;
      const intent=saved.pendingNativeMove;
      if(intent.arrivalEvidence||intent.partialEvidence)return false;
      if(!view?.ready||view.scene?.id!==this.scene.id||
          !token?.canUserModify?.(game.user,"update")||
          !eligibleJourneyRecord(saved,{sceneId:this.scene.id,
            tokenId:token.id,atlasRevision:atlas.revision})||
          !["stopped","completed"].includes(movement?.state))return false;
      const assessment=assessPendingNativeMove(intent,{
        tokenId:token.id,tokenPoint:token,worldTime:game.time?.worldTime,
        atlasRevision:atlas.revision});
      if(assessment.status!=="at-start")return false;
      // A later checkpoint must be corroborated by the preceding native
      // submovement in the same chain. An empty movementHistory is normal
      // outside combat; the public current/last movement can still prove it.
      if(intent.bounded){
        if(!(movement.id===intent.previousMovementId||
            movement.id===intent.operationId||movement.chain?.includes(intent.operationId))||
            !(Math.hypot(movement.destination?.x-intent.from.x,
              movement.destination?.y-intent.from.y)<=1))return false;
      }else if(intent.checkpointIndex>0&&
          (!(movement.id===intent.operationId||
            movement.chain?.includes(intent.operationId))||
          !(Math.hypot(movement.destination?.x-intent.from.x,
            movement.destination?.y-intent.from.y)<=.25)))return false;
      const anchor=saved.lastConfirmedAnchor;
      const position=this.atlasPoint(view,atlas,
        partyTokenCanvasCenter(token,this.scene.grid.size));
      return Math.hypot(position.x-anchor.point.x,position.y-anchor.point.y)<=.25&&
        (anchor.levelId??null)===(token.level?.id??token.level??null)&&
        (anchor.elevation??null)===(token.elevation??null);
    }catch{return false;}
  }

  /** Read-only recovery candidate. A bounded endpoint can be credited only
   * with its own durable interval and terminal native movement evidence. */
  boundedNativeArrival(saved,onReject=()=>{}){
    const reject=reason=>{onReject(reason);return null;};
    try{
      const leg=saved?.legs?.at(-1),intent=saved?.pendingNativeMove;
      const scene=this.scene,view=this.canvasProvider(),token=this.getPartyToken();
      if(!intent?.bounded||!leg?.approvedPath||
          !["normal","overtime","continuous"].includes(
            leg.transport?.operation??leg.travelMethod?.operation??"normal")||
          !game.user?.isGM||game.users?.activeGM?.id!==game.user.id||
          !scene?.canUserModify?.(game.user,"update")||
          !token?.canUserModify?.(game.user,"update")||!view?.ready||
          view.scene?.id!==scene.id||this.travelSession||this.pendingTransfer||
          saved.status!=="interrupted"||!isUnfinishedJourneyLeg(saved))
        return reject("Recovery requires an interrupted, unfinished approved continuous leg, current Scene and active GM permissions.");
      const atlas=this.atlasProvider(scene),anchor=saved.lastConfirmedAnchor;
      if(!eligibleJourneyRecord(saved,{sceneId:scene.id,tokenId:token.id,
          atlasRevision:atlas.revision})||!anchor||
          (anchor.levelId??null)!==(token.level?.id??token.level??null)||
          (anchor.elevation??null)!==(token.elevation??null))
        return reject("Saved Scene revision, token identity, level, elevation or confirmed anchor differs.");
      const context={tokenId:token.id,tokenPoint:token,movement:token.movement,
        worldTime:game.time?.worldTime,atlasRevision:atlas.revision};
      let result=assessBoundedNativeArrival(intent,context);
      if(result.status!=="at-end"){
        const partial=assessBoundedNativePartial(intent,context);
        if(partial.status!=="partial")return reject(result.reason+" "+partial.reason);
        result=partial;
      }
      const partial=result.status==="partial";
      if(partial&&intent.worldAdvanceSeconds===0&&readNavigationWorldClockSetting(game.settings))
        return reject("A partial interval with a coalesced World-clock write needs GM review.");
      const hours=intent.movingHours*(partial?result.fraction:1);
      const seconds=partial?result.worldAdvanceSeconds:intent.worldAdvanceSeconds;
      const position=this.atlasPoint(view,atlas,partyTokenCanvasCenter(token,scene.grid.size));
      const route=assessApprovedRoutePosition({approvedPath:leg.approvedPath,anchor,
        tokenPosition:position,gridSize:scene.grid.size});
      if(!route.safe||route.kind!=="ahead")
        return reject("Approved route position is not unambiguous forward progress: "+(route.reason??route.kind??"unknown")+".");
      // Verify the pending origin is the same confirmed image-local anchor.
      const origin=this.atlasPoint(view,atlas,partyTokenCanvasCenter(
        {x:intent.from.x,y:intent.from.y,width:token.width,height:token.height},scene.grid.size));
      if(Math.hypot(origin.x-anchor.point.x,origin.y-anchor.point.y)>1)
        return reject("The pending origin does not match the last confirmed Atlas anchor.");
      const completedHours=leg.completedMovingHours+hours;
      const progress=Math.min(100,leg.completedPercent+
        (intent.completedPercent-leg.completedPercent)*(partial?result.fraction:1));
      if(progress<=leg.completedPercent||completedHours>leg.movingHours+1e-4||
          Math.abs((leg.completedMovingHours+intent.movingHours)/leg.movingHours*100-intent.completedPercent)>1e-4||
          Math.abs(completedHours/leg.movingHours*100-progress)>1e-4||
          partial&&progress>=99.999)
        return reject("The saved interval duration does not match the approved leg progress.");
      const final=progress>=99.999;
      let arrivedCheckpoint=null;
      if(final){
        const checkpoint=atlas.checkpoints?.find(cp=>cp.id===leg.transport.arrivalCheckpointId);
        const node=atlas.nodes?.find(n=>n.id===checkpoint?.nodeId);
        const target=saved.routeTargets?nextJourneyTarget(saved.routeTargets):null;
        if(!node||!target||target.checkpointId!==checkpoint.id||
            !confirmGuidedCheckpointArrival({token,gridSize:scene.grid.size,
              atlasPoint:position,expectedPoint:node})||
            Math.hypot(node.x-leg.destination.x,node.y-leg.destination.y)>.01)
          return reject("The final native interval does not match the authored arrival checkpoint and saved target.");
        arrivedCheckpoint={id:checkpoint.id,name:checkpoint.name,point:{x:node.x,y:node.y}};
      }
      const schedule={completedHours:Math.min(leg.movingHours,completedHours),
        todayHours:(saved.day.todayHours+hours)%24,
        permittedExtraUntil:saved.day.permittedExtraUntil,restEvents:saved.day.restEvents,
        lastForcedCheck:saved.day.lastForcedCheck,events:structuredClone(leg.events)};
      const next=structuredClone(saved);
      if(next.passengerRest){
        const priorHours=confirmedJourneyMovingHours({legs:saved.legs.slice(0,-1)});
        const request={action:next.passengerRest.action,hours:next.passengerRest.hours,
          startHours:next.passengerRest.startedAtMovingHours-priorHours};
        if(confirmPassengerRest(schedule,request))next.passengerRest=null;
      }
      next.pendingNativeMove=null;
      const confirmedAnchor=captureJourneyAnchor({point:position,atlas,gridSize:scene.grid.size,
        levelId:anchor.levelId,elevation:anchor.elevation});
      const record=checkpointJourneyRecord(next,{schedule,progress,
        status:final?"paused":"interrupted",
        worldTravelSeconds:leg.worldTravelSeconds+seconds,
        worldRestSeconds:leg.worldRestSeconds,confirmedAnchor,arrivedCheckpoint,
        checkpointTolerancePixels:scene.grid.size*.75});
      if(final&&record.routeTargets.nextTargetIndex!==saved.routeTargets.nextTargetIndex+1)
        return reject("The final checkpoint did not advance the saved target exactly once.");
      return {record,clockAction:result.worldClockAction,partial,
        worldAdvanceSeconds:seconds,evidence:partial?result.evidence:null,
        worldTimeAfter:intent.worldTimeBefore+seconds};
    }catch(error){return reject(error.message??String(error));}
  }

  async recoverSavedJourneyWithNativeReview({automatic=false}={}){
    if(this.journalStarting||this.travelSession||this.suspendedNativeSession)return false;
    const journal=this.recoverableJourney;
    let raw=journal?.getFlag?.(MODULE_ID,JOURNEY_JOURNAL_FLAG);
    if(!raw?.pendingNativeMove)return this.recoverSavedJourney({automatic});
    let saved=validateJourneyRecord(raw);
    const unexecuted=this.canRecoverUnexecutedNativeMove(saved);
    let rejection=null;
    let arrival=unexecuted?null:this.boundedNativeArrival(saved,reason=>{rejection=reason;});
    if((!unexecuted&&!arrival)||!journal.canUserModify?.(game.user,"update")||
        (arrival?.clockAction==="advance"&&(!readNavigationWorldClockSetting(game.settings)||
          typeof game.time?.advance!=="function"))){
      const reason=rejection??"Journal write permission or World-clock advancement is unavailable.";
      atlasWarn("journey","Native checkpoint reconciliation withheld: "+reason,
        {journalId:journal.id,operationId:saved.pendingNativeMove.operationId});
      return this.recoverSavedJourney({automatic}); // existing fail-closed guard
    }
    const scene=this.scene, token=this.getPartyToken();
    let next=arrival?.record??validateJourneyRecord({...saved,pendingNativeMove:null,
      updatedAt:new Date().toISOString()});
    this.journalStarting=true;
    try{
      if(arrival){
        const evidenceKey=arrival.partial?"partialEvidence":"arrivalEvidence";
        if(!saved.pendingNativeMove[evidenceKey]){
          const evidence=arrival.partial?arrival.evidence:captureNativeArrivalEvidence(saved.pendingNativeMove,{
            movement:token.movement,tokenPoint:token});
          if(!evidence)throw Error("Native movement evidence cannot be durably verified. Review the saved Journey.");
          const withEvidence=validateJourneyRecord({...saved,pendingNativeMove:{
            ...saved.pendingNativeMove,[evidenceKey]:evidence}});
          if(JSON.stringify(journal.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG))!==JSON.stringify(raw))
            throw Error("The saved Journey changed before native evidence persistence.");
          await this.journeyJournalStore.save(withEvidence,{journal,updatePage:false});
          raw=journal.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG);
          if(JSON.stringify(raw)!==JSON.stringify(withEvidence))
            throw Error("Native endpoint evidence was not durably saved.");
          saved=withEvidence;
          arrival=this.boundedNativeArrival(saved);
          if(!arrival||this.scene!==scene||this.getPartyToken()!==token||
              this.recoverableJourney?.id!==journal.id||
              !journal.canUserModify?.(game.user,"update"))
            throw Error("Native checkpoint state changed after evidence persistence.");
        }
        // The original durable intent is retained across a failed clock or
        // Journal write. On retry its target clock is recognized, not added.
        if(arrival.clockAction==="advance")
          await game.time.advance(arrival.worldAdvanceSeconds);
        const verified=this.boundedNativeArrival(saved);
        if(!verified||game.time.worldTime!==arrival.worldTimeAfter||
            this.scene!==scene||this.getPartyToken()!==token||
            this.recoverableJourney?.id!==journal.id||
            !journal.canUserModify?.(game.user,"update")||
            JSON.stringify(journal.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG))!==JSON.stringify(raw))
          throw Error("Native checkpoint state changed during clock reconciliation. The original intent is retained.");
        next=verified.record;
      }
      await this.journeyJournalStore.save(next,{journal,updatePage:Boolean(arrival)||next.status==="paused"});
    }finally{this.journalStarting=false;}
    // A newly changed token, clock, scene or Journal must not auto-start.
    if(this.scene!==scene||this.getPartyToken()!==token||
        this.recoverableJourney?.id!==journal.id||
        JSON.stringify(journal.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG))!==JSON.stringify(next)||
        !(unexecuted?this.canRecoverUnexecutedNativeMove(saved):this.boundedNativeArrival(saved)))
      throw Error("The saved Journey changed during checkpoint reconciliation. Review it before continuing.");
    atlasDebug("journey",arrival?(arrival.partial?
      "Verified partial native interval reconciled without replaying movement":
      "Bounded native endpoint reconciled without replaying movement"):
      "Unexecuted native checkpoint reconciled without movement or time writes",
      {journalId:journal.id,operationId:saved.pendingNativeMove.operationId,
        checkpointIndex:saved.pendingNativeMove.checkpointIndex});
    return this.recoverSavedJourney({automatic});
  }

  /** Load a saved destination, but never start a token movement automatically. */
  recoverSavedJourney({automatic=false}={}){
    if(this.travelSession||this.journalStarting||this.suspendedNativeSession||!this.scene)return false;
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
      if(assessment.kind!=="coordinate")
        throw Error("Native token movement advanced beyond the last confirmed " +
          "Journey anchor during Canvas teardown. Automatic continuation is " +
          "withheld; manual recovery is also blocked. The GM must review the " +
          "Journal and return the TokenDocument to its last confirmed anchor " +
          "before resuming; Atlas cannot skip unconfirmed distance or World time.");
      atlasDebug("journey","Native token recovery anchor checked",{
        sceneId:this.scene.id,kind:assessment.kind,
        driftPixels:Math.round(assessment.drift*100)/100
      });
    }
    const recent=saved.legs.at(-1),arrival=recent.transport;
    if(recent.livestock){
      const group=token?.actor;
      if(group?.type!=="group")
        throw Error("The approved livestock requires its original Group explorer.");
      const roster=projectGroupTransportation(group,readGroupTransportation(game.settings),
        availableNavigationTravelMethods(game.settings,game.system?.id));
      const approved=assertRecoveredLivestock(saved,roster);
      this.livestockDecisions=Object.fromEntries(approved.resources.map(m=>
        [m.actorId,m.aboard]));
    }
    if(recent.participation){
      // Restore the approved cohort on reload before computing passenger fares
      // or eligibility. This updates only an in-memory draft, never the Group.
      const actor=token?.actor;
      if(game.system?.id!=="dnd5e"||actor?.type!=="group")
        throw Error("The saved traveler manifest requires its original Group explorer.");
      const catalog=availableNavigationTravelMethods(game.settings,game.system?.id);
      const roster=projectGroupTransportation(actor,
        readGroupTransportation(game.settings),catalog);
      const retained=priorJourneySelection(saved,roster);
      const total=partyTravelerRoster(roster).length;
      this.partySelectionMode=retained.length===total?"all":"selected";
      this.partySelectedIds=this.partySelectionMode==="selected"?retained:[];
    }
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
    const boundary=classifyRecoveredJourneyBoundary(saved,{
      gridSize:this.scene.grid.size});
    if(boundary.kind==="review"){
      // A readable Journal page may still show zero progress: the validated
      // recovery flag is the authority. Emit a bounded GM diagnostic as JSON
      // so exported console logs do not collapse critical values to Object.
      if(game.user?.isGM)atlasWarn("journey","Checkpoint recovery needs GM review",
        JSON.stringify({reason:boundary.reason,status:saved.status,
          completedPercent:recent.completedPercent,
          arrivalCheckpointId:arrival?.arrivalCheckpointId??null,
          nextTargetIndex:saved.routeTargets?.nextTargetIndex??null,
          lastConfirmedAnchor:saved.lastConfirmedAnchor?.point??null,
          pendingNativeMove:Boolean(saved.pendingNativeMove)}));
      throw Error("The last native travel leg is recorded as complete, but " +
        "its checkpoint/target decision is not fully confirmed ("+
        boundary.reason+"). Atlas has preserved the Journey and will not " +
        "replay movement or advance the A/B/C target. Ask the GM to review " +
        "the saved Journal flag and TokenDocument before continuing.");
    }
    if(boundary.kind==="confirmed-transfer"){
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
    this.calculateRoute(view,atlas,isMixedLandTransport(recent.transport)?
      {terrainAware:recent.terrainAware}:{});
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

  /** Deliberately end an unrecoverable or unwanted saved Journey without
   * rewriting confirmed history or resolving an unconfirmed native move. */
  async forgetSavedJourney(){
    if(!game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update"))
      throw Error("Only a GM may forget an Atlas Journey on its Scene.");
    if(this.travelSession||this.journalStarting||this.suspendedNativeSession||this.pendingTransfer)
      throw Error("Finish the active Journey or checkpoint decision first.");
    const journal=this.recoverableJourney??this.recoveryJournal;
    const scene=this.scene,token=this.getPartyToken();
    if(!journal?.id||!token?.id)
      throw Error("No saved party Journey is available to forget.");
    const readSaved=()=>validateJourneyRecord(journal.getFlag?.(
      MODULE_ID,JOURNEY_JOURNAL_FLAG));
    const saved=readSaved();
    if(saved.sceneId!==scene.id||saved.tokenId!==token.id||
        !["moving","paused","interrupted"].includes(saved.status))
      throw Error("This saved Journey no longer belongs to the assigned party token.");
    const snapshot=JSON.stringify(saved);
    const confirmed=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Forget saved Atlas Journey?"},
      content:el("div","End this saved Journey and start a new route from the " +
        "party token's current location? Its confirmed travel and unfinished " +
        "native checkpoint remain in the Journey Journal for GM review. " +
        "No token movement, World time, rest or fare will be changed. " +
        "This Journey will no longer be available for recovery."),
      rejectClose:false,modal:true
    });
    if(!confirmed)return false;
    if(this.travelSession||this.journalStarting||this.pendingTransfer||
        !game.user?.isGM||this.scene!==scene||
        !scene.canUserModify?.(game.user,"update")||
        this.getPartyToken()?.id!==token.id||
        this.recoverableJourney?.id!==journal.id&&
          this.recoveryJournal?.id!==journal.id||
        JSON.stringify(readSaved())!==snapshot)
      throw Error("The saved Journey changed during confirmation. Reopen Navigation to review it.");
    this.journalStarting=true;
    try{
      const ended={...saved,status:"ended",updatedAt:new Date().toISOString()};
      await this.journeyJournalStore.save(ended,{journal});
      this.announceCommittedJourney({journal,previous:saved,committed:ended,
        type:"journey.ended"});
      // A successful Journal write, not the button click, releases the lock.
      this.autoResumePending=null;
      this.autoResumeAttempts.delete(journal.id);
      this.clear();
      this.travelMethod="walking";
      this.transportArrangement="owned";
      this.transportOperation="normal";
      this.transferSelections={};
      this.transferLegOverrides={};
      this.notice="Saved Journey ended. Select a new destination from the party token.";
      if(this.active)void this.render(true);
      return true;
    }finally{
      this.journalStarting=false;
      if(this.active)void this.render(true);
    }
  }

  /** New Route discards only the current preview; a saved Journal is first
   * explicitly ended so a future canvas refresh cannot silently recover it. */
  async startNewRoute(){
    if(this.travelSession||this.journalStarting||this.pendingTransfer)return false;
    if(this.recoverableJourney||this.recoveryJournal)
      return this.forgetSavedJourney();
    this.clear();
    return true;
  }

  async saveJourneyCheckpoint(session,status,{updatePage=null}={}){
    if(!session?.journal||!session.journeyRecord)return;
    // The native movement callback can settle after a Scene redraw or a GM
    // confirmation. Never overwrite a completed/ended Journal from a late
    // interruption; the verified terminal record stays authoritative.
    if(!mayCheckpointJourneyStatus(session.journeyRecord.status,status))return;
    const previous=session.journeyRecord;
    const arrival=status==="completed"?journeyWorldStamp(game.time):null;
    // The cached native Document anchor was sampled ONLY after a completed,
    // verified move. During an in-flight move the Document may be ahead of
    // credited progress, and canvas teardown makes live sampling impossible.
    const confirmedAnchor=session.lastConfirmedAnchor??null;
    // World time may settle before a pending TokenDocument move is credited.
    // Preserve the last CONFIRMED leg ledger until the native operation and
    // its exact approved clock delta are reconciled, including across redraw.
    const pending=Boolean(previous.pendingNativeMove);
    const saved=checkpointJourneyRecord(session.journeyRecord,{
      schedule:session.schedule,status,
      progress:Math.max(0,Math.min(100,100*session.completedDistance/session.totalDistance)),
      worldTravelSeconds:pending?previous.legs.at(-1).worldTravelSeconds:
        (session.clock?.advancedSeconds??0),
      worldRestSeconds:pending?previous.legs.at(-1).worldRestSeconds:
        (session.clock?.restSeconds??0),
      confirmedAnchor,
      arrivedCheckpoint:session.transportLeg&&
        status==="paused"&&session.completedDistance/session.totalDistance>=.99999?
          session.transportLeg.checkpoint:null,
      checkpointTolerancePixels:session.gridSize*.75,
      arrivedWorldTime:arrival?.seconds??null,
      arrivedTimeLabel:arrival?.label??null
    });
    session.journeyRecord=saved;
    // Persist each confirmed native movement/rest as recovery data; publish
    // readable history on arrival, interruption or deliberate finalization.
    const publish=updatePage??journeySummaryDue({status,
      completedPercent:saved.legs.at(-1).completedPercent,
      pendingNativeMove:saved.pendingNativeMove});
    // Scene redraws may interrupt an in-flight write. Serialize the final
    // interrupted state after any earlier checkpoint; last committed wins.
    session.journalQueue=(session.journalQueue??Promise.resolve()).catch(()=>{}).then(async()=>{
      await this.journeyJournalStore.save(saved,{journal:session.journal,
        updatePage:publish});
    });
    await session.journalQueue;
    const recordedRest=(saved.legs.at(-1)?.events?.length??0)>
      (previous.legs.at(-1)?.events?.length??0)&&
      saved.legs.length===previous.legs.length;
    if(recordedRest){
      // These are two visual phases of the same confirmed Journal rest, not
      // a second application of downtime, resources, or World time.
      const action=saved.legs.at(-1).events.at(-1)?.action;
      if(["long","short","overnight"].includes(action)){
        const subject=action==="long"?"Long Rest":
          action==="short"?"Short Rest":"Overnight Camp";
        this.announceCommittedJourney({journal:session.journal,previous,
          committed:saved,type:"break.started",subject});
        const ended={journal:session.journal,previous,committed:saved,
          type:"break.ended",subject:"The road awaits"};
        if(status==="moving"&&session.phase==="rest-applying"&&
            !session.manualRestApplying)
          session.pendingRestEndedAnnouncement=ended;
        else this.announceCommittedJourney(ended);
      }
    }
    if(status==="completed")this.announceCommittedJourney({
      journal:session.journal,previous,committed:saved,
      type:"destination.reached",subject:"your destination"});
    else if(status==="ended")this.announceCommittedJourney({
      journal:session.journal,previous,committed:saved,type:"journey.ended"});
    else if(status==="paused"&&session.phase==="pausing")
      this.announceCommittedJourney({
        journal:session.journal,previous,committed:saved,
        type:"journey.paused",manualPause:true});
    else if(status==="paused"&&session.transportLeg?.checkpoint?.id&&
        saved.legs.at(-1)?.completedPercent>=99.999)
      this.announceCommittedJourney({
        journal:session.journal,previous,committed:saved,
        type:"checkpoint.arrived",checkpointId:session.transportLeg.checkpoint.id,
        subject:session.transportLeg.checkpoint.name});
  }

  /** Presentation can only observe a successful Journal commit. It is never
   * part of the native movement/clock/Journal transaction or a recovery gate. */
  announceCommittedJourney(payload){
    try{return this.announcementPublisher({...payload,scene:this.scene});}
    catch(error){
      atlasWarn("journey","A confirmed Journey banner could not be displayed",error);
      return false;
    }
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
    // An interrupted leg's old schedule cannot time the new route preview.
    const live=this.travelSession?.schedule;
    const schedule=live&&Math.abs(live.travelHours-ui.travelHours)<1e-5?live:null;
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
   * Continuous transport submits only one approved native interval at a time.
   * No future interval is handed to Foundry until its predecessor is durable.
   * Land routes with GM rest/forced-march decisions retain their existing loop.
   */
  async runNativeContinuousLeg(session,{plan,playback,atlas,view,guidedLeg,
    ordinary=false,visual=null}){
    const operationId=foundry.utils.randomID();
    const pixelsPerSecond=(visual?.movementSpeed??playback.movementSpeed)*session.gridSize;
    const scene=this.scene;
    const shouldStop=()=>this.travelSession!==session||session.phase==="ending"||
      this.scene?.id!==session.sceneId||
      this.atlasProvider(this.scene)?.revision!==atlas.revision;
    const prepareCheckpoint=async(checkpoint,intervalId,path,nativePath)=>{
      if(shouldStop())throw Error("The approved native journey was interrupted.");
      await this.waitForGuidedTravelResume(session);
      if(shouldStop())throw Error("The approved native journey was stopped.");
      const worldTimeBefore=game.time?.worldTime;
      if(!Number.isSafeInteger(worldTimeBefore))
        throw Error("The current Foundry World time is not a safe integer.");
      const clock=session.clock;
      const target=clock?.targetSeconds(checkpoint.completedDistance)??0;
      const outstanding=target-(clock?.advancedSeconds??0);
      const lastInLeg=ordinary?
        checkpoint.completedDistance/session.totalDistance>=.99999:
        checkpoint.index===plan.checkpoints.length-1;
      const worldAdvanceSeconds=clock&&outstanding>0&&
        (lastInLeg||outstanding>=clock.minimumStep)?outstanding:0;
      session.journeyRecord.pendingNativeMove=validatePendingNativeMove({
        schemaVersion:1,operationId:intervalId,tokenId:session.token.id,
        bounded:true,previousMovementId:session.token.movement?.id||null,
        path:path.map(p=>({x:p.x,y:p.y})),
        ...(nativePath!==undefined?{nativePath}:{}),
        completedPercent:100*checkpoint.completedDistance/plan.totalDistance,
        checkpointIndex:checkpoint.index,from:checkpoint.from,to:checkpoint.point,
        nativeDistance:checkpoint.distance,movingHours:
          checkpoint.completedMovingHours-
          (plan.checkpoints[checkpoint.index-1]?.completedMovingHours??0),
        worldTimeBefore,worldAdvanceSeconds,atlasRevision:atlas.revision
      });
      session.currentChunk={distance:checkpoint.distance,startedAt:Date.now(),
        durationMs:visual?.animate===false?1:
          1000*checkpoint.distance/pixelsPerSecond};
      // A crash between here and native TokenDocument.update leaves a valid
      // at-start intent. A crash after update leaves an unresolved intent,
      // never falsely credited Journey progress.
      await this.saveJourneyCheckpoint(session,"moving",{updatePage:false});
      atlasDebug("movement","Native checkpoint intent saved",{
        operationId:intervalId,nativeCheckpointKey:`${intervalId}:${checkpoint.index}`,
        atlasCheckpointId:checkpoint.atlasCheckpointId??null,
        roadId:checkpoint.roadId??null,segmentId:checkpoint.segmentId??null,
        nearestRoadId:checkpoint.nearestRoadId??null,
        routeSeparationPixels:checkpoint.routeSeparationPixels??null,
        expectedFrom:checkpoint.from,expectedTo:checkpoint.point,
        normalizedNativePath:nativePath??null
      },{level:"verbose"});
    };
    const canPersistEvidence=()=>!shouldStop()||(
      session.canvasSuspended&&this.suspendedNativeSession===session&&
      game.user?.isGM&&game.users?.activeGM?.id===game.user.id&&
      scene?.canUserModify?.(game.user,"update")&&
      session.journal?.canUserModify?.(game.user,"update")&&
      session.token.canUserModify?.(game.user,"update")&&
      scene.tokens?.get(session.token.id)===session.token&&
      this.atlasProvider(scene).revision===atlas.revision);
    const recordCheckpointEvidence=async(checkpoint,movement,intervalId)=>{
      if(!canPersistEvidence())throw Error("Native movement interrupted before evidence persistence.");
      const pending=session.journeyRecord.pendingNativeMove;
      if(pending?.operationId!==intervalId||pending.checkpointIndex!==checkpoint.index)
        throw Error("The Journey's pending native checkpoint was replaced.");
      if(pending.arrivalEvidence)return;
      const evidence=captureNativeArrivalEvidence(pending,{movement,tokenPoint:session.token});
      if(!evidence){
        if(pending.nativePath)throw Error("The normalized native endpoint evidence could not be verified.");
        return; // Older native report shapes still require live proof.
      }
      session.journeyRecord.pendingNativeMove=validatePendingNativeMove({...pending,arrivalEvidence:evidence});
      await this.saveJourneyCheckpoint(session,"moving",{updatePage:false});
    };
    const recordSuspendedEvidence=async(checkpoint,movement,intervalId)=>{
      if(!canPersistEvidence())return;
      const pending=session.journeyRecord.pendingNativeMove;
      if(pending?.operationId!==intervalId||pending.checkpointIndex!==checkpoint.index||
          pending.arrivalEvidence||pending.partialEvidence)return;
      const partial=assessBoundedNativePartial(pending,{movement,tokenPoint:session.token,
        tokenId:session.token.id,atlasRevision:atlas.revision,worldTime:game.time.worldTime});
      if(partial.status==="partial"&&game.time.worldTime===pending.worldTimeBefore){
        session.journeyRecord.pendingNativeMove=validatePendingNativeMove({
          ...pending,partialEvidence:partial.evidence});
        await this.saveJourneyCheckpoint(session,"moving",{updatePage:false});
      }else atlasWarn("journey","Suspended native interval needs review",JSON.stringify({
        operationId:intervalId,reason:partial.reason??"World clock changed",
        path:pending.path,nativePath:pending.nativePath??null,
        token:{x:session.token.x,y:session.token.y},worldTime:game.time.worldTime,
        movement:{id:movement?.id,state:movement?.state,constrained:movement?.constrained,
          origin:movement?.origin,destination:movement?.destination,
          passed:movement?.passed?.waypoints?.slice(0,4096).map(p=>({x:p.x,y:p.y,movementId:p.movementId})),
          pending:movement?.pending?.waypoints?.slice(0,4096).map(p=>({x:p.x,y:p.y,movementId:p.movementId}))}
      }));
    };
    const confirmCheckpoint=async(checkpoint,movement,intervalId)=>{
      if(shouldStop())throw Error("Native movement interrupted before confirmation.");
      const pending=session.journeyRecord.pendingNativeMove;
      if(pending?.operationId!==intervalId||
          pending.checkpointIndex!==checkpoint.index)
        throw Error("The Journey's pending native checkpoint was replaced.");
      if(game.time.worldTime!==pending.worldTimeBefore)
        throw Error("World time changed while a native checkpoint was pending.");
      if(Math.hypot(session.token.x-checkpoint.point.x,
          session.token.y-checkpoint.point.y)>1)
        throw Error("The native TokenDocument missed its approved checkpoint.");
      await recordCheckpointEvidence(checkpoint,movement,intervalId);
      if(shouldStop())throw Error("Native movement interrupted after evidence persistence.");
      if(game.time.worldTime!==pending.worldTimeBefore||
          Math.hypot(session.token.x-checkpoint.point.x,session.token.y-checkpoint.point.y)>1)
        throw Error("Native position or World time changed after evidence persistence.");
      const finalCheckpoint=ordinary?
        checkpoint.completedDistance/session.totalDistance>=.99999:
        checkpoint.index===plan.checkpoints.length-1;
      if(finalCheckpoint&&guidedLeg){
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
      if(session.playbackSecondsPerHour!==undefined)
        session.journeyRecord.playbackSecondsPerHour=
          validatePlaybackSetting(session.playbackSecondsPerHour);
      // The last native checkpoint is already an approved dock arrival.
      // Commit transfer metadata *here* so a canvas redraw before the outer
      // move() promise resolves does not lose the durable C/D decision.
      await this.saveJourneyCheckpoint(session,finalCheckpoint?
        (guidedLeg?"paused":"completed"):"moving",
        {updatePage:finalCheckpoint});
      this.setTravelProgress(Math.min(99,100*session.completedDistance/session.totalDistance));
      atlasDebug("movement","Native checkpoint durably confirmed",{
        operationId:intervalId,nativeMovementId:movement.id,
        nativeCheckpointKey:`${intervalId}:${checkpoint.index}`,
        atlasCheckpointId:checkpoint.atlasCheckpointId??null,
        roadId:checkpoint.roadId??null,segmentId:checkpoint.segmentId??null,
        nearestRoadId:checkpoint.nearestRoadId??null,
        expectedTo:checkpoint.point,
        observedTo:{x:session.token.x,y:session.token.y},
        checkpoint:checkpoint.index+1,checkpointCount:plan.checkpoints.length
      },{level:"verbose"});
    };
    session.nativeAbort=new AbortController();
    session.nativeSuspension=new AbortController();
    session.nativeActive=true;
    session.nativeOperationKind=ordinary?"ordinary":"continuous";
    try{
      const result=await coordinateNativeTokenMovement({
        token:session.token,plan,operationId,
        movementSpeed:visual?.movementSpeed??playback.movementSpeed,
        animate:visual?.animate??true,
        hooks:Hooks,prepareCheckpoint,confirmCheckpoint,recordCheckpointEvidence,recordSuspendedEvidence,shouldStop,
        signal:session.nativeAbort.signal,suspensionSignal:session.nativeSuspension.signal,
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
      session.nativeActive=false;session.nativeOperationKind=null;
      session.nativeAbort=null;session.nativeSuspension=null;session.currentChunk=null;
    }
  }

  /** All rule interpretations flow through one pure World settings adapter. */
  resolveTravelRules(travel,approvedMethod=null,approvedOperation=null){
    const rules=resolveNavigationTravelRules({settings:game.settings,
      systemId:game.system?.id,actorHoursPerDay:travel?.hoursPerDay});
    if(!travel?.methodId||travel.methodId==="walking")return rules;
    const world=approvedMethod??availableNavigationTravelMethods(game.settings,game.system?.id)
      .find(method=>method.id===travel.methodId);
    // No approved snapshot was passed: use this trip's actual local method,
    // not the older World template when a Map Marker enables 24h operation.
    const preset=!approvedMethod&&world&&travel.methodId===this.travelMethod?
      this.effectiveTransportMethod(world):world;
    if(!preset){
      if(travel.methodId===this.travelMethod&&this.transportOperation!=="normal")
        throw Error("The selected transportation method is unavailable.");
      return rules;
    }
    const normalHours=rules.dailyHours??8;
    const storedOperation=this.transportOperation??"normal";
    let operation=approvedOperation??(
      approvedMethod&&isUnfinishedJourneyLeg(this.recoveryRecord)?
        storedOperation:draftTransportationOperation(preset,storedOperation));
    let selected;
    try{selected=resolveTransportationOperation(preset,operation,normalHours);}
    catch(error){
      // A fresh unapproved method change may discard a stale UI selection.
      // An approved Journal operation must NEVER be silently downgraded.
      if(approvedMethod||approvedOperation!==null||
          isUnfinishedJourneyLeg(this.recoveryRecord))throw error;
      operation="normal";this.transportOperation="normal";
      selected=resolveTransportationOperation(preset,operation,normalHours);
    }
    return {...rules,profile:"transport-service",label:"Transport service",
      // Crewed vessels may operate 24h by shifts; passengers choose their own
      // rest times without stopping the ship or triggering forced march.
      dailyHours:operation==="continuous"?null:selected.dailyHours,
      overnightHours:operation==="continuous"?0:selected.overnightHours,
      forcedMarch:"custom"};
  }

  /** Resolve the exact edited method and approved operation before travel.
   * In particular a hired land vehicle may gain continuous capability at the
   * departure Map Marker while its inherited World preset remains standard. */
  resolveCurrentLegRules(travel,guidedOption=null,guidedLeg=null){
    if(guidedLeg||!travel?.methodId||travel.methodId==="walking")
      return this.resolveTravelRules(travel,guidedOption?.method,
        guidedLeg?.transport?.operation??null);
    const availability=this.transportAvailability();
    const world=availability.methods.find(method=>method.id===travel.methodId);
    if(!world)throw Error("The selected transportation method is unavailable.");
    const effective=this.effectiveTransportMethod(world,availability);
    return this.resolveTravelRules(travel,effective,
      this.plannedTravelOperation(effective));
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
      session.transportLeg.transport.methodName+". The transport keeps moving; "+
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
      if(["long","overnight"].includes(action))
        await this.offerPlayerRestPrompt(session,action);
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

  async waitForDailyTravelChoice(session,{allowEarly=false}={}){
    if(!session.schedule.needsDecision&&!allowEarly)return true;
    session.phase="rest-checkpointing";
    // A daily-limit decision is durable even when no new native movement
    // occurred after the most recent verified checkpoint.
    await this.saveJourneyCheckpoint(session,"paused");
    if(session.phase==="ending"||this.travelSession!==session)return false;
    session.phase="rest-choice";
    atlasDebug("journey","Daily travel limit reached",{
      sceneId:session.sceneId,todayHours:session.schedule.todayHours
    });
    const past=session.schedule.lastForcedCheck;
    const forced=past?` Resolve the hour-${past.extraHour} forced-march DC ${past.dc} `+
      "Constitution saves with your players; Atlas never applies exhaustion.":"";
    this.travelNotice=allowEarly&&!session.schedule.needsDecision?
      "This native movement cannot be safely split at the exact travel-hour boundary. "+
      "Choose an early rest or approve the next forced-march hour before moving. "+
      "No Token movement or World time has been committed."+forced:
      `Daily travel limit (${session.schedule.rules.dailyHours}h) reached. `+
      "Choose an overnight camp, a long or short rest, or continued travel."+forced;
    const choicePromise=new Promise(resolve=>{session.restWaiter=resolve;});
    if(this.active)await this.render(true);
    const action=await choicePromise;
    session.restWaiter=null;
    if(session.phase==="ending"||this.travelSession!==session||!action)return false;
    const choice=session.schedule.breakChoice(action,{allowEarly});
    // A break's start is after confirmed travel time and before downtime.
    await this.commitGuidedTravelBreak(session,choice,()=>session.phase==="ending"?
      "interrupted":"moving");
    session.restCheckpointed=true;
    if(choice.hours>0&&this.travelSession===session&&session.phase!=="ending"){
      // The rest is already committed to World time and the Journey Journal.
      // Hold *presentation only* before the next TokenDocument.move call.
      const milliseconds=session.skipVisualPlayback?0:
        visualRestDurationMs(choice.hours,session.playbackSecondsPerHour);
      session.phase="rest-holding";
      this.travelNotice=`${action==="overnight"?"Overnight camp":
        action==="long"?"Long rest":"Short rest"} in progress. `+
        `The party remains here for ${Math.round(milliseconds/1000)}s of visual playback.`;
      if(this.active)await this.render(true);
      if(this.travelSession!==session||session.phase==="ending")return false;
      const hold=this.restHoldFactory(milliseconds);
      session.visualRestHold=hold;
      if(session.skipVisualPlayback)hold.finish?.();
      try{
        if(!await hold.finished)return false;
      }finally{
        if(session.visualRestHold===hold)session.visualRestHold=null;
        hold.cancel();
      }
      if(this.travelSession!==session||session.phase==="ending")return false;
    }
    if(session.pendingRestEndedAnnouncement){
      this.announceCommittedJourney(session.pendingRestEndedAnnouncement);
      session.pendingRestEndedAnnouncement=null;
    }
    if(["long","overnight"].includes(action)&&
        this.travelSession===session&&session.phase!=="ending"){
      if(session.skipVisualPlayback&&session.consolidatePlayerRestPrompts)
        session.confirmedRestNotices++;
      else await this.offerPlayerRestPrompt(session,action);
      if(this.travelSession!==session||session.phase==="ending")return false;
    }
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
    if(this.travelSession||this.journalStarting||this.suspendedNativeSession)
      throw Error("Guided travel is already in progress, suspended, or being prepared.");
    if(this.recoveryRecord?.pendingNativeMove||
        this.recoverableJourney?.getFlag?.(MODULE_ID,JOURNEY_JOURNAL_FLAG)?.pendingNativeMove||
        this.recoverableJourney&&!this.recoveryRecord)
      throw Error("Recover or deliberately end the saved Journey before starting travel.");
    if(this.completedRoute)
      throw Error("This Journey is completed. Choose New Route before traveling again.");
    if(this.pendingTransfer)
      throw Error("Finish the current checkpoint decision before starting another leg.");
    if(!game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update")||
        !view?.ready||view.scene?.id!==this.scene?.id||this.result?.status!=="ok")
      throw Error("A GM must calculate a route on the active Scene before guided travel.");
    if(!this.result.legs?.some(leg=>leg.kind==="road"))
      throw Error("Guided travel requires a route containing an Atlas road.");
    // An assigned explorer token represents the selected travelers narratively.
    // An unfinished approved leg may not change its saved participant manifest.
    const nativeGroup=this.sourceMode==="party"&&game.system?.id==="dnd5e"&&
      this.getPartyToken()?.actor?.type==="group";
    const partyAtStart=this.sourceMode==="party"&&!isUnfinishedJourneyLeg(this.recoveryRecord)?
      this.partyTravelSelection(availableNavigationTravelMethods(game.settings,game.system?.id)):null;
    if(nativeGroup&&!isUnfinishedJourneyLeg(this.recoveryRecord)&&
        (!partyAtStart||partyAtStart.empty))
      throw Error("Select at least one valid Group traveler before approving movement.");
    const partySignature=partyAtStart?JSON.stringify({
      members:partyAtStart.roster?.members,selectedIds:partyAtStart.selectedIds,
      livestockDecisions:this.livestockDecisions}):null;
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
    if(approvedLandMethod&&(this.travelMethod!==approvedLandMethod.id||
        this.transportArrangement!==approvedLandMethod.arrangement))
      throw Error("The saved "+approvedLandMethod.name+
        " journey cannot silently resume using another travel method or arrangement. Recover or replan with the GM.");
    if(this.sourceMode==="party"&&this.syncPartyDeparture(view,atlas)){
      // A moved token invalidates the old route AND selected checkpoint offer.
      this.calculateRoute(view,atlas);this.draw();void this.render(true);
      throw Error("The party moved since the preview. Select transportation on the refreshed route.");
    }
    let guidedLeg=null,guidedOption=null;
    let approvedLivestock=null;
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
      const availability=this.transportAvailability();
      const method=availability.methods
        .find(item=>item.id===this.travelMethod);
      if(!method||method.surface!=="land")
        throw Error("The chosen transport is not eligible for this land journey.");
      const resumingApprovedLand=Boolean(approvedLandMethod);
      const hiredOffer=this.transportArrangement==="hire"&&!resumingApprovedLand?
        availability.offers.get(this.travelMethod):null;
      const hireSnapshot=hiredOffer?JSON.stringify({offer:hiredOffer,
        method:this.effectiveTransportMethod(method,availability)}):null;
      if(this.transportArrangement==="hire"&&!resumingApprovedLand&&!hiredOffer)
        throw Error("The hired land service is not offered at this checkpoint.");
      const effective=this.effectiveTransportMethod(method,availability);
      const selectedOperation=this.plannedTravelOperation(effective);
      const landLivestock=resumingApprovedLand?null:
        this.planLandVehicleBoarding(effective,this.transportArrangement,partyAtStart);
      // Validate the current Map Marker and inferred schedule before GM approval.
      this.resolveTravelRules({methodId:this.travelMethod,hoursPerDay:8},
        effective,selectedOperation);
      const approval=await foundry.applications.api.DialogV2.confirm({
        window:{title:resumingApprovedLand?"Resume approved land travel":"Confirm land travel"},
        content:el("div","GM confirmation: "+(resumingApprovedLand?
          "resume the approved journey":"follow the authored land route")+" using "+
          method.name+" ("+(this.transportArrangement==="hire"?"hired":"party-owned")+"). "+
          "Operating schedule: "+selectedOperation+". "+
          "The party token will move using Foundry's native movement and optional "+
          "World-time advancement. Costs are estimates; no automatic boarding, "+
          "resource changes or currency deductions occur."+
          (landLivestock?" Carrying "+
            landLivestock.manifest.resources.reduce((n,m)=>n+m.aboard,0)+
            " physical mounts in "+
            (landLivestock.manifest.capacityPerUnit===null?
              "unlimited default animal accommodation":
              landLivestock.manifest.capacityPerUnit+" animal spaces per vehicle")+
            "; estimated animal fare "+landLivestock.manifest.estimatedFareCp+
            " CP (not deducted).":"")+" Continue?"),
        rejectClose:false,modal:true
      });
      if(!approval)return false;
      const liveAvailability=this.transportAvailability();
      const liveWorld=liveAvailability.methods.find(m=>m.id===this.travelMethod);
      const liveMethod=liveWorld&&this.effectiveTransportMethod(liveWorld,liveAvailability);
      if(this.travelSession||this.pendingTransfer||this.scene?.id!==view.scene?.id||
          this.atlasProvider(this.scene).revision!==this.routeRevision||
          this.getPartyToken()?.id!==token.id||!liveMethod||
          this.plannedTravelOperation(liveMethod)!==selectedOperation)
        throw Error("The Scene, token or operating schedule changed during confirmation.");
      const current=this.atlasPoint(view,atlas,
        partyTokenCanvasCenter(token,this.scene.grid.size));
      if(Math.hypot(current.x-this.result.start.x,current.y-this.result.start.y)>
          Math.max(.01,this.scene.grid.size/50))
        throw Error("The party token moved during confirmation. Refresh its location.");
      if(!this.assessTravelMethod().guided)
        throw Error("The selected land transportation is no longer eligible.");
      if(landLivestock){
        const verified=this.planLandVehicleBoarding(liveMethod,
          this.transportArrangement,partyAtStart);
        if(JSON.stringify(verified)!==JSON.stringify(landLivestock))
          throw Error("Land vehicle animal boarding, availability or fare changed during approval.");
        approvedLivestock=verified.manifest;
      }
      if(hireSnapshot){
        const updated=this.transportAvailability();
        const revised=updated.methods.find(item=>item.id===this.travelMethod);
        const offer=updated.offers.get(this.travelMethod);
        if(!offer||!revised||JSON.stringify({offer,
          method:this.effectiveTransportMethod(revised,updated)})!==hireSnapshot)
          throw Error("The checkpoint's hired service or its terms changed during confirmation. Review the updated offer.");
      }
    }
    // A fresh cargo convoy requires explicit GM authorization, with live
    // stock/party/route revalidated after confirmation and before Journal creation.
    const previousConvoy=isUnfinishedJourneyLeg(this.recoveryRecord)?
      this.recoveryRecord.legs.at(-1)?.convoy:null;
    let approvedConvoy=previousConvoy?
      previousConvoy.schemaVersion===3?validateAggregateLandConvoy(previousConvoy):
        previousConvoy.schemaVersion===2?validateMixedLandConvoy(previousConvoy):
          validateWalkingCargoConvoy(previousConvoy):null;
    if(guidedLeg&&((this.convoyEnabled||this.mixedKeys.length||approvedConvoy)&&
        !isMixedLandTransport(guidedLeg.transport)))
      throw Error("Mixed land convoys cannot cross an unresolved transport transfer.");
    if(!approvedConvoy&&this.mixedKeys.length){
      approvedConvoy=await this.confirmMixedLandJourney(view,token,guidedLeg);
      if(!approvedConvoy)return false;
    }
    if(guidedLeg&&isMixedLandTransport(guidedLeg.transport)&&!approvedConvoy)
      throw Error("A checkpoint-bound convoy requires an approved rider manifest.");
    if(!approvedConvoy&&this.convoyEnabled){
      if(this.travelMethod!=="walking"||!this.assessTravelMethod().guided)
        throw Error(this.assessTravelMethod().reason??"Choose a valid walking cargo convoy.");
      const proposed=this.mixedConvoyPlan();
      const shown=atlasDisplaySpeed(proposed.speedPerHour,
        this.scene.grid.units,game.settings,game.system?.id);
      const speedUnit=shown.unit==="mi/hour"?"mph":
        shown.unit==="km/hour"?"km/h":shown.unit;
      const ordinary=proposed.gmWalkingPaceOverride?atlasDisplaySpeed(
        proposed.suggestedSpeedPerHour,this.scene.grid.units,
        game.settings,game.system?.id):null;
      const walkingException=ordinary?
        " GM walking-pace exception: the recommended pace is "+
          ordinary.value.toFixed(2)+" "+speedUnit+" but this Journey will "+
          "use "+shown.value.toFixed(2)+" "+speedUnit+
          ". You confirm all walkers can keep up; Actor movement speeds and "+
          "exhaustion are not changed automatically.":"";
      const approval=await foundry.applications.api.DialogV2.confirm({
        window:{title:"Confirm mixed walking and cargo travel"},
        content:el("div","GM confirmation: all "+proposed.travelers.length+
          " Group travelers will walk. Hire "+proposed.hires.map(h=>
            h.units+" cargo-only "+h.methodName).join(", ")+
          " at a shared pace of "+shown.value.toFixed(2)+" "+speedUnit+
          " ("+proposed.movingHours.toFixed(2)+
          " moving hours; estimated "+proposed.totalCp+
          " CP)."+walkingException+
          " No passengers board the cargo, and Atlas makes no booking, "+
          "currency deduction, Actor change or automatic hire payment. Continue?"),
        rejectClose:false,modal:true
      });
      if(!approval)return false;
      if(this.travelSession||this.journalStarting||this.pendingTransfer||
          !game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update")||
          this.scene.id!==view.scene?.id||
          this.atlasProvider(this.scene).revision!==this.routeRevision||
          this.getPartyToken()?.id!==token.id||
          this.result?.status!=="ok")
        throw Error("Scene, party or road changed during convoy confirmation.");
      const actual=this.atlasPoint(view,this.atlasProvider(this.scene),
        partyTokenCanvasCenter(token,this.scene.grid.size));
      if(Math.hypot(actual.x-this.result.start.x,actual.y-this.result.start.y)>
          Math.max(.01,this.scene.grid.size/50))
        throw Error("The party moved while confirming the convoy. Recalculate the route.");
      const updated=this.mixedConvoyPlan();
      if(JSON.stringify(updated)!==JSON.stringify(proposed))
        throw Error("Convoy passengers, supplies, pace or fare changed during confirmation. Review again.");
      approvedConvoy=validateWalkingCargoConvoy(updated);
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
    if(approvedConvoy)travel={...travel,speed:approvedConvoy.speedPerHour,
      methodId:"walking",methodLabel:approvedConvoy.schemaVersion===2?
        "Mixed Group transportation":"Walking with hired cargo",
      source:"approved-convoy"};
    if(guidedLeg&&approvedConvoy){
      if(!isMixedLandTransport(guidedLeg.transport)||approvedConvoy.schemaVersion!==2)
        throw Error("The approved mixed transportation does not match this checkpoint leg.");
      const weighted=route.terrainAware?route.cost:route.distance;
      const hours=this.transportationTransitionPlan()?.legs[0]?.hours;
      if(!Number.isFinite(hours)||Math.abs(weighted/travel.speed-hours)>1e-7)
        throw Error("The checkpoint leg duration differs from its approved convoy pace.");
    }else if(guidedLeg){
      const option=this.transportationTransitionPlan()?.legs[0]?.selectedOption;
      guidedOption=option;
      const info=guidedLeg.transport;
      const speedDistance=info.methodId==="walking"&&route.terrainAware?
        route.cost:route.distance;
      const hours=this.transportationTransitionPlan()?.legs[0]?.hours;
      if(!Number.isFinite(hours)||hours<=0)throw Error("This leg has no valid operating speed.");
      travel={...travel,methodId:info.methodId,
        speed:speedDistance/hours,source:info.arrangement==="hire"?
          "checkpoint-service":"group-transport",hoursPerDay:
            resolveNavigationTravelRules({settings:game.settings,
              systemId:game.system?.id,actorHoursPerDay:null}).dailyHours??8};
      const expectedLivestock=this.transportationTransitionPlan()?.legs[0]?.livestock??null;
      const mountNotice=expectedLivestock?
        " Physical mounts: "+expectedLivestock.resources.reduce((sum,m)=>sum+m.aboard,0)+
        (expectedLivestock.carried?" carried, ":" embarking, ")+
        expectedLivestock.resources.reduce((sum,m)=>sum+m.quantity-m.aboard,0)+
        " staying. "+expectedLivestock.units+" vehicle(s) with "+
        (expectedLivestock.capacityPerUnit===null?
          "unlimited animal accommodation":expectedLivestock.capacityPerUnit+
          " animal spaces each")+
        ". Animal fare estimate: "+
        expectedLivestock.estimatedFareCp+" CP, already included in the service quote.":"";
      const approval=await foundry.applications.api.DialogV2.confirm({
        window:{title:"Confirm travel to "+guidedLeg.checkpoint.name},
        content:el("div","GM confirmation: travel to "+guidedLeg.checkpoint.name+
          " using "+info.methodName+" ("+info.arrangement+"). "+
          "Native token movement and optional confirmed World-time advancement will occur. "+
          "Estimated fare is for reference only: no booking, currency deduction, "+
          "Actor mutation or forced terrain bypass occurs."+mountNotice+
          " Stop at the checkpoint?"),
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
          after.selectedValue!==option?.value||
          (after.operation??"normal")!==(guidedLeg.transport.operation??"normal")||
          after.errors.length||
          JSON.stringify(after.livestock??null)!==JSON.stringify(expectedLivestock))
        throw Error("The selected transportation, livestock or fare changed during confirmation. Review the updated checkpoint offer.");
      approvedLivestock=after.livestock??null;
    }
    // Re-read the native roster after GM approval. No partial selection can
    // move before its approved, versioned manifest is persisted to the Journal.
    const unfinished=isUnfinishedJourneyLeg(this.recoveryRecord);
    if(unfinished&&this.recoveryRecord?.legs.at(-1)?.livestock){
      const group=this.getPartyToken()?.actor;
      if(group?.type!=="group")throw Error("The approved livestock Group is unavailable.");
      const roster=projectGroupTransportation(group,readGroupTransportation(game.settings),
        availableNavigationTravelMethods(game.settings,game.system?.id));
      approvedLivestock=assertRecoveredLivestock(this.recoveryRecord,roster);
    }
    const partyNow=this.sourceMode==="party"?this.partyTravelSelection(
      availableNavigationTravelMethods(game.settings,game.system?.id)):null;
    if(partySignature!==null&&JSON.stringify({members:partyNow?.roster?.members,
      selectedIds:partyNow?.selectedIds,
      livestockDecisions:this.livestockDecisions})!==partySignature)
      throw Error("The Group roster or participation changed during confirmation. Review and approve again.");
    if(nativeGroup&&!partyNow)
      throw Error("The Group roster cannot be validated. No movement was approved.");
    if(!unfinished&&!approvedLivestock&&
        this.recoveryRecord?.legs.at(-1)?.livestock&&partyNow){
      const landMethod=guidedLeg?.transport?.methodId??this.travelMethod;
      const surface=guidedLeg?.transport?.surface??"land";
      if(surface!=="land")
        throw Error("The prior livestock allocation must be reapproved for this vessel.");
      approvedLivestock=planJourneyLivestock(partyNow.roster,
        this.livestockDecisions,{surface:"land",methodId:landMethod,
          units:1,capacityPerUnit:null,fareCp:0});
      if(approvedConvoy?.schemaVersion===2){
        const accompanying=new Set(approvedLivestock.resources.filter(m=>m.aboard>0)
          .map(m=>m.actorId));
        if(approvedConvoy.methods.flatMap(m=>m.resourceIds??[])
          .some(id=>!accompanying.has(id)))
          throw Error("A left-behind mount cannot be assigned to a land convoy.");
      }
    }
    const approvedParticipation=unfinished?
      this.recoveryRecord?.legs.at(-1)?.participation??null:
      nativeGroup&&partyNow?createJourneyParticipation(partyNow.roster,partyNow.selectedIds,{
        checkpointId:guidedLeg?.transport?.departureCheckpointId??null,
        methodKey:(guidedLeg?.transport?.arrangement??this.transportArrangement)+"|"+
          (guidedLeg?.transport?.methodId??this.travelMethod),
        assignments:approvedConvoy?.schemaVersion===2?
          Object.fromEntries(approvedConvoy.travelers.map(t=>[t.actorId,t.methodKey])):{}
      }):null;
    if(approvedConvoy?.schemaVersion===2&&approvedParticipation){
      const convoyIds=new Set(approvedConvoy.travelers.map(t=>t.actorId));
      if(approvedParticipation.people.some(p=>p.traveling!==convoyIds.has(p.actorId)))
        throw Error("Approved convoy passengers differ from the selected Journey travelers.");
    }
    const approvedPath=captureApprovedJourneyPath(route);
    const paths=navigationCanvasLegPaths(view,atlas,route);
    const routeWaypoints=createGuidedTokenWaypoints(paths,token,this.scene.grid?.size);
    const nativeContinuous=guidedLeg?.transport?.operation==="continuous";
    const waypoints=nativeContinuous?anchorNativeTokenWaypoints(routeWaypoints,
      token,this.scene.grid.size):routeWaypoints;
    const snapshot=createNavigationItinerary({
      sceneId:this.scene.id,sceneName:this.scene.name??"",
      sceneUnits:this.scene.grid?.units??"",atlasRevision:atlas.revision,
      route,...this.roadNaming(atlas,route),travel
    });
    const itinerary=guidedLeg?{...snapshot,transport:guidedLeg.transport,
      ...(approvedLivestock?{livestock:approvedLivestock}:{}),
      ...(approvedParticipation?{participation:approvedParticipation}:{}),
      ...(approvedConvoy?{convoy:approvedConvoy}:{})}:{
      ...snapshot,
      ...(approvedLivestock?{livestock:approvedLivestock}:{}),
      ...(approvedParticipation?{participation:approvedParticipation}:{}),
      ...(approvedConvoy?{convoy:approvedConvoy}:{}),
      travel:{...snapshot.travel,
        methodId:travel.methodId??this.travelMethod,
        methodName:travel.methodLabel??this.travelMethod,
        arrangement:this.transportArrangement,operation:
          this.plannedTravelOperation(this.effectiveTransportMethod(
            this.transportAvailability().methods.find(m=>m.id===this.travelMethod)))}
    };
    const playback=calculateGuidedPlayback({
      route,travel,paths,
      gridSize:this.scene.grid?.size,
      secondsPerHour:this.recoveryRecord?.playbackSecondsPerHour??
        this.playbackSecondsPerHourOverride??readGuidedPlaybackSetting(game.settings)
    });
    // A zero-pixel native fragment cannot independently prove movement/time.
    const chunks=coalesceSubpixelTravelChunks(planGuidedTravelChunks(waypoints,{
      movementSpeed:playback.movementSpeed,gridSize:this.scene.grid.size
    }));
    if(!chunks)throw Error("The approved route has no distinct native pixel movement.");
    const totalDistance=chunks.reduce((sum,chunk)=>sum+chunk.distance,0);
    const schedule=new GuidedTravelDayTracker({travelHours:playback.travelHours,
      rules:this.resolveCurrentLegRules(travel,guidedOption,guidedLeg)});
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
      playbackSecondsPerHour:playback.secondsPerHour,visualRestHold:null,
      skipVisualPlayback:false,consolidatePlayerRestPrompts:false,
      confirmedRestNotices:0,
      transportLeg:guidedLeg,pendingPassengerRest:null,
      completedDistance:0,totalDistance,currentChunk:null,timer:null,clock:null,
      confirmedSegments:0,restCheckpointed:false};
    session.finished=new Promise(resolve=>{session.resolveFinished=resolve;});
    // The Journal is the one durable journey store. Create it before any
    // movement; a failed Journal write cannot leave an unrecorded trip.
    this.journalStarting=true;
    let freshJourney=false;
    try{
      const recovered=this.recoveryRecord;
      freshJourney=!recovered;
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
        resumeJourneyRecord(recovered,{itinerary,atlasRevision:atlas.revision,approvedPath,
          // The recovery target is the current leg checkpoint, not a GM edit
          // to the original Point B. Preserve the final destination on resume.
          journeyDestination:recovered.routeTargets||isUnfinishedJourneyLeg(recovered)?
            null:this.end}):
        createJourneyRecord({sceneId:this.scene.id,tokenId:token.id,
          atlasRevision:atlas.revision,itinerary,journeyDestination:this.end,
          routeTargets,initialAnchor,approvedPath,
          playbackSecondsPerHour:playback.secondsPerHour,
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
        journal:this.recoveryJournal,updatePage:false});
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
    if(freshJourney)this.announceCommittedJourney({
      journal:session.journal,previous:null,committed:session.journeyRecord,
      type:"journey.started",subject:"your destination"});
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
          // Fold subpixel fragments forward into unexecuted movement, never
          // backwards across a previously confirmed day checkpoint.
          const suffix=coalesceSubpixelTravelChunks(
            [halves[1],...chunks.slice(index+1)],{allowTailMerge:false});
          if(!hasNativePixelDisplacement(halves[0].waypoints)||!suffix){
            // Obtain explicit GM authority BEFORE submitting a movement whose
            // day boundary has no separately provable native pixel position.
            const approved=await this.waitForDailyTravelChoice(session,
              {allowEarly:true});
            if(!approved){reachedEnd=false;break;}
            index--;continue;
          }
          chunks.splice(index,chunks.length-index,halves[0],...suffix);
          chunk=halves[0];
        }
        // Normal and overtime movement use the same durable native interval
        // contract as continuous voyage. The day tracker still decides when
        // to offer rests or forced-march choices BETWEEN these intervals.
        let checkpointStatus="moving";
        try{
          const visual=liveJourneyPlayback(playback,
            session.playbackSecondsPerHour,{skip:session.skipVisualPlayback});
          const chunkMovingHours=playback.travelHours*chunk.distance/totalDistance;
          const one=planNativeCheckpointPath(chunk.waypoints,{
            movementSpeed:playback.movementSpeed,gridSize:session.gridSize,
            secondsPerCheckpoint:10,totalMovingHours:chunkMovingHours
          });
          if(one.checkpoints.length!==1)
            throw Error("Ordinary travel chunk is not one bounded native interval.");
          const checkpoint=one.checkpoints[0];
          // Authoritative progress uses the originally approved travel length,
          // not a rounded native waypoint's potentially different length.
          checkpoint.distance=chunk.distance;
          checkpoint.completedDistance=session.completedDistance+chunk.distance;
          checkpoint.completedMovingHours=chunkMovingHours;
          const completed=await this.runNativeContinuousLeg(session,{
            plan:{...one,totalDistance},playback,atlas,view,guidedLeg,
            ordinary:true,visual
          });
          if(!completed){
            reachedEnd=false;
            interruptedReason="Native movement stopped before the current stretch was confirmed.";
            break;
          }
          checkpointStatus=session.completedDistance/totalDistance>=.99999?
            (guidedLeg?"paused":"completed"):"moving";
        }catch(error){
          reachedEnd=false;clockFailed=true;
          interruptedReason=session.phase==="ending"?
            "Journey ended at the last confirmed road stretch. Any unconfirmed "+
              "native movement must be reviewed before another route begins.":
            "Native ordinary movement could not be reconciled: "+
              (error.message||String(error));
          break;
        }
        if(checkpointStatus==="paused")session.phase="checkpoint-arrival";
        // The pending rest was released after its confirmed sailing hours.
        // Refresh the footer once the completed event is durable in the Journal,
        // so its disabled controls are not left stale until the next checkpoint.
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
        const finalStatus=arrived?(guidedLeg?"paused":"completed"):
          session.phase==="ending"&&!session.journeyRecord.pendingNativeMove?
            "ended":"interrupted";
        try{
          // The final native chunk or the continuous-voyage callback may have
          // already durably published this exact terminal/transfer decision.
          // Never repeat the Journal summary write or advance the target twice.
          if(session.journeyRecord.status!==finalStatus)
            await this.saveJourneyCheckpoint(session,finalStatus);
        }
        catch(error){
          interruptedReason="The Journey Journal could not finalize: "+
            (error.message||String(error));
          arrived=false;atlasWarn("journey",interruptedReason);
        }
        if(arrived&&session.confirmedRestNotices>0){
          // One optional player notice after distinct GM-authorized rests.
          // Not a merged gameplay Long Rest or an additional World-time write.
          await this.offerPlayerRestPrompt(session,"long",{
            count:session.confirmedRestNotices});
          session.confirmedRestNotices=0;
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
      session.visualRestHold?.cancel();
      session.resumeWaiter?.();
      session.restWaiter?.(null);
      if(this.travelSession===session){
        this.travelSession=null;
        this.retainInterruptedJourney(session);
        if(this.active)void this.render(true);
      }
      if(session.canvasSuspended)await this.settleSuspendedNativeJourney(session);
      session.resolveFinished?.();
    }
  }

  /** Finish only after the submitted operation and prior Journal writer settle.
   * Never copy an in-memory clock ledger into an unconfirmed durable intent. */
  async settleSuspendedNativeJourney(session){
    try{
      // The durable record, not the in-memory clock ledger, determines
      // whether the interval still needs to be reconciled after a redraw.
      await session.journalQueue?.catch(()=>{});
      const saved=validateJourneyRecord(session.journal.getFlag(MODULE_ID,JOURNEY_JOURNAL_FLAG));
      if(saved.status==="moving"&&game.user?.isGM&&
          game.users?.activeGM?.id===game.user.id&&
          session.journal.canUserModify?.(game.user,"update")){
        const interrupted=validateJourneyRecord({...saved,status:"interrupted",
          updatedAt:new Date().toISOString()});
        await this.journeyJournalStore.save(interrupted,{journal:session.journal,updatePage:true});
      }
    }catch(error){
      atlasWarn("journey","Suspended Journey could not publish its last durable checkpoint",error);
    }finally{
      if(this.suspendedNativeSession===session)this.suspendedNativeSession=null;
    }
  }

  /** Same-canvas failures need the same saved-Journey lock as canvas reopen. */
  retainInterruptedJourney(session){
    if(!session?.journal||!session.journeyRecord||this.pendingTransfer||
        this.completedRoute||this.scene?.id!==session.sceneId||
        !["moving","interrupted","paused"].includes(session.journeyRecord.status))return;
    this.recoverableJourney=session.journal;
    this.recoveryRecord=null;this.recoveryJournal=null;
    this.journeyJournal=session.journal;
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
    this.announceCommittedJourney({journal:this.recoveryJournal,
      previous:this.recoveryRecord,committed:next,type:"journey.ended"});
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
    this.announceCommittedJourney({journal:this.recoveryJournal,
      previous:this.recoveryRecord,committed:next,
      type:"destination.reached",subject:pending.checkpoint.name});
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
    const previous=this.recoveryRecord?.legs?.at(-1)?.convoy;
    if(this.recoveryRecord){
      this.travelMethod="walking";this.transportArrangement="owned";
      this.transportOperation="normal";this.transportJourneyOverrides=null;
      this.transportHireTerms=null;this.transportHireDenomination=null;
      this.mixedKeys=[];this.mixedMethodOverrides={};this.mixedAssignments={};this.mixedUnits={};
      this.mixedRiderCounts={};this.convoyEnabled=false;this.convoyCargoQuantities={};
      this.convoyPace=null;
      // A new leg starts from the last approved cohort as an editable draft;
      // it is never automatically approved, and does not edit native Groups.
      const savedParticipation=this.recoveryRecord.legs.at(-1)?.participation;
      const savedLivestock=this.recoveryRecord.legs.at(-1)?.livestock;
      // Derive the next draft from native Group data BEFORE applying prior
      // mount exclusions. An empty draft cannot yet pass the all-mount validator.
      const actor=savedParticipation||savedLivestock?
        this.getPartyToken()?.actor:null;
      if((savedParticipation||savedLivestock)&&
        (game.system?.id!=="dnd5e"||actor?.type!=="group"))
        throw Error("Cannot reconcile saved travelers or mounts with the native Group.");
      const roster=savedParticipation||savedLivestock?
        projectGroupTransportation(actor,readGroupTransportation(game.settings),
          availableNavigationTravelMethods(game.settings,game.system?.id)):null;
      const live=roster?projectPartyTravelSelection(roster,{mode:"all"}):null;
      const retained=savedParticipation?priorJourneySelection(this.recoveryRecord,roster):null;
      this.partySelectionMode=retained&&retained.length!==live.members.length?
        "selected":"all";
      this.partySelectedIds=this.partySelectionMode==="selected"?retained:[];
      this.livestockDecisions=roster?suggestedLivestockBoarding(
        this.recoveryRecord,roster):{};
    }
    const atlas=this.atlasProvider(this.scene);
    this.syncPartyDeparture(view,atlas);
    this.calculateRoute(view,atlas);
    if(previous?.schemaVersion===2&&this.result?.status==="ok"){
      // A prior hire is not a reservation at this new checkpoint.
      const availability=this.transportAvailability();
      const party=this.partyTravelSelection(availability.all);
      const allowed=new Set(availability.methods.filter(m=>m.surface==="land")
        .flatMap(m=>[...(m.id==="walking"||availability.owned.has(m.id)?
          ["owned|"+m.id]:[]),...(availability.offers.has(m.id)?["hire|"+m.id]:[])]));
      const land=projectTransportationRouteLegs(this.result,atlas,
        validateTravelPresets(game.settings.get(MODULE_ID,TRAVEL_PRESET_SETTING)).presets)
        .legs[0]?.surface==="land";
      const keys=land?previous.methods.map(m=>m.key).filter(key=>allowed.has(key)):[];
      if(keys.length===1&&keys[0]!=="owned|walking"&&allowed.has("owned|walking"))
        keys.unshift("owned|walking");
      if(party&&!party.empty&&keys.length>1){
        this.mixedKeys=keys;
        const ids=new Set(party.selectedIds);
        this.mixedAssignments=Object.fromEntries(previous.travelers.filter(t=>
          ids.has(t.actorId)&&keys.includes(t.methodKey)).map(t=>[t.actorId,t.methodKey]));
      }
    }
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
      this.mixedKeys=[];this.mixedMethodOverrides={};this.mixedAssignments={};this.mixedUnits={};
      this.calculateRoute(view,atlas);
    }
    this.travelNotice=this.end?
      "Continuing from "+pending.checkpoint.name+" toward the saved destination. "+
        (this.mixedKeys.length?"Compatible assignments retained as a draft. Review riders, available units and fares before approving this leg.":
          "Select transportation for the next leg."):
      "Checkpoint confirmed at "+pending.checkpoint.name+". "+
        (duplicateArrival?"The saved Point B resolves back to this same checkpoint. ":"")+
        "Choose the next destination to continue this Journey without replaying past travel.";
    this.draw();await this.render(true);
    return true;
  }

  /** A live speed edit is visual only and never retimes a running v14 move.
   * A confirmed native movement checkpoint persists the preference with the
   * already-approved Journey; reload before then retains the previous value. */
  setLiveJourneyPlaybackSpeed(value){
    const session=this.travelSession;
    if(!game.user?.isGM||!game.user?.id||
        game.users?.activeGM?.id!==game.user.id||
        !canAdjustLiveJourneyVisuals(session))return false;
    validatePlaybackSetting(value);
    session.playbackSecondsPerHour=value;
    if(this.active)void this.render(true);
    return true;
  }

  /** Opt-in visual fast-forward: native token.move still validates constraints,
   * records every confirmed chunk and requires each GM rest decision. */
  async setSkipVisualJourney(skip){
    const session=this.travelSession;
    if(!game.user?.isGM||!game.user?.id||
        game.users?.activeGM?.id!==game.user.id||
        !canAdjustLiveJourneyVisuals(session))return false;
    if(!skip){
      session.skipVisualPlayback=false;
      session.consolidatePlayerRestPrompts=false;
      if(this.active)void this.render(true);
      return true;
    }
    const approved=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Skip visual Journey playback"},
      content:"Skip future token animations and confirmed visual rest waits? "+
        "Foundry will still validate native movement, save the Journey, "+
        "advance World time only for confirmed actions, and require the GM "+
        "to decide every scheduled rest. This does not teleport the party "+
        "or consolidate in-game rest periods.",
      rejectClose:false,modal:true
    });
    if(!approved||this.travelSession!==session||
        !canAdjustLiveJourneyVisuals(session))return false;
    session.skipVisualPlayback=true;
    // Consolidation changes only OPTIONAL player-facing prompts, never the
    // number or duration of approved gameplay rests.
    if(expectedAdditionalTravelBreaks(session)>=2){
      session.consolidatePlayerRestPrompts=Boolean(
        await foundry.applications.api.DialogV2.confirm({
          window:{title:"Consolidate player rest notices?"},
          content:"Several GM rest decisions may still be required. "+
            "Would you prefer one player-facing chat prompt at the end "+
            "of this leg instead of one prompt after each confirmed rest? "+
            "All distinct in-game rests and their World-time/Journal "+
            "records remain separate.",
          rejectClose:false,modal:true
        }));
    }
    if(this.travelSession!==session)return false;
    // This visual timer exists only after the rest was already committed.
    if(session.phase==="rest-holding")session.visualRestHold?.finish?.();
    this.travelNotice="Skipping visual playback at the next confirmed native "+
      "movement boundary. Every required rest still needs GM approval.";
    if(this.active)void this.render(true);
    return true;
  }

  /** A player prompt is an explicit GM-approved ChatMessage, not an Actor rest.
   * Failure to notify players can never replay or invalidate a confirmed rest. */
  async offerPlayerRestPrompt(session,action,{count=1}={}){
    if(this.travelSession!==session||!game.user?.isGM||!game.user?.id||
        game.users?.activeGM?.id!==game.user.id)return false;
    // This opt-in chat message must be grounded in durably saved rest events,
    // not merely a transient button click or an in-flight break.
    const events=session.journeyRecord?.legs?.at(-1)?.events??[];
    const confirmed=events.filter(event=>
      ["long","overnight"].includes(event.action)).length;
    if(confirmed<count||
        typeof globalThis.foundry?.applications?.api?.DialogV2?.confirm!=="function")
      return false;
    const label=count>1?count+" confirmed rest periods":
      action==="long"?"Long Rest":
      action==="overnight"?"Overnight Camp":"Short Rest";
    let approved=false;
    try{
      approved=await foundry.applications.api.DialogV2.confirm({
        window:{title:"Notify players: rest complete?"},
        content:"The "+label+" is already recorded in the Journey. "+
          "Send players a public chat notice to review their character sheets? "+
          "Atlas will not automatically invoke any Actor rest action.",
        rejectClose:false,modal:true
      });
    }catch(error){
      atlasWarn("journey","Rest notification dialog unavailable",error);
      return false;
    }
    if(!approved||this.travelSession!==session||
        !game.user?.isGM||!game.user?.id||
        game.users?.activeGM?.id!==game.user.id)return false;
    try{
      if(typeof globalThis.ChatMessage?.create!=="function")
        throw Error("Foundry ChatMessage.create is unavailable.");
      await globalThis.ChatMessage.create({
        content:"<p><strong>Atlas Journey:</strong> "+
          "The GM-confirmed "+label+" is complete. "+
          "Review character resources with your GM before continuing.</p>",
        whisper:[],blind:false
      });
      return true;
    }catch(error){
      atlasWarn("journey","Player rest completion notice could not post",error);
      globalThis.ui?.notifications?.warn?.(
        "Rest was confirmed, but the player chat notice could not post.");
      return false;
    }
  }

  /** Pause at the next short native movement boundary (nominally ~2s). */
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
    session.visualRestHold?.cancel();
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
    this.transferLegOperations={};
    this.partySelectionMode="all";this.partySelectedIds=[];
    this.convoyEnabled=false;
    this.convoyCargoQuantities={};
    this.convoyPace=null;
    this.mixedKeys=[];
    this.mixedMethodOverrides={};
    this.mixedAssignments={};
    this.mixedRiderCounts={};
    this.mixedUnits={};
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

  stop({suspendNative=false}={}) {
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
      if(suspendNative&&session.nativeActive&&session.nativeSuspension&&
          session.phase!=="ending"){
        session.canvasSuspended=true;
        this.suspendedNativeSession=session;
        session.nativeSuspension.abort();
        session.resumeWaiter?.();
        session.visualRestHold?.cancel();
        if(session.timer!==null)clearInterval(session.timer);
        // Let the old operation settle before any further Journal writes.
      }else{
        const teardown=assessJourneyTeardown(session);
        if(!teardown.terminal)void this.saveJourneyCheckpoint(session,
          teardown.interruptedStatus).catch(error=>
          atlasWarn("journey","Journey interrupted but its Journal could not update",error));
        this.stopGuidedTravel({render:false});
      }
    }
    this.travelSession=null;
    this.mapPickActive=false;
    const pickPrompt=this.mapPickPrompt;
    this.mapPickPrompt=null;this.mapPickPrevious=null;
    this.playbackSecondsPerHourOverride=null;
    this.directionsExpanded=false;
    this.navigationTab="travel";
    this.partySelectionMode="all";
    this.partySelectedIds=[];
    void pickPrompt?.close?.();
    this.pointerTarget?.removeEventListener?.("pointerdown",this.pointerDown,true);
    this.pointerTarget = null;
    if(this.routePulseTicker)this.routePulseOwner?.ticker?.remove?.(this.routePulseTicker);
    this.routePulseTicker=null;this.routePulseOwner=null;
    this.overlay?.parent?.removeChild?.(this.overlay);
    this.overlay?.destroy?.();
    this.overlay = null;
    this.scene = null;
    this.sourceMode = "map";
    this.destinationMode="checkpoint";
    this.selectedCheckpointId=null;
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
      completedPercent:Math.floor(this.travelProgress),phase:session?.phase??null,
      // Distinguish a redraw between durable checkpoints from one occurring
      // during native movement/clock confirmation; never credit a visual frame.
      nativeChunkInFlight:Boolean(session?.currentChunk),
      pendingNativeCheckpoint:Boolean(session?.journeyRecord?.pendingNativeMove),
      confirmedDistance:session?.completedDistance??null,
      lastConfirmedAnchor:session?.lastConfirmedAnchor?.point??null,
      worldTime:game.time?.worldTime??null,
      journalId:session?.journal?.id??null
    });
    if(session&&["canvasTearDown","canvasReady"].includes(reason)){
      // The provisional notice is browser-local, never gameplay state. It can
      // only become public after the canvas is ready and a saved Journal review
      // shows that a GM decision really is pending. A second teardown without
      // an active session must NOT erase the earlier provisional notice.
      this.canvasRecoveryNotice=session?.journal?.id&&
        session.journeyRecord?.createdAt&&
        !["paused","ending"].includes(session.phase)?{
          reason,phase:session.phase,sceneId:session.sceneId,
          tokenId:session.journeyRecord.tokenId,
          createdAt:session.journeyRecord.createdAt,
          journal:session.journal,session
        }:null;
      this.canvasRecoveryContinuing=null;
    }
    if(["canvasTearDown","canvasReady"].includes(reason)&&this.active&&this.rendered){
      this.windowRestorePending={sceneId:this.scene.id,
        session,
        journalId:session?.journal?.id??null,
        confirmedPause:assessJourneyTeardown(session).confirmedPause};
    }
    if(mayAttemptCanvasJourneyRecovery(reason,session)){
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
        this.windowRestorePending?
          "Atlas journey interrupted by a Foundry canvas redraw. " +
            "Navigation will reopen for GM review when the same Scene is ready.":
          "Atlas journey interrupted by a Foundry canvas redraw. Reopen Navigation to recover it.";
      atlasWarn("lifecycle",message,{reason,sceneId:session.sceneId});
      globalThis.ui?.notifications?.warn?.(message);
    }
    this.stop({suspendNative:["canvasTearDown","canvasReady"].includes(reason)});
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
      if(!await this.recoverSavedJourneyWithNativeReview({automatic:true}))
        throw Error("The saved Journey could not be restored after the canvas rebuild.");
      this.autoResumePending=null;
      // A native move may have durably reached an authored port immediately
      // before the canvas was rebuilt. Restoring this checkpoint decision is
      // automatic, but the NEXT transport leg has not been approved. Do not
      // call startGuidedTravel while a transfer decision is pending.
      if(this.pendingTransfer){
        atlasDebug("journey","Canvas recovery restored confirmed checkpoint decision",{
          sceneId:pending.sceneId,journalId:pending.journalId,
          checkpointId:this.pendingTransfer.checkpoint?.id??null
        });
        return true;
      }
      // Automatic continuation is authorized only for the remaining distance
      // of the SAME approved leg. A fully confirmed leg with no pending
      // transfer cannot authorize an entirely new route on its own.
      if(!isUnfinishedJourneyLeg(this.recoveryRecord)){
        this.travelNotice="The last approved leg is already confirmed. " +
          "Review the recovered Journey before starting another leg.";
        if(this.active)void this.render(true);
        atlasDebug("journey","Canvas recovery restored confirmed leg without travel",{
          sceneId:pending.sceneId,journalId:pending.journalId});
        return true;
      }
      atlasDebug("journey","Automatically continuing after canvas rebuild",{
        sceneId:pending.sceneId,journalId:pending.journalId});
      const notice=this.canvasRecoveryNotice;
      this.canvasRecoveryContinuing=notice;
      void this.startGuidedTravel().then(success=>{
        if(this.canvasRecoveryContinuing!==notice)return;
        this.canvasRecoveryContinuing=null;
        if(success)this.canvasRecoveryNotice=null;
        else void this.announceCanvasReviewAfterCanvasReady();
      }).catch(error=>{
        if(this.canvasRecoveryContinuing===notice){
          this.canvasRecoveryContinuing=null;
          void this.announceCanvasReviewAfterCanvasReady();
        }
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

  /** Preserve the GM window across a same-Scene canvas rebuild. This never
   * resumes a native TokenDocument move. A fully confirmed manual pause may
   * restore its read-only route preview; a pending intent remains locked. */
  async restoreWindowAfterCanvasReady(){
    const pending=this.windowRestorePending;
    if(!pending)return false;
    this.windowRestorePending=null;
    await this.canvasTeardownClose;
    const view=this.canvasProvider();
    if(!game.user?.isGM||!view?.ready||view.scene?.id!==pending.sceneId||
        !view.scene.canUserModify?.(game.user,"update"))return false;
    if(this.active)return true;
    // The old Canvas may have disappeared during a clock/Journal await.
    // A safe preview requires those writes and the movement loop to settle.
    let settled=true;
    if(pending.session){
      let timeout;
      settled=await Promise.race([
        Promise.all([pending.session.finished??Promise.resolve(),
          pending.session.journalQueue??Promise.resolve()])
          .then(()=>true,()=>false),
        new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),8000);})
      ]).finally(()=>clearTimeout(timeout));
    }
    try{
      this.activate();
      if(pending.confirmedPause&&settled&&
          this.recoverableJourney?.id===pending.journalId){
        try{
          await this.recoverSavedJourneyWithNativeReview({automatic:true});
          this.travelNotice="A canvas refresh ended the native movement. " +
            "The confirmed paused route is restored; select Travel Route to resume.";
          if(this.active)void this.render(true);
        }catch(error){
          atlasWarn("journey","Paused preview needs GM recovery after canvas refresh",error);
        }
      }
      if(!settled){
        this.travelNotice="The prior Canvas stopped before its Journey writes settled. " +
          "Review the saved Journey and TokenDocument before any new movement.";
        if(this.active)void this.render(true);
        atlasWarn("journey","Navigation reopened without automatic preview; old writes did not settle",{
          sceneId:pending.sceneId,journalId:pending.journalId});
      }
      atlasDebug("lifecycle","Navigation window reopened after canvas refresh",{
        sceneId:pending.sceneId,pausedPreview:pending.confirmedPause});
      return true;
    }catch(error){
      atlasWarn("lifecycle","Navigation window could not reopen after canvas refresh",error);
      return false;
    }
  }

  /** Best-effort notice after normal canvas recovery has had its chance.
   * A raw canvasTearDown cannot claim a pause: it may immediately auto-resume
   * the same approved leg. Only the active Scene GM and matching saved Journal
   * may notify players that movement is actually waiting for review. */
  async announceCanvasReviewAfterCanvasReady(){
    const notice=this.canvasRecoveryNotice;
    if(!notice||this.canvasRecoveryContinuing===notice||this.travelSession||
        this.autoResumePending)
      return false;
    const view=this.canvasProvider(),me=globalThis.game?.user;
    if(!me?.isGM||globalThis.game?.users?.activeGM?.id!==me.id||
        !view?.ready||view.scene?.id!==notice.sceneId||
        !view.scene.canUserModify?.(me,"update")){
      if(this.canvasRecoveryNotice===notice)this.canvasRecoveryNotice=null;
      return false;
    }
    let timeout;
    const settled=await Promise.race([
      Promise.all([notice.session.finished??Promise.resolve(),
        notice.session.journalQueue??Promise.resolve(),
        this.canvasTeardownClose]).then(()=>true,()=>false),
      new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),8000);})
    ]).finally(()=>clearTimeout(timeout));
    if(this.canvasRecoveryNotice!==notice)return false;
    this.canvasRecoveryNotice=null;
    if(!settled){
      atlasWarn("announcement","Canvas review notice withheld: prior Journey writes did not settle",{
        sceneId:notice.sceneId,journalId:notice.journal.id});
      return false;
    }
    let saved;
    try{saved=validateJourneyRecord(notice.journal.getFlag(
      MODULE_ID,JOURNEY_JOURNAL_FLAG));}
    catch(error){
      atlasWarn("announcement","Canvas review notice withheld: saved Journal unavailable",error);
      return false;
    }
    if(saved.sceneId!==notice.sceneId||saved.tokenId!==notice.tokenId||
        saved.createdAt!==notice.createdAt)return false;
    const type=canvasRecoveryAnnouncementType({reason:notice.reason,
      phase:notice.phase,record:saved,requiresGM:true});
    if(!type)return false;
    atlasDebug("announcement","Canvas recovery requires GM review",{
      sceneId:notice.sceneId,journalId:notice.journal.id,status:saved.status,
      pendingNativeMove:Boolean(saved.pendingNativeMove),type});
    return this.announceCommittedJourney({journal:notice.journal,committed:saved,
      type,canvasRecovery:true,gmReviewRequired:true,
      subject:"Travel is on hold"});
  }

  /** One canonical speed source for the live summary and itinerary snapshot. */
  resolveTravel({excludeConvoy=false}={}){
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
    if(this.travelMethod==="walking"&&!excludeConvoy){
      const active=this.travelSession?.journeyRecord?.legs?.at(-1);
      const saved=this.recoveryRecord?.legs?.at(-1);
      const approved=active?.convoy?active:saved?.convoy&&
        isUnfinishedJourneyLeg(this.recoveryRecord)?saved:null;
      if(approved)return {sceneUnit,travel:{...methodTravel,
        speed:approved.speedPerHour,source:"approved-convoy",
        methodLabel:"Walking with hired cargo"}};
      if(this.mixedKeys.length||this.convoyEnabled){
        try{
          const planned=this.mixedKeys.length?
            this.mixedLandPlan(methodTravel):this.mixedConvoyPlan(methodTravel);
          if(planned)return {sceneUnit,travel:{...methodTravel,
            speed:planned.speedPerHour,source:"mixed-convoy",
            methodLabel:planned.schemaVersion===2?
              "Mixed party transportation":"Walking with hired cargo"}};
        }catch{/* Invalid assignments block travel; preview stays read-only. */}
      }
    }
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
              `${leg.convoy?"Mixed Group transportation":
                leg.transport?.methodName??leg.travelMethod?.name??"On foot"}`,
            manifest:describeConfirmedTravelers(leg.convoy).map(m=>m.label)
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

    const directionsTab=el("div"),speedTab=el("div");
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
    const atlas=this.atlasProvider(this.scene);
    const destination=verifiedJourneyDestinationName(atlas,
      session.journeyRecord?.destination??this.end);
    const urgent=["rest-choice","rest-holding","paused","rest-error",
      "ending","checkpoint-arrival"].includes(session.phase)||
      /interrupt|failed|blocked|cannot|review|required|error/i.test(
        this.travelNotice??"");
    body.append(...renderNavigationStageIntro({
      title:"Journey in progress to "+(destination??"selected destination"),
      notice:urgent?this.travelNotice:null
    }));
    const summary=renderNavigationSummaryMetrics({metrics:[
      {label:"Current Leg Distance",value:showDistance(leg?.distance??this.result?.distance??0)},
      {label:"Travel Time",value:formatGuidedWorldTime(Math.round(hours*3600))},
      {label:"Total Trip",value:formatNavigationDuration(plan.totalHours,24)}
    ],progressPercent:this.travelProgress});
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
    // The World-clock number is useful. Remove generic hints, redundant
    // method text and technical A→B target disclosures from the GM Journey tab.
    if(session.clock||this.worldTimeAdvancedSeconds>0){
      const clock=el("p",this.worldTimeStatus());
      clock.style.cssText="margin:0;font-size:.84em;font-weight:600;";
      body.append(clock);
      this.worldTimeUI=clock;
    }else this.worldTimeUI=null;
    const routeLegs=leg?.legs??this.result?.legs??[];
    const naming=this.roadNaming(atlas,leg??this.result);
    const steps=buildNavigationSteps(routeLegs,naming.directionRoadName,naming);
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
      distanceValue:step.distance,
      hoursValue:navigationHours(leg?.terrainAware?step.cost:step.distance,speed),
      info:showDistance(step.distance)+" · "+
        formatGuidedWorldTime(Math.round(navigationHours(
          leg?.terrainAware?step.cost:step.distance,speed)*3600)),
      surface:[step.terrain==="Unspecified terrain"?null:step.terrain,
        step.regionName&&step.regionName!==step.terrain?step.regionName:null]
        .filter(Boolean).join(" · ")});
    const destinationLabel=naming.preferRoadName?
      naming.directionRoadName(routeLegs.find(l=>l.kind==="road")?.roadId):null;
    directionsTab.append(...renderNavigationDirections({
      transfer:Boolean(session.transportLeg),
      arrivalCheckpointName:session.transportLeg?.checkpoint?.name??
        destination??null,
      markers:navigationRouteMarkers({status:"ok",legs:routeLegs},atlas,
        {destinationLabel}),
      progressPercent:session.totalDistance>0?
        100*session.completedDistance/session.totalDistance:null,
      formatDistance:showDistance,
      formatHours:value=>formatGuidedWorldTime(Math.round(value*3600)),
      rows}));
    const editable=Boolean(game.user?.isGM&&game.user?.id&&
      game.users?.activeGM?.id===game.user.id&&
      canAdjustLiveJourneyVisuals(session));
    const remainingHours=Math.max(0,session.schedule.travelHours-
      session.schedule.completedHours);
    speedTab.append(renderNavigationActivePlayback({
      model:remainingHours>0?{
        travelHours:remainingHours,
        dailyHours:session.schedule.rules.dailyHours,
        overnightHours:session.schedule.rules.overnightHours,
        longRestHours:session.schedule.rules.longRestHours
      }:null,
      secondsPerHour:session.playbackSecondsPerHour??
        session.journeyRecord?.playbackSecondsPerHour??
        readGuidedPlaybackSetting(game.settings),
      locked:!editable,skip:Boolean(session.skipVisualPlayback),
      onChange:value=>this.setLiveJourneyPlaybackSpeed(value),
      onSkip:()=>void this.setSkipVisualJourney(!session.skipVisualPlayback)
        .catch(error=>globalThis.ui?.notifications?.warn?.(
          error.message??String(error))),
      onError:message=>globalThis.ui?.notifications?.warn?.(message)
    }));
    root.append(renderNavigationJourneyTabs({
      active:this.journeyTab,journey:body,directions:directionsTab,
      speed:speedTab,onTabChange:value=>{this.journeyTab=value;}
    }),renderNavigationFooter(this,{partyMode}));
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
    const playbackTab=el("div"),directionsTab=el("div");
    body.append(...renderNavigationStageIntro({title:"1 · Where are we going?",
      description:"Choose a checkpoint or pick a point on the map."}));
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
    // A placed Atlas party Token is the normal Point A; avoid exposing
    // duplicate map-origin or refresh controls in the GM destination flow.
    if(!partyMode&&!this.start){
      const missing=el("p","Assign a party explorer Token in Atlas to start a journey.");
      missing.style.cssText="margin:0;font-size:.85em;";
      body.appendChild(missing);
    }
    const destination = checkpointDestinationControl(this);
    if (destination) body.appendChild(destination);
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
    const nativeAtStart=pendingNativeReview&&this.canRecoverUnexecutedNativeMove(pendingNativeReview);
    let nativeRejection=null;
    const nativeArrival=pendingNativeReview&&!nativeAtStart?
      this.boundedNativeArrival(pendingNativeReview,reason=>{nativeRejection=reason;}):null;
    const canReconcileNative=(nativeAtStart||nativeArrival&&
      (nativeArrival.clockAction!=="advance"||readNavigationWorldClockSetting(game.settings)&&
        typeof game.time?.advance==="function"))&&
      this.recoverableJourney?.canUserModify?.(game.user,"update");
    const pendingReviewLeg=pendingNativeReview?.legs?.at(-1)??null;
    let routeReview=null;
    if(pendingNativeReview&&pendingReviewLeg?.approvedPath){
      try{
        routeReview=assessApprovedRoutePosition({
          approvedPath:pendingReviewLeg.approvedPath,anchor:pendingNativeReview.lastConfirmedAnchor,
          tokenPosition:this.atlasPoint(this.canvasProvider(),this.atlasProvider(this.scene),
            partyTokenCanvasCenter(this.getPartyToken(),this.scene.grid.size)),
          gridSize:this.scene.grid.size});
      }catch{/* Missing geometry remains an unresolved native intent. */}
    }
    const pendingReviewMethod=pendingReviewLeg?.transport??pendingReviewLeg?.travelMethod;
    const pendingReviewMethodName=pendingReviewMethod?.methodName??
      pendingReviewMethod?.name??"Previously approved travel method";
    const availability=this.transportAvailability();
    const methods=availability.methods;
    const partySelection=this.partyTravelSelection(availability.all);
    const partySplitBlocked=Boolean(partySelection?.empty||
      this.sourceMode==="party"&&this.getPartyToken()?.actor?.type==="group"&&
      game.system?.id==="dnd5e"&&!partySelection);
    const approvedActiveTransport=this.travelSession?.transportLeg?
      (this.travelSession.journeyRecord?.legs.at(-1)?.transport??
        this.travelSession.transportLeg.transport):null;
    const approvedActiveLeg=approvedActiveTransport?
      this.travelSession.journeyRecord?.legs.at(-1):null;
    const approvedRecoveryTransport=hasUnfinishedApprovedTransport(this.recoveryRecord)?
      this.recoveryRecord.legs.at(-1).transport:null;
    const recoveryLeg=this.recoveryRecord?.legs?.at(-1);
    const approvedRecoveryLand=isUnfinishedJourneyLeg(this.recoveryRecord)&&
      !recoveryLeg?.transport?recoveryLeg?.travelMethod:null;
    if(!pendingNativeReview&&!approvedActiveTransport&&!approvedRecoveryTransport&&
        !approvedRecoveryLand&&
        !methods.some(item=>item.id===this.travelMethod)){
      this.travelMethod="walking";this.transportArrangement="owned";
      this.transportHireTerms=null;this.transportHireDenomination=null;
      this.transportJourneyOverrides=null;
      this.transportOperation="normal";
    }
    let mixedFare=null;
    if(game.user?.isGM&&this.mixedKeys.length>1&&this.canDraftTravelMethods()){
      try{if(!transferPlan?.hasTransitions||transferPlan.legs[0]?.selectedOption?.method?.kind==="mixed")
        mixedFare=mixedTransportFareBreakdown(this.mixedLandPlan().methods,
          globalThis.CONFIG?.DND5E?.currencies);}
      catch{/* Invalid allocations have no valid quote. */}
    }
    const choices=approvedRecoveryLand?[{
      value:approvedRecoveryLand.arrangement+"|"+approvedRecoveryLand.id,
      label:approvedRecoveryLand.name,group:"Approved saved Journey"
    }]:[
      ...methods.filter(item=>
        (item.id!=="mounted"||this.travelSession||approvedRecoveryTransport?.methodId===item.id)&&
        (item.id==="walking"||availability.owned.has(item.id)||
        approvedRecoveryTransport?.methodId===item.id))
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
    const annotatedChoices=choices.map(choice=>{
      if(!choice.value?.includes("|"))return choice;
      const [arrangement,id]=choice.value.split("|",2);
      const method=availability.all.find(item=>item.id===id);
      if(!method||id==="walking")return choice;
      let capacity=null,methodCapacity=null,methodUnlimited=true,
        methodQuantity=null,hireSupply=null;
      if(arrangement==="owned"&&partySelection)
        capacity=groupMethodCapacityStatus(partySelection.previewRoster,method);
      if(arrangement==="hire"){
        const offer=availability.offers.get(id);
        try{
          const offered=offer?checkpointOfferMethod({
            methodId:offer.methodId,mode:offer.mode,overrides:offer.overrides
          },method):null;
          methodCapacity=offered?.capacity??null;
          methodUnlimited=offered?.hireUnlimited!==false;
          methodQuantity=offered?.hireQuantity??null;
          if(offered)hireSupply=assessHiredTransportAvailability(offered,{
            travelers:partySelection?.previewRoster?.travelers??1
          });
        }catch(error){
          atlasWarn("navigation","Invalid offered transport capacity",error);
        }
      }
      const cargoOnly=this.convoyEnabled&&arrangement==="hire"&&
        Number.isInteger(this.convoyCargoQuantities[id])&&
        this.convoyCargoQuantities[id]>0;
      if(cargoOnly)return {...choice,cargoOnly:true,insufficient:false,
        secondary:"Cargo only · "+this.convoyCargoQuantities[id]+" unit(s) selected · "+
          (methodUnlimited?"Unlimited stock":methodQuantity+" available")+
          " · no passenger seats used"};
      if(this.mixedKeys.includes(choice.value))
        return {...choice,insufficient:false,
          secondary:"Mixed party · shared seating totals below"};
      return {...choice,secondary:describeTravelMethodCapacity({
        choice:{...choice,methodCapacity,methodUnlimited,methodQuantity},
        roster:partySelection?.previewRoster,capacity
      }),insufficient:Boolean(capacity&&!capacity.sufficient)||
        Boolean(hireSupply&&!hireSupply.sufficient)};
    });
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
    else if(this.result?.status==="ok"&&!transferPlan?.hasTransitions){
      const locked=Boolean(approvedRecoveryLand||approvedRecoveryTransport);
      const section=(locked?renderNavigationTravelMethodSelector:
        renderNavigationTravelMethodButtons)({
        choices:annotatedChoices,selectedValue:this.transportArrangement+"|"+this.travelMethod,
        ...(!locked?{selectedValues:this.mixedKeys.length?this.mixedKeys:
          this.convoyEnabled?
            ["owned|walking",...Object.keys(this.convoyCargoQuantities).map(id=>"hire|"+id)]:
            [this.transportArrangement+"|"+this.travelMethod]}:{}),
        disabled:Boolean(this.travelSession||this.journalStarting||locked),
        showEditor:false,
        onMethodChange:value=>{
          const [arrangement,method]=value.split("|",2);
          this.setTravelMethod(method,arrangement);
        },
        onMethodToggle:(value,checked)=>this.toggleTravelMethodChoice(value,checked),
        onEditMethod:!locked&&game.user?.isGM?key=>{
          const selected=this.mixedKeys.length?this.mixedKeys:
            [this.transportArrangement+"|"+this.travelMethod];
          if(!selected.includes(key))return;
          const action=this.mixedKeys.length?
            this.editMixedTravelMethod(key):this.editJourneyTravelMethod();
          void action.catch(error=>globalThis.ui?.notifications?.error?.(
            error.message??String(error)));
        }:null
      });
      if(!locked&&game.user?.isGM&&this.sourceMode==="party"&&
          partySelection&&this.canDraftTravelMethods()){
        const selected=availability.methods.find(m=>m.id===this.travelMethod);
        const carrier=!this.mixedKeys.length&&selected?.kind==="vehicle"&&
          selected.surface==="land";
        const method=carrier?this.effectiveTransportMethod(selected,availability):null;
        const mountBoard=carrier||this.recoveryRecord?.legs?.at(-1)?.livestock?
          renderJourneyLivestockBoarding({
            resources:groupLivestockResources(partySelection.roster),
            surface:"land",carried:carrier,method,decisions:this.livestockDecisions,
            disabled:Boolean(this.journalStarting),onChange:(id,amount)=>{
              this.livestockDecisions={...this.livestockDecisions,[id]:amount};
              void this.render(true);
            }}):null;
        section.append(this.renderTravelersAndPace(partySelection,
          availability,{disabled:Boolean(this.journalStarting),mixedFare,mountBoard}));
      }
      if(this.convoyEnabled&&!locked&&this.sourceMode==="party"&&
          partySelection&&!this.recoveryRecord&&!this.recoverableJourney){
        const sceneUnits=this.scene?.grid?.units??"";
        const sceneSpeed=this.resolveTravel({excludeConvoy:true}).travel.speed;
        const cargo=this.cargoConvoyChoices(availability).filter(c=>
          this.convoyCargoQuantities[c.id]>0);
        const displaySpeed=native=>atlasDisplaySpeed(native,sceneUnits,
          game.settings,game.system?.id);
        const walkDisplay=displaySpeed(sceneSpeed);
        const participants=[{label:"Walking (party pace)",
          speed:walkDisplay.value.toFixed(2)}];
        for(const item of cargo){
          const speed=convertGroupSpeed(item.method.speedMph,"mph",sceneUnits);
          const converted=displaySpeed(speed);
          const difference=converted.value-walkDisplay.value;
          participants.push({label:item.name+" (cargo only) · "+
            (difference>=0?"+":"")+difference.toFixed(2)+" "+walkDisplay.unit+
            " vs walking",speed:converted.value.toFixed(2),
            methodId:item.id,available:item.available});
        }
        const cargoSpeeds=cargo.map(c=>
          convertGroupSpeed(c.method.speedMph,"mph",sceneUnits));
        const slowest=Math.min(sceneSpeed,...cargoSpeeds);
        const cargoLimit=cargoSpeeds.length?Math.min(...cargoSpeeds):null;
        let plan=null,error=null;
        try{plan=this.mixedConvoyPlan();}
        catch(e){error=e.message??String(e);}
        const unit=walkDisplay.unit==="mi/hour"?"mph":
          walkDisplay.unit==="km/hour"?"kph":walkDisplay.unit;
        const current=this.convoyPace===null?null:
          displaySpeed(this.convoyPace).value;
        section.append(renderWalkingCargoControls({
          participants,quantities:this.convoyCargoQuantities,
          recommendedSpeed:displaySpeed(slowest).value.toFixed(2),
          ...(cargoLimit!==null?{
            maximumSpeed:displaySpeed(cargoLimit).value.toFixed(2)}:{}),
          customPace:current===null?null:Number(current.toFixed(4)),
          unit,disabled:Boolean(this.journalStarting||partySplitBlocked),
          plan:plan?{
            speed:displaySpeed(plan.speedPerHour).value.toFixed(2),
            moving:formatNavigationDuration(plan.movingHours,24),
            cost:plan.totalCp+" CP"
          }:null,error,
          onQuantity:(id,count)=>{
            if(!Number.isInteger(count)||count<1||count>100){
              globalThis.ui?.notifications?.warn?.("Cargo units must be between 1 and 100.");
              void this.render(true);return;
            }
            this.convoyCargoQuantities={...this.convoyCargoQuantities,[id]:count};
            void this.render(true);
          },
          onPace:value=>{
            const chosen=value==="custom"?slowest:
              value===null?null:atlasSceneSpeedFromDisplay(value,sceneUnits,
                game.settings,game.system?.id,cargoLimit);
            this.convoyPace=chosen;
            void this.render(true);
          }
        }));
      }
      body.appendChild(section);
    }
    if(this.result?.status==="ok"&&!pendingNativeReview&&!approvedActiveTransport&&
        !approvedRecoveryTransport&&!approvedRecoveryLand&&
        !transferPlan?.hasTransitions&&this.travelMethod==="mounted"&&
        this.transportArrangement==="owned"&&partySelection){
      const method=availability.all.find(candidate=>candidate.id==="mounted");
      if(method){
        const capacity=groupMethodCapacityStatus(partySelection.previewRoster,method);
        if(capacity.matched>0&&capacity.effectiveSpeedMph!==null){
          const note=el("small","FYI: Mixed mounts travel together at the slowest "+
            "participating mount's sustained speed ("+
            capacity.effectiveSpeedMph+" mph). Assigned mounts only count when "+
            "their named rider travels. This is a planning estimate, not boarding.");
          note.style.cssText="opacity:.85;line-height:1.45;";
          body.appendChild(note);
        }
      }
    }
    if(!pendingNativeReview&&!approvedActiveTransport&&!approvedRecoveryTransport&&
        !approvedRecoveryLand&&
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
    if(this.result?.status!=="ok"||this.pendingTransfer||this.notice){
      const statusLabel=el("p",status);
      statusLabel.style.cssText="margin:0;font-weight:600;flex:1;min-width:0;";
      body.appendChild(statusLabel);
    }
    if(this.travelNotice){
      const message=el("p",this.travelNotice);
      message.style.cssText="margin:0;font-size:.85em;opacity:.85;";
      body.appendChild(message);
    }
    if(pendingNativeReview){
      const pending=pendingNativeReview.pendingNativeMove;
      const checkpointLabel=Number.isSafeInteger(pending.checkpointIndex)?
        String(pending.checkpointIndex+1):"unknown";
      body.appendChild(renderTransportAdvisory(canReconcileNative&&nativeArrival?
        "The approved "+pendingReviewMethodName+(nativeArrival.partial?
          " has verified partial native movement.":" reached its verified native checkpoint.")+
          " Recover to reconcile outstanding confirmed time without replaying movement.":
        canReconcileNative?
        "The approved "+pendingReviewMethodName+" Journey stopped before native checkpoint "+
        checkpointLabel+". The TokenDocument and World time match the last confirmed boundary. "+
        "Recover to restore the approved remaining leg without replaying confirmed movement.":
        "The approved "+pendingReviewMethodName+" Journey is blocked at native " +
        "checkpoint "+checkpointLabel+" (operation "+
        (pending.operationId??"unverified")+"). " +
        "The Journal has not confirmed that movement. "+
        (routeReview?.safe&&routeReview.kind==="ahead"?
          "The token is "+Math.round(routeReview.forwardPixels)+
            " route pixels ahead on the approved path. Geometric proximity alone cannot confirm the intervening time. ":
          routeReview&&!routeReview.safe?"Route assessment: "+routeReview.reason+". ":"")+
        "Review the token position, World time and saved checkpoint before continuing; no new method, fare " +
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
      if(canReconcileNative){
        description.textContent=nativeArrival?
          (nativeArrival.partial?"The partial native path is verified.":"The native endpoint is verified.")+
            " Recover to record its progress and only outstanding World time.":
          "The unexecuted checkpoint can be reconciled without movement or World-time changes. Recover the approved remaining Journey.";
      }else if(pendingNativeReview){
        description.textContent="Saved Journey requires GM checkpoint review. " +
          "Its approved transportation and Journal are preserved; " +
          "automatic recovery is not yet safe.";
        recover.disabled=true;
        recover.title="Native movement is unconfirmed; review the Journal before recovery";
      }
      recover.addEventListener("click",()=>void this.recoverSavedJourneyWithNativeReview()
        .catch(error=>ui.notifications.warn(error.message||String(error))));
      recovery.append(description,recover);
      if(pendingNativeReview&&game.user?.isGM){
        const intent=pendingNativeReview.pendingNativeMove;
        const document=this.getPartyToken();
        const details=el("details");
        details.style.cssText="flex-basis:100%;";
        details.append(el("summary","Review Saved Journey"));
        const position=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)?
          `${p.x}, ${p.y}`:"Unavailable";
        const delta=Number.isFinite(game.time?.worldTime)&&Number.isFinite(intent.worldTimeBefore)?
          game.time.worldTime-intent.worldTimeBefore:null;
        details.append(
          el("p","Approved method: "+pendingReviewMethodName+
            " · Native checkpoint "+(Number.isSafeInteger(intent.checkpointIndex)?intent.checkpointIndex+1:"Unavailable")),
          el("p","Confirmed origin: "+position(intent.from)+
            " · Approved endpoint: "+position(intent.to)+
            " · TokenDocument: "+position(document)),
          el("p","Native state: "+(document?.movement?.state??"Unavailable")+
            " · Movement ID: "+(document?.movement?.id||"Unavailable")+
            " · Durable endpoint evidence: "+(intent.arrivalEvidence?"Saved":"Not recorded")+
            " · Partial evidence: "+(intent.partialEvidence?"Saved":"Not recorded")),
          el("p","Saved interval time: "+(Number.isFinite(intent.worldAdvanceSeconds)?intent.worldAdvanceSeconds+" seconds":"Unavailable")+
            " · World-clock change since intent: "+(delta===null?"Unavailable":delta+" seconds")),
          el("p",canReconcileNative?(nativeArrival?
            (nativeArrival.partial?"Verified partial movement.":"Verified endpoint.")+
              " Outstanding clock advancement: "+
              (nativeArrival.clockAction==="advance"?nativeArrival.worldAdvanceSeconds:0)+" seconds.":
            "Verified unexecuted interval. No movement or clock credit is required."):
            "Recovery blocked: "+(nativeRejection??"Journal permission or World-clock advancement is unavailable."))
        );
        if(!canReconcileNative){
          const inspect=el("button","Open Saved Journey Journal");
          inspect.type="button";
          inspect.addEventListener("click",()=>this.recoverableJourney?.sheet?.render(true));
          details.append(inspect);
        }
        recovery.append(details);
      }
      const forget=el("button","Forget Saved Journey");
      forget.type="button";
      forget.title="GM confirmation: end recovery for this Journey and retain its historical Journal";
      forget.disabled=Boolean(this.journalStarting);
      forget.addEventListener("click",()=>void this.forgetSavedJourney().catch(error=>
        globalThis.ui?.notifications?.error?.(error.message??String(error))));
      recovery.append(forget);
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
      travel.source==="mixed-convoy"||travel.source==="approved-convoy"?
      (this.mixedKeys.length?"Mixed passenger transportation":"Walking with hired cargo")+
        " · "+showSpeed(speed):
      travel.source==="group-method"?
      `${travel.methodLabel} (party-owned convoy; slowest matching resource) · ${showSpeed(speed)}`:
      travel.source==="atlas-method"?
      `${travel.methodLabel} (World transportation preset) · ${showSpeed(speed)}`:
      travel.source==="party" ?
      `${travel.actorName} · ${travel.pace} pace · ${showSpeed(speed)}` :
      `Atlas default · ${showSpeed(speed)}`;
    const methodAssessment=this.assessTravelMethod();
    const selectedMethodChoice=annotatedChoices.find(choice=>choice.value===
      this.transportArrangement+"|"+this.travelMethod);
    const blockedEstimate=Boolean(!this.travelSession&&!this.recoveryRecord&&
      !this.recoverableJourney&&!transferPlan?.hasTransitions&&
      (selectedMethodChoice?.insufficient||
        (this.convoyEnabled||this.mixedKeys.length)&&!methodAssessment.guided));
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
    // Seats and resource counts are now displayed beside each method.
    // A selected method with insufficient seats is explicitly called out.
    if(!approvedRecoveryTransport&&this.travelMethod!=="walking"){
      const selected=annotatedChoices.find(choice=>choice.value===
        this.transportArrangement+"|"+this.travelMethod);
      if(selected?.insufficient)
        body.appendChild(renderTransportAdvisory(
          this.transportArrangement==="hire"?
            "Not enough hired vehicles at this checkpoint for the selected travelers. "+
            "Change availability, choose another method or adjust the party.":
            "Insufficient seats for the selected travelers. "+
            "Choose another method or adjust the Group transportation roster."));
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
          const quoteRoster=partySelection?.previewRoster??roster;
          let ownedQuote=null;
          if(this.transportArrangement==="owned"&&quoteRoster){
            const capacity=groupMethodCapacityStatus(quoteRoster,method);
            if(capacity.sufficient)
              ownedQuote=groupMethodFareEstimate(quoteRoster,method,{hours:movingHours,
                distanceMi,dayHours:this.resolveTravelRules(travel).dailyHours??8});
          }
          if(this.transportArrangement==="hire"||ownedQuote){
            const normalRules=resolveNavigationTravelRules({settings:game.settings,
              systemId:game.system?.id,actorHoursPerDay:travel?.hoursPerDay});
            const normalHours=method.surface==="land"?(normalRules.dailyHours??8):8;
            const operation=this.plannedTravelOperation(method);
            const quoteArgs={arrangement:this.transportArrangement,
              operation,movingHours,distanceMi,
              travelers:quoteRoster?.travelers??1,ownedQuote,regularHours:normalHours};
            const quote=quoteTransportationService(method,{...quoteArgs,
              hireTerms:this.transportHireTerms});
            const worldOperation=operation!=="normal"&&
              !baseMethod?.[operation+"Enabled"]?"normal":operation;
            const original=this.transportArrangement==="hire"&&baseMethod?.hireEnabled?
              quoteTransportationService(baseMethod,{...quoteArgs,
                operation:worldOperation,hireTerms:null}):null;
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
              operatingSummary:(operation==="continuous"&&
                quote.hireTerms?.hireBasis==="day"?
                quote.billableDayUnits.toFixed(2).replace(/\\.?0+$/,"")+
                  " normal-day fare unit(s) at "+normalHours+"h/day; "+
                  quote.travelDays+" continuous 24h period(s). ":
                quote.travelDays+" operating day(s) at "+
                  quote.dailyHours+"h/day. ")+
                quote.extraHours.toFixed(1)+
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
    // Destination controls already explain how to pick Point B. Avoid
    // duplicating the same explanatory line below service estimates.
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
        if(leg.selectedOption&&!leg.recovered&&leg.selectedOption.method?.kind!=="mixed"){
          const schedule=el("small","Operating schedule: "+leg.operation+
            ". Use the transportation editor to choose supported standard, overtime or continuous operation for this leg.");
          schedule.style.cssText="opacity:.78;";
          card.append(schedule);
        }
        if(leg.surface==="land"&&!leg.recovered&&game.user?.isGM&&
            this.canDraftTravelMethods()&&partyMode&&partySelection){
          const validKeys=new Set(leg.options.map(option=>option.value));
          const choices=annotatedChoices.filter(choice=>validKeys.has(choice.value));
          const selected=this.mixedKeys.length?this.mixedKeys:
            [leg.selectedValue||"owned|walking"];
          card.append(renderNavigationTravelMethodButtons({
            choices,selectedValues:selected,
            showEditor:false,
            onMethodToggle:(value,checked)=>this.toggleTravelMethodChoice(value,checked),
            onEditMethod:key=>{
              if(this.mixedKeys.length&&!this.mixedKeys.includes(key))return;
              if(!this.mixedKeys.length&&leg.selectedValue!==key)return;
              const action=this.mixedKeys.length?
                this.editMixedTravelMethod(key):this.editTransportationLeg(0);
              void action.catch(error=>globalThis.ui?.notifications?.error?.(
                error.message??String(error)));
            }
          }));
          const carrier=leg.selectedOption?.method?.kind==="vehicle"&&
            leg.surface==="land";
          const mountBoard=carrier||this.recoveryRecord?.legs?.at(-1)?.livestock?
            renderJourneyLivestockBoarding({
              resources:groupLivestockResources(partySelection.roster),
              surface:"land",carried:carrier,method:leg.selectedOption?.method,
              planned:leg.livestock,decisions:this.livestockDecisions,
              disabled:Boolean(this.journalStarting),
              onChange:(id,amount)=>{
                this.livestockDecisions={...this.livestockDecisions,[id]:amount};
                void this.render(true);
              }}):null;
          card.append(this.renderTravelersAndPace(partySelection,availability,{
            mixedFare,singleChoice:this.mixedKeys.length?null:leg.selectedOption,
            mountBoard}));
        }else if(leg.recovered)card.append(renderCurrentTransferMethodSelector({
          options:leg.options,selectedValue:leg.selectedValue,disabled:true,
          editable:false,onChange:()=>{}
        }));
        else{
          const locked=Boolean(this.travelSession||this.journalStarting||!game.user?.isGM);
          card.append(renderNavigationTravelMethodButtons({
            choices:leg.options,selectedValue:leg.selectedValue,disabled:locked,
            onMethodChange:value=>{
              if(locked)return;
              this.transferSelections[0]=value;
              delete this.transferLegOverrides[0];
              delete this.transferLegOperations[0];
              void this.render(true);
            },
            onEditMethod:!locked&&leg.selectedOption?.method?.id!=="walking"?
              key=>{
                if(key!==leg.selectedValue)return;
                void this.editTransportationLeg(0).catch(error=>
                  globalThis.ui?.notifications?.error?.(error.message??String(error)));
              }:null
          }));
          // A checkpoint continuation keeps a saved Journey handle while the
          // onward vessel is being previewed. The handle must not hide the
          // non-committing traveler roster; approval remains separately guarded.
          if(!locked&&partyMode&&partySelection&&leg.selectedOption&&
              (["water","air"].includes(leg.surface)||
                leg.surface==="land"&&leg.selectedOption.method?.kind==="vehicle")){
            const mountBoard=renderJourneyLivestockBoarding({
              resources:groupLivestockResources(partySelection.roster),
              decisions:this.livestockDecisions,method:leg.selectedOption.method,
              planned:leg.livestock,surface:leg.surface,
              carried:leg.surface==="land",disabled:locked,
              onChange:(id,quantity)=>{
                this.livestockDecisions={...this.livestockDecisions,[id]:quantity};
                void this.render(true);
              }});
            card.append(this.renderTravelersAndPace(partySelection,availability,{
              singleChoice:leg.selectedOption,transferColumns:true,mountBoard}));
          }
        }
        card.append(...renderNavigationTransferLegOutcome({
          estimateLabel:leg.hours!==null&&leg.costCp!==null?
            showDistance(leg.distance)+" · "+
            formatNavigationDuration(leg.hours,24)+" moving · "+
            (leg.recovered&&leg.convoy?"previously approved fare (no new quote)":
              (leg.convoy&&mixedFare?mixedFare.total.label:formatMoney(leg.costCp))+" estimated cost"):null,
          narration:leg.narration,errors:leg.errors,
          arrivalCheckpointName:leg.arrivalCheckpoint?.name??null}));
        section.append(card);
      }
      if(transferPlan.legs.length>1){
        section.append(renderNavigationLaterLegsPreview(transferPlan.legs.slice(1),
          transferPlan.globalSchedule));
      }
      if(transferPlan.globalSchedule){
        const overall=transferPlan.globalSchedule;
        const details=overall.complete?
          "Whole Journey (provisional): "+
            formatNavigationDuration(overall.totalMovingHours,24)+" moving · "+
            formatNavigationDuration(overall.plannedDowntimeHours,24)+" estimated duty downtime · "+
            formatNavigationDuration(overall.totalElapsedHours,24)+" elapsed · "+
            formatMoney(overall.totalFareCp)+" estimated transportation costs.":
          "Whole Journey estimate is incomplete: "+overall.pendingLegIndices.length+
            " leg(s) not planned. Known consecutive stretch: "+
            formatNavigationDuration(overall.knownMovingHours,24)+" moving · "+
            formatNavigationDuration(overall.plannedDowntimeHours,24)+" estimated duty downtime · "+
            formatMoney(overall.knownFareCp)+" quoted so far.";
        const projected=el("div",details+
          " Future legs and breaks are previews only; no reservation, rest, World time, currency or next-leg movement is approved.");
        projected.style.cssText="font-size:.88em;line-height:1.5;padding:.5rem;border-top:1px solid var(--color-border-light-tertiary,#555);";
        section.append(projected);
      }
      const current=transferPlan.legs[0];
      section.append(el("strong",current?.errors.length?
        "Choose a valid method and confirm the transfer before this leg can be estimated.":
        current?.hours!==null?
          "Current leg: "+formatNavigationDuration(current.hours,24)+" moving · "+
            (current.recovered&&current.convoy?"previously approved transportation":
              (current.convoy&&mixedFare?mixedFare.total.label:formatMoney(current.costCp))+" estimated")+". Later legs are undecided.":
          "Current leg estimate pending."));
      body.append(section);
    }
    if (this.result?.status === "ok") {
      const metrics=[];
      const metric=(label,value,tooltip=null,hint=null)=>metrics.push({label,value,tooltip,hint});
      let realPlaybackModel=null;
      const activeLeg=transferPlan?.hasTransitions?transferPlan.legs[0]:null;
      metric(activeLeg?"Current Leg Distance":
        this.travelMethod==="walking"?"Distance @ party pace":"Distance",
        showDistance(activeLeg?.distance??this.result.distance),
        "Measured against the Scene Grid. The assigned party token is Point A.");
      let tripExplanation=null;
      if(blockedEstimate){
        metric("Travel Time","Unavailable");
        metric("Total Trip","Unavailable");
        tripExplanation=(this.convoyEnabled||this.mixedKeys.length)&&
          !methodAssessment.guided?
          (methodAssessment.reason??"Choose a valid shared convoy pace."):
          "This method cannot carry all selected travelers. "+
            "Theoretical solo-vehicle timing is not a valid party journey estimate.";
      }else try{
        const weighted=this.result.terrainAware?this.result.cost:this.result.distance;
        const hours=activeLeg?activeLeg.hours:approvedActiveTransport?
          this.travelSession.schedule.travelHours:navigationHours(weighted,speed);
        metric(activeLeg?"Current Leg Time":"Travel Time",
          hours===null?"Choose method":formatGuidedWorldTime(Math.round(hours*3600)),
          "Time spent moving only. A standard day has up to 8 hours of travel; rests are separate GM decisions.");
        const rules=approvedActiveTransport?
          this.travelSession.schedule.rules:this.resolveTravelRules(travel);
        const schedule=approvedActiveTransport?this.travelSession.schedule:
          this.travelMethod==="walking"&&this.journeySchedule&&
          Math.abs(this.journeySchedule.travelHours-hours)<1e-5?
          this.journeySchedule:null;
        const plan=hours===null?null:schedule?.estimate??
          estimateNavigationTotalTrip(hours,rules);
        const activeContinuous=activeLeg?.operation==="continuous";
        const primary=hours===null?null:activeContinuous?
          {totalHours:hours}:estimateNavigationTotalTrip(hours,
            {...rules,overnightHours:rules.longRestHours??8});
        const overnight=hours===null?null:activeContinuous?
          {totalHours:hours}:plan;
        metric(activeLeg?"Current Leg Total":"Total Trip",
          primary===null?"Choose method":formatNavigationDuration(
            primary.totalHours,24),
          "Planning estimate: "+(rules.longRestHours??8)+"h Long Rests between travel days. "+
            "This does not authorize or automatically apply a rest; the GM still chooses each break.",
          overnight&&!activeContinuous?"With "+rules.overnightHours+"h overnight stops: "+
            formatNavigationDuration(overnight.totalHours,24):null);
        if(hours!==null&&Number.isFinite(hours)&&hours>0)
          realPlaybackModel={travelHours:hours,
            dailyHours:rules.dailyHours,overnightHours:rules.overnightHours,
            longRestHours:rules.longRestHours??8};
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
            "This transport operates continuously. Passenger rests may overlap moving time without stopping it or adding duplicate World time.":
            "Standard travel uses the configured World hours and downtime; actual stops remain GM decisions."):
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
      if(this.mixedKeys.length>1&&this.canDraftTravelMethods()&&game.user?.isGM){
        metrics.push({label:"Estimated Cost",
          value:!blockedEstimate&&mixedFare?mixedFare.total.label:"Unavailable",
          tooltip:"Each method is rounded up separately. No currency is deducted.",
          lines:!blockedEstimate&&mixedFare?mixedFare.rows.map(row=>({
            label:row.name,value:row.label})):[]});
      }
      const summary=renderNavigationSummaryMetrics({metrics,
        explanation:tripExplanation,
        progressPercent:this.travelSession||this.travelProgress>0?
          this.travelProgress:null});
      body.append(...summary.nodes);
      if(realPlaybackModel&&!this.travelSession&&!this.pendingTransfer&&
          !this.recoveryRecord&&!this.recoverableJourney){
        try{
          playbackTab.append(renderNavigationPlaybackControls({
            model:realPlaybackModel,
            secondsPerHour:this.playbackSecondsPerHourOverride??
              readGuidedPlaybackSetting(game.settings),
            disabled:Boolean(this.journalStarting),
            onChange:value=>{
              if(this.journalStarting||this.travelSession)return;
              if(!Number.isFinite(value)||value<.5||value>30)return;
              this.playbackSecondsPerHourOverride=value;
              void this.render(true);
            },
            onError:message=>globalThis.ui?.notifications?.warn?.(message)
          }));
        }catch(error){
          atlasWarn("navigation","Trip playback preview unavailable",error);
        }
      }
      this.travelProgressUI=summary.progressUI;
      if(summary.timeUI&&!blockedEstimate){
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
      const status=renderNavigationSummaryStatus({clockHint,
        worldTimeStatus:this.travelSession?.clock||this.worldTimeAdvancedSeconds>0?
          this.worldTimeStatus():null,
        speedSource:transferPlan?.hasTransitions?null:"Speed: "+travelSource,
        terrainCostLabel:this.result.terrainAware?
          "Terrain-weighted distance: "+showDistance(this.result.cost)+"-equivalent":null});
      // Rules and provenance remain available to the GM, but do not crowd
      // the primary destination, method, timing and route actions.
      // Calculation diagnostics stay on the Directions tab, with no
      // extra "Travel calculation and World-time notes" disclosure.
      if(status.worldTimeUI&&(this.travelSession||
          this.worldTimeAdvancedSeconds>0))
        body.append(status.worldTimeUI);
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
      const naming=this.roadNaming(this.atlasProvider(this.scene),this.result);
      const baseSteps=transferPlan?.hasTransitions?
        buildNavigationSteps(this.result.legs.slice(0,
          (transferPlan.legs[0]?.lastRouteLeg??0)+1),
          naming.directionRoadName,naming):
        this.itinerary?.directions??buildNavigationSteps(this.result.legs,
          naming.directionRoadName,naming);
      const guidedTimeline=this.travelSession?.transportLeg;
      const journeyHours=blockedEstimate?null:guidedTimeline?
        this.travelSession.schedule.travelHours:
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
          distanceValue:step.distance,
          hoursValue:blockedEstimate?null:
            navigationHours(this.result.terrainAware?step.cost:step.distance,speed),
          info:showDistance(step.distance)+
            (blockedEstimate?" · time unavailable until travel method is valid":
              transferPlan?.hasTransitions?" · See per-leg time above":" · "+
              formatGuidedWorldTime(Math.round(navigationHours(
                this.result.terrainAware?step.cost:step.distance,speed)*3600))),
          surface:[step.terrain==="Unspecified terrain"?null:step.terrain,
            step.regionName&&step.regionName!==step.terrain?step.regionName:null]
            .filter(Boolean).join(" · ")};
      });
      const routeLegs=this.result.legs;
      const destinationLabel=naming.preferRoadName?
        naming.directionRoadName(routeLegs.find(l=>l.kind==="road")?.roadId):null;
      const destinationCheckpoint=navigationDestinationCheckpoint(this.result,
        this.atlasProvider(this.scene),this.selectedCheckpointId);
      directionsTab.append(...renderNavigationDirections({calculation,
        transfer:Boolean(transferPlan?.hasTransitions),
        arrivalCheckpointName:transferPlan?.legs[0]?.arrivalCheckpoint?.name??
          destinationCheckpoint?.name??null,
        markers:navigationRouteMarkers(this.result,this.atlasProvider(this.scene),
          {destinationLabel}),
        expanded:this.directionsExpanded,
        onExpandedChange:value=>{this.directionsExpanded=value;},
        formatDistance:showDistance,
        formatHours:value=>formatGuidedWorldTime(Math.round(value*3600)),
        rows}));
    } else {
      const hint=el("p",this.pendingTransfer?
        (this.isAtJourneyDestination()?
          "Complete the saved Journey here, or Continue to choose a new onward destination.":
          "Continue from this checkpoint toward the saved journey destination.") :
        this.result?.status==="ok"?
          `Travel estimates will use ${travelSource}.`:
          "Choose Point B by clicking the map or selecting a checkpoint to see journey estimates.");
      hint.style.cssText="margin:0;opacity:.8;font-size:.9em;";body.appendChild(hint);
    }
    if(!playbackTab.children?.length)
      playbackTab.append(el("p","Choose a destination and travel method to set trip playback."));
    if(!directionsTab.children?.length)
      directionsTab.append(el("p","Choose a destination to review turn-by-turn directions."));
    const tabs=renderNavigationPlannerTabs({
      active:this.navigationTab,travel:body,playback:playbackTab,
      directions:directionsTab,
      onTabChange:value=>{this.navigationTab=value;}
    });
    root.append(tabs,renderNavigationFooter(this,{partyMode,transferPlan,
      methodAssessment,assistedLegReady,repeatingCheckpoint,
      partySplitBlocked}));
    return root;
  }

  _replaceHTML(result,content) {
    // ApplicationV2 may replace the entire planner after a drag/checkbox
    // change. Restore its scrollable tab position without retaining stale DOM.
    const before=[...(content.querySelectorAll?.("[role=tabpanel]")??[])].map(panel=>({
      id:panel.id,top:panel.scrollTop,left:panel.scrollLeft
    }));
    const top=content.scrollTop;
    content.replaceChildren(result);
    for(const {id,top:scrollTop,left} of before){
      if(!id)continue;
      const panel=content.querySelector?.('[id="'+id+'"]');
      if(panel&&Number.isFinite(scrollTop))panel.scrollTop=scrollTop;
      if(panel&&Number.isFinite(left))panel.scrollLeft=left;
    }
    if(Number.isFinite(top))content.scrollTop=top;
  }

  _onClose(options) {
    if(this.travelSession)atlasDebug("lifecycle","Navigation window closed during journey",{
      sceneId:this.scene?.id??null,phase:this.travelSession.phase
    });
    super._onClose?.(options);
    this.stop();
    this.closedByController = false;
  }
}
