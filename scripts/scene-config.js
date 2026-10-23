import { readAtlas } from "./atlas-storage.js";
import { readSceneGridScale } from "./scene-grid.js";

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

  const section = node("fieldset");
  const header = node("legend");
  header.appendChild(node("span", label("FVTTATLAS.Roads.Title") + " "));
  header.appendChild(button("+", label("FVTTATLAS.Roads.Add"), () => {
    actions.begin(scene, refresh);
  }));
  section.appendChild(header);

  const draft = actions.draft(scene);
  if (draft) {
    section.appendChild(node("p",
      label("FVTTATLAS.Roads.Drawing") + " " +
      draft.points + " " + label("FVTTATLAS.Roads.Points"), "hint"));
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button(label("FVTTATLAS.Roads.Finish"),
      label("FVTTATLAS.Roads.Finish"), () => actions.finish()));
    controls.appendChild(button(label("FVTTATLAS.Roads.Cancel"),
      label("FVTTATLAS.Roads.Cancel"), () => actions.cancel()));
    section.appendChild(controls);
  }

  if (!atlas.segments.length) {
    section.appendChild(node("p", label("FVTTATLAS.Roads.NoRoads"), "hint"));
  }

  for (const [index, segment] of atlas.segments.entries()) {
    const row = node("div", undefined, "form-group");
    row.setAttribute("data-atlas-road-id", segment.id);
    const roadName = segment.name || label("FVTTATLAS.Roads.Title") + " " + (index + 1);
    const text = node("span", roadName);
    row.appendChild(text);
    const controls = node("div", undefined, "form-fields");
    controls.appendChild(button("◎", label("FVTTATLAS.Roads.Highlight"),
      () => actions.select(scene, segment.id)));
    controls.appendChild(button("✎", label("FVTTATLAS.Roads.Rename"),
      async () => { await actions.rename(scene, segment, refresh); }));
    controls.appendChild(button("×", label("FVTTATLAS.Roads.Delete"),
      async () => { await actions.remove(scene, segment, refresh); }));
    row.appendChild(controls);
    section.appendChild(row);
  }
  root.appendChild(section);

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
