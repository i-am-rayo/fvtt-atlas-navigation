import assert from "node:assert/strict";
import test from "node:test";

globalThis.foundry = { applications: { api: { ApplicationV2: class {
  close() { this.closed = true; }
} } } };
const { AtlasRoadAppearanceSettings, roadAppearanceForm, roadAppearanceFromForm,
  registerWorldRoadAppearance } = await import("../scripts/road-appearance-settings.js");
const { DEFAULT_ROAD_APPEARANCE, ROAD_CURVE_SETTING }
  = await import("../scripts/road-appearance.js");

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.listeners = new Map();
    this.style = {}; this.dataset = {}; this.value = "";
  }
  appendChild(child) { this.children.push(child); }
  append(...children) { this.children.push(...children); }
  get lastElementChild() { return this.children.at(-1); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  querySelector(selector) {
    if(selector!=="svg")return null;
    const search=node=>node.tag==="svg"?node:
      node.children.map(search).find(Boolean)??null;
    return search(this);
  }
  querySelectorAll(selector) {
    if (selector !== "[name]") return [];
    const found = [];
    const visit = entry => {
      if (entry.name) found.push(entry);
      for (const child of entry.children) visit(child);
    };
    visit(this);
    return found;
  }
}

test("World Road Appearance settings show Land/Air/Water separately and only save on explicit click", async () => {
  const previous = { document: globalThis.document, game: globalThis.game,
    ui: globalThis.ui };
  let writes = 0, stored, menu;
  const legacy = Object.fromEntries(Object.entries(DEFAULT_ROAD_APPEARANCE)
    .filter(([key]) => ["color", "width", "opacity", "pattern", "labelVisibility"].includes(key)));
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.game = {
      user: { isGM: true },
      settings: {
        get: () => legacy,
        register() {}, registerMenu(_module, _name, value) { menu = value; },
        async set(_module, _name, value) { stored = value; writes++; }
      }
    };
    globalThis.ui = { notifications: { info() {}, error(m) { throw Error(m); } } };
    registerWorldRoadAppearance();
    assert.equal(menu.name,"Atlas — Road Appearance");
    assert.equal(menu.label,"Configure Road Appearance");
    assert.match(menu.hint,/does not edit native Region/);
    const app = new AtlasRoadAppearanceSettings();
    const root = await app._renderHTML();
    const nav=root.children.find(child=>child.className==="atlas-world-category-tabs");
    const scroll=root.children.find(child=>child.className==="atlas-world-category-scroll");
    assert.deepEqual(nav.children.map(tab=>tab.textContent),["Land","Water","Air"]);
    const groups=scroll.children.filter(child=>child.tag==="fieldset");
    assert.equal(groups.length,3);
    assert.deepEqual(groups.map(panel=>panel.hidden),[false,true,true]);
    assert.equal(writes,0);
    const landColor=groups[0].children[1].querySelectorAll("[name]")
      .find(field=>field.name==="atlasRoadColor");
    landColor.value="#bb6622";
    nav.children[1].listeners.get("click")();
    assert.deepEqual(groups.map(panel=>panel.hidden),[true,false,true]);
    nav.children[0].listeners.get("click")();
    assert.equal(landColor.value,"#bb6622","switching keeps the existing unsaved field");
    assert.equal(writes,0,"tab switching cannot persist World settings");
    assert.equal(writes, 0, "opening legacy flat World settings must not migrate");
    const airForm = groups[2].children[1];
    const fields = airForm.querySelectorAll("[name]");
    assert.ok(fields.some(field => field.name === "atlasRoadTextColor"));
    fields.find(field => field.name === "atlasRoadColor").value = "#f0a041";
    fields.find(field => field.name === "atlasRoadTextColor").value = "#121212";
    const button = root.children.at(-1).children[0];
    await button.listeners.get("click")();
    assert.equal(writes, 1);
    assert.equal(app.closed, true);
    assert.equal(stored.schemaVersion, 2);
    assert.equal(stored.profiles.air.color, "#f0a041");
    assert.equal(stored.profiles.air.textColor, "#121212");
    assert.equal(stored.profiles.land.color, "#bb6622");
    assert.equal(stored.profiles.water.color, legacy.color);
  } finally { Object.assign(globalThis, previous); }
});

test("road DialogV2 form serializes label color through explicit input defaults", () => {
  const oldDocument = globalThis.document;
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    const style = { ...DEFAULT_ROAD_APPEARANCE, textColor: "#fefefe" };
    const values = roadAppearanceForm(style).querySelectorAll("[name]");
    const serialized = Object.fromEntries(values.map(field => [field.name, field.defaultValue ?? field.value]));
    assert.equal(roadAppearanceFromForm(serialized).textColor, "#fefefe");
  } finally { globalThis.document = oldDocument; }
});

