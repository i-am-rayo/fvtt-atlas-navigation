import {atlasAnnouncementPreview} from "./atlas-announcement-model.js";

/** Local, reusable DOM-only presentation. Never emits gameplay events. */
export class AtlasAnnouncementPreviewRenderer {
  constructor({documentRef=globalThis.document,
    // Do not store unbound Window methods: invoking them through this instance
    // throws "Illegal invocation" in Foundry's browser (owner beta.3 log).
    setTimeoutFn=(callback,ms)=>globalThis.setTimeout(callback,ms),
    clearTimeoutFn=id=>globalThis.clearTimeout(id),
    durationMs=5000,maxQueue=64}={}){
    this.documentRef=documentRef;
    this.setTimeoutFn=setTimeoutFn;
    this.clearTimeoutFn=clearTimeoutFn;
    this.durationMs=Number.isFinite(durationMs)&&durationMs>=1000&&durationMs<=60000?
      durationMs:5000;
    this.maxQueue=Number.isInteger(maxQueue)&&maxQueue>0?maxQueue:64;
    this.layer=null;
    this.timer=null;
    this.generation=0;
    this.active=false;
    this.queue=[];
  }

  /** Preview action: replace immediately, including any queued live items.
   * Module Settings uses its own renderer, so previews stay browser-local. */
  show(type,options={}){
    const spec=atlasAnnouncementPreview(type,options);
    this.queue=[];
    return this.display(spec);
  }

  /** Committed events: serialize rapid arrivals rather than hiding earlier
   * banners. The queue is display-only, finite and never persisted/replayed. */
  enqueue(type,options={}){
    const spec=atlasAnnouncementPreview(type,options);
    if(!this.canDisplay())return false;
    if(this.active){
      if(this.queue.length>=this.maxQueue)return false;
      this.queue.push(spec);
      return true;
    }
    return this.display(spec);
  }

  canDisplay(){
    return Boolean(this.documentRef?.body&&
      typeof this.documentRef.createElement==="function");
  }

  display(spec){
    const doc=this.documentRef;
    if(!this.canDisplay())return false;
    const generation=++this.generation;
    if(this.timer!==null){this.clearTimeoutFn(this.timer);this.timer=null;}
    if(!this.layer){
      this.layer=doc.createElement("div");
      this.layer.className="atlas-announcement-layer";
      this.layer.setAttribute("aria-live","polite");
      this.layer.setAttribute("aria-atomic","true");
      doc.body.appendChild(this.layer);
    }
    const banner=doc.createElement("section");
    banner.className=`atlas-announcement atlas-announcement--${spec.theme}`;
    banner.style?.setProperty?.("--atlas-announcement-duration",`${this.durationMs}ms`);
    banner.setAttribute("role","status");
    banner.setAttribute("aria-label",spec.eyebrow);
    const icon=doc.createElement("span");
    icon.className="atlas-announcement-icon";
    icon.setAttribute("aria-hidden","true");
    icon.textContent=spec.icon;
    const copy=doc.createElement("div");
    copy.className="atlas-announcement-copy";
    const eyebrow=doc.createElement("p");
    eyebrow.className="atlas-announcement-eyebrow";
    eyebrow.textContent=spec.eyebrow;
    const title=doc.createElement("p");
    title.className="atlas-announcement-lead";
    title.textContent=spec.lead;
    const subject=doc.createElement("p");
    subject.className="atlas-announcement-subject";
    subject.textContent=spec.subject;
    copy.append(eyebrow,title,subject);
    banner.append(icon,copy);
    // One visible banner per client; the next queued event replaces it only
    // after its full display/fade cycle (not on the next World-setting pulse).
    this.layer.replaceChildren(banner);
    this.active=true;
    this.timer=this.setTimeoutFn(()=>{
      // A cancelled callback already queued before replacement is not authoritative.
      if(generation!==this.generation)return;
      this.timer=null;
      const next=this.queue.shift();
      if(next)this.display(next);
      else this.dismiss();
    },this.durationMs);
    return true;
  }

  dismiss(){
    this.generation++;
    if(this.timer!==null){this.clearTimeoutFn(this.timer);this.timer=null;}
    this.layer?.remove();
    this.layer=null;
    this.active=false;
    this.queue=[];
  }

  destroy(){this.dismiss();}
}
