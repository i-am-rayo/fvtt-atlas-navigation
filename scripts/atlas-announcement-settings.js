import {MODULE_ID} from "./atlas-storage.js";
import {ATLAS_ANNOUNCEMENT_TYPES} from "./atlas-announcement-model.js";
import {AtlasAnnouncementPreviewRenderer} from "./atlas-announcement-view.js";

/** GM-only presentation test harness exposed through native Module Settings. */
export class AtlasAnnouncementPreviewSettings extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={
    id:"fvtt-atlas-announcement-preview",
    window:{title:"Atlas — Announcement Banner Samples",resizable:true},
    position:{width:540,height:610}
  };

  async _renderHTML(){
    const root=document.createElement("div");
    root.className="atlas-announcement-settings";
    const heading=document.createElement("h2");
    heading.textContent="Preview Atlas announcements";
    const note=document.createElement("p");
    note.textContent="Preview-only: these buttons do not discover roads or checkpoints, " +
      "start or change a Journey, advance World time, or notify other clients.";
    root.append(heading,note);
    if(!globalThis.game?.user?.isGM){
      const denied=document.createElement("p");
      denied.textContent="Only a GM may preview Atlas announcement banners.";
      root.appendChild(denied);
      return root;
    }
    const grid=document.createElement("div");
    grid.className="atlas-announcement-samples";
    this._previewRenderer??=new AtlasAnnouncementPreviewRenderer();
    for(const type of ATLAS_ANNOUNCEMENT_TYPES){
      const button=document.createElement("button");
      button.type="button";
      button.className="atlas-announcement-sample-button";
      button.textContent=`${type.icon}  ${type.label}`;
      button.title=`Preview “${type.eyebrow}” locally`;
      button.addEventListener("click",()=>{
        if(globalThis.game?.user?.isGM)this._previewRenderer.show(type.id);
      });
      grid.appendChild(button);
    }
    root.appendChild(grid);
    return root;
  }

  _replaceHTML(result,content){content.replaceChildren(result);}

  async close(options={}){
    this._previewRenderer?.destroy();
    return super.close(options);
  }
}

export function registerAtlasAnnouncementPreviewMenu(){
  game.settings.registerMenu(MODULE_ID,"atlasAnnouncementPreviewMenu",{
    name:"Atlas — Announcement Banner Samples",
    label:"Preview Journey & Discovery Banners",
    hint:"Preview the future Journey, rest, checkpoint and road announcements on this GM client only. No gameplay or player effects.",
    icon:"fa-solid fa-scroll",type:AtlasAnnouncementPreviewSettings,restricted:true
  });
}

Hooks.once("init",registerAtlasAnnouncementPreviewMenu);
