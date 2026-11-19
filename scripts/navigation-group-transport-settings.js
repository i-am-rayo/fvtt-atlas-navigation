/**
 * GM-only D&D5e Group sheet integration and Group-owned transportation editor.
 * Reads native roster, saves Atlas World assignments by stable Group/Actor IDs,
 * and never modifies native Actors, currencies, or boarding state.
 */
import { GROUP_TRANSPORT_SETTING,readGroupTransportation,
  projectGroupTransportation,setGroupTransportationMembers,eligibleGroupRiders,
  groupTravelCapacityStatus }
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
const action=(label,callback,{icon=null,danger=false}={})=>{
  const control=icon?createAtlasIconButton({icon,label,danger}):node("button",label);
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
    const panelHost=node("div");
    panelHost.style.cssText="flex:1;min-height:0;overflow-y:auto;display:grid;gap:.65rem;align-content:start;";
    const bucket={};
    for(const [surface,label] of [["land","Land Travel"],["water","Water Travel"],["air","Air Travel"]]){
      const section=node("fieldset");
      section.className="atlas-group-transport-surface";
      section.style.cssText="border:1px solid var(--color-border-light-primary,#666);"+
        "border-radius:.5rem;padding:.6rem;min-width:0;display:grid;gap:.35rem;";
      section.appendChild(node("legend",label));
      bucket[surface]=section;
      panelHost.appendChild(section);
    }
    const other=node("fieldset");
    other.className="atlas-group-transport-needs-setup";
    other.style.cssText="border:1px solid var(--color-border-light-primary,#666);"+
      "border-radius:.5rem;padding:.6rem;min-width:0;display:grid;gap:.35rem;";
    other.appendChild(node("legend","Other NPCs / Needs Setup"));
    other.appendChild(node("small","Only explicitly marked mounts provide transportation. Other NPC roles remain editable here."));
    panelHost.appendChild(other);
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
            ["unassigned","Choose NPC role"],["mount","Mount"],
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
        const profileDetails=node("small");
        const riderDetails=node("small");
        const updateDetails=()=>{
          const rider=groupRiders.find(item=>item.id===assignedTo.value);
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
        const assignedOptions=[["","None — shared mount"],
          ...groupRiders.map(rider=>[rider.id,rider.name+" · "+rider.id])];
        if(member.assignedTo&&!groupRiders.some(rider=>rider.id===member.assignedTo))
          assignedOptions.push([member.assignedTo,
            "Unavailable party member: "+member.assignedTo]);
        const assignedTo=select("assigned-to-"+member.actorId,
          assignedOptions,member.assignedTo??"");
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
            groupKind:type==="vehicle"?"vehicle":"mount",groupRiders,
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
              if(type==="vehicle"||role.value==="mount")
                (bucket[nextSurface]??other).appendChild(row);
              this.dirty=true;
            }
          });
        },{icon:"pen-to-square"});
        if(type==="npc"){
          edit.disabled=role.value!=="mount";
          role.addEventListener("change",()=>{edit.disabled=role.value!=="mount";});
        }
        const visible=node("div");
        visible.style.cssText="display:flex;align-items:center;gap:.4rem;flex:0 0 auto;margin-left:auto;";
        if(type==="npc")visible.append(role);
        visible.append(edit);
        const removal=action("Remove "+member.actorName+" from Party transportation",async()=>{
          if(enabled.value==="true"){
            const yes=await foundry.applications.api.DialogV2.confirm({
              window:{title:"Remove from Party transportation?"},
              content:"<p>This will exclude the resource from Atlas Party travel "+
                "after Save. Its native Group Actor membership will remain unchanged.</p>",
              rejectClose:false,modal:true
            });
            if(!yes)return;
          }
          enabled.value=enabled.value==="true"?"false":"true";
          updateRemoval();this.dirty=true;
        },{icon:"trash",danger:true});
        const updateRemoval=()=>{
          const active=enabled.value==="true";
          const label=(active?"Remove ":"Re-enable ")+member.actorName+
            (active?" from Party transportation":" for Party transportation");
          removal.setAttribute("aria-label",label);removal.title=label;removal.ariaLabel=label;
          const glyph=removal.children?.[0];
          if(glyph)glyph.className="fa-solid fa-"+(active?"trash":"rotate-left");
          row.style.opacity=active?"1":".6";
        };
        updateRemoval();
        if(type==="npc"){
          const sync=move=>{
            const mount=role.value==="mount";
            edit.disabled=!mount;
            removal.disabled=!mount;
            if(move)(mount?(bucket[lookup.get(profile.value)?.surface??member.surface]??other):other)
              .appendChild(row);
          };
          role.addEventListener("change",()=>{sync(true);this.dirty=true;});
          sync(false);
        }
        // Native Group membership and NPC role govern participation. Do not
        // duplicate native NPC deletion with an Atlas exclusion action.
        if(type==="vehicle"||!member.enabled)visible.append(removal);
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
        editable.push({member,role,quantity,capacity,profile,speedOverride,
          costOverride,costBasisOverride,costAppliesOverride,
          purchaseMode,purchaseOverride,noteOverride,enabled,assignedTo});
        const surface=lookup.get(profile.value)?.surface??member.surface;
        const target=type==="npc"&&member.role!=="mount"?other:
          bucket[surface]??other;
        target.appendChild(row);
      }
    }
    for(const section of Object.values(bucket))
      if(section.children.length===1)section.appendChild(node("small","No owned resources."));
    root.appendChild(panelHost);
    const footer=node("div");footer.style.cssText="display:flex;flex-wrap:wrap;gap:.6rem;flex:0 0 auto;";
    footer.appendChild(action("Save Party Transportation Assignments",async()=>{
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
          purchaseMode,purchaseOverride,noteOverride,enabled,assignedTo}=entry;
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
          speedMphOverride:isTransport?override:null,
          costCpOverride:readMoney(costOverride),
          costBasisOverride:isTransport?(costBasisOverride.value||null):null,
          costAppliesOverride:isTransport?(costAppliesOverride.value||null):null,
          purchaseGpOverride:purchase,
          noteOverride:note||null
        };
      }
      const next=setGroupTransportationMembers(currentAssignments,this.groupId,changes);
      const reviewed=projectGroupTransportation(currentGroup,next,now);
      const eligible=new Set(eligibleGroupRiders(reviewed).map(rider=>rider.id));
      for(const member of reviewed.members)
        if(member.assignedTo&&!eligible.has(member.assignedTo))
          throw Error("Assigned To for "+member.actorName+
            " is no longer an eligible traveling Party member. Clear the assignment.");
      await game.settings.set(MODULE_ID,GROUP_TRANSPORT_SETTING,next);
      this.dirty=false;
      globalThis.ui?.notifications?.info?.("Party transportation assignments saved.");
      await this.render();
    }));
    footer.appendChild(action("Edit World Transportation Profiles",()=>{
      if(!game.user?.isGM)throw new Error("Only a GM may edit profiles.");
      const editor=new AtlasTransportationSettings();
      editor.activeTab="methods";
      return editor.render({force:true});
    }));
    footer.appendChild(action("Refresh",async()=>{
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
    }));
    root.appendChild(footer);
    root.appendChild(node("small","Atlas saves Group-only quantities, capacities, profile links, "+
      "speed, upkeep, purchase and note overrides. Transport surface and kind come from the "+
      "World profile. No native Actor edits, boarding, movement or currency deductions."));
    return root;
  }
}
