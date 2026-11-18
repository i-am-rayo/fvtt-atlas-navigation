import { MODULE_ID } from "./atlas-storage.js";
import { DEFAULT_WORLD_ROAD_APPEARANCE, ROAD_APPEARANCE_SETTING, readWorldRoadAppearance,
  ROAD_LINE_PATTERNS, ROAD_LABEL_VISIBILITY, ROAD_APPEARANCE_MODES,
  ROAD_CURVE_SETTING, ROAD_CURVE_PRESETS, DEFAULT_ROAD_CURVE_PRESET,
  validateRoadAppearance, validateWorldRoadAppearance }
  from "./road-appearance.js";
import { createSettingsSelect } from "./settings-select.js";
import { createSettingsCategoryTabs } from "./settings-category-tabs.js";
import { createSettingsInput, settingsFormValues } from "./settings-input.js";
import { createSettingsNumberRange,parseBoundedRangeDraft } from "./settings-number-range.js";

const element = (tag, value = "") => {
  const result = document.createElement(tag);
  if (value) result.textContent = value;
  return result;
};

/** Reused by the world editor and one-road override; plain DOM for DialogV2. */
export function roadAppearanceForm(appearance) {
  const current=validateRoadAppearance(appearance);
  const root=element("div");
  root.className="atlas-road-customization";
  root.style.cssText="display:grid;gap:.7rem;min-width:0;";
  const group=title=>{
    const section=element("fieldset");
    section.className="atlas-road-customization-section";
    section.appendChild(element("legend",title));
    root.appendChild(section);
    return section;
  };
  let section=group("Road settings");
  const input=(label,name,type,value,options={})=>{
    const row=element("label");row.className="form-group";
    row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:1rem;";
    row.appendChild(element("span",label));
    let field;
    if(type==="select"){
      field=createSettingsSelect(options.choices.map(choice=>
        [choice,choice.charAt(0).toUpperCase()+choice.slice(1)]),{selectedId:value,name});
    }else if(name==="atlasRoadWidth"||name==="atlasRoadOpacity"){
      const percent=name==="atlasRoadOpacity";
      const range=createSettingsNumberRange(percent?value*100:value,{
        min:percent?10:1,max:percent?100:16,step:percent?5:.5,
        numberStep:"any",label,unit:percent?"%":"px"
      });
      range.number.name=percent?"atlasRoadOpacityPercent":name;
      range.number.defaultValue=range.number.value;
      range.slider.dataset.atlasRoadRange=name;
      field=range.element;
    }else field=createSettingsInput(type,value,{
      name,min:options.min,max:options.max,step:options.step});
    field.style.maxWidth=(name==="atlasRoadWidth"||name==="atlasRoadOpacity")?"20rem":"13rem";
    if(type==="color")field.style.cssText="width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
    row.appendChild(field);(options.container??section).appendChild(row);
    return row;
  };
  input("Road color","atlasRoadColor","color",current.color);
  const borderPair=element("div");
  borderPair.className="atlas-road-inline-colors";
  section.appendChild(borderPair);
  input("Road border","atlasRoadBorderEnabled","checkbox",current.borderEnabled,
    {container:borderPair});
  const borderRow=input("Border color","atlasRoadBorderColor","color",current.borderColor,
    {container:borderPair});
  borderRow.dataset.atlasRoadBorderColor="";
  input("Line width","atlasRoadWidth","number",current.width);
  input("Opacity","atlasRoadOpacity","number",current.opacity);
  input("Line pattern","atlasRoadPattern","select",current.pattern,
    {choices:ROAD_LINE_PATTERNS});
  section=group("Road name styling");
  const namePair=element("div");
  namePair.className="atlas-road-inline-colors";
  section.appendChild(namePair);
  input("Road name labels","atlasRoadLabels","select",current.labelVisibility,
    {choices:ROAD_LABEL_VISIBILITY,container:namePair});
  input("Text color","atlasRoadTextColor","color",current.textColor,
    {container:namePair});

  section=group("Map preview");
  const svg=typeof document.createElementNS==="function"?
    document.createElementNS("http://www.w3.org/2000/svg","svg"):element("svg");
  svg.setAttribute?.("viewBox","0 0 300 100");
  svg.setAttribute?.("aria-label","Preview of the Road line appearance");
  svg.style.cssText="display:block;width:100%;height:100px;";
  const path=()=>typeof document.createElementNS==="function"?
    document.createElementNS("http://www.w3.org/2000/svg","path"):element("path");
  const outline=path(),line=path();
  for(const item of [outline,line]){
    item.setAttribute?.("d","M 12 76 Q 85 5 150 55 T 288 30");
    item.setAttribute?.("fill","none");
    item.setAttribute?.("stroke-linecap","round");
  }
  const label=typeof document.createElementNS==="function"?
    document.createElementNS("http://www.w3.org/2000/svg","text"):element("text");
  label.textContent="Road name";
  label.setAttribute?.("class","atlas-road-preview-name");
  label.setAttribute?.("x","150");
  label.setAttribute?.("y","37");
  label.setAttribute?.("text-anchor","middle");
  label.setAttribute?.("dominant-baseline","middle");
  label.setAttribute?.("aria-hidden","true");
  // Canvas places the label 18 screen pixels above the Road path at zoom 1.
  svg.append(outline,line,label);
  section.appendChild(svg);
  section.className+=" atlas-road-map-preview";
  root.addEventListener("input",()=>refreshRoadAppearancePreview(root));
  root.addEventListener("change",()=>refreshRoadAppearancePreview(root));
  refreshRoadAppearancePreview(root);
  return root;
}


