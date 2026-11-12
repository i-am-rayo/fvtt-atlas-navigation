/**
 * Scene-scoped, GM-only Atlas workspace. This is a presentation shell, not a
 * second Scene/Region persistence layer. It reuses the native territory tools.
 */
import { readAtlas } from "./atlas-storage.js";
import { listSceneRegions } from "./region-atlas.js";
import { listGeneratedRegions } from "./generated-region.js";
import { listPublicTerritorySettings } from "./region-narration.js";
import { createAtlasRoadsPanel, createAtlasTerritoryPanel, createAtlasTopologyPanel,
  createAtlasCheckpointPanel,createAtlasExplorationPanel,createAtlasSurfacesPanel }
  from "./scene-config.js";
import {TerritoryLocateHighlight} from "./territory-locate-highlight.js";
import {createAtlasWorkspaceNavigationPanel} from "./atlas-workspace-navigation.js";
import {createAtlasWorkspacePortabilityPanel} from "./atlas-workspace-portability.js";

import {createMapDirectory} from "./atlas-map-directory.js";
import {readPartyExploration} from "./party-exploration-storage.js";

const directoryViews = [["directory","By territory"],["allRoads","All roads"],["allCheckpoints","All checkpoints"]];
const managers = [["territories","Territories"],["roads","Roads"],["checkpoints","Checkpoints"]];
const settingsViews = [["settings","Exploration & travel"],["surfaces","Surfaces"],["topology","Topology & Levels"],["portability","Import / Export"]];
const workspaces = new Map();

function assertEditable(scene) {
  if (!globalThis.game?.user?.isGM || !scene?.id ||
      !scene.canUserModify?.(game.user, "update")) {
    throw new Error("Only a GM with permission to edit this Scene can open Atlas Workspace.");
  }
}

const make = (tag, value, className) => {
  const element = document.createElement(tag);
  if (value !== undefined) element.textContent = value;
  if (className) element.className = className;
  return element;
};

function action(text, title, callback) {
  const control = make("button", text);
  control.type = "button";
  control.title = title;
  control.setAttribute("aria-label", title);
  control.addEventListener("click", async event => {
    event.preventDefault();
    try { await callback(); }
    catch (error) { ui.notifications.error(error.message ?? String(error)); }
  });
  return control;
}

