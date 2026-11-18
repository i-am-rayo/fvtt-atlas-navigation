/**
 * Stateless layout primitives for Atlas settings editors.
 * Callers own data, permission checks, persistence, and dialog lifecycle.
 */
export function createSettingsFieldRow(title,control,{variant="native"}={}){
  if(typeof title!=="string"||!title.trim()||typeof control?.appendChild!=="function")
    throw new Error("Atlas settings fields require a label and DOM control.");
  const row=document.createElement(variant==="native-div"?"div":"label");
  if(variant==="native"||variant==="native-div")row.className="form-group";
  else if(variant==="split"){
    row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:1rem;";
    control.style.maxWidth="16rem";
  }else if(variant==="grid"){
    row.style.cssText="display:grid;grid-template-columns:minmax(130px,1fr) minmax(160px,1.4fr);gap:.6rem;align-items:center;";
  }else throw new Error("Unknown Atlas settings row layout.");
  const caption=document.createElement(variant==="native-div"?"label":"span");
  caption.textContent=title;
  row.append(caption,control);
  return row;
}

export function appendSettingsField(parent,title,control,options){
  parent.appendChild(createSettingsFieldRow(title,control,options));
  return control;
}
