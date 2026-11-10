import { resolveAtlasMeasuringUnits } from "./navigation-measure-units.js";
import { CHECKPOINT_FREE_ICONS, resolveCheckpointAppearance,
  validateCheckpointAppearance } from "./checkpoint-appearance.js";
import { createCheckpointIconPicker } from "./checkpoint-icon-control.js";
import { createCheckpointTransportationEditor } from "./checkpoint-transportation-editor.js";
import { checkpointOffers,saveCheckpointOffers } from "./checkpoint-transportation.js";
import { createCheckpointChoice,createCheckpointRange,createCheckpointMarkerSize,
  createCheckpointColor,createCheckpointCheckbox,createCheckpointElevation }
  from "./checkpoint-form-controls.js";
import { appendSettingsField } from "./settings-layout.js";
import { createCheckpointPresetSelect,createSettingsIconButton } from "./settings-controls.js";
import { createSettingsSelect,createSettingsGroupedSelect } from "./settings-select.js";
import { approveSettingsClose,trackSettingsChanges } from "./settings-close-guard.js";
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
import { territoryCheckpointLinks } from "./territory-checkpoint-link.js";
import { readWorldTravelPresets } from "./travel-preset-settings.js";
import { CHECKPOINT_TYPE_GROUPS, checkpointCategory, saveCheckpointCategory } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING, upsertCheckpointPreset } from "./checkpoint-preset-model.js";
import { readWorldCheckpointPresets } from "./checkpoint-preset-settings.js";
import { MODULE_ID } from "./atlas-storage.js";
import { checkpointTerrainSuggestion, saveCheckpointTerrainSuggestion } from "./checkpoint-preset-snapshot.js";
import { checkpointAssignedPresetId,saveCheckpointPresetAssignment }
  from "./checkpoint-preset-assignment.js";
