import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAtlas, validateAtlas, upgradeAtlasRoadTextAppearance,
  upgradeAtlasCheckpointAppearance } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint, editCheckpointAppearance, editRoadCheckpoint }
  from "../scripts/checkpoint-model.js";
import { CHECKPOINT_ICONS, CHECKPOINT_ICON_ROOT,
  CHECKPOINT_FREE_ICONS, checkpointFontIcon, findCheckpointIcons,
  validateCheckpointAppearance, checkpointIconPath, checkpointMarkerPosition,
  checkpointCanvasSize,
  DEFAULT_CHECKPOINT_APPEARANCE } from "../scripts/checkpoint-appearance.js";
import { saveCheckpointAppearance } from "../scripts/road-storage.js";
import { ATLAS_FLAG, MODULE_ID } from "../scripts/atlas-storage.js";

function fixture() {
  let n = 0;
  const road = addRoad(createEmptyAtlas(), {
    name: "Hidden mountain pass",
    points: [{ x: 1, y: 2 }, { x: 130, y: 110 }],
    idFactory: () => "id" + ++n
  });
  const checkpoint = addRoadCheckpoint(road, {
    roadId: road.roads[0].id,
    candidate: { kind: "node", nodeId: road.segments[0].from },
    name: "Ridge Lookout", elevationMeters: 470,
    idFactory: () => "id" + ++n
  });
  return upgradeAtlasRoadTextAppearance(checkpoint);
}

const fancy = { ...DEFAULT_CHECKPOINT_APPEARANCE, type: "fa",
  icon: "mountain", color: "#edcc44", textColor: "#171717",
  labelMode: "hover", showRoadName: true, size: 32 };

test("v0.2.22 RPG icon catalog is curated but existing/advanced brand picks stay valid", () => {
  const recommended = findCheckpointIcons("", "all", "rpg");
  assert.ok(recommended.length > 100 && recommended.length < 300);
  assert.ok(recommended.every(icon => !icon.id.startsWith("brands:")));
  assert.ok(recommended.some(icon => icon.id === "solid:dragon"));
  assert.ok(findCheckpointIcons("bridge", "all", "travel")
    .some(icon => icon.id === "solid:bridge"));
  assert.equal(findCheckpointIcons("github", "all", "rpg").length, 0);
  assert.ok(findCheckpointIcons("github", "all", "all")
    .some(icon => icon.id === "brands:github"));
  assert.doesNotThrow(() => validateCheckpointAppearance({ ...fancy,
    icon: "brands:github" }));
});

test("v0.2.22 checkpoint zoom changes screen size and vertical offset only", () => {
  const point = { x: 300, y: 440 };
  const normal = checkpointMarkerPosition(point, fancy, 1);
  assert.equal(checkpointCanvasSize(32, 1), 32);
  assert.equal(normal.y, 410);
  for (const zoom of [0.25, 0.5, 1, 2, 4]) {
    const pixels = checkpointCanvasSize(32, zoom) * zoom;
    assert.ok(pixels >= 16 && pixels <= 96);
    const raised = checkpointMarkerPosition(point, fancy, zoom);
    assert.equal(raised.x, point.x);
    assert.ok(raised.y < point.y);
    assert.deepEqual(point, { x: 300, y: 440 });
  }
  assert.deepEqual(checkpointMarkerPosition(point, DEFAULT_CHECKPOINT_APPEARANCE, 4), point);
  assert.ok(checkpointCanvasSize(12, 4)*4 > 30,
    "12px markers must remain legible at close zoom");
  assert.ok(checkpointCanvasSize(24, 4)*4 >
    checkpointCanvasSize(12, 4)*4,"major checkpoints remain more prominent");
});

