import { CHECKPOINT_FREE_ICONS, resolveCheckpointAppearance,
  validateCheckpointAppearance } from "./checkpoint-appearance.js";
import { createCheckpointIconPicker } from "./checkpoint-icon-control.js";
import { readAtlas } from "./atlas-storage.js";
import { readAtlasJournalLinks, journalUuidFor, saveAtlasJournalLink,
  validJournalUuid } from "./atlas-journal-links.js";
import { journalLinkFields, journalUuidFromForm } from "./atlas-journal-fields.js";
import { readCheckpointDiscoveryMethods, checkpointDiscoveryMethod }
  from "./checkpoint-discovery-method.js";
import { saveCheckpointPresentation } from "./road-storage.js";
import { readPartyExploration, saveCheckpointKnowledge }
  from "./party-exploration-storage.js";
import { checkpointKnowledge, checkpointRevealRadiusCells }
  from "./party-exploration-model.js";
import { listGeneratedRegions } from "./generated-region.js";
import { readWorldTravelPresets } from "./travel-preset-settings.js";
import { CHECKPOINT_TYPES, CHECKPOINT_TYPE_GROUPS, checkpointCategory, saveCheckpointCategory } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING, upsertCheckpointPreset } from "./checkpoint-preset-model.js";
import { readWorldCheckpointPresets } from "./checkpoint-preset-settings.js";
import { MODULE_ID } from "./atlas-storage.js";
import { checkpointTerrainSuggestion, saveCheckpointTerrainSuggestion } from "./checkpoint-preset-snapshot.js";

const el = (tag, label) => {
  const item = document.createElement(tag);
  if (label !== undefined) item.textContent = label;
  return item;
};
const ICON_DETAILS = new Map(CHECKPOINT_FREE_ICONS.map(icon => [icon.id, icon]));

