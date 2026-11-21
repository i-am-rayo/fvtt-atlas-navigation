/** Native keyboard- and pointer-accessible Journey party draft.
 * Render callbacks change transient planning state, never World or Actor data.
 */
const el=(tag,text)=>{const n=document.createElement(tag);
  if(text!==undefined)n.textContent=String(text);return n;};
const css=(node,style)=>{node.style.cssText=style;return node;};
const icon=method=>method.key==="owned|walking"?"🚶":
  /horse|pony|camel|mount/i.test(method.name)?"🐎":
  /ship|boat|barge/i.test(method.name)?"⛵":"🛒";

/** A single method uses checkboxes; multiple methods expose drag destinations
 * plus a compact per-person keyboard alternative. All names appear once.
 */
export function renderNavigationTravelRoster({travelers=[],selectedIds=[],
  methods=[],assignments={},units={},disabled=false,previewOnly=false,
  onInclude,onAssign,onUnits}={}){
  const root=css(el("section"),"display:grid;gap:.55rem;min-width:0;");
  root.className="atlas-navigation-traveler-deck";
  const selected=new Set(selectedIds);
  const active=travelers.filter(t=>selected.has(t.id));
  const multiple=methods.length>1;
  const title=el("h3",multiple?"3 · Who goes where?":"3 · Who is going?");
  title.style.cssText="margin:.2rem 0 0;font-size:1em;";
  root.append(title);
  const status=el("small",active.length+"/"+travelers.length+
    " travelers · "+active.reduce((n,t)=>n+t.seats,0)+" seats"+
    (previewOnly?" · Preview only":""));
  status.style.cssText="opacity:.8;";
  root.append(status);

  if(!multiple){
    const grid=css(el("div"),"display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.35rem;");
    for(const t of travelers){
      const label=css(el("label"),"display:flex;align-items:center;gap:.4rem;"+
        "padding:.45rem .6rem;border:1px solid var(--color-border-light-tertiary,#555);"+
        "border-radius:6px;cursor:pointer;min-width:0;");
      const check=el("input");check.type="checkbox";check.checked=selected.has(t.id);
      check.disabled=disabled;check.setAttribute?.("aria-label","Travel with "+t.name);
      check.addEventListener("change",()=>onInclude?.(t.id,check.checked));
      const name=el("span",t.name+(t.seats===0?" · no seat":""));
      name.style.cssText="min-width:0;overflow-wrap:anywhere;font-size:.88em;";
      label.append(check,name);grid.append(label);
    }
    root.append(grid);
  }else{
    const board=css(el("div"),"display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.5rem;");
    const names=new Map(travelers.map(t=>[t.id,t]));
    const keys=methods.map(m=>m.key);
    const card=t=>{
      const pill=css(el("div"),"display:flex;align-items:center;gap:.35rem;"+
        "padding:.4rem .45rem;border-radius:5px;"+
        "border:1px solid var(--color-border-light-tertiary,#555);"+
        "background:var(--color-bg-option,#23212b);min-width:0;");
      pill.draggable=!disabled;
      pill.setAttribute?.("aria-label",t.name+", draggable traveler");
      pill.addEventListener("dragstart",event=>{
        if(disabled){event.preventDefault();return;}
        event.dataTransfer?.setData("text/plain",t.id);
        if(event.dataTransfer)event.dataTransfer.effectAllowed="move";
      });
      const name=css(el("span",t.name),"flex:1;min-width:0;overflow-wrap:anywhere;font-size:.83em;");
      const move=el("button","↔");
      move.type="button";move.disabled=disabled;
      move.title="Move "+t.name;
      move.setAttribute?.("aria-label","Move "+t.name+" to a travel method");
      move.style.cssText="min-width:1.6rem;padding:.1rem .25rem;";
      const chooser=el("select");chooser.hidden=true;
      chooser.setAttribute?.("aria-label","Destination method for "+t.name);
      for(const method of methods){
        const opt=el("option",method.name);opt.value=method.key;chooser.append(opt);
      }
      const stay=el("option","Stay behind");stay.value="";chooser.append(stay);
      chooser.value=selected.has(t.id)?assignments[t.id]??keys[0]:"";
      chooser.disabled=disabled;
      chooser.addEventListener("change",()=>{
        chooser.hidden=true;
        if(chooser.value)onAssign?.(t.id,chooser.value);
        else onInclude?.(t.id,false);
      });
      move.addEventListener("click",()=>{
        chooser.hidden=!chooser.hidden;
        if(!chooser.hidden)chooser.focus?.();
      });
      pill.append(name,move,chooser);
      return pill;
    };
    for(const method of methods){
      const assigned=active.filter(t=>assignments[t.id]===method.key);
      const used=assigned.reduce((n,t)=>n+t.seats,0);
      const limit=method.capacity??null;
      const column=css(el("div"),"display:grid;align-content:start;gap:.3rem;"+
        "min-width:0;min-height:5.6rem;border:1px solid var(--color-border-light-tertiary,#555);"+
        "border-radius:8px;padding:.5rem;");
      column.className="atlas-navigation-travel-column";
      column.setAttribute?.("aria-label",method.name+" travelers");
      const header=css(el("strong",icon(method)+" "+method.name),
        "font-size:.84em;overflow-wrap:anywhere;");
      const info=el("small",(method.speedLabel??"")+
        (limit===null?"":" · "+used+"/"+limit+" seats"));
      info.style.cssText="opacity:.8;font-size:.76em;"+
        (limit!==null&&used>limit?"color:var(--color-text-warning,#d7a85a);":"");
      column.append(header,info);
      if(method.arrangement==="hire"){
        const quantity=css(el("label"),"display:flex;gap:.3rem;align-items:center;font-size:.75em;");
        quantity.append(el("span","Units"));
        const input=el("input");input.type="number";input.step="1";input.min="1";
        input.max=String(method.available===null?100:method.available);
        input.value=String(units[method.key]??method.minimumUnits??1);
        input.disabled=disabled;input.style.cssText="width:3.5rem;";
        input.setAttribute?.("aria-label","Units of "+method.name);
        input.addEventListener("change",()=>onUnits?.(method.key,Number(input.value)));
        quantity.append(input);column.append(quantity);
      }
      const landing=css(el("div"),"display:grid;gap:.25rem;min-height:1.9rem;");
      landing.setAttribute?.("aria-label","Drop travelers into "+method.name);
      for(const t of assigned)landing.append(card(t));
      if(!assigned.length)landing.append(css(el("small","Drop here"),
        "opacity:.55;align-self:center;text-align:center;"));
      column.addEventListener("dragover",event=>{
        if(disabled)return;event.preventDefault();
        if(event.dataTransfer)event.dataTransfer.dropEffect="move";
      });
      column.addEventListener("drop",event=>{
        event.preventDefault();
        const t=event.dataTransfer?.getData("text/plain");
        if(!disabled&&names.has(t))onAssign?.(t,method.key);
      });
      column.append(landing);board.append(column);
    }
    root.append(board);
    const waiting=travelers.filter(t=>!selected.has(t.id));
    if(waiting.length){
      const stay=css(el("div"),"display:grid;gap:.3rem;");
      stay.append(el("small","Staying behind"));
      const chips=css(el("div"),"display:flex;flex-wrap:wrap;gap:.35rem;");
      for(const t of waiting){
        const button=el("button","+ "+t.name);
        button.type="button";button.disabled=disabled;
        button.title="Add "+t.name+" to the traveling party";
        button.addEventListener("click",()=>onInclude?.(t.id,true));
        chips.append(button);
      }
      stay.append(chips);root.append(stay);
    }
  }
  if(previewOnly){
    const hint=el("small","Subset preview only · Assign a separate Group explorer to travel.");
    hint.style.cssText="color:var(--color-text-warning,#d7a85a);";
    root.append(hint);
  }
  return root;
}

