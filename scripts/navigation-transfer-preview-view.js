/**
 * Read-only presentation of guided transfer-leg context and future-leg preview.
 *
 * The GM controller still decides which leg is authorized, computes costs,
 * validates methods and owns every transport input and booking/movement action.
 * The later legs shown here are never committed by rendering this view.
 */
const el=(tag,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  return node;
};

export function createNavigationTransferSection({recovered=false}={}){
  const section=el("section");
  section.style.cssText="display:grid;gap:.65rem;border:1px solid var(--color-border-light-tertiary,#777);border-radius:8px;padding:.8rem;";
  section.append(el("h3","Current journey leg"));
  const note=el("small",recovered?
    "Recovered voyage: the previously approved transportation remains assigned. No second fare or boarding is applied. Atlas will continue from the last confirmed token position to the saved checkpoint.":
    "Choose transportation for the stretch ahead. At the next checkpoint the party may stop, reconsider its destination, or choose a new method. Future legs are only a GM preview; no booking, payment or movement occurs here.");
  note.style.cssText="opacity:.8;line-height:1.45;";
  section.append(note);
  return section;
}

export function createNavigationTransferLegCard(leg){
  const card=el("article");
  card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:7px;padding:.7rem;display:grid;gap:.55rem;";
  const place=leg.departureCheckpoint?.name??"Starting point";
  const finish=leg.arrivalCheckpoint?.name??(leg.surface==="unspecified"?
    "Unclassified approach":"Next transfer or destination");
  const surface=leg.surface==="unspecified"?"UNCLASSIFIED":leg.surface.toUpperCase();
  card.append(el("strong","Leg 1 · "+surface+" · "+place+" → "+finish));
  return card;
}

export function renderNavigationTransferRoadNames(roadNames){
  const road=el("small",roadNames.join(", ")||"Surface not authored");
  road.style.opacity=".75";
  return road;
}

export function renderNavigationTransferLegOutcome({estimateLabel=null,narration=[],
  errors=[],arrivalCheckpointName=null}={}){
  const nodes=[];
  if(estimateLabel!==null){
    const amounts=el("small",estimateLabel);
    amounts.style.opacity=".85";
    nodes.push(amounts);
  }
  for(const line of narration){
    const event=el("div",line);
    event.style.cssText="font-size:.86em;line-height:1.35;";
    nodes.push(event);
  }
  for(const error of errors){
    const warning=el("small",error);
    warning.style.cssText="color:#e1a763;line-height:1.4;";
    nodes.push(warning);
  }
  if(arrivalCheckpointName!==null){
    const choice=el("small","At "+arrivalCheckpointName+
      ": stop and replan, or refresh the party's location and decide how to continue. Guided checkpoint arrival choices follow in beta.7.");
    choice.style.cssText="padding:.45rem;border-left:3px solid #b18b54;line-height:1.4;";
    nodes.push(choice);
  }
  return nodes;
}

export function renderNavigationLaterLegsPreview(laterLegs=[]){
  if(!laterLegs.length)return null;
  const future=el("details");
  const title=el("summary","GM preview · "+laterLegs.length+
    " possible later leg(s) (no decisions committed)");
  title.style.cssText="cursor:pointer;font-weight:600;";
  future.append(title);
  const help=el("small","These are tentative road segments, not a fixed party itinerary. Move or refresh the party token at the actual checkpoint to choose the next method.");
  help.style.cssText="display:block;margin:.4rem 0;opacity:.8;";
  future.append(help);
  for(const next of laterLegs){
    const text=el("div","Leg "+(next.index+1)+" · "+
      (next.surface==="unspecified"?"Unclassified":next.surface)+
      " · "+(next.departureCheckpoint?.name??"Unconfirmed transfer")+
      " → "+(next.arrivalCheckpoint?.name??"Destination or unknown")+
      " · "+(next.roadNames.join(", ")||"Unclassified approach"));
    text.style.cssText="padding:.45rem 0;border-top:1px solid var(--color-border-light-tertiary,#555);font-size:.85em;";
    future.append(text);
  }
  return future;
}
