/**
 * Modeless, GM-only map-point pick instruction. The authoritative Navigation
 * controller owns click eligibility and Point B; this window owns no route or
 * document state and never receives a Foundry canvas pointer listener.
 */
const el=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};

export function createNavigationMapPickPrompt({onCancel}={}){
  if(typeof onCancel!=="function")throw Error("Map picker needs a cancel callback.");
  // Instantiate only in Foundry; importing this module must remain safe in
  // isolated Node presentation tests.
  class NavigationMapPickPrompt extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS={
      id:"fvtt-atlas-navigation-map-pick",
      window:{title:"Pick a destination on the map",resizable:false},
      position:{width:330,height:150,left:80,top:90}
    };
    async _renderHTML(){
      const root=el("section");
      root.style.cssText="display:grid;gap:.6rem;padding:.85rem;line-height:1.45;";
      const instruction=el("p",
        "Click a location on the Scene to set the party's destination. "+
        "The Navigation window will reopen with your route.");
      instruction.style.margin="0";
      const cancel=el("button","Cancel map selection");
      cancel.type="button";
      cancel.addEventListener("click",()=>onCancel());
      root.append(instruction,cancel);
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
    _onClose(options){
      super._onClose?.(options);
      onCancel();
    }
  }
  return new NavigationMapPickPrompt();
}