test("v8 checkpoint appearance is an explicit lossless GM-authored migration", () => {
  const old = fixture();
  assert.equal(old.schemaVersion, 7);
  const v8 = upgradeAtlasCheckpointAppearance(old);
  assert.equal(v8.schemaVersion, 8);
  assert.equal(v8.checkpoints[0].appearance, null);
  assert.deepEqual(v8.nodes, old.nodes);
  assert.deepEqual(v8.segments, old.segments);
  assert.deepEqual(v8.roads, old.roads);
  assert.equal(v8.revision, old.revision);
  assert.equal(old.checkpoints[0].appearance, undefined,
    "reading or migrating does not mutate the prior object");

  const updated = editCheckpointAppearance(old, {
    checkpointId: old.checkpoints[0].id, appearance: fancy
  });
  assert.equal(updated.schemaVersion, 8);
  assert.deepEqual(updated.checkpoints[0].appearance, fancy);
  assert.equal(updated.checkpoints[0].elevationMeters, 470);
  assert.equal(updated.checkpoints[0].name, "Ridge Lookout");
  assert.deepEqual(updated.segments, old.segments);
  assert.deepEqual(updated.roads, old.roads);
  assert.deepEqual(editRoadCheckpoint(updated, {
    checkpointId: updated.checkpoints[0].id,
    name: "New label", elevationMeters: 990
  }).checkpoints[0].appearance, fancy, "metadata edits preserve icon configuration");
  assert.equal(editCheckpointAppearance(updated, {
    checkpointId: updated.checkpoints[0].id, appearance: null
  }).checkpoints[0].appearance, null);
  assert.equal(editCheckpointAppearance(old, {
    checkpointId: old.checkpoints[0].id, appearance: null
  }).schemaVersion, 7, "reset on an old Scene does not force migration");
});

test("checkpoint icon style whitelist, type and local image paths are strict", () => {
  assert.equal(CHECKPOINT_ICONS.length, 13);
  assert.equal(CHECKPOINT_FREE_ICONS.length, 2163,
    "Font Awesome Free 7.3.1 Solid, Regular and Brands catalog is complete");
  assert.equal(checkpointIconPath(fancy), CHECKPOINT_ICON_ROOT + "mountain.svg");
  assert.equal(checkpointIconPath(DEFAULT_CHECKPOINT_APPEARANCE), null);
  const image = { ...fancy, type: "image", image: "worlds/my-world/map-icon.webp" };
  assert.equal(checkpointIconPath(image), image.image);
  for (const bad of [
    { ...fancy, icon: "user-secret" },
    { ...fancy, size: 101 },
    { ...fancy, color: "red" },
    { ...fancy, labelMode: "sometimes" },
    { ...fancy, showRoadName: "true" },
    { ...fancy, extra: "unexpected" },
    { ...fancy, type: "image", image: "" },
    { ...fancy, type: "image", image: "../secrets.svg" },
    { ...fancy, type: "image", image: "https://example.org/a.svg" },
    { ...fancy, type: "image", image: "worlds/map.html" }
  ]) assert.throws(() => validateCheckpointAppearance(bad));
  const old = fixture();
  const invalidV8 = { ...upgradeAtlasCheckpointAppearance(old) };
  invalidV8.checkpoints = [{ ...invalidV8.checkpoints[0], appearance: { ...fancy, icon: "hacked" } }];
  assert.throws(() => validateAtlas(invalidV8));
  assert.throws(() => validateAtlas({ ...invalidV8,
    checkpoints: [{ ...old.checkpoints[0] }] }),
  "schema v8 must not silently lose or omit appearance");
});

test("v0.2.21.1 offline icon search, style variants and old IDs coexist", () => {
  const solid = { ...fancy, icon: "solid:mountain" };
  const brand = { ...fancy, icon: "brands:github" };
  const regular = { ...fancy, icon: "regular:address-book" };
  for (const appearance of [solid, brand, regular]) {
    assert.deepEqual(validateCheckpointAppearance(appearance), appearance);
    assert.equal(checkpointIconPath(appearance), null,
      "font glyph icons are not mistaken for missing SVG images");
    assert.ok(checkpointFontIcon(appearance.icon)?.glyph);
  }
  assert.equal(checkpointFontIcon("brands:github").family, "Atlas FA 7 Brands");
  assert.equal(checkpointFontIcon("solid:mountain").weight, 900);
  assert.equal(checkpointFontIcon("regular:address-book").weight, 400);
  assert.equal(findCheckpointIcons("mountain", "solid")
    .some(icon => icon.id === "solid:mountain"), true);
  assert.equal(findCheckpointIcons("github", "brands")
    .some(icon => icon.id === "brands:github"), true);
  assert.equal(findCheckpointIcons("github", "regular").length, 0);
  assert.equal(findCheckpointIcons("not a real icon name").length, 0);
  assert.throws(() => validateCheckpointAppearance({ ...fancy, icon: "brands:fake" }));
  assert.throws(() => validateCheckpointAppearance({ ...fancy, icon: "solid:../mountain" }));
  assert.deepEqual(checkpointMarkerPosition({ x: 53, y: 92 }, solid),
    { x: 53, y: 62 }, "decorative marker floats above the true checkpoint node");
  assert.deepEqual(checkpointMarkerPosition({ x: 53, y: 92 },
    DEFAULT_CHECKPOINT_APPEARANCE), { x: 53, y: 92 },
  "untouched checkpoints remain centered on their original node");
});

