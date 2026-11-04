/**
 * Navigation footer presentation for GM Journey decisions.
 *
 * This module creates UI controls only. Movement, clock/Journal writes,
 * permissions and persistence remain with the controller's guarded methods.
 * Rendering must not invoke an action or mutate the current Journey.
 */
import {createAtlasIconButton} from "./ui-action-button.js";
import {canRequestPassengerRest} from "./navigation-passenger-rest.js";
import {MAX_GUIDED_REST_EVENTS,MAX_GUIDED_TRAVEL_EVENTS}
  from "./navigation-travel-day.js";

const footerButton=(label,icon)=>createAtlasIconButton({icon,label,size:"footer"});

/** @param {object} nav Existing AtlasNavigationController instance. */
export function renderNavigationFooter(nav,{partyMode=false,transferPlan=null,
  assistedLegReady=false,repeatingCheckpoint=false,methodAssessment=null}={}){
  const row=document.createElement("div");
  row.style.cssText="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;padding:.65rem 1rem;border-top:1px solid var(--color-border-light-tertiary,#555);background:var(--color-bg,#100e18);flex:none;";
  const newRoute=footerButton("New Route","route");
  newRoute.disabled=Boolean(nav.travelSession||nav.journalStarting||nav.pendingTransfer);
  newRoute.title=partyMode?"Choose a new destination from the party token":
    "Clear route and choose a new Point A";
  newRoute.addEventListener("click",()=>{
    nav.clear();
    if(partyMode)nav.refreshPartyDeparture();
  });
  row.appendChild(newRoute);
  if(nav.pendingTransfer){
    const atDestination=nav.isAtJourneyDestination();
    const actions=[
      ["Stop and replan","code-branch",()=>nav.stopAndReplanAtCheckpoint()],
      ["Continue from checkpoint","forward-step",()=>nav.continueFromCheckpoint()],
      ...(atDestination?[["Complete Journey","flag-checkered",
        ()=>nav.completeJourneyAtCheckpoint()]]:[])
    ];
    for(const [label,icon,action] of actions){
      const choice=footerButton(label,icon);
      choice.disabled=Boolean(nav.journalStarting||nav.travelSession);
      choice.addEventListener("click",()=>void action().catch(error=>
        globalThis.ui?.notifications?.error?.(error.message??String(error))));
      row.appendChild(choice);
    }
  }
  if(nav.journeyJournal){
    const open=footerButton("Open Journey Journal","book-open");
    open.title="Open the saved Journey Journal and recovery record";
    open.addEventListener("click",()=>void nav.journeyJournal.sheet?.render(true));
    row.appendChild(open);
  }
  if(nav.result?.status==="ok"){
    const phase=nav.travelSession?.phase;
    if(phase==="rest-choice"){
      const rules=nav.travelSession.schedule.rules;
      for(const [action,label,icon,title] of [
        ["overnight","Overnight Camp ("+rules.overnightHours+"h)","campground",
          "Camp overnight and reset the daily travel allowance"],
        ["long","Long Rest ("+rules.longRestHours+"h)","bed",
          "Record a long rest; Actor resources remain unchanged"],
        ["short","Short Rest ("+rules.shortRestHours+"h)","mug-hot",
          "Add a short rest without resetting daily travel hours"],
        ["continue","Continue March","person-walking",
          "Continue one more travel hour; adjudicate any Constitution saves manually"]]){
        const button=footerButton(label,icon);
        button.title=title;
        button.disabled=action==="continue"&&nav.travelSession.schedule.todayHours>=24-1e-7;
        button.addEventListener("click",()=>nav.chooseDailyTravelBreak(action));
        row.appendChild(button);
      }
    }else{
      const moveLabel=phase==="paused"?"Resume Travel":phase==="moving"?
        "Pause Travel":phase==="pausing"?"Pausing…":phase==="ending"?"Ending Journey…":
        phase==="rest-applying"?"Recording Break…":assistedLegReady?
          "Travel to "+transferPlan.legs[0].arrivalCheckpoint.name:"Travel Route";
      const moveIcon=phase==="moving"?"pause":phase==="pausing"||
        phase==="ending"||phase==="rest-applying"?"hourglass-half":"play";
      const move=footerButton(moveLabel,moveIcon);
      move.disabled=nav.journalStarting||(!nav.travelSession&&
        (!methodAssessment?.guided&&!assistedLegReady||repeatingCheckpoint))||
        phase==="ending"||phase==="pausing"||phase==="rest-applying"||phase==="rest-error";
      move.title=phase==="paused"?"Resume the paused journey":phase==="moving"?
        "Pause after the current short road stretch":moveLabel;
      move.addEventListener("click",()=>{
        if(nav.travelSession){
          const ok=nav.travelSession.phase==="paused"?nav.resumeGuidedTravel():
            nav.pauseGuidedTravel();
          if(!ok)globalThis.ui.notifications.warn("The token could not change its movement state yet.");
          return;
        }
        void nav.startGuidedTravel().catch(error=>{
          nav.travelNotice=error.message||String(error);
          globalThis.ui.notifications.error(nav.travelNotice);
          if(nav.active)void nav.render(true);
        });
      });
      row.appendChild(move);
    }
    if(nav.travelSession?.phase==="paused"){
      const session=nav.travelSession,rules=session.schedule.rules;
      for(const [action,label,icon,hours] of [
        ["short","Short Rest","mug-hot",rules.shortRestHours],
        ["long","Long Rest","bed",rules.longRestHours],
        ["overnight","Overnight Camp","campground",rules.overnightHours]
      ]){
        const rest=footerButton(label+" ("+hours+"h)",icon);
        rest.title="Record an optional rest at the current paused location; "+
          "Actor resources remain manual and World time follows module settings.";
        rest.disabled=Boolean(session.pendingPassengerRest||
          session.schedule.restEvents>=MAX_GUIDED_REST_EVENTS||
          session.schedule.events.length>=MAX_GUIDED_TRAVEL_EVENTS);
        rest.addEventListener("click",()=>void nav.choosePausedTravelRest(action)
          .catch(error=>globalThis.ui?.notifications?.error?.(
            error.message??String(error))));
        row.appendChild(rest);
      }
    }
    if(nav.travelSession?.transportLeg?.transport?.operation==="continuous"&&
        nav.travelSession.phase==="moving"){
      const session=nav.travelSession;
      for(const [action,label,icon,hours] of [
        ["short","Short Rest Aboard","mug-hot",session.schedule.rules.shortRestHours],
        ["long","Long Rest Aboard","bed",session.schedule.rules.longRestHours]
      ]){
        const underway=footerButton(label+" ("+hours+"h)",icon);
        underway.title="Rest while the vessel continues traveling; World time advances with confirmed movement only.";
        underway.disabled=!canRequestPassengerRest(session.schedule,
          session.pendingPassengerRest,action);
        underway.addEventListener("click",()=>void nav.choosePassengerRest(action)
          .then(approved=>{
            if(!approved)globalThis.ui.notifications.warn("A passenger rest is already underway.");
          }).catch(error=>globalThis.ui.notifications.warn(error.message??String(error))));
        row.appendChild(underway);
      }
    }
    if(nav.travelSession){
      const end=footerButton("End Journey","flag");
      end.disabled=["ending","rest-applying"].includes(nav.travelSession.phase);
      end.title="Stop this journey permanently at the token's current position";
      end.addEventListener("click",()=>{
        if(!nav.stopGuidedTravel())globalThis.ui.notifications.warn("The journey could not be ended.");
      });
      row.appendChild(end);
    }
  }
  return row;
}
