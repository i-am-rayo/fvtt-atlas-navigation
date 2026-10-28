import { readAtlas } from "./atlas-storage.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import { readManualFog } from "./atlas-manual-fog-storage.js";
import { readAtlasJournalLinks, journalUuidFor, openAtlasJournal, canOpenAtlasJournal }
  from "./atlas-journal-links.js";
import { checkpointKnowledge } from "./party-exploration-model.js";
import { readSceneGridScale } from "./scene-grid.js";
import { getRoadMergeCandidates, listRoadJunctions } from "./road-model.js";
import { listSceneRegions } from "./region-atlas.js";
import { listRoadCheckpoints } from "./checkpoint-model.js";
import { listGeneratedRegions } from "./generated-region.js";
import { readWorldTravelPresets } from "./travel-preset-settings.js";
import { presetCostSummary } from "./travel-preset-model.js";
import { readWorldRoadAppearance, resolveRoadAppearance, roadAppearanceMode }
  from "./road-appearance.js";
import { availableMovementActions, unavailableMovementActions,
  previewNativeMovementCost, nativeCostPresetStatus,
  editableManagedNativeCost } from "./native-movement-cost.js";

const TAB_ID = "atlas";
const ROOT_SELECTOR = "[data-fvtt-atlas-scene-root]";
const junctionFilters = new Map();
const generatorState = new Map();
const roadSearch = new Map();

/** Shared display scope; filtering never edits Scene graph or native Regions. */
export function filteredRoadIds(atlas, state) {
  const ids = new Set(atlas.roads?.map(r => r.id) ?? []);
  if (state.scope === "scene") return ids;
  const allowed = new Set(ids.has(state.roadId) ? [state.roadId] : []);
  if (state.scope === "connected") {
    const nodes = new Set(atlas.segments.filter(s => s.roadId === state.roadId)
      .flatMap(s => [s.from, s.to]));
    for (const segment of atlas.segments) {
      if (nodes.has(segment.from) || nodes.has(segment.to)) allowed.add(segment.roadId);
    }
  }
  return allowed;
}

function sharedRoadFilters(atlas, state, refresh) {
  const filters = node("div", undefined, "form-fields");
  const select = (choices, current, title, onChange) => {
    const field = node("select");
    field.setAttribute("aria-label", title);
    field.title = title;
    for (const [value, caption] of choices) {
      const option = node("option", caption);
      option.value = value;
      field.appendChild(option);
    }
    field.value = current;
    field.addEventListener("change", () => { onChange(field.value); refresh(); });
    return field;
  };
  filters.appendChild(select(atlas.roads.map(r => [r.id, r.name]),
    state.roadId, "Atlas displayed road", value => { state.roadId = value; }));
  filters.appendChild(select([
    ["selected", label("FVTTATLAS.Junctions.Selected")],
    ["connected", label("FVTTATLAS.Junctions.Connected")],
    ["scene", label("FVTTATLAS.Junctions.All")]
  ], state.scope, "Atlas display scope", value => { state.scope = value; }));
  return filters;
}

function junctionFilterFor(scene, atlas) {
  let state = junctionFilters.get(scene.id);
  if (!state || !atlas.roads?.some(road => road.id === state.roadId)) {
    state = { roadId: atlas.roads?.[0]?.id ?? null, scope: "selected" };
    junctionFilters.set(scene.id, state);
  }
  return state;
}

/**
 * Extend Foundry v14's documented public TABS/PARTS configuration.
 * Do this once, before Scene Configuration is first rendered.
 * Do not override private SceneConfig handlers or core templates.
 */
export function registerAtlasSceneTab(SceneConfig) {
  const group = SceneConfig?.TABS?.sheet;
  const parts = SceneConfig?.PARTS;
  if (!group || !Array.isArray(group.tabs) || !parts) return false;
  if (group.tabs.some(tab => tab.id === TAB_ID)) return true;

  const tabs = [...group.tabs];
  const after = tabs.findIndex(tab => tab.id === "levels");
  tabs.splice(after < 0 ? tabs.length : after + 1, 0, {
    id: TAB_ID,
    icon: "fa-solid fa-route",
    label: "FVTTATLAS.Atlas.Tab"
  });

  const entries = Object.entries(parts);
  const footerIndex = entries.findIndex(([key]) => key === "footer");
  entries.splice(footerIndex < 0 ? entries.length : footerIndex, 0, [
    TAB_ID,
    {
      template: "modules/fvtt-atlas-navigation/templates/scene-atlas-tab.hbs",
      scrollable: [".scrollable"]
    }
  ]);

  SceneConfig.PARTS = Object.fromEntries(entries);
  SceneConfig.TABS = { ...SceneConfig.TABS, sheet: { ...group, tabs } };
  return true;
}


const label = key => game.i18n.localize(key);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};

function button(text, title, onClick) {
  const element = node("button", text);
  element.type = "button";
  element.title = title;
  element.setAttribute("aria-label", title);
  element.addEventListener("click", async event => {
    event.preventDefault();
    try { await onClick(); }
    catch (error) { ui.notifications.error(error.message); }
  });
  return element;
}

function format(value) {
  return Number(value.toPrecision(7)).toLocaleString(game.i18n.lang || "en");
}