test("checkpoint appearance storage requires GM permission and fresh revision", async () => {
  let stored = fixture();
  const scene = {
    getFlag: (module, key) => module === MODULE_ID && key === ATLAS_FLAG ? stored : undefined,
    canUserModify: () => true,
    setFlag: async (_module, _key, value) => { stored = value; }
  };
  const original = globalThis.game;
  try {
    globalThis.game = { user: { isGM: false } };
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: 0
    }), /GM/);
    globalThis.game = { user: { isGM: true } };
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: 5
    }), /changed/);
    const revision = stored.revision;
    await saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: revision
    });
    assert.equal(stored.schemaVersion, 8);
    assert.equal(stored.revision, revision + 1);
    assert.deepEqual(stored.checkpoints[0].appearance, fancy);
    await assert.rejects(saveCheckpointAppearance(scene, {
      checkpointId: stored.checkpoints[0].id, appearance: fancy, expectedRevision: revision
    }), /changed/);
  } finally {
    globalThis.game = original;
  }
});

test("v0.2.21.1 checkpoint editor caps icon buttons and updates live slider value", async () => {
  const previous = { foundry: globalThis.foundry, document: globalThis.document,
    game: globalThis.game, ui: globalThis.ui, window: globalThis.window };
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.style = {};
      this.listeners = new Map();
      this.value = "";
      this.textContent = "";
    }
    append(...items) { for (const item of items) this.appendChild(item); }
    prepend(...items) {
      for (const item of items) {if(item.parentNode)item.parentNode.children=item.parentNode.children.filter(child=>child!==item);item.parentNode = this;}
      this.children.unshift(...items);
    }
    appendChild(item) { if(item.parentNode) item.parentNode.children=item.parentNode.children.filter(child=>child!==item); item.parentNode = this; this.children.push(item); return item; }
    closest(tag) {
      for (let cursor = this; cursor; cursor = cursor.parentNode) {
        if (cursor.tag === tag) return cursor;
      }
      return null;
    }
    replaceChildren(...items) {
      this.children = [];
      this.append(...items);
    }
    querySelector(selector) {
      const match = selector.match(/^([a-z]+)\[name="([^"]+)"\]$/);
      if (!match) return this.children.find(child=>child.tag===selector)??null;
      const search = node => {
        if (node.tag === match[1] && node.name === match[2]) return node;
        for (const child of node.children) {
          const found = search(child);
          if (found) return found;
        }
        return null;
      };
      return search(this);
    }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    setAttribute() {}
    hidePopover(){this.popoverClosed=true;}
    focus(){this.focused=true;}
  }
  const all = root => [root, ...root.children.flatMap(child => all(child))];
  try {
    globalThis.foundry = { applications: { api: {
      ApplicationV2: class { constructor(options) { this.options=options; } }
    } } };
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = { user: { isGM: true }, settings: {
      get: (_scope,key) => key === "measuringUnits" ? "metric" : undefined
    } };
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    globalThis.ui = { notifications: {
      info() {}, error(message) { throw new Error(String(message)); }
    } };
    const { AtlasCheckpointAppearanceEditor } = await import(
      "../scripts/checkpoint-appearance-editor.js");
    const data = upgradeAtlasCheckpointAppearance(fixture());
    let stored = data;
    const scene = { canUserModify: () => true,
      getFlag: (_scope, key) => key === ATLAS_FLAG ? stored : undefined,
      setFlag: async (_scope, _key, value) => { stored = value; } };
    const actions=[];
    const editor = new AtlasCheckpointAppearanceEditor({ scene,
      checkpointId: data.checkpoints[0].id, expectedRevision: data.revision,
      onTerrainAction:async action=>{actions.push(action);},
      onMove:()=>{actions.push("move");},
      onDelete:async()=>false });
    assert.equal(editor.options.position.left,24,
      "checkpoint authoring opens at the left of the canvas");
    assert.equal(editor.options.window.title,"Atlas — Ridge Lookout — Checkpoint Settings",
      "existing Checkpoint settings identify the edited Checkpoint regardless of tab");
    editor.close = async () => {};
    const root = await editor._renderHTML();
    const buttons = all(root).filter(node => node.tag === "button");
    const geographicLink=buttons.find(node=>node.textContent==="Link Territory");
    assert.ok(geographicLink,"Checkpoint Settings supports reverse Territory linking");
    await geographicLink.listeners.get("click")();
    assert.deepEqual(actions,["territory"]);
    assert.ok(buttons.length < 85,
      "initial icon grid must not render over two thousand buttons");
    const slider = all(root).find(node => node.tag === "input" &&
      node.type === "range" && node.min === "12" && node.max === "64");
    const label = all(root).find(node => node.tag === "output");
    assert.ok(slider && label);
    slider.value = "55";
    slider.listeners.get("input")();
    assert.equal(label.textContent, "55 px");
    const markerRow=all(root).find(node=>node.className==="atlas-checkpoint-marker-row");
    const markerControls=markerRow?.children?.[1];
    assert.equal(markerControls?.className,"atlas-checkpoint-marker-controls");
    assert.equal(markerControls.children[0].className.includes("atlas-checkpoint-icon-selector"),true,
      "icon chooser precedes the marker dropdown");
    assert.equal(markerControls.children[1].tag,"select");
    assert.equal(markerRow.children[0].textContent,"Checkpoint marker");
    const regionPanel=all(root).find(node=>node.className==="atlas-checkpoint-terrain-actions");
    assert.deepEqual(regionPanel?.children.map(node=>node.textContent),
      ["Link Territory","Create Terrain Region…"]);
    const roadIdentity=all(root).find(node=>node.className==="atlas-checkpoint-connected-roads");
    assert.ok(roadIdentity);
    assert.equal(roadIdentity.children[0].textContent,"Connected road");
    assert.ok(all(roadIdentity).some(node=>node.textContent==="Hidden mountain pass"));
    const customizationTab=all(root).find(node=>node.tag==="button"&&
      node.textContent==="Customization");
    assert.ok(customizationTab,"Checkpoint appearance tab uses shared terminology");
    const sections=all(root).filter(node=>
      node.className==="atlas-checkpoint-customization-section");
    assert.equal(sections.length,2);
    assert.deepEqual(sections.map(node=>node.children[0].textContent),
      ["Checkpoint settings","Banner information"]);
    assert.equal(sections[0].children[1].children[0].textContent,"Marker size (12–64 px)");
    const mapPreview=all(root).find(node=>node.className==="atlas-checkpoint-preview");
    assert.ok(mapPreview);
    const sample=mapPreview.children[1];
    const labelPreview=sample.children[1];
    const showRoad=all(root).find(node=>node.tag==="input"&&
      node.type==="checkbox");
    const labelMode=all(root).find(node=>node.tag==="select"&&node.value==="off");
    assert.ok(showRoad&&labelMode);
    const bannerSettings=all(root).find(node=>
      node.className==="atlas-checkpoint-banner-settings");
    assert.ok(bannerSettings);
    assert.equal(bannerSettings.children[1].hidden,false,
      "Road-connected checkpoint offers Road name in the banner");
    const bannerType=bannerSettings.children[2].children[0];
    const bannerElevation=bannerSettings.children[3].children[0];
    const bannerTerritory=bannerSettings.children[4].children[1];
    assert.equal(showRoad.disabled,true,"Banner Off disables subordinate Road option");
    assert.equal(bannerType.disabled,true);
    assert.equal(bannerElevation.disabled,true);
    assert.equal(bannerTerritory.disabled,true);
    showRoad.checked=true;labelMode.value="always";
    root.listeners.get("change")();
    assert.equal(showRoad.disabled,false,"re-enabling Banner restores controls");
    assert.equal(bannerType.disabled,false);
    assert.equal(bannerElevation.disabled,false);
    assert.equal(bannerTerritory.disabled,false);
    labelMode.value="off";root.listeners.get("change")();
    assert.equal(showRoad.checked,true,"Banner Off preserves draft choices");
    assert.equal(showRoad.disabled,true);
    assert.equal(labelPreview.hidden,true,"Banner Off hides text only");
    labelMode.value="always";root.listeners.get("change")();
    assert.equal(showRoad.checked,true);
    assert.equal(labelPreview.hidden,false);
    assert.equal(labelPreview.children.length,2,
      "Scene renders Checkpoint name and Road name on separate lines");
    assert.equal(labelPreview.children[0].textContent,"Ridge Lookout");
    assert.equal(labelPreview.children[1].textContent,"Hidden mountain pass");
    assert.ok(labelPreview.children[0].style.cssText.includes("font-weight:700"));
    assert.ok(labelPreview.children[1].style.cssText.includes("font-style:italic"));
    slider.value="24";root.listeners.get("input")();
    const sceneMarker=sample.children[0].children[0];
    assert.equal(sceneMarker.style.fontSize,"24px",
      "map preview uses the authored 24px marker, never the large icon gallery sample");
    assert.equal(sceneMarker.style.width,"24px");
    const independentEditor=new AtlasCheckpointAppearanceEditor({scene,
      expectedRevision:data.revision,
      createDraft:{independent:true,defaultName:"Standalone"},
      onCreate:()=>{}});
    const independentRoot=await independentEditor._renderHTML();
    const independentBanner=all(independentRoot).find(node=>
      node.className==="atlas-checkpoint-banner-settings");
    assert.equal(independentBanner.children[1].hidden,true,
      "Standalone Checkpoints hide Road name without erasing its preference");

    const search = all(root).find(node => node.tag === "input" && node.type === "search");
    search.value = "github";
    search.listeners.get("input")();
    assert.ok(!all(root).some(node => node.tag === "button" &&
      node.title?.startsWith("brands:github — ")),
    "RPG-first mode omits unrelated brand icons");
    const advanced = all(root).find(node => node.tag === "button" &&
      node.textContent === "All / Advanced");
    assert.ok(advanced, "advanced icon catalogue is accessible by a category tab");
    advanced.listeners.get("click")();
    assert.ok(all(root).some(node => node.tag === "button" &&
      node.title?.startsWith("brands:github — ")), "search draws relevant brand glyphs");
    assert.ok(all(root).filter(node => node.tag === "button").length < 85);
    const magicTab = all(root).find(node => node.tag === "button" &&
      node.textContent === "Magic");
    assert.ok(magicTab, "redesigned icon browser includes one-click thematic tabs");
    search.value = "";
    magicTab.listeners.get("click")();
    assert.ok(magicTab, "Magic category is available");
    const magicIcon = all(root).find(node => node.tag === "button" &&
      node.title?.startsWith("solid:wand-magic — "));
    assert.ok(magicIcon);
    magicIcon.listeners.get("click")();
    const preview = all(root).find(node => node.tag === "section" &&
      node.children.some(child => child.tag === "strong"));
    assert.ok(preview?.children[1].textContent.toLowerCase().includes("wand"),
      "selected icon displays its own larger preview and human-readable title");
    const name = all(root).find(node => node.tag === "input" && node.type === "text" &&
      node.value === "Ridge Lookout");
    const elevation = all(root).find(node => node.tag === "input" && node.type === "number");
    const footer = all(root).find(node=>node.className==="atlas-checkpoint-form-actions");
    const footerVisibility=footer.children.find(node=>
      node.className==="atlas-checkpoint-footer-visibility");
    const playerVisible=footerVisibility?.children.find(node=>
      node.tag==="input"&&node.type==="checkbox");
    assert.ok(name&&elevation&&playerVisible,
      "Checkpoint Settings retains the original hidden visibility value in the compact footer");
    assert.ok(!all(root).some(node=>node.textContent==="Player visibility"),
      "General no longer duplicates the footer Show/Hide control");
    const presetRow=all(root).find(node=>node.children?.some(child=>
      child.textContent==="Checkpoint preset"));
    assert.ok(presetRow?.children.some(node=>
      node.style?.cssText?.includes("margin-inline-start:auto")),
      "World preset controls align with the right edge of the General form");
    assert.ok(all(root).some(node=>node.textContent==="Elevation (m)"),
      "metric unit preference yields a meter label when native Scene units are unspecified");
    const moveFooter=footer.children.find(node=>
      node.title==="Move checkpoint");
    assert.ok(moveFooter?.className.includes("atlas-checkpoint-footer-icon"),
      "Move checkpoint is a compact action located in the footer");
    const showFooter=footerVisibility.children.find(node=>node.tag==="button");
    assert.ok(showFooter.className.includes("atlas-checkpoint-footer-icon"));
    assert.equal(showFooter.title,"Show checkpoint");
    assert.equal(showFooter.className.includes("atlas-checkpoint-footer-icon"),true);
    assert.equal(footerVisibility.children.length,2,
      "eye and hidden discovery value are the only footer visibility elements");
    assert.equal(all(footerVisibility).some(node=>/^(Shown|Hidden)$/.test(node.textContent)),false,
      "no visible Shown / Hidden text accompanies the accessible eye icon");
    assert.equal(showFooter.title,showFooter.attributes?.get?.("aria-label")??showFooter.title);
    name.value = "Revealed Lookout";
    elevation.value = "640";
    const show=buttons.find(node=>node.title==="Show checkpoint");
    assert.ok(show,"hidden checkpoint offers an accessible show icon");
    await show.listeners.get("click")();
    assert.equal(playerVisible.checked,true);
    assert.equal(show.title,"Hide checkpoint");
    assert.equal(stored.revision,data.revision,"visibility remains staged until Save Checkpoint");
    const save = all(root).find(node => node.tag === "button" &&
      node.title === "Save Checkpoint");
    assert.ok(save?.className.includes("atlas-ui-icon-button"),
      "Save uses the shared icon action without changing its handler");
    assert.equal(save.type,"button","Save cannot accidentally submit the form");
    assert.ok(all(root).some(node=>node.tag==="button"&&node.textContent==="Save as preset…"),
      "preset saving is explicit in the footer");
    assert.equal(footer.children.at(-3).textContent,"Save as preset…",
      "saving a World preset remains distinct from saving the Checkpoint");
    assert.equal(footer.children.at(-2),save,
      "Save is immediately before the destructive Delete action");
    assert.equal(footer.children.at(-1).title,"Delete checkpoint",
      "Delete is the last element in DOM and keyboard order");
    assert.equal(footer.children.at(-1).className.includes("atlas-checkpoint-footer-delete"),true);
    assert.ok(footer.children.indexOf(footerVisibility)<footer.children.indexOf(save),
      "editing controls appear before Save and Delete");
    assert.equal(footer.children.at(-2),save);
    assert.equal(name.autofocus,true);
    save.listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stored.schemaVersion, 9);
    assert.equal(stored.revision, data.revision + 1);
    assert.equal(stored.checkpoints[0].name, "Revealed Lookout");
    assert.equal(stored.checkpoints[0].elevationMeters, 640);
    assert.equal(stored.checkpoints[0].playerVisible, true);
  } finally {
    Object.assign(globalThis, previous);
  }
});


test("v0.2.29 border colors default black, legacy styles remain readable", () => {
  assert.equal(DEFAULT_CHECKPOINT_APPEARANCE.borderColor, "#000000");
  const legacy = { ...fancy };
  delete legacy.borderColor;
  assert.equal(validateCheckpointAppearance(legacy).borderColor, "#000000");
  assert.equal(legacy.borderColor, undefined, "read-only compatibility must not rewrite old flags");
  assert.equal(validateCheckpointAppearance({ ...fancy, borderColor: "#d34e55" }).borderColor, "#d34e55");
  assert.throws(() => validateCheckpointAppearance({ ...fancy, borderColor: "maroon" }));
});


test("v0.2.29.1 icon markers float above the road graph anchor",()=>{
  const point={x:100,y:200};
  const appearance={...DEFAULT_CHECKPOINT_APPEARANCE,type:"fa",size:24};
  assert.equal(checkpointMarkerPosition(point,appearance,1).y,174);
  assert.deepEqual(point,{x:100,y:200});
});
