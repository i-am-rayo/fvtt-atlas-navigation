/**
 * FVTT Atlas Navigation — Foundry v14 bootstrap.
 * v0.2.22 adds GM-only authoring shortcuts and a floating road editor.
 */
import { addAtlasRoadsToSceneConfig, registerAtlasSceneTab,
  getAtlasSceneConfig, refreshAtlasSceneConfig, forgetAtlasSceneConfig,
  openAtlasRegionGenerator } from "./scene-config.js";
import { RoadCanvasController } from "./road-canvas.js";
import { addAtlasExplorerToTokenConfig } from "./atlas-token-config.js";
import { observeAtlasTokenMovement } from "./atlas-token-exploration.js";
import { readAtlas, MODULE_ID } from "./atlas-storage.js";
import { savePartyExplorationConfig,
  saveCheckpointKnowledge } from "./party-exploration-storage.js";
import { readManualFog, setManualFogEnabled }
  from "./atlas-manual-fog-storage.js";
import { AtlasManualFogController } from "./atlas-manual-fog-renderer.js";
import { AtlasManualFogPalette, registerManualBrushSettings }
  from "./atlas-manual-fog-panel.js";
import { saveRenamedRoad, saveRemovedRoad, saveAnchoredLegacyRoads,
  saveOrganizedRoads, saveMergedRoads,
  saveEditedCheckpoint, saveRemovedCheckpoint, saveRoadTravelPreset,
  saveRoadAppearance, saveRoadPresentation, saveRoadPlayerVisibility,
  saveCheckpointPlayerVisibility } from "./road-storage.js";
import { getRoadMergeCandidates, suggestRoadName } from "./road-model.js";
import { sceneImageOrigin, toCanvasPoint } from "./road-coordinates.js";
import { linkAtlasRegion, unlinkAtlasRegion, listSceneRegions } from "./region-atlas.js";
import { planSceneGeneratedRegion, saveGeneratedNativeRegion,
  setGeneratedRegionTravelPreset, applyGeneratedRegionMovementCost,
  applyGeneratedRegionPresetColor, updateGeneratedRegionMovementCost } from "./generated-region.js";
import { availableMovementActions, readPreset, previewNativeMovementCost }
  from "./native-movement-cost.js";
import { presetCostSummary } from "./travel-preset-model.js";
import { registerWorldTravelPresets, readWorldTravelPresets }
  from "./travel-preset-settings.js";
import { roadAppearanceForm, roadAppearanceFromForm, registerWorldRoadAppearance }
  from "./road-appearance-settings.js";
import { readWorldRoadAppearance, resolveRoadAppearance, roadAppearanceMode }
  from "./road-appearance.js";
import { AtlasCheckpointAppearanceEditor } from "./checkpoint-appearance-editor.js";
import { readAtlasJournalLinks, journalUuidFor, saveAtlasJournalLink,
  validJournalUuid } from "./atlas-journal-links.js";
import { journalLinkFields, journalUuidFromForm } from "./atlas-journal-fields.js";
import { AtlasRoadEditorDock } from "./road-editor-dock.js";

const roadCanvas = new RoadCanvasController();
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
const manualFog = new AtlasManualFogController();
const fogPalette = new AtlasManualFogPalette(manualFog);
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
    onClosed: () => {
      if (roadDock === dock) roadDock = null;
      refresh();
    }
  });
  roadDock = dock;
  void Promise.resolve(dock.render(true)).then(() => {
    if (roadDock === dock && sceneSheet?.rendered) void sceneSheet.minimize?.();
  }).catch(error => {
    if (roadDock === dock) roadDock = null;
    roadCanvas.cancel();
    ui.notifications.error(error.message || String(error));
  });
}

function beginRoadDock(scene, refresh, start) {
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
async function centerAtlasOn(scene, roadId, checkpointId=null) {
  const view=globalThis.canvas;
  if (!view?.ready || view.scene?.id !== scene.id)
    throw Error("Open this Scene on the map first.");
  const atlas=readAtlas(scene);
  const nodes=new Map(atlas.nodes.map(item=>[item.id,item]));
  let points=[];
  if (checkpointId) {
    const checkpoint=atlas.checkpoints?.find(c=>c.id===checkpointId);
    const node=nodes.get(checkpoint?.nodeId);
    if (node) points=[node];
  } else {
    for (const segment of atlas.segments.filter(item=>item.roadId===roadId)) {
      for (const point of [nodes.get(segment.from),...segment.via,nodes.get(segment.to)])
        if (point) points.push(point);
    }
  }
  if (!points.length) throw Error("This map location no longer exists.");
  const converted=points.map(point=>toCanvasPoint(view,atlas,point));
  const x=(Math.min(...converted.map(p=>p.x))+Math.max(...converted.map(p=>p.x)))/2;
  const y=(Math.min(...converted.map(p=>p.y))+Math.max(...converted.map(p=>p.y)))/2;
  fadeSceneSheet(scene);
  roadCanvas.focusOn(scene,checkpointId?"checkpoint":"road",checkpointId??roadId);
  await view.animatePan({x,y,scale:checkpointId ? Math.max(2.2, view.stage?.scale?.x??1) : (view.stage?.scale?.x??1),duration:450});
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
  } finally {
    roadCanvas.clearRegionPreview();
  }
}


