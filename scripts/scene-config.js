import { readAtlas } from "./atlas-storage.js";
import { readSceneGridScale } from "./scene-grid.js";
import { getRoadMergeCandidates, listRoadJunctions } from "./road-model.js";

const TAB_ID = "atlas";
const ROOT_SELECTOR = "[data-fvtt-atlas-scene-root]";
const junctionFilters = new Map();

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
  if (draft && draft.mode !== "junction" && draft.source !== "junction") {
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

  const roads = atlas.schemaVersion === 3 ? atlas.roads : atlas.segments;
  for (const [index, road] of roads.entries()) {
    const row = node("div", undefined, "form-group");
    row.setAttribute("data-atlas-road-id", road.id);
    const roadName = road.name || label("FVTTATLAS.Roads.Title") + " " + (index + 1);
    const count = atlas.schemaVersion === 3 ?
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
        if (atlas.schemaVersion === 3) {
          const state = junctionFilterFor(scene, atlas);
          state.roadId = road.id;
          state.scope = "selected";
          refresh();
        }
        return actions.select(scene, road.id);
      }));
    if (atlas.schemaVersion === 3) {
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
  addJunction.disabled = atlas.schemaVersion !== 3 || !atlas.segments.length || !!draft;
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

  if (atlas.schemaVersion === 3 && atlas.roads.length) {
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

  // Descriptive points/Journal-linked Notes are a separate future feature.
  // A road bend, endpoint or pass-through graph node is not a Waypoint.
  const waypointSection = node("fieldset");
  waypointSection.appendChild(node("legend", label("FVTTATLAS.Waypoints.Title")));
  waypointSection.appendChild(node("p", label("FVTTATLAS.Waypoints.Future"), "hint"));
  root.appendChild(waypointSection);

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
