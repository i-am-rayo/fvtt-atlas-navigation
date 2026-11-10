/** Client-only, reversible window focus for Atlas canvas editors.
 * Foundry's public v14 ApplicationV2 registry owns the open windows. Never
 * change a document, a Window's saved position, or an already-minimized app.
 */
let activeFocus=null;

function visibleWindows(excluded){
  const registry=globalThis.foundry?.applications?.instances;
  if(typeof registry?.values!=="function")return [];
  return [...new Set(registry.values())].filter(app=>
    !excluded.has(app)&&app?.rendered===true&&app.hasFrame===true&&
    app.minimized===false&&typeof app.minimize==="function"&&
    typeof app.maximize==="function");
}

/** Share one snapshot across overlapping editor sessions. Release is idempotent;
 * late asynchronous minimizations are awaited before any restoration. */
export function acquireAtlasCanvasEditorFocus({exclude=[]}={}){
  const minimizeVisible=state=>Promise.allSettled(
    visibleWindows(new Set(exclude)).map(async app=>{
      await app.minimize();
      if(app.rendered&&app.minimized)state.changed.push(app);
    }));
  if(!activeFocus){
    const state={holders:0,changed:[],ready:null};
    activeFocus=state;
    // Exclusions matter only to the first editor opening the canvas.
    state.ready=minimizeVisible(state);
  }else if(activeFocus.holders===0){
    // A new editor may open before the previous release's async restoration
    // completes. Refresh its snapshot so newly opened windows are not missed.
    const state=activeFocus;
    state.ready=state.ready.then(()=>minimizeVisible(state));
  }
  const state=activeFocus;
  state.holders++;
  let released=false;
  return ()=>{
    if(released)return Promise.resolve();
    released=true;
    if(--state.holders!==0)return Promise.resolve();
    return state.ready.then(async()=>{
      if(state.holders!==0)return;
      // Only restore windows Atlas actually minimized and which stayed minimized.
      for(const app of state.changed){
        if(state.holders!==0)break;
        if(!app.rendered||!app.minimized)continue;
        try{await app.maximize();}
        catch(error){console.warn("[fvtt-atlas-navigation] Could not restore editor window",error);}
      }
      if(activeFocus===state&&state.holders===0)activeFocus=null;
    });
  };
}
