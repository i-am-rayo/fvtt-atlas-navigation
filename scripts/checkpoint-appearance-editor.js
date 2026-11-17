import { resolveCheckpointElevationUnits } from "./navigation-measure-units.js";
import { resolveCheckpointAppearance,checkpointCanvasSize,
  validateCheckpointAppearance } from "./checkpoint-appearance.js";
import { createCheckpointIconPicker, createCheckpointIconGlyph } from "./checkpoint-icon-control.js";
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
import {atlasSettingsTitle} from "./atlas-settings-title.js";

const el = (tag, label) => {
  const item = document.createElement(tag);
  if (label !== undefined) item.textContent = label;
  return item;
};

/** Explicit GM editor. Icon choice and search never modify the Scene before Save. */
export class AtlasCheckpointAppearanceEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-checkpoint-appearance",
    window: { title: "Atlas — Checkpoint Settings", resizable: true },
    position: { width: 630, height: 540, left: 24 }
  };

  constructor({ scene, checkpointId, expectedRevision, onSaved, createDraft = null, onCreate = null, onTerrainAction = null, onDelete = null, onMove = null, onRoad = null }) {
    const checkpointName=createDraft?null:
      readAtlas(scene).checkpoints?.find(checkpoint=>checkpoint.id===checkpointId)?.name;
    super({ window:{title:atlasSettingsTitle("Checkpoint",checkpointName,
      {creating:Boolean(createDraft)})}, position: {
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
    this.onMove = onMove;
    this.onRoad = onRoad;
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
    name.autofocus = this.activePage === "General";
    name.setAttribute("aria-label", "Checkpoint name");
    field("Checkpoint name", name);
    const category=field("Checkpoint type",createSettingsGroupedSelect(
      CHECKPOINT_TYPE_GROUPS.map(([heading,types])=>({label:heading,options:types})),
      {selectedId:this.createDraft?"generic":checkpointCategory(this.scene,this.checkpointId)}));
    category.title="Changing type suggests its World checkpoint preset. Changes are staged until Save.";
    const presetPicker=el("select");
    const saveAsPreset=el("button","Save as preset…");
    saveAsPreset.type="button";
    const presetControls=el("div");
    presetControls.style.cssText="display:flex;align-items:center;justify-content:flex-end;gap:.4rem;width:min(100%,20rem);margin-inline-start:auto;min-width:0;";
    presetPicker.style.cssText="flex:1;min-width:0;";
    const changePreset=el("button","Change preset…");changePreset.type="button";
    const presetName=el("span");
    const updatePresetControl=()=>{
      const chosen=catalog.presets.find(p=>p.id===presetPicker.value);
      presetName.textContent=chosen?.name??"No preset";
      presetPicker.hidden=Boolean(chosen);changePreset.hidden=!chosen;
    };
    changePreset.addEventListener("click",()=>{presetPicker.hidden=false;changePreset.hidden=true;presetPicker.focus();});
    presetControls.append(presetName,presetPicker,changePreset);
    field("Checkpoint preset",presetControls);
    const presetHint=el("small","Apply saved marker and discovery defaults. Save Checkpoint applies your changes to this place.");
    fields.appendChild(presetHint);
    // The same General page is used for creation and editing: choose a reusable
    // template before entering or refining checkpoint-specific values.
    fields.prepend(presetControls.closest("label"),presetHint);
    let terrainSuggestion=this.createDraft?null:checkpointTerrainSuggestion(this.scene,this.checkpointId);
    const draftRoad = this.createDraft && !this.createDraft.independent
      ? field("Named road", select(this.createDraft.roads.map(road => [road.id, road.name]),
          this.createDraft.roads[0]?.id ?? "")) : null;
    if (this.createDraft?.independent) {
      const hint = el("p", "Independent Checkpoint: no Road is assigned. Its existing Node can be connected later by GM-approved topology.");
      hint.className = "hint";
      fields.appendChild(hint);
    }
    const imperial=resolveCheckpointElevationUnits(this.scene.grid?.units,
      game.settings,game.system?.id)==="imperial";
    const elevationFactor = imperial ? 3.280839895 : 1;
    const elevationControl=createCheckpointElevation(current.elevationMeters,{imperial});
    const elevation=elevationControl.number;
    const initialElevation=elevation.value;
    const elevationMeters=()=>elevation.value===initialElevation ? current.elevationMeters :
      elevation.value.trim()===""?null:Number(elevation.value)/elevationFactor;
    const elevationRange=elevationControl.slider;
    field(imperial ? "Elevation (ft)" : "Elevation (m)",elevationControl.element);
    const playerVisibility = createCheckpointCheckbox(current.playerVisible,
      {label:"Checkpoint visible to players"});
    let discovery = null;
    let revealRadius = null;
    let discoveryMethod = null;
    let updateVisibility=()=>{};
    // The very same staged visibility control is placed in the persistent
    // footer. No duplicate state or early write to native Scene flags.
    let visibilityAction=null;
    if (exploration.enabled) {
      const state = checkpointKnowledge(exploration, this.checkpointId);
      discovery = createCheckpointChoice(CHECKPOINT_DISCOVERY_STATES,state);
      discovery.hidden=true;
      const visibility=createSettingsIconButton({icon:state==="unknown"?"eye-slash":"eye",label:"Show checkpoint"});
      const visibilityRow=el("div");
      visibilityRow.className="atlas-checkpoint-footer-visibility";
      visibility.className+=" atlas-checkpoint-footer-icon";
      visibilityRow.append(discovery,visibility);
      visibilityAction=visibilityRow;
      let knownState=state==="unknown"?"visited":state;
      updateVisibility=()=>{
        const shown=discovery.value!=="unknown";
        visibility.title=shown?"Hide checkpoint":"Show checkpoint";
        visibility.setAttribute("aria-label",visibility.title);
        visibility.setAttribute("aria-pressed",String(shown));
        visibility.querySelector("i").className="fa-solid fa-"+(shown?"eye":"eye-slash");
      };
      visibility.addEventListener("click",()=>{
        if(discovery.value!=="unknown"){knownState=discovery.value;discovery.value="unknown";}
        else discovery.value=discoveryMethod?.value==="lore"?"lore":knownState;
        updateVisibility();
      });
      updateVisibility();
      discovery.setAttribute("aria-label", "Checkpoint discovery status");
      discoveryMethod = field("Discovery method", createCheckpointChoice(CHECKPOINT_DISCOVERY_METHODS,
        checkpointDiscoveryMethod(discoveryMethods,this.checkpointId)));

      const radiusControl=createCheckpointRange(
        checkpointRevealRadiusCells(exploration,this.checkpointId),
        {min:0,max:100,step:.25,label:"Checkpoint terrain reveal radius in grid cells"});
      revealRadius=radiusControl.number;
      field("Terrain revealed on discovery (cells)",radiusControl.element);
      fields.appendChild(el("small","Reveals map terrain after this checkpoint becomes known. It does not discover nearby checkpoints. Set to 0 for the marker only."));
    } else {
      playerVisibility.hidden=true;
      const visibility=createSettingsIconButton({icon:"eye",label:"Show checkpoint"});
      const row=el("div");
      row.className="atlas-checkpoint-footer-visibility";
      visibility.className+=" atlas-checkpoint-footer-icon";
      row.append(playerVisibility,visibility);
      visibilityAction=row;
      updateVisibility=()=>{
        const shown=playerVisibility.checked;
        visibility.title=shown?"Hide checkpoint":"Show checkpoint";
        visibility.setAttribute("aria-label",visibility.title);
        visibility.setAttribute("aria-pressed",String(shown));
        visibility.querySelector("i").className="fa-solid fa-"+(shown?"eye":"eye-slash");
      };
      visibility.addEventListener("click",()=>{playerVisibility.checked=!playerVisibility.checked;updateVisibility();});
      updateVisibility();
    }
    const type=createCheckpointChoice(CHECKPOINT_MARKER_TYPES,appearance.type);
    type.id="atlas-checkpoint-marker-type";
    type.setAttribute("aria-label","Checkpoint marker type");
    let selected = appearance.icon;
    const iconPicker = createCheckpointIconPicker({selectedId:selected,compact:true,
      onChange:id=>{selected=id;updatePreview();}});
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
      new Picker({ type: "image", callback: path => { image.value = path; updatePreview(); } }).render(true);
    });
    imageSection.append(image, browse);

    fields = el("div"); fields.style.cssText = "display:grid;gap:.55rem;";
    pageMarker.appendChild(fields);
    const markerSize=createCheckpointMarkerSize(appearance.size);
    const size=markerSize.input;
    field("Marker size (12–64 px)", markerSize.element);
    const color = createCheckpointColor(appearance.color,{label:"Checkpoint color"});
    field("Checkpoint color", color);
    const borderColor = createCheckpointColor(appearance.borderColor,{label:"Checkpoint border color"});
    field("Checkpoint border color", borderColor);
    fields = el("div"); fields.style.cssText = "display:grid;gap:.55rem;";
    pageMarker.appendChild(fields);
    const mode = field("Checkpoint label", createCheckpointChoice(CHECKPOINT_LABEL_MODES,appearance.labelMode));
    const showRoad = createCheckpointCheckbox(appearance.showRoadName);
    field("Include road name with label", showRoad);
    const textColor = createCheckpointColor(appearance.textColor,{label:"Checkpoint label text color"});
    field("Checkpoint / road label text color", textColor);
    // The icon picker is a separate action BEFORE the marker-type selector.
    // Avoid nesting a button inside an HTML label; keep native keyboard order.
    const markerRow=el("div");
    markerRow.className="atlas-checkpoint-marker-row";
    const markerCaption=el("label","Checkpoint marker");
    markerCaption.htmlFor=type.id;
    const markerControls=el("div");
    markerControls.className="atlas-checkpoint-marker-controls";
    iconSection.className+=" atlas-checkpoint-icon-selector";
    markerControls.append(iconSection,type);
    markerRow.append(markerCaption,markerControls);
    pageMarker.appendChild(markerRow);
    pageMarker.appendChild(imageSection);
    const updateType = () => {
      iconSection.hidden = type.value !== "fa";
      imageSection.hidden = type.value !== "image";
    };
    type.addEventListener("change", updateType);
    updateType();
    const preview=el("fieldset");preview.className="atlas-checkpoint-preview";
    preview.appendChild(el("legend","Map preview"));
    const previewMarker=el("span"),previewLabel=el("span");
    previewMarker.style.cssText="display:inline-grid;place-items:center;flex:0 0 auto;";
    previewLabel.style.cssText="display:grid;justify-items:start;min-width:0;gap:2px;"+
      "font-family:Arial,sans-serif;text-align:left;overflow-wrap:anywhere;"+
      "text-shadow:1px 1px 2px #000,-1px -1px 2px #000;";
    const sample=el("div");sample.style.cssText="min-height:90px;display:flex;align-items:center;justify-content:center;gap:12px;background:#303936;padding:.8rem;border-radius:5px;";
    sample.append(previewMarker,previewLabel);preview.appendChild(sample);
    sample.tabIndex=0;
    preview.appendChild(el("small","Hover or focus the sample to preview hover-only labels. Map zoom may change the displayed size."));
    pageMarker.appendChild(preview);
    const updatePreview=()=>{
      const marker=type.value==="fa"?createCheckpointIconGlyph(selected):
        el(type.value==="image"?"img":"span");
      if(type.value==="image"){
        try{
          const safe=validateCheckpointAppearance({...appearance,
            type:"image",image:image.value.trim()});
          marker.src=safe.image;
        }catch{/* Invalid draft paths are not loaded. */}
        marker.alt="Checkpoint marker";
      }
      const appearanceSize=Math.max(12,Math.min(64,Number(size.value)||24));
      // Scene canvas markers are zoom-clamped. Preview their actual screen
      // dimensions, not the icon gallery's large 46px selection sample.
      const zoom=globalThis.canvas?.stage?.scale?.x;
      const scale=Number.isFinite(zoom)&&zoom>0?zoom:1;
      const screenSize=checkpointCanvasSize(appearanceSize,scale)*scale;
      marker.style.width=screenSize+"px";
      marker.style.height=screenSize+"px";
      marker.style.fontSize=screenSize+"px";
      marker.style.lineHeight="1";
      marker.style.display="inline-grid";
      marker.style.placeItems="center";
      marker.style.boxSizing="border-box";
      marker.style.color=color.value;
      marker.style.border="none";
      marker.style.filter="";
      marker.style.textShadow="";
      marker.style.background="";
      if(type.value==="dot"){
        marker.style.borderRadius="50%";
        marker.style.border="2px solid "+borderColor.value;
        marker.style.background=color.value;
      }else if(type.value==="fa"&&
          (marker.tagName?.toLowerCase?.()??marker.tag)!=="img"){
        marker.style.textShadow=[
          "-1px 0","1px 0","0 -1px","0 1px",
          "-1px -1px","1px -1px","-1px 1px","1px 1px"
        ].map(offset=>offset+" "+borderColor.value).join(",");
      }else{
        marker.style.filter="drop-shadow(1px 0 "+borderColor.value+") "+
          "drop-shadow(-1px 0 "+borderColor.value+")";
      }
      previewMarker.replaceChildren(marker);
      const road=readAtlas(this.scene).roads?.find(r=>
        r.id===(draftRoad?.value??current.roadId));
      const nameScreenSize=Math.max(12,Math.min(22,16*Math.sqrt(scale)));
      const roadScreenSize=Math.max(10,Math.min(18,12*Math.sqrt(scale)));
      const checkpointName=el("strong",name.value);
      checkpointName.style.cssText="font-size:"+nameScreenSize+
        "px;line-height:1.25;font-weight:700;";
      const roadName=el("span",road?.name??"");
      roadName.style.cssText="font-size:"+roadScreenSize+
        "px;line-height:1.25;font-style:italic;";
      roadName.hidden=!(showRoad.checked&&road?.name);
      previewLabel.replaceChildren(checkpointName,roadName);
      previewLabel.style.color=textColor.value;
      previewLabel.hidden=mode.value==="off";
      preview.setAttribute("data-label-mode",mode.value);
    };
    root.addEventListener("input",updatePreview);
    root.addEventListener("change",updatePreview);
    updatePreview();
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
      updateVisibility();
      if(preset.journalUuid)journalInput.value=preset.journalUuid;
      playerVisibility.checked=preset.playerVisible===true;
      terrainSuggestion={...preset.terrain};
      transportEditor.setOffers(preset.transportation??[]);
      iconPicker.value=selected;updateType();updatePresetControl();updatePreview();
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
    updatePresetControl();
    const journalControls = journalLinkFields(journalLinks,"checkpoint",this.checkpointId);
    pageGeneral.appendChild(journalControls);
    pageTerrain.style.cssText="min-width:0;";
    const checkpointRegions=this.createDraft?[]:listGeneratedRegions(this.scene).filter(item=>
      item.metadata?.checkpointIds?.includes(this.checkpointId));
    const presetNames=new Map(checkpointRegions.length?
      readWorldTravelPresets().presets.map(p=>[p.id,p.name]):[]);
    const terrainSummary=el("fieldset");terrainSummary.appendChild(el("legend","Terrain & connections"));
    terrainSummary.appendChild(el("p","Set local travel conditions with a Terrain Region. Overlapping Regions use their configured priority."));
    pageTerrain.appendChild(terrainSummary);
    let updateGeographicHint=null;
    if(!this.createDraft){
      const hint=el("p");
      updateGeographicHint=()=>{
        const linked=territoryCheckpointLinks(this.scene).filter(item=>
          item.link?.checkpointId===this.checkpointId);
        hint.textContent=linked.length?
        `Linked geographic Territory: ${linked.map(item=>item.regionName).join(", ")}. `+
          "The linked Territory keeps its own boundary and Journal.":
        "No geographic Territory is associated with this Checkpoint. " +
          "Choose Link Territory to associate a place.";
      };
      updateGeographicHint();terrainSummary.appendChild(hint);
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
      const terrainActions=el("div");
      terrainActions.className="atlas-checkpoint-terrain-actions";
      terrainActions.append(terrainButton("Link Territory","territory"),
        terrainButton("Create Terrain Region…","create"));
      terrainSummary.appendChild(terrainActions);
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
      pageTerrain.appendChild(el("p", this.createDraft.independent
        ? "A standalone Checkpoint can later be linked to an existing native Territory or receive its own GM-approved generated Region. No Region is created automatically."
        : "A Terrain Region can be generated immediately after the new checkpoint is saved. You'll preview its geometry and choose its travel preset before confirming."));
    }
    const generateAfterCreate=this.createDraft&&!this.createDraft.independent?el("input"):null;
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
    controls.className = "atlas-checkpoint-form-actions";
    controls.style.cssText = "position:sticky;bottom:0;z-index:2;background:#100f17;padding:.4rem 0;";
    const save = el("button", this.createDraft ? "Create Checkpoint" : "Save Checkpoint");
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
        if(!game.user?.isGM)throw Error("Only a GM can save World presets.");
        const before=readWorldCheckpointPresets();
        const wrapper=el("div"),input=el("input");
        const target=createSettingsSelect([["","Create a new preset"],...before.presets.map(p=>[p.id,"Replace: "+p.name])],
          {selectedId:"",name:"presetTarget"});
        target.name="presetTarget";
        const targetLabel=el("label","Save as");targetLabel.appendChild(target);wrapper.appendChild(targetLabel);
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
        if(JSON.stringify(world)!==JSON.stringify(before))throw Error("World presets changed. Try saving again.");
        const targetId=String(values.presetTarget??"");
        const existing=world.presets.find(p=>p.id===targetId);
        if(targetId&&!existing)throw Error("The selected preset no longer exists.");
        const suggested=terrainSuggestion;
        const preset={id:existing?.id??("checkpoint-custom-"+foundry.utils.randomID()),
          name:String(values.presetName??"").trim(),category:category.value,
          appearance:a,discoveryMethod:discoveryMethod?.value??"automatic",
          elevationMeters:elevationMeters(),
          discoveryStatus:discovery?.value??"unknown",
          journalUuid:journalInput.value.trim()||null,
          playerVisible:playerVisibility.checked,
          revealRadiusCells:Number(revealRadius?.value??3),
          terrain:suggested?{...suggested}:{presetId:null,radiusCells:.25},
          transportation:transportEditor.getOffers(),
          event:{kind:"none",enabled:false}};
        const next=upsertCheckpointPreset(world,preset);
        if(existing&&!await foundry.applications.api.DialogV2.confirm({
          window:{title:"Replace World preset?"},content:"<p>Replace the selected World preset with these settings? Existing checkpoints are not changed.</p>",
          yes:{label:"Replace preset"},no:{label:"Keep existing"},rejectClose:false}))return;
        if(JSON.stringify(readWorldCheckpointPresets())!==JSON.stringify(before))throw Error("World presets changed. Try saving again.");
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
          if (!this.createDraft.independent && !this.createDraft.roads.some(road => road.id === roadId))
            throw Error("Choose a named road for this checkpoint.");
          if (!name.value.trim() || name.value.length > 120)
            throw Error("Enter a checkpoint name (1–120 characters).");
          if (raw !== "" && !Number.isFinite(Number(raw)))
            throw Error("Enter a valid elevation.");
          const config = {
            roadId: this.createDraft.independent ? null : roadId, name: name.value.trim(),
            elevationMeters: elevationMeters(),
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
          elevationMeters: elevationMeters(),
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
    const leaveForAction=async(action)=>{
      const approved=await approveSettingsClose({isDirty:this._isDirty,save:this._saveDraft,title:"Checkpoint Settings"});
      if(!approved)return;
      if(!this._skipClosePrompt){this._skipClosePrompt=true;await this.close();}
      await action();
    };
    if(!this.createDraft&&this.onMove){
      const move=createSettingsIconButton({icon:"up-down-left-right",label:"Move checkpoint"});
      move.className+=" atlas-checkpoint-footer-icon";
      move.addEventListener("click",()=>void leaveForAction(this.onMove).catch(error=>ui.notifications.error(error.message)));
      controls.appendChild(move);
    }
    if(!this.createDraft){
      const roads=el("fieldset");roads.appendChild(el("legend","Road connection"));
      const atlas=readAtlas(this.scene);
      const incidents=atlas.segments.filter(segment=>segment.from===current.nodeId||segment.to===current.nodeId);
      const names=[...new Set(incidents.map(segment=>atlas.roads.find(road=>road.id===segment.roadId)?.name).filter(Boolean))];
      const roadIdentity=el("div");
      roadIdentity.className="atlas-checkpoint-connected-roads";
      roadIdentity.appendChild(el("strong",names.length?
        (names.length===1?"Connected road":"Connected roads"):
        "No connected road"));
      if(names.length){
        const list=el("ul");
        for(const label of names)list.appendChild(el("li",label));
        roadIdentity.appendChild(list);
      }else roadIdentity.appendChild(el("small",
        "This checkpoint is currently independent of the Road network."));
      roads.appendChild(roadIdentity);
      roads.appendChild(el("small",incidents.length>1?
        "This checkpoint lies on connected Road sections. Use Road point editing to change its position or connections safely.":
        "Move closer to a Road to snap and connect, or connect an endpoint with a new Road section. No connection is made automatically."));
      if(this.onRoad){
        const connect=el("button",incidents.length?"Disconnect Road…":"Connect to Road…");connect.type="button";
        connect.disabled=incidents.length>1;
        if(connect.disabled)connect.title="Edit the connected Road points to preserve shared topology.";
        connect.addEventListener("click",()=>void leaveForAction(this.onRoad).catch(error=>ui.notifications.error(error.message)));
        roads.appendChild(connect);
      }
      pageTerrain.prepend(roads);
    }
    if(visibilityAction)controls.appendChild(visibilityAction);
    controls.append(saveAsPreset,save);
    if(remove){
      remove.className+=" atlas-checkpoint-footer-delete";
      controls.appendChild(remove);
    }
    root.appendChild(controls);
    this._saveDraft=()=>saveValue(undefined);
    this._isDirty=trackSettingsChanges(root,()=>({selected,terrainSuggestion,
      transportation:transportEditor.getOffers()}));
    return root;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.querySelector('input[aria-label="Checkpoint name"]')?.focus();
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}
