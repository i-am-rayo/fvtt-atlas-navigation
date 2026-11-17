/**
 * Modeless Road Settings form, using Atlas's ApplicationV2 window convention.
 * This owns presentation and form collection only; the existing Road workflow
 * in main.js retains authorization, stale-write validation and persistence.
 */
export function openRoadSettingsWindow({id,title,position,content,onRender}){
  if(typeof id!=="string"||!id)throw Error("Road Settings requires an editor identity.");
  const Base=foundry.applications.api.ApplicationV2;
  class RoadSettingsWindow extends Base {
    static DEFAULT_OPTIONS={
      id:"fvtt-atlas-road-settings",
      window:{title:"Atlas — Road Settings",resizable:true,minimizable:true}
    };

    constructor(resolve){
      super({id:"fvtt-atlas-road-settings-"+id,
        window:{title,resizable:true,minimizable:true},position});
      this.resolveResult=resolve;
    }

    get form(){
      return this.element?.querySelector?.("form[data-atlas-road-form]")??null;
    }

    setCloseGuard(guard){
      if(typeof guard!=="function")throw Error("Invalid Road Settings close guard.");
      this.closeGuard=guard;
    }

    async close(options){
      if(this.closePending)return this;
      this.closePending=true;
      try{
        if(this.closeGuard&&!await this.closeGuard())return this;
        return await super.close(options);
      }finally{this.closePending=false;}
    }

    async _renderHTML(){
      const form=document.createElement("form");
      form.dataset.atlasRoadForm="";
      form.className="atlas-road-settings-form";
      const footer=document.createElement("footer");
      footer.className="form-footer";
      const save=document.createElement("button");
      save.type="submit";
      save.dataset.atlasRoadSubmit="";
      save.textContent="Save Road";
      footer.appendChild(save);
      form.append(content,footer);
      return form;
    }

    _replaceHTML(result,element){ element.replaceChildren(result); }

    _onRender(...args){
      super._onRender?.(...args);
      const form=this.form;
      if(!form||form.dataset.atlasSubmissionWired)return;
      form.dataset.atlasSubmissionWired="true";
      form.addEventListener("submit",event=>{
        event.preventDefault();
        if(!form.reportValidity())return;
        try{
          const result=new foundry.applications.ux.FormDataExtended(form).object;
          this.resolveResult?.(result);
          this.resolveResult=null;
          void this.close();
        }catch(error){
          ui.notifications.error(error.message??String(error));
        }
      });
      onRender?.(null,this);
    }

    _onClose(...args){
      this.resolveResult?.(null);
      this.resolveResult=null;
      return super._onClose?.(...args);
    }
  }

  return new Promise((resolve,reject)=>{
    const app=new RoadSettingsWindow(resolve);
    Promise.resolve(app.render(true)).catch(reject);
  });
}
