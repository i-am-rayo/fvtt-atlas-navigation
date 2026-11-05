import {atlasAnnouncementPreview} from "./atlas-announcement-model.js";

/** Local, reusable DOM-only presentation. Never emits gameplay events. */
export class AtlasAnnouncementPreviewRenderer {
  constructor({documentRef=globalThis.document,
    setTimeoutFn=globalThis.setTimeout,clearTimeoutFn=globalThis.clearTimeout,
    durationMs=4500}={}){
    this.documentRef=documentRef;
    this.setTimeoutFn=setTimeoutFn;
    this.clearTimeoutFn=clearTimeoutFn;
    this.durationMs=durationMs;
    this.layer=null;
    this.timer=null;
    this.generation=0;
  }

  show(type,options={}){
    const spec=atlasAnnouncementPreview(type,options);
    const doc=this.documentRef;
    if(!doc?.body||typeof doc.createElement!=="function")return false;
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
    // Replace old sample in the same layer; no queue, duplicate or stale DOM.
    this.layer.replaceChildren(banner);
    this.timer=this.setTimeoutFn(()=>{
      // A cancelled callback already queued before replacement is not authoritative.
      if(generation===this.generation)this.dismiss();
    },this.durationMs);
    return true;
  }

  dismiss(){
    this.generation++;
    if(this.timer!==null){this.clearTimeoutFn(this.timer);this.timer=null;}
    this.layer?.remove();
    this.layer=null;
  }

  destroy(){this.dismiss();}
}
