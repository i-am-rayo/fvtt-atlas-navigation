/** Reusable, render-only Foundry v14 icon picker for checkpoint and World preset forms. */
import { CHECKPOINT_ICONS, CHECKPOINT_ICON_ROOT, CHECKPOINT_FREE_ICONS,
  findCheckpointIcons, checkpointFontIcon } from "./checkpoint-appearance.js";

const node=(tag,text)=>{
  const item=document.createElement(tag);
  if(text!==undefined)item.textContent=text;
  return item;
};

const iconImage=id=>{
  const image=node("img");image.src=CHECKPOINT_ICON_ROOT+id+".svg";image.alt="";
  image.style.cssText="width:24px;height:24px;";return image;
};

const fontGlyph=id=>{
  const font=checkpointFontIcon(id);
  const glyph=node("span",font?.glyph??"?");
  glyph.style.cssText="font-family:'"+(font?.family??"sans-serif")+"';font-weight:"+
    (font?.weight??400)+";font-size:24px;line-height:1.1;";
  glyph.setAttribute("aria-hidden","true");return glyph;
};

/** Same webfont markup for forms, galleries and World preset list rows. */
export function createCheckpointIconGlyph(id){
  return CHECKPOINT_ICONS.includes(id)?iconImage(id):fontGlyph(id);
}