/** Show a pace choice only when selected travel methods actually differ. */
export function renderNavigationPaceChoice({methods=[],selected=null,unit="mph",
  disabled=false,maxSpeed=null,onPace}={}){
  if(new Set(methods.map(m=>m.speed.toFixed(5))).size<2)return null;
  const root=css(el("section"),"display:grid;gap:.35rem;");
  root.className="atlas-navigation-pace-choice";
  root.append(css(el("h3","4 · How fast?"),"margin:.25rem 0 0;font-size:1em;"));
  const speeds=methods.map(m=>m.speed),slowest=Math.min(...speeds);
  // Keep the exact converted value for the callback. Rounding kph to
  // display precision can otherwise accidentally exceed a 4-mph vehicle.
  const faster=speeds.filter(s=>s>slowest+1e-7)
    .filter(s=>maxSpeed===null||s<=maxSpeed+1e-7)
    .filter((s,i,all)=>all.findIndex(n=>Math.abs(n-s)<1e-7)===i);
  const choices=css(el("div"),"display:flex;flex-wrap:wrap;gap:.4rem;");
  const opt=(value,name,checked)=>{
    const label=css(el("label"),"display:flex;align-items:center;gap:.25rem;"+
      "border:1px solid var(--color-border-light-tertiary,#555);"+
      "border-radius:6px;padding:.35rem .5rem;cursor:pointer;");
    const radio=el("input");radio.type="radio";radio.name="atlas-travel-shared-pace";
    radio.checked=checked;radio.disabled=disabled;
    radio.addEventListener("change",()=>{if(radio.checked)onPace?.(value);});
    label.append(radio,el("span",name));choices.append(label);
  };
  const display=n=>n.toFixed(2)+" "+unit;
  opt(null,display(slowest)+" · Recommended",selected===null);
  for(const fast of faster)opt(fast,display(fast)+" · GM",selected!==null&&
    Math.abs(selected-fast)<1e-5);
  const customSelected=selected!==null&&
    !faster.some(fast=>Math.abs(selected-fast)<1e-5);
  const custom=css(el("label"),"display:flex;gap:.3rem;align-items:center;");
  const choose=el("input");choose.type="radio";choose.name="atlas-travel-shared-pace";
  choose.checked=customSelected;choose.disabled=disabled;
  const field=el("input");field.type="number";field.step="any";field.min="0.01";
  field.value=customSelected?String(selected):"";
  field.disabled=disabled;field.style.cssText="width:5.7rem;";
  field.setAttribute?.("aria-label","Custom journey speed in "+unit);
  field.addEventListener("change",()=>onPace?.(Number(field.value)));
  choose.addEventListener("change",()=>{
    if(choose.checked)onPace?.(Number(field.value)||slowest);
  });
  custom.append(choose,el("span","Custom"),field,el("span",unit));
  choices.append(custom);root.append(choices);
  return root;
}
