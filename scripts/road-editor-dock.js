import { readWorldTravelPresets } from "./travel-preset-settings.js";
import { createSettingsIconButton } from "./settings-controls.js";
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
    window: { title: "Atlas — Road Editor", resizable: true, minimizable: true },
    position: { width: 340, height: 270, left: 80, top: 115 }
  };

  constructor({ scene, controller, sceneSheet, onFinish, onCancel, onClosed,
    onFocus=null }) {
    const isNewRoad=controller.getDraft(scene)?.mode==="new";
    super({ position: {
      width: Math.min(340, Math.max(260, window.innerWidth - 60)),
      height: Math.min(isNewRoad?500:270, Math.max(230, window.innerHeight - 100)),
      left: 80, top: 115
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
  }

  async _renderHTML() {
    if (!game.user?.isGM || !this.scene?.canUserModify?.(game.user, "update")) {
      throw new Error("Only a GM may use the Atlas road editor.");
    }
    const draft = this.controller.getDraft(this.scene);
    if (!draft) throw new Error("The road-editing session ended.");
    const root = element("div");
    root.className="atlas-road-editor-dock";
    const status = draft.mode === "points" ? "Edit points" :
      draft.mode === "new" ? "Draw road" :
      draft.mode === "checkpoint" ? "Place Map Marker" : "Add connection";
    root.appendChild(element("strong", status));
    root.appendChild(element("small", draft.mode === "points"
      ? `${draft.points} points · ${draft.dirty ? "Unsaved" : "No changes"}`
      : draft.mode === "checkpoint" ? "Click a road on the map."
      : draft.mode === "junction" ? "Click a road to connect."
      : `${draft.points} points · Click the map to draw.`));

    const guidance = element("p");
    guidance.style.cssText="font-size:.9em;line-height:1.35;opacity:.8;margin:.1rem 0 .5rem;";
    guidance.textContent = draft.mode==="junction"
      ? "Choose two roads to connect. Review the proposed junction before saving."
      : draft.mode==="checkpoint"
      ? "Choose a map location for a Map Marker. Road attachment requires confirmation."
      : draft.mode==="points"
      ? "Drag Road points to change their shape. Changes stay in this draft until Save Points."
      : "Click the map to draw the Road. Finish Road saves; Cancel discards.";
    root.appendChild(guidance);
    const gestures=draft.mode==="points"?
      ["Drag — move a bend or junction",
        "Double-click a road — add a bend",
        "Shift-click a free Road end — continue from that end",
        "Alt-click a bend — remove that bend",
        "Ctrl/Cmd+Z — Undo; Ctrl/Cmd+Shift+Z — Redo",
        "Escape — stop continuation or cancel editing"]:
      draft.mode==="new"?
        ["Click map — add a Road point","Enter — finish Road",
          "Ctrl/Cmd+Z / Backspace — Undo","Ctrl/Cmd+Shift+Z — Redo",
          "Escape — cancel without saving"]:
        draft.mode==="checkpoint"?
          ["Click a Road — request a linked Map Marker",
           "Click elsewhere — request an independent Map Marker",
           "Escape — cancel placement"]:
        ["Click the first Road, then a second Road to connect",
         "Review the connection before approving", "Escape — cancel"];
    const gestureList=element("ul");
    gestureList.className="atlas-road-editor-gestures";
    for(const label of gestures)gestureList.appendChild(element("li",label));
    root.appendChild(gestureList);
    const row = (title, input) => {
      const wrapper = element("label");
      wrapper.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:0.5rem;";
      wrapper.append(element("span", title), input);
      input.style.maxWidth = "12.5rem";
      root.appendChild(wrapper);
      return input;
    };
    if (draft.mode === "new") {
      const options = this.controller.getNewRoadOptions(this.scene);
      const summary = element("div");
      summary.style.cssText = "padding:.5rem;border:1px solid var(--color-border-light-tertiary,#655);border-radius:5px;";
      summary.appendChild(element("strong", options.name));
      summary.appendChild(element("p", "Road settings were configured before drawing. Add two or more points, then finish to save."));
      root.appendChild(summary);
    }

    const buttons = element("div");
    buttons.style.cssText = "display:flex;gap:0.35rem;justify-content:flex-end;flex-wrap:wrap;";
    const makeButton = (title, callback, icon=null) => {
      const button=icon?createSettingsIconButton({icon,label:title}):element("button",title);
      button.type = "button";
      button.addEventListener("click", () => void callback());
      buttons.appendChild(button);
      return button;
    };
    const needsSave = draft.mode === "new" || draft.mode === "points";
    if(needsSave && typeof this.onFocus==="function"){
      // The same pan/highlight action as Scene Atlas > Locate road, but applied
      // to the current unsaved geometry. Native title-bar minimization remains
      // available separately for GMs who want more canvas space.
      const locate=makeButton("Locate Road",async()=>{
        try { await this.onFocus(); }
        catch(error){ui.notifications.error(error.message||String(error));}
      },"location-dot");
      locate.title="Zoom to and highlight the Road currently being edited.";
      if(draft.mode==="new"&&!draft.points){
        locate.disabled=true;
        locate.title="Draw the first road point before locating it.";
      }
    }
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
    },"floppy-disk") : null;
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
    const body=element("div");
    body.className="atlas-road-editor-body";
    body.append(...root.children);
    buttons.className="atlas-road-editor-footer";
    root.replaceChildren(body,buttons);
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  _onClose(options) {
    super._onClose?.(options);
    if (!this.finished && this.controller.getDraft(this.scene)) this.onCancel();
    this.onClosed?.();
  }
}
