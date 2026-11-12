/**
 * FVTT Atlas Navigation — Foundry v14 bootstrap.
 * v0.2.22 adds GM-only authoring shortcuts and a floating road editor.
 */
import { addAtlasRoadsToSceneConfig, registerAtlasSceneTab,
  getAtlasSceneConfig, refreshAtlasSceneConfig, forgetAtlasSceneConfig,
  openAtlasRegionGenerator,closeCheckpointRegionGenerator } from "./scene-config.js";
import { openAtlasSceneWorkspace, minimizeAtlasSceneWorkspace,
  refreshAtlasSceneWorkspace, restoreAtlasSceneWorkspace }
  from "./atlas-scene-workspace.js";
import { RoadCanvasController } from "./road-canvas.js";
import { reviewIndependentCheckpointConnections } from "./road-checkpoint-review-dialog.js";
import { createIndependentCheckpointFromDraft } from "./road-authoring-foundry.js";
import {AtlasLayersController} from "./atlas-layers.js";
import {acquireAtlasCanvasEditorFocus} from "./atlas-canvas-editor-focus.js";
import { addAtlasExplorerToTokenConfig } from "./atlas-token-config.js";
import { observeAtlasTokenMovement } from "./atlas-token-exploration.js";
import { readAtlas, MODULE_ID } from "./atlas-storage.js";
import { savePartyExplorationConfig,
  saveCheckpointKnowledge } from "./party-exploration-storage.js";
import { readManualFog, setManualFogEnabled }
  from "./atlas-manual-fog-storage.js";
import { AtlasManualFogController } from "./atlas-manual-fog-renderer.js";
import { isManualFogOnlySceneUpdate,shouldRefreshManualFogForSceneUpdate }
  from "./atlas-manual-fog-refresh.js";
import { AtlasManualFogPalette, registerManualBrushSettings }
  from "./atlas-manual-fog-panel.js";
import { saveRenamedRoad, saveRemovedRoad, saveAnchoredLegacyRoads,
  saveOrganizedRoads, saveMergedRoads,
  saveEditedCheckpoint, saveNewIndependentCheckpoint, saveRelocatedIndependentCheckpoint, saveConnectedIndependentCheckpoint,
  saveDisconnectedIndependentCheckpoint, saveRemovedCheckpoint, saveRemovedCheckpoints, saveRoadTravelPreset,
  saveRoadAppearance, saveRoadSettings, saveRoadPlayerVisibility,
  saveCheckpointPlayerVisibility } from "./road-storage.js";
import { getRoadMergeCandidates, suggestRoadName } from "./road-model.js";
import { sceneImageOrigin, toCanvasPoint } from "./road-coordinates.js";
import { roadFocusCamera } from "./road-focus-camera.js";
import { linkAtlasRegion, unlinkAtlasRegion, listSceneRegions } from "./region-atlas.js";
import {listPublicTerritorySettings,readPublicTerritory,savePublicTerritory}
  from "./region-narration.js";
import { createPublicTerritoryForm } from "./territory-public-form.js";
import { listSceneGeography,readRegionGeography,saveRegionGeography }
  from "./territory-geography-storage.js";
import {readPlayerTerritorySharing,savePlayerTerritorySharing}
  from "./player-territory-sharing.js";
import {territoryTier} from "./territory-view-model.js";
import {readTerritoryCheckpointLink,territoryCheckpointLinks,
  saveTerritoryCheckpointLink} from "./territory-checkpoint-link.js";
import {checkpointTerritoryChoices,territoryCheckpointChoices,territoryLinkOptionGroups}
  from "./territory-checkpoint-presentation.js";
import {checkpointCategory} from "./checkpoint-types.js";
import { buildTerritoryGeographyForm,geographyFromForm }
  from "./territory-geography-form.js";
import {planNativeRegionSmoothing,saveNativeRegionSmoothing}
  from "./region-boundary.js";
import {analyzeSceneTerritoryBorders,planNativeTerritoryTrim,
  saveNativeTerritoryTrim} from "./territory-border-reconciliation.js";
import {TerritoryAuthoringCanvas} from "./territory-authoring-canvas.js";
import {routeTerritoryBatchAfterStage} from "./territory-batch-workflow.js";
import {createTerritoryRecoveryConfirmationContent}
  from "./territory-recovery-dialog.js";
import {planTerritoryGridConversion,commitTerritoryGridConversion,
  restoreTerritoryPolygonBackup} from "./territory-grid-conversion.js";
import {TerritoryGridConversionPreview} from "./territory-grid-conversion-preview.js";
import {inspectTerritoryGridOwnership,inspectEditableTerritoryGridSeams,
  planTerritoryCellTransfer,commitTerritoryCellTransfer,
  planMultiDestinationTerritoryCellTransfer,commitMultiDestinationTerritoryCellTransfer,
  readPendingTerritoryCellTransfer,inspectPendingTerritoryCellTransfer,
  resolveTerritoryCellTransfer}
  from "./territory-grid-transfer.js";
import {preferredTerritoryCreationMethod} from "./territory-authoring-model.js";
import {readTerritoryDraft,selectedBlankWallBoundary,saveTerritoryDraft,
  planNativeTerritoryAdoption,adoptNativeTerritoryBoundary}
  from "./territory-authoring.js";
import {atlasSettingsTitle,atlasTerrainRegionSheetClass}
  from "./atlas-settings-title.js";
import {GEOGRAPHY_KINDS} from "./territory-geography-model.js";
import { planSceneGeneratedRegion, saveGeneratedNativeRegion, listGeneratedRegions,
  setGeneratedRegionTravelPreset, applyGeneratedRegionMovementCost,
  applyGeneratedRegionPresetColor, updateGeneratedRegionMovementCost,
  listSceneOrderedGeneratedRegions,
  moveSceneGeneratedRegion } from "./generated-region.js";
import { availableMovementActions, readPreset, previewNativeMovementCost }
  from "./native-movement-cost.js";
import { presetCostSummary } from "./travel-preset-model.js";
import { registerWorldTravelPresets, readWorldTravelPresets }
  from "./travel-preset-settings.js";
import { createTravelPresetSelect,createSettingsIconButton } from "./settings-controls.js";
import { createSettingsSelect,createSettingsGroupedSelect } from "./settings-select.js";
import { createSettingsInput } from "./settings-input.js";
import { promptNativeMovementAction } from "./native-movement-action-picker.js";
import { createRoadPresetStage } from "./road-settings-preset.js";
import { arrangeRoadDialogFooter } from "./road-settings-dialog-footer.js";
import { approveSettingsClose,confirmUnsavedSettings,trackSettingsChanges,
  interceptDialogHeaderClose } from "./settings-close-guard.js";
import { appendSettingsField,createSettingsFieldRow } from "./settings-layout.js";
import { registerWorldCheckpointPresets } from "./checkpoint-preset-settings.js";
import { roadAppearanceForm, roadAppearanceFromForm, registerWorldRoadAppearance }
  from "./road-appearance-settings.js";
import { readWorldRoadAppearance, resolveRoadAppearance, roadAppearanceMode }
  from "./road-appearance.js";
import { AtlasCheckpointAppearanceEditor } from "./checkpoint-appearance-editor.js";
import {planCheckpointTerritory,createCheckpointTerritory,
  CheckpointTerritoryCellPreview} from "./checkpoint-territory-creation.js";
import { readAtlasJournalLinks, journalUuidFor, saveAtlasJournalLink,
  validJournalUuid } from "./atlas-journal-links.js";
import { journalLinkFields, journalUuidFromForm } from "./atlas-journal-fields.js";
import { AtlasRoadEditorDock, activeRoadDockForSceneConfig } from "./road-editor-dock.js";
import { AtlasNavigationController } from "./navigation-controller.js";
import { registerNavigationWorldSettings } from "./navigation-world-settings.js";
import { addAtlasGroupTransportationControl } from "./navigation-group-transport-settings.js";
import { ATLAS_MEASURING_UNITS_SETTING,ATLAS_MEASURING_UNITS_CHOICES,
  resolveAtlasMeasuringUnits,atlasDisplayElevation } from "./navigation-measure-units.js";
import { registerAtlasDebugSettings,atlasDebug,atlasWarn } from "./atlas-debug.js";
import {atlasAnnouncementRuntime} from "./atlas-announcement-runtime.js";

const roadCanvas = new RoadCanvasController();
const atlasLayers = new AtlasLayersController(roadCanvas);
roadCanvas.onCheckpointCreated=(scene,checkpointId,roadId)=>
  openAtlasRegionGenerator(scene,roadId,actions(),()=>{
    roadCanvas.refresh();refreshAtlasSceneConfig(scene);
  },checkpointId);
roadCanvas.onCheckpointSaved=async (scene,checkpointId)=>{
  if(!["city","town","village","settlement"].includes(checkpointCategory(scene,checkpointId)))
    return;
  const view=globalThis.canvas;
  const plan=planCheckpointTerritory(scene,checkpointId,{view});
  if(!plan)return; // Already linked, or no longer a settlement Checkpoint.
  const content=document.createElement("div");
  const intro=document.createElement("p");
  intro.textContent=`Checkpoint ${plan.name} (${plan.kind}) was saved. Create a `+
    `matching native geographic Territory in the single Scene grid cell `+
    `(${plan.offset.i}, ${plan.offset.j}) where it landed?`;
  content.appendChild(intro);
  const details=document.createElement("p");
  details.textContent="Create is optional and GM-only. Its name, geographic kind, " +
    "native grid Shape and Checkpoint association are saved together. " +
    "No native Region Behaviors, movement costs or player visibility will be changed.";
  content.appendChild(details);
  const matching=plan.compatible.filter(item=>item.onCell||item.nameMatch);
  if(matching.length){
    const hint=document.createElement("p");
    hint.textContent="Possible existing Territories: " + matching.slice(0,5)
      .map(item=>item.name+(item.onCell?" (same cell)":"")).join(", ")+
      ". You may choose Link Existing to review all compatible Territories.";
    content.appendChild(hint);
  }
  if(plan.createBlocked){
    const warning=document.createElement("p");
    warning.textContent="Native creation unavailable: "+plan.createBlocked+
      " You may still review an existing association or skip.";
    content.appendChild(warning);
  }
  const preview=new CheckpointTerritoryCellPreview();
  try{
    preview.show(scene,plan,{view});
    const choice=await foundry.applications.api.DialogV2.wait({
      window:{title:`Atlas — ${plan.name} — Territory Creation`,minimizable:true},
      content,
      buttons:[
        ...(!plan.createBlocked?[{action:"create",label:"Create One-Cell Territory",
          icon:"fa-solid fa-draw-polygon"}]:[]),
        {action:"link",label:"Link Existing…",icon:"fa-solid fa-link"},
        {action:"skip",label:"Skip",default:true}
      ],rejectClose:false,modal:false
    });
    if(choice==="create"){
      const saved=await createCheckpointTerritory(scene,plan,{view});
      await closeCheckpointRegionGenerator(scene,checkpointId);
      roadCanvas.refresh();atlasLayers.refresh();refreshAtlasSceneConfig(scene);
      ui.notifications.info(`Native Territory ${saved.name} created and linked to Checkpoint ${plan.name}.`);
    }else if(choice==="link"){
      await actions().configureCheckpointTerritory(scene,checkpointId,()=>{
        roadCanvas.refresh();atlasLayers.refresh();refreshAtlasSceneConfig(scene);
      });
      // The association picker can be cancelled. Close the legacy generator
      // only when a native Territory actually became linked to this Checkpoint.
      if(territoryCheckpointLinks(scene).some(item=>
        item.link?.checkpointId===checkpointId))
        await closeCheckpointRegionGenerator(scene,checkpointId);
    }
  }finally{preview.clear();}
};
roadCanvas.promptCheckpoint = ({ roads, defaultName }) => new Promise(resolve => {
  const scene = globalThis.canvas?.scene;
  if (!scene) { resolve(null); return; }
  const editor = new AtlasCheckpointAppearanceEditor({
    scene, checkpointId: "__new_checkpoint__",
    expectedRevision: readAtlas(scene).revision,
    createDraft: { roads, defaultName }, onCreate: resolve
  });
  Promise.resolve(editor.render(true)).catch(error => {
    ui.notifications.error(error.message ?? String(error));
    resolve(null);
  });
});
roadCanvas.reviewIndependentCheckpointConnections=reviewIndependentCheckpointConnections;

const navigation = new AtlasNavigationController();
const manualFog = new AtlasManualFogController();
const fogPalette = new AtlasManualFogPalette(manualFog);
const territoryCanvas = new TerritoryAuthoringCanvas({manualFog});
const territoryGridPreview = new TerritoryGridConversionPreview();
// Authoring-only, client-local drafts. Never persist staged geometry or expose
// it to players; native writes begin only after explicit batch confirmation.
const territoryBatchSelections=new Map();
const territoryBatchFor=scene=>territoryBatchSelections.get(scene?.id)??null;
const stagedTerritories=scene=>territoryBatchFor(scene)?.drafts??new Map();
let roadDock = null;

function syncRoadDock(scene, refresh) {
  refresh();
  if (roadDock?.scene?.id !== scene.id) return;
  if (!roadCanvas.getDraft(scene)) {
    roadDock.finished = true;
    void roadDock.close();
  } else if (roadDock.rendered) void roadDock.render(true);
}

/** Keep the full Scene sheet out of the map while transient point tools run. */
function openRoadDock(scene, refresh) {
  const previous = roadDock;
  if (previous) {
    previous.finished = true;
    void previous.close();
    roadDock = null;
  }
  const sceneSheet = getAtlasSceneConfig(scene);
  const dock = new AtlasRoadEditorDock({
    scene, controller: roadCanvas, sceneSheet,
    onFinish: () => roadCanvas.finish(),
    onCancel: () => roadCanvas.cancel(),
    onFocus: async () => {
      const subject=roadCanvas.getEditingRoadFocus(scene);
      if(!subject)throw Error("There is no road being edited to locate.");
      if(subject.points && !subject.points.length)
        throw Error("Draw at least one road point before locating it.");
      await centerAtlasOn(scene,subject.roadId,null,{
        atlasOverride:subject.atlas,pointsOverride:subject.points,
        zoomIntoRoad:true
      });
    },
    onClosed: () => {
      restoreEditorWindows?.();
      if (roadDock === dock) roadDock = null;
      refresh();
    }
  });
  const restoreEditorWindows=acquireAtlasCanvasEditorFocus({exclude:[dock]});
  roadDock = dock;
  void Promise.resolve(dock.render(true)).catch(error => {
    restoreEditorWindows();
    if (roadDock === dock) roadDock = null;
    roadCanvas.cancel();
    ui.notifications.error(error.message || String(error));
  });
}

function beginRoadDock(scene, refresh, start) {
  navigation.tearDown();
  start(() => syncRoadDock(scene, refresh));
  openRoadDock(scene, refresh);
}

const atlasFocusFades = new WeakMap();
function fadeSceneSheet(scene) {
  const app=getAtlasSceneConfig(scene);
  const element=app?.element?.[0]??app?.element;
  if (!(element instanceof HTMLElement)) return;
  const prior=atlasFocusFades.get(element);
  if (prior) clearTimeout(prior.timer);
  const original=prior?.opacity??element.style.opacity;
  element.style.opacity="0.25";
  const timer=setTimeout(()=>{
    element.style.opacity=original;
    atlasFocusFades.delete(element);
  },3650);
  atlasFocusFades.set(element,{opacity:original,timer});
}
async function centerAtlasOn(scene, roadId, checkpointId=null,
  {atlasOverride=null,pointsOverride=null,zoomIntoRoad=false}={}) {
  const view=globalThis.canvas;
  if (!view?.ready || view.scene?.id !== scene.id)
    throw Error("Open this Scene on the map first.");
  const atlas=atlasOverride??readAtlas(scene);
  const nodes=new Map((atlas.nodes??[]).map(item=>[item.id,item]));
  let points=pointsOverride??[];
  if (pointsOverride===null) {
    if (checkpointId) {
      const checkpoint=atlas.checkpoints?.find(c=>c.id===checkpointId);
      const node=nodes.get(checkpoint?.nodeId);
      if (node) points=[node];
    } else {
      for (const segment of (atlas.segments??[]).filter(item=>item.roadId===roadId)) {
        for (const point of [nodes.get(segment.from),...segment.via,nodes.get(segment.to)])
          if (point) points.push(point);
      }
    }
  }
  if (!points.length) throw Error("This map location no longer exists.");
  const target=roadFocusCamera(view,atlas,points,{zoomIntoRoad});
  const currentZoom=view.stage?.scale?.x??1;
  fadeSceneSheet(scene);
  roadCanvas.focusOn(scene,checkpointId?"checkpoint":roadId?"road":"draft",
    checkpointId??roadId);
  await view.animatePan({...target,
    scale:checkpointId?Math.max(2.2,currentZoom):target.scale,duration:450});
}

function ensureIdle(scene) {
  if (roadCanvas.getDraft(scene)) {
    throw new Error("Save or cancel your current road edits first.");
  }
}


