/**
 * Pure DOM controls for one-GM-Journey visual playback timing.
 * These callbacks set only an unapproved, per-trip preference. They do not
 * mutate World settings, native movement, Actor resources or Journal state.
 */
import {formatPlaybackDuration,NAVIGATION_PLAYBACK_MIN,
  NAVIGATION_PLAYBACK_MAX} from "./navigation-playback.js";
import {projectNavigationRealPlayback,secondsPerHourForTargetMinutes}
  from "./navigation-playback-plan.js";

const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};

export function renderNavigationPlaybackControls({model,secondsPerHour,
  disabled=false,onChange,onError}={}){
  const info=projectNavigationRealPlayback({...model,secondsPerHour});
  const root=el("section");
  root.className="atlas-navigation-playback";
  root.style.cssText="display:grid;gap:.5rem;border:1px solid var(--color-border-light-tertiary,#555);border-radius:9px;padding:.75rem;";
  root.appendChild(el("strong","Playback speed · this trip only"));
  const note=el("small",
    "Controls real animation and visual resting pauses only. In-game time, "+
    "party speed and approved rests do not change.");
  note.style.opacity=".75";
  root.appendChild(note);
  const pace=el("label");
  pace.style.cssText="display:grid;gap:.25rem;font-size:.85em;";
  const value=el("strong",secondsPerHour.toFixed(2)+
    " real seconds per in-game hour");
  const slider=el("input");
  slider.type="range";slider.min=String(NAVIGATION_PLAYBACK_MIN);
  slider.max=String(NAVIGATION_PLAYBACK_MAX);
  slider.step=".001";slider.value=String(secondsPerHour);
  slider.disabled=disabled;
  slider.setAttribute?.("aria-label","Animation seconds per in-game travel hour");
  slider.style.cssText="width:100%;accent-color:#3eaf93;";
  slider.addEventListener("change",()=>{
    if(!disabled)onChange?.(Number(slider.value));
  });
  pace.append(value,slider);root.appendChild(pace);

  const targetRow=el("div");
  targetRow.style.cssText="display:flex;align-items:end;gap:.45rem;flex-wrap:wrap;";
  const targetLabel=el("label","Target real trip duration (minutes)");
  targetLabel.style.cssText="display:grid;gap:.2rem;flex:1;min-width:10rem;font-size:.8em;";
  const target=el("input");
  target.type="number";target.min="0.1";target.max="120";target.step=".1";
  target.value=(info.fullOvernightSeconds/60).toFixed(1);
  target.disabled=disabled;
  target.style.width="100%";
  targetLabel.appendChild(target);
  const convert=el("button","Set duration");
  convert.type="button";convert.disabled=disabled;
  convert.title="Calculate seconds per in-game hour for the requested total";
  convert.addEventListener("click",()=>{
    if(disabled)return;
    try{
      const next=secondsPerHourForTargetMinutes(model,Number(target.value));
      onChange?.(next);
    }catch(error){onError?.(error.message??String(error));}
  });
  targetRow.append(targetLabel,convert);root.appendChild(targetRow);

  const summary=el("div");
  summary.style.cssText="font-size:.8em;line-height:1.4;";
  summary.appendChild(el("div","Moving animation: "+
    formatPlaybackDuration(info.movementSeconds)));
  summary.appendChild(el("div","Expected full trip with "+
    info.stops+" overnight stop(s): "+
    formatPlaybackDuration(info.fullOvernightSeconds)+
    " (each overnight: "+formatPlaybackDuration(info.eachOvernightSeconds)+")"));
  summary.appendChild(el("div","If the GM chooses 8h Long Rests instead: "+
    formatPlaybackDuration(info.fullLongRestSeconds)+
    " total (each rest: "+formatPlaybackDuration(info.eachLongRestSeconds)+")"));
  root.appendChild(summary);
  if(info.capped){
    const cap=el("small",
      "Movement animation is capped at 10 real minutes by Atlas. "+
      "Rest holds remain separate; changing the target may not produce exact timing.");
    cap.style.opacity=".75";root.appendChild(cap);
  }
  const caveat=el("small",
    "Estimates assume an overnight decision after each full travel day. "+
    "The GM can choose Long Rest, camp, short rest or continue; actual "+
    "visual duration changes with approved choices and any pauses.");
  caveat.style.opacity=".75";root.appendChild(caveat);
  return root;
}
