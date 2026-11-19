import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
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
      this.attributes=new Map();
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
    setAttribute(name,value){this.attributes.set(name,String(value));}
    focus(){this.focused=true;}
    hidePopover(){this.popoverClosed=true;}
    focus(){this.focused=true;}
  }
  const all = root => [root, ...root.children.flatMap(child => all(child))];
  const confirmations=[];
  let approveVisibility=false;
  try {
    globalThis.foundry = { applications: { api: {
      ApplicationV2: class { constructor(options) { this.options=options; } },
      DialogV2: {confirm:async config=>{
        confirmations.push(config);return approveVisibility;
      }}
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
    const sidecars=new Map();
    const scene = { id:"scene-one",canUserModify: () => true,
      getFlag: (_scope, key) => key === ATLAS_FLAG ? stored : sidecars.get(key),
      setFlag: async (_scope, key, value) => {
        if(key===ATLAS_FLAG)stored=value;
        else sidecars.set(key,value);
      } };
    const actions=[];
    const editor = new AtlasCheckpointAppearanceEditor({ scene,
      checkpointId: data.checkpoints[0].id, expectedRevision: data.revision,
      onTerrainAction:async action=>{actions.push(action);},
      onMove:()=>{actions.push("move");},
      onLocate:()=>{actions.push("locate");},
      onDelete:async()=>false });
    assert.equal(editor.options.position.left,24,
      "checkpoint authoring opens at the left of the canvas");
    assert.equal(editor.options.window.title,"Atlas — Ridge Lookout — Map Marker Settings",
      "existing Map Marker settings identify the edited Checkpoint regardless of tab");
    const second=new AtlasCheckpointAppearanceEditor({scene,
      checkpointId:"other-marker",expectedRevision:data.revision});
    assert.notEqual(editor.options.id,second.options.id,
      "different Map Markers get distinct Foundry application window identities");
    let closeCalls=0;
    editor.close = async () => {closeCalls++;};
    const root = await editor._renderHTML();
    const buttons = all(root).filter(node => node.tag === "button");
    const geographicLink=buttons.find(node=>node.textContent==="Link Territory");
    assert.ok(geographicLink,"Map Marker Settings supports reverse Territory linking");
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
    assert.equal(markerRow.children[0].textContent,"Map Marker icon");
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
    const tabBar=all(root).find(node=>node.attributes?.get("role")==="tablist"&&
      node.attributes?.get("aria-label")==="Map Marker settings sections");
    assert.ok(tabBar,"Map Marker settings expose a named keyboard-accessible tablist");
    const markerTabs=tabBar.children;
    const markerPages=all(root).filter(node=>node.attributes?.get("role")==="tabpanel");
    assert.deepEqual(markerTabs.map(tab=>tab.textContent),
      ["General","Customization","Terrain Region","Transportation"]);
    assert.equal(markerPages.length,4);
    for(let index=0;index<4;index++){
      assert.equal(markerTabs[index].attributes.get("aria-controls"),markerPages[index].id);
      assert.equal(markerPages[index].attributes.get("aria-labelledby"),markerTabs[index].id);
    }
    const draftName=all(root).find(node=>node.tag==="input"&&node.value==="Ridge Lookout");
    draftName.value="Uncommitted title";
    let prevented=0;
    tabBar.listeners.get("keydown")({key:"End",target:markerTabs[0],
      preventDefault(){prevented++;}});
    assert.equal(markerTabs[3].focused,true);
    assert.equal(markerPages[3].hidden,false);
    assert.equal(markerTabs[3].tabIndex,0);
    tabBar.listeners.get("keydown")({key:"Home",target:markerTabs[3],
      preventDefault(){prevented++;}});
    assert.equal(markerTabs[0].focused,true);
    assert.equal(markerPages[0].hidden,false);
    assert.equal(markerTabs[3].tabIndex,-1);
    markerTabs[1].listeners.get("click")();
    assert.equal(markerPages[1].hidden,false);
    markerTabs[0].listeners.get("click")();
    assert.equal(draftName.value,"Uncommitted title",
      "switching Map Marker tabs keeps the same unsaved input mounted");
    draftName.value="Ridge Lookout";
    assert.equal(prevented,2);
    assert.equal(stored.revision,data.revision,"tab navigation cannot write Scene flags");
    const sections=all(root).filter(node=>
      node.className==="atlas-checkpoint-customization-section");
    assert.equal(sections.length,2);
    assert.deepEqual(sections.map(node=>node.children[0].textContent),
      ["Map Marker settings","Banner information"]);
    assert.equal(sections[0].children[1].children[0].textContent,"Marker size (12–64 px)");
    const borderRow=all(root).find(node=>node.className==="atlas-checkpoint-border-inline");
    assert.ok(borderRow,"Border Enabled and retained Border Color share one row");
    assert.equal(borderRow.children.length,2);
    const borderEnabled=borderRow.children[0].children[1];
    const borderColor=borderRow.children[1].children[1];
    assert.equal(borderEnabled.type,"checkbox");
    assert.equal(borderEnabled.checked,true,"legacy marker border stays enabled");
    assert.equal(borderColor.type,"color");
    assert.equal(borderColor.disabled,false);
    const originalBorderColor=borderColor.value;
    borderColor.value="#aabbcc";
    borderEnabled.checked=false;
    root.listeners.get("change")();
    assert.equal(borderColor.disabled,true,"Off disables the swatch, not its draft");
    assert.equal(borderColor.value,"#aabbcc");
    borderEnabled.checked=true;
    root.listeners.get("change")();
    assert.equal(borderColor.disabled,false);
    assert.equal(borderColor.value,"#aabbcc","On restores the retained border swatch");
    borderColor.value=originalBorderColor;
    root.listeners.get("input")();
    const mapPreview=all(root).find(node=>node.className==="atlas-checkpoint-preview");
    assert.ok(mapPreview);
    const sample=mapPreview.children[1];
    const labelPreview=sample.children[1];
    const bannerSettings=all(root).find(node=>
      node.className==="atlas-checkpoint-banner-settings");
    const showRoad=bannerSettings.children[1].children[0];
    const labelMode=all(root).find(node=>node.tag==="select"&&node.value==="off");
    assert.ok(showRoad&&labelMode);
    const inlineBanner=all(root).find(node=>
      node.className==="atlas-checkpoint-banner-inline");
    assert.ok(inlineBanner,"display and color share one banner row");
    assert.equal(sections[1].children[1].children[0],inlineBanner,
      "banner row is the first field inside the existing Banner information section");
    assert.equal(inlineBanner.children.length,2,
      "display and text color retain separate native labels and tab stops");
    assert.equal(inlineBanner.children[0].children[0].textContent,"Banner display");
    assert.equal(inlineBanner.children[1].children[0].textContent,"Banner text color");
    assert.equal(inlineBanner.children[0].children[1],labelMode);
    const bannerTextColor=inlineBanner.children[1].children[1];
    assert.equal(bannerTextColor.type,"color");
    assert.equal(bannerTextColor.disabled,true,
      "Banner Off disables color editing without changing the selected color");
    const originalBannerColor=bannerTextColor.value;
    const css=readFileSync(new URL("../styles/atlas-ui.css",import.meta.url),"utf8");
    assert.ok(css.includes(".atlas-checkpoint-banner-inline {")&&
      css.includes("display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;"),
      "the two labeled controls share a responsive horizontal row");
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
    assert.equal(bannerTextColor.disabled,false);
    bannerTextColor.value="#cc55ee";
    root.listeners.get("input")();
    assert.equal(labelPreview.style.color,"#cc55ee",
      "banner preview uses the unsaved text-color draft");
    assert.equal(showRoad.disabled,false,"re-enabling Banner restores controls");
    assert.equal(bannerType.disabled,false);
    assert.equal(bannerElevation.disabled,false);
    assert.equal(bannerTerritory.disabled,false);
    labelMode.value="off";root.listeners.get("change")();
    assert.equal(showRoad.checked,true,"Banner Off preserves draft choices");
    assert.equal(showRoad.disabled,true);
    assert.equal(bannerTextColor.disabled,true);
    assert.equal(bannerTextColor.value,"#cc55ee",
      "Banner Off retains the unsaved text color");
    assert.equal(labelPreview.hidden,true,"Banner Off hides text only");
    labelMode.value="always";root.listeners.get("change")();
    assert.equal(bannerTextColor.disabled,false);
    assert.equal(bannerTextColor.value,"#cc55ee",
      "Banner On restores the retained color draft");
    assert.equal(labelPreview.style.color,"#cc55ee");
    bannerTextColor.value=originalBannerColor;
    root.listeners.get("input")();
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
    const draftFooter=all(independentRoot).find(node=>
      node.className==="atlas-checkpoint-form-actions");
    const draftLocate=draftFooter.children[0].children[0];
    assert.equal(draftLocate.title,"Locate unavailable until Map Marker is saved");
    assert.equal(draftLocate.disabled,true,
      "unsaved new Map Marker must never invoke a misleading Locate action");
    assert.equal(draftFooter.children[1].children.at(-1).title,"Create Map Marker",
      "new marker creation has no destructive Delete action");

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
    assert.equal(root.className,"atlas-checkpoint-settings-root");
    assert.equal(root.children.at(-1),footer,
      "footer remains a direct sibling outside every scrollable tab body");
    assert.ok(root.style.cssText.includes("overflow:hidden"));
    assert.equal(all(root).filter(node=>node.className?.includes?.(
      "atlas-checkpoint-settings-page")).length,4);
    assert.ok(all(root).filter(node=>node.className?.includes?.(
      "atlas-checkpoint-settings-page")).every(node=>node.style.overflowY==="auto"));
    const leftActions=footer.children[0],rightActions=footer.children[1];
    assert.equal(footer.children.length,2,
      "one anchored footer holds separate left/right DOM action groups");
    assert.equal(leftActions.className,"atlas-checkpoint-footer-left");
    assert.equal(rightActions.className,"atlas-checkpoint-footer-right");
    const footerVisibility=leftActions.children.find(node=>
      node.className==="atlas-checkpoint-footer-visibility");
    const playerVisible=footerVisibility?.children.find(node=>
      node.tag==="input"&&node.type==="checkbox");
    assert.ok(name&&elevation&&playerVisible,
      "Checkpoint Settings retains the original hidden visibility value in the compact footer");
    assert.ok(!all(root).some(node=>node.textContent==="Player visibility"),
      "General no longer duplicates the footer Show/Hide control");
    const presetRow=all(root).find(node=>node.children?.some(child=>
      child.textContent==="Map Marker preset"));
    assert.ok(presetRow?.children.some(node=>
      node.style?.cssText?.includes("margin-inline-start:auto")),
      "World preset controls align with the right edge of the General form");
    assert.ok(all(root).some(node=>node.textContent==="Elevation (m)"),
      "metric unit preference yields a meter label when native Scene units are unspecified");
    const moveFooter=leftActions.children.find(node=>
      node.title==="Move Map Marker");
    assert.ok(moveFooter?.className.includes("atlas-checkpoint-footer-icon"),
      "Move Map Marker is a compact action located in the footer");
    assert.deepEqual(leftActions.children.map(node=>
      node.className==="atlas-checkpoint-footer-visibility"?"Visibility":node.title),
      ["Locate Map Marker","Visibility","Move Map Marker"],
      "Locate, visibility and Move keep actual DOM/keyboard order");
    const locate=leftActions.children[0];
    assert.equal(locate.disabled,false);
    const showFooter=footerVisibility.children.find(node=>node.tag==="button");
    assert.ok(showFooter.className.includes("atlas-checkpoint-footer-icon"));
    assert.equal(showFooter.title,"Show Map Marker");
    assert.equal(showFooter.className.includes("atlas-checkpoint-footer-icon"),true);
    assert.equal(footerVisibility.children.length,2,
      "eye and hidden discovery value are the only footer visibility elements");
    assert.equal(all(footerVisibility).some(node=>/^(Shown|Hidden)$/.test(node.textContent)),false,
      "no visible Shown / Hidden text accompanies the accessible eye icon");
    assert.equal(showFooter.title,showFooter.attributes?.get?.("aria-label")??showFooter.title);
    name.value = "Revealed Lookout";
    elevation.value = "640";
    await locate.listeners.get("click")();
    assert.deepEqual(actions,["territory","locate"],
      "Locate delegates to the injected read-only camera action");
    assert.equal(name.value,"Revealed Lookout",
      "Locate preserves the current unsaved Map Marker draft");
    assert.equal(elevation.value,"640");
    assert.equal(stored.revision,data.revision,"Locate does not persist Atlas data");
    assert.equal(closeCalls,0,"Locate does not invoke the dirty-close guard");
    const show=buttons.find(node=>node.title==="Show Map Marker");
    assert.ok(show,"hidden checkpoint offers an accessible show icon");
    await show.listeners.get("click")();
    assert.equal(playerVisible.checked,false,
      "Cancel or X must keep the original staged player visibility");
    assert.equal(confirmations.length,1);
    assert.equal(confirmations[0].content.tag,"div");
    assert.match(confirmations[0].content.children[0].textContent,/Revealed Lookout/,
      "visibility confirmation identifies the current unsaved Map Marker draft");
    assert.equal(stored.revision,data.revision,"cancel cannot write to Scene");
    approveVisibility=true;
    await show.listeners.get("click")();
    assert.equal(playerVisible.checked,true);
    assert.equal(show.title,"Hide Map Marker");
    assert.equal(stored.revision,data.revision,"visibility remains staged until Save Checkpoint");
    const save = all(root).find(node => node.tag === "button" &&
      node.title === "Save Map Marker");
    assert.ok(save?.className.includes("atlas-ui-icon-button"),
      "Save uses the shared icon action without changing its handler");
    assert.equal(save.type,"button","Save cannot accidentally submit the form");
    assert.equal(rightActions.children[0].textContent,"Save as preset…",
      "saving a World preset remains distinct from saving the Map Marker");
    assert.equal(rightActions.children[1],save,
      "Save is immediately before the destructive Delete action");
    assert.equal(rightActions.children[2].title,"Delete Map Marker",
      "Delete is the final control in DOM and keyboard order");
    assert.equal(rightActions.children[2].className.includes("atlas-checkpoint-footer-delete"),true);
    assert.equal(rightActions.children.length,3);
    assert.equal(footer.children.indexOf(leftActions),0,
      "editing controls always precede Save and Delete");
    assert.equal(name.autofocus,true);
    save.listeners.get("click")();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stored.schemaVersion, 9);
    assert.equal(stored.revision, data.revision + 1);
    assert.equal(stored.checkpoints[0].name, "Revealed Lookout");
    assert.equal(stored.checkpoints[0].elevationMeters, 640);
    assert.equal(stored.checkpoints[0].playerVisible, true);
    // Unlike an existing unchanged marker, an unsaved new marker may have a
    // stale graph anchor. It must still require the original Scene revision.
    const createErrors=[];
    const priorNotifyError=globalThis.ui.notifications.error;
    globalThis.ui.notifications.error=message=>createErrors.push(String(message));
    const staleCreate=all(independentRoot).find(node=>
      node.tag==="button"&&node.title==="Create Map Marker");
    staleCreate.listeners.get("click")();
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(createErrors.join("\n"),/Scene Atlas changed/);
    assert.equal(independentEditor.createResolved,false,
      "stale New Map Marker must never send a creation config");
    globalThis.ui.notifications.error=priorNotifyError;
    // #412: A deliberate preset change applies its defaults, but changing the
    // marker category afterwards must not silently select another preset or
    // wipe the GM's unrelated edits.
    const typeRow=all(root).find(node=>node.children?.some(child=>
      child.textContent==="Map Marker type"));
    const typeSelect=all(typeRow).find(node=>node.tag==="select");
    const presetSelect=all(presetRow).find(node=>node.tag==="select");
    assert.ok(typeSelect&&presetSelect);
    assert.ok(presetSelect.listeners.has("change"),
      "Change preset remains the explicit defaults-application action");
    presetSelect.value="checkpoint-bridge";
    presetSelect.listeners.get("change")();
    assert.equal(typeSelect.value,"bridge",
      "an explicit preset selection still changes the staged marker type");
    const assignedPreset=presetSelect.value;
    showRoad.checked=true;
    playerVisible.checked=true;
    name.value="Custom bridge lookout";
    const beforeCategoryEdit=JSON.stringify(stored);
    typeSelect.value="town";
    typeSelect.listeners.get("change")?.();
    root.listeners.get("change")();
    assert.equal(typeSelect.value,"town");
    assert.equal(presetSelect.value,assignedPreset,
      "changing marker type must retain its selected World preset");
    assert.equal(showRoad.checked,true,
      "changing marker type must not reset customized banner settings");
    assert.equal(playerVisible.checked,true,
      "changing marker type must not reset visibility");
    assert.equal(name.value,"Custom bridge lookout",
      "changing marker type must not overwrite the marker's other fields");
    assert.equal(JSON.stringify(stored),beforeCategoryEdit,
      "editing the type remains a draft with no Scene writes");
    editor.window={title:{textContent:editor.options.window.title}};
    stored={...stored,checkpoints:stored.checkpoints.map(cp=>({...cp,
      name:"Newly Renamed Lookout"}))};
    const revision=stored.revision;
    await editor._renderHTML();
    await editor._onRender();
    assert.equal(editor.window.title.textContent,
      "Atlas — Newly Renamed Lookout — Map Marker Settings",
      "committed external rename refreshes an open editor header on render");
    assert.equal(stored.revision,revision,
      "refreshing the title never writes an Atlas Scene or changes its revision");

    // Owner regression: The Eyrie and Dirwest editors stay open together.
    // Distinct snapshots may save sequentially without reverting each other;
    // a stale snapshot of the SAME Map Marker still fails closed.
    stored=addRoadCheckpoint(stored,{
      roadId:stored.roads[0].id,
      candidate:{kind:"node",nodeId:stored.segments[0].to},
      name:"Dirwest",elevationMeters:120,idFactory:()=>"dirwest-marker"
    });
    const eyrieId=stored.checkpoints[0].id;
    const dirwestId=stored.checkpoints.find(cp=>cp.name==="Dirwest").id;
    const firstWindow=new AtlasCheckpointAppearanceEditor({scene,
      checkpointId:eyrieId,expectedRevision:stored.revision});
    const secondWindow=new AtlasCheckpointAppearanceEditor({scene,
      checkpointId:dirwestId,expectedRevision:stored.revision});
    firstWindow.close=async()=>{};secondWindow.close=async()=>{};
    const firstForm=await firstWindow._renderHTML();
    const secondForm=await secondWindow._renderHTML();
    const markerType=root=>all(root).find(node=>node.tag==="select"&&
      node.title?.startsWith("Map Marker type is independent"));
    markerType(firstForm).value="city";
    markerType(secondForm).value="village";
    const savedName=root=>all(root).find(node=>node.tag==="input"&&node.type==="text"&&
      ["Newly Renamed Lookout","Dirwest","Changed Eyrie","Changed Dirwest",
        "Attempted stale overwrite"].includes(node.value));
    const saveForm=async(root,nextName)=>{
      const input=savedName(root);
      assert.ok(input);
      input.value=nextName;
      const button=all(root).find(node=>node.tag==="button"&&node.title==="Save Map Marker");
      button.listeners.get("click")();
      await new Promise(resolve=>setImmediate(resolve));
    };
    const beforeSequential=stored.revision;
    await saveForm(firstForm,"Changed Eyrie");
    assert.equal(stored.revision,beforeSequential+1);
    await saveForm(secondForm,"Changed Dirwest");
    assert.equal(stored.revision,beforeSequential+2);
    assert.equal(stored.checkpoints.find(cp=>cp.id===eyrieId).name,"Changed Eyrie");
    assert.equal(stored.checkpoints.find(cp=>cp.id===dirwestId).name,"Changed Dirwest",
      "saving a second open editor preserves the first marker's committed change");
    assert.equal(sidecars.get("checkpointCategories")?.[eyrieId],"city");
    assert.equal(sidecars.get("checkpointCategories")?.[dirwestId],"village",
      "sidecar category writes merge separate targets without losing the first");

    const live=new AtlasCheckpointAppearanceEditor({scene,
      checkpointId:dirwestId,expectedRevision:stored.revision});
    const stale=new AtlasCheckpointAppearanceEditor({scene,
      checkpointId:dirwestId,expectedRevision:stored.revision});
    live.close=async()=>{};stale.close=async()=>{};
    const liveForm=await live._renderHTML();
    const staleForm=await stale._renderHTML();
    await saveForm(liveForm,"Updated by Another Editor");
    const conflictRevision=stored.revision;
    const errors=[];
    globalThis.ui.notifications.error=message=>errors.push(String(message));
    await saveForm(staleForm,"Attempted stale overwrite");
    assert.match(errors.join("\n"),/This Map Marker or its settings changed elsewhere/);
    assert.equal(stored.revision,conflictRevision,
      "stale same-target Save never reaches the revision writer");
    assert.equal(stored.checkpoints.find(cp=>cp.id===dirwestId).name,
      "Updated by Another Editor");
    assert.equal(savedName(staleForm).value,"Attempted stale overwrite",
      "a refused Save leaves the unsaved draft available to the GM");
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
  assert.equal(DEFAULT_CHECKPOINT_APPEARANCE.borderEnabled,true,
    "previously saved Map Markers rendered with a border");
  const legacyStyle={...fancy};delete legacyStyle.borderEnabled;
  assert.equal(validateCheckpointAppearance(legacyStyle).borderEnabled,true);
  assert.equal(Object.hasOwn(legacyStyle,"borderEnabled"),false,
    "reading a legacy Scene flag must not migrate or change it");
  assert.equal(validateCheckpointAppearance({...fancy,borderEnabled:false}).borderEnabled,false);
  for(const invalid of [null,0,"false",{},undefined])
    assert.throws(()=>validateCheckpointAppearance({...fancy,borderEnabled:invalid}),
      /border enabled/,"border enable is an explicit strict boolean, not a color sentinel");
});


test("v0.2.29.1 icon markers float above the road graph anchor",()=>{
  const point={x:100,y:200};
  const appearance={...DEFAULT_CHECKPOINT_APPEARANCE,type:"fa",size:24};
  assert.equal(checkpointMarkerPosition(point,appearance,1).y,174);
  assert.deepEqual(point,{x:100,y:200});
});