/** Return a control and a stable value getter; no World/Scene writes or save listeners. */
export function createCheckpointIconPicker({selectedId="location-dot",onChange=()=>{}}={}){
  let selected=selectedId;
  const details=new Map(CHECKPOINT_FREE_ICONS.map(icon=>[icon.id,icon]));
  const section=node("details");
  section.style.cssText="min-width:0;padding:.6rem;border:1px solid var(--color-border-light-tertiary,#666);";
  const legend=node("summary","Choose icon");legend.style.cursor="pointer";
  section.appendChild(legend);
  const browser=node("div");
  browser.style.cssText="display:grid;grid-template-columns:minmax(180px,1fr) minmax(280px,2fr);gap:.8rem;min-width:0;align-items:start;";
  section.appendChild(browser);
  const sidebar=node("div");sidebar.style.cssText="display:grid;gap:.5rem;min-width:0;align-content:start;";
  const gallery=node("div");gallery.style.cssText="display:grid;gap:.45rem;min-width:0;";
  browser.append(sidebar,gallery);
  const search=node("input");search.type="search";
  search.placeholder="Search fantasy icons: bridge, ship, castle, cave…";
  search.setAttribute("aria-label","Filter checkpoint icons");
  const select=(items,value)=>{
    const control=node("select");
    for(const [key,label] of items){const option=node("option",label);option.value=key;control.appendChild(option);}
    control.value=value;return control;
  };
  const category=select([["rpg","RPG & fantasy (recommended)"],
    ["settlements","Settlements & structures"],["travel","Roads & travel"],
    ["nature","Nature & terrain"],["danger","Combat & danger"],
    ["magic","Magic & mystery"],["creatures","Characters & creatures"],
    ["all","Advanced — all icons, including modern brands"]],"rpg");
  category.setAttribute("aria-label","RPG icon category");
  const style=select([["all","All Free icon styles"],["solid","Solid"],
    ["regular","Regular"],["brands","Brands"]],"all");
  style.setAttribute("aria-label","Font Awesome icon style");
  const preview=node("section");
  preview.style.cssText="display:grid;justify-items:center;gap:.3rem;padding:.65rem;border:1px solid #8a70c6;border-radius:.5rem;";
  preview.setAttribute("aria-label","Selected icon preview");
  const picture=node("div"),previewName=node("strong"),previewDetails=node("small");
  picture.style.cssText="height:56px;min-width:56px;display:grid;place-items:center;";
  preview.append(picture,previewName,previewDetails);
  const chosen=node("div");
  sidebar.append(node("strong","Search"),search,node("small","Icon style"),style,preview,chosen);
  const tabs=node("div");tabs.style.cssText="display:flex;gap:.25rem;flex-wrap:wrap;";
  const tabButtons=[];
  for(const [id,label] of [["rpg","RPG picks"],["settlements","Places"],
    ["travel","Travel"],["nature","Nature"],["danger","Danger"],
    ["magic","Magic"],["creatures","Creatures"],["all","All / Advanced"]]){
    const button=node("button",label);button.type="button";
    button.setAttribute("aria-label","Browse "+label+" checkpoint icons");
    button.addEventListener("click",()=>{category.value=id;render(true);});
    tabs.appendChild(button);tabButtons.push([id,button]);
  }
  const quick=node("div");quick.style.cssText="display:flex;flex-wrap:wrap;gap:.25rem;";
  const result=node("small");result.setAttribute("aria-live","polite");
  const grid=node("div");
  grid.style.cssText="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:.35rem;max-height:325px;overflow-y:auto;padding:.2rem;";
  const more=node("button","Show 36 more icons");more.type="button";
  more.style.cssText="display:block;margin:.5rem auto;";
  gallery.append(tabs,node("small","Original quick picks (existing icons remain compatible)"),
    quick,result,grid,more);
  const choices=new Map();
  const refreshSelection=()=>{
    const info=details.get(selected);
    const glyph=createCheckpointIconGlyph(selected);
    glyph.style.fontSize="46px";
    if(CHECKPOINT_ICONS.includes(selected)){glyph.style.width="44px";glyph.style.height="44px";}
    picture.replaceChildren(glyph);
    previewName.textContent=info?.label??selected;
    previewDetails.textContent=info
      ?selected.split(":")[0]+" · "+(info.terms||"Font Awesome Free")
      :"Classic Atlas icon · existing save compatible";
    chosen.replaceChildren(node("strong","Selected:"),node("span",selected));
    for(const [id,button] of choices){
      button.style.borderColor=id===selected?"#8a70c6":"transparent";
      button.setAttribute("aria-pressed",String(id===selected));
    }
  };
  const buttonFor=(id,label,compact=false)=>{
    const button=node("button");button.type="button";
    button.title=id+" — "+label;
    button.setAttribute("aria-label","Use "+label+" checkpoint icon");
    button.style.cssText="display:grid;justify-items:center;gap:.2rem;padding:.35rem;border:2px solid transparent;min-height:"+(compact?42:69)+"px;";
    button.appendChild(createCheckpointIconGlyph(id));
    if(!compact)button.appendChild(node("small",label));
    button.addEventListener("click",()=>{selected=id;onChange(id);refreshSelection();});
    choices.set(id,button);return button;
  };
  for(const id of CHECKPOINT_ICONS)quick.appendChild(buttonFor(id,id,true));
  let visible=36;
  const render=(reset=false)=>{
    if(reset)visible=36;
    for(const id of [...choices.keys()])if(!CHECKPOINT_ICONS.includes(id))choices.delete(id);
    const matching=findCheckpointIcons(search.value,style.value,category.value);
    grid.replaceChildren();
    for(const item of matching.slice(0,visible))grid.appendChild(buttonFor(item.id,item.label));
    result.textContent=matching.length+" matching Free icons · showing "+
      Math.min(visible,matching.length)+". Bundled locally; no API key needed.";
    for(const [id,tab] of tabButtons){
      tab.style.borderColor=id===category.value?"#9c7bf0":"transparent";
      tab.setAttribute("aria-pressed",String(id===category.value));
    }
    more.hidden=visible>=matching.length;refreshSelection();
  };
  search.addEventListener("input",()=>render(true));
  style.addEventListener("change",()=>render(true));
  category.addEventListener("change",()=>render(true));
  more.addEventListener("click",()=>{visible+=36;render();});
  render(true);
  return {element:section,get value(){return selected;},set value(id){selected=id;refreshSelection();}};
}
