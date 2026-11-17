import { MODULE_ID } from "./atlas-storage.js";
import { DEFAULT_WORLD_ROAD_APPEARANCE, ROAD_APPEARANCE_SETTING, readWorldRoadAppearance,
  ROAD_LINE_PATTERNS, ROAD_LABEL_VISIBILITY, ROAD_APPEARANCE_MODES,
  ROAD_CURVE_SETTING, ROAD_CURVE_PRESETS, DEFAULT_ROAD_CURVE_PRESET,
  validateRoadAppearance, validateWorldRoadAppearance }
  from "./road-appearance.js";
import { createSettingsSelect } from "./settings-select.js";
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
  root.style.cssText="display:grid;gap:.7rem;min-width:0;";
  const controls=new Map();
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
      controls.set(name,range.number);
    }else field=createSettingsInput(type,value,{
      name,min:options.min,max:options.max,step:options.step});
    field.style.maxWidth="13rem";
    if(type==="color")field.style.cssText="width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
    if(!controls.has(name))controls.set(name,field);
    row.appendChild(field);section.appendChild(row);
    return row;
  };
  input("Road color","atlasRoadColor","color",current.color);
  const borderToggle=input("Road border","atlasRoadBorderEnabled","checkbox",current.borderEnabled);
  const borderOn=controls.get("atlasRoadBorderEnabled");
  const borderRow=input("Road border color","atlasRoadBorderColor","color",current.borderColor);
  borderRow.dataset.atlasRoadBorderColor="";
  borderRow.style.display=current.borderEnabled?"flex":"none";
  borderOn.addEventListener("change",()=>{
    borderRow.style.display=borderOn.checked?"flex":"none";
  });
  input("Line width","atlasRoadWidth","number",current.width);
  input("Opacity","atlasRoadOpacity","number",current.opacity);
  input("Line pattern","atlasRoadPattern","select",current.pattern,
    {choices:ROAD_LINE_PATTERNS});
  section=group("Road name styling");
  input("Road name labels","atlasRoadLabels","select",current.labelVisibility,
    {choices:ROAD_LABEL_VISIBILITY});
  input("Road name text color","atlasRoadTextColor","color",current.textColor);

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
  svg.append(outline,line);
  const label=element("span","Road name");
  label.className="atlas-road-preview-name";
  section.append(svg,label);
  section.className+=" atlas-road-map-preview";
  const update=()=>{
    const value=name=>controls.get(name)?.value;
    const width=Number(value("atlasRoadWidth"));
    const opacity=Number(value("atlasRoadOpacity"))/100;
    if(!Number.isFinite(width)||width<=0||!Number.isFinite(opacity))return;
    const pattern=value("atlasRoadPattern");
    const dash=pattern==="dashed"?`${width*3} ${width*2}`:
      pattern==="dotted"?`${Math.max(1,width*.3)} ${Math.max(4,width*2)}`:"none";
    line.style.stroke=value("atlasRoadColor");
    line.style.strokeWidth=String(width);
    line.style.strokeDasharray=dash;
    line.style.opacity=String(opacity);
    outline.style.stroke=value("atlasRoadBorderColor");
    outline.style.strokeWidth=String(width+3);
    outline.style.opacity=controls.get("atlasRoadBorderEnabled").checked?String(opacity):"0";
    label.style.color=value("atlasRoadTextColor");
    root.dataset.atlasRoadPreviewMode=value("atlasRoadLabels");
    label.hidden=value("atlasRoadLabels")==="off";
  };
  root.addEventListener("input",update);
  root.addEventListener("change",update);
  update();
  return root;
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
    window: { title: "Atlas — Road Overlay Appearance (Land / Air / Water)", resizable: true },
    position: { width: 560, height: 670 }
  };

  async _renderHTML() {
    const root = element("div");
    root.style.cssText = "padding:1rem;display:grid;gap:0.75rem;overflow:auto;height:100%;";
    root.appendChild(element("p", "ROAD OVERLAY APPEARANCE — Land, Air and Water " +
      "share category defaults across Scenes. A named road takes the category of its assigned " +
      "travel surface preset (or Land when unassigned). These visuals do not alter native " +
      "Region colors, geometry or movement costs."));
    const catalog = readWorldRoadAppearance();
    const forms = new Map();
    for (const mode of ROAD_APPEARANCE_MODES) {
      const fieldset = element("fieldset");
      const title = mode.charAt(0).toUpperCase() + mode.slice(1);
      const legend = element("legend", title + " Road Overlay");
      legend.style.fontWeight = "bold";
      fieldset.appendChild(legend);
      const form = roadAppearanceForm(catalog.profiles[mode]);
      form.dataset.atlasRoadAppearance = mode;
      form.style.padding = "0.5rem";
      fieldset.appendChild(form);
      root.appendChild(fieldset);
      forms.set(mode, form);
    }
    const save = element("button", "Save Appearance Defaults");
    save.type = "button";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        if (!game.user?.isGM) throw new Error("Only a GM may edit road appearance defaults.");
        const profiles = Object.fromEntries([...forms].map(([mode, form]) => {
          const values = settingsFormValues(form.querySelectorAll("[name]"));
          return [mode, roadAppearanceFromForm(values)];
        }));
        await game.settings.set(MODULE_ID, ROAD_APPEARANCE_SETTING,
          validateWorldRoadAppearance({ schemaVersion: 2, profiles }));
        ui.notifications.info("Atlas world road appearance defaults saved.");
        this.close();
      } catch (error) {
        ui.notifications.error(error.message);
        save.disabled = false;
      }
    });
    root.appendChild(save);
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
    name: "Atlas — Road Overlay Appearance", label: "Configure Land / Air / Water Road Styles",
    hint: "Atlas-drawn line and text colors only. Region surface colors and movement cost presets are separate.",
    icon: "fa-solid fa-palette", type: AtlasRoadAppearanceSettings, restricted: true
  });
}
