/** Common GM-only dialog for legacy single-action native cost presets. */
import { createSettingsSelect } from "./settings-select.js";

export async function promptNativeMovementAction({title,message,actions,
  invalidMessage="Choose a supported movement action."}){
  const content=document.createElement("div");
  const description=document.createElement("p");
  description.textContent=message;
  const select=createSettingsSelect([
    ["","Choose movement action…"],
    ...actions.map(action=>[action.id,game.i18n.localize(action.label)||action.label])
  ],{name:"atlasMovementAction",selectedId:""});
  content.append(description,select);
  const choice=await foundry.applications.api.DialogV2.input({
    window:{title},content,ok:{label:"Review Cost"},
    rejectClose:false,modal:true
  });
  if(!choice)return null;
  const action=actions.find(item=>item.id===choice.atlasMovementAction);
  if(!action)throw Error(invalidMessage);
  return action;
}
