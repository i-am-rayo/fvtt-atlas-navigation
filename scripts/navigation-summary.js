/**
 * Read-only Navigation summary rendering.
 *
 * The controller supplies already resolved text/metrics and owns every
 * route calculation, World-time/Journal write, and token movement. These
 * views never read Foundry documents, register actions or commit changes.
 */
const el=(tag,content)=>{
  const node=document.createElement(tag);
  if(content!==undefined)node.textContent=content;
  return node;
};

/**
 * @param {object} model
 * @param {{label:string,value:string}[]} model.metrics Already formatted values.
 * @param {string|null} model.explanation
 * @param {number|null} model.progressPercent Null hides Journey progress.
 * @returns {{nodes:HTMLElement[],progressUI:object|null,timeUI:object|null}}
 */
export function renderNavigationSummaryMetrics({
  metrics,explanation=null,progressPercent=null
}){
  const summary=el("div");
  summary.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.65rem;";
  for(const {label,value} of metrics){
    const card=el("div");
    card.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);border-radius:8px;padding:.75rem;min-width:0;";
    const small=el("div",label);
    small.style.cssText="font-size:.8em;opacity:.75;margin-bottom:.25rem;";
    const big=el("strong",value);
    big.style.cssText="font-size:1.15em;";
    card.append(small,big);
    summary.appendChild(card);
  }
  const nodes=[summary];
  if(explanation!==null){
    const note=el("p",explanation);
    note.style.cssText="margin:0;font-size:.8em;opacity:.75;";
    nodes.push(note);
  }
  if(progressPercent===null)return {nodes,progressUI:null,timeUI:null};
  const progressWrap=el("div");
  progressWrap.style.cssText="display:flex;flex-direction:column;gap:.35rem;padding:.45rem 0;";
  const progressHeader=el("div");
  progressHeader.style.cssText="display:flex;justify-content:space-between;gap:1rem;font-size:.85em;";
  const progressTitle=el("strong","Journey progress");
  const progressLabel=el("span",String(Math.floor(progressPercent))+"% complete");
  const progressBar=el("progress");
  progressBar.max=100;
  progressBar.value=progressPercent;
  progressBar.title="Journey progress";
  progressBar.setAttribute?.("aria-label","Journey progress");
  progressBar.style.cssText="width:100%;height:.75rem;accent-color:#16b9a1;";
  progressHeader.append(progressTitle,progressLabel);
  progressWrap.append(progressHeader,progressBar);
  const status=el("div");
  status.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;font-size:.78em;";
  const timePart=label=>{
    const section=el("div");
    const heading=el("div",label);
    heading.style.cssText="opacity:.7;margin-bottom:.15rem;";
    const value=el("strong","—");
    section.append(heading,value);
    status.appendChild(section);
    return value;
  };
  const timeUI={moving:timePart("Travelled (moving)"),
    elapsed:timePart("Elapsed (with rests)"),
    eta:timePart("ETA remaining (in-game)")};
  progressWrap.appendChild(status);
  nodes.push(progressWrap);
  return {nodes,progressUI:{bar:progressBar,label:progressLabel},timeUI};
}

/**
 * Status lines beneath the GM's rest-choice prompt. Null optional entries
 * are omitted, preserving the existing line order and source text.
 * @returns {{nodes:HTMLElement[],worldTimeUI:HTMLElement|null}}
 */
export function renderNavigationSummaryStatus({
  clockHint,worldTimeStatus=null,speedSource=null,
  playbackLabel=null,terrainCostLabel=null
}){
  const hint=el("p",clockHint);
  hint.style.cssText="margin:0;font-size:.77em;opacity:.7;";
  const nodes=[hint];
  let worldTimeUI=null;
  if(worldTimeStatus!==null){
    worldTimeUI=el("p",worldTimeStatus);
    worldTimeUI.style.cssText="margin:0;font-size:.85em;font-weight:600;";
    nodes.push(worldTimeUI);
  }
  if(speedSource!==null){
    const speed=el("p",speedSource);
    speed.style.cssText="margin:0;font-size:.85em;opacity:.85;";
    nodes.push(speed);
  }
  if(playbackLabel!==null){
    const playback=el("p",playbackLabel);
    playback.style.cssText="margin:0;font-size:.8em;opacity:.75;";
    nodes.push(playback);
  }
  if(terrainCostLabel!==null){
    const cost=el("p",terrainCostLabel);
    cost.style.cssText="margin:0;font-size:.85em;";
    nodes.push(cost);
  }
  return {nodes,worldTimeUI};
}
