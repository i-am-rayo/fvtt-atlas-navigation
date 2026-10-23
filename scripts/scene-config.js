import { readAtlas } from "./atlas-storage.js";
import { readSceneGridScale } from "./scene-grid.js";
import { getRoadMergeCandidates, listRoadJunctions } from "./road-model.js";
import { listSceneRegions } from "./region-atlas.js";
import { listRoadCheckpoints } from "./checkpoint-model.js";
import { listGeneratedRegions } from "./generated-region.js";

const TAB_ID = "atlas";
const ROOT_SELECTOR = "[data-fvtt-atlas-scene-root]";
const junctionFilters = new Map();
const generatorState = new Map();

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

  // A configured road network is what makes this Scene an Atlas. The old
  // enabled flag remains persisted for v1 compatibility, but has no UI toggle.
  const active = atlas.segments.length > 0;
  root.appendChild(node("h3", label("FVTTATLAS.Atlas.Tab")));
  root.appendChild(node("p", active ?
    label("FVTTATLAS.Roads.Active") : label("FVTTATLAS.Roads.EmptyStatus")));

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
  for (const [index, road] of roads.entries()) {
    const row = node("div", undefined, "form-group");
    row.setAttribute("data-atlas-road-id", road.id);
    const roadName = road.name || label("FVTTATLAS.Roads.Title") + " " + (index + 1);
    const count = atlas.schemaVersion >= 3 ?
      atlas.segments.filter(segment => segment.roadId === road.id).length : 1;
    const description = node("div");
    description.style.flex = "1 1 auto";
    description.style.minWidth = "0";
    description.appendChild(node("span", roadName));
    if (count > 1) {
      const metadata = node("div", `${count} ${label("FVTTATLAS.Roads.Segments")}`);
      metadata.style.fontSize = "0.8em";
      metadata.style.fontStyle = "italic";
      metadata.style.opacity = "0.7";
      metadata.title = label("FVTTATLAS.Roads.SegmentCountHint");
      description.appendChild(metadata);
    }
    row.appendChild(description);
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button("◎", label("FVTTATLAS.Roads.Highlight"),
      () => {
        if (atlas.schemaVersion >= 3) {
          const state = junctionFilterFor(scene, atlas);
          state.roadId = road.id;
          state.scope = "selected";
          refresh();
        }
        return actions.select(scene, road.id);
      }));
    if (atlas.schemaVersion >= 3) {
      controls.appendChild(button("⌖", label("FVTTATLAS.Roads.EditPoints"),
        () => actions.beginPointEdit(scene, road.id, refresh)));
      if (getRoadMergeCandidates(atlas, road.id).length) {
        controls.appendChild(button("⇄", label("FVTTATLAS.Roads.Merge"),
          () => actions.merge(scene, road, refresh)));
      }
    }
    controls.appendChild(button("✎", label("FVTTATLAS.Roads.Rename"),
      async () => { await actions.rename(scene, road, refresh); }));
    controls.appendChild(button("×", label("FVTTATLAS.Roads.Delete"),
      async () => { await actions.remove(scene, road, refresh); }));
    row.appendChild(controls);
    section.appendChild(row);
  }
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
  root.appendChild(junctionSection);

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
      row.appendChild(description);
      const controls = node("div", undefined, "form-fields");
      controls.appendChild(button("◎", label("FVTTATLAS.Checkpoints.Highlight"),
        () => actions.selectCheckpoint(scene, checkpoint.id)));
      controls.appendChild(button("✎", label("FVTTATLAS.Checkpoints.Edit"),
        () => actions.editCheckpoint(scene, checkpoint, refresh)));
      controls.appendChild(button("×", label("FVTTATLAS.Checkpoints.Delete"),
        () => actions.removeCheckpoint(scene, checkpoint, refresh)));
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
  root.appendChild(checkpointSection);


  // v0.2.14: generate separate opt-in native Regions around one checkpoint
  // or along one unambiguous chain between two checkpoints on the SAME road.
  // No bulk or automatic generation occurs merely by opening this sheet.
  const generatedSection = node("fieldset");
  generatedSection.appendChild(node("legend", label("FVTTATLAS.Generated.Title")));
  generatedSection.appendChild(node("p", label("FVTTATLAS.Generated.Hint"), "hint"));
  const available = atlas.schemaVersion >= 4 ? atlas.roads.filter(r =>
    atlas.checkpoints.filter(c => c.roadId === r.id).length > 0) : [];
  if (!available.length) {
    generatedSection.appendChild(node("p", label("FVTTATLAS.Generated.NoCheckpoints"), "hint"));
  } else {
    let selected = generatorState.get(scene.id);
    if (!selected || !available.some(r => r.id === selected.roadId)) {
      selected = { roadId: available[0].id, kind: "checkpoint" };
      generatorState.set(scene.id, selected);
    }
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
      value => { selected.roadId = value; selected.first = null; selected.last = null; }));
    const checkpoints = atlas.checkpoints.filter(c => c.roadId === selected.roadId);
    addField("FVTTATLAS.Generated.Kind", makeSelect([
      ["checkpoint", label("FVTTATLAS.Generated.Checkpoint")],
      ["corridor", label("FVTTATLAS.Generated.Corridor")]
    ], selected.kind, value => { selected.kind = value; }));
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
        widthCells: Number(width.value)
      }, refresh));
    create.disabled = !!draft || (selected.kind === "corridor" && checkpoints.length < 2);
    generatedSection.appendChild(create);
  }
  const generated = listGeneratedRegions(scene);
  if (generated.length) {
    generatedSection.appendChild(node("p",
      generated.length + " " + label("FVTTATLAS.Generated.Existing"), "hint"));
  }
  for (const region of generated.slice(0, 50)) {
    const row = node("div", undefined, "form-group");
    const detail = node("div");
    detail.style.flex = "1 1 auto";
    detail.appendChild(node("span", region.name));
    detail.appendChild(node("div", region.invalid ?
      label("FVTTATLAS.Generated.Invalid") :
      region.modified ? label("FVTTATLAS.Generated.Modified") :
      label("FVTTATLAS.Generated.Managed"), "hint"));
    row.appendChild(detail);
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button("⚙", label("FVTTATLAS.Regions.Configure"),
      () => actions.configureRegion(scene, region.id)));
    if (!region.invalid) {
      const regenerate = button("↻", label("FVTTATLAS.Generated.Regenerate"),
        () => actions.regenerateRegion(scene, region, refresh));
      regenerate.disabled = !!draft || region.modified;
      controls.appendChild(regenerate);
    }
    row.appendChild(controls);
    generatedSection.appendChild(row);
  }
  if (generated.length > 50) generatedSection.appendChild(node("p",
    label("FVTTATLAS.Generated.Limit"), "hint"));
  root.appendChild(generatedSection);

  // Phase 2d associates existing native RegionDocuments. No Atlas geometry or
  // terrain modifiers are stored here; Foundry's Region editor stays canonical.
  const regionSection = node("fieldset");
  const regionLegend = node("legend");
  const regionHeader = node("span");
  regionHeader.style.display = "inline-flex";
  regionHeader.style.alignItems = "center";
  regionHeader.style.gap = "0.35rem";
  regionHeader.appendChild(node("span", label("FVTTATLAS.Regions.Title")));
  const nativeRegions = listSceneRegions(scene);
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
  const linkedRegions = nativeRegions.filter(region => region.linked);
  if (!nativeRegions.length) {
    regionSection.appendChild(node("p", label("FVTTATLAS.Regions.NoNative"), "hint"));
  } else if (!linkedRegions.length) {
    regionSection.appendChild(node("p", label("FVTTATLAS.Regions.None"), "hint"));
  }
  for (const region of nativeRegions.filter(region => region.linked || region.invalidLink)) {
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
  root.appendChild(regionSection);

  const measurement = node("fieldset");
  measurement.appendChild(node("legend", label("FVTTATLAS.Atlas.Measurement")));
  const grid = readSceneGridScale(scene);
  if (grid) measurement.appendChild(node("p",
    `${label("FVTTATLAS.Atlas.NativeGrid")}: ${format(grid.unitsPerSpace)} ${grid.unit} / ${format(grid.pixelsPerSpace)} px`));
  else measurement.appendChild(node("p", label("FVTTATLAS.Atlas.GridUnavailable"), "hint"));
  measurement.appendChild(node("p", label("FVTTATLAS.Atlas.SceneGridSaveHint"), "hint"));
  root.appendChild(measurement);
  return root;
}

/**
 * Add the road list inside the existing native Scene Configuration Atlas part.
 * All Atlas buttons are type=button: they save only Atlas flags, never submit
 * unrelated core Scene form fields.
 */
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

  let panel;
  try { panel = atlasPanel(scene, readAtlas(scene), actions, refresh); }
  catch (error) {
    panel = node("section");
    panel.setAttribute("data-fvtt-atlas-setup", "");
    panel.appendChild(node("p", error.message, "hint"));
  }
  target.appendChild(panel);
}