export class AtlasSceneWorkspace extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    window: { title: "Atlas — Scene Workspace", resizable: true, minimizable: true },
    position: { width: 1040, height: 720, left: 24 }
  };

  constructor({ scene, actions }) {
    assertEditable(scene);
    super({ id: `atlas-scene-workspace-${scene.id}`, position: {
      left: 24,
      width: Math.max(450, Math.min(1040, globalThis.window?.innerWidth - 50 || 1040)),
      height: Math.max(360, Math.min(720, globalThis.window?.innerHeight - 90 || 720))
    } });
    this.scene = scene;
    this.actions = actions;
    this.activeSection = "overview";
    this._scrollY = 0;
    this.directoryState = {open:new Set(), filters:{}};
    this.territoryLocator=new TerritoryLocateHighlight();
  }

  _showSection(id) {
    if (this.activeSection === id) return;
    this.activeSection = id;
    this._scrollY = 0;
    return this.render(true);
  }

  async _locateTerritory(regionId) {
    assertEditable(this.scene);
    const region = this.scene.regions?.get?.(regionId);
    const view = globalThis.canvas;
    if (!region || region.parent?.id !== this.scene.id || !view?.ready ||
        view.scene?.id !== this.scene.id || typeof view.animatePan !== "function")
      throw Error("Open this Region's Scene on the canvas to locate it.");
    await this.territoryLocator.focus(this.scene,region,{view});
    if(this.rendered&&!this.minimized&&typeof this.minimize==="function")
      await this.minimize();
  }

  async _renderHTML() {
    assertEditable(this.scene);
    this._scrollY = this.element?.querySelector?.("[data-atlas-workspace-scroll]")?.scrollTop ?? this._scrollY;
    const atlas = readAtlas(this.scene);
    const nativeRegions = listSceneRegions(this.scene);
    const generated = listGeneratedRegions(this.scene);
    const labels = listPublicTerritorySettings(this.scene);
    const generatedIds = new Set(generated.map(region => region.id));

    const root = make("div", undefined, "atlas-scene-workspace");
    root.setAttribute("data-atlas-workspace-scene", this.scene.id);
    const sidebar = make("nav", undefined, "atlas-workspace-nav");
    sidebar.setAttribute("aria-label", "Atlas workspace sections");
    sidebar.appendChild(make("h3", "Atlas"));
    const directoryActive = [...directoryViews,...managers].some(([id])=>id===this.activeSection);
    const section = directoryActive ? "directory" : this.activeSection==="overview" ? "overview" : "settings";
    for (const [id,title] of [["overview","Overview"],["directory","Map directory"],["settings","Settings & transfer"]]) {
      const tab = action(title, `Show ${title}`, () => {
        return this._showSection(id);
      });
      tab.className = "atlas-workspace-tab";
      tab.setAttribute("aria-current", section === id ? "page" : "false");
      tab.setAttribute("data-atlas-workspace-tab", id);
      sidebar.appendChild(tab);
    }
    const main = make("main", undefined, "atlas-workspace-content");
    main.setAttribute("data-atlas-workspace-scroll", "");
    const heading = make("header", undefined, "atlas-workspace-heading");
    const title = make("div");
    title.appendChild(make("h2",section==="directory"?"Map directory":section==="settings"?"Settings & transfer":"Scene Overview"));
    title.appendChild(make("p", `Scene: ${this.scene.name ?? this.scene.id}`, "hint"));
    heading.appendChild(title);
    heading.appendChild(action("Refresh", "Read current Scene and native Region records", () => this.render(true)));
    main.appendChild(heading);

    const refresh = () => this.minimized ? Promise.resolve() : this.render(true);
    const addControls = container => {
      for (const [label,handler] of [["Add territory","createNativeTerritory"],["Add road","begin"],["Add checkpoint","beginCheckpoint"]]) {
        const button = action(label,label,()=>this.actions[handler](this.scene,refresh));
        button.disabled = Boolean(this.actions.draft(this.scene)) || (handler==="begin" && atlas.schemaVersion<=2 && Boolean(atlas.segments.length || atlas.nodes.length));
        container.appendChild(button);
      }
    };
    const links = (container, entries) => {
      for (const [id,label] of entries) {
        const control = action(label,label,()=>this._showSection(id));
        control.setAttribute("aria-current",this.activeSection===id?"page":"false");
        container.appendChild(control);
      }
    };
    if (directoryActive) {
      const toolbar = make("div",undefined,"atlas-directory-filters");
      addControls(toolbar);
      main.appendChild(toolbar);
      const views = make("nav",undefined,"atlas-directory-filters");
      views.setAttribute("aria-label","Directory views");
      links(views,directoryViews);
      main.appendChild(views);
      const advanced = make("details");
      advanced.open = managers.some(([id])=>id===this.activeSection);
      advanced.appendChild(make("summary","Manage map records"));
      links(advanced,managers);
      main.appendChild(advanced);
    } else if (section==="settings") {
      const views = make("nav",undefined,"atlas-directory-filters");
      views.setAttribute("aria-label","Atlas settings");
      links(views,settingsViews);
      main.appendChild(views);
    }

    if (directoryViews.some(([id])=>id===this.activeSection)) {
      main.appendChild(createMapDirectory({scene:this.scene, atlas, actions:this.actions, refresh,
        locate:id=>this._locateTerritory(id), state:this.directoryState, view:this.activeSection}));
    } else if (this.activeSection==="settings") {
      main.appendChild(createAtlasExplorationPanel(this.scene,this.actions,refresh));
      main.appendChild(action("World travel settings","World travel settings",()=>this.actions.openWorldTravelSettings()));
    } else if(this.activeSection==="portability"){
      main.appendChild(createAtlasWorkspacePortabilityPanel(this.scene));
    } else if(this.activeSection==="surfaces"){
      main.appendChild(make("p","Generate or manage native Road corridor and " +
        "Checkpoint Regions. Atlas previews and confirms every native Region " +
        "change; existing native Shapes and Behaviors remain Foundry-owned.","hint"));
      main.appendChild(createAtlasSurfacesPanel(this.scene,this.actions,
        ()=>this.render(true)));
    } else if (this.activeSection === "topology") {
      main.appendChild(make("p", "Native Foundry Levels describe elevation ranges, " +
        "not political or geographic territories. Preview and approve proposed " +
        "native changes; this view does not assign roads to Levels.", "hint"));
      const topology = make("section", undefined, "atlas-workspace-topology");
      topology.appendChild(createAtlasTopologyPanel(this.scene, () => this.render(true)));
      main.appendChild(topology);
    } else if (this.activeSection === "checkpoints") {
      main.appendChild(createAtlasCheckpointPanel(this.scene, this.actions,
        () => this.minimized ? Promise.resolve() : this.render(true)));
    } else if (this.activeSection === "roads") {
      main.appendChild(make("p", "Manage authored roads, their graph connections, " +
        "per-road checkpoints and generated corridor Regions. Existing editors, " +
        "revision guards and map tools remain authoritative.", "hint"));
      const roadContent = make("section", undefined, "atlas-workspace-roads");
      roadContent.appendChild(createAtlasRoadsPanel(this.scene, this.actions,
        () => this.render(true)));
      main.appendChild(roadContent);
    } else if (this.activeSection === "territories") {
      main.appendChild(make("p", "Edit territory associations, public Journey labels, " +
        "preview smoother boundaries and analyze competing geographic borders. " +
        "Use the Atlas Layers toolbar button for persistent GM map visibility, " +
        "names and fill. Native Foundry Region shapes and Behaviors stay authoritative.", "hint"));
      main.appendChild(createAtlasTerritoryPanel(this.scene, this.actions,
        () => this.render(true), { generated, nativeRegions,
          publicById: new Map(labels.map(item => [item.id, item])),
          onLocate:id=>this._locateTerritory(id) }));
    } else {
      const tasks = make("section", undefined, "atlas-workspace-note");
      tasks.appendChild(make("h3","Map actions"));
      tasks.appendChild(action("Browse map","Browse map",()=>this._showSection("directory")));
      tasks.appendChild(createAtlasWorkspaceNavigationPanel(this.scene,{
        onOpenNavigation:async()=>{
          // Navigation uses the existing JourneyController; this is a view
          // hand-off, never a hidden Journey approval.
          const wasMinimized=this.minimized;
          if(!wasMinimized)await this.minimize();
          try{await this.actions.openNavigation(this.scene);}
          catch(error){
            if(!wasMinimized&&this.rendered)await this.maximize();
            throw error;
          }
        }
      }));
      addControls(tasks);
      main.appendChild(tasks);
      main.appendChild(make("h3","Party discoveries"));
      const summary = make("div",undefined,"atlas-workspace-summary");
      const checkpointCount = atlas.checkpoints?.length ?? 0;
      let known = "Unavailable";
      try {
        const party = readPartyExploration(this.scene);
        const ids = new Set([...party.discoveredCheckpointIds,...party.loreKnownCheckpointIds]);
        known = String((atlas.checkpoints??[]).filter(cp=>ids.has(cp.id)).length);
      } catch (error) { main.appendChild(make("p",error.message,"hint")); }
      for (const [label,value] of [
        ["Checkpoints known to the party",known+" / "+checkpointCount],
        ["Roads on this map",atlas.roads?.length??0],
        ["Territories / custom Regions",nativeRegions.filter(region=>!generatedIds.has(region.id)).length]
      ]) {
        const card = make("section",undefined,"atlas-workspace-stat");
        card.append(make("strong",String(value)),make("span",label));
        summary.appendChild(card);
      }
      main.appendChild(summary);

    }
    root.append(sidebar, main);
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
    const scroll = content.querySelector?.("[data-atlas-workspace-scroll]");
    if (scroll) scroll.scrollTop = this._scrollY;
  }

  _onClose(options) {
    this.territoryLocator.clear();
    if (workspaces.get(this.scene.id) === this) workspaces.delete(this.scene.id);
    return super._onClose?.(options);
  }
}

