/**
 * Small, presentation-only primitives for settings forms. Set both the live
 * state and its HTML-serializable default: Foundry v14 may recreate DialogV2
 * content from markup, and other Atlas editors render DOM nodes directly.
 */
export function createSettingsInput(type, value, {
  name=null, ariaLabel=null, min=null, max=null, step=null
}={}) {
  const input=document.createElement("input");
  input.type=type;
  if(type==="checkbox") {
    input.checked=Boolean(value);
    input.defaultChecked=Boolean(value);
  } else {
    const initial=String(value??"");
    input.value=initial;
    input.defaultValue=initial;
  }
  if(name!==null)input.name=name;
  if(ariaLabel)input.setAttribute("aria-label",ariaLabel);
  if(min!=null)input.min=String(min);
  if(max!=null)input.max=String(max);
  if(step!=null)input.step=String(step);
  if(type==="checkbox")input.addEventListener("change",()=>{
    input.defaultChecked=Boolean(input.checked);
  });
  else input.addEventListener("input",()=>{input.defaultValue=input.value;});
  return input;
}

/** Read the actual checked state, never an HTML checkbox's fixed value attr. */
export function settingsFormValues(fields) {
  return Object.fromEntries([...fields].filter(field=>field.name).map(field =>
    [field.name,field.type==="checkbox"?Boolean(field.checked):field.value]));
}
