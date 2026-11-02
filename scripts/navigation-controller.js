import { readAtlas } from "./atlas-storage.js";
import { toAtlasPoint, toCanvasPoint } from "./road-coordinates.js";
import { calculateSceneRoadRoute } from "./navigation-foundry.js";
import { roadStrokeSpans } from "./road-appearance.js";
import { drawNavigationLine, drawNavigationMarker } from "./navigation-graphics.js";
import { navigationCanvasLegPaths } from "./navigation-render-path.js";
import { createGuidedTokenWaypoints } from "./navigation-token-travel.js";
import { partyTokenCanvasCenter } from "./navigation-party-origin.js";
import { planGuidedTravelChunks, waitForTokenTravelAnimation }
  from "./navigation-movement-lifecycle.js";
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
    this.pointerTarget = null;
    this.overlay = null;
    this.pointerDown = this.onPointerDown.bind(this);
    this.closedByController = false;
  }

  get active() { return Boolean(this.scene); }

  activate() {
    const view = this.canvasProvider();
    if (!game.user?.isGM || !view?.ready || !view.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may navigate an active Atlas Scene.");
    }
    this.stop();
    this.scene = view.scene;
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

  /** Update the live progress display without re-rendering the scrollable directions. */
  setTravelProgress(percent){
    this.travelProgress=Math.max(0,Math.min(100,Number(percent)||0));
    const ui=this.travelProgressUI;
    if(ui){
      ui.bar.value=this.travelProgress;
      ui.label.textContent=`${Math.floor(this.travelProgress)}% complete`;
    }
  }

  /** Hold the next native move while the GM decides whether to resume or end. */
  async waitForGuidedTravelResume(session){
    if(session.phase==="pausing"){
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
    if(this.travelSession)throw Error("Guided travel is already in progress.");
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
    const playback=calculateGuidedPlayback({
      route:this.result,travel:this.resolveTravel().travel,paths,
      gridSize:this.scene.grid?.size,
      secondsPerHour:readGuidedPlaybackSetting(game.settings)
    });
    const chunks=planGuidedTravelChunks(waypoints,{
      movementSpeed:playback.movementSpeed,gridSize:this.scene.grid.size
    });
    const totalDistance=chunks.reduce((sum,chunk)=>sum+chunk.distance,0);
    const session={token,sceneId:this.scene.id,gridSize:this.scene.grid.size,
      phase:"moving",resumeWaiter:null,
      completedDistance:0,totalDistance,currentChunk:null,timer:null};
    this.travelSession=session;
    this.travelNotice="Guided travel in progress. Pause Travel stops at the next short stretch.";
    this.setTravelProgress(0);
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
      let reachedEnd=true,interruptedReason=null;
      for(const chunk of chunks){
        if(this.travelSession!==session||session.phase==="ending"){
          reachedEnd=false;break;
        }
        await this.waitForGuidedTravelResume(session);
        if(this.travelSession!==session||session.phase==="ending"){
          reachedEnd=false;break;
        }
        session.currentChunk={distance:chunk.distance,startedAt:Date.now(),
          durationMs:1000*chunk.distance/pixelsPerSecond};
        const completed=await token.move(chunk.waypoints,{
          animate:true,autoRotate:false,showRuler:false,pan:false,
          animation:{movementSpeed:playback.movementSpeed}
        });
        // Native document updates can finish long before the visible movement.
        // Never submit the next stretch until this Canvas animation is finished.
        await waitForTokenTravelAnimation(token);
        if(this.travelSession!==session)return false;
        if(completed)session.completedDistance+=chunk.distance;
        session.currentChunk=null;
        this.setTravelProgress(Math.min(99,100*session.completedDistance/totalDistance));
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
      }
      if(this.travelSession===session){
        const arrived=reachedEnd&&session.phase!=="ending";
        if(arrived)this.setTravelProgress(100);
        this.travelNotice=arrived?"Arrived at destination.":
          (interruptedReason??"Journey ended at the last completed road stretch.");
        return arrived;
      }
      return false;
    }finally{
      if(session.timer!==null)clearInterval(session.timer);
      session.resumeWaiter?.();
      if(this.travelSession===session){
        this.travelSession=null;
        if(this.active)void this.render(true);
      }
    }
  }

  /** Pause at the next short native movement boundary (at most ~2s). */
  pauseGuidedTravel(){
    const session=this.travelSession;
    if(!session||session.phase!=="moving")return false;
    session.phase="pausing";
    this.travelNotice="Pausing after the current short road stretch…";
    if(this.active)void this.render(true);
    return true;
  }

  resumeGuidedTravel(){
    const session=this.travelSession;
    if(!session||session.phase!=="paused"||!session.resumeWaiter)return false;
    session.phase="moving";
    this.travelNotice="Journey resumed.";
    session.resumeWaiter();
    if(this.active)void this.render(true);
    return true;
  }

  stopGuidedTravel({render=true}={}){
    const session=this.travelSession;
    if(!session)return false;
    session.phase="ending";
    session.resumeWaiter?.();
    this.travelNotice="Ending journey after the current short road stretch…";
    if(render&&this.active)void this.render(true);
    return true;
  }

  /** Deliberate route reset without any Scene or token mutation. */
  clear(reason="") {
    if(this.travelSession)this.stopGuidedTravel({render:false});
    this.start = null;
    this.end = null;
    this.result = null;
    this.itinerary=null;
    this.routeRevision=null;
    this.notice=reason;
    this.travelNotice="";
    this.travelProgress=0;
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
    if(this.travelSession)this.stopGuidedTravel({render:false});
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
  }

  tearDown() {
    this.stop();
    if (this.rendered) {
      this.closedByController = true;
      void this.close();
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
      summary.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;";
      const metric=(label,value)=>{
        const card=el("div");card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:8px;padding:.75rem;min-width:0;";
        const small=el("div",label);small.style.cssText="font-size:.8em;opacity:.75;margin-bottom:.25rem;";
        const big=el("strong",value);big.style.cssText="font-size:1.15em;";
        card.append(small,big);summary.appendChild(card);
      };
      metric("Distance",`${this.result.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`);
      try{
        const weighted=this.result.terrainAware?this.result.cost:this.result.distance;
        metric("Travel time",formatNavigationDuration(navigationHours(weighted,speed),travel.hoursPerDay??24));
      }catch(error){metric("Travel time","Unavailable");}
      body.appendChild(summary);
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
      }else this.travelProgressUI=null;
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
          "Visual speed only; the game clock does not advance yet.");
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
      const steps=this.itinerary?.directions??buildNavigationSteps(this.result.legs,
        id=>this.atlasProvider(this.scene).roads.find(road=>road.id===id)?.name??"Road");
      for (const step of steps) {
        const item=el("div");item.style.cssText="display:flex;align-items:flex-start;gap:.8rem;padding:.8rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:8px;";
        const marker=el("span",NAVIGATION_ARROWS[step.direction]??"•");
        marker.style.cssText="display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;background:var(--color-cool-4,#333);font-weight:bold;";
        marker.title=step.direction||"Route";
        const text=el("div");text.style.minWidth="0";
        const instruction=el("strong",step.instruction);instruction.style.display="block";
        const info=el("div",`${step.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${unit} · `+
          `${formatNavigationDuration(navigationHours(this.result.terrainAware?step.cost:step.distance,speed),travel.hoursPerDay??24)}`);
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
    newRoute.disabled=Boolean(this.travelSession);
    newRoute.title=partyMode?"Choose a new destination from the party token":"Clear route and choose a new Point A";
    newRoute.addEventListener("click",()=>{
      this.clear();
      if(partyMode)this.refreshPartyDeparture();
    });
    row.appendChild(newRoute);
    if(this.result?.status==="ok"){
      const phase=this.travelSession?.phase;
      const move=el("button",phase==="paused"?"Resume Travel":phase==="moving"?
        "Pause Travel":phase==="pausing"?"Pausing…":phase==="ending"?"Ending Journey…":"Travel Route");
      move.type="button";
      move.disabled=phase==="ending"||phase==="pausing";
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
    super._onClose?.(options);
    this.stop();
    this.closedByController = false;
  }
}
