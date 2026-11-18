/**
 * Presentation-only select controls used throughout Atlas settings.
 * DialogV2 may serialize supplied DOM to HTML, so a live `select.value` is
 * insufficient: exactly one option also needs the reflected `selected` attr.
 * This module deliberately has no Foundry imports or persistence side effects.
 */
const create=(tag,text)=>{
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=text;
  return element;
};

/** Groups use {label: null|string, options: [[id, label, {disabled?}], ...]}. */
export function createSettingsGroupedSelect(groups,{
  selectedId=null,name=null,ariaLabel=null,onChange=null
}={}){
  const select=create("select");
  if(name!==null)select.name=name;
  if(ariaLabel)select.setAttribute("aria-label",ariaLabel);
  const options=[];
  for(const group of groups){
    const parent=group.label==null?select:create("optgroup");
    if(parent!==select)parent.label=group.label;
    for(const [id,label,metadata] of group.options){
      const option=create("option",label);
      const key=String(id);
      option.value=key;
      const disabled=metadata?.disabled===true;
      if(disabled)option.setAttribute("disabled","");
      options.push({element:option,key,disabled});
      parent.appendChild(option);
    }
    if(parent!==select)select.appendChild(parent);
  }
  const requested=String(selectedId??"");
  const active=options.some(option=>option.key===requested&&!option.disabled)
    ?requested:(options.find(option=>!option.disabled)?.key??"");
  for(const option of options)option.element.defaultSelected=option.key===active;
  select.value=active;
  select.addEventListener("change",()=>{
    const current=String(select.value);
    for(const option of options)option.element.defaultSelected=option.key===current;
    onChange?.(current,select);
  });
  return select;
}

/** Small wrapper for ungrouped option lists; same default and event rules. */
export function createSettingsSelect(choices,options={}){
  return createSettingsGroupedSelect([{label:null,options:choices}],options);
}
