/** Modeless GM canvas authoring surface. Only Save commits a RegionDocument;
 * pointer input, keyboard Undo, brush strokes and previews are transient. */
import {paintGridCells,MAX_TERRITORY_NODES} from "./territory-authoring-model.js";
import {smoothClosedBoundary} from "./region-boundary-model.js";
import {acquireAtlasCanvasEditorFocus} from "./atlas-canvas-editor-focus.js";
import {acquireAtlasTerritoryEditorFog} from "./atlas-territory-editor-fog.js";

const el=(tag,label)=>{const result=document.createElement(tag);
  if(label!==undefined)result.textContent=label;return result;};
const copy=v=>structuredClone(v);
function edgeDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}

/** Foundry v14 canvas instances may expose either the modern Graphics shape
 * builder or the legacy lineStyle/draw* surface (as elsewhere in Atlas).
 * Keep preview compatibility entirely in Canvas: native Shapes are untouched. */
function drawOutline(graphics,points,zoom=1){
  if(typeof graphics.moveTo!=="function"||typeof graphics.lineTo!=="function")
    throw Error("Foundry Canvas cannot draw Territory boundary lines.");
  const modern=typeof graphics.stroke==="function";
  if(!modern&&typeof graphics.lineStyle!=="function")
    throw Error("Foundry Canvas does not support Territory outline styling.");
  // The editor lives in the interface group above Atlas's PrimaryCanvas fog.
  // A dark halo and light core remain legible over revealed *and* masked tiles.
  for(const [width,color] of [[8,0x121826],[3.5,0xffe3a2]]){
    const pixelWidth=Math.min(40,width/Math.max(0.2,zoom));
    if(!modern)graphics.lineStyle(pixelWidth,color,1);
    graphics.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)graphics.lineTo(points[i].x,points[i].y);
    if(points.length>=3)graphics.lineTo(points[0].x,points[0].y);
    if(modern)graphics.stroke({width:pixelWidth,color,alpha:1});
  }
}

function drawControlNode(graphics,point,selected,zoom=1){
  const color=selected?0xffc347:0x75f0f4;
  const radius=Math.min(40,(selected?11:9)/Math.max(0.2,zoom));
  const halo=Math.min(48,(selected?15:13)/Math.max(0.2,zoom));
  if(typeof graphics.circle==="function"&&typeof graphics.fill==="function"){
    graphics.circle(point.x,point.y,halo).fill({color:0x121826,alpha:1});
    graphics.circle(point.x,point.y,radius).fill({color,alpha:1});
  }else if(typeof graphics.beginFill==="function"&&
      typeof graphics.drawCircle==="function"&&typeof graphics.endFill==="function"){
    graphics.beginFill(0x121826,1);
    graphics.drawCircle(point.x,point.y,halo);
    graphics.endFill();
    graphics.beginFill(color,1);
    graphics.drawCircle(point.x,point.y,radius);
    graphics.endFill();
  }else throw Error("Foundry Canvas cannot draw Territory control nodes.");
}

function drawGridSpace(graphics,points){
  if(typeof graphics.poly==="function"&&typeof graphics.fill==="function"){
    graphics.poly(points).fill({color:0x43bca2,alpha:0.4});
  }else if(typeof graphics.beginFill==="function"&&
      typeof graphics.drawPolygon==="function"&&typeof graphics.endFill==="function"){
    graphics.beginFill(0x43bca2,0.4);
    graphics.drawPolygon(points);
    graphics.endFill();
  }else throw Error("Foundry Canvas cannot draw Territory grid cells.");
}