/** Native DialogV2 picker shared by road defaults and generated Region overrides. */
async function promptTravelPreset(title, currentId = null) {
  const chooser = document.createElement("select");
  chooser.name = "atlasTravelPresetId";
  const options = [["", "None (no Atlas travel preset)"],
    ...readWorldTravelPresets().presets.map(p => [
      p.id, p.mode.toUpperCase() + " — " + p.name +
        " (" + presetCostSummary(p) + ")"
    ])];
  for (const [id, name] of options) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = name;
    option.defaultSelected = id === (currentId ?? "");
    chooser.appendChild(option);
  }
  chooser.value = currentId ?? "";
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
  const field = (parent,label,control) => {
    const row = document.createElement("label");
    row.className = "form-group";
    const caption = document.createElement("span");
    caption.textContent = label;
    row.append(caption,control);
    parent.appendChild(row);
    return control;
  };
  const name = document.createElement("input");
  name.type = "text";name.name = "draftRoadName";name.maxLength=120;
  name.required = true;name.value=suggestRoadName(atlas);name.defaultValue=name.value;
  field(pages.general,"Road name",name);
  const visible = document.createElement("input");
  visible.type="checkbox";visible.name="draftRoadVisible";visible.value="true";
  field(pages.general,"Show to players",visible);
  const travel = document.createElement("select");
  travel.name = "draftRoadPreset";
  for (const [id,label] of [["","None (Land fallback)"],...presets.map(p=>[p.id,p.name])]) {
    const option=document.createElement("option");option.value=id;option.textContent=label;
    option.defaultSelected=id==="";
    travel.appendChild(option);
  }
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
      window:{title:"Road Settings — New Road",resizable:true},
      position:{width:Math.min(620,window.innerWidth-50),
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
    async begin(scene, refresh) {
      ensureIdle(scene);
      const settings=await promptNewRoadSettings(scene);
      if (!settings) return;
      beginRoadDock(scene, refresh, onChange => roadCanvas.start(scene, onChange, settings));
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.StartNotice"));
    },
    draft: scene => roadCanvas.getDraft(scene),
    async generateRegion(scene, settings, refresh) {
      await previewAndSaveRegion(scene, settings);
      refresh();
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
      const nameRow = document.createElement("label");
      nameRow.className = "form-group";
      const nameLabel = document.createElement("span");
      nameLabel.textContent = "Road name";
      const name = document.createElement("input");
      name.type = "text"; name.name = "atlasRoadName"; name.maxLength = 120;
      name.required = true; name.value = actual.name; name.defaultValue = actual.name;
      nameRow.append(nameLabel, name);
      const visibilityRow = document.createElement("label");
      visibilityRow.className = "form-group";
      const visibilityLabel = document.createElement("span");
      visibilityLabel.textContent = "Show to players";
       visibilityLabel.title = "Only this road. Checkpoint discovery is separate.";
      const visibility = document.createElement("input");
      visibility.type = "checkbox"; visibility.name = "atlasRoadVisible";
      visibility.value = "true"; visibility.checked = actual.playerVisible === true;
      visibility.defaultChecked = visibility.checked;
      visibilityRow.append(visibilityLabel, visibility);
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
      panels.general.append(nameRow,visibilityRow,journalControls);
      const roadTools=document.createElement("fieldset");
      const toolsLegend=document.createElement("legend");toolsLegend.textContent="Road tools";
      roadTools.appendChild(toolsLegend);
      roadTools.style.cssText="display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.6rem;min-width:0;";
      for (const [title,kind] of [["Edit path","edit"],["Add connection","connection"],
        ["Travel preset","travel"],["Delete road","delete"]]) {
        const btn=document.createElement("button");btn.type="button";
        btn.textContent=title;btn.dataset.atlasRoadTool=kind;
        btn.style.cssText="flex:0 0 auto;width:auto;min-width:0;";
        roadTools.appendChild(btn);
      }
      panels.general.appendChild(roadTools);
      panels.style.appendChild(roadAppearanceForm(baseline));
      const addCheckpoint=document.createElement("button");addCheckpoint.type="button";
      addCheckpoint.textContent="+ Add checkpoint";addCheckpoint.dataset.atlasRoadTool="newCheckpoint";
      panels.checkpoints.appendChild(addCheckpoint);
      for (const checkpoint of atlas.checkpoints?.filter(item=>item.roadId===road.id)??[]) {
        const row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin:.3rem 0;";
        const text=document.createElement("span");text.textContent=checkpoint.name;
        text.style.cssText="flex:1 1 auto;min-width:0;overflow-wrap:anywhere;";
        const btn=document.createElement("button");btn.type="button";
        btn.textContent="Settings";btn.dataset.atlasCheckpointEdit=checkpoint.id;
        row.append(text,btn);panels.checkpoints.appendChild(row);
      }
      const addRegion=document.createElement("button");addRegion.type="button";
      addRegion.textContent="+ Generate Region";addRegion.dataset.atlasRoadTool="generateRegion";
      panels.regions.appendChild(addRegion);
      for (const region of scene.regions?.contents??[]) {
        if (region.getFlag?.(MODULE_ID,"roadId")!==road.id &&
            !region.name?.startsWith?.(road.name + " —")) continue;
        const row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin:.3rem 0;";
        const text=document.createElement("span");text.textContent=region.name;
        const btn=document.createElement("button");btn.type="button";
        btn.textContent="Region settings";btn.dataset.atlasRegionEdit=region.id;
        btn.style.cssText="flex:0 0 auto;width:auto;min-width:8rem;white-space:nowrap;";
        row.append(text,btn);panels.regions.appendChild(row);
      }
      const scrollBody=document.createElement("div");
      scrollBody.style.cssText="max-height:"+Math.max(220,Math.min(610,window.innerHeight-235))+"px;overflow-y:auto;min-width:0;min-height:0;padding-right:.5rem;overscroll-behavior:contain;";
      scrollBody.append(tabs,panels.general,panels.style,panels.checkpoints,panels.regions);
      content.appendChild(scrollBody);
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
      const onTabClick = event => {
        const action=event.target?.closest?.("[data-atlas-road-tool],[data-atlas-checkpoint-edit],[data-atlas-region-edit]");
        if (action?.closest?.(".application")?.querySelector?.('input[name="atlasRoadName"]')) {
          event.preventDefault();event.stopImmediatePropagation();
          const tool=action.dataset.atlasRoadTool;
          const api=actions();
          const call=tool==="edit" ? ()=>api.beginPointEdit(scene,road.id,refresh)
            :tool==="connection" ? ()=>api.beginJunction(scene,refresh)
            :tool==="newCheckpoint" ? ()=>api.beginCheckpoint(scene,refresh)
            :tool==="travel" ? ()=>api.assignRoadTravelPreset(scene,road,refresh)
            :tool==="delete" ? ()=>api.remove(scene,road,refresh)
            :tool==="generateRegion" ? ()=>openAtlasRegionGenerator(scene,road.id,api,refresh)
            :action.dataset.atlasCheckpointEdit ? ()=>api.editCheckpointAppearance(
              scene,atlas.checkpoints.find(c=>c.id===action.dataset.atlasCheckpointEdit),refresh)
            :()=>api.configureRegion(scene,action.dataset.atlasRegionEdit);
          void Promise.resolve().then(call).catch(error=>ui.notifications.error(error.message));
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
      document.addEventListener("click",onTabClick,true);
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
      let result;
      try {
        result = await DialogV2.input({
          window: { title: "Road Settings — " + actual.name, resizable: true },
          position: { width: Math.min(560, Math.max(360, window.innerWidth - 60)), height: Math.min(740, Math.max(440, window.innerHeight - 70)) },
          content, ok: { label: "Save Road Settings" },
          rejectClose: false, modal: false
        });
      } finally {
        document.removeEventListener("click",onTabClick,true);
        document.removeEventListener("input",onRangeInput,true);
        document.removeEventListener("dragover", onJournalDragOver, true);
        document.removeEventListener("drop", onJournalDrop, true);
      }
      if (!result) return;
      if (!Object.hasOwn(result,"atlasJournalUuid"))
        throw Error("Foundry did not return the Journal UUID field. No Road Settings were saved.");
      const nextJournal=journalUuidFromForm(result.atlasJournalUuid);
      if(nextJournal&&!validJournalUuid(nextJournal))
        throw Error("Choose a valid Journal Entry or Journal Page UUID.");
      const selected = roadAppearanceFromForm(result);
      const inherits = actual.appearance == null &&
        Object.keys(selected).every(key => selected[key] === baseline[key]);
      await saveRoadPresentation(scene, {
        roadId: road.id, name: String(result.atlasRoadName ?? ""),
        playerVisible: result.atlasRoadVisible === true ||
          result.atlasRoadVisible === "true" || result.atlasRoadVisible === "on",
        appearance: inherits ? null : selected, expectedRevision: atlas.revision
      });
      if(nextJournal!==journalUuidFor(journalLinks,"road",road.id)) {
        await saveAtlasJournalLink(scene,{
          kind:"road",id:road.id,uuid:nextJournal,expected:journalLinks
        });
      }
      roadCanvas.refresh();
      refresh();
      ui.notifications.info("Atlas road settings saved.");
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
        const content = document.createElement("div");
        const description = document.createElement("p");
        description.textContent = "Legacy preset: choose one native movement action for " +
          preset.name + " (" + presetCostSummary(preset) + ").";
        const select = document.createElement("select");
        select.name = "atlasMovementAction";
        const placeholder = document.createElement("option");
        placeholder.value = ""; placeholder.textContent = "Choose movement action…";
        placeholder.defaultSelected = true;
        select.appendChild(placeholder);
        for (const available of registered) {
          const option = document.createElement("option");
          option.value = available.id;
          option.textContent = game.i18n.localize(available.label) || available.label;
          select.appendChild(option);
        }
        content.append(description, select);
        const choice = await DialogV2.input({
          window: { title: "Apply native movement cost — " + entry.name },
          content, ok: { label: "Review Cost" }, rejectClose: false, modal: true
        });
        if (!choice) return;
        action = registered.find(available => available.id === choice.atlasMovementAction);
        if (!action) throw new Error("Choose a valid movement action before applying.");
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
        const content = document.createElement("div");
        const description = document.createElement("p");
        description.textContent = "Legacy preset: choose one supported movement action for " +
          preset.name + " (" + presetCostSummary(preset) + ").";
        const select = document.createElement("select");
        select.name = "atlasMovementAction";
        const placeholder = document.createElement("option");
        placeholder.value = ""; placeholder.textContent = "Choose movement action…";
        placeholder.defaultSelected = true;
        select.appendChild(placeholder);
        for (const available of availableMovementActions()) {
          const option = document.createElement("option");
          option.value = available.id;
          option.textContent = game.i18n.localize(available.label) || available.label;
          select.appendChild(option);
        }
        content.append(description, select);
        const choice = await DialogV2.input({
          window: { title: "Refresh native movement cost — " + entry.name },
          content, ok: { label: "Review Cost" }, rejectClose: false, modal: true
        });
        if (!choice) return;
        action = availableMovementActions().find(item =>
          item.id === choice.atlasMovementAction);
        if (!action) throw new Error("Choose a supported native movement action.");
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
      roadCanvas.startCheckpoint(scene, () => {
        syncRoadDock(scene,refresh);
        const id=roadCanvas.selectedCheckpointId;
        const checkpoint=readAtlas(scene).checkpoints?.find(item=>item.id===id);
        if (checkpoint) { roadCanvas.refresh(); refresh(); }
      });
      openRoadDock(scene,refresh);
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Checkpoints.StartNotice"));
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
      await saveRoadPlayerVisibility(scene, {
        roadId: road.id, visible: actual.playerVisible !== true,
        expectedRevision: atlas.revision
      });
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
        onSaved: () => { roadCanvas.refresh(); refresh(); }
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
      ensureIdle(scene);
      const atlas = readAtlas(scene);
      const current = atlas.checkpoints?.find(c => c.id === checkpoint.id);
      if (!current) throw new Error("Checkpoint no longer exists.");
      const content = document.createElement("div");
      const text = document.createElement("p");
      text.textContent = game.i18n.format("FVTTATLAS.Checkpoints.DeleteWarning", {
        name: current.name
      });
      content.appendChild(text);
      const approved = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Checkpoints.Delete") },
        content, rejectClose: false, modal: true
      });
      if (!approved) return;
      await saveRemovedCheckpoint(scene, {
        checkpointId: current.id, expectedRevision: atlas.revision
      });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Checkpoints.Removed"));
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
        const select = document.createElement("select");
        select.name = "mergeRoadId";
        for (const candidate of options) {
          const item = document.createElement("option");
          item.value = candidate.id;
          item.textContent = candidate.name;
          select.appendChild(item);
        }
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
      const select = document.createElement("select");
      select.name = "atlasRegionId";
      select.setAttribute("aria-label", game.i18n.localize("FVTTATLAS.Regions.Choose"));
      for (const region of choices) {
        const option = document.createElement("option");
        option.value = region.id;
        option.textContent = region.name;
        select.appendChild(option);
      }
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
    configureRegion(scene, regionId) {
      if (!game.user?.isGM || !scene.canUserModify(game.user, "update")) {
        throw new Error("Only a GM can configure Atlas Regions.");
      }
      const region = scene.regions?.get(regionId);
      if (!region || region.parent?.id !== scene.id ||
          !region.canUserModify(game.user, "update")) {
        throw new Error(game.i18n.localize("FVTTATLAS.Regions.Missing"));
      }
      return new foundry.applications.sheets.RegionConfig({ document: region })
        .render({ force: true });
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
      const revision = readAtlas(scene).revision;
      const confirmed = await DialogV2.confirm({
        window: { title: game.i18n.localize("FVTTATLAS.Roads.Delete") },
        content: "Delete this road and its road-specific settings? This cannot be undone.",
        rejectClose: false,
        modal: true
      });
      if (!confirmed) return;
      await saveRemovedRoad(scene, { roadId: road.id, segmentId: road.id, expectedRevision: revision });
      roadCanvas.refresh();
      refresh();
      ui.notifications.info(game.i18n.localize("FVTTATLAS.Roads.Deleted"));
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
  game.settings.register(MODULE_ID, "hiddenOverlayHatching", {
    name: "GM Hidden-Item Hatching",
    hint: "Draw subtle burgundy diagonal hatching over GM-visible roads and checkpoints that players have not discovered. Never shown to players.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => roadCanvas.refresh()
  });
  game.settings.register(MODULE_ID, "elevationUnits", {
    name: "Atlas Elevation Units",
    hint: "Choose how checkpoint elevations appear while editing. Stored elevations remain in meters.",
    scope: "world", config: true, type: String, choices: { metric: "Meters (metric)", imperial: "Feet (imperial)" },
    default: "metric"
  });
  registerManualBrushSettings();
  registerWorldTravelPresets();
  registerWorldRoadAppearance(() => roadCanvas.refresh());
  const roadActions = actions();
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
  });
  Hooks.on("getSceneControlButtons", controls => {
    if(!game.user?.isGM)return;
    controls.atlasManualFog={
      name:"atlasManualFog",title:"Atlas Exploration",
      icon:"fa-solid fa-map",order:Object.keys(controls).length,
      visible:true,
      onChange:(_event,active)=>{if(active)fogPalette.show();},
      tools:{
        atlasAddRoad:{
          name:"atlasAddRoad",title:"Draw Atlas Road",
          icon:"fa-solid fa-route",order:0,button:true,visible:true,
          onChange:()=>{
            const scene=canvas?.scene;
            if (!scene) return ui.notifications.warn("Open a Scene first.");
            try { roadActions.begin(scene,()=>refreshAtlasSceneConfig(scene)); }
            catch(error) { ui.notifications.error(error.message); }
          }
        },
        atlasBrushPalette:{
          name:"atlasBrushPalette",title:"Open Atlas Exploration Brushes",
          icon:"fa-solid fa-paintbrush",order:1,button:true,visible:true,
          onChange:()=>fogPalette.toggle()
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
  Hooks.on("renderSceneConfig", (app, element) => {
    addAtlasRoadsToSceneConfig(app, element, roadActions);
  });
  Hooks.on("closeSceneConfig", app => {
    if (roadDock?.sceneSheet === app) {
      roadDock.finished = true;
      void roadDock.close();
    }
    roadCanvas.endEditor(app?.document);
    forgetAtlasSceneConfig(app);
  });
  Hooks.on("canvasReady", () => { roadCanvas.refresh(); manualFog.refresh(); });
  // Foundry v14 movement includes origin, passed waypoints and destination.
  Hooks.on("moveToken", observeAtlasTokenMovement);
  Hooks.on("canvasTearDown", () => {
    if (roadDock) {
      roadDock.finished = true;
      void roadDock.close();
    }
    fogPalette.close();
    roadCanvas.tearDown();
    manualFog.tearDown();
  });
  Hooks.on("canvasPan", view => roadCanvas.onCanvasPan(view));
  Hooks.on("sightRefresh", () => roadCanvas.onFogRefresh());
  Hooks.on("updateFogExploration", () => roadCanvas.onFogRefresh());
  Hooks.on("deleteFogExploration", () => roadCanvas.onFogRefresh());
  Hooks.on("updateScene", scene => {
    if (globalThis.canvas?.ready && canvas.scene?.id === scene.id) {
      roadCanvas.refresh();manualFog.refresh();
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
