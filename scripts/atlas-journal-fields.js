import { journalUuidFor, openAtlasJournal } from "./atlas-journal-links.js";

/** A reusable GM-only native Journal selector; never changes document ownership. */
export function journalLinkFields(links,kind,id,{fieldName="atlasJournalUuid"}={}) {
  const current=journalUuidFor(links,kind,id);
  const wrap=document.createElement("fieldset");
  wrap.style.cssText="border:1px solid var(--color-border-light-tertiary,#666);padding:.65rem;margin:.5rem 0;min-width:0;";
  const legend=document.createElement("legend");
  legend.textContent="Linked Journal Entry";
  wrap.append(legend);
  const description=document.createElement("p");
  description.textContent="Attach an existing Foundry Journal Entry. This link does not grant player access or change its ownership permissions.";
  wrap.append(description);
  const label=document.createElement("label");
  label.textContent="Choose a World Journal";
  label.style.cssText="display:block;margin-bottom:.4rem;";
  const select=document.createElement("select");
  select.style.width="100%";
  const none=document.createElement("option");
  none.value="";none.textContent="None / Unlink";
  select.append(none);
  const journals=[...(game.journal??[])].sort((a,b)=>a.name.localeCompare(b.name));
  for(const journal of journals) {
    const option=document.createElement("option");
    option.value=journal.uuid;option.textContent=journal.name;
    select.append(option);
  }
  select.value=journals.some(j=>j.uuid===current)?current:"";
  label.append(select);wrap.append(label);
  const uuidLabel=document.createElement("label");
  uuidLabel.textContent="Journal UUID (or drop a Journal here)";
  uuidLabel.style.cssText="display:block;margin-bottom:.4rem;";
  const input=document.createElement("input");
  input.type="text";input.name=fieldName;
  input.placeholder="JournalEntry.… or Compendium.….JournalEntry.…";
  input.value=current??"";input.defaultValue=current??"";
  input.style.width="100%";
  input.maxLength=300;
  select.addEventListener("change",()=>{input.value=select.value;});
  input.addEventListener("change",()=>{select.value=input.value;});
  input.addEventListener("dragover",event=>event.preventDefault());
  input.addEventListener("drop",event=>{
    event.preventDefault();
    try {
      const data=JSON.parse(event.dataTransfer?.getData("text/plain")??"");
      if(data.type!=="JournalEntry"||typeof data.uuid!=="string")
        throw Error("Drop a Journal Entry, not a different document.");
      input.value=data.uuid;select.value=data.uuid;
    } catch(error) {
      ui.notifications?.warn?.(error.message||"Drop a Foundry Journal Entry.");
    }
  });
  uuidLabel.append(input);wrap.append(uuidLabel);
  const open=document.createElement("button");
  open.type="button";open.textContent="Open Linked Journal";
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
