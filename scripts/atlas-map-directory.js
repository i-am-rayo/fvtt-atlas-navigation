import { readTerritoryRoadDirectory } from "./territory-road-directory.js";
import { inspectCheckpointTerritoryMembership } from "./territory-checkpoint-membership.js";
import { territoryCheckpointLinks } from "./territory-checkpoint-link.js";
import { readPendingTerritoryCellTransfer } from "./territory-grid-transfer.js";
import { GEOGRAPHY_KINDS } from "./territory-geography-model.js";
import { CHECKPOINT_TYPES, CHECKPOINT_TYPE_FLAG, validateCheckpointCategories } from "./checkpoint-types.js";
import { MODULE_ID } from "./atlas-storage.js";
import { roadAppearanceMode } from "./road-appearance.js";
import { readWorldTravelPresets } from "./travel-preset-settings.js";
import { createSettingsActionButton } from "./settings-controls.js";
import { openAtlasTerritorySettings } from "./atlas-territory-settings.js";
import { readPartyExploration } from "./party-exploration-storage.js";

function element(tag, text) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
}

export function createMapDirectory({scene, atlas, actions, refresh, locate, state, view}) {
  const directory = readTerritoryRoadDirectory(scene, atlas);
  const membership = inspectCheckpointTerritoryMembership(scene);
  const territoryIds = new Map();
  function associate(checkpoint, territory) {
    if (!territoryIds.has(checkpoint)) territoryIds.set(checkpoint, new Set());
    territoryIds.get(checkpoint).add(territory);
  }
  for (const match of membership.items) associate(match.checkpointId, match.regionId);
  for (const {regionId, link} of territoryCheckpointLinks(scene)) {
    if (link) associate(link.checkpointId, regionId);
  }
  const presets = readWorldTravelPresets().presets;
  const categories = validateCheckpointCategories(scene.getFlag(MODULE_ID, CHECKPOINT_TYPE_FLAG));
  const categoryNames = new Map(CHECKPOINT_TYPES);
  const party = readPartyExploration(scene);
  const known = new Set([...party.discoveredCheckpointIds,...party.loreKnownCheckpointIds]);
  const pending = readPendingTerritoryCellTransfer(scene);
  const batch = actions.territoryBatchState?.(scene);
  const root = element("section");
  const filters = element("div");
  filters.className = "atlas-directory-filters";
  const list = element("div");
  const saved = state.filters[view] ??= {query:"", type:"", place:""};
  const places = new Map();
  function indexPlace(place) {
    places.set(place.id, place.name);
    place.children.forEach(indexPlace);
  }
  directory.tree.forEach(indexPlace);
  function input(label, control, key, event) {
    const field = element("label", label);
    field.appendChild(control);
    filters.appendChild(field);
    control.value = saved[key];
    control.addEventListener(event, () => {
      saved[key] = control.value;
      draw();
    });
  }
  function select(label, key, options) {
    const control = element("select");
    for (const [id, name] of [["","All"], ...options]) {
      const option = element("option", name);
      option.value = id;
      control.appendChild(option);
    }
    input(label, control, key, "change");
  }
  const search = element("input");
  search.type = "search";
  input("Search map", search, "query", "input");
  if (view === "directory") select("Territory type", "type", Object.entries(GEOGRAPHY_KINDS));
  if (view === "allRoads") select("Travel type", "type", [["land","Land"],["air","Air"],["water","Water"]]);
  if (view === "allCheckpoints") {
    select("Checkpoint type", "type", CHECKPOINT_TYPES);
    select("Territory", "place", places);
  }
  function group(key, label, expanded) {
    const details = element("details");
    details.open = expanded || state.open.has(key);
    details.appendChild(element("summary", label));
    details.addEventListener("toggle", () => {
      if (!details.isConnected || expanded) return;
      if (details.open) state.open.add(key);
      else state.open.delete(key);
    });
    return details;
  }
  function tools(parent, item, type) {
    const bar = element("div");
    bar.className = "atlas-directory-actions";
    function add(icon, title, callback, danger = false) {
      return bar.appendChild(createSettingsActionButton({icon, label:title + " " + item.name, danger,
        onClick:async event => {
          event.preventDefault();
          try { await callback(); } catch (error) { ui.notifications.error(error.message); }
        }}));
    }
    if (type === "territory") {
      add("location-dot","Locate",()=>locate(item.id));
      add("gear","Settings for",()=>openAtlasTerritorySettings(scene,item.id,actions,refresh,locate));
      const edit = add("draw-polygon","Edit boundary of",()=>actions.editTerritoryBoundary(scene,item.id,refresh));
      edit.disabled = Boolean(actions.draft(scene) || pending || (batch?.total && !batch.targets.some(t=>t.id===item.id)));
    } else if (type === "road") {
      add("location-dot","Locate",()=>actions.select(scene,item.id));
      add(item.playerVisible?"eye-slash":"eye",item.playerVisible?"Hide":"Show",()=>actions.toggleRoadPlayerVisibility(scene,item,refresh));
      add("gear","Settings for",()=>actions.editRoadAppearance(scene,item,refresh));
      add("pen","Edit path of",()=>actions.beginPointEdit(scene,item.id,refresh));
      add("trash","Delete",()=>actions.remove(scene,item,refresh),true);
    } else {
      add("location-dot","Locate",()=>actions.selectCheckpoint(scene,item.id));
      if (party.enabled) {
        const shown = known.has(item.id);
        add(shown?"eye-slash":"eye",shown?"Hide from party":"Reveal through lore:",()=>actions.setCheckpointKnowledge(scene,
          {checkpointId:item.id,knowledge:shown?"unknown":"lore",expected:party},refresh));
      } else add(item.playerVisible?"eye-slash":"eye",item.playerVisible?"Hide":"Show",()=>actions.toggleCheckpointPlayerVisibility(scene,item,refresh));
      add("gear","Settings for",()=>actions.editCheckpointAppearance(scene,item,refresh));
      add("pen","Edit",()=>actions.editCheckpoint(scene,item,refresh));
      add("trash","Delete",()=>actions.removeCheckpoint(scene,item,refresh),true);
    }
    parent.appendChild(bar);
  }
  const roads = atlas.roads ?? [];
  const checkpoints = atlas.checkpoints ?? [];
  function draw() {
    const query = saved.query.trim().toLocaleLowerCase();
    const matches = item => !query || item.name.toLocaleLowerCase().includes(query);
    const filtered = Boolean(query || saved.type || saved.place);
    function itemRow(item, type, path) {
      const subtitle = type === "road" ? roadAppearanceMode(item,presets) : categoryNames.get(categories[item.id] ?? "generic");
      const row = group(path+"/"+type+"/"+item.id,item.name+" · "+subtitle+" · "+((type==="checkpoint" && party.enabled ? known.has(item.id) : item.playerVisible)?"Shown":"Hidden"),false);
      tools(row,item,type);
      return row;
    }
    function placeRow(place, path) {
      const key = path+"/"+place.id;
      const own = matches(place) && (!saved.type || place.kind === saved.type);
      const descendants = place.children.map(child=>placeRow(child,key)).filter(Boolean);
      const children = [];
      for (const [type, entries] of [["road",roads.filter(r=>directory.direct.get(place.id)?.has(r.id))],
        ["checkpoint",checkpoints.filter(c=>territoryIds.get(c.id)?.has(place.id))]]) {
        const found = entries.filter(item=>own || (!saved.type && matches(item)));
        if (!found.length) continue;
        const section = group(key+"/"+type,(type==="road"?"Roads":"Checkpoints")+" ("+found.length+")",Boolean(query));
        for (const item of found) section.appendChild(itemRow(item,type,key));
        children.push(section);
      }
      if (!own && !descendants.length && !children.length) return null;
      const row = group(key,place.name+" · "+GEOGRAPHY_KINDS[place.kind],filtered);
      tools(row,place,"territory");
      row.append(...descendants,...children);
      return row;
    }
    let rows;
    if (view === "directory") {
      rows = directory.tree.map(place=>placeRow(place,"territory")).filter(Boolean);
      const outside = group("unclassified","Outside classified territories",filtered);
      const looseRoads = new Set(directory.unclassifiedRoadIds);
      for (const [type,entries] of [["road",roads.filter(r=>looseRoads.has(r.id))],
        ["checkpoint",checkpoints.filter(c=>![...(territoryIds.get(c.id)??[])].some(id=>places.has(id)))]]) {
        for (const item of entries.filter(matches)) outside.appendChild(itemRow(item,type,"outside"));
      }
      if (!saved.type && outside.children.length>1) rows.push(outside);
    } else if (view === "allRoads") {
      rows = roads.filter(item=>matches(item) && (!saved.type || roadAppearanceMode(item,presets)===saved.type))
        .map(item=>itemRow(item,"road","all"));
    } else {
      rows = checkpoints.filter(item=>matches(item) && (!saved.type || (categories[item.id]??"generic")===saved.type)
        && (!saved.place || territoryIds.get(item.id)?.has(saved.place))).map(item=>itemRow(item,"checkpoint","all"));
    }
    if (!rows.length) rows.push(element("p","No matching entries."));
    list.replaceChildren(...rows);
  }
  root.className = "atlas-map-directory";
  root.append(filters,list);
  draw();
  return root;
}
