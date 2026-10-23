import { readAtlas } from "./atlas-storage.js";
import { readSceneGridScale } from "./scene-grid.js";
import { getRoadMergeCandidates } from "./road-model.js";

const TAB_ID = "atlas";
const ROOT_SELECTOR = "[data-fvtt-atlas-scene-root]";

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
  if (draft && draft.mode !== "waypoint" && draft.source !== "waypoint") {
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
      () => actions.select(scene, road.id)));
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

  // Junctions are actual graph nodes, not visual bends. Keep the list bounded
  // so dense road networks do not flood the Scene Configuration sheet.
  const waypointSection = node("fieldset");
  const waypointLegend = node("legend");
  const waypointHeader = node("span");
  waypointHeader.style.display = "inline-flex";
  waypointHeader.style.alignItems = "center";
  waypointHeader.style.gap = "0.35rem";
  waypointHeader.appendChild(node("span", label("FVTTATLAS.Waypoints.Title")));
  const addWaypoint = button("+", label("FVTTATLAS.Waypoints.Add"),
    () => actions.beginWaypoint(scene, refresh));
  addWaypoint.style.flex = "0 0 auto";
  addWaypoint.style.width = "1.65rem";
  addWaypoint.style.minWidth = "1.65rem";
  addWaypoint.style.padding = "0";
  addWaypoint.disabled = atlas.schemaVersion !== 3 || !atlas.segments.length || !!draft;
  waypointHeader.appendChild(addWaypoint);
  waypointLegend.appendChild(waypointHeader);
  waypointSection.appendChild(waypointLegend);
  waypointSection.appendChild(node("p", label("FVTTATLAS.Waypoints.Hint"), "hint"));

  if (draft?.mode === "waypoint") {
    waypointSection.appendChild(node("p", label("FVTTATLAS.Waypoints.Picking"), "hint"));
    waypointSection.appendChild(button(label("FVTTATLAS.Roads.Cancel"),
      label("FVTTATLAS.Roads.Cancel"), () => actions.cancel()));
  } else if (draft?.mode === "points" && draft.source === "waypoint") {
    waypointSection.appendChild(node("p", label("FVTTATLAS.Waypoints.Editing"), "hint"));
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button(label("FVTTATLAS.Roads.SavePoints"),
      label("FVTTATLAS.Roads.SavePoints"), () => actions.finish()));
    if (draft.canUndo) {
      controls.appendChild(button(label("FVTTATLAS.Roads.Undo"),
        label("FVTTATLAS.Roads.Undo"), () => actions.undo()));
    }
    controls.appendChild(button(label("FVTTATLAS.Roads.CancelEdits"),
      label("FVTTATLAS.Roads.CancelEdits"), () => actions.cancel()));
    waypointSection.appendChild(controls);
  }

  if (atlas.schemaVersion === 3) {
    const activeIds = new Map();
    const roadNames = new Map(atlas.roads.map(road => [road.id, road.name]));
    for (const segment of atlas.segments) {
      for (const id of [segment.from, segment.to]) {
        if (!activeIds.has(id)) activeIds.set(id, new Set());
        activeIds.get(id).add(segment.roadId);
      }
    }
    const all = atlas.nodes.filter(n => activeIds.has(n.id));
    const shared = all.filter(n => activeIds.get(n.id).size > 1).length;
    waypointSection.appendChild(node("p",
      all.length + " " + label("FVTTATLAS.Waypoints.Count") + " · " +
      shared + " " + label("FVTTATLAS.Waypoints.Shared"), "hint"));
    const visible = all.slice(-25).reverse();
    for (const item of visible) {
      const row = node("div", undefined, "form-group");
      row.setAttribute("data-atlas-waypoint-id", item.id);
      const description = node("div");
      description.style.flex = "1 1 auto";
      description.style.minWidth = "0";
      description.appendChild(node("span",
        label("FVTTATLAS.Waypoints.Junction") + " · " + item.id.slice(-6)));
      const owners = node("div",
        [...activeIds.get(item.id)].map(id => roadNames.get(id) || id).join(", "),
        "hint");
      owners.style.fontSize = "0.8em";
      description.appendChild(owners);
      row.appendChild(description);
      const controls = node("div", undefined, "form-fields");
      controls.appendChild(button("◎", label("FVTTATLAS.Waypoints.Highlight"),
        () => actions.selectWaypoint(scene, item.id)));
      row.appendChild(controls);
      waypointSection.appendChild(row);
    }
    if (all.length > visible.length) {
      waypointSection.appendChild(node("p",
        label("FVTTATLAS.Waypoints.Recent") + " " + visible.length +
        " / " + all.length, "hint"));
    }
  }
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
