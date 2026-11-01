import { MODULE_ID } from "./atlas-storage.js";
import { CHECKPOINT_TYPE_GROUPS } from "./checkpoint-types.js";
import { CHECKPOINT_PRESET_SETTING,upsertCheckpointPreset } from "./checkpoint-preset-model.js";
import { readWorldCheckpointPresets } from "./checkpoint-preset-settings.js";
import { readWorldTravelPresets,travelPresetDisplayGroup } from "./travel-preset-settings.js";
import { CHECKPOINT_ICONS,CHECKPOINT_ICON_ROOT,CHECKPOINT_FREE_ICONS,findCheckpointIcons,
  checkpointFontIcon,resolveCheckpointAppearance,validateCheckpointAppearance }
  from "./checkpoint-appearance.js";

const el=(tag,label)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;};

/** Full World template form. No Scene/Region/Journal write occurs here. */
export class AtlasCheckpointPresetEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:"fvtt-atlas-checkpoint-preset-editor",
    window:{title:"Atlas — Edit Checkpoint Preset",resizable:true},
    position:{width:720,height:740}};

  constructor({preset=null,onSaved}){
    super({position:{width:Math.min(720,window.innerWidth-60),
      height:Math.min(740,window.innerHeight-65)}});
    this.preset=preset;this.onSaved=onSaved;this.activeTab="General";
  }

  async _renderHTML(){
    if(!game.user?.isGM)throw Error("Only a GM can edit World checkpoint presets.");
    const preset=this.preset;
    const appearance=resolveCheckpointAppearance(preset?.appearance);
    const root=el("div");
    root.style.cssText="padding:.8rem 1rem;display:flex;flex-direction:column;gap:.75rem;height:100%;overflow:auto;box-sizing:border-box;";
    const tabs=el("div");tabs.style.cssText="display:flex;gap:.35rem;flex-wrap:wrap;";
    const sections=new Map(),buttons=new Map();
    for(const name of ["General","Marker & labels","Terrain Region"]){
      const button=el("button",name);button.type="button";
      button.style.cssText="flex:1 1 9rem;min-height:2.25rem;";
      const panel=el("section");panel.style.cssText="display:grid;gap:.6rem;align-content:start;";
      tabs.appendChild(button);sections.set(name,panel);buttons.set(name,button);
      button.addEventListener("click",()=>{this.activeTab=name;showTab();});
    }
    const showTab=()=>{
      for(const [name,panel] of sections){
        panel.hidden=name!==this.activeTab;
        buttons.get(name).setAttribute("aria-pressed",String(name===this.activeTab));
        buttons.get(name).style.background=name===this.activeTab?"var(--color-bg-option,#2c2540)":"";
      }
    };
    root.appendChild(tabs);
    const field=(panel,label,control)=>{
      const row=el("label");
      row.style.cssText="display:grid;grid-template-columns:minmax(130px,1fr) minmax(160px,1.4fr);gap:.6rem;align-items:center;";
      row.append(el("span",label),control);panel.appendChild(row);return control;
    };
    const input=(value,type="text")=>{
      const n=el("input");n.type=type;n.value=String(value??"");return n;
    };
    const choose=(choices,value)=>{
      const n=el("select");
      for(const [key,title] of choices){const option=el("option",title);option.value=key;n.appendChild(option);}
      n.value=value;return n;
    };
    const general=sections.get("General");
    general.appendChild(el("p","Reusable defaults for checkpoints. Names, map coordinates and discovery history remain independent until the GM explicitly applies this preset."));
    const name=field(general,"Preset name",input(preset?.name??""));name.maxLength=120;name.required=true;
    const category=el("select");
    for(const [heading,types] of CHECKPOINT_TYPE_GROUPS){
      const group=el("optgroup");group.label=heading;
      for(const [key,title] of types){const option=el("option",title);option.value=key;group.appendChild(option);}
      category.appendChild(group);
    }
    category.value=preset?.category??"custom";
    field(general,"Checkpoint type",category);
    const elevation=field(general,"Default elevation (m)",input(preset?.elevationMeters??"","number"));
    elevation.step="any";elevation.placeholder="No elevation override";
    const discovery=field(general,"Default discovery status",choose([
      ["unknown","Undiscovered"],["visited","Seen / Visited"],["lore","Known through Lore"]],
      preset?.discoveryStatus??"unknown"));
    const discoveryMethod=field(general,"Discovery method",choose([
      ["automatic","Automatic — explorer proximity"],["gm","GM Only — manual reveal"],
      ["lore","Lore Only — story discovery"]],preset?.discoveryMethod??"automatic"));
    const reveal=field(general,"Reveal radius (cells)",input(preset?.revealRadiusCells??3,"number"));
    reveal.min="0";reveal.max="100";reveal.step="0.25";
    const journal=field(general,"Default linked Journal / Page UUID",input(preset?.journalUuid??""));
    journal.placeholder="Optional; copied only when this preset is applied";
    general.appendChild(el("small","Journal links follow Foundry's native permissions. Leave empty if each checkpoint should link to a different entry."));
    const playerVisible=field(general,"Show to players by default",el("input"));
    playerVisible.type="checkbox";playerVisible.checked=preset?.playerVisible===true;
    general.appendChild(el("small","Visibility is still controlled by Atlas discovery and native Foundry permissions. A preset never reveals existing checkpoints retroactively."));

    const marker=sections.get("Marker & labels");
    const markerType=field(marker,"Checkpoint marker",choose([
      ["dot","Default dot"],["fa","Font Awesome Free icon"],["image","Custom Foundry image"]],appearance.type));
    const size=field(marker,"Marker size (12–64 px)",input(appearance.size,"number"));
    size.min="12";size.max="64";size.step="1";
    const color=field(marker,"Dot / icon color",input(appearance.color,"color"));
    const border=field(marker,"Checkpoint border color",input(appearance.borderColor,"color"));
    const labelMode=field(marker,"Checkpoint label",choose([
      ["off","Off"],["hover","On hover"],["always","Always"]],appearance.labelMode));
    const roadName=field(marker,"Include road name",el("input"));
    roadName.type="checkbox";roadName.checked=appearance.showRoadName;
    const textColor=field(marker,"Label text color",input(appearance.textColor,"color"));
    const imagePath=input(appearance.image);
    imagePath.placeholder="worlds/…/checkpoint.webp";
    const imageRow=el("div");imageRow.style.cssText="display:flex;gap:.3rem;";
    imagePath.style.flex="1";
    const browse=el("button","Browse…");browse.type="button";
    browse.addEventListener("click",()=>{
      const Picker=foundry.applications.apps?.FilePicker;
      if(!Picker){ui.notifications.error("Foundry File Picker is unavailable.");return;}
      new Picker({type:"image",callback:path=>{imagePath.value=path;}}).render(true);
    });
    imageRow.append(imagePath,browse);field(marker,"Custom image path",imageRow);

    const iconPanel=el("div");iconPanel.style.cssText="display:grid;gap:.4rem;min-width:0;";
    const selected=el("div");
    let iconId=appearance.icon;
    const details=new Map(CHECKPOINT_FREE_ICONS.map(item=>[item.id,item]));
    const preview=el("div");
    preview.style.cssText="display:grid;justify-items:center;gap:.3rem;padding:.65rem;border:1px solid #8a70c6;border-radius:.5rem;";
    preview.setAttribute("aria-label","Selected icon preview");
    const previewGlyph=el("div"),previewName=el("strong"),previewDetails=el("small");
    preview.append(previewGlyph,previewName,previewDetails);
    const choices=new Map();
    const iconSearch=input("");iconSearch.type="search";
    iconSearch.placeholder="Search fantasy icons: bridge, ship, castle, cave…";
    const categoryFilter=choose([
      ["rpg","RPG & fantasy (recommended)"],["settlements","Settlements & structures"],
      ["travel","Roads & travel"],["nature","Nature & terrain"],
      ["danger","Combat & danger"],["magic","Magic & mystery"],
      ["creatures","Characters & creatures"],["all","Advanced — all icons, including modern brands"]],"rpg");
    const styleFilter=choose([["all","All Free icon styles"],["solid","Solid"],
      ["regular","Regular"],["brands","Brands"]],"all");
    const iconTabs=el("div");iconTabs.style.cssText="display:flex;gap:.25rem;flex-wrap:wrap;";
    const tabButtons=[];
    for(const [key,title] of [["rpg","RPG picks"],["settlements","Places"],
      ["travel","Travel"],["nature","Nature"],["danger","Danger"],
      ["magic","Magic"],["creatures","Creatures"],["all","All / Advanced"]]){
      const tab=el("button",title);tab.type="button";
      tab.addEventListener("click",()=>{categoryFilter.value=key;renderIcons(true);});
      iconTabs.appendChild(tab);tabButtons.push([key,tab]);
    }
    const quick=el("div");quick.style.cssText="display:flex;flex-wrap:wrap;gap:.25rem;";
    const grid=el("div");
    grid.style.cssText="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:.35rem;max-height:325px;overflow:auto;";
    const results=el("small");
    const glyphFor=id=>{
      const font=checkpointFontIcon(id);
      if(font){const glyph=el("span",font.glyph);
        glyph.style.cssText="font-family:'"+font.family+"';font-weight:"+font.weight+";font-size:24px;";
        return glyph;}
      const img=el("img");img.src=CHECKPOINT_ICON_ROOT+id+".svg";img.alt="";
      img.style.cssText="width:24px;height:24px;";return img;
    };
    const syncIcon=()=>{
      const item=details.get(iconId);
      previewGlyph.replaceChildren(glyphFor(iconId));
      previewName.textContent=item?.label??iconId;
      previewDetails.textContent=item?.terms??"Classic Atlas icon";
      selected.textContent="Selected: "+iconId;
      for(const [id,button] of choices){
        button.style.borderColor=id===iconId?"#8a70c6":"transparent";
        button.setAttribute("aria-pressed",String(id===iconId));
      }
    };
    const makeIconButton=(id,label,compact=false)=>{
      const button=el("button");button.type="button";
      button.style.cssText="display:grid;justify-items:center;gap:.2rem;padding:.35rem;border:2px solid transparent;min-height:"+(compact?42:69)+"px;";
      button.title=id+" — "+label;
      button.setAttribute("aria-label","Use "+label+" checkpoint icon");
      button.appendChild(glyphFor(id));
      if(!compact)button.appendChild(el("small",label));
      button.addEventListener("click",()=>{iconId=id;syncIcon();});
      choices.set(id,button);
      return button;
    };
    for(const id of CHECKPOINT_ICONS)quick.appendChild(makeIconButton(id,id,true));
    let visible=36;
    const renderIcons=(newSearch=false)=>{
      if(newSearch)visible=36;
      const matches=findCheckpointIcons(iconSearch.value,styleFilter.value,categoryFilter.value);
      for(const id of [...choices.keys()])if(!CHECKPOINT_ICONS.includes(id))choices.delete(id);
      grid.replaceChildren();
      for(const item of matches.slice(0,visible))grid.appendChild(makeIconButton(item.id,item.label));
      results.textContent=matches.length+" matching Free icons · showing "+Math.min(visible,matches.length)+". Bundled locally.";
      for(const [id,tab] of tabButtons){
        tab.style.borderColor=id===categoryFilter.value?"#9c7bf0":"transparent";
        tab.setAttribute("aria-pressed",String(id===categoryFilter.value));
      }
      more.hidden=visible>=matches.length;
      syncIcon();
    };
    const more=el("button","Show 36 more icons");more.type="button";
    more.addEventListener("click",()=>{visible+=36;renderIcons();});
    iconSearch.addEventListener("input",()=>renderIcons(true));
    styleFilter.addEventListener("change",()=>renderIcons(true));
    categoryFilter.addEventListener("change",()=>renderIcons(true));
    const sidebar=el("div");sidebar.style.cssText="display:grid;gap:.5rem;align-content:start;";
    sidebar.append(el("strong","Search"),iconSearch,el("small","Icon style"),styleFilter,
      preview,selected);
    const gallery=el("div");gallery.style.cssText="display:grid;gap:.45rem;min-width:0;";
    gallery.append(iconTabs,el("small","Original quick picks"),quick,results,grid,more);
    const browser=el("div");browser.style.cssText="display:grid;grid-template-columns:minmax(180px,1fr) minmax(280px,2fr);gap:.8rem;min-width:0;";
    browser.append(sidebar,gallery);
    const iconSection=el("details");
    iconSection.style.cssText="min-width:0;padding:.6rem;border:1px solid var(--color-border-light-tertiary,#666);";
    const iconLegend=el("summary","Choose icon");iconLegend.style.cursor="pointer";
    iconSection.append(iconLegend,browser);
    iconPanel.appendChild(iconSection);
    // Match Checkpoint Settings: marker type, custom image, then icon picker are last.
    marker.appendChild(markerType.closest("label"));
    marker.appendChild(imageRow.closest("label"));
    marker.appendChild(iconPanel);
    const updateMarker=()=>{
      iconPanel.hidden=markerType.value!=="fa";
      imageRow.closest("label").hidden=markerType.value!=="image";
    };
    markerType.addEventListener("change",updateMarker);syncIcon();renderIcons();updateMarker();

    const terrain=sections.get("Terrain Region");
    terrain.appendChild(el("p","These are suggestions for the native checkpoint Region generator; creating or editing actual Region geometry and Behaviors still requires GM confirmation."));
    const terrainId=el("select");
    const noTerrain=el("option","None — no terrain suggestion");noTerrain.value="";
    terrainId.appendChild(noTerrain);
    const groups=new Map();
    for(const presetItem of readWorldTravelPresets().presets){
      const display=travelPresetDisplayGroup(presetItem);
      const heading=display.subgroup?display.group+" — "+display.subgroup:display.group;
      if(!groups.has(heading)){
        const group=el("optgroup");group.label=heading;
        groups.set(heading,group);terrainId.appendChild(group);
      }
      const option=el("option",display.name);option.value=presetItem.id;
      groups.get(heading).appendChild(option);
    }
    terrainId.value=preset?.terrain?.presetId??"";
    field(terrain,"Suggested travel preset",terrainId);
    const radius=field(terrain,"Suggested radius (cells)",input(preset?.terrain?.radiusCells??.25,"number"));
    radius.min="0.25";radius.max="3";radius.step="0.25";
    const eventKind=field(terrain,"Event classification (future)",choose([
      ["none","None"],["hazard","Environmental hazard"],["encounter","Encounter"]],
      preset?.event?.kind??"none"));
    terrain.appendChild(el("small","No automatic event triggers, random rolls or encounter spawning are enabled by this preset."));

    for(const panel of sections.values())root.appendChild(panel);
    const footer=el("div");
    footer.style.cssText="display:flex;justify-content:flex-end;gap:.5rem;position:sticky;bottom:0;background:#100f17;padding:.5rem 0;";
    const cancel=el("button","Cancel");cancel.type="button";
    cancel.addEventListener("click",()=>this.close());
    const save=el("button","Save Checkpoint Preset");save.type="button";
    save.addEventListener("click",async()=>{
      if(save.disabled)return;
      save.disabled=true;
      try{
        const style=validateCheckpointAppearance({type:markerType.value,icon:iconId,
          image:imagePath.value.trim(),size:Number(size.value),color:color.value,
          borderColor:border.value,labelMode:labelMode.value,
          showRoadName:roadName.checked,textColor:textColor.value});
        const next={id:preset?.id??("checkpoint-custom-"+foundry.utils.randomID()),
          name:name.value.trim(),category:category.value,appearance:style,
          elevationMeters:elevation.value.trim()===""?null:Number(elevation.value),
          discoveryStatus:discovery.value,discoveryMethod:discoveryMethod.value,
          revealRadiusCells:Number(reveal.value),journalUuid:journal.value.trim()||null,
          playerVisible:playerVisible.checked,
          terrain:{presetId:terrainId.value||null,radiusCells:Number(radius.value)},
          event:{kind:eventKind.value,enabled:false}};
        await game.settings.set(MODULE_ID,CHECKPOINT_PRESET_SETTING,
          upsertCheckpointPreset(readWorldCheckpointPresets(),next));
        await this.close();await this.onSaved?.();
        ui.notifications.info("Checkpoint preset saved. Existing checkpoints remain unchanged.");
      }catch(error){ui.notifications.error(error.message??String(error));}
      finally{save.disabled=false;}
    });
    footer.append(cancel,save);root.appendChild(footer);showTab();
    return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
}
