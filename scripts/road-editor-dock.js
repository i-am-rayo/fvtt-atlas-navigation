import { readWorldTravelPresets } from "./travel-preset-settings.js";
import { createSettingsIconButton } from "./settings-controls.js";
import { atlasSettingsTitle } from "./atlas-settings-title.js";
import { readWorldRoadAppearance, resolveRoadAppearance,
  ROAD_APPEARANCE_MODES } from "./road-appearance.js";

const element = (tag, content) => {
  const item = document.createElement(tag);
  if (content !== undefined) item.textContent = content;
  return item;
};

/**
 * A floating point editor owns its transient Scene edit independently of the
 * Scene configuration sheet. Closing that sheet must not discard pending edits.
 */
export function activeRoadDockForSceneConfig(app, dock, controller) {
  const scene = app?.document;
  return Boolean(scene?.id && dock?.scene?.id === scene.id &&
    controller?.getDraft?.(scene));
}

/**
 * Modeless, transient authoring controls. No Scene write occurs until Finish;
 * closing the dock discards active road point/creation edits just like Cancel.
 */
export class AtlasRoadEditorDock extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "fvtt-atlas-road-editor-dock",
    classes: ["atlas-road-editor-window"],
    window: { title: "Atlas — Canvas Editor", frame: false, positioned: true,
      resizable: false, minimizable: false },
    position: { width: 360, height: "auto", left: 24, top: 90 }
  };

  constructor({ scene, controller, sceneSheet, onFinish, onCancel, onClosed,
    onFocus=null }) {
    const draft=controller.getDraft(scene);
    const markerMode=draft?.mode==="checkpoint"||draft?.mode==="checkpoint-relocate";
    const roadName=draft?.mode==="new"?controller.getNewRoadOptions?.(scene)?.name:
      draft?.mode==="points"?draft.roadName:null;
    const title=markerMode?"Atlas — Map Marker Editor":roadName?
      atlasSettingsTitle("Road",roadName).replace(/ Settings$/," Editor"):
      "Atlas — Road Editor";
    super({window:{title},position:{
      width: Math.min(360, Math.max(240, window.innerWidth - 48)),
      height: "auto", left: 24, top: 90
    } });
    this.scene = scene;
    this.controller = controller;
    this.sceneSheet = sceneSheet;
    this.onFinish = onFinish;
    this.onCancel = onCancel;
    this.onClosed = onClosed;
    this.onFocus = onFocus;
    this.finished = false;
    this.busy = false;
    this._dockDrag = null;
    this._dragMove = event => {
      const drag=this._dockDrag;
      if(!drag||(drag.pointerId!==undefined&&drag.pointerId!==event.pointerId)||
          !Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
      this._moveDock(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);
      event.preventDefault?.();event.stopPropagation?.();
    };
    this._endDrag = () => {
      this._dockDrag=null;
      document.removeEventListener?.("pointermove",this._dragMove,true);
      document.removeEventListener?.("pointerup",this._endDrag,true);
      document.removeEventListener?.("pointercancel",this._endDrag,true);
    };
  }

  /** Move only the local painter-style UI, never Scene geometry or draft points. */
  _moveDock(left,top) {
    const width=globalThis.window?.innerWidth??1280;
    const height=globalThis.window?.innerHeight??900;
    const rect=this.element?.getBoundingClientRect?.();
    const dockWidth=rect?.width??this.position?.width??360;
    const dockHeight=rect?.height??300;
    this.setPosition({
      left:Math.round(Math.max(8,Math.min(left,Math.max(8,width-dockWidth-8)))),
      top:Math.round(Math.max(8,Math.min(top,Math.max(8,height-dockHeight-8))))
    });
  }

  async _renderHTML() {
    if (!game.user?.isGM || !this.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may use the Atlas road editor.");
    }
    const draft = this.controller.getDraft(this.scene);
    if (!draft) throw new Error("The road-editing session ended.");
    if(draft.mode==="points"&&typeof draft.roadName==="string"&&this.window?.title)
      this.window.title.textContent=atlasSettingsTitle("Road",draft.roadName)
        .replace(/ Settings$/," Editor");
    const markerMode=draft.mode==="checkpoint"||draft.mode==="checkpoint-relocate";
    const editorTitle=draft.mode==="points"?"Atlas · Edit Road":
      draft.mode==="new"?"Atlas · Draw Road":
      draft.mode==="checkpoint"?"Atlas · Place Map Marker":
      draft.mode==="checkpoint-relocate"?"Atlas · Move Map Marker":
      "Atlas · Connect Roads";
    if(this.window?.title&&markerMode)
      this.window.title.textContent="Atlas — Map Marker Editor";
    const root = element("section");
    root.className="atlas-road-editor-dock";
    root.setAttribute?.("role","region");
    root.setAttribute?.("aria-label",markerMode?
      "Atlas Map Marker canvas editor":"Atlas Road canvas editor");
    const head=element("h3",editorTitle);
    head.className="atlas-road-editor-heading";
    head.tabIndex=0;
    head.setAttribute?.("aria-label",editorTitle+
      ". Drag or use arrow keys to move this editor.");
    head.addEventListener("pointerdown",event=>{
      if(this.busy||event.button!==0||
          !Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
      this._endDrag();
      this._dockDrag={x:event.clientX,y:event.clientY,
        left:this.position?.left??24,top:this.position?.top??90,
        pointerId:event.pointerId};
      document.addEventListener?.("pointermove",this._dragMove,true);
      document.addEventListener?.("pointerup",this._endDrag,true);
      document.addEventListener?.("pointercancel",this._endDrag,true);
      event.preventDefault?.();event.stopPropagation?.();
    });
    head.addEventListener("keydown",event=>{
      const step=event.shiftKey?20:10;
      const delta={ArrowLeft:[-step,0],ArrowRight:[step,0],
        ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
      if(!delta||this.busy)return;
      event.preventDefault?.();event.stopPropagation?.();
      this._moveDock((this.position?.left??24)+delta[0],
        (this.position?.top??90)+delta[1]);
    });
    root.appendChild(head);
    const progress=element("small", draft.mode === "points"
      ? `${draft.points} points · ${draft.dirty ? "Unsaved" : "No changes"}`
      : draft.mode === "checkpoint" ? "Click the map to place a Map Marker."
      : draft.mode === "checkpoint-relocate" ? "Choose a new location and confirm."
      : draft.mode === "junction" ? "Click a Road to connect."
      : `${draft.points} points · Click the map to draw.`);
    progress.setAttribute?.("role","status");
    progress.setAttribute?.("aria-live","polite");
    progress.className="atlas-road-editor-status";
    root.appendChild(progress);
    if(draft.mode==="points"&&draft.roadName)
      root.appendChild(element("p","Road: "+draft.roadName));

    const guidance = element("p");
    guidance.style.cssText="font-size:.9em;line-height:1.35;opacity:.8;margin:.1rem 0 .5rem;";
    guidance.textContent = draft.mode==="junction"
      ? "Choose two Roads to connect. Review the proposed junction before saving."
      : draft.mode==="checkpoint-relocate"
      ? "Click the new map location, then confirm Save New Position. Cancel leaves the Map Marker unchanged."
      : draft.mode==="checkpoint"
      ? "Choose a map location for a Map Marker. Road attachment requires confirmation."
      : draft.mode==="points"
      ? "Drag Road points to change their shape. Changes stay in this draft until Save Points."
      : "Click the map to draw the Road. Finish Road saves; Cancel discards.";
    root.appendChild(guidance);
    const gestures=draft.mode==="points"?
      [["Drag","Move a bend or a junction"],
       ["Double-click","Add a bend to the Road line"],
       ["Shift-click","Continue from an unconnected Road end (an end not joined to another Road)"],
       ["Alt/Option-click","Remove a bend"],
       ["Ctrl/Cmd + Z","Undo this draft"],
       ["Ctrl/Cmd + Shift + Z / Y","Redo this draft"],
       ["Esc","Stop continuation or cancel editing"]]:
      draft.mode==="new"?
        [["Click","Add a Road point on the map"],["Enter","Finish and save the Road"],
         ["Ctrl/Cmd + Z / Backspace","Undo the last Road point"],
         ["Ctrl/Cmd + Shift + Z / Y","Redo the last Road point"],
         ["Esc","Cancel without saving"]]:
      draft.mode==="checkpoint"?
        [["Click Road","Request a linked Map Marker"],
         ["Click elsewhere","Request an independent Map Marker"],
         ["Esc","Cancel placement"]]:
      draft.mode==="checkpoint-relocate"?
        [["Click","Preview the new map position"],
         ["Confirm","Review and approve Save New Position before any Scene write"],
         ["Esc / Cancel","Discard the movement draft"]]:
        [["Click","Choose the first Road, then the second Road"],
         ["Confirm","Review the connection before approving"],
         ["Esc","Cancel without saving"]];
    const shortcuts=element("aside");
    shortcuts.className="atlas-road-editor-shortcuts";
    shortcuts.setAttribute?.("aria-label","Canvas editor shortcuts");
    shortcuts.appendChild(element("strong","Shortcuts"));
    const gestureList=element("div");
    gestureList.className="atlas-road-editor-gestures";
    for(const [key,description] of [...gestures,
      ["Scroll","Zoom map (Foundry default)"],
      ["Arrow keys on title","Move editor without editing the map"]]){
      const item=element("div");
      item.append(element("kbd",key),element("span",description));
      gestureList.appendChild(item);
    }
    shortcuts.appendChild(gestureList);
    root.appendChild(shortcuts);
    if (draft.mode === "new") {
      const options = this.controller.getNewRoadOptions(this.scene);
      if(this.window?.title)
        this.window.title.textContent=atlasSettingsTitle("Road",options.name)
          .replace(/ Settings$/," Editor");
      const summary = element("div");
      summary.className="atlas-road-editor-summary";
      summary.appendChild(element("strong", options.name));
      summary.appendChild(element("p", "Road settings were configured before drawing. Add two or more points, then finish to save."));
      root.appendChild(summary);
    }

    const buttons = element("div");
    buttons.className="atlas-road-editor-footer";
    const makeButton = (title, callback, icon=null) => {
      const button=icon?createSettingsIconButton({icon,label:title}):element("button",title);
      button.type = "button";
      button.addEventListener("click", () => void callback());
      buttons.appendChild(button);
      return button;
    };
    const needsSave = draft.mode === "new" || draft.mode === "points";
    if((needsSave||draft.mode==="checkpoint-relocate")&&
        typeof this.onFocus==="function"){
      // The same pan/highlight action as Scene Atlas > Locate road, but applied
      // to the current unsaved geometry. Native title-bar minimization remains
      // available separately for GMs who want more canvas space.
      const locate=makeButton(draft.mode==="checkpoint-relocate"?
        "Locate Map Marker":"Locate Road",async()=>{
        try { await this.onFocus(); }
        catch(error){ui.notifications.error(error.message||String(error));}
      },"location-dot");
      locate.title=draft.mode==="checkpoint-relocate"?
        "Pan to the original Map Marker position.":
        "Zoom to and highlight the Road currently being edited.";
      if(draft.mode==="new"&&!draft.points){
        locate.disabled=true;
        locate.title="Draw the first road point before locating it.";
      }
    }
    if(draft.canUndo || (draft.mode==="new"&&draft.points>0))
      makeButton("Undo",()=>{this.controller.undo();void this.render(true);},"rotate-left");
    if(draft.canRedo)
      makeButton("Redo",()=>{this.controller.redo();void this.render(true);},"rotate-right");
    makeButton("Cancel", async () => {
      if (this.busy) return;
      this.onCancel();
      this.finished = true;
      await this.close();
    });
    const save = needsSave ? makeButton(draft.mode === "new" ? "Finish Road" : "Save Points", async () => {
      if (this.busy) return;
      this.busy = true;
      save.disabled = true;
      try {
        const successful = await this.onFinish();
        if (successful && !this.controller.getDraft(this.scene)) {
          this.finished = true;
          await this.close();
        }
      } catch (error) { ui.notifications.error(error.message || String(error)); }
      finally { this.busy = false; save.disabled = false; }
    }) : null;
    const body=element("div");
    body.className="atlas-road-editor-body";
    body.append(...root.children);
    root.replaceChildren(body,buttons);
    return root;
  }

  _replaceHTML(result, content) {
    this._endDrag();
    content.replaceChildren(result);
  }

  _onClose(options) {
    this._endDrag();
    super._onClose?.(options);
    if (!this.finished && this.controller.getDraft(this.scene)) this.onCancel();
    this.onClosed?.();
  }
}
