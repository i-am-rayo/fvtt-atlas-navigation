/** Modeless GM canvas authoring surface. Only Save commits a RegionDocument;
 * pointer input, Undo, brush strokes, and preview graphics are transient. */
import {paintGridCells,MAX_TERRITORY_NODES} from "./territory-authoring-model.js";
import {smoothClosedBoundary} from "./region-boundary-model.js";

const el=(tag,label)=>{const result=document.createElement(tag);
  if(label!==undefined)result.textContent=label;return result;};
const copy=v=>structuredClone(v);
function edgeDistance(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}

export class TerritoryAuthoringCanvas{
  session=null;
  async begin(scene,draft,onSave){
    if(this.session)throw Error("Finish or cancel the existing Territory draft first.");
    const view=globalThis.canvas;
    if(!globalThis.game?.user?.isGM||!view?.ready||view.scene?.id!==scene?.id||
        !view.primary?.addChild||!globalThis.PIXI?.Graphics)
      throw Error("Open this Scene as GM to author its Territory.");
    const surface=view.app?.canvas??view.app?.view;
    if(!surface||typeof view.canvasCoordinatesFromClient!=="function")
      throw Error("Native canvas pointer coordinates are unavailable.");
    const layer=new PIXI.Graphics();layer.eventMode="none";
    view.primary.addChild(layer);
    const panel=el("section");panel.className="atlas-territory-authoring";
    panel.style.cssText="position:fixed;top:90px;right:24px;z-index:10000;"+
      "max-width:360px;padding:1rem;background:#111019;color:#f4e8d7;"+
      "border:1px solid #caad83;border-radius:8px;box-shadow:0 8px 24px #0009";
    panel.setAttribute("role","region");
    panel.setAttribute("aria-label","Atlas Territory boundary editor");
    const head=el("h3","Atlas · "+(draft.kind==="grid"?"Paint Territory":"Edit Territory Nodes"));
    const info=el("p");
    const actions=el("div");actions.style.cssText="display:flex;flex-wrap:wrap;gap:0.4rem";
    const addButton=(label,handler)=>{const b=el("button",label);b.type="button";
      b.addEventListener("click",handler);actions.appendChild(b);return b;};
    const session={sceneId:scene.id,view,surface,layer,panel,info,draft:copy(draft),
      history:[],brush:"add",radius:0,dragNode:-1,selectedNode:-1,painting:false,
      raf:null,end:null,close:null,onSave};
    const undo=addButton("Undo",()=>{const prior=session.history.pop();if(prior){
      session.draft=prior;session.smoothingSelect&&(session.smoothingSelect.value=
        String(prior.smoothing??0));this.#draw(session);}});
    if(draft.kind==="grid"){
      const mode=addButton("Brush: Add",()=>{session.brush=session.brush==="add"?"erase":"add";
        mode.textContent="Brush: "+(session.brush==="add"?"Add":"Erase");});
      const radiusLabel=el("label"," Brush radius ");
      const select=el("select");
      for(const size of [0,1,2,3]){const opt=el("option",size===0?"1 cell":`${size} rings`);
        opt.value=String(size);select.appendChild(opt);}
      select.addEventListener("change",()=>{session.radius=Number(select.value);});
      radiusLabel.appendChild(select);panel.appendChild(radiusLabel);
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
    addButton("Cancel",()=>session.close(false));
    const save=addButton("Preview & Save",async()=>{
      if(save.disabled)return;save.disabled=true;
      try{
        const text=draft.kind==="grid"?
          `Save ${session.draft.offsets.length} native grid cells?`:
          `Save ${session.draft.points.length} editable boundary nodes?`;
        const accepted=await DialogV2.confirm({window:{title:"Save Territory boundary"},
          content:`<p>${text}</p><p>Atlas will verify parent containment, peer overlaps, `+
            `permissions and native geometry before changing a Region. Cancel does not write.</p>`,
          yes:{label:"Save Native Region"},rejectClose:false,modal:true});
        if(!accepted)return;
        if(globalThis.canvas?.scene?.id!==scene.id)
          throw Error("The active Scene changed; reopen the Territory editor.");
        await onSave(copy(session.draft));session.close(true);
      }catch(error){globalThis.ui?.notifications?.error?.(error.message??String(error));}
      finally{save.disabled=false;}
    });
    panel.prepend(head,info);panel.appendChild(actions);
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
    const applyBrush=p=>{
      const offset=view.grid.getOffset(p);
      if(!Number.isSafeInteger(offset?.i)||!Number.isSafeInteger(offset?.j))return;
      const inside=brushOffsets(offset).filter(o=>within(view.grid.getCenterPoint(o)));
      session.draft.offsets=paintGridCells(session.draft.offsets,
        inside,session.brush==="erase");this.#scheduleDraw(session);
    };
    const down=event=>{
      if(event.button!==0||!this.#live(session))return;
      const p=point(event);if(!within(p))return;
      event.preventDefault();event.stopImmediatePropagation();
      snapshot();
      if(session.draft.kind==="grid"){
        session.painting=true;applyBrush(p);return;
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
      const p=point(event);if(!within(p))return;
      if(session.draft.kind==="grid"&&session.painting){
        const offset=view.grid.getOffset(p),k=`${offset.i},${offset.j}`;
        if(k!==lastCell){event.preventDefault();event.stopImmediatePropagation();
          lastCell=k;applyBrush(p);}return;
      }
      if(session.dragNode>=0){event.preventDefault();event.stopImmediatePropagation();
        session.draft.points[session.dragNode].x=p.x;
        session.draft.points[session.dragNode].y=p.y;this.#scheduleDraw(session);}
    };
    const up=()=>{session.dragNode=-1;session.painting=false;lastCell="";};
    const key=event=>{if(event.key==="Escape"&&this.#live(session)){
      event.preventDefault();session.close(false);}};
    session.close=success=>{
      if(this.session!==session)return;
      surface.removeEventListener("pointerdown",down,true);
      document.removeEventListener("pointermove",move,true);
      document.removeEventListener("pointerup",up,true);
      document.removeEventListener("keydown",key,true);
      if(session.raf!==null)globalThis.cancelAnimationFrame?.(session.raf);
      panel.remove();layer.parent?.removeChild?.(layer);layer.destroy?.();
      this.session=null;session.end?.(success);
    };
    surface.addEventListener("pointerdown",down,true);
    document.addEventListener("pointermove",move,true);
    document.addEventListener("pointerup",up,true);
    document.addEventListener("keydown",key,true);
    this.session=session;
    try{this.#draw(session);}catch(error){session.close(false);throw error;}
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
        graphics.moveTo(contour[0].x,contour[0].y);
        for(let i=1;i<contour.length;i++)graphics.lineTo(contour[i].x,contour[i].y);
        if(contour.length>=3)graphics.lineTo(contour[0].x,contour[0].y);
        graphics.stroke({width:3,color:0x8bdbbe,alpha:1});
      }
      for(const [i,p] of points.entries())graphics.circle(p.x,p.y,6)
        .fill({color:i===session.selectedNode?0xffd45e:0xe6bd81,alpha:1});
      session.info.textContent=`${points.length} control nodes · Click to add, `+
        "drag a node to move; click an edge to insert; select and delete a node. " +
        "Smoothing changes the native projection, never the controls.";
    }else{
      const shape=view.grid.getShape(),cells=draft.offsets;
      for(const p of cells){
        const center=view.grid.getCenterPoint(p);
        graphics.poly(shape.flatMap(q=>[center.x+q.x,center.y+q.y]))
          .fill({color:0x43bca2,alpha:0.28});
      }
      session.info.textContent=`${cells.length} grid cells · Click/drag to paint; `+
        "switch brush to erase; Undo or Save when ready.";
    }
  }
}
