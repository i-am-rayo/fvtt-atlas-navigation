/**
 * GM-only D&D5e Group sheet integration and Group-owned transportation editor.
 * Reads native roster, saves Atlas World assignments by stable Group/Actor IDs,
 * and never modifies native Actors, currencies, or boarding state.
 */
import { GROUP_TRANSPORT_SETTING,readGroupTransportation,
  projectGroupTransportation,setGroupTransportationMembers,eligibleGroupRiders,
  groupTravelCapacityStatus,assessGroupCrewRoster }
  from "./navigation-group-transport.js";
import { listTransportationPresets } from "./navigation-transport-catalog.js";
import { AtlasTransportationSettings,openTransportationMethodEditor }
  from "./navigation-transport-settings.js";
import {createSettingsCategoryTabs} from "./settings-category-tabs.js";
import {createAtlasIconButton} from "./ui-action-button.js";

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
  container.style.cssText="display:grid;gap:.3rem;min-width:0;align-content:start;";
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
const number=(name,value,min,max,{step=1,placeholder="Unknown"}={})=>{
  const control=node("input");control.type="number";control.name=name;
  control.min=String(min);control.max=String(max);control.step=String(step);
  control.value=value===null?"":String(value);control.defaultValue=control.value;
  control.placeholder=value===null?placeholder:"";
  control.style.cssText="width:100%;min-width:0;box-sizing:border-box;";
  return control;
};
const action=(label,callback,{icon=null,danger=false,size="compact"}={})=>{
  const control=icon?createAtlasIconButton({icon,label,danger,size}):node("button",label);
  control.type="button";
  control.addEventListener("click",async()=>{
    control.disabled=true;
    try{await callback();}catch(error){
      console.error("["+MODULE_ID+"] Group transportation",error);
      globalThis.ui?.notifications?.error?.(error.message??String(error));
    }finally{control.disabled=false;}
  });
  return control;
};
/** A modal edits one unit at a time. Apply returns a draft, not a World write. */
async function editUnitCrew({name,unitIndex,prior,candidates,assignedElsewhere}){
  const content=node("div"),body=node("div");
  body.style.cssText="display:grid;gap:.65rem;max-height:min(54vh,500px);overflow:auto;padding:.5rem;";
  body.append(node("h3","Unit "+unitIndex+" — Crew roster"),
    node("p","Named PCs and NPCs each occupy one crew position. Hired hands are a quantity, not native Actors."));
  const hired=number("hiredCrew",prior.hired,0,1000);
  body.append(field("Hired hands",hired));
  const people=new Map(candidates.map(member=>[member.actorId,member]));
  for(const assignment of prior.named)if(!people.has(assignment.actorId))
    people.set(assignment.actorId,{actorId:assignment.actorId,actorName:"Unavailable member: "+assignment.actorId});
  for(const member of people.values()){
    const previous=prior.named.find(item=>item.actorId===member.actorId);
    const check=node("input");check.type="checkbox";check.name="crew-"+member.actorId;
    check.checked=Boolean(previous);check.defaultChecked=check.checked;
    check.disabled=!previous&&assignedElsewhere.has(member.actorId);
    const label=node("label");
    label.append(check,node("span",member.actorName+" · "+(member.actorType??"Unavailable")+
      (check.disabled?" (assigned elsewhere)":"")));
    const duty=node("input");duty.type="text";duty.name="duty-"+member.actorId;
    duty.maxLength=80;duty.value=previous?.duty??"";duty.defaultValue=duty.value;
    body.append(label,field("Duty — "+member.actorName,duty,"Optional."));
  }
  content.append(body);
  const response=await foundry.applications.api.DialogV2.input({
    window:{title:"Edit "+name+" crew"},position:{width:560},content,
    modal:true,rejectClose:false,ok:{label:"Apply to Party draft"}});
  if(!response)return null;
  const hiredCount=response.hiredCrew;
  if(hiredCount==null||String(hiredCount).trim()===""||
      !Number.isInteger(Number(hiredCount))||Number(hiredCount)<0||Number(hiredCount)>1000)
    throw Error("Hired hands must be a whole number between 0 and 1000.");
  const named=[];
  for(const member of people.values()){
    if(![true,"on","true"].includes(response["crew-"+member.actorId]))continue;
    if(!candidates.some(item=>item.actorId===member.actorId)||assignedElsewhere.has(member.actorId))
      throw Error("Crew member is unavailable or assigned to another unit: "+member.actorName);
    const duty=String(response["duty-"+member.actorId]??"").trim();
    if(duty.length>80)throw Error("Crew duty must be at most 80 characters.");
    named.push({actorId:member.actorId,...(duty?{duty}:{})});
  }
  return {unitIndex,named,hired:Number(hiredCount)};
}

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
  const control=createAtlasIconButton({icon:"horse",label:"Manage Party Transportation"});
  control.className+=" config-button atlas-transport-button";
  control.setAttribute("data-tooltip","Manage Party Transportation (GM only)");
  control.title="Manage Party Transportation (GM only)";
  control.style.margin="0 .15rem";
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
  constructor(groupId,...args){
    super({id:"fvtt-atlas-group-transportation-"+groupId},...args);
    this.groupId=groupId;this.dirty=false;
  }
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
    const methods=listTransportationPresets(game.settings,game.system.id);
    const roster=projectGroupTransportation(group,assignments,methods);
    const groupRiders=eligibleGroupRiders(roster);
    const methodSnapshot=JSON.stringify(methods);
    const lookup=new Map(methods.map(method=>[method.id,method]));
    const root=node("section");
    root.style.cssText="padding:1rem;display:flex;flex-direction:column;gap:.75rem;"+
      "height:100%;min-height:0;overflow:hidden;box-sizing:border-box;";
    const title=node("h2","Party-owned Transportation — "+roster.groupName);
    title.style.cssText="margin:0;";root.appendChild(title);
    root.appendChild(node("p","GM-only settings for this Group Actor. "+
      "NPCs are not mounts unless assigned as such; one Actor may represent multiple units. "+
      "Profiles use sustained travel speeds, not creature combat movement speeds."));
    const status=node("div");
    status.style.cssText="display:flex;gap:.8rem;flex-wrap:wrap;font-weight:650;";
    status.appendChild(node("span",roster.pcCount+" PCs | "+roster.npcCount+
      " NPCs · "+roster.travelers+" seats needed"));
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
    // Eligible mount riders reflect staged NPC role/seat changes, not just
    // persisted metadata from when this window first opened.
    const stagedCrewMembers=()=>roster.members.map(member=>{
      const entry=editable.find(item=>item.member.actorId===member.actorId);
      return entry?{...member,role:member.actorType==="vehicle"?"vehicle":entry.role.value,
        enabled:entry.enabled.value==="true"}:member;
    });
    const stagedRiders=()=>{
      const riders=new Map(groupRiders.map(member=>[member.id,member]));
      for(const entry of editable)if(entry.member.actorType==="npc"){
        riders.delete(entry.member.actorId);
        if(entry.role.value==="passenger"&&entry.needsSeat.checked&&
            Number(entry.quantity.value)===1)
          riders.set(entry.member.actorId,{
            id:entry.member.actorId,name:entry.member.actorName});
      }
      return [...riders.values()].sort((a,b)=>
        a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
    };
    // Client-only tabs preserve every drafted row while switching categories.
    const tabs=createSettingsCategoryTabs({
      id:"atlas-group-transport-"+this.groupId,
      modes:[["land","Land"],["water","Water"],["air","Air"],
        ["npc","NPC"],["setup","Need Setup"]],
      active:this.activeCategory??"land",
      onChange:category=>{this.activeCategory=category;}
    });
    tabs.nav.setAttribute("aria-label","Party transportation categories");
    root.appendChild(tabs.nav);
    const panelHost=node("div");
    panelHost.style.cssText="flex:1;min-height:0;overflow-y:auto;"+
      "display:block;align-content:start;";
    const bucket={},emptyBySurface={};
    const sectionStyle="border:1px solid var(--color-border-light-primary,#666);"+
      "border-radius:.5rem;padding:.6rem;min-width:0;gap:.35rem;";
    for(const [surface,label] of [["land","Land Travel"],["water","Water Travel"],["air","Air Travel"]]){
      const section=node("fieldset");
      section.className="atlas-group-transport-surface";
      section.style.cssText=sectionStyle;
      section.appendChild(node("legend",label));
      const empty=node("small","No owned resources.");
      empty.className="atlas-group-transport-empty";
      section.appendChild(empty);
      emptyBySurface[surface]=empty;
      bucket[surface]=section;
      panelHost.appendChild(tabs.addPanel(surface,section));
    }
    const updateSurfaceEmpty=()=>{
      for(const [surface,section] of Object.entries(bucket)){
        const empty=emptyBySurface[surface];
        empty.hidden=[...section.children].some(child=>
          child.className==="atlas-group-transport-resource");
        empty.style.display=empty.hidden?"none":"";
      }
    };
    const npcPanel=node("section");
    npcPanel.className="atlas-group-transport-npc";
    npcPanel.style.cssText="min-width:0;gap:.5rem;align-content:start;";
    const npcRoles={};
    for(const [role,label] of [["passenger","Companions / Passengers"],
      ["crew","Crew"],["pack","Pack Animals"],["ignore","Not Traveling"]]){
      const section=node("fieldset");
      section.className="atlas-group-transport-npc-category";
      section.style.cssText=sectionStyle;
      section.appendChild(node("legend",label));
      npcRoles[role]=section;
      npcPanel.appendChild(section);
    }
    panelHost.appendChild(tabs.addPanel("npc",npcPanel));
    const other=node("fieldset");
    other.className="atlas-group-transport-needs-setup";
    other.style.cssText=sectionStyle;
    other.appendChild(node("legend","Needs Setup"));
    other.appendChild(node("small","Choose a role to move each NPC into its category."));
    panelHost.appendChild(tabs.addPanel("setup",other));
    const setupTab=tabs.nav.children[4];
    const updateNeedSetup=()=>{
      const count=editable.filter(e=>e.member.actorType==="npc"&&
        e.role.value==="unassigned").length;
      setupTab.textContent=count?"Need Setup ! ("+count+")":"Need Setup";
      setupTab.setAttribute("aria-label",count?
        "Need Setup: "+count+" NPCs unconfigured":"Need Setup: all NPCs configured");
    };
    const updateNpcCategories=()=>{
      for(const panel of Object.values(npcRoles))
        panel.hidden=panel.children.length<=1;
    };
    for(const type of ["vehicle","npc"]){
      const members=roster.members.filter(member=>member.actorType===type);
      for(const member of members){
        const row=node("div");
        row.className="atlas-group-transport-resource";
        row.style.cssText="padding:.4rem 0;border-bottom:1px solid var(--color-border-light-primary,#555);"+
          "display:grid;gap:.3rem;min-width:0;";
        const header=node("div");
        header.style.cssText="display:flex;align-items:center;gap:.4rem;min-width:0;";
        const title=node("strong",member.actorName+
          (member.primaryVehicle?" ★ Primary vehicle":""));
        title.style.cssText="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        header.append(title);
        const role=select("role-"+member.actorId,type==="vehicle"?
          [["vehicle","Vehicle"]]:[
            ["unassigned","Choose NPC role"],["mount","Rideable Mount"],
            ["passenger","Companion / passenger"],["crew","Crew"],
            ["pack","Pack animal"],["ignore","Not traveling"]
          ],member.role);
        if(type==="vehicle")role.disabled=true;
        else{
          role.setAttribute("aria-label","Role for "+member.actorName);
          role.style.cssText+=";width:12rem;max-width:32vw;";
        }
        const quantity=number("quantity-"+member.actorId,member.quantity,1,100);
        const savedCapacity=assignments.groups[this.groupId]?.members?.[member.actorId]?.capacity;
        const capacity=number("capacity-"+member.actorId,savedCapacity??null,1,1000);
        const compatible=methods.filter(method=>
          method.kind===(type==="vehicle"?"vehicle":"mount"));
        const suggested=compatible.find(method=>
          method.name.toLowerCase()===member.actorName.toLowerCase()&&
          method.surface===member.surface);
        const initial=member.profileId??"";
        const options=[["","No linked profile"],...compatible.map(method=>
          [method.id,method.name+" ("+displaySurface(method.surface)+")"])];
        if(member.profileId&&!compatible.some(method=>method.id===member.profileId))
          options.push([member.profileId,"Unavailable World profile: "+member.profileId]);
        const profile=select("profile-"+member.actorId,options,initial);
        const speedOverride=number("speed-"+member.actorId,
          member.speedMphOverride,0.1,600,{step:0.01,placeholder:"Use World speed"});
        const costOverride=number("cost-"+member.actorId,
          member.costCpOverride,0,100000000,{step:0.01,placeholder:"Use World cost"});
        const costBasisOverride=select("cost-basis-"+member.actorId,[
          ["","Use World frequency"],["none","No recurring cost"],
          ["day","Per travel day"],["mile","Per traveled mile"]
        ],member.costBasisOverride??"");
        const costAppliesOverride=select("cost-applies-"+member.actorId,[
          ["","Use World charging unit"],["unit","Per transport unit"],
          ["passenger","Per passenger"]
        ],member.costAppliesOverride??"");
        const purchaseMode=select("purchase-mode-"+member.actorId,[
          ["inherit","Use World purchase price"],["none","Not for sale / no price"],
          ["custom","Custom purchase price"]
        ],member.purchaseGpOverride==="none"?"none":
          member.purchaseGpOverride===null?"inherit":"custom");
        const purchaseOverride=number("purchase-"+member.actorId,
          typeof member.purchaseGpOverride==="number"?member.purchaseGpOverride:null,
          0,100000000,{step:0.01,placeholder:"Price in GP"});
        purchaseOverride.disabled=purchaseMode.value!=="custom";
        purchaseMode.addEventListener("change",()=>{
          purchaseOverride.disabled=purchaseMode.value!=="custom";
          updateDetails();
        });
        const noteOverride=node("textarea");
        noteOverride.name="note-"+member.actorId;
        noteOverride.rows=2;noteOverride.maxLength=240;
        noteOverride.value=member.noteOverride??"";
        noteOverride.defaultValue=noteOverride.value;
        noteOverride.placeholder="Use World profile note";
        noteOverride.style.cssText="width:100%;box-sizing:border-box;resize:vertical;";
        const overrides=node("details");
        overrides.style.cssText="border:1px solid var(--color-border-light-tertiary,#555);"+
          "border-radius:.4rem;padding:.55rem;";
        const overrideSummary=node("summary","Individual cost, purchase and GM note overrides");
        overrideSummary.style.cssText="cursor:pointer;font-weight:600;";
        overrides.appendChild(overrideSummary);
        overrides.open=Boolean(member.costCpOverride!==null||
          member.costBasisOverride!==null||member.costAppliesOverride!==null||
          member.purchaseGpOverride!==null||member.noteOverride!==null);
        const overrideFields=node("div");
        overrideFields.style.cssText="display:grid;grid-template-columns:"+
          "repeat(auto-fit,minmax(11rem,1fr));gap:.65rem;margin-top:.7rem;align-items:start;";
        overrideFields.append(field("Recurring cost override (CP)",costOverride,
            "Blank uses the World profile's recurring cost."),
          field("Cost frequency override",costBasisOverride),
          field("Charge for each override",costAppliesOverride),
          field("Purchase price option",purchaseMode),
          field("Custom purchase price (GP)",purchaseOverride));
        overrides.appendChild(overrideFields);
        overrides.appendChild(field("GM note override",noteOverride,
          "Optional campaign-specific note; blank inherits the World profile."));
        const assignedOptions=[["","None — shared mount"],
          ...groupRiders.map(rider=>[rider.id,rider.name+" · "+rider.id])];
        if(member.assignedTo&&!groupRiders.some(rider=>rider.id===member.assignedTo))
          assignedOptions.push([member.assignedTo,
            "Unavailable party member: "+member.assignedTo]);
        const assignedTo=select("assigned-to-"+member.actorId,
          assignedOptions,member.assignedTo??"");
        const needsSeat=node("input");
        needsSeat.type="checkbox";needsSeat.name="needs-seat-"+member.actorId;
        needsSeat.checked=member.needsSeat!==false;
        const seatField=node("label");
        seatField.style.cssText="display:flex;align-items:center;gap:.35rem;white-space:nowrap;";
        seatField.append(needsSeat,node("span","Needs seat"));
        seatField.hidden=role.value!=="passenger"||type!=="npc";
        seatField.style.display=seatField.hidden?"none":"flex";
        needsSeat.addEventListener("change",()=>{updateDetails();this.dirty=true;});
        const profileDetails=node("small");
        const riderDetails=node("small");
        let crewEditor=null;
        const updateDetails=()=>{
          const rider=stagedRiders().find(item=>item.id===assignedTo.value);
          if(type==="npc"&&role.value!=="mount"){
            profileDetails.textContent=role.value==="passenger"?
              "Traveling NPC · Needs seat: "+(needsSeat.checked?"Yes":"No"):
              role.value==="unassigned"?"Choose a role in Need Setup.":
              "NPC role: "+(role.options?.[role.selectedIndex]?.textContent??role.value)+
                " · No passenger seat";
            riderDetails.textContent="";
            return;
          }
          riderDetails.textContent=assignedTo.value?
            "Assigned To: "+(rider?rider.name+" · "+rider.id:
              "Unavailable party member · "+assignedTo.value)+
            " (exclusive personal mount; no boarding)":
            "";
          const method=lookup.get(profile.value);
          const effectiveSpeed=method?(speedOverride.value===""?method.speedMph:
            Number(speedOverride.value)):null;
          const effectiveCost=costOverride.value===""?method?.costCp:Number(costOverride.value);
          const effectiveBasis=costBasisOverride.value||method?.costBasis;
          const effectiveApplies=costAppliesOverride.value||method?.costApplies;
          const effectivePurchase=purchaseMode.value==="inherit"?method?.purchaseGp:
            purchaseMode.value==="none"?null:Number(purchaseOverride.value);
          profileDetails.textContent=method?
            "Quantity Available: "+quantity.value+" · Seats/unit: "+
            (capacity.value||method.capacity||"unknown")+" · Surface: "+
            displaySurface(method.surface)+" · Travel: "+
            (Number.isFinite(effectiveSpeed)?effectiveSpeed:"—")+" mph "+
            (speedOverride.value===""?"(World profile)":"(Group override; World "+method.speedMph+" mph)")+
            " · "+(effectiveBasis==="none"?"No recurring cost":
              effectiveCost+" CP / "+(effectiveBasis==="day"?"day":"mile")+
              " per "+(effectiveApplies==="passenger"?"passenger":"unit"))+
            " · Purchase: "+(effectivePurchase===null?"not specified":effectivePurchase+" GP"):
            "Quantity Available: "+quantity.value+" · Choose a World profile under Edit.";
          crewEditor?.refresh();
        };
        updateDetails();
        if(type==="npc"&&member.role!=="mount")profile.disabled=true;
        profile.addEventListener("change",()=>{
          const method=lookup.get(profile.value);
          speedOverride.disabled=!method||(type==="npc"&&role.value!=="mount");
          if(!method)speedOverride.value="";
          if(method&&capacity.value===""&&method.capacity!==null)
            capacity.value=String(method.capacity);
          updateDetails();
        });
        if(type==="npc")role.addEventListener("change",()=>{
          profile.disabled=role.value!=="mount";
          speedOverride.disabled=role.value!=="mount"||!profile.value;
          seatField.hidden=role.value!=="passenger";
          seatField.style.display=seatField.hidden?"none":"flex";
          updateDetails();
        });
        speedOverride.disabled=!profile.value||(type==="npc"&&member.role!=="mount");
        speedOverride.addEventListener("input",updateDetails);
        for(const input of [costOverride,costBasisOverride,costAppliesOverride,
          purchaseOverride,noteOverride]){
          input.addEventListener("input",updateDetails);
          input.addEventListener("change",updateDetails);
        }
        const resetOverrides=node("button","Clear individual overrides");
        resetOverrides.type="button";
        resetOverrides.addEventListener("click",()=>{
          speedOverride.value="";
          costOverride.value="";costBasisOverride.value="";
          costAppliesOverride.value="";purchaseMode.value="inherit";
          purchaseOverride.value="";purchaseOverride.disabled=true;
          noteOverride.value="";
          updateDetails();
        });
        overrides.appendChild(resetOverrides);
        const controls=node("div");
        controls.style.cssText="display:grid;grid-template-columns:"+
          "repeat(auto-fit,minmax(9rem,1fr));gap:.65rem;";
        // Controls hold the validated parent draft without repeating override
        // fields in every Actor row; the shared method dialog edits this draft.
        controls.append(field("Quantity Available",quantity,
            "Number of mounts or vehicles represented by this Actor."),
          field("Passenger seats per unit",capacity),
          field("Transportation profile",profile),
          field("Speed override (mph)",speedOverride));
        const enabled=select("enabled-"+member.actorId,
          [["true","Available"],["false","Excluded from Party travel"]],
          member.enabled?"true":"false");
        const draftControls=node("div");
        draftControls.hidden=true;
        draftControls.style.display="none";
        draftControls.append(controls,overrides,enabled,assignedTo);
        const edit=action("Edit "+member.actorName+" transportation",async()=>{
          if(type==="npc"&&role.value!=="mount")
            throw Error("Choose Rideable Mount before assigning a transport profile.");
          const readNumber=input=>input.value===""?null:Number(input.value);
          const purchase=purchaseMode.value==="none"?"none":
            purchaseMode.value==="custom"?readNumber(purchaseOverride):null;
          await openTransportationMethodEditor({
            scope:"group",method:lookup.get(profile.value)??null,profiles:compatible,
            groupActorName:member.actorName,
            groupKind:type==="vehicle"?"vehicle":"mount",
            groupRiders:stagedRiders(),
            groupAssignment:{
              profileId:profile.value||null,quantity:Number(quantity.value),
              assignedTo:assignedTo.value||null,capacity:readNumber(capacity),
              speedMphOverride:readNumber(speedOverride),
              costCpOverride:readNumber(costOverride),
              costBasisOverride:costBasisOverride.value||null,
              costAppliesOverride:costAppliesOverride.value||null,
              purchaseGpOverride:purchase,noteOverride:noteOverride.value||null
            },
            onSave:async next=>{
              profile.value=next.profileId??"";
              quantity.value=String(next.quantity);
              assignedTo.value=next.assignedTo??"";
              capacity.value=next.capacity===null?"":String(next.capacity);
              speedOverride.value=next.speedMphOverride===null?"":
                String(next.speedMphOverride);
              costOverride.value=next.costCpOverride===null?"":
                String(next.costCpOverride);
              costBasisOverride.value=next.costBasisOverride??"";
              costAppliesOverride.value=next.costAppliesOverride??"";
              purchaseMode.value=next.purchaseGpOverride==="none"?"none":
                typeof next.purchaseGpOverride==="number"?"custom":"inherit";
              purchaseOverride.value=typeof next.purchaseGpOverride==="number"?
                String(next.purchaseGpOverride):"";
              purchaseOverride.disabled=purchaseMode.value!=="custom";
              noteOverride.value=next.noteOverride??"";
              updateDetails();
              const nextSurface=lookup.get(next.profileId)?.surface??member.surface;
              if(type==="vehicle"||role.value==="mount"){
                (bucket[nextSurface]??other).appendChild(row);
                updateSurfaceEmpty();
              }
              this.dirty=true;
            }
          });
        },{icon:"pen-to-square"});
        if(type==="npc"){
          edit.hidden=role.value!=="mount";
          edit.style.display=edit.hidden?"none":"";
          role.addEventListener("change",()=>{
            edit.hidden=role.value!=="mount";
            edit.style.display=edit.hidden?"none":"";
          });
        }
        const visible=node("div");
        visible.style.cssText="display:flex;align-items:center;gap:.4rem;flex:0 0 auto;margin-left:auto;";
        if(type==="npc")visible.append(role,seatField);
        visible.append(edit);
        // Native Group Actor membership owns removal. Older disabled Atlas
        // resources remain recoverable via an explicit one-way Restore action.
        if(!member.enabled){
          row.style.opacity=".6";
          const restore=action("Restore "+member.actorName+" to Party travel",()=>{
            enabled.value="true";row.style.opacity="1";
            restore.hidden=true;this.dirty=true;
          },{icon:"rotate-left"});
          visible.append(restore);
        }
        if(type==="npc"){
          const destination=()=>role.value==="unassigned"?other:
            role.value==="mount"?
              (bucket[lookup.get(profile.value)?.surface??member.surface]??other):
              npcRoles[role.value]??other;
          role.addEventListener("change",()=>{
            destination().appendChild(row);
            updateSurfaceEmpty();updateNpcCategories();updateNeedSetup();
            this.dirty=true;
          });
        }
        header.append(visible);
        row.append(header,draftControls,profileDetails);
        if(type==="npc")row.appendChild(riderDetails);
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
        const draft={member,role,quantity,capacity,profile,speedOverride,
          costOverride,costBasisOverride,costAppliesOverride,
          purchaseMode,purchaseOverride,noteOverride,enabled,assignedTo,needsSeat,
          crewRoster:member.crewRoster};
        editable.push(draft);
        if(type==="vehicle"){
          const section=node("div"),summary=node("small");
          section.style.cssText="display:flex;align-items:center;flex-wrap:wrap;gap:.4rem;";
          const unit=select("crew-unit-"+member.actorId,[],"1");
          unit.style.cssText="width:auto;max-width:100%;";
          unit.setAttribute("aria-label","Operating unit for "+member.actorName);
          const resource=()=>({...member,quantity:Number(quantity.value),
            enabled:enabled.value==="true",crewRoster:draft.crewRoster});
          const assess=()=>{const method=lookup.get(profile.value);
            return method?assessGroupCrewRoster({members:stagedCrewMembers()},resource(),method):null;};
          const refresh=()=>{
            const count=Number(quantity.value);
            const indices=new Set(Number.isInteger(count)&&count>=1&&count<=100?
              Array.from({length:count},(_,i)=>i+1):[]);
            for(const item of draft.crewRoster??[])indices.add(item.unitIndex);
            const options=[...indices].sort((a,b)=>a-b).map(i=>
              [String(i),"Unit "+i+(i>count?" (removed)":"")]);
            const value=indices.has(Number(unit.value))?unit.value:options[0]?.[0]??"";
            unit.replaceChildren(...select(unit.name,options,value).children);
            unit.value=value;
            const result=assess();
            const current=result?.units.find(item=>item.unitIndex===Number(value));
            summary.textContent=!result?"Link a World profile to configure crew.":
              !result.configured?"Crew roster not configured — reference estimate":
              !current?"Removed unit — clear its crew":
              current.staffedCrew+" / "+current.requiredCrew+" crew · "+
                current.tier.replaceAll("-"," ")+" · "+current.paidCrew+" paid"+
                (result.issues.length?" · Review invalid assignments":"");
          };
          const crewEdit=action("Edit crew for "+member.actorName,async()=>{
            if(!game.user?.isGM)throw Error("Only a GM may assign crew.");
            const method=lookup.get(profile.value),index=Number(unit.value);
            if(!method||!Number.isInteger(index)||index<1)
              throw Error("Choose a World profile and operating unit first.");
            const prior=draft.crewRoster?.find(item=>item.unitIndex===index)??
              {unitIndex:index,named:[],hired:0};
            const assignedElsewhere=new Set(editable.flatMap(entry=>
              (entry.crewRoster??[]).filter(item=>entry!==draft||item.unitIndex!==index)
                .flatMap(item=>item.named.map(person=>person.actorId))));
            const candidates=stagedCrewMembers().filter(person=>person.enabled!==false&&
              (person.actorType==="character"||person.actorType==="npc"&&
                ["crew","passenger","unassigned"].includes(person.role)));
            const before=JSON.stringify({roster:draft.crewRoster,profile:profile.value,quantity:quantity.value});
            const next=await editUnitCrew({name:member.actorName,unitIndex:index,prior,candidates,assignedElsewhere});
            if(!next)return;
            if(!game.user?.isGM||before!==JSON.stringify({roster:draft.crewRoster,profile:profile.value,quantity:quantity.value}))
              throw Error("Vehicle draft changed. Reopen crew editor.");
            const rosterDraft=(draft.crewRoster??[]).filter(item=>item.unitIndex!==index);
            if(next.named.length||next.hired)rosterDraft.push(next);
            rosterDraft.sort((a,b)=>a.unitIndex-b.unitIndex);
            const checked=assessGroupCrewRoster({members:stagedCrewMembers()},
              {...resource(),crewRoster:rosterDraft},method);
            if(checked.issues.some(issue=>issue.unitIndex===index))
              throw Error("Correct crew assignments or capacity for this unit.");
            draft.crewRoster=rosterDraft;this.dirty=true;refresh();
          },{icon:"users"});
          unit.addEventListener("change",refresh);
          section.append(unit,crewEdit,summary);
          row.appendChild(section);
          crewEditor={refresh};refresh();
        }
        const surface=lookup.get(profile.value)?.surface??member.surface;
        const target=type!=="npc"||member.role==="mount"?
          bucket[surface]??other:member.role==="unassigned"?
          other:npcRoles[member.role]??other;
        target.appendChild(row);
      }
    }
    updateSurfaceEmpty();updateNpcCategories();updateNeedSetup();
    root.appendChild(panelHost);
    const footer=node("div");
    footer.className="atlas-group-transport-footer";
    footer.style.cssText="display:flex;justify-content:space-between;align-items:center;"+
      "flex-wrap:wrap;gap:.6rem;flex:0 0 auto;"+
      "padding:.4rem 0;border-top:1px solid var(--color-border-light-tertiary,#555);";
    const leftActions=node("div"),rightActions=node("div");
    leftActions.style.cssText="display:flex;align-items:center;gap:.35rem;";
    rightActions.style.cssText="display:flex;align-items:center;gap:.35rem;margin-left:auto;";
    const save=action("Save Party Transportation Assignments",async()=>{
      if(!game.user?.isGM)throw new Error("Only a GM may assign transportation.");
      const currentAssignments=readGroupTransportation(game.settings);
      if(JSON.stringify(currentAssignments.groups[this.groupId]??null)!==
          JSON.stringify(assignments.groups[this.groupId]??null))
        throw new Error("This Group's assignments changed elsewhere. Reopen the editor.");
      const currentGroup=game.actors?.get?.(this.groupId);
      if(!currentGroup||currentGroup.type!=="group")
        throw new Error("The Group Actor is no longer available.");
      const currentRoster=projectGroupTransportation(currentGroup,currentAssignments,methods);
      if(JSON.stringify(currentRoster.members.map(m=>m.actorId))!==
          JSON.stringify(roster.members.map(m=>m.actorId)))
        throw new Error("Group membership changed. Reopen the editor.");
      const now=listTransportationPresets(game.settings,game.system.id);
      if(JSON.stringify(now)!==methodSnapshot)
        throw new Error("Transportation profiles changed. Reopen the editor.");
      const changes={};
      for(const entry of editable){
        const {member,role,quantity,capacity,profile,speedOverride,
          costOverride,costBasisOverride,costAppliesOverride,
          purchaseMode,purchaseOverride,noteOverride,enabled,assignedTo,needsSeat}=entry;
        const isTransport=member.actorType==="vehicle"||role.value==="mount";
        const profileId=isTransport?(profile.value||null):null;
        const method=profileId?lookup.get(profileId):null;
        const expectedKind=member.actorType==="vehicle"?"vehicle":"mount";
        if(profileId&&(!method||method.kind!==expectedKind))
          throw new Error("Choose a compatible transportation profile for "+member.actorName+".");
        const override=!isTransport||speedOverride.value.trim()===""?
          null:Number(speedOverride.value);
        if(override!==null&&(!profileId||!Number.isFinite(override)||
            override<0.1||override>600))
          throw new Error("Enter a valid speed override between 0.1 and 600 mph for "+member.actorName+".");
        const readMoney=control=>{
          if(!isTransport||control.value.trim()==="")return null;
          const n=Number(control.value);
          if(!profileId||!Number.isFinite(n)||n<0||n>100000000)
            throw new Error("Enter a valid nonnegative currency override for "+member.actorName+".");
          return n;
        };
        const purchase=isTransport&&purchaseMode.value==="none"?"none":
          isTransport&&purchaseMode.value==="custom"?
            (()=>{const n=readMoney(purchaseOverride);
              if(n===null)throw new Error("Enter a purchase price for "+member.actorName+".");
              return n;})():null;
        const note=isTransport?noteOverride.value.trim():null;
        if(note!==null&&note.length>240)
          throw new Error("GM note must be no longer than 240 characters.");
        const riderId=assignedTo.value||null;
        if(riderId&&(role.value!=="mount"||Number(quantity.value)!==1||
            enabled.value!=="true"))
          throw Error("Clear Assigned To for "+member.actorName+
            " before changing its role, quantity, or availability.");
        changes[member.actorId]={
          role:member.actorType==="vehicle"?"unassigned":role.value,
          quantity:Number(quantity.value),
          capacity:capacity.value===""?null:Number(capacity.value),
          surface:method?.surface??member.surface,profileId,
          enabled:enabled.value==="true",assignedTo:riderId,
          needsSeat:member.actorType==="npc"?needsSeat.checked:true,
          speedMphOverride:isTransport?override:null,
          costCpOverride:readMoney(costOverride),
          costBasisOverride:isTransport?(costBasisOverride.value||null):null,
          costAppliesOverride:isTransport?(costAppliesOverride.value||null):null,
          purchaseGpOverride:purchase,
          noteOverride:note||null,
          ...(entry.crewRoster===undefined?{}:{crewRoster:entry.crewRoster})
        };
      }
      const next=setGroupTransportationMembers(currentAssignments,this.groupId,changes);
      const reviewed=projectGroupTransportation(currentGroup,next,now);
      const eligible=new Set(eligibleGroupRiders(reviewed).map(rider=>rider.id));
      for(const member of reviewed.members)
        if(member.assignedTo&&!eligible.has(member.assignedTo))
          throw Error("Assigned To for "+member.actorName+
            " is no longer an eligible traveling Party member. Clear the assignment.");
      for(const member of reviewed.members){
        if(member.crewRoster===undefined)continue;
        const method=now.find(item=>item.id===member.profileId);
        if(!method)throw Error("Link a valid World profile for "+member.actorName+" crew.");
        const assessment=assessGroupCrewRoster(reviewed,member,method);
        if(assessment.issues.length)
          throw Error("Correct invalid crew assignments for "+member.actorName+" before saving.");
      }
      await game.settings.set(MODULE_ID,GROUP_TRANSPORT_SETTING,next);
      this.dirty=false;
      globalThis.ui?.notifications?.info?.("Party transportation assignments saved.");
      await this.render();
    },{icon:"floppy-disk",size:"footer"});
    rightActions.appendChild(save);
    leftActions.appendChild(action("Transportation Presets",()=>{
      if(!game.user?.isGM)throw new Error("Only a GM may edit profiles.");
      const editor=new AtlasTransportationSettings();
      editor.activeTab="methods";
      return editor.render({force:true});
    }));
    leftActions.appendChild(action("Refresh Party Transportation",async()=>{
      if(this.dirty){
        const yes=await foundry.applications.api.DialogV2.confirm({
          window:{title:"Discard Party transportation changes?"},
          content:"<p>Refresh discards your uncommitted Party transportation edits.</p>",
          rejectClose:false,modal:true
        });
        if(!yes)return;
      }
      this.dirty=false;
      await this.render();
    },{icon:"rotate"}));
    footer.append(leftActions,rightActions);
    root.appendChild(footer);
    root.appendChild(node("small","Atlas saves Group-only quantities, capacities, profile links, "+
      "speed, upkeep, purchase and note overrides. Transport surface and kind come from the "+
      "World profile. Remove members in the native Group Actor sheet. "+
      "No native Actor edits, boarding, movement or currency deductions."));
    return root;
  }
}
