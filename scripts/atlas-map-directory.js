import { readTerritoryRoadDirectory } from "./territory-road-directory.js";
import { inspectCheckpointTerritoryMembership } from "./territory-checkpoint-membership.js";
import { territoryCheckpointLinks } from "./territory-checkpoint-link.js";
import { readPlayerTerritorySharing } from "./player-territory-sharing.js";
import { readPendingTerritoryCellTransfer } from "./territory-grid-transfer.js";
import { GEOGRAPHY_KINDS } from "./territory-geography-model.js";
import { CHECKPOINT_TYPE_GROUPS, CHECKPOINT_TYPES, CHECKPOINT_TYPE_FLAG, validateCheckpointCategories } from "./checkpoint-types.js";
import { createSettingsGroupedSelect } from "./settings-select.js";
import { MODULE_ID } from "./atlas-storage.js";
import { roadAppearanceMode } from "./road-appearance.js";
import { readWorldTravelPresets } from "./travel-preset-settings.js";
import { createSettingsActionButton } from "./settings-controls.js";
import { openAtlasTerritorySettings } from "./atlas-territory-settings.js";
import { readPartyExploration } from "./party-exploration-storage.js";
import {confirmAtlasVisibilityChange} from "./atlas-visibility-confirmation.js";

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
  const saved = state.filters[view] ??= {query:"", type:"", place:"", sort:"az"};
  saved.sort ??= "az";
  const places = new Map();
  function indexPlace(place) {
    places.set(place.id, place.name);
    place.children.forEach(indexPlace);
  }
  directory.tree.forEach(indexPlace);
  if(saved.place&&!places.has(saved.place))saved.place="";
  function territoryChoices(){
    const roots=new Map();
    const walk=(place,ancestors=[],continent=null)=>{
      const top=place.kind==="continent"?place:continent;
      const heading=top?.name??"Other / unclassified";
      const options=roots.get(heading)??[];
      options.push([place.id,[...ancestors,place.name].join(" › ")]);
      roots.set(heading,options);
      for(const child of place.children)walk(child,[...ancestors,place.name],top);
    };
    directory.tree.forEach(place=>walk(place));
    const groups=[{label:null,options:[["","All"]]}];
    for(const [label,options] of roots){
      const counts=new Map();
      for(const [,name] of options)counts.set(name,(counts.get(name)??0)+1);
      groups.push({label,options:options.map(([id,name])=>
        [id,counts.get(name)>1?name+" · "+id.slice(0,8):name])
        .sort((a,b)=>a[1].localeCompare(b[1],undefined,{sensitivity:"base"})||
          a[0].localeCompare(b[0]))});
    }
    return groups;
  }
  function input(label, control, key, event) {
    const field = element("label");
    field.appendChild(element("span",label));
    control.setAttribute("aria-label",label);
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
  if (view === "directory") select("Territory type", "type", Object.entries(GEOGRAPHY_KINDS));
  if (view === "allRoads") select("Travel type", "type", [["land","Land"],["air","Air"],["water","Water"]]);
  if (view === "allCheckpoints") {
    const type=createSettingsGroupedSelect([
      {label:null,options:[["","All"]]},
      ...CHECKPOINT_TYPE_GROUPS.map(([label,options])=>({label,options}))
    ],{selectedId:saved.type,ariaLabel:"Map Marker type"});
    input("Map Marker type",type,"type","change");
    const territory=createSettingsGroupedSelect(territoryChoices(),{
      selectedId:saved.place,ariaLabel:"Territory"});
    input("Territory",territory,"place","change");
  }
  select("Sort by name","sort",[["az","A–Z"],["za","Z–A"]]);
  const search=element("input");
  search.type="search";
  const searchGroup=element("label");
  searchGroup.className="atlas-directory-search";
  search.setAttribute("aria-label","Search map records");
  search.value=saved.query;
  searchGroup.appendChild(search);
  const icon=element("i");
  icon.className="fa-solid fa-magnifying-glass";
  icon.setAttribute("aria-hidden","true");
  searchGroup.appendChild(icon);
  filters.appendChild(searchGroup);
  search.addEventListener("input",()=>{saved.query=search.value;draw();});

  function group(key,label,expanded,subtitle="") {
    const details=element("details");
    details.open=expanded||state.open.has(key);
    details.dataset.atlasDirectoryKey=key;
    details._atlasRoadIds=new Set();
    details._atlasMarkerIds=new Set();
    const summary=element("summary");
    const chevron=element("i");
    chevron.className="fa-solid fa-chevron-right atlas-directory-chevron";
    chevron.setAttribute("aria-hidden","true");
    summary.appendChild(chevron);
    summary.appendChild(element("span",label));
    if(subtitle) {
      const secondary=element("small",subtitle);
      secondary.className="atlas-directory-secondary";
      summary.appendChild(secondary);
    }
    details.appendChild(summary);
    details.addEventListener("toggle",()=>{
      if(!details.isConnected||expanded)return;
      if(details.open)state.open.add(key);
      else state.open.delete(key);
    });
    return details;
  }
  function collectCounts(parent,children){
    for(const child of children){
      for(const id of child._atlasRoadIds??[])parent._atlasRoadIds.add(id);
      for(const id of child._atlasMarkerIds??[])parent._atlasMarkerIds.add(id);
    }
  }
  // These launch the original creation tools; no Road/Territory association
  // is inferred from the directory group where the GM clicked Plus.
  function addShortcut(section,type){
    const handler={territory:"createNativeTerritory",road:"begin",
      checkpoint:"beginCheckpoint"}[type];
    const label={territory:"Add Territory (choose its location and type)",
      road:"Add Road (draw on the Scene)",
      checkpoint:"Add Map Marker (choose its position and Road attachment)"}[type];
    if(!handler||typeof actions[handler]!=="function")return;
    const button=createSettingsActionButton({icon:"plus",label,
      onClick:async event=>{
        event.preventDefault?.();
        event.stopPropagation?.();
        try{await actions[handler](scene,refresh);}
        catch(error){ui.notifications.error(error.message??String(error));}
      }});
    button.classList?.add?.("atlas-directory-shortcut");
    button.disabled=Boolean(actions.draft?.(scene)||pending);
    section.children[0].appendChild(button);
  }
  function tools(parent, item, type) {
    const bar = element("span");
    bar.className = "atlas-directory-actions";
    function add(icon, title, callback, danger = false) {
      const control=createSettingsActionButton({icon, label:title + " " + item.name, danger,
        onClick:async event => {
          event.preventDefault();
          event.stopPropagation?.();
          if(control.disabled)return;
          control.disabled=true;
          try { await callback(); }
          catch (error) { ui.notifications.error(error.message??String(error)); }
          finally {control.disabled=false;}
        }});
      return bar.appendChild(control);
    }
    if (type === "territory") {
      add("location-dot","Locate",()=>locate(item.id));
      const region = scene.regions?.get?.(item.id);
      let shared = false, valid = true;
      try { shared = Boolean(readPlayerTerritorySharing(region)); }
      catch { valid = false; }
      const visibility = add(shared?"eye":"eye-slash",
        shared?"Hide boundary from players; currently shared:":"Share boundary with players; currently hidden:",
        ()=>actions.configureTerritorySharing(scene,item.id,refresh));
      visibility.setAttribute("aria-pressed",String(shared));
      visibility.disabled = !valid || !region?.canUserModify?.(game.user,"update") ||
        Boolean(actions.draft(scene) || pending || (!shared && region.hidden));
      add("gear","Settings for",()=>openAtlasTerritorySettings(scene,item.id,actions,refresh,locate));
      const edit = add("draw-polygon","Edit boundary of",()=>actions.editTerritoryBoundary(scene,item.id,refresh));
      edit.disabled = Boolean(actions.draft(scene) || pending || (batch?.total && !batch.targets.some(t=>t.id===item.id)));
    } else if (type === "road") {
      add("location-dot","Locate",()=>actions.select(scene,item.id));
      const shown=item.playerVisible===true;
      const visibility=add(shown?"eye":"eye-slash",
        shown?"Hide Road from players; currently shown:":"Show Road to players; currently hidden:",
        ()=>actions.toggleRoadPlayerVisibility(scene,item,refresh));
      visibility.setAttribute("aria-pressed",String(shown));
      add("gear","Settings for",()=>actions.editRoadAppearance(scene,item,refresh));
      add("pen","Edit path of",()=>actions.beginPointEdit(scene,item.id,refresh));
      add("trash","Delete",()=>actions.remove(scene,item,refresh),true);
    } else {
      add("location-dot","Locate",()=>actions.selectCheckpoint(scene,item.id));
      if (party.enabled) {
        const shown=known.has(item.id);
        const visibility=add(shown?"eye":"eye-slash",
          shown?"Hide from party; currently known:":"Reveal through lore; currently unknown:",
          async()=>{
            if(!await confirmAtlasVisibilityChange({kind:"discovery",name:item.name,
              show:!shown}))return;
            await actions.setCheckpointKnowledge(scene,
              {checkpointId:item.id,knowledge:shown?"unknown":"lore",expected:party},refresh);
          });
        visibility.setAttribute("aria-pressed",String(shown));
      } else {
        const shown=item.playerVisible===true;
        const visibility=add(shown?"eye":"eye-slash",
          shown?"Hide Map Marker from players; currently shown:":"Show Map Marker to players; currently hidden:",
          ()=>actions.toggleCheckpointPlayerVisibility(scene,item,refresh));
        visibility.setAttribute("aria-pressed",String(shown));
      }
      add("gear","Settings for",()=>actions.editCheckpointAppearance(scene,item,refresh));
      add("pen","Move on map",()=>actions.moveMapMarker(scene,item.id,refresh));
      add("trash","Delete",()=>actions.removeCheckpoint(scene,item,refresh),true);
    }
    (parent.children[0]??parent).appendChild(bar);
  }
  const roads=atlas.roads??[];
  const checkpoints=atlas.checkpoints??[];
  // Explicit authored roadId and actual incident graph segments only. No spatial guesses.
  const markerRoads=new Map(checkpoints.map(marker=>[
    marker.id,new Set(marker.roadId?[marker.roadId]:[])
  ]));
  const byNode=new Map();
  for(const marker of checkpoints){
    const ids=byNode.get(marker.nodeId)??[];
    ids.push(marker.id);byNode.set(marker.nodeId,ids);
  }
  for(const edge of atlas.segments??[])
    for(const nodeId of [edge.from,edge.to])
      for(const markerId of byNode.get(nodeId)??[])
        markerRoads.get(markerId)?.add(edge.roadId);
  function draw() {
    const compare=(a,b)=>(saved.sort==="za"?-1:1)*(
      a.name.localeCompare(b.name,undefined,{sensitivity:"base"})||a.id.localeCompare(b.id));
    const sorted=items=>[...items].sort(compare);
    const query = saved.query.trim().toLocaleLowerCase();
    const matches = item => !query || item.name.toLocaleLowerCase().includes(query);
    const filtered = Boolean(query || saved.type || saved.place);
    function itemRow(item,type,path){
      const subtitle=type==="road"?
        roadAppearanceMode(item,presets):categoryNames.get(categories[item.id]??"generic");
      const row=group(path+"/"+type+"/"+item.id,item.name,false,subtitle);
      if(type==="road")row._atlasRoadIds.add(item.id);
      else row._atlasMarkerIds.add(item.id);
      tools(row,item,type);
      if(type==="road"){
        const attached=sorted(checkpoints.filter(marker=>
          markerRoads.get(marker.id)?.has(item.id)&&
          (!query||matches(item)||matches(marker))));
        const children=group(path+"/road/"+item.id+"/markers",
          "Map Markers ("+attached.length+")",Boolean(query));
        addShortcut(children,"checkpoint");
        for(const marker of attached)
          children.appendChild(itemRow(marker,"checkpoint",path+"/road/"+item.id));
        if(!attached.length)children.appendChild(element("p","No associated Map Markers."));
        collectCounts(children,[...children.children].slice(1));
        row.appendChild(children);
        collectCounts(row,[children]);
      }
      return row;
    }
    function section(key,label,entries,type,path){
      if(!entries.length)return null;
      const node=group(key,label+" ("+entries.length+")",Boolean(query));
      addShortcut(node,type);
      const rows=entries.map(item=>type==="territory"?item:itemRow(item,type,path));
      node.append(...rows);
      collectCounts(node,rows);
      return node;
    }
    const settlementKinds=new Set(["city","town","village","settlement"]);
    function placeRow(place,path,parentMatched=false){
      const key=path+"/"+place.id;
      const own=parentMatched||(matches(place)&&(!saved.type||place.kind===saved.type));
      const descendants=sorted(place.children).map(child=>placeRow(child,key,own)).filter(Boolean);
      const children=[];
      const settlements=descendants.filter(row=>settlementKinds.has(row._atlasKind));
      const other=descendants.filter(row=>!settlementKinds.has(row._atlasKind));
      for(const [name,entries] of [["Settlements",settlements],["Other territories",other]]){
        const node=section(key+"/"+name,name,entries,"territory",key);
        if(node)children.push(node);
      }
      for(const [type,entries] of [
        ["road",roads.filter(road=>directory.direct.get(place.id)?.has(road.id))],
        ["checkpoint",checkpoints.filter(marker=>territoryIds.get(marker.id)?.has(place.id))]
      ]){
        const found=sorted(entries.filter(item=>own||(!saved.type&&matches(item))));
        const name=type==="road"?"Roads":"Map Markers";
        const node=section(key+"/"+type,name,found,type,key);
        if(node)children.push(node);
      }
      if(!own&&!children.length)return null;
      const row=group(key,place.name,filtered,GEOGRAPHY_KINDS[place.kind]??"Territory");
      row._atlasKind=place.kind;
      tools(row,place,"territory");
      row.append(...children);
      collectCounts(row,children);
      const counts=element("small","Map Markers ("+row._atlasMarkerIds.size+
        ") | Roads ("+row._atlasRoadIds.size+")");
      counts.className="atlas-directory-counts";
      row.children[0].appendChild(counts);
      if(!children.length)row.appendChild(element("p","No matching map records."));
      return row;
    }
    let rows;
    if(view==="directory"){
      const rootPlaces=sorted(directory.tree).map(place=>placeRow(place,"territory")).filter(Boolean);
      const continents=rootPlaces.filter(item=>item._atlasKind==="continent");
      const other=rootPlaces.filter(item=>item._atlasKind!=="continent");
      rows=[];
      const continentGroup=section("continents","Continents",continents,"territory","root");
      if(continentGroup){
        const summary=element("small","Map Markers ("+continentGroup._atlasMarkerIds.size+
          ") | Roads ("+continentGroup._atlasRoadIds.size+")");
        summary.className="atlas-directory-counts";
        continentGroup.children[0].appendChild(summary);
        rows.push(continentGroup);
      }
      const otherGroup=section("other-territories","Other / unclassified territories",
        other,"territory","root");
      if(otherGroup)rows.push(otherGroup);
      const outside=group("unclassified","Outside classified territories",filtered);
      const looseRoads=new Set(directory.unclassifiedRoadIds);
      const outsideRows=[];
      for(const [type,entries] of [
        ["road",roads.filter(road=>looseRoads.has(road.id))],
        ["checkpoint",checkpoints.filter(marker=>
          ![...(territoryIds.get(marker.id)??[])].some(id=>places.has(id)))]
      ]){
        const found=sorted(entries.filter(matches));
        const name=type==="road"?"Roads":"Map Markers";
        const groupRow=section("unclassified/"+type,name,found,type,"outside");
        if(groupRow)outsideRows.push(groupRow);
      }
      outside.append(...outsideRows);collectCounts(outside,outsideRows);
      if(!saved.type&&outsideRows.length)rows.push(outside);
    }else if(view==="allRoads"){
      rows=sorted(roads.filter(item=>matches(item)&&
        (!saved.type||roadAppearanceMode(item,presets)===saved.type)))
        .map(item=>itemRow(item,"road","all"));
    }else{
      rows=sorted(checkpoints.filter(item=>matches(item)&&
        (!saved.type||(categories[item.id]??"generic")===saved.type)&&
        (!saved.place||territoryIds.get(item.id)?.has(saved.place))))
        .map(item=>itemRow(item,"checkpoint","all"));
    }
    if (!rows.length) rows.push(element("p","No matching entries."));
    list.replaceChildren(...rows);
  }
  root.className = "atlas-map-directory";
  root.append(filters,list);
  draw();
  return root;
}