test("World Road Appearance saves the actual border checkbox and reflected select defaults",async()=>{
  const previous={document:globalThis.document,game:globalThis.game,ui:globalThis.ui};
  let stored;
  try {
    globalThis.document={createElement:tag=>new Element(tag)};
    const legacy=Object.fromEntries(Object.entries(DEFAULT_ROAD_APPEARANCE)
      .filter(([key])=>["color","width","opacity","pattern","labelVisibility"].includes(key)));
    globalThis.game={user:{isGM:true},settings:{get:()=>legacy,
      async set(_module,_name,value){stored=value;}}};
    globalThis.ui={notifications:{info(){},error(error){throw Error(error);}}};
    const app=new AtlasRoadAppearanceSettings();
    const root=await app._renderHTML();
    const land=root.children.find(child=>child.className==="atlas-world-category-scroll")
      .children[0].children[1];
    const fields=land.querySelectorAll("[name]");
    const border=fields.find(field=>field.name==="atlasRoadBorderEnabled");
    border.checked=false;
    const labels=fields.find(field=>field.name==="atlasRoadLabels");
    assert.equal(labels.children.filter(option=>option.defaultSelected).length,1);
    await root.children.at(-1).children[0].listeners.get("click")();
    assert.equal(stored.profiles.land.borderEnabled,false,
      "unchecked HTML checkbox must not keep its fixed value attribute");
  }finally{Object.assign(globalThis,previous);}
});

test("v0.2.25 global curvature offers restricted World presets and live refresh", () => {
  const previous = globalThis.game;
  const registered = new Map();
  let repaints = 0;
  try {
    globalThis.game = { settings: {
      register(_module, key, options) { registered.set(key, options); },
      registerMenu() {}
    } };
    registerWorldRoadAppearance(() => repaints++);
    const curve = registered.get(ROAD_CURVE_SETTING);
    assert.equal(curve.scope, "world");
    assert.equal(curve.config, true);
    assert.equal(curve.type, String);
    assert.equal(curve.default, "strong");
    assert.deepEqual(Object.keys(curve.choices), ["off", "gentle", "moderate", "strong"]);
    curve.onChange("moderate");
    assert.equal(repaints, 1, "changing only curvature repaints existing roads");
  } finally { globalThis.game = previous; }
});

test("Road Customization pairs numeric width/percent and previews without persistence",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    const form=roadAppearanceForm(DEFAULT_ROAD_APPEARANCE);
    const groups=form.children.filter(item=>item.tag==="fieldset");
    assert.deepEqual(groups.map(item=>item.children[0].textContent),
      ["Road settings","Road name styling","Map preview"]);
    const fields=form.querySelectorAll("[name]");
    const width=fields.find(item=>item.name==="atlasRoadWidth");
    const opacity=fields.find(item=>item.name==="atlasRoadOpacityPercent");
    assert.equal(width.value,"4");
    assert.equal(opacity.value,"90");
    const preview=groups[2];
    const stroke=preview.children[1].children[1];
    const name=preview.children[1].children[2];
    assert.equal(name.tag,"text","preview Road name is on the Road SVG, not below it");
    assert.equal(name.textContent,"Road name");
    const borderPair=groups[0].children.find(child=>child.className==="atlas-road-inline-colors");
    assert.equal(borderPair.children.length,2);
    const border=fields.find(field=>field.name==="atlasRoadBorderEnabled");
    const swatch=fields.find(field=>field.name==="atlasRoadBorderColor");
    border.checked=false;swatch.value="#aaccff";form.listeners.get("change")();
    assert.equal(swatch.value,"#aaccff","Off does not clear the chosen border color");
    assert.equal(preview.children[1].children[0].style.opacity,"0");
    border.checked=true;form.listeners.get("change")();
    assert.equal(preview.children[1].children[0].style.stroke,"#aaccff",
      "On reuses the stored border swatch without changing it");
    width.value="8";
    opacity.value="35";
    form.listeners.get("input")();
    assert.equal(stroke.style.strokeWidth,"8px");
    assert.equal(stroke.style.opacity,"0.35");
    const values=Object.fromEntries(fields.map(item=>[item.name,
      item.type==="checkbox"?item.checked:item.value]));
    assert.equal(roadAppearanceFromForm(values).width,8);
    assert.equal(roadAppearanceFromForm(values).opacity,.35);
    values.atlasRoadOpacityPercent="";
    assert.throws(()=>roadAppearanceFromForm(values),/Enter a valid number/);
    values.atlasRoadOpacityPercent="105";
    assert.throws(()=>roadAppearanceFromForm(values),/between/);
  }finally{globalThis.document=previous;}
});

test("Road Settings preview opens with native read-only SVG className",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={
      createElement:tag=>new Element(tag),
      createElementNS:(namespace,tag)=>{
        assert.equal(namespace,"http://www.w3.org/2000/svg");
        const node=new Element(tag);
        // In browsers SVGElement.className is a read-only SVGAnimatedString,
        // unlike HTMLElement.className. Assigning to it throws in modules.
        Object.defineProperty(node,"className",{get:()=>({baseVal:node.svgClass??""})});
        node.setAttribute=(key,value)=>{if(key==="class")node.svgClass=value;};
        return node;
      }
    };
    const form=roadAppearanceForm(DEFAULT_ROAD_APPEARANCE);
    const svg=form.querySelector("svg");
    const text=svg.children[2];
    assert.equal(text.tag,"text");
    assert.equal(text.className.baseVal,"atlas-road-preview-name");
    assert.equal(text.style.fill,DEFAULT_ROAD_APPEARANCE.textColor);
    assert.throws(()=>{text.className="incorrect";},TypeError,
      "regression mock must reject the formerly crashing assignment");
  }finally{globalThis.document=previous;}
});
