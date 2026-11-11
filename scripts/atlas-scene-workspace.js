/**
 * Scene-scoped, GM-only Atlas workspace. This is a presentation shell, not a
 * second Scene/Region persistence layer. It reuses the native territory tools.
 */
import { readAtlas } from "./atlas-storage.js";
import { listSceneRegions } from "./region-atlas.js";
import { listGeneratedRegions } from "./generated-region.js";
import { listPublicTerritorySettings } from "./region-narration.js";
import { createAtlasRoadsPanel, createAtlasTerritoryPanel, createAtlasTopologyPanel }
  from "./scene-config.js";
import {TerritoryLocateHighlight} from "./territory-locate-highlight.js";

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
    window: { title: "Atlas — Scene Workspace", resizable: true },
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
    this.territoryLocator=new TerritoryLocateHighlight();
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
    for (const [id, title] of [["overview", "Overview"], ["roads", "Roads"],
      ["territories", "Territories"], ["topology", "Topology & Levels"]]) {
      const tab = action(title, `Show ${title}`, () => {
        if (this.activeSection !== id) {
          this.activeSection = id;
          this._scrollY = 0;
          return this.render(true);
        }
      });
      tab.className = "atlas-workspace-tab";
      tab.setAttribute("aria-current", this.activeSection === id ? "page" : "false");
      tab.setAttribute("data-atlas-workspace-tab", id);
      sidebar.appendChild(tab);
    }
    sidebar.appendChild(make("p", "Coming in later phases", "hint"));
    sidebar.appendChild(make("p", "Checkpoints · Surfaces · Exploration · Navigation", "hint"));
    const main = make("main", undefined, "atlas-workspace-content");
    main.setAttribute("data-atlas-workspace-scroll", "");
    const heading = make("header", undefined, "atlas-workspace-heading");
    const title = make("div");
    title.appendChild(make("h2", this.activeSection === "territories" ? "Territories" :
      this.activeSection === "roads" ? "Roads" :
        this.activeSection === "topology" ? "Topology & Levels" : "Scene Overview"));
    title.appendChild(make("p", `Scene: ${this.scene.name ?? this.scene.id}`, "hint"));
    heading.appendChild(title);
    heading.appendChild(action("Refresh", "Read current Scene and native Region records", () => this.render(true)));
    main.appendChild(heading);

    if (this.activeSection === "topology") {
      main.appendChild(make("p", "Native Foundry Levels describe elevation ranges, " +
        "not political or geographic territories. Preview and approve proposed " +
        "native changes; this view does not assign roads to Levels.", "hint"));
      const topology = make("section", undefined, "atlas-workspace-topology");
      topology.appendChild(createAtlasTopologyPanel(this.scene, () => this.render(true)));
      main.appendChild(topology);
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
      const summary = make("div", undefined, "atlas-workspace-summary");
      for (const [label, value] of [
        ["Roads", atlas.roads?.length ?? 0],
        ["Checkpoints", atlas.checkpoints?.length ?? 0],
        ["Territory / custom Regions", nativeRegions.filter(region => !generatedIds.has(region.id)).length],
        ["Road-generated Regions", generated.length],
        ["Published territory names", labels.filter(entry => entry.label && !entry.invalid).length]
      ]) {
        const card = make("section", undefined, "atlas-workspace-stat");
        card.appendChild(make("strong", String(value)));
        card.appendChild(make("span", label));
        summary.appendChild(card);
      }
      main.appendChild(summary);
      const next = make("section", undefined, "atlas-workspace-note");
      next.appendChild(make("h3", "A gradual migration"));
      next.appendChild(make("p", "Roads, Territories and native Topology/Levels are " +
        "available in this Workspace. Standalone checkpoint, surface and " +
        "exploration settings remain in Scene " +
        "Configuration → Atlas until their dedicated views pass live testing."));
      next.appendChild(action("Manage Territories", "Open territory management", () => {
        this.activeSection = "territories";
        this._scrollY = 0;
        return this.render(true);
      }));
      main.appendChild(next);
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
  return Promise.resolve(workspace.minimized?workspace.maximize():undefined)
    .then(()=>workspace.render(true)).catch(error => {
    if (workspaces.get(scene.id) === workspace && !workspace.rendered) {
      workspaces.delete(scene.id);
    }
    throw error;
  });
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