/** Transient brush footprint; the preview cannot modify draft/native cells. */
function drawBrushFootprint(graphics,points,erase,zoom){
  const color=erase?0xff7992:0x8df8e6;
  const width=2.8/Math.max(.2,zoom);
  if(typeof graphics.poly==="function"&&typeof graphics.fill==="function"&&
      typeof graphics.stroke==="function"){
    graphics.poly(points).fill({color,alpha:.16});
    graphics.poly(points).stroke({width:width+2.5/Math.max(.2,zoom),
      color:0x101321,alpha:1,join:"round"});
    graphics.poly(points).stroke({width,color,alpha:1,join:"round"});
  }else if(typeof graphics.lineStyle==="function"&&
      typeof graphics.beginFill==="function"&&typeof graphics.drawPolygon==="function"&&
      typeof graphics.moveTo==="function"&&typeof graphics.lineTo==="function"){
    graphics.beginFill(color,.16);graphics.drawPolygon(points);graphics.endFill();
    for(const [weight,strokeColor] of [[width+2.5/Math.max(.2,zoom),0x101321],
      [width,color]]){
      graphics.lineStyle(weight,strokeColor,1);
      graphics.moveTo(points[0],points[1]);
      for(let i=2;i<points.length;i+=2)graphics.lineTo(points[i],points[i+1]);
      graphics.lineTo(points[0],points[1]);
    }
  }else throw Error("Foundry Canvas cannot draw Territory brush footprints.");
}

/** Explicit, GM-only ownership review. These colors are transient canvas
 * feedback; the Region Documents and the normal player overlay are untouched. */
function drawOwnershipFootprint(graphics,points,status,zoom){
  const colors={contested:0xff7187,peer:0xffc66d,
    unclaimed:0x79d4fa,removed:0xc5a2f4};
  const color=colors[status];
  if(color===undefined)return;
  const width=2.5/Math.max(.2,zoom);
  if(typeof graphics.poly==="function"&&typeof graphics.fill==="function"&&
      typeof graphics.stroke==="function"){
    graphics.poly(points).fill({color,alpha:.6});
    graphics.poly(points).stroke({width,color,alpha:1,join:"round"});
  }else if(typeof graphics.beginFill==="function"&&
      typeof graphics.drawPolygon==="function"&&typeof graphics.endFill==="function"){
    graphics.beginFill(color,.6);graphics.drawPolygon(points);graphics.endFill();
    if(typeof graphics.lineStyle==="function"&&typeof graphics.moveTo==="function"&&
        typeof graphics.lineTo==="function"){
      graphics.lineStyle(width,color,1);graphics.moveTo(points[0],points[1]);
      for(let i=2;i<points.length;i+=2)graphics.lineTo(points[i],points[i+1]);
      graphics.lineTo(points[0],points[1]);
    }
  }else throw Error("Foundry Canvas cannot draw Territory ownership reviews.");
}