/** Works with live DOM and DialogV2-cloned Road forms; never writes settings. */
export function refreshRoadAppearancePreview(root){
  const fields=new Map([...root.querySelectorAll("[name]")].map(field=>[field.name,field]));
  const value=name=>fields.get(name)?.value;
  const svg=root.querySelector("svg");
  if(!svg)return;
  const [outline,line,label]=svg.children;
  const width=Number(value("atlasRoadWidth"));
  const opacity=Number(value("atlasRoadOpacityPercent"))/100;
  if(!Number.isFinite(width)||width<=0||!Number.isFinite(opacity))return;
  const pattern=value("atlasRoadPattern");
  const dash=pattern==="dashed"?`${width*3} ${width*2}`:
    pattern==="dotted"?`${Math.max(1,width*.3)} ${Math.max(4,width*2)}`:"none";
  line.style.stroke=value("atlasRoadColor");
  line.style.strokeWidth=width+"px";
  line.style.strokeDasharray=dash;
  line.style.opacity=String(opacity);
  outline.style.stroke=value("atlasRoadBorderColor");
  outline.style.strokeWidth=(width+3)+"px";
  outline.style.opacity=fields.get("atlasRoadBorderEnabled")?.checked?String(opacity):"0";
  label.style.fill=value("atlasRoadTextColor");
  root.dataset.atlasRoadPreviewMode=value("atlasRoadLabels");
  label.hidden=value("atlasRoadLabels")==="off";
}

export function roadAppearanceFromForm(values) {
  return validateRoadAppearance({
    color: String(values.atlasRoadColor ?? ""),
    borderColor: String(values.atlasRoadBorderColor ?? ""),
    borderEnabled: values.atlasRoadBorderEnabled === true || values.atlasRoadBorderEnabled === "true",
    textColor: String(values.atlasRoadTextColor ?? ""),
    width: parseBoundedRangeDraft(values.atlasRoadWidth,{min:1,max:16,step:"any"}),
    opacity:values.atlasRoadOpacityPercent===undefined?
      Number(values.atlasRoadOpacity):
      parseBoundedRangeDraft(values.atlasRoadOpacityPercent,{min:10,max:100,step:"any"})/100,
    pattern: String(values.atlasRoadPattern ?? ""),
    labelVisibility: String(values.atlasRoadLabels ?? "")
  });
}