async function previewAndSaveRegion(scene, settings, { regenerate = false } = {}) {
  ensureIdle(scene);
  const plan = planSceneGeneratedRegion(scene, settings);
  const summary = document.createElement("div");
  const nativeOptIn = !regenerate && plan.kind === "corridor" && !!settings.applyNativeCost;
  const selectedPreset = !regenerate && settings.presetId ? readPreset(settings.presetId) : null;
  const perMode = nativeOptIn && selectedPreset?.movementCosts !== null;
  const action = nativeOptIn && !perMode
    ? availableMovementActions().find(a => a.id === settings.movementAction) : null;
  if (nativeOptIn && !selectedPreset) throw new Error("Choose a world travel preset first.");
  if (nativeOptIn && !perMode && !action) {
    throw new Error("Choose a supported movement action to apply this native cost.");
  }
  const preflight = nativeOptIn
    ? previewNativeMovementCost(selectedPreset.id, perMode ? null : settings.movementAction)
    : null;
  if (preflight && !preflight.ok) throw new Error(preflight.message);
  const multiplier = nativeOptIn && !perMode ? selectedPreset.movementCostMultiplier : null;
  const expectedCosts = nativeOptIn && perMode ? {...selectedPreset.movementCosts} : null;
  for (const message of [
    plan.name,
    plan.kind === "checkpoint"
      ? "A native Region around this one checkpoint."
      : "A native corridor following the connected road geometry.",
    ...(plan.routeSelection?.alternatives ? [
      "This named road has multiple paths between these checkpoints. Atlas selected the shortest stored road path (" +
      plan.routeSelection.segmentIds.length + " section(s)). Review the highlighted preview. Cancel if this is not the path you intended."
    ] : []),
    "Half-width: " + plan.generatedRegion.widthCells + " grid cells (" +
      Math.round(plan.radius * 100) / 100 + " px). " +
      plan.shapes.length + " native shape(s).",
    regenerate
      ? "Regenerate only if its native geometry was not manually edited. Existing name, Levels, Behaviors, visibility and travel preset are preserved."
      : nativeOptIn
        ? "Create one linked native Region WITH one native Modify Movement Cost Behavior, after this confirmation. No other Region is changed."
        : "Create one linked native Region without native Behaviors. Its travel preset stays descriptive metadata until explicitly applied.",
    ...(selectedPreset ? ["Travel preset: " + selectedPreset.name + " (" +
      presetCostSummary(selectedPreset) + "). Native Region color: " + selectedPreset.color + "."] : []),
    ...(nativeOptIn ? [perMode
      ? "Native movement costs: " + presetCostSummary(selectedPreset) +
        ". One Behavior will contain all explicitly selected actions."
      : "Native movement action: " +
        (game.i18n.localize(action.label) || action.label) + " (" + action.id + "). " +
        "Foundry validates the value for this system before saving."] : []),
    "The tinted map overlay is a preview only. Region geometry will be saved only after confirmation."
  ]) {
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    summary.appendChild(paragraph);
  }
  roadCanvas.showRegionPreview(scene, plan);
  try {
    const approved = await foundry.applications.api.DialogV2.confirm({
      window: { title: regenerate ? "Regenerate native road Region" : "Create native road Region" },
      content: summary,
      yes: { label: regenerate ? "Regenerate Region" : "Create Region" },
      rejectClose: false, modal: true
    });
    if (!approved) return;
    if (!roadCanvas.isRegionPreviewActive(scene, plan)) {
      throw new Error("The Scene or Atlas editor changed while the Region preview was open. Nothing was created.");
    }
    const result = await saveGeneratedNativeRegion(scene, plan, {
      regenerate, presetId: regenerate ? null : (settings.presetId ?? null),
      applyNativeCost: nativeOptIn,
      movementAction: nativeOptIn && !perMode ? settings.movementAction : null,
      expectedMultiplier: multiplier, expectedCosts,
      expectedColor: regenerate ? undefined : selectedPreset?.color
    });
    ui.notifications.info(result.created
      ? nativeOptIn
        ? "Atlas created one native corridor Region with the selected movement-cost Behavior."
        : "Atlas created one linked native Region without Behaviors; preset metadata was saved."
      : "Atlas regenerated the Region geometry; native Behaviors were preserved.");
    return result;
  } finally {
    roadCanvas.clearRegionPreview();
  }
}


/** Native DialogV2 picker shared by road defaults and generated Region overrides. */
async function promptTravelPreset(title, currentId = null) {
  const chooser=createTravelPresetSelect({selectedId:currentId,includeCosts:true});
  const container = document.createElement("div");
  const hint = document.createElement("p");
  hint.textContent = "References a world Atlas preset. Native Behaviors are never changed by assignment; apply them separately.";
  container.append(hint, chooser);
  const input = await foundry.applications.api.DialogV2.input({
    window: { title }, content: container,
    ok: { label: "Save Travel Preset" }, rejectClose: false, modal: true
  });
  if (!input) return undefined;
  const presetId = String(input.atlasTravelPresetId ?? "");
  if (presetId && !readWorldTravelPresets().presets.some(p => p.id === presetId)) {
    throw new Error("The selected travel preset was removed; reopen the picker.");
  }
  return presetId || null;
}

/** Stage all new-road settings before installing any canvas draw listeners. */
async function promptNewRoadSettings(scene) {
  const atlas = readAtlas(scene);
  const presets = readWorldTravelPresets().presets;
  const initial = resolveRoadAppearance(null, readWorldRoadAppearance(), "land");
  const content = document.createElement("div"); // DialogV2.input content must have no attributes
  const root = document.createElement("div");
  root.dataset.atlasNewRoadDialog = "";
  root.style.cssText = "max-height:"+Math.max(240,Math.min(590,window.innerHeight-225))+
    "px;overflow-y:auto;padding:.4rem;min-width:0;";
  const tabs = document.createElement("nav");
  tabs.style.cssText = "display:flex;gap:.4rem;border-bottom:1px solid #655;padding-bottom:.65rem;margin-bottom:.7rem;";
  const pages = {};
  for (const [key, label] of [["general","General"],["style","Style"],
      ["checkpoints","Checkpoints"],["regions","Terrain Regions"]]) {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = label;
    button.dataset.atlasNewRoadTab = key;
    button.style.cssText = "flex:1;border:1px solid #655;background:"+
      (key === "general" ? "rgba(156,123,240,.22)" : "transparent")+";";
    tabs.appendChild(button);
    const panel = document.createElement("section");
    panel.dataset.atlasNewRoadPage = key;
    panel.hidden = key !== "general";
    pages[key] = panel;
  }
  const field = (parent,label,control) => appendSettingsField(parent,label,control);
  const name = document.createElement("input");
  name.type = "text";name.name = "draftRoadName";name.maxLength=120;
  name.required = true;name.value=suggestRoadName(atlas);name.defaultValue=name.value;
  field(pages.general,"Road name",name);
  const visible = document.createElement("input");
  visible.type="checkbox";visible.name="draftRoadVisible";visible.value="true";
  field(pages.general,"Show to players",visible);
  const travel=createTravelPresetSelect({name:"draftRoadPreset",noneLabel:"None (Land fallback)"});
  field(pages.general,"Travel preset",travel);
  const journal = document.createElement("input");
  journal.type="text";journal.name="draftRoadJournal";journal.placeholder="JournalEntry… or JournalEntryPage… UUID";
  field(pages.general,"Linked Journal / Page UUID",journal);
  const override = document.createElement("input");
  override.type="checkbox";override.name="draftRoadOverride";override.value="true";
  field(pages.style,"Override world road appearance",override);
  pages.style.appendChild(roadAppearanceForm(initial));
  const note = key => {
    const p=document.createElement("p");
    p.textContent = key === "checkpoints"
      ? "After drawing the road, add checkpoints using the Checkpoints tab in Road Settings."
      : "After drawing the road, generate terrain regions using the Terrain Regions tab.";
    pages[key].appendChild(p);
  };
  note("checkpoints");note("regions");
  root.append(tabs,...Object.values(pages));content.appendChild(root);
  const onTab = event => {
    const button=event.target?.closest?.("[data-atlas-new-road-tab]");
    if (!button?.closest?.(".application")?.querySelector?.("[data-atlas-new-road-dialog]")) return;
    event.preventDefault();event.stopImmediatePropagation();
    const form=button.closest(".application");
    for(const panel of form.querySelectorAll("[data-atlas-new-road-page]"))
      panel.hidden=panel.dataset.atlasNewRoadPage!==button.dataset.atlasNewRoadTab;
    for(const tab of form.querySelectorAll("[data-atlas-new-road-tab]"))
      tab.style.background=tab===button?"rgba(156,123,240,.22)":"transparent";
  };
  document.addEventListener("click",onTab,true);
  let result;
  try {
    result=await foundry.applications.api.DialogV2.input({
      window:{title:atlasSettingsTitle("Road",null,{creating:true}),resizable:true},
      position:{left:24,width:Math.min(620,window.innerWidth-50),
        height:Math.min(720,Math.max(440,window.innerHeight-70))},
      content,ok:{label:"Draw Road"},rejectClose:false,modal:false
    });
  } finally {
    document.removeEventListener("click",onTab,true);
  }
  if (!result) return null;
  const roadName=String(result.draftRoadName??"").trim();
  if (!roadName||roadName.length>120)throw Error("Enter a road name (1–120 characters).");
  const presetId=String(result.draftRoadPreset??"")||null;
  if(presetId&&!presets.some(p=>p.id===presetId))throw Error("Choose an existing travel preset.");
  const journalUuid=journalUuidFromForm(result.draftRoadJournal);
  if(journalUuid&&!validJournalUuid(journalUuid))throw Error("Use a valid Journal Entry or Page UUID.");
  return {
    name:roadName,presetId,
    appearance:result.draftRoadOverride===true||result.draftRoadOverride==="true"
      ? roadAppearanceFromForm(result) : null,
    playerVisible:result.draftRoadVisible===true||result.draftRoadVisible==="true",
    journalUuid
  };
}