function atlasPanel(scene, atlas, actions, refresh) {
  const root = node("section");
  root.setAttribute("data-fvtt-atlas-setup", "");
  const travelPresets = readWorldTravelPresets().presets;
  const presetById = new Map(travelPresets.map(p => [p.id, p]));
  const worldRoadAppearance = readWorldRoadAppearance();
  const journalLinks = readAtlasJournalLinks(scene);
  function linkedJournalIndicator(uuid) {
    const badge=node("span","📖","hint");
    badge.style.cssText="float:right;margin-left:.5rem;white-space:nowrap;font-size:.85em;";
    badge.title="Journal linked — checking player access";
    const players=[...(game.users??[])].filter(user=>!user.isGM);
    if(!players.length) { badge.textContent="📖 —"; badge.title="Journal linked; no player users configured"; return badge; }
    void Promise.all(players.map(user=>canOpenAtlasJournal(uuid,user))).then(access=>{
      if(!badge.isConnected)return;
      const count=access.filter(Boolean).length;
      badge.textContent=count===players.length?"📖 ✓":count?"📖 ◐":"📖 🔒";
      badge.title=count===players.length ? "All players have Observer access" :
        count ? count+" of "+players.length+" players have Observer access" :
        "Journal linked; players cannot view it";
    }).catch(()=>{badge.textContent="📖 ?";badge.title="Player access could not be checked";});
    return badge;
  }
  const sharedFilter = atlas.schemaVersion >= 3 && atlas.roads?.length
    ? junctionFilterFor(scene, atlas) : null;
  const shownRoads = sharedFilter ? filteredRoadIds(atlas, sharedFilter) : new Set();

  // A configured road network is what makes this Scene an Atlas. The old
  // enabled flag remains persisted for v1 compatibility, but has no UI toggle.
  const active = atlas.segments.length > 0;
  root.appendChild(node("h3", label("FVTTATLAS.Atlas.Tab")));
  if (!active) root.appendChild(node("p", "Add a road to begin.", "hint"));

  const legacy = atlas.schemaVersion === 1 && (atlas.nodes.length || atlas.segments.length);
  if (legacy) {
    const migration = node("fieldset");
    migration.appendChild(node("legend", label("FVTTATLAS.Roads.LegacyTitle")));
    migration.appendChild(node("p", label("FVTTATLAS.Roads.LegacyHint"), "hint"));
    migration.appendChild(button(label("FVTTATLAS.Roads.Anchor"),
      label("FVTTATLAS.Roads.Anchor"), () => actions.anchor(scene, refresh)));
    root.appendChild(migration);
  }

  const needsOrganize = atlas.schemaVersion === 2 && (atlas.nodes.length || atlas.segments.length);
  if (needsOrganize) {
    const migration = node("fieldset");
    migration.appendChild(node("legend", label("FVTTATLAS.Roads.Organize")));
    migration.appendChild(node("p", label("FVTTATLAS.Roads.OrganizeHint"), "hint"));
    migration.appendChild(button(label("FVTTATLAS.Roads.Organize"),
      label("FVTTATLAS.Roads.Organize"), () => actions.organize(scene, refresh)));
    root.appendChild(migration);
  }

  const section = node("fieldset");
  const header = node("legend");
  const titleGroup = node("span");
  titleGroup.style.display = "inline-flex";
  titleGroup.style.alignItems = "center";
  titleGroup.style.gap = "0.35rem";
  titleGroup.appendChild(node("span", label("FVTTATLAS.Roads.Title")));

  if (!legacy && !needsOrganize) {
    const add = button("+", label("FVTTATLAS.Roads.Add"), () => actions.begin(scene, refresh));
    add.style.flex = "0 0 auto";
    add.style.width = "1.65rem";
    add.style.minWidth = "1.65rem";
    add.style.padding = "0";
    titleGroup.appendChild(add);
  }
  header.appendChild(titleGroup);
  section.appendChild(header);

  const draft = actions.draft(scene);
  if (draft && !["junction", "checkpoint"].includes(draft.mode) && draft.source !== "junction") {
    section.appendChild(node("p", draft.mode === "points" ?
      label("FVTTATLAS.Roads.PointEditHint") : (label("FVTTATLAS.Roads.Drawing") + " " +
      draft.points + " " + label("FVTTATLAS.Roads.Points")), "hint"));
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button(label(draft.mode === "points" ?
      "FVTTATLAS.Roads.SavePoints" : "FVTTATLAS.Roads.Finish"),
      label("FVTTATLAS.Roads.Finish"), () => actions.finish()));
    if (draft.mode === "points" && draft.canUndo) {
      controls.appendChild(button(label("FVTTATLAS.Roads.Undo"),
        label("FVTTATLAS.Roads.Undo"), () => actions.undo()));
    }
    const cancelKey = draft.mode === "points"
      ? "FVTTATLAS.Roads.CancelEdits" : "FVTTATLAS.Roads.Cancel";
    controls.appendChild(button(label(cancelKey), label(cancelKey), () => actions.cancel()));
    section.appendChild(controls);
  }

  if (!atlas.segments.length) {
    section.appendChild(node("p", label("FVTTATLAS.Roads.NoRoads"), "hint"));
  }

  const roads = atlas.schemaVersion >= 3 ? atlas.roads : atlas.segments;
  const search = node("input");
  search.type = "search";
  search.placeholder = "Find a road…";
  search.setAttribute("aria-label", "Find a road");
  search.style.cssText = "width:100%;min-height:2rem;margin:.4rem 0 .6rem;";
  search.value = roadSearch.get(scene.id) ?? "";
  const roadList = node("div");
  roadList.style.cssText = "display:grid;gap:.35rem;";
  function updateRoadSearch() {
    roadSearch.set(scene.id, search.value);
    for (const row of roadList.children)
      row.hidden = !row.dataset.atlasSearch?.includes(search.value.trim().toLocaleLowerCase());
  }
  search.addEventListener("input", updateRoadSearch);
  section.appendChild(search);
  section.appendChild(roadList);

  async function openRoadDetails(road) {
    // DialogV2 serializes and clones HTMLElement content; use delegated actions
    // because listeners registered on pre-render controls would be lost.
    const content = node("div");
    const body = node("div");
    content.appendChild(body);
    const commands = new Map();
    let sequence = 0;
    function actionButton(caption, title, action) {
      const control = node("button", caption);
      control.type = "button";
      control.title = title;
      control.setAttribute("aria-label", title);
      const key = road.id + ":" + (++sequence);
      control.dataset.atlasRoadDetailAction = key;
      commands.set(key,action);
      return control;
    }
    body.style.cssText = "display:grid;gap:.75rem;min-width:0;max-width:100%;";
    const heading = node("h3", road.name || "Road");
    heading.style.margin = "0";
    body.appendChild(heading);
    const status = node("p", road.playerVisible === true ? "● Visible to players" : "◌ Hidden from players", "hint");
    status.style.margin = "0";
    body.appendChild(status);
    function group(name, items) {
      const panel = node("fieldset");
      panel.style.cssText = "min-width:0;margin:0;padding:.65rem .8rem;";
      panel.appendChild(node("legend", name));
      const controls = node("div");
      controls.style.cssText = "display:flex;flex-wrap:wrap;gap:.4rem;";
      for (const [caption, title, action] of items)
        controls.appendChild(actionButton(caption,title,action));
      panel.appendChild(controls);
      body.appendChild(panel);
      return panel;
    }
    group("Road", [
      ["Appearance", "Color, line, name and linked journal", () => actions.editRoadAppearance(scene,road,refresh)],
      [road.playerVisible === true ? "Hide" : "Show", "Toggle player visibility",
        () => actions.toggleRoadPlayerVisibility(scene,road,refresh)],
      ["Rename", "Rename road", () => actions.rename(scene,road,refresh)],
      ["Find on map", "Highlight road", () => actions.select(scene,road.id)]
    ]);
    const editing = [
      ["Edit path", "Move road points", () => actions.beginPointEdit(scene,road.id,refresh)],
      ["Add connection", "Connect roads on the map", () => actions.beginJunction(scene,refresh)],
      ["Add checkpoint", "Place a checkpoint on this road", () => actions.beginCheckpoint(scene,refresh)]
    ];
    if (getRoadMergeCandidates(atlas,road.id).length)
      editing.push(["Merge", "Merge connected roads", () => actions.merge(scene,road,refresh)]);
    group("Map tools", editing);
    const linked = journalUuidFor(journalLinks,"road",road.id);
    const journalActions = [["Link / change", "Set a journal in Road Appearance",
      () => actions.editRoadAppearance(scene,road,refresh)]];
    if (linked) journalActions.push(["Open journal", "Open linked journal",
      () => openAtlasJournal(linked)]);
    group("Journal", journalActions);
    const checkpoints = (atlas.checkpoints ?? []).filter(item => item.roadId === road.id);
    const checkpointGroup = group("Checkpoints (" + checkpoints.length + ")",
      checkpoints.map(item => [item.name || "Checkpoint", "Edit checkpoint",
        () => actions.editCheckpoint(scene,item,refresh)]));
    if (!checkpoints.length) checkpointGroup.appendChild(node("p", "None yet.", "hint"));
    const connected = listRoadJunctions(atlas).filter(item => item.roadIds.includes(road.id));
    const connections = group("Connections (" + connected.length + ")", [
      ["Add connection", "Choose connection points on the map",
        () => actions.beginJunction(scene,refresh)]
    ]);
    if (connected.length) connections.appendChild(node("p", "Edit connections directly on the map.", "hint"));
    const preset = presetById.get(road.travelPresetId);
    const terrain = group("Terrain", [
      ["Travel type" + (preset ? ": " + preset.name : ""), "Choose this road's default terrain",
        () => actions.assignRoadTravelPreset(scene,road,refresh)]
    ]);
    terrain.appendChild(node("p", "Region tools are under More tools in the Atlas tab.", "hint"));
    const danger = group("Remove", [["Delete road", "Delete this road (confirmation required)",
      () => actions.remove(scene,road,refresh)]]);
    danger.style.borderColor = "var(--color-border-light-tertiary, #765)";
    const onAction = event => {
      const control = event.target?.closest?.("[data-atlas-road-detail-action]");
      const key = control?.dataset.atlasRoadDetailAction;
      if (!key || !commands.has(key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      Promise.resolve().then(() => commands.get(key)())
        .catch(error => ui.notifications.error(error.message || String(error)));
    };
    document.addEventListener("click",onAction,true);
    try {
      await foundry.applications.api.DialogV2.input({
        window: { title: "Road — " + (road.name || "Unnamed"), resizable: true },
        content, modal: false,
        ok: { label: "Close" }, rejectClose: false
      });
    } finally {
      document.removeEventListener("click",onAction,true);
    }
  }

  for (const [index, road] of roads.entries()) {
    const row = node("div");
    row.setAttribute("data-atlas-road-id",road.id);
    row.dataset.atlasSearch = (road.name || "").toLocaleLowerCase();
    row.style.cssText = "display:flex;align-items:center;gap:.65rem;min-height:2.5rem;padding:.3rem .45rem;border:1px solid var(--color-border-light-tertiary, #665);border-radius:5px;";
    const appearance = atlas.schemaVersion >= 3 ?
      resolveRoadAppearance(road,worldRoadAppearance,roadAppearanceMode(road,travelPresets)) : null;
    const dot = node("span","●");
    dot.style.color = appearance?.color || "#aaa";
    dot.setAttribute("aria-hidden","true");
    row.appendChild(dot);
    const name = node("span",road.name || "Road " + (index+1));
    name.style.cssText = "flex:1;min-width:0;overflow-wrap:anywhere;";
    row.appendChild(name);
    if (journalUuidFor(journalLinks,"road",road.id))
      row.appendChild(linkedJournalIndicator(journalUuidFor(journalLinks,"road",road.id)));
    const visible = node("span",road.playerVisible === true ? "👁" : "◌");
    visible.title = road.playerVisible === true ? "Visible to players" : "Hidden from players";
    visible.setAttribute("aria-label",visible.title);
    row.appendChild(visible);
    const open = button("›","Open " + (road.name || "road") + " settings",
      () => openRoadDetails(road));
    open.style.cssText = "flex:0 0 2.25rem;min-width:2.25rem;padding:0;font-size:1.3em;";
    row.appendChild(open);
    roadList.appendChild(row);
  }
  updateRoadSearch();
  root.appendChild(section);

  // A graph endpoint or degree-2 subdivision is not a routing junction.
  // Retain every stored node, including old migrations; filter only the UI.
  const junctionSection = node("fieldset");
  const junctionLegend = node("legend");
  const junctionHeader = node("span");
  junctionHeader.style.display = "inline-flex";
  junctionHeader.style.alignItems = "center";
  junctionHeader.style.gap = "0.35rem";
  junctionHeader.appendChild(node("span", label("FVTTATLAS.Junctions.Title")));
  const addJunction = button("+", label("FVTTATLAS.Junctions.Add"),
    () => actions.beginJunction(scene, refresh));
  addJunction.style.flex = "0 0 auto";
  addJunction.style.width = "1.65rem";
  addJunction.style.minWidth = "1.65rem";
  addJunction.style.padding = "0";
  addJunction.disabled = atlas.schemaVersion < 3 || !atlas.segments.length || !!draft;
  junctionHeader.appendChild(addJunction);
  junctionLegend.appendChild(junctionHeader);
  junctionSection.appendChild(junctionLegend);
  junctionSection.appendChild(node("p", label("FVTTATLAS.Junctions.Hint"), "hint"));

  if (draft?.mode === "junction") {
    junctionSection.appendChild(node("p", label("FVTTATLAS.Junctions.Picking"), "hint"));
    junctionSection.appendChild(button(label("FVTTATLAS.Roads.Cancel"),
      label("FVTTATLAS.Roads.Cancel"), () => actions.cancel()));
  } else if (draft?.mode === "points" && draft.source === "junction") {
    junctionSection.appendChild(node("p", label("FVTTATLAS.Junctions.Editing"), "hint"));
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button(label("FVTTATLAS.Roads.SavePoints"),
      label("FVTTATLAS.Roads.SavePoints"), () => actions.finish()));
    if (draft.canUndo) {
      controls.appendChild(button(label("FVTTATLAS.Roads.Undo"),
        label("FVTTATLAS.Roads.Undo"), () => actions.undo()));
    }
    controls.appendChild(button(label("FVTTATLAS.Roads.CancelEdits"),
      label("FVTTATLAS.Roads.CancelEdits"), () => actions.cancel()));
    junctionSection.appendChild(controls);
  }

  if (atlas.schemaVersion >= 3 && atlas.roads.length) {
    const state = junctionFilterFor(scene, atlas);
    const filters = node("div", undefined, "form-fields");
    const select = (options, value, title, onChange) => {
      const element = node("select");
      element.setAttribute("aria-label", label(title));
      element.title = label(title);
      for (const [id, name] of options) {
        const option = node("option", name);
        option.value = id;
        element.appendChild(option);
      }
      element.value = value;
      element.addEventListener("change", () => onChange(element.value));
      return element;
    };
    const byRoad = select(atlas.roads.map(r => [r.id, r.name]), state.roadId,
      "FVTTATLAS.Junctions.RoadFilter", value => {
        state.roadId = value;
        refresh();
      });
    byRoad.style.maxWidth = "15rem";
    filters.appendChild(byRoad);
    const byScope = select([
      ["selected", label("FVTTATLAS.Junctions.Selected")],
      ["connected", label("FVTTATLAS.Junctions.Connected")],
      ["scene", label("FVTTATLAS.Junctions.All")]
    ], state.scope, "FVTTATLAS.Junctions.ScopeFilter", value => {
      state.scope = value;
      refresh();
    });
    filters.appendChild(byScope);
    junctionSection.appendChild(filters);
    const all = listRoadJunctions(atlas);
    const filtered = listRoadJunctions(atlas, state);
    junctionSection.appendChild(node("p",
      filtered.length + " / " + all.length + " " +
      label("FVTTATLAS.Junctions.Count"), "hint"));
    const visible = filtered.slice(-25).reverse();
    const roadNames = new Map(atlas.roads.map(r => [r.id, r.name]));
    for (const item of visible) {
      const row = node("div", undefined, "form-group");
      row.setAttribute("data-atlas-junction-id", item.id);
      const description = node("div");
      description.style.flex = "1 1 auto";
      description.style.minWidth = "0";
      description.appendChild(node("span",
        label("FVTTATLAS.Junctions.Junction") + " · " + item.id.slice(-6)));
      const owners = node("div",
        item.roadIds.map(id => roadNames.get(id) || id).join(", "), "hint");
      owners.style.fontSize = "0.8em";
      description.appendChild(owners);
      row.appendChild(description);
      const controls = node("div", undefined, "form-fields");
      controls.appendChild(button("◎", label("FVTTATLAS.Junctions.Highlight"),
        () => actions.selectJunction(scene, item.id)));
      row.appendChild(controls);
      junctionSection.appendChild(row);
    }
    if (!filtered.length) {
      junctionSection.appendChild(node("p", label("FVTTATLAS.Junctions.None"), "hint"));
    } else if (filtered.length > visible.length) {
      junctionSection.appendChild(node("p",
        label("FVTTATLAS.Junctions.Recent") + " " + visible.length +
        " / " + filtered.length, "hint"));
    }
  }
  // Connections remain editable on the map and from each Road detail window.
  // Raw internal junction IDs are intentionally omitted from the everyday UI.

  const party = readPartyExploration(scene);
  // Manual fog v0.2.26: Scene-owned state; token automation is intentionally disabled.
  const state = readManualFog(scene);
  const fogPanel = node("fieldset");
  fogPanel.appendChild(node("legend", "Exploration"));
  const checkbox = node("input");
  checkbox.type = "checkbox";
  checkbox.checked = state.enabled;
  const enabledLabel = node("label", " Manual exploration");
  enabledLabel.prepend(checkbox);
  fogPanel.appendChild(enabledLabel);
  const unsupported = scene.grid?.type === (globalThis.CONST?.GRID_TYPES?.GRIDLESS ?? 0);
  if (unsupported) {
    checkbox.disabled = !state.enabled;
    fogPanel.appendChild(node("p","Gridless Scenes are unsupported.", "hint"));
  }
  checkbox.title = "Use Atlas exploration on this Scene";
  checkbox.addEventListener("change",async()=>{
    const desired=checkbox.checked;
    checkbox.disabled=true;
    try {await actions.saveManualFog(scene,desired,refresh);}
    catch(error){
      checkbox.checked=!desired;
      checkbox.disabled=false;
      ui.notifications.error(error.message??String(error));
    }
  });
  const brush = button("Paint map", "Open Atlas brushes",
    () => actions.openManualBrushPalette());
  brush.style.marginLeft = ".6rem";
  fogPanel.appendChild(brush);
  const count = node("small", `${state.revealed.length} revealed · ${state.hidden.length} hidden`, "hint");
  count.style.cssText = "display:block;margin-top:.3rem;";
  fogPanel.appendChild(count);
  root.insertBefore(fogPanel, section);

  const advanced = node("details");
  advanced.style.marginTop = ".7rem";
  const advancedSummary = node("summary", "More tools · Checkpoints & Terrain");
  advancedSummary.style.cssText = "cursor:pointer;font-weight:600;padding:.6rem;";
  advanced.appendChild(advancedSummary);

  // v0.2.13: semantic checkpoints are optional records attached to stable
  // road graph points. They are not bend handles or routing junction listings.
  const checkpointSection = node("fieldset");
  const checkpointLegend = node("legend");
  const checkpointHeader = node("span");
  checkpointHeader.style.display = "inline-flex";
  checkpointHeader.style.alignItems = "center";
  checkpointHeader.style.gap = "0.35rem";
  checkpointHeader.appendChild(node("span", label("FVTTATLAS.Checkpoints.Title")));
  const addCheckpoint = button("+", label("FVTTATLAS.Checkpoints.Add"),
    () => actions.beginCheckpoint(scene, roadId => {
      if (roadId && atlas.roads.some(r => r.id === roadId)) {
        const state = junctionFilterFor(scene, readAtlas(scene));
        state.roadId = roadId;
        state.scope = "selected";
      }
      refresh();
    }));
  addCheckpoint.style.flex = "0 0 auto";
  addCheckpoint.style.width = "1.65rem";
  addCheckpoint.style.minWidth = "1.65rem";
  addCheckpoint.style.padding = "0";
  addCheckpoint.disabled = atlas.schemaVersion < 3 || !atlas.segments.length || !!draft;
  checkpointHeader.appendChild(addCheckpoint);
  checkpointLegend.appendChild(checkpointHeader);
  checkpointSection.appendChild(checkpointLegend);
  checkpointSection.appendChild(node("p", label("FVTTATLAS.Checkpoints.Hint"), "hint"));
  if (draft?.mode === "checkpoint") {
    checkpointSection.appendChild(node("p", label("FVTTATLAS.Checkpoints.Picking"), "hint"));
    checkpointSection.appendChild(button(label("FVTTATLAS.Roads.Cancel"),
      label("FVTTATLAS.Roads.Cancel"), () => actions.cancel()));
  }

  if (atlas.schemaVersion >= 3 && atlas.roads.length) {
    const state = junctionFilterFor(scene, atlas);
    const select = (options, value, title, changed) => {
      const element = node("select");
      element.setAttribute("aria-label", label(title));
      for (const [id, name] of options) {
        const option = node("option", name);
        option.value = id;
        element.appendChild(option);
      }
      element.value = value;
      element.addEventListener("change", () => changed(element.value));
      return element;
    };
    const filters = node("div", undefined, "form-fields");
    filters.appendChild(select(atlas.roads.map(r => [r.id, r.name]), state.roadId,
      "FVTTATLAS.Checkpoints.RoadFilter", value => {
        state.roadId = value;
        refresh();
      }));
    filters.appendChild(select([
      ["selected", label("FVTTATLAS.Junctions.Selected")],
      ["connected", label("FVTTATLAS.Junctions.Connected")],
      ["scene", label("FVTTATLAS.Junctions.All")]
    ], state.scope, "FVTTATLAS.Checkpoints.ScopeFilter", value => {
      state.scope = value;
      refresh();
    }));
    checkpointSection.appendChild(filters);
    const total = listRoadCheckpoints(atlas);
    const matching = listRoadCheckpoints(atlas, state);
    checkpointSection.appendChild(node("p",
      matching.length + " / " + total.length + " " +
      label("FVTTATLAS.Checkpoints.Count"), "hint"));
    const visible = matching.slice(-25).reverse();
    for (const checkpoint of visible) {
      const row = node("div", undefined, "form-group");
      row.setAttribute("data-atlas-checkpoint-id", checkpoint.id);
      const description = node("div");
      description.style.flex = "1 1 auto";
      description.style.minWidth = "0";
      description.appendChild(node("span", checkpoint.name));
      const meters = checkpoint.elevationMeters === null
        ? label("FVTTATLAS.Checkpoints.Unknown")
        : format(checkpoint.elevationMeters) + " m";
      description.appendChild(node("div", checkpoint.roadName + " · " + meters, "hint"));
      const visibility = node("div", party.enabled
        ? "Discovery: " + ({ lore: "Known through Lore",
          visited: "Seen / Visited", unknown: "Undiscovered" }[
          checkpointKnowledge(party, checkpoint.id)] ?? "Undiscovered")
        : checkpoint.playerVisible === true
          ? "Checkpoint visible to players" : "Checkpoint hidden from players", "hint");
      visibility.style.fontSize = "0.8em";
      description.appendChild(visibility);
      if (checkpoint.appearance) {
        const a = checkpoint.appearance;
        const detail = node("div",
          "Checkpoint overlay: " + (a.type === "fa" ? "FA " + a.icon :
            a.type === "image" ? "custom image" : "dot") +
          " · label " + a.labelMode + (a.showRoadName ? " + road name" : ""), "hint");
        detail.style.fontSize = "0.8em";
        description.appendChild(detail);
      }
      row.appendChild(description);
      const controls = node("div", undefined, "form-fields");
      controls.appendChild(button("◎", label("FVTTATLAS.Checkpoints.Highlight"),
        () => actions.selectCheckpoint(scene, checkpoint.id)));
      controls.appendChild(button("✎", label("FVTTATLAS.Checkpoints.Edit"),
        () => actions.editCheckpoint(scene, checkpoint, refresh)));
      if (!party.enabled) controls.appendChild(button(
        checkpoint.playerVisible === true ? "👁" : "◌",
        checkpoint.playerVisible === true ? "Hide checkpoint from players" :
          "Show checkpoint to players (visual only)",
        () => actions.toggleCheckpointPlayerVisibility(scene, checkpoint, refresh)));
      const checkpointJournal = journalUuidFor(journalLinks,"checkpoint",checkpoint.id);
      if(checkpointJournal) {
         description.insertBefore(linkedJournalIndicator(checkpointJournal),description.firstChild);
         controls.appendChild(button("📖", "Open linked Checkpoint Journal",
        () => void openAtlasJournal(checkpointJournal).catch(error =>
          ui.notifications.error(error.message||String(error)))));
      }
      controls.appendChild(button("🖼", "CHECKPOINT OVERLAY — Set Font Awesome icon / image, size, colors and name labels",
        () => actions.editCheckpointAppearance(scene, checkpoint, refresh)));
      controls.appendChild(button("×", label("FVTTATLAS.Checkpoints.Delete"),
        () => actions.removeCheckpoint(scene, checkpoint, refresh)));
      if (party.enabled || state.enabled) {
        const knowledge = checkpointKnowledge(party, checkpoint.id);
        const knowledgeSelect = node("select");
        knowledgeSelect.title = "GM checkpoint discovery / lore knowledge";
        knowledgeSelect.setAttribute("aria-label", "Knowledge of " + checkpoint.name);
        for (const [value, text] of [
          ["unknown", "Undiscovered"],
          ["visited", "Seen / Visited"],
          ["lore", "Known through Lore"]
        ]) {
          const option = node("option", text);
          option.value = value;
          knowledgeSelect.appendChild(option);
        }
        knowledgeSelect.value = knowledge === "legacy" ? "unknown" : knowledge;
        knowledgeSelect.addEventListener("change", async () => {
          try {
            await actions.setCheckpointKnowledge(scene, {
              checkpointId: checkpoint.id, knowledge: knowledgeSelect.value,
              expected: party
            }, refresh);
          } catch (error) {
            ui.notifications.error(error.message);
            refresh();
          }
        });
        controls.appendChild(knowledgeSelect);
        if (state.enabled) {
          const radiusLabel = node("label", "Terrain radius (cells)");
          radiusLabel.title = "Checkpoint reveal radius, 0 = show marker without revealing terrain.";
          const radiusInput = document.createElement("input");
          radiusInput.type = "number";
          radiusInput.min = "0";
          radiusInput.max = "100";
          radiusInput.step = "1";
          radiusInput.style.width = "5em";
          radiusInput.value = String(Object.hasOwn(party.checkpointRevealRadiusCells,checkpoint.id)
            ? party.checkpointRevealRadiusCells[checkpoint.id]
            : party.defaultRevealRadiusCells);
          radiusInput.addEventListener("change", async () => {
            try {
              await actions.setCheckpointKnowledge(scene, {
                checkpointId: checkpoint.id,
                knowledge: knowledge === "legacy" ? "unknown" : knowledge,
                revealRadiusCells: Number(radiusInput.value),
                expected: party
              }, refresh);
            } catch(error) { ui.notifications.error(error.message); refresh(); }
          });
          radiusLabel.appendChild(radiusInput);
          controls.appendChild(radiusLabel);
        }
      }
      row.appendChild(controls);
      checkpointSection.appendChild(row);
    }
    if (!matching.length) {
      checkpointSection.appendChild(node("p", label("FVTTATLAS.Checkpoints.None"), "hint"));
    } else if (matching.length > visible.length) {
      checkpointSection.appendChild(node("p",
        label("FVTTATLAS.Junctions.Recent") + " " + visible.length +
        " / " + matching.length, "hint"));
    }
  }
  advanced.appendChild(checkpointSection);


  // v0.2.14: generate separate opt-in native Regions around one checkpoint
  // or along one unambiguous chain between two checkpoints on the SAME road.
  // No bulk or automatic generation occurs merely by opening this sheet.
  const generated = listGeneratedRegions(scene);
  const generatedSection = node("fieldset");
  generatedSection.appendChild(node("legend", label("FVTTATLAS.Generated.Title") +
    " · Native Regions"));
  generatedSection.appendChild(node("p", label("FVTTATLAS.Generated.Hint"), "hint"));
  generatedSection.appendChild(node("p",
    "REGION SETTINGS — Preset colors and movement costs below affect native Foundry Regions " +
    "only after the separate GM-confirmed action. They do not change Atlas road lines or labels.", "hint"));
  if (sharedFilter && atlas.schemaVersion >= 4) {
    generatedSection.appendChild(sharedRoadFilters(atlas, sharedFilter, refresh));
  }
  const available = atlas.schemaVersion >= 4 ? atlas.roads.filter(r =>
    atlas.checkpoints.filter(c => c.roadId === r.id).length > 0) : [];
  if (!available.length) {
    generatedSection.appendChild(node("p", label("FVTTATLAS.Generated.NoCheckpoints"), "hint"));
  } else {
    let selected = generatorState.get(scene.id);
    if (!selected || !available.some(r => r.id === selected.roadId)) {
      selected = { roadId: available[0].id, kind: "checkpoint",
        presetId: available[0].travelPresetId ?? null, presetEdited: false,
        applyNativeCost: false, movementAction: "" };
      generatorState.set(scene.id, selected);
    }
    // Road-default changes flow into the generator unless the GM chose an override.
    if (!selected.presetEdited) {
      selected.presetId = available.find(r => r.id === selected.roadId)?.travelPresetId ?? null;
    }
    if (selected.presetId !== null && selected.presetId !== undefined &&
        !presetById.has(selected.presetId)) selected.presetId = null;
    const makeSelect = (choices, current, changed) => {
      const select = node("select");
      for (const [value, name] of choices) {
        const option = node("option", name);
        option.value = value;
        select.appendChild(option);
      }
      select.value = current;
      select.addEventListener("change", () => { changed(select.value); refresh(); });
      return select;
    };
    const addField = (title, control) => {
      const row = node("div", undefined, "form-group");
      const fieldLabel = node("label", label(title));
      row.appendChild(fieldLabel);
      row.appendChild(control);
      generatedSection.appendChild(row);
    };
    addField("FVTTATLAS.Generated.Road", makeSelect(
      available.map(r => [r.id, r.name]), selected.roadId,
      value => {
        selected.roadId = value; selected.first = null; selected.last = null;
        if (sharedFilter && sharedFilter.scope !== "scene") sharedFilter.roadId = value;
        selected.presetId = available.find(r => r.id === value)?.travelPresetId ?? null;
        selected.presetEdited = false;
        selected.applyNativeCost = false;
        selected.movementAction = "";
      }));
    const checkpoints = atlas.checkpoints.filter(c => c.roadId === selected.roadId);
    addField("FVTTATLAS.Generated.Kind", makeSelect([
      ["checkpoint", label("FVTTATLAS.Generated.Checkpoint")],
      ["corridor", label("FVTTATLAS.Generated.Corridor")]
    ], selected.kind, value => {
      selected.kind = value;
      selected.applyNativeCost = false;
      selected.movementAction = "";
    }));
    const first = checkpoints.some(c => c.id === selected.first)
      ? selected.first : checkpoints[0].id;
    selected.first = first;
    addField("FVTTATLAS.Generated.From", makeSelect(
      checkpoints.map(c => [c.id, c.name]), first,
      value => { selected.first = value; }));
    if (selected.kind === "corridor") {
      const other = checkpoints.filter(c => c.id !== first);
      if (!other.some(c => c.id === selected.last)) selected.last = other[0]?.id ?? null;
      if (other.length) addField("FVTTATLAS.Generated.To", makeSelect(
        other.map(c => [c.id, c.name]), selected.last,
        value => { selected.last = value; }));
    }
    // Shared with the Preview button state below; keep it outside the
    // corridor-only block so opting in cannot crash the Atlas render.
    const presetForCost = presetById.get(selected.presetId);
    const perMode = selected.kind === "corridor" &&
      !!presetForCost && presetForCost.movementCosts !== null;
    if (selected.kind === "corridor") {
      const choices = [["", label("FVTTATLAS.Travel.None")],
        ...travelPresets.map(p => [
          p.id, p.mode.toUpperCase() + " — " + p.name +
            " (" + presetCostSummary(p) + ")"
        ])];
      addField("FVTTATLAS.Travel.CorridorPreset", makeSelect(
        choices, selected.presetId ?? "", value => {
          selected.presetId = value || null;
          selected.presetEdited = true;
          selected.applyNativeCost = false;
          selected.movementAction = "";
        }));
      const supported = availableMovementActions();
      const selectedPreset = presetForCost;
      const costOption = node("label");
      costOption.style.display = "flex";
      costOption.style.gap = "0.5rem";
      costOption.style.alignItems = "center";
      const checkbox = node("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!selected.applyNativeCost;
      checkbox.disabled = !selected.presetId || supported.length === 0;
      checkbox.addEventListener("change", () => {
        selected.applyNativeCost = checkbox.checked;
        if (!checkbox.checked) selected.movementAction = "";
        refresh();
      });
      costOption.append(checkbox, node("span", label("FVTTATLAS.Cost.OptIn")));
      generatedSection.appendChild(costOption);
      if (selected.applyNativeCost && perMode) {
        generatedSection.appendChild(node("p",
          "One native Behavior with selected movement modes: " +
            presetCostSummary(selectedPreset), "hint"));
      }
      if (selected.applyNativeCost && !perMode && supported.length && selected.presetId) {
        addField("FVTTATLAS.Cost.Action", makeSelect([
          ["", label("FVTTATLAS.Cost.Choose")],
          ...supported.map(action => [action.id,
            game.i18n.localize(action.label) || action.label])
        ], selected.movementAction || "", value => { selected.movementAction = value; }));
      }
      // Validate the actual preset value before offering the create/preview
      // action; the action-availability probe only uses a sample value.
      if (selected.applyNativeCost && selected.presetId &&
          (perMode || selected.movementAction)) {
        try {
          selected.nativeCostPreview =
            previewNativeMovementCost(selected.presetId,
              perMode ? null : selected.movementAction);
        } catch (error) {
          selected.nativeCostPreview = { ok: false, message: error.message };
        }
        if (!selected.nativeCostPreview.ok) {
          const warning = node("p", selected.nativeCostPreview.message, "hint");
          warning.style.color = "var(--color-text-danger, #a33131)";
          generatedSection.appendChild(warning);
        }
      } else {
        selected.nativeCostPreview = null;
      }
      generatedSection.appendChild(node("p",
        supported.length ? label("FVTTATLAS.Cost.Hint") : label("FVTTATLAS.Cost.Unavailable"), "hint"));
      // A selectable Token action is not necessarily a configurable Region-cost
      // action (for example, Fly/Swim may be fixed or system-derived).
      const unavailable = unavailableMovementActions();
      if (unavailable.length) {
        const names = unavailable.slice(0, 5).map(action =>
          game.i18n.localize(action.label) || action.label).join(", ");
        generatedSection.appendChild(node("p",
          "Not independently configurable by this system's native Region costs: " +
          names + (unavailable.length > 5 ? "…" : "") +
          ". You can still save any Land, Air or Water preset without a native Behavior.",
          "hint"));
      }
    }
    const selectedCheckpointIds = selected.kind === "corridor"
      ? [selected.first, selected.last].sort()
      : [selected.first];
    const existingInterval = generated.find(region => region.metadata && !region.invalid &&
      region.metadata.roadId === selected.roadId &&
      region.metadata.kind === selected.kind &&
      region.metadata.checkpointIds.join("|") === selectedCheckpointIds.join("|"));
    const width = node("input");
    width.type = "number";
    width.min = "0.25";
    width.max = "3";
    width.step = "0.25";
    width.value = String(selected.widthCells ?? 0.5);
    width.setAttribute("aria-label", label("FVTTATLAS.Generated.Width"));
    width.addEventListener("change", () => { selected.widthCells = Number(width.value); });
    addField("FVTTATLAS.Generated.Width", width);
    const create = button(label("FVTTATLAS.Generated.Preview"),
      label("FVTTATLAS.Generated.Preview"),
      () => actions.generateRegion(scene, {
        kind: selected.kind, roadId: selected.roadId,
        checkpointId: selected.first,
        endCheckpointId: selected.kind === "corridor" ? selected.last : null,
        widthCells: Number(width.value),
        presetId: selected.kind === "corridor" ? (selected.presetId ?? null) : null,
        applyNativeCost: selected.kind === "corridor" && !!selected.applyNativeCost,
        movementAction: selected.kind === "corridor" ? selected.movementAction : null
      }, refresh));
    create.disabled = !!draft || (selected.kind === "corridor" && checkpoints.length < 2) ||
      (selected.kind === "corridor" && selected.applyNativeCost &&
        ((!perMode && !selected.movementAction) ||
          selected.nativeCostPreview?.ok !== true));
    if (existingInterval) {
      generatedSection.appendChild(node("p",
        "Already generated: " + existingInterval.name +
        (existingInterval.metadata.kind === "corridor"
          ? ". Keep this native Region; use ◈ to change its surface preset, 🎨 to apply its color, and ↺ Cost to refresh unmodified Atlas-native movement costs below. Regenerate updates geometry only."
          : ". Keep this native checkpoint Region; use Regenerate below only if its geometry is unmodified."),
        "hint"));
    }
    create.disabled ||= !!existingInterval;
    generatedSection.appendChild(create);
  }
  const visibleGenerated = generated.filter(region => !region.metadata ||
    shownRoads.has(region.metadata.roadId));
  if (generated.length) {
    generatedSection.appendChild(node("p",
      visibleGenerated.length + " / " + generated.length + " " +
      label("FVTTATLAS.Generated.Existing"), "hint"));
  }
  for (const region of visibleGenerated.slice(0, 50)) {
    const row = node("div", undefined, "form-group");
    const detail = node("div");
    detail.style.flex = "1 1 auto";
    detail.appendChild(node("span", region.name));
    if (region.metadata?.kind === "corridor") {
      const preset = region.presetId ? presetById.get(region.presetId) : null;
      detail.appendChild(node("div", region.invalidPreset
        ? label("FVTTATLAS.Travel.InvalidPreset")
        : region.presetId
          ? preset
            ? label("FVTTATLAS.Travel.CorridorPreset") + ": " + preset.name +
              " (" + presetCostSummary(preset) + ")"
            : label("FVTTATLAS.Travel.MissingPreset")
          : label("FVTTATLAS.Travel.None"), "hint"));
      if (preset) {
        const currentColor = String(region.color ?? "").toUpperCase();
        const colorMatches = currentColor === preset.color;
        const swatch = node("span");
        swatch.style.cssText = "display:inline-block;width:0.9rem;height:0.9rem;" +
          "margin-right:0.4rem;border:1px solid currentColor;border-radius:0.15rem;" +
          "background:" + preset.color + ";";
        const colorLine = node("div", undefined, "hint");
        colorLine.append(swatch, node("span",
          "Native Region surface color " + preset.color + (colorMatches
            ? " · Applied" : " · Region differs (manual or older color)")));
        detail.appendChild(colorLine);
        const costState = nativeCostPresetStatus(region.nativeCost, preset);
        const costLine = node("div", "Cost status: " + costState.label, "hint");
        costLine.setAttribute("data-atlas-cost-status", costState.state);
        detail.appendChild(costLine);
      }
      if (region.nativeCost.existing) {
        const authored = region.nativeCost.detail;
        const summary = region.nativeCost.managed && authored
          ? label("FVTTATLAS.Cost.Managed") + " · " +
            (authored.schemaVersion === 1
              ? authored.action + " ×" + authored.multiplier
              : Object.entries(authored.movementCosts).map(([action, cost]) =>
                action + " ×" + cost).join(", "))
          : label("FVTTATLAS.Cost.Existing");
        detail.appendChild(node("div", summary, "hint"));
      }
    }
    detail.appendChild(node("div", region.invalid ?
      label("FVTTATLAS.Generated.Invalid") :
      region.modified ? label("FVTTATLAS.Generated.Modified") :
      label("FVTTATLAS.Generated.Managed"), "hint"));
    row.appendChild(detail);
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button("⚙", label("FVTTATLAS.Regions.Configure"),
      () => actions.configureRegion(scene, region.id)));
    if (!region.invalid) {
      if (region.metadata?.kind === "corridor") {
        controls.appendChild(button("◈", label("FVTTATLAS.Travel.AssignRegion"),
          () => actions.assignGeneratedRegionTravelPreset(scene, region, refresh)));
        const color = button("🎨", "NATIVE REGION COLOR — Apply surface preset color (with confirmation)",
          () => actions.applyGeneratedRegionColor(scene, region, refresh));
        color.disabled = !!draft || !presetById.has(region.presetId) ||
          String(region.color ?? "").toUpperCase() ===
          presetById.get(region.presetId)?.color;
        controls.appendChild(color);
        const apply = button("⬆", label("FVTTATLAS.Cost.ApplyExisting"),
          () => actions.applyGeneratedRegionCost(scene, region, refresh));
        apply.disabled = !!draft || !region.presetId || !presetById.has(region.presetId) ||
          region.nativeCost.existing || availableMovementActions().length === 0 ||
          (presetById.get(region.presetId)?.movementCosts !== null &&
            !Object.keys(presetById.get(region.presetId)?.movementCosts ?? {}).length);
        controls.appendChild(apply);
        if (region.nativeCost.existing) {
          const update = button("↺", "Refresh this corridor's Atlas-managed native movement costs (confirmation)",
            () => actions.updateGeneratedRegionCost(scene, region, refresh));
          update.disabled = !!draft || !presetById.has(region.presetId) ||
            !editableManagedNativeCost(region.nativeCost);
          controls.appendChild(update);
        }
      }
      const regenerate = button("↻", label("FVTTATLAS.Generated.Regenerate"),
        () => actions.regenerateRegion(scene, region, refresh));
      regenerate.disabled = !!draft || region.modified;
      controls.appendChild(regenerate);
    }
    row.appendChild(controls);
    generatedSection.appendChild(row);
  }
  if (visibleGenerated.length > 50) generatedSection.appendChild(node("p",
    label("FVTTATLAS.Generated.Limit"), "hint"));
  advanced.appendChild(generatedSection);

  // Phase 2d associates existing native RegionDocuments. No Atlas geometry or
  // terrain modifiers are stored here; Foundry's Region editor stays canonical.
  const regionSection = node("fieldset");
  const regionLegend = node("legend");
  const regionHeader = node("span");
  regionHeader.style.display = "inline-flex";
  regionHeader.style.alignItems = "center";
  regionHeader.style.gap = "0.35rem";
  regionHeader.appendChild(node("span", label("FVTTATLAS.Regions.Title")));
  const regionBadge = node("span", "· Foundry Region Documents");
  regionBadge.style.cssText = "font-size:0.75em;opacity:0.75;";
  regionHeader.appendChild(regionBadge);
  const nativeRegions = listSceneRegions(scene);
  const roadByGeneratedRegionId = new Map(generated.filter(r => r.metadata)
    .map(r => [r.id, r.metadata.roadId]));
  const candidates = nativeRegions.filter(region => !region.linked && !region.invalidLink);
  const link = button("+", label("FVTTATLAS.Regions.Link"),
    () => actions.linkRegion(scene, refresh));
  link.style.flex = "0 0 auto";
  link.style.width = "1.65rem";
  link.style.minWidth = "1.65rem";
  link.style.padding = "0";
  link.disabled = candidates.length === 0;
  regionHeader.appendChild(link);
  regionHeader.appendChild(button("↻", label("FVTTATLAS.Regions.Refresh"), refresh));
  regionLegend.appendChild(regionHeader);
  regionSection.appendChild(regionLegend);
  regionSection.appendChild(node("p", label("FVTTATLAS.Regions.Hint"), "hint"));
  if (sharedFilter && atlas.schemaVersion >= 4) {
    regionSection.appendChild(sharedRoadFilters(atlas, sharedFilter, refresh));
    if (sharedFilter.scope !== "scene") regionSection.appendChild(node("p",
      "Regions without a generated road association appear under All Scene.", "hint"));
  }
  const visibleNative = nativeRegions.filter(region =>
    !sharedFilter || atlas.schemaVersion < 4 ||
    (region.invalidLink && !roadByGeneratedRegionId.has(region.id)) ||
    sharedFilter.scope === "scene" ||
    shownRoads.has(roadByGeneratedRegionId.get(region.id)));
  const linkedRegions = visibleNative.filter(region => region.linked);
  if (!nativeRegions.length) {
    regionSection.appendChild(node("p", label("FVTTATLAS.Regions.NoNative"), "hint"));
  } else if (!linkedRegions.length) {
    regionSection.appendChild(node("p", label("FVTTATLAS.Regions.None"), "hint"));
  }
  for (const region of visibleNative.filter(region => region.linked || region.invalidLink)) {
    const row = node("div", undefined, "form-group");
    row.setAttribute("data-atlas-region-id", region.id);
    const description = node("div");
    description.style.flex = "1 1 auto";
    description.style.minWidth = "0";
    description.appendChild(node("span", region.name));
    if (region.hidden) {
      description.appendChild(node("div", label("FVTTATLAS.Regions.Hidden"), "hint"));
    }
    if (region.invalidLink) {
      description.appendChild(node("div", label("FVTTATLAS.Regions.Invalid"), "hint"));
    } else if (region.behaviors.length) {
      const summary = region.behaviors.map(behavior =>
        `${behavior.name} (${label(behavior.active ?
          "FVTTATLAS.Regions.Active" : "FVTTATLAS.Regions.Inactive")})`).join(" · ");
      description.appendChild(node("div", summary, "hint"));
    } else {
      description.appendChild(node("div", label("FVTTATLAS.Regions.NoBehaviors"), "hint"));
    }
    row.appendChild(description);
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button("⚙", label("FVTTATLAS.Regions.Configure"),
      () => actions.configureRegion(scene, region.id)));
    if (region.linked) {
      controls.appendChild(button("×", label("FVTTATLAS.Regions.Unlink"),
        () => actions.unlinkRegion(scene, region.id, refresh)));
    }
    row.appendChild(controls);
    regionSection.appendChild(row);
  }
  if (nativeRegions.some(region => region.invalidLink)) {
    regionSection.appendChild(node("p", label("FVTTATLAS.Regions.InvalidHint"), "hint"));
  }
  advanced.appendChild(regionSection);

  const measurement = node("fieldset");
  measurement.appendChild(node("legend", label("FVTTATLAS.Atlas.Measurement")));
  const grid = readSceneGridScale(scene);
  if (grid) measurement.appendChild(node("p",
    `${label("FVTTATLAS.Atlas.NativeGrid")}: ${format(grid.unitsPerSpace)} ${grid.unit} / ${format(grid.pixelsPerSpace)} px`));
  else measurement.appendChild(node("p", label("FVTTATLAS.Atlas.GridUnavailable"), "hint"));
  measurement.appendChild(node("p", label("FVTTATLAS.Atlas.SceneGridSaveHint"), "hint"));
  advanced.appendChild(measurement);
  root.appendChild(advanced);
  return root;
}