/** One modeless workspace per Scene. Re-opening brings the same draft context forward. */
export function openAtlasSceneWorkspace(scene, actions) {
  assertEditable(scene);
  let workspace = workspaces.get(scene.id);
  if (!workspace) {
    workspace = new AtlasSceneWorkspace({ scene, actions });
    workspaces.set(scene.id, workspace);
  }
  return (async () => {
    try {
      if(workspace.minimized) {
        // Restoring a modeless ApplicationV2 is NOT a fresh render. A forced
        // render during maximization can re-collapse the native window.
        await workspace.maximize();
      } else {
        await workspace.render(true);
      }
      workspace.bringToFront?.();
      return workspace;
    } catch(error) {
      if(workspaces.get(scene.id)===workspace && !workspace.rendered)
        workspaces.delete(scene.id);
      throw error;
    }
  })();
}

/** Return to the existing Workspace after a canvas editor releases focus.
 * Never recreate a Workspace the GM deliberately closed. */
export async function restoreAtlasSceneWorkspace(scene){
  const workspace=workspaces.get(scene?.id);
  if(!workspace?.rendered)return;
  if(workspace.minimized)await workspace.maximize();
  await workspace.render(true);
}

export function refreshAtlasSceneWorkspace(scene) {
  const workspace = workspaces.get(scene?.id);
  if (workspace?.rendered) return workspace.render(true);
  return Promise.resolve();
}

/** Begin canvas authoring without leaving the Workspace across the map.
 * Minimize is presentation-only: no persistence, no draft reset. */
export async function minimizeAtlasSceneWorkspace(scene) {
  const workspace=workspaces.get(scene?.id);
  if(workspace?.rendered && !workspace.minimized)
    await workspace.minimize();
}
