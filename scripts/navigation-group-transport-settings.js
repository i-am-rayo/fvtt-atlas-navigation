/**
 * GM-only D&D5e Group sheet integration and Group-owned transportation editor.
 * Reads native roster, saves Atlas World assignments by stable Group/Actor IDs,
 * and never modifies native Actors, currencies, or boarding state.
 */
import { GROUP_TRANSPORT_SETTING,readGroupTransportation,
  projectGroupTransportation,setGroupTransportationMember,groupTravelCapacityStatus }
  from "./navigation-group-transport.js";
import { listTransportationPresets } from "./navigation-transport-catalog.js";
import { AtlasTransportationSettings } from "./navigation-transport-settings.js";

const MODULE_ID="fvtt-atlas-navigation";
const SURFACES=["land","water","air"];
const displaySurface=s=>s[0].toUpperCase()+s.slice(1);
const node=(tag,label)=>{
  const result=document.createElement(tag);
  if(label!==undefined)result.textContent=label;
  return result;
};
const field=(label,control,help)=>{
  const container=node("label");
  container.style.cssText="display:grid;gap:.3rem;min-width:0;";
  const name=node("span",label);name.style.fontWeight="600";
  container.append(name,control);
  if(help){const detail=node("small",help);detail.style.opacity=".75";container.append(detail);}
  return container;
};
const select=(name,choices,value)=>{
  const control=node("select");control.name=name;
  control.style.cssText="width:100%;min-width:0;";
  for(const [id,label] of choices){
    const option=node("option",label);
    option.value=id;option.defaultSelected=id===value;option.selected=id===value;
    control.appendChild(option);
  }
  control.value=value;
  return control;
};
const number=(name,value,min,max)=>{
  const control=node("input");control.type="number";control.name=name;
  control.min=String(min);control.max=String(max);control.step="1";
  control.value=value===null?"":String(value);control.defaultValue=control.value;
  control.placeholder=value===null?"Unknown":"";
  control.style.cssText="width:100%;min-width:0;box-sizing:border-box;";
  return control;
};
const action=(label,callback)=>{
  const control=node("button",label);control.type="button";
  control.addEventListener("click",async()=>{
    control.disabled=true;
    try{await callback();}catch(error){
      console.error("["+MODULE_ID+"] Group transportation",error);
      globalThis.ui?.notifications?.error?.(error.message??String(error));
    }finally{control.disabled=false;}
  });
  return control;
};
const base=globalThis.foundry?.applications?.api?.ApplicationV2??class {};

/** Programmatic checks are repeated when opening and saving the editor. */
export function resolveAtlasTransportGroup(app){
  const actor=app?.document??app?.actor??app?.object;
  return actor?.type==="group"?actor:null;
}
export function openAtlasGroupTransportation(groupId){
  if(!globalThis.game?.user?.isGM)
    throw new Error("Only a GM can manage Party transportation.");
  if(game.system?.id!=="dnd5e")
    throw new Error("Group transportation requires D&D 5e.");
  const group=game.actors?.get?.(groupId);
  if(!group||group.type!=="group")
    throw new Error("The Group Actor is no longer available.");
  const editor=new AtlasGroupTransportationSettings(group.id);
  void editor.render({force:true});
  return editor;
}

/** Hooked via the public v14 renderApplicationV2 hook. Idempotent on rerenders. */
export function addAtlasGroupTransportationControl(app,html){
  if(!globalThis.game?.user?.isGM||game.system?.id!=="dnd5e")return false;
  const group=resolveAtlasTransportGroup(app);
  if(!group)return false;
  const root=html?.querySelector?html:html?.[0];
  const header=root?.querySelector?.(".header.travel-pace");
  const heading=header?.querySelector?.("h3");
  if(!heading||header.querySelector(".atlas-transport-button"))return false;
  const control=node("button");control.type="button";
  control.className="unbutton config-button atlas-transport-button";
  control.setAttribute("aria-label","Manage Party Transportation");
  control.setAttribute("data-tooltip","Manage Party Transportation (GM only)");
  control.title="Manage Party Transportation (GM only)";
  control.style.cssText="display:inline-flex;align-items:center;justify-content:center;"+
    "flex:0 0 1.7rem;width:1.7rem;height:1.7rem;padding:0;margin:0 .15rem;"+
    "color:var(--color-text-light-highlight,#c7b68d);";
  const icon=node("i");icon.className="fa-solid fa-horse";
  icon.setAttribute("aria-hidden","true");control.appendChild(icon);
  control.addEventListener("click",event=>{
    event?.preventDefault?.();event?.stopPropagation?.();
    try{openAtlasGroupTransportation(group.id);}catch(error){
      globalThis.ui?.notifications?.error?.(error.message??String(error));
    }
  });
  heading.insertAdjacentElement("afterend",control);
  return true;
}