export class TerritoryAuthoringCanvas{
  constructor({manualFog=null}={}){this.manualFog=manualFog;}
  session=null;
  async begin(scene,draft,onSave,
    {inspectDraft=null,onStage=null,afterStage=null,batchContext=null}={}){
    if(this.session)throw Error("Finish or cancel the existing Territory draft first.");
    const view=globalThis.canvas;
    if(!globalThis.game?.user?.isGM||!view?.ready||view.scene?.id!==scene?.id||
        !view.interface?.addChild||!globalThis.PIXI?.Graphics)
      throw Error("Open this Scene as GM to author its Territory.");
    const surface=view.app?.canvas??view.app?.view;
    if(!surface||typeof view.canvasCoordinatesFromClient!=="function")
      throw Error("Native canvas pointer coordinates are unavailable.");
    const layer=new PIXI.Graphics();layer.eventMode="none";
    view.interface.addChild(layer);
    const panel=el("section");panel.className="atlas-territory-authoring";
    panel.style.cssText="position:fixed;top:90px;left:24px;z-index:10000;"+
      "width:360px;max-width:calc(100vw - 48px);max-height:calc(100vh - 110px);"+
      "overflow-y:auto;box-sizing:border-box;padding:1rem;background:#111019;color:#f4e8d7;"+
      "border:1px solid #caad83;border-radius:8px;box-shadow:0 8px 24px #0009";
    panel.setAttribute("role","region");
    panel.setAttribute("aria-label","Atlas Territory boundary editor");
    const editorTitle=batchContext?`Atlas · Paint ${batchContext.name}`:
      "Atlas · "+(draft.kind==="grid"?"Paint Territory":"Edit Territory Nodes");
    const head=el("h3",editorTitle);
    const info=el("p");
    const batchNote=batchContext?el("p",`Batch destination ${batchContext.index} of `+
      `${batchContext.total}: ${batchContext.name}. Paint cells INTO this destination. `+
      "Atlas will remove them from their current owner only after the final batch " +
      "approval. Do not separately erase the source. Staging stores a local draft, " +
      "not a native Region update. Stage & Next moves through the selection; " +
      "Stage & Review Batch opens the final approval without visiting the Workspace."):null;
    if(batchNote)batchNote.style.cssText="color:#bce9e3;white-space:pre-line;";
    const ownershipReview=el("p");
    ownershipReview.setAttribute("role","note");
    ownershipReview.setAttribute("aria-live","polite");
    ownershipReview.style.cssText="white-space:pre-line;color:#bce9e3;margin:.5rem 0";
    ownershipReview.style.display="none";
    const actions=el("div");actions.style.cssText="display:flex;flex-wrap:wrap;gap:0.4rem";
    const addButton=(label,handler)=>{const b=el("button",label);b.type="button";
      b.addEventListener("click",handler);actions.appendChild(b);return b;};
    const shortcuts=el("aside");shortcuts.className="atlas-territory-shortcuts";
    shortcuts.setAttribute("aria-label","Territory editor shortcuts");
    shortcuts.style.cssText="border-top:1px solid #6b5e61;padding-top:.6rem;"+
      "margin:.5rem 0;font-size:.82rem;line-height:1.35;";
    const shortcutsTitle=el("strong","Shortcuts");
    shortcutsTitle.style.cssText="display:block;margin-bottom:.35rem;";
    shortcuts.appendChild(shortcutsTitle);
    const bindings=draft.kind==="grid"?[
      ["Click / drag","Paint cells"],
      ["Shift + click / drag","Erase cells"],
      ["Scroll","Zoom map (Foundry default)"],
      ["Shift + scroll","Brush size"],
      ["Cmd / Ctrl + Z","Undo last stroke"],
      ["Esc","Close and return to Atlas Workspace"]
    ]:[
      ["Left click","Add / select node"],
      ["Drag","Move selected node"],
      ["Right click","Remove last node"],
      ["Cmd / Ctrl + Z","Undo last node edit"],
      ["Esc","Close and return to Atlas Workspace"]
    ];
    for(const [hotkey,description] of bindings){
      const row=el("div");row.style.cssText="display:flex;gap:.65rem;justify-content:space-between;"+
        "align-items:baseline;padding:.1rem 0;";
      const keyLabel=el("kbd",hotkey);keyLabel.style.cssText="color:#f6d99e;white-space:nowrap;";
      const explanation=el("span",description);
      row.append(keyLabel,explanation);shortcuts.appendChild(row);
    }
    const session={sceneId:scene.id,view,surface,layer,panel,info,draft:copy(draft),
      history:[],radius:0,strokeErase:false,hoverErase:false,
      pointerSnapshot:null,dragNode:-1,selectedNode:-1,painting:false,saving:false,
      hoverAnchor:null,hoverOffsets:[],raf:null,end:null,close:null,onSave,
      ownershipReview,reviewSignature:null,ownershipPreview:null};
    const progress=el("div");
    progress.setAttribute("role","status");progress.setAttribute("aria-live","polite");
    progress.className="atlas-territory-transfer-progress";
    const progressLabel=el("p","Preparing transfer…");
    const progressBar=el("progress");progressBar.max=4;progressBar.value=0;
    progressBar.style.cssText="display:block;width:100%;height:1.2rem;accent-color:#68c8bb;";
    progress.append(progressLabel,progressBar);
    const priorDisplays=new Map();
    const reportProgress=({step,total,message})=>{
      // Hide ALL paint controls, including brush radius and smoothing, while
      // keeping a full-size, legible progress surface. Restore on any failure.
      if(!priorDisplays.size){
        for(const child of panel.children){
          if(child===head||child===progress)continue;
          priorDisplays.set(child,child.style.display);
          child.style.display="none";
        }
        panel.style.minWidth="370px";panel.style.minHeight="190px";
        head.textContent="Atlas · Transferring Territory";
      }
      progress.style.display="block";
      progressBar.max=total;progressBar.value=step;
      progressLabel.textContent=message;
    };
    const restoreProgress=()=>{
      for(const [child,display] of priorDisplays)child.style.display=display;
      priorDisplays.clear();
      progress.style.display="none";
      panel.style.minWidth="";panel.style.minHeight="";
      head.textContent=editorTitle;
    };
    const undoDraft=()=>{const prior=session.history.pop();if(!prior)return;
      session.draft=prior;session.smoothingSelect&&(session.smoothingSelect.value=
        String(prior.smoothing??0));this.#draw(session);};
    if(draft.kind==="grid"){
      const radiusLabel=el("label"," Brush radius ");
      const radiusValue=el("output","1 cell");
      const slider=el("input");slider.type="range";
      slider.min="0";slider.max="4";slider.step="1";slider.value="0";
      slider.setAttribute("aria-label","Territory paint brush radius in grid rings");
      const setRadius=value=>{
        session.radius=Math.max(0,Math.min(4,Math.round(Number(value)||0)));
        slider.value=String(session.radius);
        radiusValue.textContent=session.radius===0?"1 cell":
          `${session.radius} ring${session.radius===1?"":"s"}`;
        if(session.hoverAnchor)session.hoverOffsets=brushOffsets(session.hoverAnchor)
          .filter(o=>within(view.grid.getCenterPoint(o)));
        this.#scheduleDraw(session);
      };
      session.setRadius=setRadius;
      slider.addEventListener("input",()=>setRadius(slider.value));
      radiusLabel.appendChild(slider);radiusLabel.appendChild(radiusValue);
      panel.appendChild(radiusLabel);
      if(typeof inspectDraft==="function")addButton("Review Shared Cells",async()=>{
        if(session.saving)return;
        const signature=JSON.stringify(session.draft.offsets);
        try{
          const report=await inspectDraft(copy(session.draft));
          if(!this.#live(session))return;
          if(signature!==JSON.stringify(session.draft.offsets)){
            ownershipReview.textContent="Draft changed during review. Review Shared Cells again.";
            session.reviewSignature=null;session.ownershipPreview=null;
          }else{
            const lines=[`Proposed: ${report.proposedCells} cells (`+
              `+${report.addedCells} / −${report.removedCells}).`,
            `${report.unclaimedAddedCells} added cells are unclaimed; `+
              `${report.peerOwnedAddedCells} are already held by peer Territories.`];
            if(report.peers.length)lines.push("Peers: "+report.peers.map(p=>
              `${p.name} (${p.cells})`).join(", ")+".");
            if(report.contestedAddedCells)lines.push(
              `⚠ ${report.contestedAddedCells} added cells have multiple peer owners; `+
                "resolve overlapping claims before saving.");
            if(report.requiresMultiRegionReview)lines.push(
              "Multiple peers require an explicit multi-Region transfer with " +
                "recovery. Preview & Save performs fresh checks; this review never writes.");
            else lines.push("Read-only review. Save still performs a fresh native validation.");
            if(report.previewCells?.length){
              lines.push("Map preview: gold = peer-owned; red = contested; " +
                "blue = unclaimed; purple = removed.");
              if(report.previewTruncated)lines.push(
                `Showing ${report.previewCells.length} of ${report.previewTotalCells} changed cells. `+
                "Conflicts are shown first; counts include all cells.");
            }
            ownershipReview.textContent=lines.join("\n");
            session.reviewSignature=signature;
            session.ownershipPreview=Array.isArray(report.previewCells)?
              report.previewCells.map(cell=>({...cell})):null;
            this.#scheduleDraw(session);
          }
          ownershipReview.style.display="block";
        }catch(error){
          ownershipReview.textContent=error.message??String(error);
          ownershipReview.style.display="block";
          session.reviewSignature=null;session.ownershipPreview=null;
          this.#scheduleDraw(session);
        }
      });
    }else{
      const smoothingLabel=el("label"," Smoothing ");
      const smoothingSelect=el("select");
      session.smoothingSelect=smoothingSelect;
      for(const [value,title] of [[0,"Off (exact nodes)"],[1,"Gentle"],[2,"Moderate"]]){
        const option=el("option",title);option.value=String(value);
        option.selected=value===(draft.smoothing??0);smoothingSelect.appendChild(option);
      }
      smoothingSelect.addEventListener("change",()=>{
        session.history.push(copy(session.draft));
        session.draft.smoothing=Number(smoothingSelect.value);this.#draw(session);
      });
      smoothingLabel.appendChild(smoothingSelect);panel.appendChild(smoothingLabel);
      addButton("Delete selected node",()=>{
        if(session.selectedNode<0||session.draft.points.length<=3)return;
        session.history.push(copy(session.draft));
        session.draft.points.splice(session.selectedNode,1);
        session.selectedNode=-1;this.#draw(session);
      });
    }
    if(draft.kind==="grid"&&typeof onStage==="function"){
      const stage=async({advance=false,targetId=null,review=false}={})=>{
        if(session.saving)return;
        session.saving=true;
        let releaseFocus=null;
        try{
          await onStage(copy(session.draft));
          if(this.#live(session)){
            // Keep the Workspace minimized between consecutive Paint editors
            // and while reviewing a batch. Release after the next editor opens
            // or after the GM exits/finishes; do not change saved window state.
            releaseFocus=acquireAtlasCanvasEditorFocus();
            await session.close(true);
            await afterStage?.({advance,targetId,review});
          }
        }catch(error){globalThis.ui?.notifications?.error?.(error.message??String(error));}
        finally{await releaseFocus?.();session.saving=false;}
      };
      if(batchContext?.nextName)addButton(`Stage & Next: ${batchContext.nextName}`,
        ()=>stage({advance:true}));
      else addButton("Stage & Review Batch",()=>stage({review:true}));
      if(Array.isArray(batchContext?.targets)&&batchContext.targets.length>1){
        const picker=el("label","Switch batch destination");
        picker.style.cssText="display:block;margin:.65rem 0 .35rem";
        const select=el("select");
        select.setAttribute("aria-label","Switch to selected batch Territory");
        const otherTargets=batchContext.targets.filter(target=>target.id!==batchContext.regionId);
        for(const target of otherTargets){
          const option=el("option",`${target.name} — ${target.staged?"Staged":"Not staged"}`);
          option.value=target.id;select.appendChild(option);
        }
        if(batchContext.nextId)select.value=batchContext.nextId;
        picker.appendChild(select);panel.appendChild(picker);
        addButton("Stage & Switch Territory",()=>stage({targetId:select.value}));
      }
      addButton("Stage & Return to Workspace",()=>stage());
    }
    addButton("Cancel",()=>{if(!session.saving)session.close(false);});
    if(!batchContext){
      const save=addButton("Preview & Save",async()=>{
      if(save.disabled)return;save.disabled=true;
      try{
        const text=draft.kind==="grid"?
          `Save ${session.draft.offsets.length} native grid cells?`:
          `Save ${session.draft.points.length} editable boundary nodes?`;
        const accepted=await foundry.applications.api.DialogV2.confirm({window:{title:"Save Territory boundary"},
          content:`<p>${text}</p><p>Atlas will verify parent containment, peer overlaps, `+
            `permissions and native geometry before changing a Region. Cancel does not write.</p>`,
          yes:{label:"Save Native Region"},rejectClose:false,modal:true});
        if(!accepted)return;
        if(!this.#live(session))return;
        if(globalThis.canvas?.scene?.id!==scene.id)
          throw Error("The active Scene changed; reopen the Territory editor.");
        session.saving=true;
        const saved=await onSave(copy(session.draft),reportProgress);
        if(saved!==false)session.close(true);
      }catch(error){globalThis.ui?.notifications?.error?.(error.message??String(error));}
      finally{session.saving=false;save.disabled=false;restoreProgress();}
      });
    }
    progress.style.display="none";
    panel.prepend(head,info);
    if(batchNote)panel.appendChild(batchNote);
    panel.append(ownershipReview,shortcuts,actions,progress);
    document.body.appendChild(panel);
    const snapshot=()=>{session.history.push(copy(session.draft));
      if(session.history.length>40)session.history.shift();};
    const point=event=>view.canvasCoordinatesFromClient({x:event.clientX,y:event.clientY});
    const within=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&
      p.x>=view.dimensions.sceneX&&
      p.x<=view.dimensions.sceneX+view.dimensions.sceneWidth&&
      p.y>=view.dimensions.sceneY&&
      p.y<=view.dimensions.sceneY+view.dimensions.sceneHeight;
    const brushOffsets=center=>{
      const grid=view.grid,results=[center],seen=new Set([`${center.i},${center.j}`]);
      let fringe=[center];
      for(let i=0;i<session.radius;i++){
        const next=[];
        for(const cell of fringe)for(const candidate of grid.getAdjacentOffsets(cell)){
          const k=`${candidate.i},${candidate.j}`;
          if(seen.has(k))continue;seen.add(k);results.push(candidate);next.push(candidate);
        }
        fringe=next;
      }
      return results;
    };
    const previewBrush=(p,erase=false)=>{
      const offset=view.grid.getOffset(p);
      if(!Number.isSafeInteger(offset?.i)||!Number.isSafeInteger(offset?.j))return;
      if(session.hoverAnchor?.i===offset.i&&session.hoverAnchor?.j===offset.j&&
          session.hoverErase===erase)return;
      session.hoverAnchor=offset;
      session.hoverErase=erase;
      session.hoverOffsets=brushOffsets(offset)
        .filter(o=>within(view.grid.getCenterPoint(o)));
      this.#scheduleDraw(session);
    };
    const clearPreview=()=>{
      if(!session.hoverAnchor)return;
      session.hoverAnchor=null;session.hoverOffsets=[];this.#scheduleDraw(session);
    };
    const applyBrush=(p,erase)=>{
      const offset=view.grid.getOffset(p);
      if(!Number.isSafeInteger(offset?.i)||!Number.isSafeInteger(offset?.j))return;
      const inside=brushOffsets(offset).filter(o=>within(view.grid.getCenterPoint(o)));
      session.draft.offsets=paintGridCells(session.draft.offsets,
        inside,erase);this.#scheduleDraw(session);
    };
    const down=event=>{
      if(!this.#live(session)||session.saving||
          (event.button!==0&&!(session.draft.kind==="polygon"&&event.button===2)))return;
      const p=point(event);if(!within(p))return;
      event.preventDefault();event.stopImmediatePropagation();
      if(event.button===2){
        if(session.draft.points.length){snapshot();session.draft.points.pop();
          session.selectedNode=-1;this.#draw(session);}
        return;
      }
      snapshot();
      session.pointerSnapshot=session.history.at(-1);
      if(session.draft.kind==="grid"){
        session.strokeErase=!!event.shiftKey;
        previewBrush(p,session.strokeErase);session.painting=true;
        applyBrush(p,session.strokeErase);return;
      }
      const zoom=Math.max(0.1,view.stage?.scale?.x??1);
      const near=session.draft.points.findIndex(q=>Math.hypot(p.x-q.x,p.y-q.y)<12/zoom);
      if(near>=0){session.dragNode=near;session.selectedNode=near;}
      else if(session.draft.points.length<MAX_TERRITORY_NODES){
        const id=globalThis.crypto?.randomUUID?.().replaceAll("-","")??
          `p${Date.now()}_${session.draft.points.length}`;
        const nodes=session.draft.points;
        const closest=nodes.length>=2?nodes.map((q,i)=>edgeDistance(p,q,
          nodes[(i+1)%nodes.length])):[];
        const edge=closest.indexOf(Math.min(...closest));
        const insertion=edge>=0&&closest[edge]<14/zoom?edge+1:nodes.length;
        nodes.splice(insertion,0,{id,x:p.x,y:p.y});
        session.selectedNode=insertion;
      }
      this.#scheduleDraw(session);
    };
    let lastCell="";
    const move=event=>{
      if(!this.#live(session))return;
      const onSurface=event.target===surface||surface.contains?.(event.target);
      const p=point(event);
      if(!within(p)||(!onSurface&&!session.painting&&session.dragNode<0)){
        if(session.draft.kind==="grid")clearPreview();return;
      }
      if(session.draft.kind==="grid")previewBrush(p,
        session.painting?session.strokeErase:!!event.shiftKey);
      if(session.draft.kind==="grid"&&session.painting){
        const offset=view.grid.getOffset(p),k=`${offset.i},${offset.j}`;
        if(k!==lastCell){event.preventDefault();event.stopImmediatePropagation();
          lastCell=k;applyBrush(p,session.strokeErase);}return;
      }
      if(session.dragNode>=0){event.preventDefault();event.stopImmediatePropagation();
        session.draft.points[session.dragNode].x=p.x;
        session.draft.points[session.dragNode].y=p.y;this.#scheduleDraw(session);}
    };
    const up=()=>{
      if(session.pointerSnapshot&&session.history.at(-1)===session.pointerSnapshot&&
          JSON.stringify(session.pointerSnapshot)===JSON.stringify(session.draft))
        session.history.pop();
      session.pointerSnapshot=null;session.dragNode=-1;
      session.painting=false;lastCell="";
    };
    const leave=()=>{if(session.draft.kind==="grid"&&!session.painting)clearPreview();};
    const contextmenu=event=>{if(session.draft.kind==="polygon"&&this.#live(session)){
      event.preventDefault();event.stopImmediatePropagation();}};
    const wheel=event=>{
      // Only Shift+wheel changes the brush. Leave ordinary wheel/trackpad
      // scrolling to Foundry's own map zoom handler; some browsers translate
      // Shift+vertical-wheel into a horizontal delta instead.
      if(!this.#live(session)||session.saving||session.draft.kind!=="grid"||
          !event.shiftKey||event.altKey||event.ctrlKey||event.metaKey)return;
      const delta=Number.isFinite(event.deltaY)&&event.deltaY!==0?
        event.deltaY:event.deltaX;
      if(!Number.isFinite(delta)||delta===0)return;
      event.preventDefault();event.stopImmediatePropagation();
      session.setRadius(session.radius+(delta<0?1:-1));
    };
    const key=event=>{
      if(!this.#live(session)||session.saving)return;
      if((event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&
          String(event.key).toLowerCase()==="z"){
        const tag=String(event.target?.tagName??"").toLowerCase();
        if(tag==="input"||tag==="textarea"||event.target?.isContentEditable)return;
        if(session.painting||session.dragNode>=0)return;
        event.preventDefault();event.stopImmediatePropagation();undoDraft();return;
      }
      if(event.key==="Escape"){
        // Foundry also listens for Escape to close ApplicationV2 windows.
        // Consume it so the minimized Atlas Workspace can be maximized.
        event.preventDefault();event.stopImmediatePropagation();
        session.close(false);return;
      }
      if(event.key==="Shift"&&session.draft.kind==="grid"&&
          !session.painting&&session.hoverAnchor){
        session.hoverErase=true;this.#scheduleDraw(session);}
    };
    const keyup=event=>{
      if(event.key==="Shift"&&this.#live(session)&&!session.painting&&
          session.draft.kind==="grid"&&session.hoverAnchor){
        session.hoverErase=false;this.#scheduleDraw(session);}
    };
    session.close=success=>{
      if(this.session!==session)return;
      surface.removeEventListener("pointerdown",down,true);
      surface.removeEventListener("contextmenu",contextmenu,true);
      surface.removeEventListener("wheel",wheel,true);
      surface.removeEventListener("pointerleave",leave,true);
      document.removeEventListener("pointermove",move,true);
      document.removeEventListener("pointerup",up,true);
      document.removeEventListener("keydown",key,true);
      document.removeEventListener("keyup",keyup,true);
      if(session.raf!==null)globalThis.cancelAnimationFrame?.(session.raf);
      panel.remove();layer.parent?.removeChild?.(layer);layer.destroy?.();
      session.restoreFog?.();
      const restoration=session.restoreWindows?.();
      this.session=null;session.end?.(success);
      return restoration;
    };
    surface.addEventListener("pointerdown",down,true);
    surface.addEventListener("contextmenu",contextmenu,true);
    surface.addEventListener("wheel",wheel,{capture:true,passive:false});
    surface.addEventListener("pointerleave",leave,true);
    document.addEventListener("pointermove",move,true);
    document.addEventListener("pointerup",up,true);
    document.addEventListener("keydown",key,true);
    document.addEventListener("keyup",keyup,true);
    this.session=session;
    session.restoreWindows=acquireAtlasCanvasEditorFocus();
    try{
      session.restoreFog=acquireAtlasTerritoryEditorFog({view,manualFog:this.manualFog});
      this.#draw(session);
    }catch(error){session.close(false);throw error;}
    return new Promise(resolve=>{session.end=resolve;});
  }
  #live(session){return this.session===session&&
    globalThis.canvas?.scene?.id===session.sceneId&&globalThis.game?.user?.isGM;}
  cancel(){this.session?.close?.(false);}
  #scheduleDraw(session){
    if(session.raf!==null)return;
    if(!globalThis.requestAnimationFrame){this.#draw(session);return;}
    session.raf=requestAnimationFrame(()=>{
      session.raf=null;
      if(!this.#live(session))return;
      try{this.#draw(session);}catch(error){
        globalThis.ui?.notifications?.error?.(error.message??String(error));
        session.close(false);
      }
    });
  }
  #draw(session){
    const graphics=session.layer,view=session.view,draft=session.draft;
    if(session.reviewSignature!==null&&
        JSON.stringify(draft.offsets)!==session.reviewSignature){
      session.reviewSignature=null;session.ownershipPreview=null;
      session.ownershipReview.textContent="Draft changed. Review Shared Cells again.";
    }
    const zoom=Number.isFinite(view.stage?.scale?.x)&&view.stage.scale.x>0?
      view.stage.scale.x:1;
    graphics.clear();
    if(draft.kind==="polygon"){
      const points=draft.points;
      if(points.length>=2){
        let contour=points;
        if(points.length>=3&&draft.smoothing){
          try{const flat=smoothClosedBoundary(points.flatMap(p=>[p.x,p.y]),draft.smoothing);
            contour=[];for(let i=0;i<flat.length;i+=2)
              contour.push({x:flat[i],y:flat[i+1]});}
          catch{contour=points;}
        }
        drawOutline(graphics,contour,zoom);
      }
      for(const [i,p] of points.entries())drawControlNode(graphics,p,
        i===session.selectedNode,zoom);
      session.info.textContent=`${points.length} control nodes · Click to add, `+
        "drag a node to move; click an edge to insert; right-click removes the last node; " +
        "Cmd/Ctrl+Z undoes the previous edit. " +
        "Smoothing changes the native projection, never the controls.";
    }else{
      const shape=view.grid.getShape(),cells=draft.offsets;
      for(const p of cells){
        const center=view.grid.getCenterPoint(p);
        drawGridSpace(graphics,shape.flatMap(q=>[center.x+q.x,center.y+q.y]));
      }
      for(const cell of session.ownershipPreview??[]){
        const center=view.grid.getCenterPoint(cell);
        drawOwnershipFootprint(graphics,shape.flatMap(q=>
          [center.x+q.x,center.y+q.y]),cell.status,zoom);
      }
      for(const cell of session.hoverOffsets){
        const center=view.grid.getCenterPoint(cell);
        drawBrushFootprint(graphics,shape.flatMap(q=>[center.x+q.x,center.y+q.y]),
          session.hoverErase,zoom);
      }
      const chosen=new Set(cells.map(c=>`${c.i},${c.j}`));
      const changing=session.hoverOffsets.filter(c=>
        chosen.has(`${c.i},${c.j}`)===session.hoverErase).length;
      session.info.textContent=`${cells.length} grid cells · Click/drag to paint; `+
        "Shift+click/drag to erase; Shift+wheel changes brush; Cmd/Ctrl+Z to undo."+
        (session.hoverAnchor?` Hover: ${session.hoverErase?"erase":"add"} `+
          `${changing} cell${changing===1?"":"s"} (${session.hoverOffsets.length} in brush).`:"");
    }
  }
}
