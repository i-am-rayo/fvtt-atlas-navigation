/**
 * Active Journey visual playback controls. This view never authorizes native
 * movement or a rest, it only requests a verified controller action.
 */
import {renderNavigationPlaybackControls}
  from "./navigation-playback-controls-view.js";

const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};

export function renderNavigationActivePlayback({model,secondsPerHour,
  locked=false,skip=false,onChange,onSkip,onError}={}){
  const root=el("section");
  root.style.cssText="display:grid;gap:.8rem;min-width:0;";
  if(locked){
    const warning=el("p",
      "This is an active continuous native movement. Its playback speed "+
      "cannot change until a new leg is approved.");
    warning.style.cssText="margin:0;font-size:.87em;opacity:.82;";
    root.appendChild(warning);
  }else{
    const note=el("p","Speed changes apply at the next confirmed native "+
      "movement boundary. The current movement animation is not interrupted.");
    note.style.cssText="margin:0;font-size:.87em;opacity:.82;";
    root.appendChild(note);
  }
  if(model&&Number.isFinite(model.travelHours)&&model.travelHours>0)
    root.appendChild(renderNavigationPlaybackControls({
      model,secondsPerHour,disabled:locked,onChange,onError
    }));
  const button=el("button",skip?"Restore animated travel":"Skip remaining visual playback");
  button.type="button";
  button.disabled=locked;
  button.title=skip?
    "Animate future confirmed travel stretches again":
    "Skip only future visual animation and already-confirmed rest holds; "+
      "native movement, walls, World time, Journal and GM rest decisions remain mandatory";
  button.style.cssText="justify-self:start;min-height:2.3rem;";
  button.addEventListener("click",()=>{if(!button.disabled)onSkip?.();});
  root.appendChild(button);
  const help=el("small",skip?
    "Visual skipping is enabled. Every next native move must still "+
    "succeed and every required rest choice still needs GM approval.":
    "Skipping is not teleportation and does not consolidate gameplay rests. "+
    "Native Wall/Region restrictions and the saved Journey remain authoritative.");
  help.style.opacity=".75";
  root.appendChild(help);
  return root;
}