export class AtlasGroupTransportationSettings extends base {
  static DEFAULT_OPTIONS={
    id:"fvtt-atlas-group-transportation",
    window:{title:"Atlas — Party-owned Transportation",resizable:true},
    position:{width:790,height:700}
  };
  constructor(groupId,...args){super(...args);this.groupId=groupId;}
  _replaceHTML(result,content){content.replaceChildren(result);}
  async _renderHTML(){
    if(!globalThis.game?.user?.isGM)
      throw new Error("Only a GM can manage Party transportation.");
    if(game.system?.id!=="dnd5e")
      throw new Error("Group transportation requires D&D 5e.");
    const group=game.actors?.get?.(this.groupId);
    if(!group||group.type!=="group")
      throw new Error("The Group Actor is no longer available.");
    const assignments=readGroupTransportation(game.settings);
    const roster=projectGroupTransportation(group,assignments);
    const methods=listTransportationPresets(game.settings,game.system.id);
    const methodSnapshot=JSON.stringify(methods);
    const lookup=new Map(methods.map(method=>[method.id,method]));
    const root=node("section");
    root.style.cssText="padding:1rem;display:flex;flex-direction:column;gap:1rem;"+
      "height:100%;overflow:auto;box-sizing:border-box;";
    const title=node("h2","Party-owned Transportation — "+roster.groupName);
    title.style.cssText="margin:0;";root.appendChild(title);
    root.appendChild(node("p","GM-only settings for this Group Actor. "+
      "NPCs are not mounts unless assigned as such; one Actor may represent multiple units. "+
      "Profiles use sustained travel speeds, not creature combat movement speeds."));
    const status=node("div");
    status.style.cssText="display:flex;gap:.8rem;flex-wrap:wrap;font-weight:650;";
    status.appendChild(node("span",roster.travelers+" traveler(s)"));
    for(const surface of SURFACES){
      const capacity=groupTravelCapacityStatus(roster,surface);
      status.appendChild(node("span",displaySurface(surface)+" seats: "+capacity.seats));
    }
    root.appendChild(status);
    if(roster.unclassified){
      const notice=node("p",roster.unclassified+" NPC(s) still need a GM role assignment.");
      notice.style.cssText="border-left:3px solid #d6a332;padding:.5rem;margin:0;";
      root.appendChild(notice);
    }
    const editable=[];
    const categories=[
      ["character","Player Characters","Native character members are counted as travelers."],
      ["npc","Non-player Characters","Assign a role; select a mount profile only when applicable."],
      ["vehicle","Vehicles","Choose the actual transportation profile, quantity and passenger capacity."]
    ];
    for(const [type,label,description] of categories){
      const section=node("fieldset");
      section.style.cssText="border:1px solid var(--color-border-light-primary,#666);"+
        "border-radius:.5rem;padding:.75rem;display:grid;gap:.75rem;min-width:0;";
      section.appendChild(node("legend",label));
      section.appendChild(node("small",description));
      const members=roster.members.filter(member=>member.actorType===type);
      if(!members.length)section.appendChild(node("p","No "+label.toLowerCase()+" in this Group."));
      for(const member of members){
        const row=node("div");
        row.style.cssText="border:1px solid var(--color-border-light-tertiary,#555);"+
          "border-radius:.45rem;padding:.75rem;display:grid;gap:.65rem;";
        row.appendChild(node("strong",member.actorName+
          (member.primaryVehicle?" ★ Primary vehicle":"")));
        if(type==="character"){
          row.appendChild(node("small","Counts as one party traveler; transportation is configured separately."));
          section.appendChild(row);continue;
        }
        const role=select("role-"+member.actorId,type==="vehicle"?
          [["vehicle","Vehicle"]]:[
            ["unassigned","Choose NPC role"],["mount","Mount"],
            ["passenger","Companion / passenger"],["crew","Crew"],
            ["pack","Pack animal"],["ignore","Not traveling"]
          ],member.role);
        if(type==="vehicle")role.disabled=true;
        const quantity=number("quantity-"+member.actorId,member.quantity,1,100);
        const capacity=number("capacity-"+member.actorId,member.capacity,1,1000);
        const surface=select("surface-"+member.actorId,
          SURFACES.map(s=>[s,displaySurface(s)]),member.surface);
        const compatible=methods.filter(method=>
          method.kind===(type==="vehicle"?"vehicle":"mount"));
        const suggested=compatible.find(method=>
          method.name.toLowerCase()===member.actorName.toLowerCase()&&
          method.surface===member.surface);
        const initial=member.profileId??suggested?.id??"";
        const options=[["","No linked profile"],...compatible.map(method=>
          [method.id,method.name+" ("+displaySurface(method.surface)+")"])];
        const profile=select("profile-"+member.actorId,options,initial);
        const profileDetails=node("small");
        const updateDetails=()=>{
          const method=lookup.get(profile.value);
          profileDetails.textContent=method?
            "Travel: "+(method.speedMph??"party pace")+" mph · "+
            (method.costBasis==="none"?"No recurring cost":
              method.costCp+" CP / "+(method.costBasis==="day"?"day":"mile")+
              " per "+(method.costApplies==="passenger"?"passenger":"unit"))+
            " · Purchase: "+(method.purchaseGp===null?"not specified":method.purchaseGp+" GP"):
            "Choose a World profile or create a custom one.";
        };
        updateDetails();
        if(type==="npc"&&member.role!=="mount")profile.disabled=true;
        profile.addEventListener("change",()=>{
          updateDetails();
          const method=lookup.get(profile.value);
          if(!method)return;
          surface.value=method.surface;
          if(capacity.value===""&&method.capacity!==null)
            capacity.value=String(method.capacity);
        });
        if(type==="npc")role.addEventListener("change",()=>{
          profile.disabled=role.value!=="mount";
        });
        const controls=node("div");
        controls.style.cssText="display:grid;grid-template-columns:"+
          "repeat(auto-fit,minmax(9rem,1fr));gap:.65rem;";
        controls.append(field("Role",role),field("Number available",quantity),
          field("Riders per unit",capacity),field("Travel surface",surface),
          field("Transportation profile",profile,
            "Stable profile ID; renaming the Actor will not change its speed or cost."));
        row.appendChild(controls);
        row.appendChild(profileDetails);
        if(member.profileId&&!lookup.has(member.profileId)){
          const missing=node("p","Previously selected profile '"+member.profileId+
            "' is unavailable. Choose another profile before saving.");
          missing.style.cssText="margin:0;color:#e3aa69;";
          row.appendChild(missing);
        }else if(!member.profileId&&suggested&&
            (type==="vehicle"||member.role==="mount")){
          row.appendChild(node("small","Suggested from current name: "+suggested.name+
            ". Save assignments to link this Actor permanently by profile ID."));
        }
        if(member.primaryVehicle)row.appendChild(node("small",
          "Foundry's primary-vehicle flag does not mean the party is aboard."));
        editable.push({member,role,quantity,capacity,surface,profile});
        section.appendChild(row);
      }
      root.appendChild(section);
    }
    const footer=node("div");footer.style.cssText="display:flex;flex-wrap:wrap;gap:.6rem;";
    footer.appendChild(action("Save Party Transportation Assignments",async()=>{
      if(!game.user?.isGM)throw new Error("Only a GM may assign transportation.");
      if(JSON.stringify(readGroupTransportation(game.settings))!==JSON.stringify(assignments))
        throw new Error("Group assignments changed elsewhere. Reopen the editor.");
      const currentGroup=game.actors?.get?.(this.groupId);
      if(!currentGroup||currentGroup.type!=="group")
        throw new Error("The Group Actor is no longer available.");
      const currentRoster=projectGroupTransportation(currentGroup,assignments);
      if(JSON.stringify(currentRoster.members.map(m=>m.actorId))!==
          JSON.stringify(roster.members.map(m=>m.actorId)))
        throw new Error("Group membership changed. Reopen the editor.");
      const now=listTransportationPresets(game.settings,game.system.id);
      if(JSON.stringify(now)!==methodSnapshot)
        throw new Error("Transportation profiles changed. Reopen the editor.");
      let next=assignments;
      for(const entry of editable){
        const {member,role,quantity,capacity,surface,profile}=entry;
        const isTransport=member.actorType==="vehicle"||role.value==="mount";
        const profileId=isTransport?(profile.value||null):null;
        const method=profileId?lookup.get(profileId):null;
        const expectedKind=member.actorType==="vehicle"?"vehicle":"mount";
        if(profileId&&(!method||method.kind!==expectedKind||
            method.surface!==surface.value))
          throw new Error("Choose a compatible transportation profile for "+member.actorName+".");
        next=setGroupTransportationMember(next,this.groupId,member.actorId,{
          role:member.actorType==="vehicle"?"unassigned":role.value,
          quantity:Number(quantity.value),
          capacity:capacity.value===""?null:Number(capacity.value),
          surface:surface.value,profileId
        });
      }
      await game.settings.set(MODULE_ID,GROUP_TRANSPORT_SETTING,next);
      globalThis.ui?.notifications?.info?.("Party transportation assignments saved.");
      await this.render();
    }));
    footer.appendChild(action("Edit World Transportation Profiles",()=>{
      if(!game.user?.isGM)throw new Error("Only a GM may edit profiles.");
      const editor=new AtlasTransportationSettings();
      editor.activeTab="methods";
      return editor.render({force:true});
    }));
    footer.appendChild(action("Refresh",()=>this.render()));
    root.appendChild(footer);
    root.appendChild(node("small","Atlas only saves transport roles, quantities, capacities, surfaces "+
      "and stable profile links. No native Actor changes, boarding, movement or currency deductions."));
    return root;
  }
}
