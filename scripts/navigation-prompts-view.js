/**
 * Read-only GM journey decision notices.
 *
 * The Navigation controller decides whether a notice is appropriate and
 * resolves its text. This renderer neither reads Foundry state nor registers
 * callbacks, preserving the controller/footer's approval boundary.
 */
const el=(tag,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  return node;
};

export function renderRepeatedCheckpointNotice(checkpointName){
  const advisory=el("p","Already at "+checkpointName+
    ". A second voyage to that same checkpoint is blocked. "+
    "Choose a different onward destination or finish the Journey at the port.");
  advisory.style.cssText="padding:.5rem;border:1px solid #b18b54;"+
    "border-radius:6px;font-size:.83em;";
  return advisory;
}

export function renderCheckpointArrivalPrompt({checkpointName,atDestination=false}){
  const choice=el("section");
  choice.style.cssText="padding:.8rem;border:2px solid #caa15c;border-radius:8px;display:grid;gap:.4rem;";
  choice.append(el("h3","Checkpoint reached · "+checkpointName));
  choice.append(el("p",atDestination?
    "The party has reached its original destination. Complete this Journey now or stop and replan. Atlas will not create another short leg back to the same checkpoint.":
    "The previous leg is confirmed in the Journey Journal. "+
    "Choose to stop and replan or to continue with a new method. "+
    "No further token movement, booking or payment occurs until you confirm."));
  return choice;
}

export function renderDailyTravelPrompt(options){
  const prompt=el("div");
  prompt.style.cssText="padding:.8rem;border:1px solid #d99c46;border-radius:8px;font-size:.85em;display:grid;gap:.3rem;";
  prompt.appendChild(el("strong","Daily travel limit reached — choose how to proceed:"));
  for(const option of options)prompt.appendChild(el("div",option));
  return prompt;
}
