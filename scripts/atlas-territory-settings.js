import {MODULE_ID,readAtlas} from "./atlas-storage.js";
import {listSceneRegions} from "./region-atlas.js";
import {listSceneGeography} from "./territory-geography-storage.js";
import {GEOGRAPHY_KINDS} from "./territory-geography-model.js";
import {readTerritoryCheckpointLink} from "./territory-checkpoint-link.js";
import {readPlayerTerritorySharing} from "./player-territory-sharing.js";
import {listPublicTerritorySettings} from "./region-narration.js";
import {readAtlasJournalLinks,journalUuidFor,openAtlasJournal} from "./atlas-journal-links.js";
import {territoryBoundaryNeedsAdoption} from "./territory-authoring.js";
import {GRID_CONVERSION_BACKUP_FLAG} from "./territory-authoring-model.js";
import {readPendingTerritoryCellTransfer} from "./territory-grid-transfer.js";
import {atlasSettingsTitle} from "./atlas-settings-title.js";

const pages=["General","Checkpoint & Journal","Map & Visibility","Boundary & Native"];
const el=(tag,text,className)=>{
  const item=document.createElement(tag);
  if(text!==undefined)item.textContent=text;
  if(className)item.className=className;
  return item;
};

/** One settings surface for every action formerly scattered across the Territory row.
 * Native Region writes remain exclusively in the existing preview/confirmation actions. */
export class AtlasTerritorySettings extends foundry.applications.api.ApplicationV2{
  static DEFAULT_OPTIONS={
    window:{title:"Atlas — Territory Settings",resizable:true,minimizable:true},
    position:{width:710,height:590,left:80}
  };

  constructor({scene,regionId,actions,refresh,onLocate}){
    const name=scene.regions?.get?.(regionId)?.name;
    super({window:{title:atlasSettingsTitle("Territory",name),minimizable:true},
      position:{width:Math.min(710,Math.max(390,window.innerWidth-65)),
        height:Math.min(700,Math.max(450,window.innerHeight-85))}});
    this.scene=scene;
    this.regionId=regionId;
    this.actions=actions;
    this.externalRefresh=refresh;
    this.onLocate=onLocate;
    this.activePage="General";
    this.busy=false;
    this._scrollY=0;
  }