function actions() {
  const DialogV2 = foundry.applications.api.DialogV2;
  return {
    territoryBatchState:scene=>{
      const batch=territoryBatchFor(scene);
      if(!batch)return null;
      return {count:batch.drafts.size,total:batch.targetIds.length,
        targets:batch.targetIds.map(id=>({id,
          name:scene.regions?.get?.(id)?.name??"Unknown Region",
          staged:batch.drafts.has(id)}))};
    },
    async startTerritoryBatch(scene,refresh){
      ensureIdle(scene);
      if(readPendingTerritoryCellTransfer(scene))
        throw Error("Resolve the interrupted native transfer before starting a batch.");
      if(territoryBatchFor(scene))
        throw Error("Discard the current Territory batch before selecting new destinations.");
      if(navigation.travelSession||territoryCanvas.session||manualFog.paletteOpen||manualFog.brush)
        throw Error("Finish the Journey and other canvas editors before starting a batch.");
      if(!game.user?.isGM||!scene.canUserModify?.(game.user,"update")||
          !globalThis.canvas?.ready||globalThis.canvas.scene?.id!==scene.id)
        throw Error("Open this Scene as an authorized GM to select batch destinations.");
      const eligible=listSceneGeography(scene).filter(entry=>{
        const region=scene.regions.get(entry.id),shapes=Array.from(region?.shapes??[]);
        return entry.linked&&!entry.invalid&&territoryTier(entry)!=="unclassified"&&
          region?.canUserModify?.(game.user,"update")&&shapes.length===1&&
          shapes[0]?.type==="grid"&&
          region.getFlag?.(MODULE_ID,"generatedRegion")==null;
      }).sort((a,b)=>a.name.localeCompare(b.name));
      if(eligible.length<2)
        throw Error("This Scene needs at least two editable native Hex/Grid Territories.");
      const content=document.createElement("div");
      for(const line of [
        "Choose two to four destination Territories BEFORE painting. You can add " +
          "unclaimed cells, erase cells, or take cells from an unselected peer Territory.",
        "Atlas opens the first destination. Choosing another destination from the " +
          "Paint selector saves the current draft locally and switches instantly. " +
          "Stage advances if another destination is unfinished, or opens one final " +
          "review and approval when all selected destinations are staged.",
        "If only one Region needs editing (for example, Millstone receives a " +
          "cell from Dirwest), use its ordinary Paint Territory → Preview & Save instead.",
        "All batch destinations must belong to the same geographic tier. " +
        "Direct exchanges between selected destinations are not yet supported."
      ]){const p=document.createElement("p");p.textContent=line;content.appendChild(p);}
      const options=[];
      const choices=document.createElement("div");
      choices.style.cssText="max-height:50vh;overflow-y:auto;padding:.25rem;";
      for(const [index,entry] of eligible.entries()){
        const row=document.createElement("label");
        row.style.cssText="display:flex;align-items:center;gap:.5rem;margin:.35rem 0";
        const box=document.createElement("input");box.type="checkbox";
        box.name=`batchTarget${index}`;box.value="yes";
        box.setAttribute("aria-label",`Include ${entry.name} as a batch destination`);
        row.append(box,document.createTextNode?.(`${entry.name} (${territoryTier(entry)})`)??
          Object.assign(document.createElement("span"),
            {textContent:`${entry.name} (${territoryTier(entry)})`}));
        choices.appendChild(row);options.push({id:entry.id,tier:territoryTier(entry),
          name:box.name});
      }
      content.appendChild(choices);
      const result=await DialogV2.input({window:{title:"Select Hex/Grid Batch Destinations"},
        content,ok:{label:"Start Painting Selected Territories"},rejectClose:false,modal:true});
      if(!result)return;
      const chosen=options.filter(option=>result[option.name]===true||
        result[option.name]==="yes"||result[option.name]==="on");
      if(chosen.length<2||chosen.length>4)
        throw Error("Select between two and four receiving Territories to start the batch.");
      if(new Set(chosen.map(option=>option.tier)).size!==1)
        throw Error("Batch destinations must be on the same geographic tier.");
      const targetIds=chosen.map(option=>option.id);
      territoryBatchSelections.set(scene.id,{targetIds,drafts:new Map()});
      refresh();
      await this.editTerritoryBoundary(scene,targetIds[0],refresh);
    },
    discardTerritoryBatch(scene,refresh){
      if(territoryCanvas.session)throw Error("Close Paint Territory before discarding the batch.");
      territoryBatchSelections.delete(scene.id);refresh();
      ui.notifications.info("Staged Hex/Grid batch discarded; native Regions unchanged.");
    },
    async commitTerritoryBatch(scene,refresh){
      ensureIdle(scene);
      if(navigation.travelSession||territoryCanvas.session||manualFog.paletteOpen||manualFog.brush)
        throw Error("Finish the Journey and canvas editors before transferring a batch.");
      const batch=territoryBatchFor(scene);
      if(!batch||batch.targetIds.some(id=>!batch.drafts.has(id)))
        throw Error("Stage each selected destination before reviewing the batch.");
      const queued=batch.drafts;
      const plan=planMultiDestinationTerritoryCellTransfer(scene,
        batch.targetIds.map(regionId=>({regionId,draft:queued.get(regionId)})));
      const dialog=document.createElement("div");
      for(const line of [
        `Apply one guarded Hex/Grid batch to ${plan.destinations.length} destinations? `+
          `${plan.movedCells} peer-owned cells transferred; `+
          `${plan.unclaimedAddedCells} unclaimed cells added; `+
          `${plan.removedCells} cells erased.`,
        "Source owners: "+(plan.sources.length?plan.sources.map(s=>
          `${s.name}: −${s.movedCells}, ${s.remainingCells} retained`).join("; "):
          "None; no other Region needs to surrender cells."),
        "Destinations: "+plan.destinations.map(d=>`${d.name}: +${d.addedCells}, `+
          `−${d.removedCells}, ${d.finalCells} final cells`).join("; "),
        "Atlas will persist one recovery ledger before touching any native Region, " +
          (plan.sources.length?"trim source ownership first, ":
            "leave other Regions' ownership unchanged, ")+
          "verify all native geometry after writing, " +
          "and require explicit Resume/Roll Back if interrupted.",
        "Region IDs, Behaviors, colors, Levels, Journey/World time and other " +
          "native state remain unchanged. Destination-to-destination swaps are not supported.",
        ...(plan.convertedBackupAffected?["A previous polygon-conversion Restore may " +
          "be invalid after this transfer. Completed transfers have no one-click Undo."]:[])
      ]){const p=document.createElement("p");p.textContent=line;dialog.appendChild(p);}
      const accepted=await DialogV2.confirm({window:{title:"Apply Hex/Grid Batch?"},
        content:dialog,yes:{label:"Apply Native Batch Edits"},rejectClose:false,modal:true});
      if(!accepted)return false;
      const panel=document.createElement("section");
      panel.className="atlas-territory-transfer-progress";
      panel.style.cssText="position:fixed;top:90px;left:24px;z-index:10001;"+
        "width:360px;max-width:calc(100vw - 48px);padding:1rem;"+
        "background:#111019;color:#f4e8d7;border:1px solid #caad83;border-radius:8px";
      panel.setAttribute("role","status");panel.setAttribute("aria-live","polite");
      const label=document.createElement("p");label.textContent="Preparing guarded batch…";
      const bar=document.createElement("progress");bar.max=plan.records.length+3;
      bar.value=0;bar.style.cssText="display:block;width:100%;height:1.2rem";
      panel.append(label,bar);document.body.appendChild(panel);
      try{
        if(globalThis.requestAnimationFrame)
          await new Promise(resolve=>requestAnimationFrame(resolve));
        await commitMultiDestinationTerritoryCellTransfer(scene,plan,{onProgress:progress=>{
          bar.max=progress.total;bar.value=progress.step;label.textContent=progress.message;
        }});
        territoryBatchSelections.delete(scene.id);
        refresh();ui.notifications.info(`Batch saved across ${plan.destinations.length} `+
          `Hex/Grid Territories (${plan.movedCells} transferred, `+
          `${plan.unclaimedAddedCells} unclaimed added, ${plan.removedCells} erased).`);
        return true;
      }finally{panel.remove();}
    },
    async begin(scene, refresh) {
      ensureIdle(scene);
      const settings=await promptNewRoadSettings(scene);
      if (!settings) return;
      beginRoadDock(scene, refresh, onChange => roadCanvas.start(scene, onChange, settings));
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.StartNotice"));
    },
    draft: scene => roadCanvas.getDraft(scene),
    async generateRegion(scene, settings, refresh) {
      const result=await previewAndSaveRegion(scene, settings);
      refresh();
      return result;
    },
    async assignRoadTravelPreset(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      if (!atlas.roads?.some(r => r.id === road.id)) {
        throw new Error("This named road no longer exists.");
      }
      const presetId = await promptTravelPreset("Default travel preset — " + road.name,
        atlas.roads.find(r => r.id === road.id).travelPresetId ?? null);
      if (presetId === undefined) return;
      await saveRoadTravelPreset(scene, {
        roadId: road.id, presetId, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas named-road default travel preset saved.");
      return presetId;
    },
    async editJournal(scene,kind,id,refresh) {
      ensureIdle(scene);
      const links=readAtlasJournalLinks(scene);
      const content=document.createElement("div");
      content.appendChild(journalLinkFields(links,kind,id));
      const dropField=event=>event.target?.closest?.('input[name="atlasJournalUuid"]');
      const onDrag=event=>{if(dropField(event))event.preventDefault();};
      const onDrop=event=>{
        const field=dropField(event);
        if(!field)return;
        event.preventDefault();
        try {
          const data=JSON.parse(event.dataTransfer?.getData("text/plain")??"");
          if (!["JournalEntry","JournalEntryPage"].includes(data.type) ||
              !validJournalUuid(data.uuid))throw Error("Drop a Journal or Page.");
          field.value=data.uuid;
          field.dispatchEvent(new Event("input",{bubbles:true}));
        } catch(error){ui.notifications.warn(error.message||String(error));}
      };
      document.addEventListener("dragover",onDrag,true);
      document.addEventListener("drop",onDrop,true);
      let result;
      try {
        result=await DialogV2.input({
          window:{title:"Link journal"},content,
          ok:{label:"Save link"},rejectClose:false,modal:false
        });
      } finally {
        document.removeEventListener("dragover",onDrag,true);
        document.removeEventListener("drop",onDrop,true);
      }
      if(!result)return;
      const uuid=journalUuidFromForm(result.atlasJournalUuid);
      if(uuid&&!validJournalUuid(uuid))throw Error("Use a Journal or Page UUID.");
      await saveAtlasJournalLink(scene,{kind,id,uuid:uuid||null,expected:links});
      roadCanvas.refresh();
      refresh();
    },
    async editRoadAppearance(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const actual = atlas.roads?.find(item => item.id === road.id);
      if (!actual) throw new Error("The named road no longer exists.");
      const content = document.createElement("div");
      // Foundry v14 DialogV2.input requires the content element itself
      // to have NO attributes. Style a child wrapper only.
      const mode = roadAppearanceMode(actual, readWorldTravelPresets().presets);
      const name = document.createElement("input");
      name.type = "text"; name.name = "atlasRoadName"; name.maxLength = 120;
      name.required = true; name.value = actual.name; name.defaultValue = actual.name;
      const nameRow=createSettingsFieldRow("Road name",name);
      const visibility = document.createElement("input");
      visibility.type = "checkbox"; visibility.name = "atlasRoadVisible";
      visibility.value = "true"; visibility.checked = actual.playerVisible === true;
      visibility.defaultChecked = visibility.checked;
      const visibilityRow=createSettingsFieldRow("Show to players",visibility);
      visibilityRow.firstElementChild.title="Only this road. Checkpoint discovery is separate.";
      const baseline = resolveRoadAppearance(actual, readWorldRoadAppearance(), mode);
      const journalLinks = readAtlasJournalLinks(scene);
      const journalControls = journalLinkFields(journalLinks,"road",road.id);
      const tabs=document.createElement("nav");
      tabs.style.cssText="display:flex;gap:.4rem;padding-bottom:.65rem;border-bottom:1px solid var(--color-border-light-tertiary,#655);margin-bottom:.8rem;";
      const panels={general:document.createElement("div"),
        style:document.createElement("div"),
        checkpoints:document.createElement("div"),regions:document.createElement("div")};
      for (const [key,text] of [["general","General"],["style","Style"],["checkpoints","Checkpoints"],["regions","Terrain Regions"]]) {
        const tab=document.createElement("button");
        tab.type="button";tab.textContent=text;tab.dataset.atlasRoadTab=key;
        tab.style.flex="1";
        tab.style.cssText="flex:1;border:1px solid var(--color-border-light-tertiary,#655);background:"+
          (key==="general"?"rgba(156,123,240,.22)":"transparent")+";font-weight:"+
          (key==="general"?"700":"400")+";";
        tab.setAttribute("aria-selected",String(key==="general"));
        tabs.appendChild(tab);
        panels[key].dataset.atlasRoadPanel=key;
        panels[key].hidden=key!=="general";
      }
      const presetSelect=createTravelPresetSelect({selectedId:actual.travelPresetId,
        name:"atlasRoadPresetId",noneLabel:"None (Land fallback)"});
      const presetRow=createSettingsFieldRow("Travel preset",presetSelect);
      const roadTools=document.createElement("div");
      roadTools.dataset.atlasRoadActions="";
      roadTools.style.cssText="position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:.4rem;align-items:center;padding:.5rem 0;background:#100f17;z-index:2;";
      for (const [title,kind,icon] of [["Edit road","edit","pen-to-square"],
        ["Add connection","connection","link"],
        ["Delete road","delete","trash"]]) {
        const btn=createSettingsIconButton({icon,label:title,danger:kind==="delete"});
        btn.dataset.atlasRoadTool=kind;
        roadTools.appendChild(btn);
      }
      panels.general.append(nameRow,visibilityRow,presetRow,journalControls);
      panels.style.appendChild(roadAppearanceForm(baseline));
      const addCheckpoint=document.createElement("button");addCheckpoint.type="button";
      addCheckpoint.textContent="+ Add checkpoint";addCheckpoint.dataset.atlasRoadTool="newCheckpoint";
      panels.checkpoints.appendChild(addCheckpoint);
      const checkpointList=document.createElement("div");
      checkpointList.dataset.atlasRoadCheckpointList="";
      checkpointList.setAttribute("aria-live","polite");
      panels.checkpoints.appendChild(checkpointList);
      const addRegion=document.createElement("button");addRegion.type="button";
      addRegion.textContent="+ Generate Region";addRegion.dataset.atlasRoadTool="generateRegion";
      panels.regions.appendChild(addRegion);
      const priorityHelp=document.createElement("p");
      priorityHelp.textContent="Drag Regions to set Atlas route priority: top wins where Regions overlap. This controls Atlas estimates and the Corridor View color, not Foundry's native Region Behaviors. The settings icon edits a Region; regenerate previews new geometry but preserves its Behaviors.";
      priorityHelp.style.cssText="font-size:.82em;opacity:.75;line-height:1.4;margin:.5rem 0;";
      panels.regions.appendChild(priorityHelp);
      const regionList=document.createElement("div");
      regionList.dataset.atlasRoadRegionList="";
      regionList.setAttribute("aria-live","polite");
      panels.regions.appendChild(regionList);
      const roadDialogToken=foundry.utils.randomID();
      // Track the user's actual dropdown change before DialogV2 serializes or
      // removes its content. FormData alone has proven unreliable for this field.
      const stagedRoadPreset=createRoadPresetStage(actual.travelPresetId,roadDialogToken);
      // Rebuild only the two lists. Tabs, unsaved form fields and scroll
      // positions remain untouched during live Scene/Region updates.
      const populateRelatedLists = (checkpointTarget, regionTarget) => {
        const currentAtlas=readAtlas(scene);
        const checkpoints=currentAtlas.checkpoints?.filter(item=>item.roadId===road.id)??[];
        const checkpointHeader=document.createElement("p");
        checkpointHeader.textContent="Checkpoints ("+checkpoints.length+")";
        checkpointHeader.style.cssText="opacity:.8;margin:.6rem 0;";
        checkpointTarget.replaceChildren(checkpointHeader);
        for (const checkpoint of checkpoints) {
          const row=document.createElement("div");
          row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin:.3rem 0;";
          const name=document.createElement("span");name.textContent=checkpoint.name;
          name.style.cssText="flex:1 1 auto;min-width:0;overflow-wrap:anywhere;";
          const controls=document.createElement("div");
          controls.style.cssText="display:flex;gap:.3rem;flex:0 0 auto;";
          const btn=createSettingsIconButton({icon:"gear",label:"Checkpoint settings"});
          btn.dataset.atlasCheckpointEdit=checkpoint.id;
          const remove=createSettingsIconButton({icon:"trash",label:"Delete checkpoint",danger:true});
          remove.dataset.atlasCheckpointDelete=checkpoint.id;
          controls.append(btn,remove);row.append(name,controls);checkpointTarget.appendChild(row);
        }
        const regions=new Map();
        for (const entry of listSceneOrderedGeneratedRegions(scene)) {
          if (entry.metadata?.roadId===road.id) regions.set(entry.id,entry.name);
        }
        for (const entry of scene.regions?.contents??[]) {
          if (entry.getFlag?.(MODULE_ID,"roadId")===road.id ||
              entry.name?.startsWith?.(road.name+" —"))
            if (!regions.has(entry.id)) regions.set(entry.id,entry.name);
        }
        const regionHeader=document.createElement("p");
        regionHeader.textContent="Terrain Regions ("+regions.size+")";
        regionHeader.style.cssText="opacity:.8;margin:.6rem 0;";
        regionTarget.replaceChildren(regionHeader);
        for (const [id,regionName] of regions) {
          const row=document.createElement("div");
          row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin:.3rem 0;min-width:0;";
          const label=document.createElement("span");label.textContent=regionName;
          label.style.cssText="flex:1 1 0;min-width:0;overflow-wrap:anywhere;";
          const btn=createSettingsIconButton({icon:"gear",label:"Region settings"});
          btn.dataset.atlasRegionEdit=id;
          const managed=listGeneratedRegions(scene).find(entry=>entry.id===id);
          const buttons=document.createElement("div");
          buttons.style.cssText="display:flex;flex:0 0 auto;flex-wrap:nowrap;gap:.3rem;align-items:center;";
          buttons.appendChild(btn);
          if(managed?.metadata){
            const regenerate=createSettingsIconButton({icon:"rotate",label:"Regenerate Region"});
            regenerate.dataset.atlasRegionRegenerate=id;
            regenerate.disabled=!!managed.modified;
            regenerate.title=managed.modified?
              "Native Region geometry was edited; regeneration is blocked.":
              "Preview then confirm regeneration; preserves existing Region Behaviors and appearance.";
            buttons.appendChild(regenerate);
            const remove=createSettingsIconButton({icon:"trash",label:"Delete Region",danger:true});
            remove.dataset.atlasRegionDelete=id;
            remove.title="Delete this native Region after confirmation";
            buttons.appendChild(remove);
            const handle=document.createElement("span");
            handle.textContent="☰";handle.title="Drag to reorder routing priority (top wins)";
            handle.style.cssText="cursor:grab;padding:.3rem;user-select:none;";
            row.draggable=true;row.dataset.atlasRegionSortable=id;
            row.append(handle,label,buttons);
          }else row.append(label,buttons);
          regionTarget.appendChild(row);
        }
      };
      populateRelatedLists(checkpointList,regionList);
      const scrollBody=document.createElement("div");
      scrollBody.style.cssText="max-height:"+Math.max(220,Math.min(610,window.innerHeight-235))+"px;overflow-y:auto;min-width:0;min-height:0;padding-right:.5rem;overscroll-behavior:contain;";
      scrollBody.append(tabs,panels.general,panels.style,panels.checkpoints,panels.regions);
      scrollBody.dataset.atlasRoadLive=roadDialogToken;
      content.append(scrollBody,roadTools);
      // DialogV2.input may clone its HTMLElement content when rendered. Its
      // cloned input loses the listener registered by journalLinkFields, unlike
      // the modeless checkpoint editor. Delegate on the live document instead.
      const roadJournalTarget = event => {
        const field = event.target?.closest?.('input[name="atlasJournalUuid"]');
        return field?.closest?.(".application")
          ?.querySelector?.('input[name="atlasRoadName"]') ? field : null;
      };
      const onJournalDragOver = event => {
        if (roadJournalTarget(event)) event.preventDefault();
      };
      const onJournalDrop = event => {
        const field = roadJournalTarget(event);
        if (!field) return;
        event.preventDefault();
        try {
          const data = JSON.parse(event.dataTransfer?.getData("text/plain") ?? "");
          if (!["JournalEntry","JournalEntryPage"].includes(data.type) ||
              typeof data.uuid !== "string" || !validJournalUuid(data.uuid))
            throw Error("Drop a Foundry Journal Entry or Journal Page.");
          field.value = data.uuid;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
        } catch(error) {
          ui.notifications.warn(error.message || "Journal drop could not be read.");
        }
      };
      let roadDialog=null;
      let roadSaveButton=null;
      let roadDirty=()=>false;
      let roadMayClose=false;
      let roadClosePending=false;
      let afterRoadSave=null;
      let roadSaveRequested=false;
      const renderRoadDialog=(_event,dialog)=>{
        roadDialog=dialog;
        const liveRoadForm=dialog.element?.querySelector?.('[data-atlas-road-live="'+roadDialogToken+'"]');
        const nativeSave=arrangeRoadDialogFooter(dialog);
        if(nativeSave){
          roadSaveButton=nativeSave;
          nativeSave.title="Save road";
          nativeSave.setAttribute("aria-label","Save road");
          nativeSave.style.cssText="width:2.5rem;min-width:2.5rem;height:2.5rem;flex:0 0 2.5rem;";
          nativeSave.addEventListener("click",()=>{
            if(dialog.form?.checkValidity?.()===false)return;
            roadSaveRequested=true;
            roadMayClose=true;
          });
        }
        // DialogV2's form getter can be incomplete during its render callback.
        // Track the actual live inputs inside Atlas's own content wrapper.
        roadDirty=trackSettingsChanges(liveRoadForm??dialog.form??dialog.element);
        if(dialog._atlasCloseGuard)return;
        dialog._atlasCloseGuard=true;
        const baseClose=dialog.close.bind(dialog);
        dialog.close=async options=>{
          if(roadMayClose)return baseClose(options);
          if(roadClosePending)return dialog;
          roadClosePending=true;
          try{
            const approved=await approveSettingsClose({isDirty:roadDirty,title:"Road Settings",
              save:async()=>{
                if(!roadSaveButton)return false;
                if(dialog.form?.checkValidity?.()===false){
                  dialog.form.reportValidity?.();return false;
                }
                roadMayClose=true;
                roadSaveButton.click();
                return true;
              }});
            if(!approved||roadMayClose)return dialog;
            roadMayClose=true;
            return baseClose(options);
          }finally{roadClosePending=false;}
        };
        // Catch the header X before Foundry handles its window action. This
        // also covers v14 dialog paths which bypass a patched close method.
        interceptDialogHeaderClose(dialog,()=>!roadMayClose&&roadDirty());
      };
      const onTabClick = event => {
        const action=event.target?.closest?.("[data-atlas-road-tool],[data-atlas-checkpoint-edit],[data-atlas-checkpoint-delete],[data-atlas-region-edit],[data-atlas-region-regenerate],[data-atlas-region-delete]");
        if (action?.closest?.(".application")?.querySelector?.('input[name="atlasRoadName"]')) {
          event.preventDefault();event.stopImmediatePropagation();
          const tool=action.dataset.atlasRoadTool;
          const api=actions();
          const call=tool==="edit" ? ()=>api.beginPointEdit(scene,road.id,refresh)
            :tool==="connection" ? ()=>api.beginJunction(scene,refresh)
            :tool==="newCheckpoint" ? ()=>api.beginCheckpoint(scene,refresh)
            :tool==="delete" ? ()=>api.remove(scene,road,refresh)
            :tool==="generateRegion" ? ()=>openAtlasRegionGenerator(scene,road.id,api,refresh)
            :action.dataset.atlasRegionDelete ? ()=>api.deleteGeneratedRegion(
              scene,action.dataset.atlasRegionDelete,refresh)
            :action.dataset.atlasCheckpointDelete ? ()=>api.deleteCheckpointWithDependents(
              scene,action.dataset.atlasCheckpointDelete,refresh)
            :action.dataset.atlasRegionRegenerate ? ()=>{
              const entry=listGeneratedRegions(scene).find(item=>item.id===action.dataset.atlasRegionRegenerate);
              if(!entry)throw Error("This Atlas Region is no longer available.");
              return api.regenerateRegion(scene,entry,refresh);
            }
            :action.dataset.atlasCheckpointEdit ? ()=>api.editCheckpointAppearance(
              scene,readAtlas(scene).checkpoints.find(c=>c.id===action.dataset.atlasCheckpointEdit),refresh)
            :()=>api.configureRegion(scene,action.dataset.atlasRegionEdit);
          void Promise.resolve().then(async()=>{
            if(["edit","connection","delete"].includes(tool)&&roadDirty()){
              const choice=await confirmUnsavedSettings("Road Settings");
              if(choice==="continue")return;
              if(choice==="save"){
                if(!roadSaveButton)return;
                afterRoadSave=call;
                roadSaveButton.click();
                return;
              }
            }
            const result=await call();
            if((tool==="delete" && result===true) ||
                (["edit","connection"].includes(tool) && result!==false)){
              roadMayClose=true;
              await roadDialog?.close();
            }
          }).catch(error=>ui.notifications.error(error.message));
          return;
        }
        const tab=event.target?.closest?.("[data-atlas-road-tab]");
        if (!tab) return;
        const form=tab.closest?.(".application");
        if (!form?.querySelector?.('input[name="atlasRoadName"]')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        for (const panel of form.querySelectorAll("[data-atlas-road-panel]"))
          panel.hidden=panel.dataset.atlasRoadPanel!==tab.dataset.atlasRoadTab;
        for (const item of form.querySelectorAll("[data-atlas-road-tab]")) {
          const selected=item===tab;
          item.disabled=false;
          item.setAttribute("aria-selected",String(selected));
          item.style.background=selected?"rgba(156,123,240,.22)":"transparent";
          item.style.fontWeight=selected?"700":"400";
        }
      };
      // RegionDocuments and checkpoint flags can change while this DialogV2
      // is open (the native create UI is a separate window).
      const syncRelatedLists=changedScene=>{
        if (changedScene?.id!==scene.id) return;
        const live=document.querySelector('[data-atlas-road-live="'+roadDialogToken+'"]');
        if (!live) return;
        const checkpoints=live.querySelector("[data-atlas-road-checkpoint-list]");
        const regions=live.querySelector("[data-atlas-road-region-list]");
        if (checkpoints && regions) populateRelatedLists(checkpoints,regions);
      };
      const onRegionChanged=region=>syncRelatedLists(region?.parent);
      const updateHook=Hooks.on("updateScene",syncRelatedLists);
      const createHook=Hooks.on("createRegion",onRegionChanged);
      const regionUpdateHook=Hooks.on("updateRegion",onRegionChanged);
      const deleteHook=Hooks.on("deleteRegion",onRegionChanged);
      document.addEventListener("click",onTabClick,true);
      document.addEventListener("change",stagedRoadPreset.handle,true);
      document.addEventListener("input",stagedRoadPreset.handle,true);
      const onRangeInput = event => {
        if (event.target?.name === "atlasRoadBorderEnabled") {
          const form=event.target.closest?.(".application");
          const row=form?.querySelector?.("[data-atlas-road-border-color]");
          if (row) row.style.display=event.target.checked?"flex":"none";
        }
        const name=event.target?.name;
        if (!["atlasRoadWidth","atlasRoadOpacity"].includes(name)) return;
        const form=event.target.closest?.(".application");
        if (!form?.querySelector?.('input[name="atlasRoadName"]')) return;
        const output=form.querySelector?.('[data-atlas-range-value="' + name + '"]');
        if (output) output.textContent=name==="atlasRoadWidth" ?
          event.target.value+" px" : Math.round(Number(event.target.value)*100)+"%";
      };
      document.addEventListener("input",onRangeInput,true);
      document.addEventListener("dragover", onJournalDragOver, true);
      document.addEventListener("drop", onJournalDrop, true);
      let movingRegionId=null;
      const sortableRegion=event=>{
        const row=event.target?.closest?.("[data-atlas-region-sortable]");
        return row?.closest?.('[data-atlas-road-live="'+roadDialogToken+'"]') ? row : null;
      };
      const onRegionDragStart=event=>{
        const row=sortableRegion(event);
        if(!row)return;
        movingRegionId=row.dataset.atlasRegionSortable;
        event.dataTransfer?.setData("text/plain",movingRegionId);
        if(event.dataTransfer)event.dataTransfer.effectAllowed="move";
      };
      const onRegionDragOver=event=>{
        if(!movingRegionId || !sortableRegion(event))return;
        event.preventDefault();
        if(event.dataTransfer)event.dataTransfer.dropEffect="move";
      };
      const onRegionDrop=event=>{
        const row=sortableRegion(event);
        if(!row || !movingRegionId)return;
        event.preventDefault();event.stopImmediatePropagation();
        const source=movingRegionId;movingRegionId=null;
        void moveSceneGeneratedRegion(scene,source,row.dataset.atlasRegionSortable)
          .then(()=>populateRelatedLists(checkpointList,regionList))
          .catch(error=>ui.notifications.error(error.message));
      };
      document.addEventListener("dragstart",onRegionDragStart,true);
      document.addEventListener("dragover",onRegionDragOver,true);
      document.addEventListener("drop",onRegionDrop,true);
      let result;
      try {
        result = await DialogV2.input({
          window: { title: atlasSettingsTitle("Road",actual.name), resizable: true,
            minimizable: true },
          position: { left: 24, width: Math.min(560, Math.max(360, window.innerWidth - 60)), height: Math.min(740, Math.max(440, window.innerHeight - 70)) },
          content, ok: {label:"",icon:"fa-solid fa-floppy-disk",tooltip:"Save road"},
          render:renderRoadDialog,
          rejectClose: false, modal: false
        });
      } finally {
        Hooks.off("updateScene",updateHook);
        Hooks.off("createRegion",createHook);
        Hooks.off("updateRegion",regionUpdateHook);
        Hooks.off("deleteRegion",deleteHook);
        document.removeEventListener("click",onTabClick,true);
        document.removeEventListener("change",stagedRoadPreset.handle,true);
        document.removeEventListener("input",stagedRoadPreset.handle,true);
        document.removeEventListener("input",onRangeInput,true);
        document.removeEventListener("dragover", onJournalDragOver, true);
        document.removeEventListener("drop", onJournalDrop, true);
        document.removeEventListener("dragstart",onRegionDragStart,true);
        document.removeEventListener("dragover",onRegionDragOver,true);
        document.removeEventListener("drop",onRegionDrop,true);
      }
      if (!result) {
        if(roadSaveRequested)
          ui.notifications.error("Road Settings did not submit. No road changes were saved.");
        return;
      }
      if (!Object.hasOwn(result,"atlasJournalUuid"))
        throw Error("Foundry did not return the Journal UUID field. No Road Settings were saved.");
      const selectedPresetId=stagedRoadPreset.value;
      if(selectedPresetId&&!readWorldTravelPresets().presets.some(p=>p.id===selectedPresetId))
        throw Error("This travel preset no longer exists. Reopen Road Settings.");
      const nextJournal=journalUuidFromForm(result.atlasJournalUuid);
      if(nextJournal&&!validJournalUuid(nextJournal))
        throw Error("Choose a valid Journal Entry or Journal Page UUID.");
      const selected = roadAppearanceFromForm(result);
      const inherits = actual.appearance == null &&
        Object.keys(selected).every(key => selected[key] === baseline[key]);
      const currentAtlas=readAtlas(scene);
      const currentRoad=currentAtlas.roads?.find(item=>item.id===road.id);
      if (!currentRoad) throw Error("This road was removed while its settings were open.");
      // Check the road's own presentation for conflicting edits, but allow
      // unrelated checkpoint additions to advance the Scene revision.
      if (currentRoad.name!==actual.name ||
          currentRoad.playerVisible!==actual.playerVisible ||
          (currentRoad.travelPresetId??null)!==(actual.travelPresetId??null) ||
          JSON.stringify(currentRoad.appearance??null)!==JSON.stringify(actual.appearance??null))
        throw Error("This road's settings changed elsewhere. Reopen the editor before saving.");
      const saved=await saveRoadSettings(scene, {
        roadId: road.id, name: String(result.atlasRoadName ?? ""),
        playerVisible: result.atlasRoadVisible === true ||
          result.atlasRoadVisible === "true" || result.atlasRoadVisible === "on",
        appearance: inherits ? null : selected, presetId:selectedPresetId,
        expectedRevision: currentAtlas.revision
      });
      if(saved.roads.find(item=>item.id===road.id)?.travelPresetId!==selectedPresetId ||
          readAtlas(scene).roads.find(item=>item.id===road.id)?.travelPresetId!==selectedPresetId)
        throw Error("Road travel preset did not persist. Reopen Road Settings before continuing.");
      if(actual.playerVisible!==true&&saved.roads.find(item=>item.id===road.id)?.playerVisible===true){
        // Only the persisted GM visibility reveal is a road discovery event.
        // Do not treat ordinary road edits or a preexisting shown road as new.
        atlasAnnouncementRuntime.publishDiscovery({scene,kind:"road",recordId:road.id,
          previous:currentAtlas,committed:saved});
      }
      const currentLinks=readAtlasJournalLinks(scene);
      if(nextJournal!==journalUuidFor(currentLinks,"road",road.id)) {
        if (journalUuidFor(currentLinks,"road",road.id)!==
            journalUuidFor(journalLinks,"road",road.id))
          throw Error("This road's Journal link changed elsewhere. Reopen Road Settings.");
        await saveAtlasJournalLink(scene,{
          kind:"road",id:road.id,uuid:nextJournal,expected:currentLinks
        });
      }
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas road settings saved.");
      if(afterRoadSave)await afterRoadSave();
    },
    async resetRoadAppearance(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      if (!atlas.roads?.some(item => item.id === road.id && item.appearance)) {
        throw new Error("This road has no custom appearance to reset.");
      }
      const approved = await DialogV2.confirm({
        window: { title: "Reset Road Appearance" },
        content: "Use the current World appearance defaults for " + road.name + "?",
        yes: { label: "Reset to Defaults" }, rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveRoadAppearance(scene, {
        roadId: road.id, appearance: null, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas road now uses World appearance defaults.");
    },
    async assignGeneratedRegionTravelPreset(scene, entry, refresh) {
      ensureIdle(scene);
      const presetId = await promptTravelPreset("Corridor travel preset — " + entry.name,
        entry.presetId);
      if (presetId === undefined) return;
      await setGeneratedRegionTravelPreset(scene, entry.id, presetId);
      refresh();
      ui.notifications.info("Atlas generated Region travel preset saved. Native Behaviors were not changed.");
    },
    async applyGeneratedRegionColor(scene, entry, refresh) {
      ensureIdle(scene);
      if (entry.metadata?.kind !== "corridor" || !entry.presetId) {
        throw new Error("Choose a generated corridor with a surface preset.");
      }
      const preset = readPreset(entry.presetId);
      const dialog = document.createElement("div");
      const warning = document.createElement("p");
      warning.textContent = "Apply " + preset.name + "'s native Region color " +
        preset.color + " to " + entry.name + "? This changes only this Region's color. " +
        "Any manual color will be replaced; native Behaviors, geometry and Levels remain unchanged.";
      dialog.appendChild(warning);
      const approved = await DialogV2.confirm({
        window: { title: "Apply surface preset color" },
        content: dialog, yes: { label: "Apply Color" },
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await applyGeneratedRegionPresetColor(scene, entry.id, {
        expectedPresetId: preset.id, expectedColor: preset.color,
        expectedCurrentColor: entry.color
      });
      refresh();
      ui.notifications.info("Atlas corridor Region color updated. Native Behaviors were untouched.");
    },
    async applyGeneratedRegionCost(scene, entry, refresh) {
      ensureIdle(scene);
      if (entry.metadata?.kind !== "corridor" || !entry.presetId) {
        throw new Error("Choose an Atlas-generated corridor with a saved travel preset.");
      }
      const preset = readPreset(entry.presetId);
      const perMode = preset.movementCosts !== null;
      const registered = availableMovementActions();
      if (!registered.length) throw new Error("This system exposes no supported native movement actions.");
      let action = null;
      if (!perMode) {
        action=await promptNativeMovementAction({
          title:"Apply native movement cost — "+entry.name,
          message:"Legacy preset: choose one native movement action for "+
            preset.name+" ("+presetCostSummary(preset)+").",
          actions:registered,
          invalidMessage:"Choose a valid movement action before applying."
        });
        if(!action)return;
      }
      const preflight = previewNativeMovementCost(preset.id, action?.id ?? null);
      if (!preflight.ok) throw new Error(preflight.message);
      const multiplier = perMode ? null : preset.movementCostMultiplier;
      const expectedCosts = perMode ? { ...preset.movementCosts } : null;
      const confirm = document.createElement("div");
      const notice = document.createElement("p");
      notice.textContent = "Apply " + preset.name + " (" + presetCostSummary(preset) +
        (action ? "; action " + (game.i18n.localize(action.label) || action.label) : "") +
        ") as ONE native Modify Movement Cost Behavior on " + entry.name +
        "? No existing native Behavior will be changed.";
      confirm.appendChild(notice);
      const approved = await DialogV2.confirm({
        window: { title: "Confirm native movement-cost Behavior" },
        content: confirm, yes: { label: "Apply Native Behavior" },
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await applyGeneratedRegionMovementCost(scene, entry.id, {
        movementAction: action?.id ?? null, expectedPresetId: preset.id,
        expectedMultiplier: multiplier, expectedCosts
      });
      refresh();
      ui.notifications.info("Native Modify Movement Cost Behavior added. Review it in Foundry's Region editor.");
    },
    async updateGeneratedRegionCost(scene, entry, refresh) {
      ensureIdle(scene);
      if (entry.metadata?.kind !== "corridor" || !entry.presetId ||
          !entry.nativeCost?.managed || !entry.nativeCost.behaviorId) {
        throw new Error("Choose a corridor with one Atlas-authored native cost Behavior.");
      }
      const preset = readPreset(entry.presetId);
      const perMode = preset.movementCosts !== null;
      let action = null;
      if (!perMode) {
        action=await promptNativeMovementAction({
          title:"Refresh native movement cost — "+entry.name,
          message:"Legacy preset: choose one supported movement action for "+
            preset.name+" ("+presetCostSummary(preset)+").",
          actions:availableMovementActions(),
          invalidMessage:"Choose a supported native movement action."
        });
        if(!action)return;
      }
      const preflight = previewNativeMovementCost(preset.id, action?.id ?? null);
      if (!preflight.ok) throw new Error(preflight.message);
      const authored = entry.nativeCost.detail;
      const oldCosts = authored.schemaVersion === 1
        ? { [authored.action]: authored.multiplier }
        : { ...authored.movementCosts };
      const expectedCosts = perMode ? { ...preset.movementCosts } : null;
      const expectedMultiplier = perMode ? null : preset.movementCostMultiplier;
      const content = document.createElement("div");
      const notice = document.createElement("p");
      notice.textContent = "Refresh ONE existing Atlas-authored Modify Movement Cost Behavior in place on " +
        entry.name + " using " + preset.name + " (" + presetCostSummary(preset) + "). " +
        "Modes no longer selected by the preset become neutral ×1. " +
        "The Region, shapes, Levels, other Behaviors, color and travel preset assignment remain unchanged. " +
        "Atlas refuses manually edited, disabled, or duplicated native costs.";
      content.appendChild(notice);
      const approved = await DialogV2.confirm({
        window: { title: "Refresh Atlas native corridor costs" },
        content, yes: { label: "Refresh Native Costs" },
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await updateGeneratedRegionMovementCost(scene, entry.id, {
        expectedPresetId: preset.id,
        expectedBehaviorId: entry.nativeCost.behaviorId,
        expectedPreviousCosts: oldCosts,
        expectedCosts, expectedMultiplier,
        movementAction: action?.id ?? null
      });
      refresh();
      ui.notifications.info("Atlas refreshed the existing native cost Behavior in place. No Region was deleted or recreated.");
    },
    async regenerateRegion(scene, entry, refresh) {
      if (!entry.metadata || entry.modified) {
        throw new Error("Manual Region geometry must be preserved; regeneration is unavailable.");
      }
      const meta = entry.metadata;
      await previewAndSaveRegion(scene, {
        kind: meta.kind, roadId: meta.roadId,
        checkpointId: meta.checkpointIds[0],
        endCheckpointId: meta.kind === "corridor" ? meta.checkpointIds[1] : null,
        widthCells: meta.widthCells
      }, { regenerate: true });
      refresh();
    },
    async editGeneratedRegionGeometry(scene, entry, refresh) {
      ensureIdle(scene);
      if(!entry.metadata || entry.modified || entry.invalid)
        throw new Error("Manually modified or invalid native Region geometry is protected.");
      const meta=entry.metadata;
      const wrap=document.createElement("div");
      const help=document.createElement("p");
      help.textContent="Adjust the radius/half-width for “"+entry.name+"”. Atlas previews geometry while preserving native Behaviors, Levels and travel preset.";
      const label=document.createElement("label");
      label.textContent=meta.kind==="checkpoint"?"Radius (cells)":"Corridor half-width (cells)";
      const input=document.createElement("input");
      input.type="number";input.name="regionWidthCells";input.min="0.25";input.max="3";input.step="0.25";
      input.defaultValue=String(meta.widthCells);
      label.appendChild(input);wrap.append(help,label);
      const form=await DialogV2.input({window:{title:"Resize Terrain Region"},content:wrap,
        ok:{label:"Preview New Geometry"},rejectClose:false,modal:true});
      if(!form)return false;
      const widthCells=Number(form.regionWidthCells);
      if(!Number.isFinite(widthCells)||widthCells<.25||widthCells>3||
          Math.abs(widthCells*4-Math.round(widthCells*4))>1e-8)
        throw new Error("Radius must be 0.25–3 cells in quarter-cell increments.");
      const fresh=listGeneratedRegions(scene).find(item=>item.id===entry.id);
      if(!fresh || fresh.modified || fresh.invalid ||
          JSON.stringify(fresh.metadata)!==JSON.stringify(meta))
        throw new Error("Region changed. Reopen its geometry settings.");
      await previewAndSaveRegion(scene,{kind:meta.kind,roadId:meta.roadId,
        checkpointId:meta.checkpointIds[0],
        endCheckpointId:meta.kind==="corridor"?meta.checkpointIds[1]:null,
        widthCells},{regenerate:true});
      roadCanvas.refresh();refresh();return true;
    },
    beginJunction(scene, refresh) {
      roadCanvas.startJunction(scene, () => {
        refresh();
        if (roadCanvas.getDraft(scene)?.mode === "points" && !roadDock) {
          openRoadDock(scene, refresh);
        }
        if (roadDock?.scene?.id === scene.id) {
          if (!roadCanvas.getDraft(scene)) {
            roadDock.finished = true;
            void roadDock.close();
          } else if (roadDock.rendered) void roadDock.render(true);
        }
      });
      openRoadDock(scene,refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Junctions.StartNotice"));
    },
    selectJunction: (scene, nodeId) => roadCanvas.selectJunction(scene, nodeId),
    beginCheckpoint(scene, refresh) {
      ensureIdle(scene);
      // One authoring entrypoint: a hit inside the bounded Road snap radius
      // uses the existing Road-linked confirmation; every other Scene click
      // creates a standalone Node-anchored Checkpoint after GM approval.
      roadCanvas.startCheckpoint(scene, () => {
        roadCanvas.refresh();
        refresh();
      }, {
        confirmIndependent: ({name:defaultName})=>new Promise(resolve=>{
          // The same GM editor and staged settings as Road-based Checkpoints.
          const editor=new AtlasCheckpointAppearanceEditor({
            scene,checkpointId:"__new_checkpoint__",
            expectedRevision:readAtlas(scene).revision,
            createDraft:{roads:[],defaultName,independent:true},
            onCreate:resolve
          });
          Promise.resolve(editor.render(true)).catch(error=>{
            ui.notifications.error(error.message??String(error));
            resolve(null);
          });
        }),
        saveIndependent:args=>createIndependentCheckpointFromDraft(scene,args)
      });
      ui.notifications.info("Click a Road to create a linked Checkpoint, " +
        "or click away from Roads for an independent Checkpoint. Escape cancels.");
      // Let the GM see/click the map. The registered Workspace instance and
      // active tab remain intact; the toolbar restores this same window.
      void minimizeAtlasSceneWorkspace(scene).catch(error =>
        ui.notifications.error(error.message ?? String(error)));
      refresh();
    },
    // Retained as a legacy API alias. The Workspace presents one [+] control.
    beginIndependentCheckpoint(scene, refresh) {
      return this.beginCheckpoint(scene, refresh);
    },
    moveCheckpoint(scene,checkpointId,refresh){
      ensureIdle(scene);
      roadCanvas.startCheckpointRelocation(scene,checkpointId,{
        confirm:async ({name,at,from})=>{
          const content=document.createElement("div");
          for(const message of [
            `Move ${name} from (${from.x.toFixed(1)}, ${from.y.toFixed(1)}) to `+
              `(${at.x.toFixed(1)}, ${at.y.toFixed(1)})?`,
            "Only this isolated Checkpoint's saved Node will move. Its ID, Journal, " +
              "discovery, transportation and Territory associations remain unchanged. " +
              "No Road or native Region will be moved."
          ]){
            const p=document.createElement("p");p.textContent=message;
            content.appendChild(p);
          }
          return DialogV2.confirm({
            window:{title:`Relocate ${name}?`},content,
            yes:{label:"Save New Position"},no:{label:"Cancel"},
            rejectClose:false,modal:false
          });
        },
        save:args=>saveRelocatedIndependentCheckpoint(scene,args),
        onChange:()=>{roadCanvas.refresh();refresh();}
      });
      ui.notifications.info("Click the new map location for this independent Checkpoint. Escape cancels.");
      refresh();
    },
    async manageCheckpointRoad(scene, checkpointId, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const checkpoint = atlas.checkpoints?.find(cp => cp.id === checkpointId);
      if (!checkpoint) throw new Error("Checkpoint no longer exists in this Scene.");
      const incidents = atlas.segments.filter(segment =>
        segment.from === checkpoint.nodeId || segment.to === checkpoint.nodeId);
      if (incidents.length === 1 && atlas.schemaVersion >= 10) {
        const incident = incidents[0];
        const approved = await DialogV2.confirm({
          window: { title: `Disconnect ${checkpoint.name}?` },
          content: `<p>Remove Road section ${incident.id} from this terminal Checkpoint? ` +
            "The Checkpoint, its stable Node, Journal and metadata remain. " +
            "This may affect route availability.</p>",
          yes: { label: "Disconnect Road section" }, no: { label: "Cancel" }
        });
        if (!approved) return;
        await saveDisconnectedIndependentCheckpoint(scene, { checkpointId,
          segmentId: incident.id, expectedRevision: atlas.revision });
      } else if (incidents.length === 0) {
        const nodes = new Map(atlas.nodes.map(node => [node.id, node]));
        const anchor = nodes.get(checkpoint.nodeId);
        const roads = new Map(atlas.roads.map(road => [road.id, road]));
        const degree = new Map();
        for (const edge of atlas.segments) {
          degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
          degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
        }
        // This conservative first pass connects to a terminal endpoint only;
        // connecting to an interior junction is a separate reviewed graph edit.
        const choices = atlas.segments.flatMap(segment =>
          [segment.from, segment.to].filter(nodeId => degree.get(nodeId) === 1)
            .map(nodeId => ({ roadId: segment.roadId, nodeId,
              point: nodes.get(nodeId) })))
          .filter(entry => entry.point && roads.has(entry.roadId) &&
            entry.nodeId !== checkpoint.nodeId)
          .sort((a,b) => Math.hypot(a.point.x-anchor.x,a.point.y-anchor.y) -
            Math.hypot(b.point.x-anchor.x,b.point.y-anchor.y))
          .slice(0, 100);
        if (!choices.length) throw new Error("No saved Road endpoints are eligible for this connection.");
        const content = document.createElement("div");
        const description = document.createElement("p");
        description.textContent = "Choose a saved Road endpoint. Atlas will add one straight, " +
          "explicit Road section to this Checkpoint without moving either Node.";
        const select = document.createElement("select");
        select.name = "roadEndpoint";
        for (const choice of choices) {
          const option = document.createElement("option");
          option.value = `${choice.roadId}::${choice.nodeId}`;
          option.textContent = `${roads.get(choice.roadId).name} — ` +
            `${choice.nodeId} (${Math.round(Math.hypot(choice.point.x-anchor.x,
              choice.point.y-anchor.y))} px away)`;
          select.appendChild(option);
        }
        content.append(description, select);
        const result = await DialogV2.input({
          window: { title: `Connect ${checkpoint.name} to Road` }, content,
          ok: { label: "Connect Road" }, rejectClose: false
        });
        if (!result) return;
        const [roadId, roadNodeId] = String(result.roadEndpoint ?? "").split("::");
        if (!choices.some(option => option.roadId === roadId && option.nodeId === roadNodeId)) {
          throw new Error("Select an eligible Road endpoint.");
        }
        await saveConnectedIndependentCheckpoint(scene, { checkpointId, roadId, roadNodeId,
          expectedRevision: atlas.revision, idFactory: () => foundry.utils.randomID() });
      } else {
        throw new Error("This Checkpoint has multiple Road links. Use reviewed Road editing to change its topology.");
      }
      roadCanvas.refresh(); refresh();
      ui.notifications.info("Checkpoint Road connection updated.");
    },
    selectCheckpoint: async (scene, checkpointId) => {
      await centerAtlasOn(scene,null,checkpointId);
    },
    async savePartyExploration(scene, settings, refresh) {
      ensureIdle(scene);
      await savePartyExplorationConfig(scene, settings);
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas party exploration saved for this Scene.");
    },
    async saveManualFog(scene,enabled,refresh) {
      ensureIdle(scene);
      await setManualFogEnabled(scene,enabled);
      manualFog.refresh();roadCanvas.refresh();refresh();
      ui.notifications.info(enabled ? "Atlas manual fog enabled." : "Atlas manual fog disabled.");
    },
    openManualBrushPalette() { fogPalette.show(); },
    async setCheckpointKnowledge(scene, settings, refresh) {
      ensureIdle(scene);
      await saveCheckpointKnowledge(scene, settings);
      manualFog.refresh();
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(settings.knowledge === "lore"
        ? "Checkpoint marked known through lore." :
        settings.knowledge === "visited" ? "Checkpoint marked visited." :
          "Checkpoint knowledge revoked.");
    },
    async toggleCheckpointPlayerVisibility(scene, checkpoint, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const actual = atlas.checkpoints?.find(c => c.id === checkpoint.id);
      if (!actual) throw new Error("Checkpoint no longer exists.");
      await saveCheckpointPlayerVisibility(scene, {
        checkpointId: checkpoint.id, visible: actual.playerVisible !== true,
        expectedRevision: atlas.revision
      });
      roadCanvas.refresh(); refresh();
      ui.notifications.info(actual.playerVisible === true
        ? "Checkpoint hidden from players." : "Checkpoint now visible to players.");
    },
    async toggleRoadPlayerVisibility(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const actual = atlas.roads?.find(item => item.id === road.id);
      if (!actual) throw new Error("Road no longer exists.");
      const saved=await saveRoadPlayerVisibility(scene, {
        roadId: road.id, visible: actual.playerVisible !== true,
        expectedRevision: atlas.revision
      });
      if(actual.playerVisible!==true)
        atlasAnnouncementRuntime.publishDiscovery({scene,kind:"road",recordId:road.id,
          previous:atlas,committed:saved});
      roadCanvas.refresh(); refresh();
      ui.notifications.info(actual.playerVisible === true
        ? "Road hidden from players." : "Road now visible to players.");
    },
    editCheckpointAppearance(scene, checkpoint, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      if (!atlas.checkpoints?.some(c => c.id === checkpoint.id)) {
        throw new Error("Checkpoint no longer exists.");
      }
      new AtlasCheckpointAppearanceEditor({
        scene, checkpointId: checkpoint.id, expectedRevision: atlas.revision,
        onSaved: () => { roadCanvas.refresh(); refresh(); },
        onDelete:()=>actions().deleteCheckpointWithDependents(scene,checkpoint.id,refresh),
        onTerrainAction:async (action,regionId)=>{
          if(action==="clearPreview")return roadCanvas.clearRegionPreview();
          const api=actions();
          if(action==="territory")return api.configureCheckpointTerritory(scene,checkpoint.id,
            ()=>{atlasLayers.refresh();refresh();});
          const entry=regionId?listGeneratedRegions(scene).find(item=>item.id===regionId):null;
          if(regionId&&!entry)throw new Error("This linked Region no longer exists.");
          if(action==="create")return openAtlasRegionGenerator(scene,checkpoint.roadId,api,
            ()=>{roadCanvas.refresh();refresh();},checkpoint.id);
          if(action==="preset")return api.assignGeneratedRegionTravelPreset(scene,entry,
            ()=>{roadCanvas.refresh();refresh();});
          if(action==="settings")return api.configureRegion(scene,regionId);
          if(action==="geometry")try{
            return await api.editGeneratedRegionGeometry(scene,entry,
              ()=>{roadCanvas.refresh();refresh();});
          }finally{roadCanvas.clearRegionPreview();}
          if(action==="regenerate")try{
            return await api.regenerateRegion(scene,entry,
              ()=>{roadCanvas.refresh();refresh();});
          }finally{roadCanvas.clearRegionPreview();}
          if(action==="delete")return api.deleteGeneratedRegion(scene,regionId,
            ()=>{roadCanvas.refresh();refresh();});
        }
      }).render(true);
    },
    async editCheckpoint(scene, checkpoint, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const current = atlas.checkpoints?.find(c => c.id === checkpoint.id);
      if (!current) throw new Error("Checkpoint no longer exists.");
      const content = document.createElement("div");
      const nameLabel = document.createElement("label");
      nameLabel.textContent = game.i18n.localize("FVTTATLAS.Checkpoints.Name");
      const name = document.createElement("input");
      name.name = "checkpointName";
      name.type = "text";
      name.required = true;
      name.maxLength = 120;
      name.value = current.name;
      content.appendChild(nameLabel);
      content.appendChild(name);
      const elevationLabel = document.createElement("label");
      elevationLabel.textContent = game.i18n.localize("FVTTATLAS.Checkpoints.Elevation");
      const elevation = document.createElement("input");
      elevation.name = "checkpointElevation";
      elevation.type = "number";
      elevation.step = "any";
      elevation.value = current.elevationMeters === null
        ? "" : String(current.elevationMeters);
      content.appendChild(elevationLabel);
      content.appendChild(elevation);
      const result = await DialogV2.input({
        window: { title: game.i18n.localize("FVTTATLAS.Checkpoints.Edit") },
        content,
        ok: { label: game.i18n.localize("FVTTATLAS.Checkpoints.Save") },
        rejectClose: false
      });
      if (!result) return;
      const raw = String(result.checkpointElevation ?? "").trim();
      const elevationMeters = raw === "" ? null : Number(raw);
      await saveEditedCheckpoint(scene, {
        checkpointId: current.id, name: String(result.checkpointName ?? ""),
        elevationMeters, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Checkpoints.Updated"));
    },
    async removeCheckpoint(scene, checkpoint, refresh) {
      return this.deleteCheckpointWithDependents(scene,checkpoint.id,refresh);
    },
    async deleteGeneratedRegion(scene, regionId, refresh) {
      ensureIdle(scene);
      if(!game.user?.isGM || !scene.canUserModify?.(game.user,"update"))
        throw new Error("Only a GM may delete native Regions.");
      const entry=listGeneratedRegions(scene).find(item=>item.id===regionId);
      if(!entry?.metadata || entry.invalid)
        throw new Error("Only Atlas-generated Regions can be deleted here.");
      const region=scene.regions?.get(regionId);
      if(!region?.canUserModify?.(game.user,"delete"))
        throw new Error("No permission to delete this Region.");
      const approved=await DialogV2.confirm({
        window:{title:"Delete Terrain Region?"},
        content:"Delete native Region “"+entry.name+"”? Its shapes and Behaviors will be deleted. Checkpoints and roads will remain.",
        yes:{label:"Delete Region"},rejectClose:false,modal:true
      });
      if(!approved)return false;
      const fresh=listGeneratedRegions(scene).find(item=>item.id===regionId);
      if(!fresh?.metadata || fresh.name!==entry.name ||
          fresh.modified!==entry.modified)
        throw new Error("This Region changed while confirming. Reopen its deletion.");
      await scene.deleteEmbeddedDocuments("Region",[regionId]);
      roadCanvas.refresh();refresh();
      ui.notifications.info("Terrain Region deleted.");
      return true;
    },
    async deleteCheckpointWithDependents(scene, checkpointId, refresh) {
      ensureIdle(scene);
      const atlas=readAtlas(scene);
      const checkpoint=atlas.checkpoints?.find(item=>item.id===checkpointId);
      if(!checkpoint)throw new Error("Checkpoint no longer exists.");
      const related=listGeneratedRegions(scene).filter(item=>
        item.metadata?.checkpointIds?.includes(checkpointId));
      const protectedRegions=related.filter(item=>item.modified||item.invalid);
      if(protectedRegions.length)
        throw new Error("A native Region attached to this checkpoint has modified geometry. Review it before deleting the checkpoint: "+
          protectedRegions.map(item=>item.name).join(", "));
      const partners=[...new Set(related.flatMap(item=>item.metadata.checkpointIds)
        .filter(id=>id!==checkpointId))].map(id=>atlas.checkpoints?.find(item=>item.id===id))
        .filter(Boolean);
      const content=document.createElement("div");
      const section=document.createElement("div");
      section.style.cssText="display:grid;gap:.5rem;";
      const intro=document.createElement("p");
      intro.textContent="Delete checkpoint “"+checkpoint.name+"”? This does not remove its shared graph node or the road.";
      section.appendChild(intro);
      const confirm=document.createElement("label");
      const check=document.createElement("input");
      check.type="checkbox";check.name="confirmCheckpoint";
      confirm.append(check,document.createTextNode(" Confirm deletion of this checkpoint"));
      section.appendChild(confirm);
      if(related.length){
        const text=document.createElement("p");
        text.textContent="Attached generated Regions ("+related.length+"): "+
          related.map(item=>item.name).join("; ")+".";
        section.appendChild(text);
        const label=document.createElement("label");
        const input=document.createElement("input");
        input.type="checkbox";input.name="confirmRegions";
        label.append(input,document.createTextNode(" Also delete these native Regions and their Behaviors"));
        section.appendChild(label);
      }
      if(partners.length){
        const note=document.createElement("p");
        note.textContent="The corridor also references the following checkpoint(s). They will stay unless individually selected:";
        section.appendChild(note);
        for(const partner of partners){
          const label=document.createElement("label");
          const input=document.createElement("input");
          input.type="checkbox";input.name="partner_"+partner.id;
          label.append(input,document.createTextNode(" Also delete "+partner.name));
          section.appendChild(label);
        }
      }
      content.appendChild(section);
      const result=await DialogV2.input({
        window:{title:"Delete Checkpoint — "+checkpoint.name},
        content,ok:{label:"Delete Confirmed Items"},
        rejectClose:false,modal:true
      });
      if(!result)return false;
      const checked=name=>result[name]===true||result[name]==="on";
      if(!checked("confirmCheckpoint"))throw new Error("Confirm the checkpoint deletion.");
      if(related.length&&!checked("confirmRegions"))
        throw new Error("Confirm removal of dependent Regions first.");
      const chosen=[checkpointId,...partners.filter(item=>checked("partner_"+item.id)).map(item=>item.id)];
      // Do not silently remove any other corridor attached to a paired endpoint.
      const extra=listGeneratedRegions(scene).filter(item=>
        item.metadata?.checkpointIds?.some(id=>chosen.includes(id)) &&
        !related.some(old=>old.id===item.id));
      if(extra.length)throw new Error("A paired checkpoint has other Regions. Delete those separately first: "+
        extra.map(item=>item.name).join(", "));
      if(readAtlas(scene).revision!==atlas.revision ||
          related.some(item=>!listGeneratedRegions(scene).some(fresh=>
            fresh.id===item.id && fresh.name===item.name && !fresh.modified)))
        throw new Error("Checkpoints or Regions changed while confirming. Reopen Delete.");
      await saveRemovedCheckpoints(scene,{checkpointIds:chosen,expectedRevision:atlas.revision});
      if(related.length) {
        try {await scene.deleteEmbeddedDocuments("Region",related.map(item=>item.id));}
        catch(error){
          roadCanvas.refresh();refresh();
          throw new Error("Checkpoint(s) deleted, but some native Regions may remain. Review Terrain Regions. "+
            (error.message||String(error)));
        }
      }
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(chosen.length+" checkpoint(s) deleted; "+related.length+" generated Region(s) removed.");
      return true;
    },
    beginPointEdit(scene, roadId, refresh) {
      beginRoadDock(scene, refresh, onChange => roadCanvas.startPointEdit(scene, roadId, onChange));
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.EditNotice"));
    },
    undo: () => roadCanvas.undo(),
    async anchor(scene, refresh) {
      const atlas = readAtlas(scene);
      if (atlas.schemaVersion !== 1) return;
      if (!globalThis.canvas?.ready || canvas.scene?.id !== scene.id) {
        throw new Error("Open this Scene on the canvas before anchoring legacy roads.");
      }
      const origin = sceneImageOrigin(canvas);
      const approved = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Anchor") },
        content: game.i18n.localize("FVTTATLAS.Roads.AnchorWarning"),
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveAnchoredLegacyRoads(scene, { origin, expectedRevision: atlas.revision });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Anchored"));
    },
    async organize(scene, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      if (atlas.schemaVersion !== 2) return;
      const approved = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Organize") },
        content: game.i18n.localize("FVTTATLAS.Roads.OrganizeWarning"),
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveOrganizedRoads(scene, { expectedRevision: atlas.revision });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Organized"));
    },
    async merge(scene, road, refresh) {
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const options = getRoadMergeCandidates(atlas, road.id);
      if (!options.length) throw new Error("This road has no adjacent road to merge.");
      let otherId = options[0].id;
      if (options.length > 1) {
        const select=createSettingsSelect(options.map(candidate=>[candidate.id,candidate.name]),
          {name:"mergeRoadId",selectedId:otherId});
        // Foundry v14 requires an outermost plain div for DOM dialog content.
        const content = document.createElement("div");
        const instruction = document.createElement("p");
        instruction.textContent = "Choose a road to merge INTO “" + road.name + "”. The selected road name will be removed.";
        content.append(instruction,select);
        const input = await DialogV2.input({
          window: { title: "Merge into " + road.name },
          content,
          ok: { label: game.i18n.localize("FVTTATLAS.Roads.Merge") },
          rejectClose: false
        });
        if (!input) return;
        otherId = String(input.mergeRoadId ?? "");
      }
      const other = options.find(candidate => candidate.id === otherId);
      if (!other) throw new Error("Choose a connected road to merge.");
      const approved = await DialogV2.confirm({
        window: { title: "Merge roads?" },
        content: "Merge “" + other.name + "” INTO “" + road.name +
          "”? The road “" + road.name + "” keeps its name. This cannot be undone.",
        rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveMergedRoads(scene, {
        keepRoadId: road.id, mergeRoadId: otherId, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Merged"));
    },
    async linkRegion(scene, refresh) {
      const choices = listSceneRegions(scene).filter(region => !region.linked && !region.invalidLink);
      if (!choices.length) throw new Error(game.i18n.localize("FVTTATLAS.Regions.NoAvailable"));
      const content = document.createElement("div");
      const select=createSettingsSelect(choices.map(region=>[region.id,region.name]),{
        name:"atlasRegionId",ariaLabel:game.i18n.localize("FVTTATLAS.Regions.Choose")});
      content.appendChild(select);
      const result = await DialogV2.input({
        window: { title: game.i18n.localize("FVTTATLAS.Regions.Link") },
        content,
        ok: { label: game.i18n.localize("FVTTATLAS.Regions.Link") },
        rejectClose: false
      });
      if (!result) return;
      const regionId = String(result.atlasRegionId ?? "");
      if (!choices.some(region => region.id === regionId)) {
        throw new Error(game.i18n.localize("FVTTATLAS.Regions.Choose"));
      }
      await linkAtlasRegion(scene, regionId);
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Regions.Linked"));
    },
    async unlinkRegion(scene, regionId, refresh) {
      const region = scene.regions?.get(regionId);
      if (!region) throw new Error(game.i18n.localize("FVTTATLAS.Regions.Missing"));
      const content = document.createElement("div");
      const warning = document.createElement("p");
      warning.textContent = game.i18n.format("FVTTATLAS.Regions.UnlinkWarning", {
        name: region.name
      });
      content.appendChild(warning);
      const confirmed = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Regions.Unlink") },
        content,
        rejectClose: false,
        modal: true
      });
      if (!confirmed) return;
      await unlinkAtlasRegion(scene, regionId);
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Regions.Unlinked"));
    },
    async createNativeTerritory(scene,refresh) {
      ensureIdle(scene);
      if(navigation.travelSession)
        throw Error("End the active Journey before creating native territory Regions.");
      if(territoryCanvas.session||manualFog.paletteOpen||manualFog.brush)
        throw Error("Finish the Territory editor and close the Atlas Fog brush before authoring.");
      const content=document.createElement("div");
      const note=document.createElement("p");
      note.textContent="Atlas saves one native Foundry Region. Atlas control nodes and " +
        "grid cells are editable GM drafts. Blank Walls are imported without changing " +
        "or deleting them. All methods require an explicit save after boundary checks.";
      const label=document.createElement("label");
      label.textContent="Region name";
      const input=createSettingsInput("text","",{name:"name",
        ariaLabel:"Name for new native Territory"});
      input.maxLength=120;
      input.setAttribute("required","");
      label.appendChild(input);content.append(note,label);
      const nativeGridShape=Boolean(globalThis.foundry?.data?.GridShapeData)&&
        Boolean(globalThis.canvas?.grid)&&!globalThis.canvas.grid.isGridless;
      const methodLabel=document.createElement("label");
      methodLabel.textContent="Creation method";
      const methods=[["polygon","Draw Atlas Boundary Nodes"]];
      if(nativeGridShape)methods.push(["grid","Paint Native Hex/Grid Spaces (recommended)"]);
      methods.push(["walls","Import Selected Blank Walls"]);
      methodLabel.appendChild(createSettingsSelect(methods,{
        selectedId:preferredTerritoryCreationMethod({nativeGridShape,
          gridless:globalThis.canvas?.grid?.isGridless===true}),
        name:"method",ariaLabel:"Territory creation method"}));
      if(!nativeGridShape){const hint=document.createElement("p");
        hint.textContent="Native grid painting requires Foundry v14.370+ and a square/hex Scene. " +
          "Polygon and Blank Wall authoring remain supported.";
        methodLabel.appendChild(hint);}
      content.appendChild(methodLabel);
      const kindLabel=document.createElement("label");kindLabel.textContent="Territory type";
      kindLabel.appendChild(createSettingsSelect(Object.entries(GEOGRAPHY_KINDS),
        {name:"kind",ariaLabel:"Geographic classification"}));
      content.appendChild(kindLabel);
      const parents=listSceneGeography(scene).filter(e=>e.linked&&!e.invalid&&
        ["continent","area"].includes(e.geography?.kind));
      const parentLabel=document.createElement("label");
      parentLabel.textContent="Contained within (optional; inferred from overlap when possible)";
      parentLabel.appendChild(createSettingsSelect([["","No parent (standalone / infer later)"],
        ...parents.map(e=>[e.id,e.name])],
      {name:"parent",ariaLabel:"Parent Territory"}));
      content.appendChild(parentLabel);
      const result=await DialogV2.input({window:{title:"Create Atlas Territory"},
        content,ok:{label:"Edit Boundary"},rejectClose:false,modal:true});
      if(!result)return;
      if(result.kind==="continent"&&result.parent)
        throw Error("A Continent cannot have a parent.");
      const kind=result.method==="grid"?"grid":"polygon";
      if(kind==="grid"&&!globalThis.foundry?.data?.GridShapeData)
        throw Error("This Foundry v14 build lacks native GridShapeData; update to v14.370 to paint Territories.");
      const imported=result.method==="walls"?selectedBlankWallBoundary(scene):null;
      const draft={kind,name:result.name,points:imported?.nodes??[],offsets:[],
        wallIds:imported?.wallIds??[],geography:{schemaVersion:1,kind:result.kind,
          parentRegionId:result.parent||null,roadOverrides:{}}};
      const finished=await territoryCanvas.begin(scene,draft,async candidate=>{
        const created=await saveTerritoryDraft(scene,candidate);
        refresh();ui.notifications.info(`Atlas Territory ${created.name} created as a native Region.`);
      });
      if(!finished)atlasDebug("territory","Territory authoring cancelled",{
        method:kind},{level:"verbose"});
    },
    async editTerritoryBoundary(scene,regionId,refresh){
      ensureIdle(scene);
      if(navigation.travelSession||territoryCanvas.session||manualFog.paletteOpen||manualFog.brush)
        throw Error("End the Journey or other canvas editor before changing this Territory.");
      const batch=territoryBatchFor(scene);
      if(batch&&!batch.targetIds.includes(regionId))
        throw Error("This Territory is not a selected destination. Finish or discard the batch first.");
      const region=scene.regions?.get?.(regionId);
      const draft=readTerritoryDraft(scene,regionId);
      const geography=readRegionGeography(region);
      if(!geography)throw Error("Classify this Atlas-linked Territory before editing its boundary.");
      draft.name=region.name;draft.geography=geography;
      const previous=stagedTerritories(scene).get(regionId);
      if(previous){
        if(draft.sourceDigest!==previous.sourceDigest)
          throw Error("This staged Territory changed natively. Discard the batch and reopen.");
        draft.offsets=structuredClone(previous.offsets);
      }
      const nextUnstaged=batch?.targetIds.find(id=>id!==regionId&&!batch.drafts.has(id));
      await territoryCanvas.begin(scene,draft,async (candidate,reportProgress)=>{
        if(batch)throw Error("Use Stage in Paint while the selected batch is active.");
        const transfer=planTerritoryCellTransfer(scene,regionId,candidate);
        if(transfer){
          const multi=Array.isArray(transfer.sourceIds);
          const sourceSummary=multi?transfer.sources.map(source=>
            `${source.name}: ${source.movedCells} cells transferred, `+
              `${source.remainingCells} retained`).join("; "):
            `${transfer.sourceName}: ${transfer.movedCells} cells transferred, `+
              `${transfer.sourceCellCount} retained`;
          const documentCount=transfer.records.length;
          const dialog=document.createElement("div");
          for(const line of [
            `Transfer ${transfer.movedCells} native grid cells from `+
              `${multi?transfer.sources.length+" peer Territories":transfer.sourceName} `+
              `to ${transfer.targetName}?`,
            `${sourceSummary}. The target will contain ${transfer.targetCellCount} cells.`,
            `This makes ${documentCount} guarded native Region updates, removing all `+
              "source ownership before adding target cells. Native Behaviors, IDs, " +
              "colors and Levels are preserved.",
            "Atlas first persists a Scene recovery record. If either document update " +
              "fails, the Workspace will offer explicit Resume or Roll Back for ALL " +
              "affected Regions. Never edit them until recovery is complete.",
            ...(transfer.convertedBackupAffected?["An earlier polygon-conversion Restore " +
              "may be refused after this transfer. A completed transfer has no " +
              "one-click Undo: reverse cells in a new reviewed transfer or use " +
              "an external World backup before restoring that polygon."]:[])
          ]){const p=document.createElement("p");p.textContent=line;dialog.appendChild(p);}
          const accepted=await DialogV2.confirm({window:{title:"Transfer Native Territory Cells?"},
            content:dialog,yes:{label:multi?"Transfer Between Multiple Regions":
              "Transfer Between Two Regions"},
            rejectClose:false,modal:true});
          if(!accepted)return false;
          reportProgress({step:0,total:documentCount+3,
            message:"Validating and preparing native Region transfer…"});
          // Let the browser paint the initial progress state before a large
          // native geometry check or asynchronous Scene write begins.
          if(globalThis.requestAnimationFrame)
            await new Promise(resolve=>requestAnimationFrame(resolve));
          await commitTerritoryCellTransfer(scene,transfer,{onProgress:reportProgress});
          refresh();ui.notifications.info(`${transfer.movedCells} cells transferred to `+
            `${transfer.targetName} from ${multi?transfer.sources.length+" peer Territories":
              transfer.sourceName}.`);
          return;
        }
        await saveTerritoryDraft(scene,candidate,{regionId});
        refresh();ui.notifications.info("Native Territory boundary updated; Behaviors retained.");
      },{batchContext:batch?{name:region.name,index:batch.targetIds.indexOf(regionId)+1,
          regionId,total:batch.targetIds.length,nextId:nextUnstaged??null,
          nextName:nextUnstaged?scene.regions.get(nextUnstaged)?.name:null,
          targets:batch.targetIds.map(id=>({id,name:scene.regions.get(id)?.name??"Unknown",
            staged:batch.drafts.has(id)}))}:null,
        reviewDraft:!batch&&draft.kind==="grid"?candidate=>
          inspectTerritoryGridOwnership(scene,regionId,candidate):null,
        seamGuide:!batch&&draft.kind==="grid"?
          inspectEditableTerritoryGridSeams(scene,regionId):null,
        onStage:batch?candidate=>{
          if(territoryBatchFor(scene)!==batch)
            throw Error("The batch selection changed. Reopen the Workspace.");
          const latest=readTerritoryDraft(scene,regionId);
          if(latest.sourceDigest!==candidate.sourceDigest)
            throw Error("Native Territory geometry changed; reopen before staging.");
          batch.drafts.set(regionId,structuredClone(candidate));
          refresh();ui.notifications.info(`${region.name} staged locally. `+
            (nextUnstaged?"Continue to the next Territory in Paint.":
              "All selected destinations are staged; review the guarded batch."));
        }:null,
        afterStage:batch?async({advance=false,targetId=null,review=false}={})=>{
          await routeTerritoryBatchAfterStage({batch,regionId,nextUnstaged,
            decision:{advance,targetId,review},getBatch:()=>territoryBatchFor(scene),
            openEditor:id=>this.editTerritoryBoundary(scene,id,refresh),
            reviewAndApply:()=>this.commitTerritoryBatch(scene,refresh),
            restoreWorkspace:()=>restoreAtlasSceneWorkspace(scene)});
        }:null});
    },
    async resolveTerritoryCellTransfer(scene,refresh){
      ensureIdle(scene);
      if(navigation.travelSession||territoryCanvas.session||manualFog.brush||manualFog.paletteOpen)
        throw Error("Finish active journeys and editors before recovering native Regions.");
      const pending=readPendingTerritoryCellTransfer(scene);
      if(!pending)return;
      const inspection=inspectPendingTerritoryCellTransfer(scene);
      const container=document.createElement("div");
      const message=document.createElement("p");
      message.textContent="An interrupted native cell transfer requires GM recovery. " +
        `Atlas inspected all ${inspection.regionCount} native Regions without changing them. `+
        "Resume completes the intended cell ownership; Roll Back restores the original Shapes. " +
        "Blocked records list read-only field differences. Do not manually repair them " +
        "or clear the recovery record without reviewing a World backup.";
      container.appendChild(message);
      const list=document.createElement("ul");
      for(const record of inspection.records){
        const item=document.createElement("li");
        const status=record.state==="after"?"Already applied":
          record.state==="before"?"Original (not yet applied)":"BLOCKED";
        item.textContent=`${record.name} (${record.role}): ${status}; `+
          `${record.beforeCells} → ${record.afterCells} grid cells`+
          (record.reason?`. ${record.reason}`:"");
        list.appendChild(item);
      }
      container.appendChild(list);
      const choices=[];
      if(inspection.canResume)choices.push(["resume","Resume transfer (finish planned ownership)"]);
      if(inspection.canRollback)choices.push(["rollback","Roll Back (restore original Shapes)"]);
      if(!inspection.canResume||!inspection.canRollback){
        const blockers=document.createElement("p");
        const reasons=[!inspection.canResume?`Resume blocked: ${inspection.resumeBlocker}`:null,
          !inspection.canRollback?`Roll Back blocked: ${inspection.rollbackBlocker}`:null]
          .filter(Boolean);
        blockers.textContent=inspection.resumeBlocker===inspection.rollbackBlocker?
          `Both recovery options blocked: ${inspection.resumeBlocker}`:
          reasons.join(" ");
        container.appendChild(blockers);
      }
      if(!choices.length){
        await DialogV2.confirm({window:{title:"Native Territory Recovery Blocked"},
          content:container,yes:{label:"Close"},rejectClose:false,modal:true});
        return;
      }
      container.appendChild(createSettingsSelect(choices,
        {name:"mode",ariaLabel:"Native transfer recovery decision"}));
      const decision=await DialogV2.input({window:{title:"Recover Native Territory Transfer"},
        content:container,ok:{label:"Review Recovery"},rejectClose:false,modal:true});
      if(!decision?.mode||!choices.some(([value])=>value===decision.mode))return;
      const confirm=createTerritoryRecoveryConfirmationContent(
        decision.mode,pending.records.length);
      const accepted=await DialogV2.confirm({window:{title:"Confirm Territory Recovery"},
        content:confirm,yes:{label:decision.mode==="resume"?
          "Resume Native Transfer":"Roll Back Native Transfer"},
        rejectClose:false,modal:true});
      if(!accepted)return;
      if(JSON.stringify(readPendingTerritoryCellTransfer(scene))!==JSON.stringify(pending))
        throw Error("The persisted recovery record changed during review. Reopen recovery.");
      const latest=inspectPendingTerritoryCellTransfer(scene);
      if(!(decision.mode==="resume"?latest?.canResume:latest?.canRollback))
        throw Error("Native Region recovery safety changed during review. Reopen recovery.");
      await resolveTerritoryCellTransfer(scene,decision.mode);
      territoryBatchSelections.delete(scene.id);
      refresh();ui.notifications.info("Native Territory transfer recovery completed.");
    },
    async previewTerritoryGridConversion(scene,regionId,refresh){
      ensureIdle(scene);
      if(navigation.travelSession||territoryCanvas.session||
          manualFog.paletteOpen||manualFog.brush||territoryGridPreview.layer)
        throw Error("Finish the Journey and other canvas editors before previewing conversion.");
      const plan=planTerritoryGridConversion(scene,regionId);
      // Reversible, shared Foundry ApplicationV2 window focus: the Workspace
      // and other canvas-obscuring windows return to their prior state.
      const restoreWindows=acquireAtlasCanvasEditorFocus();
      try{
        territoryGridPreview.show(scene,plan);
        const content=document.createElement("div");
        const lines=[
          `Selected Region: ${plan.regionName} (${plan.tier}).`,
          `Candidate: ${plan.cellCount} native square/hex grid cells. `+
            `Selection rule: ${plan.inclusionRule}.`,
          `Net candidate area change: ${plan.netAreaChangePercent}% of original. `+
            "This is a net area comparison, not an exact boundary-error measurement.",
          "Cyan fill shows candidate grid cells; orange lines show the unchanged native polygon.",
          plan.peerCenterOverlaps.length?
            `Same-tier conflicts: ${plan.peerCenterOverlaps.map(p=>
              `${p.name} (${p.count} cells)`).join(", ")}. `+
            "Resolve those boundaries before converting; no other Region will be changed.":
            "No same-tier Region contains a candidate cell center. A Save will still check exact overlaps.",
          "This preview is read-only. Changes occur only after a separate GM confirmation."
        ];
        for(const message of lines){const p=document.createElement("p");
          p.textContent=message;content.appendChild(p);}
        const next=await DialogV2.confirm({window:{title:"Atlas · Native Grid Conversion Preview"},
          content,yes:{label:plan.peerCenterOverlaps.length?
            "Close Preview":"Review Conversion"},rejectClose:false,modal:true});
        if(!next||plan.peerCenterOverlaps.length)return;
        const confirm=document.createElement("div");
        for(const message of [
          `Replace the selected native Region ${plan.regionName}'s polygon with `+
            `${plan.cellCount} native grid cells?`,
          "This changes actual Foundry Region geometry, so native Region Behaviors " +
            "and token membership may be reevaluated. The Region's ID, appearance, " +
            "Behaviors, geography and public labels stay the same.",
          "Atlas will save the original polygon and Atlas controls as a backup " +
            "on this Region, allowing an explicitly confirmed Restore if it remains unchanged.",
          "All current parent and same-tier overlap checks must pass. " +
            "No neighboring Region is ever altered by this Save."
        ]){const p=document.createElement("p");p.textContent=message;confirm.appendChild(p);}
        const approved=await DialogV2.confirm({window:{title:"Convert Native Region to Grid?"},
          content:confirm,yes:{label:"Convert Selected Region"},rejectClose:false,modal:true});
        if(!approved)return;
        const result=await commitTerritoryGridConversion(scene,plan);
        refresh();ui.notifications.info(`Native Region converted to ${result.cellCount} grid cells. `+
          "Original polygon retained for explicit Restore.");
      }finally{territoryGridPreview.clear();restoreWindows();}
    },
    async restoreTerritoryPolygon(scene,regionId,refresh){
      ensureIdle(scene);
      if(navigation.travelSession||territoryCanvas.session||
          manualFog.paletteOpen||manualFog.brush||territoryGridPreview.layer)
        throw Error("Finish the Journey and other canvas editors before restoring a Region.");
      const content=document.createElement("div");
      for(const message of [
        "Restore this native Region's backed-up polygon and original Atlas boundary controls?",
        "The current native grid Shape will be replaced, but this Region's ID, " +
          "Behaviors, appearance, and player visibility will remain unchanged.",
        "Restoration is refused if the grid, native Shape, or neighboring " +
          "territory geometry has changed incompatibly. No other Region is edited."
      ]){const p=document.createElement("p");p.textContent=message;content.appendChild(p);}
      const approved=await DialogV2.confirm({window:{title:"Restore Native Region Polygon?"},
        content,yes:{label:"Restore Backed-Up Polygon"},rejectClose:false,modal:true});
      if(!approved)return;
      await restoreTerritoryPolygonBackup(scene,regionId);
      refresh();ui.notifications.info("Original native polygon restored; Atlas conversion backup cleared.");
    },
    async adoptNativeTerritoryBoundary(scene,regionId,refresh){
      ensureIdle(scene);
      if(navigation.travelSession||territoryCanvas.session||manualFog.paletteOpen||manualFog.brush)
        throw Error("End the Journey or active canvas editor before reconciling this Territory.");
      const plan=planNativeTerritoryAdoption(scene,regionId);
      const content=document.createElement("div");
      for(const message of [
        `The native Region ${plan.regionName} was changed outside Atlas.`,
        `Adopt its current ${plan.controls} ${plan.kind==="grid"?"grid cells":"polygon nodes"} `+
          "as new Atlas editor controls?",
        "The Region Shape, Behaviors, Levels, ID, visibility, geography and public " +
          "name will not change. Previous control-node identities, smoothing " +
          "settings and Blank Wall associations will be replaced.",
        "This does not move the Region back or correct a map offset. Review the " +
          "native boundary visually before confirming."
      ]){const p=document.createElement("p");p.textContent=message;content.appendChild(p);}
      const approved=await DialogV2.confirm({window:{title:"Adopt Native Territory Boundary"},
        content,yes:{label:"Adopt Current Native Shape"},rejectClose:false,modal:true});
      if(!approved)return;
      await adoptNativeTerritoryBoundary(scene,plan);
      refresh();ui.notifications.info("Atlas controls now match the authoritative native Region boundary.");
    },
    async configureRegion(scene, regionId) {
      if (!game.user?.isGM || !scene.canUserModify(game.user, "update")) {
        throw new Error("Only a GM can configure Atlas Regions.");
      }
      const region = scene.regions?.get(regionId);
      if (!region || region.parent?.id !== scene.id ||
          !region.canUserModify(game.user, "update")) {
        throw new Error(game.i18n.localize("FVTTATLAS.Regions.Missing"));
      }
      const AtlasRegionConfig=atlasTerrainRegionSheetClass(
        foundry.applications.sheets.RegionConfig);
      const sheet=new AtlasRegionConfig({document:region});
      await sheet.render({force:true});
      sheet.bringToFront?.();
      return sheet;
    },
    async setNativeRegionLink(scene,regionId,shouldLink,refresh) {
      ensureIdle(scene);
      if(shouldLink)await linkAtlasRegion(scene,regionId);
      else await unlinkAtlasRegion(scene,regionId);
      atlasDebug("territory","Native Region Atlas association updated",{
        linked:shouldLink},{level:"verbose"});
      refresh();
      ui.notifications.info(shouldLink?"Native Region linked to Atlas.":
        "Atlas association removed; native Region unchanged.");
    },
    async configureTerritoryCheckpoint(scene,regionId,refresh){
      ensureIdle(scene);
      if(navigation.travelSession||territoryCanvas.session||manualFog.paletteOpen||
          manualFog.brush)
        throw Error("Close active Journey and canvas editors before linking a Territory.");
      const region=scene.regions?.get?.(regionId);
      if(!region)throw Error("This native Territory is no longer available.");
      const existing=readTerritoryCheckpointLink(region);
      const atlas=readAtlas(scene);
      const links=territoryCheckpointLinks(scene);
      if(links.some(link=>link.invalid))
        throw Error("Resolve unsupported native Territory checkpoint flags before linking.");
      const territories=listSceneGeography(scene);
      const territory=territories.find(entry=>entry.id===regionId);
      if(!territory?.linked||territory.invalid)
        throw Error("Classify and link this native Territory to Atlas before associating a Checkpoint.");
      const selection=territoryCheckpointChoices({territory,checkpoints:atlas.checkpoints??[],
        categoryFor:id=>checkpointCategory(scene,id),links});
      const choices=territoryLinkOptionGroups(selection.candidates,{noneLabel:"No linked Checkpoint",
        ownerNameFor:id=>territories.find(entry=>entry.id===id)?.name??id});
      const content=document.createElement("div");
      const intro=document.createElement("p");
      intro.textContent=`Associate ${region.name} with one Atlas Checkpoint in this Scene. `+
        "Only Checkpoints of the same geographic type are eligible. Exact and " +
        "leading-name matches are suggestions for review, never automatic links. " +
        "Existing links must be removed before reassignment. No native Shapes, " +
        "Journals, discovery or Behaviors will change.";
      content.appendChild(intro);
      const picker=createSettingsGroupedSelect(choices,{name:"checkpointId",
        selectedId:existing?.checkpointId??selection.suggestedId??"",
        ariaLabel:"Atlas Checkpoint for native Territory"});
      content.appendChild(picker);
      const answer=await DialogV2.input({window:{title:"Link Territory to Checkpoint"},
        content,ok:{label:"Review Association"},rejectClose:false,modal:true});
      if(!answer)return;
      const targetId=String(answer.checkpointId??"")||null;
      if(targetId!==null&&!selection.candidates.some(candidate=>
          candidate.id===targetId&&!candidate.disabled))
        throw Error("Choose a compatible, available Atlas Checkpoint.");
      if(targetId===(existing?.checkpointId??null))return;
      if(existing&&targetId)throw Error("Remove the existing association before selecting another Checkpoint.");
      const chosen=atlas.checkpoints?.find(cp=>cp.id===targetId);
      const confirmation=document.createElement("div");
      const message=document.createElement("p");
      message.textContent=chosen?
        `Link native Territory ${region.name} to Checkpoint ${chosen.name}?`:
        `Remove the Checkpoint association from native Territory ${region.name}?`;
      confirmation.appendChild(message);
      const note=document.createElement("p");
      note.textContent="Only this Region's versioned Atlas association flag changes. " +
        "Native Region geometry, Behaviors, Levels, visibility, Atlas Checkpoint " +
        "location, linked Journals and player discovery stay unchanged.";
      confirmation.appendChild(note);
      const approved=await DialogV2.confirm({window:{title:"Confirm Territory Association"},
        content:confirmation,yes:{label:chosen?"Link Checkpoint":"Remove Association"},
        rejectClose:false,modal:true});
      if(!approved)return;
      await saveTerritoryCheckpointLink(scene,regionId,{checkpointId:targetId,
        expected:existing,expectedName:region.name,expectedAtlasRevision:atlas.revision});
      if(targetId)await closeCheckpointRegionGenerator(scene,targetId);
      refresh();ui.notifications.info(chosen?`Territory linked to ${chosen.name}.`:
        "Territory Checkpoint association removed; native Region unchanged.");
    },
    async configureCheckpointTerritory(scene,checkpointId,refresh){
      ensureIdle(scene);
      if(navigation.travelSession||territoryCanvas.session||manualFog.paletteOpen||manualFog.brush)
        throw Error("Close the active Journey and canvas editors before linking a Checkpoint.");
      const atlas=readAtlas(scene),checkpoint=atlas.checkpoints?.find(cp=>cp.id===checkpointId);
      if(!checkpoint)throw Error("This Checkpoint is no longer available.");
      const links=territoryCheckpointLinks(scene);
      if(links.some(link=>link.invalid))
        throw Error("Resolve unsupported native Territory checkpoint flags before linking.");
      const current=links.find(link=>link.link?.checkpointId===checkpointId);
      const candidates=listSceneGeography(scene).filter(entry=>entry.linked&&!entry.invalid&&
        entry.geography&&scene.regions?.get?.(entry.id)?.getFlag?.(MODULE_ID,"generatedRegion")==null);
      const checkpointKind=checkpointCategory(scene,checkpointId);
      const selection=checkpointTerritoryChoices({checkpoint,
        kind:checkpointKind,territories:candidates,links});
      const choices=territoryLinkOptionGroups(selection.candidates,{noneLabel:"No linked Territory",
        ownerNameFor:id=>atlas.checkpoints?.find(cp=>cp.id===id)?.name??id});
      const content=document.createElement("div");
      const note=document.createElement("p");
      note.textContent=`Link Checkpoint ${checkpoint.name} to a manually authored geographic `+
        `Territory of type ${checkpointKind}. `+
        "All same-type Territories are listed, including unavailable ones. " +
        "Exact and leading-name matches are suggestions only; nothing is linked " +
        "automatically. Unlink an existing association before switching.";
      content.appendChild(note);
      content.appendChild(createSettingsGroupedSelect(choices,{name:"regionId",
        selectedId:current?.regionId??selection.suggestedId??"",
        ariaLabel:"Geographic Territory for Atlas Checkpoint"}));
      const answer=await DialogV2.input({window:{title:"Link Checkpoint to Territory"},
        content,ok:{label:"Review Association"},rejectClose:false,modal:true});
      if(!answer)return;
      const regionId=String(answer.regionId??"")||null;
      if(regionId!==null&&!selection.candidates.some(candidate=>
          candidate.id===regionId&&!candidate.disabled))
        throw Error("Choose a compatible, available native geographic Territory.");
      if(regionId===(current?.regionId??null))return;
      if(current&&regionId)throw Error("Remove the existing association before selecting another Territory.");
      const region=scene.regions?.get?.(regionId??current?.regionId);
      if(!region)throw Error("The native Territory no longer exists.");
      const prior=readTerritoryCheckpointLink(region);
      const confirmation=document.createElement("div");
      const question=document.createElement("p");
      question.textContent=regionId?
        `Associate Checkpoint ${checkpoint.name} with Territory ${region.name}?`:
        `Remove the link between Checkpoint ${checkpoint.name} and Territory ${region.name}?`;
      confirmation.appendChild(question);
      const warning=document.createElement("p");
      warning.textContent="Only the native Territory's Atlas identity flag changes. " +
        "Checkpoint and Region names, Journal links, player visibility, " +
        "native Shapes and Behaviors are preserved.";
      confirmation.appendChild(warning);
      if(!await DialogV2.confirm({window:{title:"Confirm Geographic Association"},
        content:confirmation,yes:{label:regionId?"Link Territory":"Remove Association"},
        rejectClose:false,modal:true}))return;
      await saveTerritoryCheckpointLink(scene,region.id,{checkpointId:regionId?checkpointId:null,
        expected:prior,expectedName:region.name,expectedAtlasRevision:atlas.revision});
      if(regionId)await closeCheckpointRegionGenerator(scene,checkpointId);
      refresh();ui.notifications.info(regionId?`${checkpoint.name} linked to ${region.name}.`:
        `${checkpoint.name} Territory association removed.`);
    },
    async smoothNativeRegion(scene,regionId,refresh) {
      ensureIdle(scene);
      if(navigation.travelSession)
        throw Error("Finish or safely end the active Journey before changing native territory boundaries.");
      const choice=document.createElement("div");
      const intro=document.createElement("p");
      intro.textContent="Round an existing manually drawn native polygon. " +
        "This changes the border and may create gaps against neighboring Regions. " +
        "Do not smooth a shared border independently until Atlas's paired-edge editor is available. " +
        "Small polygons use Chaikin corner cutting; detailed polygons use a " +
        "bounded vertex-preserving pass (up to 2,048 native vertices). " +
        "Repeat smoothing can still shrink land area; inspect the preview each time.";
      choice.appendChild(intro);
      choice.appendChild(createSettingsSelect([["1","Gentle · one smoothing pass"],
        ["2","Moderate · two smoothing passes"]],
      {name:"passes",ariaLabel:"Boundary smoothing strength"}));
      const input=await DialogV2.input({window:{title:"Atlas · Smooth native Region"},
        content:choice,ok:{label:"Preview Boundary"},rejectClose:false,modal:true});
      if(!input)return;
      const passes=Number(input.passes);
      const view=globalThis.canvas;
      if(!view?.ready||view.scene?.id!==scene.id)
        throw Error("Open this Scene on the canvas to preview the Region.");
      let plan;
      try {plan=planNativeRegionSmoothing(scene,regionId,passes);}
      catch(error){
        atlasDebug("territory","Native boundary smoothing preview rejected",{
          reason:error.message},{level:"verbose"});
        throw error;
      }
      const confirmation=document.createElement("div");
      for(const line of ["Region: "+plan.regionName,
        "Orange: current polygon boundary. Green: proposed smoothed boundary.",
        `Method: ${plan.smoothingMode}; ${plan.sourceVertexCount} → `+
          `${plan.resultVertexCount} vertices; estimated area change: `+
          `${plan.areaChangePercent}%.`,
        "No neighboring Region will be modified. Gaps or overlaps with adjacent territories " +
          "may change. Use Cancel if this Region shares an exact political border.",
        "Save changes only to this Region's native Shapes. Its ID, flags, " +
          "Behaviors, name, Levels, elevation and visibility will remain unchanged."]){
        const p=document.createElement("p");p.textContent=line;confirmation.appendChild(p);
      }
      roadCanvas.showTerritoryBoundaryPreview(scene,plan);
      try {
        const approved=await DialogV2.confirm({window:{title:"Confirm smoothed boundary"},
          content:confirmation,yes:{label:"Save Smoothed Border"},
          rejectClose:false,modal:true});
        if(!approved)return;
        if(!roadCanvas.isRegionPreviewActive(scene,plan))
          throw Error("The canvas preview changed; reopen the boundary editor.");
        try {await saveNativeRegionSmoothing(scene,plan);}
        catch(error){
          atlasDebug("territory","Native boundary smoothing save rejected",{
            reason:error.message},{level:"verbose"});
          throw error;
        }
        refresh();ui.notifications.info("Native Region boundary smoothed; other Regions and Behaviors preserved.");
      }finally{roadCanvas.clearRegionPreview();}
    },
    async reconcileTerritoryBorders(scene,refresh){
      ensureIdle(scene);
      if(navigation.travelSession)
        throw Error("Finish or safely end the active Journey before reconciling native Territory boundaries.");
      const view=globalThis.canvas;
      if(!view?.ready||view.scene?.id!==scene.id)
        throw Error("Open this Scene on the canvas to analyze its native Territory boundaries.");
      let analysis;
      try{analysis=analyzeSceneTerritoryBorders(scene);}
      catch(error){
        atlasDebug("territory","Peer boundary analysis rejected",{reason:error.message},
          {level:"verbose"});throw error;
      }
      const choose=document.createElement("div");
      const description=document.createElement("p");
      description.textContent=`Analyzed ${analysis.comparedPairs} peer pairs. `+
        `${analysis.overlaps.length} overlapping pair(s); `+
        `${analysis.nearby.length} nearby boundary pair(s) (possible gaps); `+
        `${analysis.unsupportedPairs} unsupported pair(s). `+
        "Nested Continents and settlements and road-generated corridor Regions are excluded. " +
        "An overlap correction preserves one Region and trims only the other; " +
        "native Shapes and Behaviors remain unchanged until you explicitly confirm.";
      choose.appendChild(description);
      if(analysis.nearby.length){
        const nearby=document.createElement("p");
        nearby.textContent="Nearby borders to inspect in native Foundry (no automatic gap-fill): "+
          analysis.nearby.slice(0,8).map(pair=>pair.firstName+" / "+
            pair.secondName+` (${pair.distancePixels}px)`).join(" · ");
        choose.appendChild(nearby);
      }
      if(!analysis.overlaps.length){
        ui.notifications.info("No supported overlapping geographic peers detected. Review nearby/gap hints in the boundary analysis dialog.");
        await DialogV2.input({window:{title:"Atlas · Territory Boundary Analysis"},
          content:choose,ok:{label:"Close"},rejectClose:false,modal:true});
        return;
      }
      const gridConflicts=analysis.overlaps.filter(pair=>pair.canTrim===false);
      if(gridConflicts.length){
        const warning=document.createElement("p");
        warning.textContent=`${gridConflicts.length} pair(s) contain native painted grid cells. `+
          "A polygon trim is not safe for Grid Shapes. Use the Atlas Territory " +
          "boundary editor to remove or transfer the conflicting cells.";
        choose.appendChild(warning);
      }
      const options=analysis.overlaps.filter(pair=>pair.canTrim!==false).flatMap(pair=>[
        [`${pair.secondId}|${pair.firstId}`,
          `Keep ${pair.firstName}; trim ${pair.secondName} · ${pair.smallerCoveragePercent}% of smaller Region overlaps`],
        [`${pair.firstId}|${pair.secondId}`,
          `Keep ${pair.secondName}; trim ${pair.firstName} · ${pair.smallerCoveragePercent}% of smaller Region overlaps`]
      ]);
      if(!options.length){
        await DialogV2.input({window:{title:"Atlas · Territory Boundary Analysis"},
          content:choose,ok:{label:"Close"},rejectClose:false,modal:true});
        return;
      }
      choose.appendChild(createSettingsSelect(options,{name:"direction",
        ariaLabel:"Select the protected Territory and the Territory to trim"}));
      const selection=await DialogV2.input({window:{title:"Atlas · Analyze Territory Borders"},
        content:choose,ok:{label:"Preview one-sided correction"},
        rejectClose:false,modal:true});
      if(!selection)return;
      const chosen=options.find(item=>item[0]===selection.direction);
      if(!chosen)throw Error("Select an available Territory pair; retry the analysis.");
      const [trimId,keepId]=chosen[0].split("|");
      let plan;
      try{plan=planNativeTerritoryTrim(scene,trimId,keepId);}
      catch(error){
        atlasDebug("territory","Peer border trim preview rejected",{reason:error.message},
          {level:"verbose"});throw error;
      }
      const confirm=document.createElement("div");
      for(const line of [
        `Protected Region (blue): ${plan.keepName} — no changes.`,
        `Trimmed Region: ${plan.trimName} — orange original, green proposed.`,
        `Native overlap removed: ${plan.overlapPercent}% of the trimmed Region; `+
          `area change: -${plan.removedPercent}%; vertices: `+
          `${plan.sourceVertices} → ${plan.resultVertices}.`,
        "Only one existing native Region Shape is updated after confirmation. " +
          "Its ID, Atlas flags, native Behaviors, Levels, visibility and name are preserved.",
        "Complex splits, holes, large losses and stale native boundaries are refused. " +
          "Inspect the proposed seam closely at different zoom levels. " +
          "This operation cannot fill unrelated gaps; use native Region editing for them."
      ]){const p=document.createElement("p");p.textContent=line;confirm.appendChild(p);}
      roadCanvas.showTerritoryTrimPreview(scene,plan);
      try{
        const approved=await DialogV2.confirm({window:{title:"Confirm one-sided Territory correction"},
          content:confirm,yes:{label:"Save Trimmed Native Border"},
          rejectClose:false,modal:true});
        if(!approved)return;
        if(!roadCanvas.isRegionPreviewActive(scene,plan))
          throw Error("The canvas preview changed. Reopen the Territory analysis.");
        try{await saveNativeTerritoryTrim(scene,plan);}
        catch(error){
          atlasDebug("territory","Peer border trim save rejected",{reason:error.message},
            {level:"verbose"});throw error;
        }
        refresh();ui.notifications.info("One native Territory border trimmed; protected Region and Behaviors preserved.");
      }finally{roadCanvas.clearRegionPreview();}
    },
    async configurePublicTerritory(scene, refresh, directRegionId=null) {
      if(!game.user?.isGM||!scene.canUserModify?.(game.user,"update"))
        throw Error("Only a Scene-authorized GM can publish territory names.");
      const entries=listPublicTerritorySettings(scene);
      if(!entries.length)throw Error("Create a native Scene Region first.");
      let regionId=directRegionId;
      if(!regionId){
        const choose=document.createElement("div");
        const intro=document.createElement("p");
        intro.textContent="Select the native Region whose public Journey name you want to edit.";
        choose.appendChild(intro);
        choose.appendChild(createSettingsSelect(entries.map(item=>[
          item.id,item.name+(item.label?" · Public: "+item.label:"")+
            (item.invalid?" · Invalid flag":"")]),
        {name:"regionId",ariaLabel:"Region to use for public journey narration"}));
        const chosen=await DialogV2.input({window:{title:"Select public territory"},
          content:choose,ok:{label:"Edit public name"},rejectClose:false});
        if(!chosen)return;
        regionId=String(chosen.regionId??"");
      }
      if(!entries.some(item=>item.id===regionId))
        throw Error("Choose an existing Scene Region.");
      const region=scene.regions.get(regionId);
      if(!region||region.parent?.id!==scene.id||
          !region.canUserModify?.(game.user,"update"))
        throw Error("That native Region is no longer editable. Refresh Atlas.");
      const expected=readPublicTerritory(region); // Reject unsupported future flags.
      const expectedName=region.name,expectedHidden=region.hidden===true;
      const form=createPublicTerritoryForm({nativeName:region.name,
        published:expected,hidden:expectedHidden});
      const result=await DialogV2.input({window:{title:atlasSettingsTitle("Public Territory",region.name)},
        content:form,ok:{label:"Save public territory setting"},
        rejectClose:false,modal:true});
      if(!result)return;
      const enabled=result.publish===true||
        result.publish==="true"||result.publish==="on";
      await savePublicTerritory(scene,regionId,{enabled,
        label:String(result.publicName??""),expected,expectedName,expectedHidden});
      atlasDebug("territory","Public Territory label saved",{
        enabled,changed:Boolean(expected?.enabled)!==enabled ||
          (enabled&&expected?.label!==String(result.publicName??""))
      },{level:"verbose"});
      refresh();
      ui.notifications.info(enabled?"Public territory label saved.":
        "Public territory label disabled.");
    },
    async configureTerritorySharing(scene,regionId,refresh){
      if(!game.user?.isGM||!scene.canUserModify?.(game.user,"update"))
        throw Error("Only a Scene-authorized GM may share Territory boundaries.");
      const region=scene.regions?.get?.(regionId);
      if(!region||region.parent?.id!==scene.id||
          !region.canUserModify?.(game.user,"update"))
        throw Error("The native Territory is no longer editable.");
      const expected=readPlayerTerritorySharing(region);
      const expectedName=region.name,expectedHidden=region.hidden===true;
      const enable=!expected;
      const content=document.createElement("div");
      const message=document.createElement("p");
      message.textContent=enable?
        `Share the native boundary of ${region.name} with players? Players may choose `+
        "to display this Territory in Atlas Layers, even where the map is unexplored. " +
        "Its name remains hidden unless separately published as a public Journey name. " +
        "Native Region Shapes and Behaviors will not change.":
        `Stop sharing the native boundary of ${region.name} with players? `+
        "Its public Journey name and other native Region data will remain unchanged.";
      content.appendChild(message);
      const approved=await DialogV2.confirm({
        window:{title:enable?"Share Territory with players":"Hide Territory from players"},
        content,yes:{label:enable?"Share Boundary":"Hide Boundary"},
        rejectClose:false,modal:true
      });
      if(!approved)return;
      await savePlayerTerritorySharing(scene,regionId,{visible:enable,expected,
        expectedName,expectedHidden});
      atlasLayers.refresh();refresh();
      ui.notifications.info(enable?"Territory boundary shared with players.":
        "Territory boundary hidden from players.");
    },
    async configureGeography(scene,refresh,regionId) {
      ensureIdle(scene);
      if (!game.user?.isGM || !scene.canUserModify?.(game.user,"update"))
        throw Error("Only a Scene-authorized GM can classify territories.");
      const region=scene.regions?.get(regionId);
      if (!region || region.parent?.id!==scene.id ||
          !region.canUserModify?.(game.user,"update"))
        throw Error("The Region is no longer editable. Refresh Atlas.");
      const entries=listSceneGeography(scene);
      if (!entries.some(entry=>entry.id===regionId&&entry.linked&&!entry.invalid))
        throw Error("Link a valid native Region to Atlas before assigning geography.");
      const expected=readRegionGeography(region);
      const expectedName=region.name,expectedHidden=region.hidden===true;
      const content=buildTerritoryGeographyForm({region,current:expected,
        territories:entries,roads:readAtlas(scene).roads??[]});
      const result=await DialogV2.input({window:{title:atlasSettingsTitle("Geographic Territory",region.name)},
        content,ok:{label:"Review and Save Geography"},rejectClose:false,modal:true});
      if (!result) return;
      const next=geographyFromForm(result,expected);
      const confirmation=document.createElement("div");
      const message=document.createElement("p");
      message.textContent=next ?
        `Save ${region.name} as ${next.kind}`+
          (next.parentRegionId?" under the selected parent territory":" as a root territory")+
          `? Road membership will be inferred by geometry with ${Object.keys(next.roadOverrides).length} manual corrections. `+
          "Native Region geometry, Behaviors and Journey labels will not change." :
        `Remove the Atlas geographic classification and Road corrections from ${region.name}? `+
          "The native Region and its public Journey name will be preserved.";
      confirmation.appendChild(message);
      const confirmed=await DialogV2.confirm({window:{title:"Confirm Atlas geography"},
        content:confirmation,
        rejectClose:false,modal:true});
      if (!confirmed)return;
      const changed=await saveRegionGeography(scene,regionId,{next,expected,
        expectedName,expectedHidden});
      atlasDebug("territory","Atlas geography classification reviewed",{
        changed,kind:next?.kind??"unclassified",
        hasParent:Boolean(next?.parentRegionId),
        manualRoadCorrections:Object.keys(next?.roadOverrides??{}).length
      },{level:"verbose"});
      if (changed) ui.notifications.info("Atlas geographic classification saved.");
      refresh();
    },
    finish: () => roadCanvas.finish(),
    cancel: () => roadCanvas.cancel(),
    select: async (scene, id) => {
      await centerAtlasOn(scene,id);
    },
    async rename(scene, road, refresh) {
      ensureIdle(scene);
      const revision = readAtlas(scene).revision;
      const content = document.createElement("div");
      const input = document.createElement("input");
      input.name = "roadName";
      input.type = "text";
      input.maxLength = 120;
      input.setAttribute("value", road.name);
      input.setAttribute("maxlength", "120");
      input.setAttribute("required", "");
      content.appendChild(input);
      const data = await DialogV2.input({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Rename") },
        content,
        ok: { label: game.i18n.localize("FVTTATLAS.Roads.SaveName") },
        rejectClose: false
      });
      if (!data) return;
      await saveRenamedRoad(scene, {
        roadId: road.id, segmentId: road.id,
        name: String(data.roadName ?? ""), expectedRevision: revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Renamed"));
    },
    async remove(scene, road, refresh) {
      ensureIdle(scene);
      const atlas=readAtlas(scene),revision=atlas.revision;
      const checkpoints=atlas.checkpoints?.filter(item=>item.roadId===road.id)??[];
      const generated=listGeneratedRegions(scene).filter(item=>
        item.metadata?.roadId===road.id);
      const deletable=generated.filter(item=>!item.modified && !item.invalid);
      const protectedRegions=generated.filter(item=>item.modified || item.invalid);
      // Show exactly what the GM is about to delete on the active map.
      await centerAtlasOn(scene,road.id);
      const shell=document.createElement("div");
      const intro=document.createElement("p");
      intro.textContent="Delete \""+road.name+"\"? This removes its saved road geometry and settings. This cannot be undone.";
      shell.appendChild(intro);
      const checkbox=(key,title,names)=>{
        if(!names.length)return;
        const section=document.createElement("div");
        const note=document.createElement("p");
        note.textContent=title+" ("+names.length+"):";
        section.appendChild(note);
        const list=document.createElement("ul");
        for(const name of names){
          const item=document.createElement("li");item.textContent=name;list.appendChild(item);
        }
        section.appendChild(list);
        const label=document.createElement("label");
        const input=document.createElement("input");
        input.type="checkbox";input.name=key;
        label.append(input,document.createTextNode(" I confirm deleting these "+title.toLowerCase()+"."));
        section.appendChild(label);shell.appendChild(section);
      };
      checkbox("deleteCheckpoints","Linked checkpoints",checkpoints.map(item=>item.name));
      checkbox("deleteRegions","Unmodified Atlas-generated Regions",deletable.map(item=>item.name));
      if(protectedRegions.length){
        const note=document.createElement("p");
        note.textContent="Protected Regions will be retained because their geometry was modified: "+
          protectedRegions.map(item=>item.name).join(", ")+".";
        shell.appendChild(note);
      }
      const content=document.createElement("div");content.appendChild(shell);
      const result=await DialogV2.input({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Delete") },
        content,ok:{label:"Delete Road and Confirmed Items"},
        rejectClose: false,modal: true
      });
      if(!result)return;
      const checked=key=>result[key]===true || result[key]==="on";
      if(checkpoints.length && !checked("deleteCheckpoints"))
        throw new Error("Check the linked checkpoint confirmation to delete this road.");
      if(deletable.length && !checked("deleteRegions"))
        throw new Error("Check the generated Region confirmation to delete this road.");
      // Refuse stale decisions, even if another GM changed a Region while the
      // dialog was open. The Scene flag write itself is revision-checked.
      const latest=listGeneratedRegions(scene).filter(item=>item.metadata?.roadId===road.id);
      if(latest.length!==generated.length || latest.some(item=>
        !generated.some(previous=>previous.id===item.id &&
          previous.name===item.name && previous.modified===item.modified)))
        throw new Error("The road Regions changed while confirming. Reopen Delete Road.");
      await saveRemovedRoad(scene, { roadId: road.id, segmentId: road.id,
        expectedRevision: revision,removeCheckpoints:checkpoints.length>0 });
      if(deletable.length) {
        try {
          await scene.deleteEmbeddedDocuments("Region",deletable.map(item=>item.id));
        } catch(error) {
          roadCanvas.refresh();refresh();
          throw new Error("Road and checkpoints were deleted, but some generated Regions may remain. Review native Scene Regions. "+(error.message||String(error)));
        }
      }
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Road deleted with "+checkpoints.length+
        " checkpoint(s) and "+deletable.length+" generated Region(s).");
      return true;
    }
  };
}

/** Confirm grid remapping before an edit can strand existing image-relative cell centers. */
function atlasGridChangeNotice(scene, change, options) {
  if (!game.user?.isGM || options?.atlasGridChangeConfirmed === true) return;
  const nextType = change?.grid?.type ?? change?.["grid.type"];
  const nextSize = change?.grid?.size ?? change?.["grid.size"];
  const typeChanged = nextType !== undefined && Number(nextType) !== Number(scene.grid?.type);
  const sizeChanged = nextSize !== undefined && Number(nextSize) !== Number(scene.grid?.size);
  if (!typeChanged && !sizeChanged) return;
  const state = readManualFog(scene);
  if (!state.revealed.length && !state.hidden.length) return;
  const expectedType = scene.grid?.type, expectedSize = scene.grid?.size;
  const updated = foundry.utils.deepClone(change);
  // Hooks are synchronous: cancel this attempt and initiate a confirmed update later.
  void Promise.resolve().then(async () => {
    const content = document.createElement("div");
    const warning = document.createElement("p");
    warning.textContent =
      "Atlas has " + state.revealed.length + " revealed and " +
      state.hidden.length + " manually hidden cells saved on the current grid. " +
      "Changing its type or cell size changes the cell centers: existing Atlas " +
      "exploration will remain saved, but it may no longer appear revealed. " +
      "There is no automatic hex/square conversion in this version. " +
      "Cancel to preserve the current visible exploration; proceed only after making a backup.";
    content.appendChild(warning);
    const approved = await foundry.applications.api.DialogV2.confirm({
      window:{title:"Atlas exploration — grid change warning"},
      content, yes:{label:"Change Grid Anyway"}, rejectClose:false, modal:true
    });
    if (!approved) return;
    if (scene.grid?.type !== expectedType || scene.grid?.size !== expectedSize) {
      ui.notifications.warn("The Scene grid changed while the warning was open. Review it again.");
      return;
    }
    await scene.update(updated, {...options, atlasGridChangeConfirmed:true});
  }).catch(error => ui.notifications.error("Atlas grid warning: " + (error.message || String(error))));
  return false;
}

Hooks.once("init", () => {
  registerAtlasDebugSettings();
  atlasLayers.register();
  registerNavigationWorldSettings({onPlaybackChange:()=>{
    if(navigation.active)void navigation.render(true);
  }});
  game.settings.register(MODULE_ID, "hiddenOverlayHatching", {
    name: "GM Hidden-Item Hatching",
    hint: "Draw subtle burgundy diagonal hatching over GM-visible roads and checkpoints that players have not discovered. Never shown to players.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => roadCanvas.refresh()
  });
  game.settings.register(MODULE_ID, ATLAS_MEASURING_UNITS_SETTING, {
    name: "Atlas Measuring Units",
    hint: "Use the game system's distance setting (D&D 5e: Use Metric Length Units), "+
      "or override Atlas measurements across travel, navigation, exploration and elevations. "+
      "Only presentation changes: saved Scene coordinates, routes and elevations keep their native units.",
    scope: "world", config: true, type: String,
    choices: {...ATLAS_MEASURING_UNITS_CHOICES},default:"system",
    onChange: () => {roadCanvas.refresh();if(navigation.active)void navigation.render(true);}
  });
  // Keep the historical World setting registered for backwards compatibility.
  // New views consult Atlas Measuring Units; the old value is never deleted.
  game.settings.register(MODULE_ID, "elevationUnits", {
    name: "Atlas Elevation Units (legacy)",
    hint: "Retained for existing Worlds; Atlas Measuring Units now controls display.",
    scope: "world", config: false, type: String,
    choices: { metric: "Meters (metric)", imperial: "Feet (imperial)" },default:"metric"
  });
  registerManualBrushSettings();
  registerWorldTravelPresets();
  registerWorldCheckpointPresets();
  registerWorldRoadAppearance(() => roadCanvas.refresh());
  const roadActions = actions();
  atlasLayers.configureRegion=(scene,regionId)=>roadActions.configureRegion(scene,regionId);
  atlasLayers.configureSharing=(scene,regionId,refresh)=>
    roadActions.configureTerritorySharing(scene,regionId,refresh);
  roadActions.openAtlasWorkspace = scene => openAtlasSceneWorkspace(scene,roadActions);
  roadCanvas.setShortcutHandler((scene, target) => {
    ensureIdle(scene);
    const atlas = readAtlas(scene);
    const refresh = () => refreshAtlasSceneConfig(scene);
    if (target.kind === "checkpoint") {
      const checkpoint = atlas.checkpoints?.find(c => c.id === target.id);
      if (checkpoint) roadActions.editCheckpointAppearance(scene, checkpoint, refresh);
    } else if (target.kind === "road") {
      const road = atlas.roads?.find(r => r.id === target.id);
      if (road) return roadActions.editRoadAppearance(scene, road, refresh);
    }
  }, { isReserved: () => navigation.active || Boolean(territoryCanvas.session) });
  Hooks.on("getSceneControlButtons", controls => {
    if(!game.user?.isGM){
      controls.atlasPlayerLayers={
        name:"atlasPlayerLayers",title:"Atlas Layers",icon:"fa-solid fa-layer-group",
        order:Object.keys(controls).length,visible:true,
        tools:{atlasLayers:{name:"atlasLayers",title:"Atlas Layers",
          icon:"fa-solid fa-layer-group",order:0,button:true,visible:true,
          onChange:()=>void atlasLayers.open().catch(error=>
            ui.notifications.error(error.message??String(error)))}}
      };
      return;
    }
    controls.atlasManualFog={
      name:"atlasManualFog",title:"Atlas Exploration",
      icon:"fa-solid fa-map",order:Object.keys(controls).length,
      visible:true,
      // Selecting this control never opens the brush palette; the brush tool does.
      tools:{
        atlasAddRoad:{
          name:"atlasAddRoad",title:"Draw Atlas Road",
          icon:"fa-solid fa-route",order:0,button:true,visible:true,
          onChange:()=>{
            const scene=canvas?.scene;
            if (!scene) return ui.notifications.warn("Open a Scene first.");
            try { navigation.tearDown(); roadActions.begin(scene,()=>refreshAtlasSceneConfig(scene)); }
            catch(error) { ui.notifications.error(error.message); }
          }
        },
        atlasSceneWorkspace: {
          name: "atlasSceneWorkspace", title: "Atlas Scene Workspace (GM)",
          icon: "fa-solid fa-gear", order: 5, button: true, visible: true,
          onChange: () => {
            const scene = canvas?.scene;
            if (!scene) return ui.notifications.warn("Open a Scene first.");
            void roadActions.openAtlasWorkspace(scene).catch(error =>
              ui.notifications.error(error.message ?? String(error)));
          }
        },
        atlasBrushPalette:{
          name:"atlasBrushPalette",title:"Open Atlas Exploration Brushes",
          icon:"fa-solid fa-paintbrush",order:1,button:true,visible:true,
          onChange:()=>fogPalette.toggle()
        },
        atlasLayers:{
          name:"atlasLayers",title:"Atlas Layers",
          icon:"fa-solid fa-layer-group",order:4,button:true,visible:true,
          onChange:()=>void atlasLayers.open().catch(error=>
            ui.notifications.error(error.message??String(error)))
        },
        atlasNavigation:{
          name:"atlasNavigation",title:"Atlas Navigation — choose Point A and Point B",
          icon:"fa-solid fa-compass",order:3,button:true,visible:true,
          onChange:()=>{
            try {
              if(navigation.active) navigation.tearDown();
              else {
                const scene=canvas?.scene;
                if (!scene) throw new Error("Open a Scene first.");
                if (roadCanvas.getDraft(scene)) throw new Error("Save or cancel the Road Editor before navigating.");
                manualFog.setBrush(null);
                fogPalette.close();
                navigation.activate();
              }
            } catch(error) { ui.notifications.error(error.message || String(error)); }
          }
        },
        atlasGMFogPreview:{
          name:"atlasGMFogPreview",title:"Toggle GM Fog Preview",
          icon:"fa-solid fa-eye",order:2,button:true,visible:true,
          onChange:()=>{
            manualFog.setPreview(!manualFog.preview);
            if(fogPalette.open)fogPalette.draw();
          }
        }
      }
    };
  });
  Hooks.on("preUpdateScene", atlasGridChangeNotice);
  Hooks.on("renderTokenConfig", addAtlasExplorerToTokenConfig);
  // Foundry v14 public ApplicationV2 render hook; only GM D&D5e Group sheets match.
  Hooks.on("renderApplicationV2", addAtlasGroupTransportationControl);
  Hooks.on("renderSceneConfig", (app, element) => {
    addAtlasRoadsToSceneConfig(app, element, roadActions);
  });
  Hooks.on("closeSceneConfig", app => {
    // The floating dock owns an active edit even after its parent Scene sheet closes.
    // Save Points / Cancel, not the sheet lifecycle, must resolve that edit.
    if (!activeRoadDockForSceneConfig(app, roadDock, roadCanvas)) {
      roadCanvas.endEditor(app?.document);
    }
    forgetAtlasSceneConfig(app);
  });
  Hooks.on("canvasReady", () => {
    atlasDebug("lifecycle","Foundry canvasReady",{sceneId:canvas?.scene?.id??null});
    navigation.tearDown("canvasReady");
    roadCanvas.refresh();manualFog.refresh();
    void (async()=>{
      try{await navigation.autoResumeAfterCanvasReady();}
      catch(error){atlasWarn("journey","Automatic canvas recovery failed",error);}
      try{await navigation.restoreWindowAfterCanvasReady();}
      catch(error){atlasWarn("lifecycle","Navigation window restoration failed",error);}
      try{await navigation.announceCanvasReviewAfterCanvasReady();}
      catch(error){atlasWarn("announcement","Canvas review notice failed",error);}
    })();
  });
  // Foundry v14 movement includes origin, passed waypoints and destination.
  Hooks.on("moveToken", observeAtlasTokenMovement);
  Hooks.on("canvasTearDown", () => {
    atlasDebug("lifecycle","Foundry canvasTearDown",{
      sceneId:canvas?.scene?.id??null,journeyActive:Boolean(navigation.travelSession)
    });
    navigation.tearDown("canvasTearDown");
    territoryCanvas.cancel();
    territoryGridPreview.clear();
    if (roadDock) {
      roadDock.finished = true;
      void roadDock.close();
    }
    fogPalette.close();
    roadCanvas.tearDown();
    atlasDebug("lifecycle","Road overlay lifetime diagnostics",
      roadCanvas.getOverlayDiagnostics(),{level:"trace"});
    manualFog.tearDown();
  });
  Hooks.on("canvasPan", view => { roadCanvas.onCanvasPan(view); navigation.draw(); });
  for(const event of ["createRegion","updateRegion","deleteRegion"]){
    Hooks.on(event,region=>{
      navigation.onRegionUpdated(region);
      void refreshAtlasSceneWorkspace(region.parent).catch(error =>
        atlasWarn("lifecycle","Atlas Workspace native Region refresh failed",error));
    });
  }
  Hooks.on("sightRefresh", () => roadCanvas.onFogRefresh());
  Hooks.on("updateFogExploration", () => roadCanvas.onFogRefresh());
  Hooks.on("deleteFogExploration", () => roadCanvas.onFogRefresh());
  Hooks.on("updateScene", (scene,changes) => {
    if (globalThis.canvas?.ready && canvas.scene?.id === scene.id) {
      atlasDebug("lifecycle","Scene updated",{
        sceneId:scene.id,changedFields:Object.keys(changes??{})
      },{level:"trace"});
      navigation.onSceneUpdated(scene,changes);
      if(!game.user?.isGM||!isManualFogOnlySceneUpdate(changes))roadCanvas.refresh();
      if(shouldRefreshManualFogForSceneUpdate(changes)){
        atlasDebug("fog","Atlas fog refresh after Scene update",{
          sceneId:scene.id,changedFields:Object.keys(changes??{})
        },{level:"trace"});
        manualFog.refresh();
      }
      if(fogPalette.open)fogPalette.draw();
    }
  });
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  try {
    const installed = registerAtlasSceneTab(foundry.applications.sheets.SceneConfig);
    if (!installed) console.warn("[" + MODULE_ID + "] Scene Atlas tab registration unavailable; using in-sheet fallback.");
  } catch (error) {
    console.warn("[" + MODULE_ID + "] Scene Atlas tab unavailable; using in-sheet fallback.", error);
  }
  console.info("[" + MODULE_ID + "] Module ready");
});
