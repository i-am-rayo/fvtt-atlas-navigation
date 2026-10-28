import { journalUuidFor, openAtlasJournal } from "./atlas-journal-links.js";

/** A reusable GM-only native Journal selector; never changes document ownership. */
export function journalLinkFields(links,kind,id,{fieldName="atlasJournalUuid"}={}) {
  const current=journalUuidFor(links,kind,id);
  const wrap=document.createElement("fieldset");
  wrap.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);padding:.65rem;margin:.5rem 0;min-width:0;";
  const legend=document.createElement("legend");
  legend.textContent="Linked Journal Entry or Page";
  wrap.append(legend);
  const description=document.createElement("p");
  description.textContent="Attach a Journal Entry or an individual Page. Player access follows native Foundry Journal and Page permissions; Atlas never grants access.";
  wrap.append(description);
  const uuidLabel=document.createElement("label");
  uuidLabel.textContent="Linked Journal / Page UUID — paste or drag here";
  uuidLabel.style.cssText="display:block;margin-bottom:.4rem;";
  const input=document.createElement("input");
  input.type="text";input.name=fieldName;
  input.placeholder="Paste @UUID[…] or JournalEntry.… (drag from Journal directory)";
  input.value=current??"";input.defaultValue=current??"";
  input.style.width="100%";
  input.maxLength=300;
  input.addEventListener("dragover",event=>event.preventDefault());
  input.addEventListener("drop",event=>{
    event.preventDefault();
    try {
      const data=JSON.parse(event.dataTransfer?.getData("text/plain")??"");
      if(!["JournalEntry","JournalEntryPage"].includes(data.type)||typeof data.uuid!=="string")
        throw Error("Drop a Journal Entry or Journal Entry Page.");
      input.value=data.uuid;
      input.dispatchEvent(new Event("input",{bubbles:true}));
      input.dispatchEvent(new Event("change",{bubbles:true}));
    } catch(error) {
      ui.notifications?.warn?.(error.message||"Drop a Foundry Journal Entry.");
    }
  });
  uuidLabel.append(input);wrap.append(uuidLabel);
  const open=document.createElement("button");
  open.type="button";open.textContent="Open Linked Journal or Page";
  open.disabled=!current;
  open.style.cssText="width:100%;margin-top:.4rem;";
  open.addEventListener("click",()=>void openAtlasJournal(current).catch(error=>
    ui.notifications.error(error.message||String(error))));
  wrap.append(open);
  return wrap;
}
export function journalUuidFromForm(value) {
  const uuid=String(value??"").trim();
  return uuid||null;
}