  async _renderHTML(){
    if(!game.user?.isGM||!this.scene?.canUserModify?.(game.user,"update"))
      throw Error("Only a Scene-authorized GM can edit Territory settings.");
    const native=this.scene.regions?.get?.(this.regionId);
    if(!native)throw Error("This native Territory no longer exists in the Scene.");
    this._scrollY=this.element?.querySelector?.("[data-atlas-territory-settings-body]")?.scrollTop??this._scrollY;
    const summary=listSceneRegions(this.scene).find(item=>item.id===this.regionId);
    const geo=listSceneGeography(this.scene).find(item=>item.id===this.regionId);
    const draft=this.actions.draft(this.scene);
    const pending=readPendingTerritoryCellTransfer(this.scene);
    const batch=this.actions.territoryBatchState?.(this.scene);
    const batchExcluded=Boolean(batch?.total&&!batch.targets.some(item=>item.id===this.regionId));
    const polygonShapes=Array.from(native.shapes??[]);
    const isPolygon=polygonShapes.length===1&&polygonShapes[0]?.type==="polygon";
    const canEdit=!!summary?.linked&&!summary?.invalidLink&&!!geo?.geography?.kind;
    const hasBackup=native.getFlag?.(MODULE_ID,GRID_CONVERSION_BACKUP_FLAG)!=null;
    const hasSource=!!native.getFlag?.(MODULE_ID,"territoryBoundarySource");
    const boundaryStale=territoryBoundaryNeedsAdoption(native);
    let checkpointLink=null,checkpointInvalid=false;
    try{checkpointLink=readTerritoryCheckpointLink(native);}
    catch{checkpointInvalid=true;}
    let playerShared=false,sharingInvalid=false;
    try{playerShared=Boolean(readPlayerTerritorySharing(native));}
    catch{sharingInvalid=true;}
    const atlas=readAtlas(this.scene);
    const checkpoint=atlas.checkpoints?.find(item=>item.id===checkpointLink?.checkpointId);
    const journal=checkpoint?journalUuidFor(readAtlasJournalLinks(this.scene),
      "checkpoint",checkpoint.id):null;
    const publicEntry=listPublicTerritorySettings(this.scene)
      .find(item=>item.id===this.regionId);

    const root=el("section",undefined,"atlas-territory-settings");
    root.setAttribute("data-atlas-territory-settings",this.regionId);
    const tabBar=el("nav",undefined,"atlas-territory-settings-tabs");
    tabBar.setAttribute("aria-label","Territory settings sections");
    for(const page of pages){
      const tab=el("button",page);
      tab.type="button";
      tab.dataset.atlasTerritoryPage=page;
      tab.setAttribute("aria-current",String(this.activePage===page));
      tab.addEventListener("click",()=>{
        if(this.activePage===page)return;
        this.activePage=page;
        this._scrollY=0;
        void this.render(true);
      });
      tabBar.appendChild(tab);
    }
    root.appendChild(tabBar);
    const body=el("div",undefined,"atlas-territory-settings-body");
    body.setAttribute("data-atlas-territory-settings-body","");
    root.appendChild(body);
    const group=(title,description)=>{
      const fieldset=el("fieldset");
      fieldset.appendChild(el("legend",title));
      if(description)fieldset.appendChild(el("p",description,"hint"));
      body.appendChild(fieldset);
      return fieldset;
    };
    const action=(into,title,detail,run,{disabled=false,danger=false}={})=>{
      const row=el("div",undefined,"atlas-territory-settings-action");
      const text=el("div");text.appendChild(el("strong",title));
      text.appendChild(el("p",detail,"hint"));
      const btn=el("button",title);
      btn.type="button";
      btn.disabled=disabled||this.busy;
      if(danger)btn.classList.add("atlas-danger");
      btn.addEventListener("click",async()=>{
        if(this.busy)return;
        this.busy=true;btn.disabled=true;
        try{
          await run();
          this.externalRefresh?.();
          if(this.rendered!==false)await this.render(true);
        }catch(error){ui.notifications.error(error.message??String(error));}
        finally{this.busy=false;btn.disabled=disabled;}
      });
      row.append(text,btn);into.appendChild(row);
    };
    if(this.activePage==="General"){
      const general=group("Territory identity",
        "Native Foundry Region details and Atlas geographic classification are edited separately; neither changes map geometry without confirmation.");
      const list=el("dl",undefined,"atlas-territory-settings-facts");
      const fact=(term,value)=>{list.append(el("dt",term),el("dd",value));};
      fact("Name",native.name??"Unnamed Region");
      fact("Atlas",summary?.linked?"Linked":"Native only");
      fact("Geographic kind",geo?.invalid?"Unsupported flag":
        GEOGRAPHY_KINDS[geo?.geography?.kind]??"Unclassified");
      const parent=this.scene.regions?.get?.(geo?.geography?.parentRegionId);
      fact("Parent",parent?.name??"None");
      general.appendChild(list);
      action(general,"Native Region settings","Rename, native color, Shapes and Behaviors in Foundry's Region editor.",
        ()=>this.actions.configureRegion(this.scene,this.regionId));
      action(general,"Geographic classification","Set geographic kind, parent Territory and Road membership.",
        ()=>this.actions.configureGeography(this.scene,this.externalRefresh,this.regionId),
        {disabled:!!draft||!canEdit||!!geo?.invalid});
      action(general,summary?.linked?"Remove Atlas link":"Link to Atlas",
        "Keep the native Region and its Shapes. Existing Checkpoint associations are protected.",
        ()=>this.actions.setNativeRegionLink(this.scene,this.regionId,!summary?.linked,this.externalRefresh),
        {disabled:!!draft||!!summary?.invalidLink,danger:!!summary?.linked});
      if(this.onLocate)action(general,"Locate on map","Focus the Scene canvas on this native Region.",
        ()=>this.onLocate(this.regionId));
    }
    if(this.activePage==="Checkpoint & Journal"){
      const linked=group("Linked Checkpoint",
        checkpointInvalid?"Unsupported Checkpoint association — resolve the existing flag before editing.":
          checkpoint?`Linked to ${checkpoint.name}.`:
            "No Atlas Checkpoint linked. The picker displays compatible kinds and their availability.");
      action(linked,"Link or unlink Checkpoint",
        "Review a compatible Checkpoint and confirm changes to the Territory association.",
        ()=>this.actions.configureTerritoryCheckpoint(this.scene,this.regionId,this.externalRefresh),
        {disabled:!!draft||!!pending||!canEdit||checkpointInvalid});
      const journals=group("Checkpoint Journal",
        checkpoint?journal?`Journal attached to ${checkpoint.name}.`:
          `${checkpoint.name} has no linked Journal.`:
          "Link an Atlas Checkpoint above to use its Journal here. No second Journal copy is created.");
      if(journal)action(journals,"Open linked Journal",
        "Open the existing Checkpoint Journal or Journal page with Foundry permissions.",
        ()=>openAtlasJournal(journal));
      action(journals,"Edit Checkpoint & Journal",
        "Open Checkpoint Settings to change its Journal connection and appearance.",
        ()=>this.actions.editCheckpointAppearance(this.scene,checkpoint,this.externalRefresh),
        {disabled:!checkpoint||typeof this.actions.editCheckpointAppearance!=="function"});
    }
    if(this.activePage==="Map & Visibility"){
      const visibility=group("Territory presentation",
        "Public Journey names and player-visible boundary geometry are separate GM permissions. " +
        "Foundry Fog of War still masks unexplored boundaries.");
      const status=el("p",`Native: ${summary?.hidden?"Hidden":"Visible"} · `+
        `Journey: ${publicEntry?.label?`Public (${publicEntry.label})`:"Private"} · `+
        `Player boundary: ${sharingInvalid?"Unsupported":playerShared?"Shared":"Hidden"}`,"hint");
      visibility.appendChild(status);
      action(visibility,"Public Journey name",
        "Choose whether the Territory name may appear in destination and border banners.",
        ()=>this.actions.configurePublicTerritory(this.scene,this.externalRefresh,this.regionId),
        {disabled:!!draft});
      action(visibility,"Player boundary sharing",
        "Allow players to see explored Territory grids; unvisited geometry stays obscured by Fog of War.",
        ()=>this.actions.configureTerritorySharing(this.scene,this.regionId,this.externalRefresh),
        {disabled:!!draft||!!pending||sharingInvalid||
          (!playerShared&&(!canEdit||summary?.hidden||!!geo?.invalid))});
    }
    if(this.activePage==="Boundary & Native"){
      const editing=group("Atlas boundary editor",
        "Paint or edit Territory boundary controls. Atlas preserves native Region Behaviors.");
      action(editing,"Paint / edit boundary","Launch the canvas editor; minimize this window while painting.",
        ()=>this.actions.editTerritoryBoundary(this.scene,this.regionId,this.externalRefresh),
        {disabled:!!draft||!!pending||batchExcluded||!canEdit});
      const native=group("Native Region geometry",
        "Every operation has its own review and confirmation. Backups and recovery plans remain available.");
      if(isPolygon)action(native,"Convert polygon to hex/grid",
        "Preview the selected native polygon as grid cells before applying.",
        ()=>this.actions.previewTerritoryGridConversion(this.scene,this.regionId,this.externalRefresh),
        {disabled:!!draft||!canEdit});
      if(hasBackup)action(native,"Restore original polygon",
        "Recover the backed-up polygon created before grid conversion.",
        ()=>this.actions.restoreTerritoryPolygon(this.scene,this.regionId,this.externalRefresh),
        {disabled:!!draft||!summary?.linked||!!summary?.invalidLink});
      action(native,"Adopt native boundary",
        boundaryStale?"Import externally changed native Shapes into Atlas boundary controls.":
          "Available after native Shapes change outside Atlas.",
        ()=>this.actions.adoptNativeTerritoryBoundary(this.scene,this.regionId,this.externalRefresh),
        {disabled:!!draft||!canEdit||!boundaryStale});
      action(native,"Smooth native polygon",
        "Review a rounded polygon preview; paired borders may require additional work.",
        ()=>this.actions.smoothNativeRegion(this.scene,this.regionId,this.externalRefresh),
        {disabled:!!draft||!!summary?.invalidLink||hasSource});
      if(pending)native.appendChild(el("p",
        "An interrupted multi-Territory cell transfer requires recovery from the Workspace.","hint"));
    }
    return root;
  }

  _replaceHTML(result,content){
    content.replaceChildren(result);
    const body=content.querySelector?.("[data-atlas-territory-settings-body]");
    if(body)body.scrollTop=this._scrollY;
  }
}

const windows=new Map();
/** Reopen/focus the same Scene + Region editor, preserving its selected tab. */
export function openAtlasTerritorySettings(scene,regionId,actions,refresh,onLocate){
  if(!game.user?.isGM||!scene?.canUserModify?.(game.user,"update"))
    throw Error("Only a Scene-authorized GM can edit Territory settings.");
  const key=`${scene.id}:${regionId}`;
  let app=windows.get(key);
  if(!app){
    app=new AtlasTerritorySettings({scene,regionId,actions,refresh,onLocate});
    windows.set(key,app);
    const originalClose=app.close.bind(app);
    app.close=async options=>{
      const result=await originalClose(options);
      if(windows.get(key)===app)windows.delete(key);
      return result;
    };
  }else{
    app.actions=actions;app.externalRefresh=refresh;app.onLocate=onLocate;
  }
  void app.render(true);
  return app;
}