export class AtlasRoadAppearanceSettings extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-road-appearance",
    window: { title: "Atlas — Road Appearance", resizable: true },
    position: { width: 560, height: 670 }
  };

  async _renderHTML() {
    const root = element("div");
    root.style.cssText = "padding:1rem;display:flex;flex-direction:column;"+
      "gap:.75rem;overflow:hidden;height:100%;box-sizing:border-box;";
    root.appendChild(element("p", "WORLD ROAD APPEARANCE — Land, Water and Air " +
      "share category defaults across Scenes. A named road takes the category of its assigned " +
      "travel surface preset (or Land when unassigned). These visuals do not alter native " +
      "Region colors, geometry or movement costs."));
    const catalog = readWorldRoadAppearance();
    const forms = new Map();
    const categoryTabs=createSettingsCategoryTabs({
      id:"atlas-road-appearance",modes:[["land","Land"],["water","Water"],["air","Air"]],
      active:this.activeCategory??"land",onChange:id=>{this.activeCategory=id;}
    });
    root.appendChild(categoryTabs.nav);
    const scroll=element("div");
    scroll.className="atlas-world-category-scroll";
    scroll.style.cssText="flex:1 1 auto;min-height:0;overflow:auto;";
    root.appendChild(scroll);
    for (const mode of ["land","water","air"]) {
      const fieldset = element("fieldset");
      const title = mode.charAt(0).toUpperCase() + mode.slice(1);
      const legend = element("legend", title + " Road Overlay");
      legend.style.fontWeight = "bold";
      fieldset.appendChild(legend);
      const form = roadAppearanceForm(catalog.profiles[mode]);
      form.dataset.atlasRoadAppearance = mode;
      form.style.padding = "0.5rem";
      fieldset.appendChild(form);
      scroll.appendChild(categoryTabs.addPanel(mode,fieldset));
      forms.set(mode, form);
    }
    const save = element("button", "Save Appearance Defaults");
    save.type = "button";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        if (!game.user?.isGM) throw new Error("Only a GM may edit road appearance defaults.");
        const profiles={};
        for(const [mode,form] of forms){
          try{
            const values=settingsFormValues(form.querySelectorAll("[name]"));
            profiles[mode]=roadAppearanceFromForm(values);
          }catch(error){
            categoryTabs.activate(mode);
            form.querySelector?.(":invalid")?.focus?.();
            throw error;
          }
        }
        await game.settings.set(MODULE_ID, ROAD_APPEARANCE_SETTING,
          validateWorldRoadAppearance({ schemaVersion: 2, profiles }));
        ui.notifications.info("Atlas world road appearance defaults saved.");
        this.close();
      } catch (error) {
        ui.notifications.error(error.message);
        save.disabled = false;
      }
    });
    const footer=element("div");
    footer.className="atlas-world-category-footer";
    footer.style.cssText="flex:0 0 auto;display:flex;justify-content:flex-end;"+
      "padding:.5rem 0;border-top:1px solid var(--color-border-light-tertiary,#666);";
    footer.appendChild(save);
    root.appendChild(footer);
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}

export function registerWorldRoadAppearance(onChange = () => {}) {
  game.settings.register(MODULE_ID, ROAD_CURVE_SETTING, {
    name: "Atlas — Global Road Curvature",
    hint: "Visual-only smoothing for existing and new Land, Air and Water roads in all Scenes. " +
      "Off keeps straight segments; Strong is the default. Changes do not alter nodes, " +
      "distances, native Regions, or movement costs. Two-point roads remain straight.",
    scope: "world", config: true, type: String,
    choices: Object.fromEntries(Object.keys(ROAD_CURVE_PRESETS).map(preset =>
      [preset, preset.charAt(0).toUpperCase() + preset.slice(1)])),
    default: DEFAULT_ROAD_CURVE_PRESET, onChange
  });
  game.settings.register(MODULE_ID, ROAD_APPEARANCE_SETTING, {
    name: "Atlas Road Overlay Appearance Profiles",
    hint: "Land / Air / Water World-shared line and road-name styles; separate from native Regions.",
    scope: "world", config: false, type: Object,
    default: structuredClone(DEFAULT_WORLD_ROAD_APPEARANCE), onChange
  });
  game.settings.registerMenu(MODULE_ID, "atlasRoadAppearanceMenu", {
    name: "Atlas — Road Appearance", label: "Configure Road Appearance",
    hint: "World Land, Water and Air Road line and label defaults. This does not edit native Region colors, Shapes or movement Behaviors.",
    icon: "fa-solid fa-palette", type: AtlasRoadAppearanceSettings, restricted: true
  });
}