/** Explicit GM editor. Icon choice and search never modify the Scene before Save. */
export class AtlasCheckpointAppearanceEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-checkpoint-appearance",
    window: { title: "Atlas — Checkpoint Settings", resizable: true },
    position: { width: 630, height: 540 }
  };

  constructor({ scene, checkpointId, expectedRevision, onSaved, createDraft = null, onCreate = null, onTerrainAction = null }) {
    super({ position: {
      width: Math.min(630, Math.max(360, window.innerWidth - 60)),
      height: Math.min(710, Math.max(440, window.innerHeight - 70))
    } });
    this.scene = scene;
    this.checkpointId = checkpointId;
    this.expectedRevision = expectedRevision;
    this.onSaved = onSaved;
    this.createDraft = createDraft;
    this.onCreate = onCreate;
    this.onTerrainAction = onTerrainAction;
    this.activePage = "General";
    this.createResolved = false;
  }

  async close(options) {
    // A dismissed native Region dialog must not strand a transient preview.
    this.onTerrainAction?.("clearPreview");
    if (this.createDraft && !this.createResolved) {
      this.createResolved = true;
      this.onCreate?.(null);
    }
    return super.close(options);
  }

  async _renderHTML() {
    if (!game.user?.isGM || !this.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM with Scene update permission may style checkpoints.");
    }
    const current = this.createDraft ? {
      name: this.createDraft.defaultName, elevationMeters: null,
      appearance: null, playerVisible: false
    } : readAtlas(this.scene).checkpoints?.find(c => c.id === this.checkpointId);
    if (!current) throw new Error("Checkpoint no longer exists.");
    const appearance = resolveCheckpointAppearance(current.appearance);
    const exploration = readPartyExploration(this.scene);
    const journalLinks = readAtlasJournalLinks(this.scene);
    const discoveryMethods = readCheckpointDiscoveryMethods(this.scene);
    const root = el("div");
    root.style.cssText = "padding:0.85rem;display:flex;flex-direction:column;gap:0.6rem;overflow-y:auto;overflow-x:hidden;min-height:0;height:100%;box-sizing:border-box;";

    let fields = el("div");
    fields.style.cssText = "display:grid;gap:0.55rem;";
    const field = (title, control) => {
      const row = el("label");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:1rem;";
      row.append(el("span", title), control);
      control.style.maxWidth = "16rem";
      fields.appendChild(row);
      return control;
    };
    const select = (choices, value) => {
      const box = el("select");
      for (const [key, title] of choices) {
        const option = el("option", title);
        option.value = key;
        box.appendChild(option);
      }
      box.value = value;
      return box;
    };
    const name = el("input");
    name.type = "text"; name.maxLength = 120; name.required = true; name.value = current.name;
    name.setAttribute("aria-label", "Checkpoint name");
    field("Checkpoint name", name);
    const category=field("Checkpoint type",select(CHECKPOINT_TYPES,
      this.createDraft?"generic":checkpointCategory(this.scene,this.checkpointId)));
    category.replaceChildren();
    for(const [heading,types] of CHECKPOINT_TYPE_GROUPS){
      const group=el("optgroup");group.label=heading;
      for(const [id,label] of types){const option=el("option",label);option.value=id;group.appendChild(option);}
      category.appendChild(group);
    }
    category.value=this.createDraft?"generic":checkpointCategory(this.scene,this.checkpointId);
    category.title="Changing type suggests its World checkpoint preset. Changes are staged until Save.";
    const presetPicker=field("Checkpoint preset",el("select"));
    const presetHint=el("small","Choose a saved preset to fill editable marker and discovery defaults. This never changes a native Region.");
    fields.appendChild(presetHint);
    // The same General page is used for creation and editing: choose a reusable
    // template before entering or refining checkpoint-specific values.
    fields.prepend(presetPicker.closest("label"),presetHint);
    let terrainSuggestion=this.createDraft?null:checkpointTerrainSuggestion(this.scene,this.checkpointId);
    const draftRoad = this.createDraft
      ? field("Named road", select(this.createDraft.roads.map(road => [road.id, road.name]),
          this.createDraft.roads[0]?.id ?? "")) : null;
    const imperial = game.settings.get("fvtt-atlas-navigation","elevationUnits") === "imperial";
    const elevationFactor = imperial ? 3.280839895 : 1;
    const elevation = el("input");
    elevation.type = "number"; elevation.step = "any";
    elevation.value = current.elevationMeters === null ? "" : String(Math.round(current.elevationMeters * elevationFactor * 100) / 100);
    elevation.setAttribute("aria-label", imperial ? "Checkpoint elevation in feet" : "Checkpoint elevation in meters");
    const elevationRange = el("input");
    elevationRange.type = "range"; elevationRange.min = "-1000";
    elevationRange.max = "10000"; elevationRange.step = "10";
    elevationRange.value = String(Math.max(-1000,Math.min(10000,Number(elevation.value)||0)));
    elevation.style.width = "5.5rem";
    const elevationControl = el("div");
    elevationControl.style.cssText = "display:flex;align-items:center;gap:.35rem;";
    elevationRange.addEventListener("input",()=>{elevation.value=elevationRange.value;});
    elevation.addEventListener("input",()=>{
      if (elevation.value !== "") elevationRange.value=elevation.value;
    });
    elevationControl.append(elevationRange,elevation);
    field(imperial ? "Elevation (ft)" : "Elevation (m)", elevationControl);
    const playerVisibility = el("input");
    playerVisibility.type = "checkbox";
    playerVisibility.checked = current.playerVisible === true;
    playerVisibility.setAttribute("aria-label", "Checkpoint visible to players");
    let discovery = null;
    let revealRadius = null;
    let discoveryMethod = null;
    if (exploration.enabled) {
      const state = checkpointKnowledge(exploration, this.checkpointId);
      discovery = field("Discovery status", select([
        ["unknown", "Undiscovered"],
        ["visited", "Seen / Visited"],
        ["lore", "Known through Lore"]
      ], state));
      discovery.setAttribute("aria-label", "Checkpoint discovery status");
      discoveryMethod = field("Discovery method", select([
        ["automatic", "Automatic — explorer proximity"],
        ["gm", "GM Only — manual reveal"],
        ["lore", "Lore Only — story discovery"]
      ], checkpointDiscoveryMethod(discoveryMethods,this.checkpointId)));

      revealRadius = el("input");
      revealRadius.type = "number";
      revealRadius.min = "0"; revealRadius.max = "100"; revealRadius.step = "0.25";
      revealRadius.value = String(checkpointRevealRadiusCells(exploration, this.checkpointId));
      revealRadius.setAttribute("aria-label", "Checkpoint terrain reveal radius in grid cells");
      revealRadius.style.width = "5rem";
      const radiusSlider = el("input");
      radiusSlider.type = "range"; radiusSlider.min = "0"; radiusSlider.max = "100";
      radiusSlider.step = "0.25"; radiusSlider.value = revealRadius.value;
      radiusSlider.addEventListener("input",()=>{revealRadius.value=radiusSlider.value;});
      revealRadius.addEventListener("input",()=>{radiusSlider.value=revealRadius.value;});
      const radiusControl = el("div");
      radiusControl.style.cssText = "display:flex;align-items:center;gap:.35rem;";
      radiusControl.append(radiusSlider,revealRadius);
      field("Reveal radius (cells)", radiusControl);
    } else {
      field("Show to players", playerVisibility);
    }
    const type = field("Checkpoint marker", select([
      ["dot", "Default dot"], ["fa", "Font Awesome Free icon"],
      ["image", "Custom Foundry image"]
    ], appearance.type));
    let selected = appearance.icon;
    const iconPicker = createCheckpointIconPicker({selectedId:selected,
      onChange:id=>{selected=id;}});
    const iconSection = iconPicker.element;
    const pageGeneral = el("section"), pageMarker = el("section"), pageTerrain = el("section");
    pageGeneral.appendChild(fields);

    const imageSection = el("div");
    imageSection.style.cssText = "display:flex;gap:0.4rem;align-items:center;";
    const image = el("input");
    image.type = "text"; image.value = appearance.image;
    image.placeholder = "worlds/…/checkpoint.webp";
    image.setAttribute("aria-label", "Custom image path");
    image.style.cssText = "flex:1;min-width:0;";
    const browse = el("button", "Browse…");
    browse.type = "button";
    browse.addEventListener("click", () => {
      const Picker = foundry.applications.apps?.FilePicker;
      if (!Picker) {
        ui.notifications.error("Foundry File Picker is unavailable.");
        return;
      }
      new Picker({ type: "image", callback: path => { image.value = path; } }).render(true);
    });
    imageSection.append(image, browse);

    fields = el("div"); fields.style.cssText = "display:grid;gap:.55rem;";
    pageMarker.appendChild(fields);
    const size = el("input");
    size.type = "range"; size.min = "12"; size.max = "64"; size.step = "1";
    size.value = String(appearance.size);
    const sizeControls = el("div");
    sizeControls.style.cssText = "display:flex;align-items:center;gap:0.6rem;flex:1;";
    size.style.width = "11rem";
    const sizeValue = el("output", appearance.size + " px");
    size.setAttribute("aria-label", "Checkpoint marker size in pixels");
    size.addEventListener("input", () => { sizeValue.textContent = size.value + " px"; });
    sizeControls.append(size, sizeValue);
    field("Marker size (12–64 px)", sizeControls);
    const color = el("input");
    color.type = "color"; color.value = appearance.color; color.style.cssText = "width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
    field("Dot / Font Awesome color", color);
    const borderColor = el("input");
    borderColor.type = "color"; borderColor.value = appearance.borderColor; borderColor.style.cssText = "width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
    field("Checkpoint border color", borderColor);
    fields = el("div"); fields.style.cssText = "display:grid;gap:.55rem;";
    pageMarker.appendChild(fields);
    const mode = field("Checkpoint label", select([
      ["off", "Off"], ["hover", "On hover"], ["always", "Always"]
    ], appearance.labelMode));
    const showRoad = el("input");
    showRoad.type = "checkbox"; showRoad.checked = appearance.showRoadName;
    field("Include road name with label", showRoad);
    const textColor = el("input");
    textColor.type = "color"; textColor.value = appearance.textColor; textColor.style.cssText = "width:3.75rem;height:2.25rem;padding:2px;flex:0 0 auto;";
    field("Checkpoint / road label text color", textColor);
    // Choose a marker type after the label controls, then its icon last.
    pageMarker.appendChild(type.closest("label"));
    pageMarker.appendChild(imageSection);
    pageMarker.appendChild(iconSection);
    const updateType = () => {
      iconSection.hidden = type.value !== "fa";
      imageSection.hidden = type.value !== "image";
    };
    type.addEventListener("change", updateType);
    updateType();
    const catalog=readWorldCheckpointPresets();
    const populatePresets=()=>{
      presetPicker.replaceChildren();
      const none=el("option","None — keep current settings");none.value="";
      presetPicker.appendChild(none);
      for(const preset of catalog.presets.filter(p=>p.category===category.value)){
        const option=el("option",preset.name);option.value=preset.id;
        presetPicker.appendChild(option);
      }
    };
    const applyPreset=()=>{
      const preset=catalog.presets.find(p=>p.id===presetPicker.value);
      if(!preset)return;
      const a=resolveCheckpointAppearance(preset.appearance);
      type.value=a.type;selected=a.icon;image.value=a.image;
      size.value=String(a.size);sizeValue.textContent=a.size+" px";
      color.value=a.color;borderColor.value=a.borderColor;
      mode.value=a.labelMode;showRoad.checked=a.showRoadName;textColor.value=a.textColor;
      discoveryMethod&&(discoveryMethod.value=preset.discoveryMethod);
      if(revealRadius)revealRadius.value=String(preset.revealRadiusCells);
      if(preset.elevationMeters!==null){
        elevation.value=String(Math.round(preset.elevationMeters*elevationFactor*100)/100);
        elevationRange.value=elevation.value;
      }
      if(discovery)discovery.value=preset.discoveryStatus??"unknown";
      if(preset.journalUuid)journalInput.value=preset.journalUuid;
      playerVisibility.checked=preset.playerVisible===true;
      terrainSuggestion={...preset.terrain};
      iconPicker.value=selected;updateType();
      presetHint.textContent="Applied ‘"+preset.name+"’ to editable fields. Suggested Region: "+
        (preset.terrain.presetId??"None")+" · radius "+preset.terrain.radiusCells+
        " cells. Native Region geometry and Behaviors stay unchanged.";
    };
    category.addEventListener("change",()=>{
      populatePresets();
      if(presetPicker.options.length>1){presetPicker.selectedIndex=1;applyPreset();}
    });
    presetPicker.addEventListener("change",applyPreset);
    populatePresets();
    if (type.value === "fa" && (!selected || !ICON_DETAILS.has(selected))) iconSection.open=true;
    iconSection.addEventListener("toggle",()=>{
      if (!this.rendered || pageMarker.hidden) return;
      this.setPosition({
        width: iconSection.open ? Math.min(860, window.innerWidth - 50) : Math.min(630, window.innerWidth - 50),
        height: iconSection.open ? Math.min(850, window.innerHeight - 80) : Math.min(660, window.innerHeight - 90)
      });
    });
    const journalControls = journalLinkFields(journalLinks,"checkpoint",this.checkpointId);
    pageGeneral.appendChild(journalControls);
    pageTerrain.style.cssText="min-width:0;";
    const checkpointRegions=this.createDraft?[]:listGeneratedRegions(this.scene).filter(item=>
      item.metadata?.checkpointIds?.includes(this.checkpointId));
    const presetNames=new Map(checkpointRegions.length?
      readWorldTravelPresets().presets.map(p=>[p.id,p.name]):[]);
    pageTerrain.appendChild(el("p","A checkpoint Region overrides the road's default travel preset where its geometry applies. Higher-priority overlapping Regions win. Native Behaviors are edited separately."));
    const terrainButton=(title,action,regionId=null)=>{
      const button=el("button",title);button.type="button";
      const icon={geometry:"fa-solid fa-ruler-combined",
        regenerate:"fa-solid fa-rotate",delete:"fa-solid fa-trash"}[action];
      if(icon){
        button.textContent="";
        const glyph=el("i");glyph.className=icon;
        button.appendChild(glyph);
        button.title=title;button.setAttribute("aria-label",title);
        button.style.cssText="width:2.6rem;min-width:2.6rem;display:inline-flex;justify-content:center;align-items:center;";
      }
      button.addEventListener("click",async()=>{
        button.disabled=true;
        try{
          await this.onTerrainAction?.(action,regionId);
          // Opening a native sheet is not a data mutation; retain unsaved fields.
          if(!["create","settings"].includes(action))await this.render(true);
        }catch(error){ui.notifications.error(error.message||String(error));}
        finally{button.disabled=false;}
      });
      return button;
    };
    if(!this.createDraft && this.onTerrainAction){
      pageTerrain.appendChild(terrainButton("+ Generate checkpoint Region","create"));
      if(!checkpointRegions.length)pageTerrain.appendChild(el("p","No generated Terrain Regions are linked to this checkpoint."));
      for(const region of checkpointRegions){
        const card=el("section");
        card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);padding:.7rem;display:grid;gap:.45rem;";
        card.appendChild(el("strong",region.name));
        card.appendChild(el("small","Travel preset: "+(presetNames.get(region.presetId)??"None")+
          " · "+(region.metadata.kind==="checkpoint"?"Checkpoint area":"Road corridor")));
        if(region.modified)card.appendChild(el("small","Geometry was manually modified; regeneration is protected."));
        const commands=el("div");commands.style.cssText="display:flex;gap:.35rem;flex-wrap:wrap;";
        commands.append(terrainButton("Travel preset","preset",region.id),
          terrainButton("Region settings","settings",region.id),
          terrainButton("Radius / width","geometry",region.id),
          terrainButton("Regenerate","regenerate",region.id),
          terrainButton("Delete","delete",region.id));
        if(region.modified)for(const index of [2,3])commands.querySelectorAll("button")[index].disabled=true;
        card.appendChild(commands);pageTerrain.appendChild(card);
      }
    }else if(this.createDraft){
      pageTerrain.appendChild(el("p","A Terrain Region can be generated immediately after the new checkpoint is saved. You'll preview its geometry and choose its travel preset before confirming."));
    }
    const generateAfterCreate=this.createDraft?el("input"):null;
    if(generateAfterCreate){
      generateAfterCreate.type="checkbox";
      const choice=el("label");choice.append(generateAfterCreate,
        document.createTextNode(" Open Terrain Region generator after creating checkpoint"));
      pageTerrain.appendChild(choice);
    }
    const editorTabs = el("nav");
    editorTabs.style.cssText = "display:flex;gap:.4rem;flex-wrap:wrap;padding-bottom:.65rem;border-bottom:1px solid var(--color-border-light-tertiary,#655);";
    const pages = [["General",pageGeneral],["Marker & labels",pageMarker],["Terrain Region",pageTerrain]];
    for (const [name,page] of pages) {
      const item=el("button",name);
      item.type="button"; item.style.cssText="flex:1;min-width:8rem;border:1px solid var(--color-border-light-tertiary,#655);";
      const selected=name===this.activePage;
      item.style.background=selected?"rgba(156,123,240,.22)":"transparent";
      item.style.fontWeight=selected?"700":"400";
      item.setAttribute("aria-selected",String(selected));
      item.addEventListener("click",()=>{
        this.activePage=name;
        for (const [,p] of pages) p.hidden=p!==page;
        if (page===pageMarker && iconSection.open) this.setPosition({
          width:Math.min(860,window.innerWidth-50),height:Math.min(850,window.innerHeight-80)
        });
        else this.setPosition({
          width:Math.min(630,window.innerWidth-50),height:Math.min(710,window.innerHeight-70)
        });
        for (const b of editorTabs.children) {
          const active=b===item;
          b.disabled=false;b.setAttribute("aria-selected",String(active));
          b.style.background=active?"rgba(156,123,240,.22)":"transparent";
          b.style.fontWeight=active?"700":"400";
        }
      });
      editorTabs.appendChild(item);
    }
    pages.forEach(([name,page])=>{page.hidden=name!==this.activePage;});

    root.prepend(editorTabs);
    root.append(pageGeneral,pageMarker,pageTerrain);
    const journalInput = journalControls.querySelector('input[name="atlasJournalUuid"]');
    const controls = el("div");
    controls.style.cssText = "position:sticky;bottom:0;z-index:2;display:flex;gap:0.5rem;justify-content:flex-end;background:#100f17;padding:.4rem 0;";
    const reset = el("button", "Reset to default dot");
    reset.type = "button";
    reset.addEventListener("click", () => void saveValue(null));
    const cancel = el("button", "Cancel");
    cancel.type = "button"; cancel.addEventListener("click", () => this.close());
    const save = el("button", "Save Checkpoint Settings");
    save.type = "button";
    if (this.createDraft) { save.textContent = "Create Checkpoint"; reset.hidden = true; }
    const saveAsPreset=el("button","Save as Preset");saveAsPreset.type="button";
    saveAsPreset.addEventListener("click",async()=>{
      try{
        const wrapper=el("div"),input=el("input");
        input.name="presetName";input.required=true;input.maxLength=120;
        input.defaultValue=category.selectedOptions[0]?.textContent??"Checkpoint";
        const label=el("label","Preset name");label.appendChild(input);wrapper.appendChild(label);
        const values=await foundry.applications.api.DialogV2.input({
          window:{title:"Save Checkpoint as World Preset"},content:wrapper,
          ok:{label:"Save Preset"},rejectClose:false,modal:true
        });
        if(!values)return;
        const a=validateCheckpointAppearance({type:type.value,icon:selected,image:image.value.trim(),
          size:Number(size.value),color:color.value,borderColor:borderColor.value,
          labelMode:mode.value,showRoadName:showRoad.checked,textColor:textColor.value});
        const world=readWorldCheckpointPresets();
        const suggested=terrainSuggestion;
        const preset={id:"checkpoint-custom-"+foundry.utils.randomID(),
          name:String(values.presetName??"").trim(),category:category.value,
          appearance:a,discoveryMethod:discoveryMethod?.value??"automatic",
          elevationMeters:elevation.value.trim()===""?null:Number(elevation.value)/elevationFactor,
          discoveryStatus:discovery?.value??"unknown",
          journalUuid:journalInput.value.trim()||null,
          playerVisible:playerVisibility.checked,
          revealRadiusCells:Number(revealRadius?.value??3),
          terrain:suggested?{...suggested}:{presetId:null,radiusCells:.25},
          event:{kind:"none",enabled:false}};
        const next=upsertCheckpointPreset(world,preset);
        await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,next);
        ui.notifications.info("Checkpoint preset saved to World settings. This checkpoint was not changed.");
      }catch(error){ui.notifications.error(error.message??String(error));}
    });
    const saveValue = async value => {
      if (save.disabled) return;
      save.disabled = true; reset.disabled = true;
      try {
        if (readAtlas(this.scene).revision !== this.expectedRevision) {
          throw new Error("Scene Atlas changed. Close and reopen this checkpoint editor.");
        }
        const next = value === null ? null : validateCheckpointAppearance({
          type: type.value, icon: selected, image: image.value.trim(),
          size: Number(size.value), color: color.value,
          borderColor: borderColor.value,
          labelMode: mode.value, showRoadName: showRoad.checked,
          textColor: textColor.value
        });
        const nextJournal=journalUuidFromForm(journalInput.value);
        if(nextJournal&&!validJournalUuid(nextJournal))
          throw Error("Select a Journal Entry or Journal Page UUID.");
        const raw = elevation.value.trim();
        if (this.createDraft) {
          const roadId = draftRoad?.value ?? "";
          if (!this.createDraft.roads.some(road => road.id === roadId))
            throw Error("Choose a named road for this checkpoint.");
          if (!name.value.trim() || name.value.length > 120)
            throw Error("Enter a checkpoint name (1–120 characters).");
          if (raw !== "" && !Number.isFinite(Number(raw)))
            throw Error("Enter a valid elevation.");
          const config = {
            roadId, name: name.value.trim(),
            elevationMeters: raw === "" ? null : Number(raw) / elevationFactor,
            appearance: next, playerVisible: playerVisibility.checked,
            journalUuid: nextJournal,
            knowledge: discovery?.value ?? null,
            discoveryMethod: discoveryMethod?.value ?? null,
            revealRadiusCells: revealRadius ? Number(revealRadius.value) : null,
            generateTerrainRegion:generateAfterCreate?.checked??false
            ,checkpointType:category.value
            ,terrainSuggestion
          };
          this.createResolved = true;
          this.onCreate?.(config);
          await this.close();
          return;
        }
        if (discovery && JSON.stringify(readPartyExploration(this.scene)) !==
            JSON.stringify(exploration)) {
          throw new Error("Party discovery changed. Reopen checkpoint settings.");
        }
        await saveCheckpointPresentation(this.scene, {
          checkpointId: this.checkpointId, name: name.value,
          elevationMeters: raw === "" ? null : Number(raw) / elevationFactor,
          playerVisible: playerVisibility.checked, appearance: next,
          expectedRevision: this.expectedRevision
        });
        if(category.value!==checkpointCategory(this.scene,this.checkpointId))
          await saveCheckpointCategory(this.scene,this.checkpointId,category.value);
        if(JSON.stringify(terrainSuggestion)!==JSON.stringify(
          checkpointTerrainSuggestion(this.scene,this.checkpointId)))
          await saveCheckpointTerrainSuggestion(this.scene,this.checkpointId,terrainSuggestion);
        if (discovery && (discovery.value !==
            checkpointKnowledge(exploration, this.checkpointId) ||
            Number(revealRadius.value) !==
              checkpointRevealRadiusCells(exploration, this.checkpointId) ||
            discoveryMethod.value !==
              checkpointDiscoveryMethod(discoveryMethods,this.checkpointId))) {
          await saveCheckpointKnowledge(this.scene, {
            checkpointId: this.checkpointId, knowledge: discovery.value,
            revealRadiusCells: Number(revealRadius.value),
            expected: exploration,
            method: discoveryMethod.value, expectedMethods: discoveryMethods
          });
        }
        if (nextJournal !== journalUuidFor(journalLinks,"checkpoint",this.checkpointId)) {
          await saveAtlasJournalLink(this.scene,{
            kind:"checkpoint",id:this.checkpointId,uuid:nextJournal,expected:journalLinks
          });
        }
        this.onSaved?.();
        await this.close();
        ui.notifications.info("Atlas checkpoint settings saved.");
      } catch (error) {
        ui.notifications.error(error.message || String(error));
        save.disabled = false; reset.disabled = false;
      }
    };
    save.addEventListener("click", () => void saveValue(undefined));
    controls.append(saveAsPreset,reset,cancel,save);
    root.appendChild(controls);
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}
