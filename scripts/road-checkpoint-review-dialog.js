/**
 * Foundry v14 GM-only review of prospective Road/Checkpoint graph attachment.
 * DialogV2 serializes HTMLDivElement content; always access the live rendered
 * form rather than pre-render checkbox references. No writes are performed.
 */
export async function reviewIndependentCheckpointConnections({
  roadName,candidates,mode="new"
},{
  Dialog=globalThis.foundry?.applications?.api?.DialogV2,
  doc=globalThis.document
}={}){
  if(!globalThis.game?.user?.isGM)
    throw Error("Only a GM can approve Checkpoint connections.");
  if(!Array.isArray(candidates)||candidates.length>100)
    throw Error("Too many Checkpoints for one Road review.");
  if(!Dialog?.wait||!doc?.createElement)
    throw Error("Foundry v14 Checkpoint review is unavailable.");
  const content=doc.createElement("div"); // DialogV2's HTMLElement root MUST be a plain DIV
  const description=doc.createElement("p");
  description.textContent=(mode==="edited"?"The edited Road ":"The new Road ")+
    roadName+" passes near "+candidates.length+
    " independent Checkpoint(s). Choose saved graph Nodes to connect; " +
    "unselected Checkpoints remain independent.";
  content.appendChild(description);
  for(const candidate of candidates){
    const label=doc.createElement("label");
    label.style.cssText="display:flex;align-items:center;gap:.55rem;margin:.4rem 0;";
    const checkbox=doc.createElement("input");
    checkbox.type="checkbox";checkbox.name="atlasCheckpointConnection";
    checkbox.value=candidate.checkpointId;checkbox.checked=true;
    checkbox.setAttribute("aria-label","Connect "+candidate.name+" to Road");
    const caption=doc.createElement("span");
    caption.textContent=candidate.name+" — "+candidate.distance.toFixed(1)+
      " image px from Road"+(candidate.endpoint?" ("+candidate.endpoint+" endpoint)":"");
    label.append(checkbox,caption);content.appendChild(label);
  }
  const controls=doc.createElement("div");
  controls.style.cssText="display:flex;gap:.5rem;margin-top:.7rem;";
  for(const [choice,label] of [["all","Select All"],["none","Select None"]]){
    const button=doc.createElement("button");
    button.type="button";button.textContent=label;
    button.dataset.atlasCheckpointSelection=choice;
    controls.appendChild(button);
  }
  content.appendChild(controls);
  const warning=doc.createElement("p");
  warning.textContent="Selected Road sections may bend by up to 14 image pixels " +
    "to use saved Checkpoint Nodes. No other Roads, Regions, or Journeys " +
    "are changed by this preview.";
  content.appendChild(warning);
  const answer=await Dialog.wait({
    window:{title:"Atlas — Connect independent Checkpoints?"},
    content,modal:true,rejectClose:false,
    render:(_event,dialog)=>{
      const root=dialog.element;
      for(const control of root.querySelectorAll("[data-atlas-checkpoint-selection]")){
        control.addEventListener("click",event=>{
          event.preventDefault();
          const selected=control.dataset.atlasCheckpointSelection==="all";
          for(const input of root.querySelectorAll('input[name="atlasCheckpointConnection"]'))
            input.checked=selected;
        });
      }
    },
    buttons:[
      {action:"connect",
        label:mode==="edited"?"Save Edits + Selected Connections":"Create Road + Selected Connections",
        callback:(_event,button)=>Array.from(
          button.form.querySelectorAll('input[name="atlasCheckpointConnection"]:checked'),
          input=>input.value)},
      {action:"none",
        label:mode==="edited"?"Save Edits Without Connections":"Create Road Without Connections"},
      {action:"cancel",label:"Return to Road Draft",default:true}
    ]
  });
  if(answer==="none")return [];
  if(!Array.isArray(answer))return null;
  const eligible=new Set(candidates.map(c=>c.checkpointId));
  if(answer.length>eligible.size||new Set(answer).size!==answer.length||
     answer.some(id=>!eligible.has(id)))
    throw Error("Invalid Checkpoint selection; restart Road review.");
  return answer;
}
