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
import { resolveNavigationTravelSpeed,convertGroupSpeed } from "./navigation-party-speed.js";
import { availableNavigationTravelMethods,resolveNavigationMethodTravel,
  assessNavigationMethodRoute } from "./navigation-travel-method.js";
import { projectTransportationRouteLegs,transportationLegSelection,
  describeTransportationLeg } from "./navigation-transport-transitions.js";
import {appendGroupedTransportationOptions} from "./navigation-transport-choices.js";
import {prepareGuidedTransportLeg,confirmGuidedCheckpointArrival}
  from "./navigation-guided-transport-leg.js";
import {isJourneyDestinationCheckpoint} from "./navigation-checkpoint-terminal.js";
import {restoreApprovedTransportPlan} from "./navigation-transport-recovery.js";
import {requestPassengerRest,confirmPassengerRest,beginPassengerRestMetadata,
  recoverPassengerRestRequest} from "./navigation-passenger-rest.js";
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

const el = (tag, content) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
};

/** Keep footer controls compact without sacrificing keyboard or screen-reader labels. */
const navigationFooterIconButton=(label,icon)=>{
  const button=el("button");
  button.type="button";
  button.title=label;
  button.ariaLabel=label;
  button.setAttribute?.("aria-label",label);
  button.innerHTML=`<i class="fa-solid fa-${icon}" aria-hidden="true"></i>`;
  button.style.cssText="display:inline-flex;align-items:center;justify-content:center;"+
    "flex:0 0 auto;min-width:2.75rem;height:2.75rem;padding:.4rem;font-size:1.1rem;";
  return button;
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
    const methods=all.filter(method=>
      (method.id==="walking"||owned.has(method.id)||offers.has(method.id)||
        Boolean(this.travelSession&&method.id===this.travelMethod))&&
      (!compatible||compatible.has(method.id)||
        Boolean(this.travelSession&&method.id===this.travelMethod)));
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
    const catalog=availableNavigationTravelMethods(game.settings,game.system?.id);
    const restored=restoreApprovedTransportPlan(this.result,projected,
      this.recoveryRecord,catalog,this.recoveryOperationOverride);
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
    return {...projected,legs,complete,totalHours:complete?totalHours:null,
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
      onSaveCheckpoint:offer?async edited=>{
        if(this.travelMethod!==id||this.transportArrangement!=="hire")
          throw Error("The selected travel method changed. Reopen its settings.");
        await this.saveNavigationCheckpointOffer({
          checkpointId:offer.checkpointId,methodId:id,world,
          originalOffers:initialOffers,edited});
        this.transportJourneyOverrides=null;
        this.transportHireTerms=null;this.transportHireDenomination=null;
        this.calculateRoute(this.canvasProvider(),this.atlasProvider(this.scene));
        this.draw();await this.render(true);
      }:null,
      onReset:async()=>{
        this.transportJourneyOverrides=null;
        this.calculateRoute(this.canvasProvider(),this.atlasProvider(this.scene));
        this.draw();await this.render(true);
      },
      onSave:async edited=>{
        if(this.travelMethod!==id||this.transportArrangement!==arrangement)
          throw Error("The selected travel method changed. Reopen its settings.");
        this.transportJourneyOverrides=transportationMethodOverrideDelta(original,edited);
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
      return assessNavigationMethodRoute(this.travelMethod,this.result,atlas,presets.presets,
        {settings:game.settings,systemId:game.system?.id});
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
    const recent=saved.legs.at(-1),arrival=recent.transport;
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
    const saved=checkpointJourneyRecord(session.journeyRecord,{
      schedule:session.schedule,status,
      progress:Math.max(0,Math.min(100,100*session.completedDistance/session.totalDistance)),
      worldTravelSeconds:session.clock?.advancedSeconds??0,
      worldRestSeconds:session.clock?.restSeconds??0,
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
    // A break's start must be measured after any pending confirmed movement
    // time is credited, but before the GM-approved downtime advances time.
    await this.commitGuidedWorldTime(session,{force:true});
    const restStart=journeyWorldStamp(game.time);
    if(choice.hours>0){
      if(session.clock)await session.clock.commitBreak(Math.round(choice.hours*3600));
      atlasDebug("clock","GM-confirmed rest recorded",{
        sceneId:session.sceneId,action,hours:choice.hours,
        worldTimeAdvanced:Boolean(session.clock)
      });
    }
    const restEnd=journeyWorldStamp(game.time);
    session.schedule.applyBreak(choice,{
      startedWorldTime:restStart.seconds,endedWorldTime:restEnd.seconds,
      startedTimeLabel:restStart.label,endedTimeLabel:restEnd.label});
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
      const savedTransport=this.recoveryRecord?.legs?.at(-1)?.transport;
      if(projected.hasTransitions||savedTransport){
        if(this.sourceMode!=="party")
          throw Error("Checkpoint-assisted movement requires the assigned party token as Point A.");
        const plan=this.transportationTransitionPlan();
        guidedLeg=prepareGuidedTransportLeg(this.result,plan?.legs[0]);
      }else if(projected.legs.some(leg=>leg.surface!=="land"))
        throw Error("Native guided movement for this water/air-only route needs a supported checkpoint leg.");
    }
    if(!guidedLeg&&this.travelMethod!=="walking")
      throw Error("Guided vehicle movement requires an explicit checkpoint-boundary leg.");
    const route=guidedLeg??this.result;
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
    const waypoints=createGuidedTokenWaypoints(paths,token,this.scene.grid?.size);
    const itinerary=guidedLeg?{...createNavigationItinerary({
      sceneId:this.scene.id,sceneName:this.scene.name??"",
      sceneUnits:this.scene.grid?.units??"",atlasRevision:atlas.revision,
      route,roadName:id=>atlas.roads.find(road=>road.id===id)?.name??"Road",travel
    }),transport:guidedLeg.transport}:this.itinerary;
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
      const record=recovered?
        resumeJourneyRecord(recovered,{itinerary,atlasRevision:atlas.revision,
          // The recovery target is the current leg checkpoint, not a GM edit
          // to the original Point B. Preserve the final destination on resume.
          journeyDestination:isUnfinishedJourneyLeg(recovered)?null:this.end}):
        createJourneyRecord({sceneId:this.scene.id,tokenId:token.id,
          atlasRevision:atlas.revision,itinerary,journeyDestination:this.end,
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
          session.phase==="ending"?"ended":"interrupted");}
        catch(error){
          interruptedReason="The Journey Journal could not finalize: "+
            (error.message||String(error));
          arrived=false;atlasWarn("journey",interruptedReason);
        }
        if(arrived&&guidedLeg){
          this.pendingTransfer={sceneId:session.sceneId,atlasRevision:atlas.revision,
            tokenId:token.id,checkpoint:guidedLeg.checkpoint,
            journalId:session.journal.id};
          this.recoveryRecord=session.journeyRecord;
          this.recoveryJournal=session.journal;
          this.recoverableJourney=null;
          // The old full-route preview must never look like an active next leg.
          this.result=null;this.itinerary=null;
          try{this.syncPartyDeparture(view,atlas);this.draw();}
          catch(error){atlasWarn("journey","Checkpoint arrived but preview origin did not refresh",error);}
          this.travelNotice=this.isAtJourneyDestination(this.pendingTransfer.checkpoint)?
            "Destination reached at "+guidedLeg.checkpoint.name+
              ". Complete the Journey here, or choose Continue for a new onward destination.":
            "Reached "+guidedLeg.checkpoint.name+
              ". Continue toward the saved Point B or stop and replan. "+
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
    this.pendingTransfer=null;
    this.clear();
    this.travelNotice="Journey completed at "+pending.checkpoint.name+
      ". No duplicate short travel leg was created.";
    await this.render(true);
    return true;
  }

  /** Resume toward original Point B, or explicitly choose a new one for legacy Journals. */
  async continueFromCheckpoint(){
    const {pending,view}=this.verifyPendingTransfer();
    const atDestination=this.isAtJourneyDestination(pending.checkpoint);
    const selectedEnd=this.end??this.recoveryRecord?.destination;
    // Never create another tiny leg back to the checkpoint already occupied.
    this.end=atDestination?null:(selectedEnd?{...selectedEnd}:null);
    this.pendingTransfer=null;
    this.sourceMode="party";
    const atlas=this.atlasProvider(this.scene);
    this.syncPartyDeparture(view,atlas);
    this.calculateRoute(view,atlas);
    this.travelNotice=this.end?
      "Continuing from "+pending.checkpoint.name+" toward the saved Point B. "+
        "Select transportation for the next leg.":
      "Checkpoint confirmed at "+pending.checkpoint.name+". "+
        "Choose an onward Point B to continue this Journey without replaying past travel.";
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
      void this.saveJourneyCheckpoint(session,"interrupted").catch(error=>
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
    let methodTravel=resolveNavigationMethodTravel(this.travelMethod,travel,game.settings,sceneUnit,
      {systemId:game.system?.id});
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

  async _renderHTML() {
    const root=el("section");
    root.style.cssText="display:flex;flex-direction:column;height:100%;max-height:100%;min-height:0;overflow:hidden;";
    const body=el("div");
    body.style.cssText="display:flex;flex-direction:column;gap:.85rem;padding:1rem;flex:1;min-height:0;overflow-y:auto;";
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
    if(this.result?.status==="ok"){
      try{transferPlan=this.transportationTransitionPlan();}
      catch(error){atlasWarn("navigation","Transportation leg planning unavailable",error);}
    }
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
    const methodRow=el("div");
    methodRow.style.cssText="display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;";
    const methodLabel=el("label","Travel method");
    methodLabel.htmlFor="atlas-navigation-travel-method";
    const methodSelect=el("select");
    methodSelect.id="atlas-navigation-travel-method";
    methodSelect.title="Party transport or services offered at the departure checkpoint";
    methodSelect.disabled=Boolean(this.travelSession||this.journalStarting);
    methodSelect.style.cssText="flex:1;min-width:12rem;";
    const availability=this.transportAvailability();
    const methods=availability.methods;
    if(!methods.some(item=>item.id===this.travelMethod)){
      this.travelMethod="walking";this.transportArrangement="owned";
      this.transportHireTerms=null;this.transportHireDenomination=null;
      this.transportJourneyOverrides=null;
      this.transportOperation="normal";
    }
    const choices=[
      ...methods.filter(item=>item.id==="walking"||availability.owned.has(item.id))
        .map(method=>({value:"owned|"+method.id,label:method.name,group:"Party"})),
      ...methods.flatMap(method=>{
        const offer=availability.offers.get(method.id);
        return offer?[{value:"hire|"+method.id,label:method.name,
          group:offer.checkpointName||"Nearby checkpoint"}]:[];
      })
    ];
    appendGroupedTransportationOptions(methodSelect,choices);
    methodSelect.value=this.transportArrangement+"|"+this.travelMethod;
    methodSelect.addEventListener("change",()=>{
      const [arrangement,method]=methodSelect.value.split("|",2);
      this.setTravelMethod(method,arrangement);
    });
    methodRow.append(methodLabel,methodSelect);
    if(this.travelMethod!=="walking"){
      const edit=el("button");edit.type="button";
      edit.title="Edit this journey's travel method using the World preset fields";
      edit.setAttribute?.("aria-label","Edit selected travel method for this journey");
      edit.innerHTML='<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>';
      edit.disabled=Boolean(this.travelSession||this.journalStarting);
      edit.style.cssText="min-width:2.5rem;min-height:2.5rem;";
      edit.addEventListener("click",()=>void this.editJourneyTravelMethod().catch(error=>
        globalThis.ui?.notifications?.error?.(error?.message??String(error))));
      methodRow.append(edit);
    }
    if(this.result?.status==="ok"&&!transferPlan?.hasTransitions)body.appendChild(methodRow);
    if(this.travelMethod!=="walking"&&!transferPlan?.hasTransitions){
      const worldMethod=methods.find(item=>item.id===this.travelMethod);
      const method=worldMethod&&this.effectiveTransportMethod(worldMethod,availability);
      if(method){
        if(this.transportArrangement==="hire"&&!availability.offers.has(method.id))
          this.transportArrangement="owned";
        if(!method.overtimeEnabled&&this.transportOperation==="overtime"||
           !method.continuousEnabled&&this.transportOperation==="continuous")
          this.transportOperation="normal";
        const services=el("div");
        services.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:.65rem;";
        const arrangementLabel=el("label","Arrangement");
        arrangementLabel.style.cssText="display:grid;gap:.25rem;font-size:.87em;";
        const arrangement=el("select");arrangement.title="Choose whether the party owns or plans to hire this transport";
        arrangement.disabled=Boolean(this.travelSession||this.journalStarting);
        for(const [id,label] of [["owned","Party-owned"],["hire","For hire / passage"]]){
          if(id==="hire"&&!availability.offers.has(method.id))continue;
          if(id==="owned"&&!availability.owned.has(method.id))continue;
          const opt=el("option",label);opt.value=id;arrangement.append(opt);
        }
        arrangement.value=this.transportArrangement;
        arrangement.addEventListener("change",()=>{
          if(this.travelSession)return;
          this.transportArrangement=arrangement.value;
                try{
            const view=this.canvasProvider();
            this.calculateRoute(view,this.atlasProvider(this.scene));this.draw();
          }catch(error){atlasWarn("navigation","Service arrangement refresh failed",error);}
          void this.render(true);
        });
        arrangementLabel.append(arrangement);
        const operationLabel=el("label","Operating schedule");
        operationLabel.style.cssText="display:grid;gap:.25rem;font-size:.87em;";
        const operation=el("select");operation.title="Select GM-approved daily transport operation";
        operation.disabled=Boolean(this.travelSession||this.journalStarting);
        const normalProfile=resolveNavigationTravelRules({settings:game.settings,
          systemId:game.system?.id,actorHoursPerDay:null});
        const standardHours=method.surface==="land"?(normalProfile.dailyHours??8):8;
        const operations=[["normal","Standard — "+standardHours+"h/day"]];
        if(method.overtimeEnabled)operations.push(["overtime",
          "Overtime — up to "+(8+(method.overtimeExtraHours??8))+"h/day"]);
        if(method.continuousEnabled&&method.kind==="vehicle"&&
            ["water","air"].includes(method.surface))
          operations.push(["continuous","Continuous — 24h/day"]);
        for(const [id,label] of operations){
          const opt=el("option",label);opt.value=id;operation.append(opt);
        }
        operation.value=this.transportOperation;
        operation.addEventListener("change",()=>{
          if(this.travelSession)return;
          this.transportOperation=operation.value;
          this.journeySchedule=null;
          void this.render(true);
        });
        operationLabel.append(operation);
        services.append(arrangementLabel,operationLabel);
        body.append(services);
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
    // Native Scene units remain authoritative for routing, timing and movement.
    // Only presentation is converted to the World Atlas measuring preference.
    const showDistance=amount=>atlasFormatMeasure(atlasDisplayDistance(amount,sceneUnit));
    const showSpeed=amount=>atlasFormatMeasure(atlasDisplaySpeed(amount,sceneUnit));
    const travelSource=travel.source==="group-method"?
      `${travel.methodLabel} (party-owned convoy; slowest matching resource) · ${showSpeed(speed)}`:
      travel.source==="atlas-method"?
      `${travel.methodLabel} (World transportation preset) · ${showSpeed(speed)}`:
      travel.source==="party" ?
      `${travel.actorName} · ${travel.pace} pace · ${showSpeed(speed)}` :
      `Atlas default · ${showSpeed(speed)}`;
    const methodAssessment=this.assessTravelMethod();
    const assistedLegReady=Boolean(transferPlan?.hasTransitions&&
      !this.pendingTransfer&&this.sourceMode==="party"&&
      transferPlan.legs[0]?.selectedOption&&
      !transferPlan.legs[0]?.errors?.length&&
      transferPlan.legs[0]?.arrivalCheckpoint&&
      transferPlan.legs[0]?.transferValid);
    if(this.travelMethod!=="walking"&&!transferPlan?.hasTransitions){
      const advisory=el("p",methodAssessment.reason??"Transport planning only.");
      advisory.style.cssText="margin:0;padding:.5rem;border:1px solid #b18b54;border-radius:6px;font-size:.83em;";
      body.appendChild(advisory);
    }
    if(this.travelMethod!=="walking"&&!transferPlan?.hasTransitions &&
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
          const capacityNote=el("p",roster.travelers+" traveler(s); "+
            capacity.seats+" available "+selectedMethod.surface+" seat(s). "+
            (capacity.missing?capacity.missing+" additional seat(s) needed. ":
              capacity.sufficient?"Capacity meets party size. ":"")+
            (capacity.unknown?"Some transport capacities are not specified. ":"")+
            (roster.unclassified?roster.unclassified+" NPC role(s) still need GM review. ":"")+
            (capacity.matched?"Availability does not mean the party has boarded.":
              "No matching Group resource. Assign an owned mount or vehicle to this method."));
          capacityNote.style.cssText="margin:0;padding:.5rem;border:1px solid "+
            (capacity.missing?"#b18b54":"var(--color-border-light-tertiary,#666)")+
            ";border-radius:6px;font-size:.83em;";

          const capacityBox=el("div");
          capacityBox.style.cssText="display:grid;gap:.4rem;";
          capacityBox.appendChild(capacityNote);
          if(capacity.missing||roster.unclassified){
            const controls=el("div");
            controls.style.cssText="display:flex;gap:.5rem;flex-wrap:wrap;";
            const review=el("button","Review mounts & NPC roles");
            review.type="button";
            review.addEventListener("click",()=>{
              try{openAtlasGroupTransportation(group.id);}catch(error){
                globalThis.ui?.notifications?.error?.(error.message??String(error));
              }
            });
            const refresh=el("button","Refresh seats");
            refresh.type="button";
            refresh.addEventListener("click",()=>void this.render());
            controls.append(review,refresh);capacityBox.appendChild(controls);
            capacityBox.appendChild(el("small","In the Group sheet\u0027s Travel Pace header, open Manage Party Transportation, "+
              "set a mount NPC's Role to Mount, specify its quantity and rider capacity, "+
              "then Save assignments. Refresh seats after saving."));
          }
          body.appendChild(capacityBox);

        }
      }catch(error){atlasWarn("navigation","Group capacity preview unavailable",error);}
    }
    if(this.travelMethod!=="walking"&&this.result?.status==="ok"&&
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
            const block=el("section");
            block.style.cssText="display:grid;gap:.55rem;border:1px solid var(--color-border-light-tertiary,#777);border-radius:8px;padding:.65rem;";
            if(original){
              const initial=el("div","World preset estimate: "+formatMoney(original.totalCp));
              initial.style.cssText="opacity:.78;font-size:.9em;";block.append(initial);
            }
            block.append(el("strong","Current "+(quote.arrangement==="hire"?
              "hired service":"party-owned transport")+" estimate: "+formatMoney(quote.totalCp)));
            block.append(el("small",[
              quote.baseLabel+": "+formatMoney(quote.baseCp),
              "Paid crew: "+formatMoney(quote.crewWagesCp),
              "Overtime fare: "+formatMoney(quote.overtimeFareCp),
              "Overtime labor: "+formatMoney(quote.overtimeCrewCp)
            ].filter(Boolean).join(" · ")));
            const timetable=el("small",quote.travelDays+" operating day(s) at "+
              quote.dailyHours+"h/day, "+quote.extraHours.toFixed(1)+" overtime hour(s), "+
              quote.units+" transport unit(s). "+
              (this.transportArrangement==="hire"?"Checkpoint availability listed; booking not confirmed. ":"")+
              "No currency is deducted.");
            timetable.style.cssText="opacity:.8;";block.append(timetable);
            const disabled=Boolean(this.travelSession||this.journalStarting);
            if(this.transportJourneyOverrides&&
                Object.keys(this.transportJourneyOverrides).length){
              const helper=el("small","Journey-only settings are active. "+
                "Use the pencil beside Travel method to edit them.");
              helper.style.opacity=".85";block.append(helper);
              const reset=el("button","Reset journey overrides");reset.type="button";
              reset.disabled=disabled;reset.style.cssText="justify-self:start;";
              reset.addEventListener("click",()=>{
                if(disabled)return;
                this.transportJourneyOverrides=null;
                this.calculateRoute(this.canvasProvider(),this.atlasProvider(this.scene));
                this.draw();void this.render(true);
              });
              block.append(reset);
            }
            body.append(block);
          }
        }
      }catch(error){
        atlasWarn("navigation","Transport service preview unavailable",error);
        const warning=el("p","Transport cost estimate unavailable: "+(error.message??String(error)));
        warning.style.cssText="margin:0;padding:.5rem;border:1px solid #b18b54;border-radius:6px;font-size:.83em;";
        body.append(warning);
      }
    }
    const help=el("p",partyMode?
      "Atlas reads Point A from the assigned party token's Scene location. Click the map for B; Alt/Option+click changes B. Refresh location after moving the token.":
      "After choosing A and B, ordinary map clicks leave the route unchanged. Shift+click sets Point A; Alt/Option+click sets Point B.");
    help.style.cssText="margin:0;font-size:.8em;opacity:.75;line-height:1.35;";
    body.appendChild(help);
    if(this.pendingTransfer){
      const choice=el("section");
      choice.style.cssText="padding:.8rem;border:2px solid #caa15c;border-radius:8px;display:grid;gap:.4rem;";
      choice.append(el("h3","Checkpoint reached · "+this.pendingTransfer.checkpoint.name));
      const atDestination=isJourneyDestinationCheckpoint(this.recoveryRecord,
        this.pendingTransfer.checkpoint,this.scene.grid.size);
      choice.append(el("p",atDestination?
        "The party has reached its original destination. Complete this Journey now or stop and replan. Atlas will not create another short leg back to the same checkpoint.":
        "The previous leg is confirmed in the Journey Journal. "+
        "Choose to stop and replan or to continue with a new method. "+
        "No further token movement, booking or payment occurs until you confirm."));
      body.append(choice);
    }
    if(transferPlan?.hasTransitions&&!this.pendingTransfer){
      const section=el("section");
      section.style.cssText="display:grid;gap:.65rem;border:1px solid var(--color-border-light-tertiary,#777);border-radius:8px;padding:.8rem;";
      section.append(el("h3","Current journey leg"));
      const note=el("small",transferPlan.legs[0]?.recovered?
        "Recovered voyage: the previously approved transportation remains assigned. No second fare or boarding is applied. Atlas will continue from the last confirmed token position to the saved checkpoint.":
        "Choose transportation for the stretch ahead. At the next checkpoint the party may stop, reconsider its destination, or choose a new method. Future legs are only a GM preview; no booking, payment or movement occurs here.");
      note.style.cssText="opacity:.8;line-height:1.45;";
      section.append(note);
      const formatMoney=cp=>dndCurrencyBreakdown(cp,
        globalThis.CONFIG?.DND5E?.currencies).label;
      const leg=transferPlan.legs[0];
      if(leg){
        const card=el("article");
        card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:7px;padding:.7rem;display:grid;gap:.55rem;";
        const place=leg.departureCheckpoint?.name??"Starting point";
        const finish=leg.arrivalCheckpoint?.name??(leg.surface==="unspecified"?
          "Unclassified approach":"Next transfer or destination");
        const surface=leg.surface==="unspecified"?"UNCLASSIFIED":leg.surface.toUpperCase();
        card.append(el("strong","Leg 1 · "+surface+" · "+place+" → "+finish));
        if(leg.recovered&&this.recoveryRecord?.legs?.at(-1)?.transport?.operation==null&&
            ["water","air"].includes(leg.surface)&&
            leg.selectedOption?.method?.kind==="vehicle"){
          const operationLabel=el("label","Operating schedule for recovered voyage");
          operationLabel.style.cssText="display:grid;gap:.3rem;font-size:.87em;";
          const recoveredOperation=el("select");
          recoveredOperation.disabled=Boolean(this.travelSession||this.journalStarting);
          for(const [value,label] of [
            ["normal","Standard — 8h/day"],
            ["continuous","Continuous — crewed 24h operation"]
          ]){
            const entry=el("option",label);entry.value=value;
            recoveredOperation.append(entry);
          }
          recoveredOperation.value=leg.operation;
          recoveredOperation.addEventListener("change",()=>{
            this.recoveryOperationOverride=recoveredOperation.value;
            void this.render(true);
          });
          operationLabel.append(recoveredOperation);
          card.append(el("small","This older Journey Journal did not retain its operating schedule. The GM must confirm whether the hired vessel has rotating crew before restoring continuous travel."));
          card.append(operationLabel);
        }
        const road=el("small",leg.roadNames.join(", ")||"Surface not authored");
        road.style.opacity=".75";card.append(road);
        const methodLabel=el("label","Transportation for this leg");
        methodLabel.style.cssText="display:grid;gap:.3rem;min-width:0;";
        const methodRow=el("div");
        methodRow.style.cssText="display:flex;gap:.5rem;align-items:center;min-width:0;";
        const select=el("select");
        select.style.cssText="flex:1;min-width:0;";
        select.disabled=Boolean(this.travelSession||this.journalStarting||leg.recovered);
        select.setAttribute("aria-label","Transportation method for current leg");
        const placeholder=el("option","Select a transport method");
        placeholder.value="";select.append(placeholder);
        appendGroupedTransportationOptions(select,leg.options);
        select.value=leg.selectedValue;
        select.addEventListener("change",()=>{
          if(this.travelSession||this.journalStarting)return;
          this.transferSelections[0]=select.value;
          delete this.transferLegOverrides[0];
          void this.render(true);
        });
        methodRow.append(select);
        if(!leg.recovered&&leg.selectedOption&&leg.selectedOption.method?.id!=="walking"){
          const edit=el("button");
          edit.type="button";edit.title="Edit this leg's transportation and save for trip or checkpoint";
          edit.setAttribute("aria-label","Edit current leg transportation");
          edit.innerHTML='<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>';
          edit.style.cssText="min-width:2.5rem;min-height:2.5rem;";
          edit.disabled=Boolean(this.travelSession||this.journalStarting);
          edit.addEventListener("click",()=>void this.editTransportationLeg(0)
            .catch(error=>globalThis.ui?.notifications?.error?.(error.message??String(error))));
          methodRow.append(edit);
        }
        methodLabel.append(methodRow);card.append(methodLabel);
        if(leg.hours!==null&&leg.costCp!==null){
          const amounts=el("small",showDistance(leg.distance)+" · "+
            formatNavigationDuration(leg.hours,24)+" moving · "+
            formatMoney(leg.costCp)+" estimated cost");
          amounts.style.opacity=".85";card.append(amounts);
        }
        for(const line of leg.narration){
          const event=el("div",line);
          event.style.cssText="font-size:.86em;line-height:1.35;";
          card.append(event);
        }
        for(const error of leg.errors){
          const warning=el("small",error);
          warning.style.cssText="color:#e1a763;line-height:1.4;";
          card.append(warning);
        }
        if(leg.arrivalCheckpoint){
          const choice=el("small","At "+leg.arrivalCheckpoint.name+
            ": stop and replan, or refresh the party's location and decide how to continue. Guided checkpoint arrival choices follow in beta.7.");
          choice.style.cssText="padding:.45rem;border-left:3px solid #b18b54;line-height:1.4;";
          card.append(choice);
        }
        section.append(card);
      }
      if(transferPlan.legs.length>1){
        const future=el("details");
        const title=el("summary","GM preview · "+(transferPlan.legs.length-1)+
          " possible later leg(s) (no decisions committed)");
        title.style.cssText="cursor:pointer;font-weight:600;";
        future.append(title);
        const help=el("small","These are tentative road segments, not a fixed party itinerary. Move or refresh the party token at the actual checkpoint to choose the next method.");
        help.style.cssText="display:block;margin:.4rem 0;opacity:.8;";
        future.append(help);
        for(const next of transferPlan.legs.slice(1)){
          const text=el("div","Leg "+(next.index+1)+" · "+
            (next.surface==="unspecified"?"Unclassified":next.surface)+
            " · "+(next.departureCheckpoint?.name??"Unconfirmed transfer")+
            " → "+(next.arrivalCheckpoint?.name??"Destination or unknown")+
            " · "+(next.roadNames.join(", ")||"Unclassified approach"));
          text.style.cssText="padding:.45rem 0;border-top:1px solid var(--color-border-light-tertiary,#555);font-size:.85em;";
          future.append(text);
        }
        section.append(future);
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
      const summary=el("div");
      summary.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem;";
      const metric=(label,value)=>{
        const card=el("div");card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:8px;padding:.75rem;min-width:0;";
        const small=el("div",label);small.style.cssText="font-size:.8em;opacity:.75;margin-bottom:.25rem;";
        const big=el("strong",value);big.style.cssText="font-size:1.15em;";
        card.append(small,big);summary.appendChild(card);
      };
      const activeLeg=transferPlan?.hasTransitions?transferPlan.legs[0]:null;
      metric(activeLeg?"Current Leg Distance":"Distance",
        showDistance(activeLeg?.distance??this.result.distance));
      let tripExplanation=null;
      try{
        const weighted=this.result.terrainAware?this.result.cost:this.result.distance;
        const hours=activeLeg?activeLeg.hours:navigationHours(weighted,speed);
        metric(activeLeg?"Current Leg Time":"Travel Time",
          hours===null?"Choose method":formatGuidedWorldTime(Math.round(hours*3600)));
        const rules=this.resolveTravelRules(travel);
        const schedule=this.travelMethod==="walking"&&this.journeySchedule&&
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
        const explanation=transferPlan?.hasTransitions?
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
        // The full multi-surface route is only a preview. Its distance must not
        // replace the checkpoint-clipped native journey's timing projection.
        const activeGuidedLeg=this.travelSession?.transportLeg;
        const progressHours=activeGuidedLeg?this.travelSession.schedule.travelHours:
          navigationHours(this.result.terrainAware?this.result.cost:
            this.result.distance,speed);
        this.journeyTimeUI={travelHours:progressHours,
          plan:estimateNavigationTotalTrip(progressHours,
            activeGuidedLeg?this.travelSession.schedule.rules:this.resolveTravelRules(travel)),
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
          `Continue March: +1h moving (roughly ${showDistance(routeAverage)} on this route).`+
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
      if(!transferPlan?.hasTransitions){
        const sourceLabel=el("p",`Speed: ${travelSource}`);
        sourceLabel.style.cssText="margin:0;font-size:.85em;opacity:.85;";
        body.appendChild(sourceLabel);
      }
      try{
        if(transferPlan?.hasTransitions)throw Error("No full-route guided playback for transfer legs.");
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
        const cost=el("p",`Terrain-weighted distance: ${showDistance(this.result.cost)}-equivalent`);
        cost.style.cssText="margin:0;font-size:.85em;";body.appendChild(cost);
      }
      const details=el("details");
      const summaryText=el("summary","How Atlas calculated this journey");
      summaryText.style.cursor="pointer";
      details.appendChild(summaryText);
      const calculation=el("p",this.result.terrainWarning ||
        (transferPlan?.hasTransitions?
          "Every leg uses its selected method's speed, checkpoint offer, crew and upkeep settings. The route uses authored surfaces; transfers require checkpoints. No automatic payments or movement.":
        (this.travelMethod!=="walking"?
          "Transport planning uses physical route distance and the GM's method speed. " +
          "Native Walk/Swim cost Behaviors are not transport costs; transfer points and mode-specific rests are upcoming betas.":
          this.result.terrainAware?
          "Terrain-weighted distance applies the applicable Region movement cost first, " +
          "then the road's travel preset where no Region applies. " +
          "Overlapping Regions follow GM priority; short checkpoint Regions are included. " +
          "Travel time is an estimate and never changes native Token movement.":
          "No compatible terrain cost was available, so travel time uses physical distance.")));
      calculation.style.cssText="font-size:.85em;opacity:.85;line-height:1.4;margin:.4rem 0;";
      details.appendChild(calculation);
      body.appendChild(details);
      const heading=el("h3",transferPlan?.hasTransitions?
        "Directions to next decision point":"Directions");
      heading.style.cssText="margin:.2rem 0 0;";body.appendChild(heading);
      const list=el("div");list.style.cssText="display:flex;flex-direction:column;gap:.4rem;";
      const endpoint=(atStart)=>{
        const item=el("div");
        item.style.cssText="display:flex;align-items:center;gap:.8rem;padding:.8rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:8px;";
        const marker=el("span",atStart?"●":"◆");
        marker.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;font-weight:bold;color:white;background:"+
          (atStart?"#16a765":"#d83c49")+";";
        const body=el("div");
        const name=el("strong",atStart?"Depart from starting point":
          transferPlan?.hasTransitions?
            "Reach "+(transferPlan.legs[0]?.arrivalCheckpoint?.name??"the next decision point"):
            "Arrive at destination");
        const detail=el("div",atStart?"Starting location":
          transferPlan?.hasTransitions?"Decide whether to stop, replan or continue":
          "Final destination");
        detail.style.cssText="opacity:.7;font-size:.8em;margin-top:.2rem;";
        body.append(name,detail);item.append(marker,body);
        return item;
      };
      list.appendChild(endpoint(true));
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
            `${formatNavigationDuration(step.hours,24)} ${step.action?.endsWith("-underway")?"rest aboard while underway":"downtime"} · ${timeContext}`:
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
        const info=el("div",showDistance(step.distance)+
          (transferPlan?.hasTransitions?" · See per-leg time above":" · "+
            formatGuidedWorldTime(Math.round(navigationHours(
              this.result.terrainAware?step.cost:step.distance,speed)*3600))));
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
      const hint=el("p",this.pendingTransfer?
        (this.isAtJourneyDestination()?
          "Complete the saved Journey here, or Continue to choose a new onward Point B.":
          "Continue from this checkpoint to resume the saved route toward Point B.") :
        this.result?.status==="ok"?
          `Travel estimates will use ${travelSource}.`:
          "Choose Point B to see available transportation and journey estimates.");
      hint.style.cssText="margin:0;opacity:.8;font-size:.9em;";body.appendChild(hint);
    }
    const row=el("div");
    row.style.cssText="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;padding:.65rem 1rem;border-top:1px solid var(--color-border-light-tertiary,#555);background:var(--color-bg,#100e18);flex:none;";
    const newRoute=navigationFooterIconButton("New Route","route");
    newRoute.disabled=Boolean(this.travelSession||this.journalStarting||this.pendingTransfer);
    newRoute.title=partyMode?"Choose a new destination from the party token":
      "Clear route and choose a new Point A";
    newRoute.addEventListener("click",()=>{
      this.clear();
      if(partyMode)this.refreshPartyDeparture();
    });
    row.appendChild(newRoute);
    if(this.pendingTransfer){
      const atDestination=this.isAtJourneyDestination();
      const actions=[
        ["Stop and replan","code-branch",()=>this.stopAndReplanAtCheckpoint()],
        ["Continue from checkpoint","forward-step",()=>this.continueFromCheckpoint()],
        ...(atDestination?[["Complete Journey","flag-checkered",
          ()=>this.completeJourneyAtCheckpoint()]]:[])
      ];
      for(const [label,icon,action] of actions){
        const choice=navigationFooterIconButton(label,icon);
        choice.disabled=Boolean(this.journalStarting||this.travelSession);
        choice.addEventListener("click",()=>void action().catch(error=>
          globalThis.ui?.notifications?.error?.(error.message??String(error))));
        row.appendChild(choice);
      }
    }
    if(this.journeyJournal){
      const open=navigationFooterIconButton("Open Journey Journal","book-open");
      open.title="Open the saved Journey Journal and recovery record";
      open.addEventListener("click",()=>void this.journeyJournal.sheet?.render(true));
      row.appendChild(open);
    }
    if(this.result?.status==="ok"){
      const phase=this.travelSession?.phase;
      if(phase==="rest-choice"){
        const rules=this.travelSession.schedule.rules;
        for(const [action,label,icon,title] of [
          ["overnight","Overnight Camp ("+rules.overnightHours+"h)","campground",
            "Camp overnight and reset the daily travel allowance"],
          ["long","Long Rest ("+rules.longRestHours+"h)","bed",
            "Record a long rest; Actor resources remain unchanged"],
          ["short","Short Rest ("+rules.shortRestHours+"h)","mug-hot",
            "Add a short rest without resetting daily travel hours"],
          ["continue","Continue March","person-walking",
            "Continue one more travel hour; adjudicate any Constitution saves manually"]]){
          const button=navigationFooterIconButton(label,icon);
          button.title=title;
          button.disabled=action==="continue"&&this.travelSession.schedule.todayHours>=24-1e-7;
          button.addEventListener("click",()=>this.chooseDailyTravelBreak(action));
          row.appendChild(button);
        }
      }else{
        const moveLabel=phase==="paused"?"Resume Travel":phase==="moving"?
          "Pause Travel":phase==="pausing"?"Pausing…":phase==="ending"?"Ending Journey…":
          phase==="rest-applying"?"Recording Break…":assistedLegReady?
            "Travel to "+transferPlan.legs[0].arrivalCheckpoint.name:"Travel Route";
        const moveIcon=phase==="moving"?"pause":phase==="pausing"||
          phase==="ending"||phase==="rest-applying"?"hourglass-half":"play";
        const move=navigationFooterIconButton(moveLabel,moveIcon);
        move.disabled=this.journalStarting||(!this.travelSession&&
          !methodAssessment.guided&&!assistedLegReady)||phase==="ending"||
          phase==="pausing"||phase==="rest-applying";
        move.title=phase==="paused"?"Resume the paused journey":phase==="moving"?
          "Pause after the current short road stretch":moveLabel;
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
      if(this.travelSession?.transportLeg?.transport?.operation==="continuous"&&
          this.travelSession.phase==="moving"){
        const session=this.travelSession;
        for(const [action,label,icon,hours] of [
          ["short","Short Rest Aboard","mug-hot",session.schedule.rules.shortRestHours],
          ["long","Long Rest Aboard","bed",session.schedule.rules.longRestHours]
        ]){
          const underway=navigationFooterIconButton(label+" ("+hours+"h)",icon);
          underway.title="Rest while the vessel continues traveling; World time advances with confirmed movement only.";
          underway.disabled=Boolean(session.pendingPassengerRest)||
            hours>session.schedule.remainingHours+1e-7;
          underway.addEventListener("click",()=>void this.choosePassengerRest(action)
            .then(approved=>{
              if(!approved)ui.notifications.warn("A passenger rest is already underway.");
            }).catch(error=>ui.notifications.warn(error.message??String(error))));
          row.appendChild(underway);
        }
      }
      if(this.travelSession){
        const end=navigationFooterIconButton("End Journey","flag");
        end.disabled=this.travelSession.phase==="ending";
        end.title="Stop this journey permanently at the token's current position";
        end.addEventListener("click",()=>{
          if(!this.stopGuidedTravel())ui.notifications.warn("The journey could not be ended.");
        });
        row.appendChild(end);
      }
    }
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