import { CHECKPOINT_MARKER_TYPES,CHECKPOINT_LABEL_MODES,
  CHECKPOINT_DISCOVERY_STATES,CHECKPOINT_DISCOVERY_METHODS }
  from "./checkpoint-field-definitions.js";

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
    position: { width: 630, height: 540, left: 24 }
  };

  constructor({ scene, checkpointId, expectedRevision, onSaved, createDraft = null, onCreate = null, onTerrainAction = null, onDelete = null }) {
    super({ position: {
      left: 24,
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
    this.onDelete = onDelete;
    this.activePage = "General";
    this.createResolved = false;
  }

  async close(options) {
    if (!this._skipClosePrompt) {
      if (this._checkingClose) return this;
      this._checkingClose = true;
      try {
        const approved = await approveSettingsClose({
          isDirty: this._isDirty, save: this._saveDraft,
          title: "Checkpoint Settings"
        });
        if (!approved || this._skipClosePrompt) return this;
      } finally { this._checkingClose = false; }
    }
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
    const field = (title, control) => appendSettingsField(fields,title,control,{variant:"split"});
    const select=(choices,value)=>createSettingsSelect(choices,{selectedId:value});
    const name = el("input");
    name.type = "text"; name.maxLength = 120; name.required = true; name.value = current.name;
    name.setAttribute("aria-label", "Checkpoint name");
    field("Checkpoint name", name);
    const category=field("Checkpoint type",createSettingsGroupedSelect(
      CHECKPOINT_TYPE_GROUPS.map(([heading,types])=>({label:heading,options:types})),
      {selectedId:this.createDraft?"generic":checkpointCategory(this.scene,this.checkpointId)}));
    category.title="Changing type suggests its World checkpoint preset. Changes are staged until Save.";
    const presetPicker=el("select");
    const saveAsPreset=createSettingsIconButton({icon:"floppy-disk",label:"Save as preset"});
    saveAsPreset.type="button";
    const presetControls=el("div");
    presetControls.style.cssText="display:flex;align-items:center;gap:.4rem;flex:0 1 16rem;min-width:0;";
    presetPicker.style.cssText="flex:1;min-width:0;";
    presetControls.append(presetPicker,saveAsPreset);
    field("Checkpoint preset",presetControls);
    const presetHint=el("small","Choose a saved preset to fill editable marker and discovery defaults. This never changes a native Region.");
    fields.appendChild(presetHint);
    // The same General page is used for creation and editing: choose a reusable
    // template before entering or refining checkpoint-specific values.
    fields.prepend(presetControls.closest("label"),presetHint);
    let terrainSuggestion=this.createDraft?null:checkpointTerrainSuggestion(this.scene,this.checkpointId);
    const draftRoad = this.createDraft
      ? field("Named road", select(this.createDraft.roads.map(road => [road.id, road.name]),
          this.createDraft.roads[0]?.id ?? "")) : null;
    const imperial = resolveAtlasMeasuringUnits() === "imperial";
    const elevationFactor = imperial ? 3.280839895 : 1;
    const elevationControl=createCheckpointElevation(current.elevationMeters,{imperial});
    const elevation=elevationControl.number;
    const elevationRange=elevationControl.slider;
    field(imperial ? "Elevation (ft)" : "Elevation (m)",elevationControl.element);
    const playerVisibility = createCheckpointCheckbox(current.playerVisible,
      {label:"Checkpoint visible to players"});
    let discovery = null;
    let revealRadius = null;
    let discoveryMethod = null;
    if (exploration.enabled) {
      const state = checkpointKnowledge(exploration, this.checkpointId);
      discovery = field("Discovery status", createCheckpointChoice(CHECKPOINT_DISCOVERY_STATES,state));
      discovery.setAttribute("aria-label", "Checkpoint discovery status");
      discoveryMethod = field("Discovery method", createCheckpointChoice(CHECKPOINT_DISCOVERY_METHODS,
        checkpointDiscoveryMethod(discoveryMethods,this.checkpointId)));

      const radiusControl=createCheckpointRange(
        checkpointRevealRadiusCells(exploration,this.checkpointId),
        {min:0,max:100,step:.25,label:"Checkpoint terrain reveal radius in grid cells"});
      revealRadius=radiusControl.number;
      field("Reveal radius (cells)",radiusControl.element);
    } else {
      field("Show to players", playerVisibility);
    }
    const type = field("Checkpoint marker", createCheckpointChoice(CHECKPOINT_MARKER_TYPES,appearance.type));
    let selected = appearance.icon;
    const iconPicker = createCheckpointIconPicker({selectedId:selected,
      onChange:id=>{selected=id;}});
    const iconSection = iconPicker.element;
    const pageGeneral = el("section"), pageMarker = el("section"), pageTerrain = el("section");
    const pageTransport=el("section");
    const transportEditor=createCheckpointTransportationEditor({offers:this.createDraft?[]:
      checkpointOffers(this.scene,this.checkpointId)});
    pageTransport.append(transportEditor.element);
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
    const markerSize=createCheckpointMarkerSize(appearance.size);
    const size=markerSize.input;
    field("Marker size (12–64 px)", markerSize.element);
    const color = createCheckpointColor(appearance.color,{label:"Dot / Font Awesome color"});
    field("Dot / Font Awesome color", color);
    const borderColor = createCheckpointColor(appearance.borderColor,{label:"Checkpoint border color"});
    field("Checkpoint border color", borderColor);
    fields = el("div"); fields.style.cssText = "display:grid;gap:.55rem;";
    pageMarker.appendChild(fields);
    const mode = field("Checkpoint label", createCheckpointChoice(CHECKPOINT_LABEL_MODES,appearance.labelMode));
    const showRoad = createCheckpointCheckbox(appearance.showRoadName);
    field("Include road name with label", showRoad);
    const textColor = createCheckpointColor(appearance.textColor,{label:"Checkpoint label text color"});
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
      const grouped=createCheckpointPresetSelect(catalog.presets);
      presetPicker.replaceChildren(...grouped.children);
    };
    const applyPreset=()=>{
      const preset=catalog.presets.find(p=>p.id===presetPicker.value);
      if(!preset)return;
      category.value=preset.category;
      const a=resolveCheckpointAppearance(preset.appearance);
      type.value=a.type;selected=a.icon;image.value=a.image;
      size.value=String(a.size);markerSize.output.textContent=a.size+" px";
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
      transportEditor.setOffers(preset.transportation??[]);
      iconPicker.value=selected;updateType();
      presetHint.textContent="Applied ‘"+preset.name+"’ to editable fields. Suggested Region: "+
        (preset.terrain.presetId??"None")+" · radius "+preset.terrain.radiusCells+
        " cells. Native Region geometry and Behaviors stay unchanged.";
    };
    category.addEventListener("change",()=>{
      const suggested=catalog.presets.find(p=>p.category===category.value);
      presetPicker.value=suggested?.id??"";
      if(suggested)applyPreset();
    });
    presetPicker.addEventListener("change",applyPreset);
    populatePresets();
    if(!this.createDraft){
      const assigned=checkpointAssignedPresetId(this.scene,this.checkpointId);
      if(assigned&&catalog.presets.some(p=>p.id===assigned))presetPicker.value=assigned;
    }
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
    let updateGeographicHint=null;
    if(!this.createDraft){
      const hint=el("p");
      updateGeographicHint=()=>{
        const linked=territoryCheckpointLinks(this.scene).filter(item=>
          item.link?.checkpointId===this.checkpointId);
        hint.textContent=linked.length?
        `Linked geographic Territory: ${linked.map(item=>item.regionName).join(", ")}. `+
          "Manage this identity association in Atlas Workspace → Territories; " +
          "it does not alter the Checkpoint Journal or native Region geometry.":
        "No geographic Territory is associated with this Checkpoint. " +
          "Link one here or from Atlas Workspace → Territories.";
      };
      updateGeographicHint();pageTerrain.appendChild(hint);
    }
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
          if(action==="territory")updateGeographicHint?.();
          // Opening a native sheet is not a data mutation; retain unsaved fields.
          if(!["create","settings","territory"].includes(action))await this.render(true);
        }catch(error){ui.notifications.error(error.message||String(error));}
        finally{button.disabled=false;}
      });
      return button;
    };
    if(!this.createDraft && this.onTerrainAction){
      pageTerrain.appendChild(terrainButton("Link geographic Territory","territory"));
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
    const pages = [["General",pageGeneral],["Marker & labels",pageMarker],["Terrain Region",pageTerrain],
      ["Transportation",pageTransport]];
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
    root.append(pageGeneral,pageMarker,pageTerrain,pageTransport);
    const journalInput = journalControls.querySelector('input[name="atlasJournalUuid"]');
    const controls = el("div");
    controls.style.cssText = "position:sticky;bottom:0;z-index:2;display:flex;gap:0.5rem;justify-content:flex-end;background:#100f17;padding:.4rem 0;";
    const save = this.createDraft ? el("button", "Create Checkpoint") :
      createSettingsIconButton({icon:"floppy-disk",label:"Save Checkpoint Settings"});
    save.type = "button";
    const remove = !this.createDraft && this.onDelete ?
      createSettingsIconButton({icon:"trash",label:"Delete checkpoint",danger:true}):null;
    remove?.addEventListener("click",async()=>{
      if(remove.disabled)return;
      remove.disabled=true;
      try{
        const deleted=await this.onDelete();
        if(deleted===true){this._skipClosePrompt=true;await this.close();}
      }catch(error){ui.notifications.error(error.message??String(error));}
      finally{remove.disabled=false;}
    });
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
          transportation:transportEditor.getOffers(),
          event:{kind:"none",enabled:false}};
        const next=upsertCheckpointPreset(world,preset);
        await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,next);
        ui.notifications.info("Checkpoint preset saved to World settings. This checkpoint was not changed.");
      }catch(error){ui.notifications.error(error.message??String(error));}
    });
    const saveValue = async value => {
      if (save.disabled) return;
      save.disabled = true;
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
            ,checkpointPresetId:presetPicker.value||null
            ,terrainSuggestion
            ,transportationOffers:transportEditor.getOffers()
          };
          this.createResolved = true;
          this.onCreate?.(config);
          this._skipClosePrompt=true;
          await this.close();
          return true;
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
        const selectedPresetId=value===null?null:presetPicker.value||null;
        if(selectedPresetId&&!readWorldCheckpointPresets().presets.some(p=>p.id===selectedPresetId))
          throw Error("This checkpoint preset no longer exists. Reopen the settings.");
        if(selectedPresetId!==checkpointAssignedPresetId(this.scene,this.checkpointId))
          await saveCheckpointPresetAssignment(this.scene,this.checkpointId,selectedPresetId);
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
        const offers=transportEditor.getOffers();
        if(JSON.stringify(offers)!==JSON.stringify(checkpointOffers(this.scene,this.checkpointId)))
          await saveCheckpointOffers(this.scene,this.checkpointId,offers);
        if (nextJournal !== journalUuidFor(journalLinks,"checkpoint",this.checkpointId)) {
          await saveAtlasJournalLink(this.scene,{
            kind:"checkpoint",id:this.checkpointId,uuid:nextJournal,expected:journalLinks
          });
        }
        this.onSaved?.();
        this._skipClosePrompt=true;
        await this.close();
        ui.notifications.info("Atlas checkpoint settings saved.");
        return true;
      } catch (error) {
        ui.notifications.error(error.message || String(error));
        save.disabled = false;
        return false;
      }
    };
    save.addEventListener("click", () => void saveValue(undefined));
    if(remove)controls.appendChild(remove);
    controls.appendChild(save);
    root.appendChild(controls);
    this._saveDraft=()=>saveValue(undefined);
    this._isDirty=trackSettingsChanges(root,()=>({selected,terrainSuggestion,
      transportation:transportEditor.getOffers()}));
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}