/**
 * Add the road list inside the existing native Scene Configuration Atlas part.
 * All Atlas buttons are type=button: they save only Atlas flags, never submit
 * unrelated core Scene form fields.
 */
const openAtlasSheets = new Map();

/** The visible Scene configuration remains the owner of Atlas operations. */
export function getAtlasSceneConfig(scene) {
  return openAtlasSheets.get(scene?.id)?.app ?? null;
}

export function refreshAtlasSceneConfig(scene) {
  openAtlasSheets.get(scene?.id)?.refresh?.();
}

export function forgetAtlasSceneConfig(app) {
  if (openAtlasSheets.get(app?.document?.id)?.app === app) {
    openAtlasSheets.delete(app.document.id);
  }
}

export function addAtlasRoadsToSceneConfig(app, element, actions) {
  const scene = app?.document;
  if (!globalThis.game?.user?.isGM ||
      !scene?.id ||
      !scene?.canUserModify?.(game.user, "update")) return;
  const form = element?.matches?.("form") ? element : element?.querySelector?.("form");
  const nativeRoot = element?.querySelector?.(ROOT_SELECTOR);
  const fallback = !nativeRoot && (
    element?.querySelector?.('[data-tab="misc"]') ||
    element?.querySelector?.('[data-tab="grid"]') ||
    form
  );
  const target = nativeRoot || fallback;
  if (!target) return;
  target.querySelector?.("[data-fvtt-atlas-setup]")?.remove();
  const refresh = () => {
    if (app.rendered === false) return;
    addAtlasRoadsToSceneConfig(app, element, actions);
  };
  openAtlasSheets.set(scene.id, { app, refresh });

  let panel;
  try { panel = atlasPanel(scene, readAtlas(scene), actions, refresh); }
  catch (error) {
    panel = node("section");
    panel.setAttribute("data-fvtt-atlas-setup", "");
    panel.appendChild(node("p", error.message, "hint"));
  }
  target.appendChild(panel);
}
