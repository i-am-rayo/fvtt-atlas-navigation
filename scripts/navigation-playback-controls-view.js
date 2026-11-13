/**
 * Per-Journey visual timing controls. Only presentation callbacks; never
 * updates native Token movement, the Scene, World time or a Journal on render.
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
const asMinutes=seconds=>(seconds/60).toFixed(2);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function renderNavigationPlaybackControls({model,secondsPerHour,
  disabled=false,onChange,onError}={}){
  const info=projectNavigationRealPlayback({...model,secondsPerHour});
  const fastest=projectNavigationRealPlayback({...model,
    secondsPerHour:NAVIGATION_PLAYBACK_MIN});
  const slowest=projectNavigationRealPlayback({...model,
    secondsPerHour:NAVIGATION_PLAYBACK_MAX});
  const root=el("section");
  root.className="atlas-navigation-playback";
  root.style.cssText="display:grid;gap:.65rem;min-width:0;";
  root.appendChild(el("strong","Playback speed · this trip only"));
  const note=el("small","This is visual time only. World-time, "+
    "Actor rests and approved travel pace are unchanged.");
  note.style.opacity=".8";root.appendChild(note);

  const pace=el("label");
  pace.style.cssText="display:grid;gap:.3rem;font-size:.86em;";
  const value=el("strong",secondsPerHour.toFixed(2)+
    " real seconds per in-game hour");
  const slider=el("input");
  slider.type="range";slider.min=String(NAVIGATION_PLAYBACK_MIN);
  slider.max=String(NAVIGATION_PLAYBACK_MAX);
  slider.step=".01";slider.value=String(secondsPerHour);
  slider.disabled=disabled;
  slider.setAttribute?.("aria-label","Animation seconds per in-game travel hour");
  slider.style.cssText="width:100%;accent-color:#3eaf93;";
  slider.addEventListener("input",()=>{
    value.textContent=Number(slider.value).toFixed(2)+
      " real seconds per in-game hour";
  });
  slider.addEventListener("change",()=>{
    if(!disabled)onChange?.(Number(slider.value));
  });
  pace.append(value,slider);root.appendChild(pace);

  const eligible=fastest.fullLongRestSeconds<=360*60;
  const minMinutes=fastest.fullLongRestSeconds/60;
  const maxMinutes=Math.min(360,slowest.fullLongRestSeconds/60);
  const targetSection=el("label");
  targetSection.style.cssText="display:grid;gap:.3rem;font-size:.86em;";
  const targetTitle=el("strong","Target real trip duration (including "+(model.longRestHours??8)+"h Long Rests)");
  const targetOutput=el("output",formatPlaybackDuration(info.fullLongRestSeconds));
  const target=el("input");
  target.type="range";target.min=String(minMinutes);
  target.max=String(Math.max(minMinutes,maxMinutes));
  target.step="any";
  target.value=String(clamp(info.fullLongRestSeconds/60,minMinutes,
    Math.max(minMinutes,maxMinutes)));
  target.disabled=disabled||!eligible||maxMinutes<=minMinutes;
  target.setAttribute?.("aria-label","Target real trip duration in minutes");
  target.style.cssText="width:100%;accent-color:#3eaf93;";
  target.addEventListener("input",()=>{
    targetOutput.textContent=formatPlaybackDuration(Number(target.value)*60);
  });
  target.addEventListener("change",()=>{
    if(target.disabled)return;
    try{
      const next=secondsPerHourForTargetMinutes(model,Number(target.value));
      onChange?.(next);
    }catch(error){onError?.(error.message??String(error));}
  });
  targetSection.append(targetTitle,targetOutput,target);
  root.append(targetSection);
  const range=el("small",eligible?
    "Available timing: "+formatPlaybackDuration(fastest.fullLongRestSeconds)+
      " – "+formatPlaybackDuration(maxMinutes*60)+
      " (30 seconds/hour maximum).":
    "For this route, even the fastest supported playback exceeds 6 real hours.");
  range.style.opacity=".8";root.appendChild(range);

  const summary=el("div");
  summary.style.cssText="font-size:.86em;line-height:1.5;";
  summary.appendChild(el("div","Moving animation: "+
    formatPlaybackDuration(info.movementSeconds)));
  summary.appendChild(el("div","Trip with "+info.stops+" planned "+(model.longRestHours??8)+"h Long Rest(s): "+
    formatPlaybackDuration(info.fullLongRestSeconds)+
    " · each: "+formatPlaybackDuration(info.eachLongRestSeconds)));
  summary.appendChild(el("div","With "+(model.overnightHours??16)+"h overnight stops instead: "+
    formatPlaybackDuration(info.fullOvernightSeconds)+
    " · each: "+formatPlaybackDuration(info.eachOvernightSeconds)));
  root.appendChild(summary);
  if(info.capped){
    const cap=el("small","Token animation retains the existing 10-minute "+
      "movement cap. This target is an estimate; extra GM pauses change the total.");
    cap.style.opacity=".75";root.appendChild(cap);
  }
  const caveat=el("small","Only actual GM-approved rest choices determine "+
    "World time. The per-trip slider never automatically takes a Long Rest.");
  caveat.style.opacity=".75";root.appendChild(caveat);
  return root;
}
