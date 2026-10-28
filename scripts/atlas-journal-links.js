import { MODULE_ID, readAtlas } from "./atlas-storage.js";

export const ATLAS_JOURNALS_FLAG = "atlasJournalLinks";
export const ATLAS_JOURNALS_SCHEMA = 1;
export function defaultAtlasJournalLinks() {
  return {schemaVersion:ATLAS_JOURNALS_SCHEMA,roads:{},checkpoints:{}};
}
export function validateAtlasJournalLinks(value) {
  if(value==null)return defaultAtlasJournalLinks();
  if(!value||typeof value!=="object"||Array.isArray(value)||
    value.schemaVersion!==ATLAS_JOURNALS_SCHEMA||
    Object.keys(value).some(key=>!["schemaVersion","roads","checkpoints"].includes(key)))
    throw Error("Invalid Atlas Journal association data.");
  const clean={schemaVersion:ATLAS_JOURNALS_SCHEMA};
  for(const type of ["roads","checkpoints"]) {
    const mapping=value[type];
    if(!mapping||typeof mapping!=="object"||Array.isArray(mapping)||
      Object.keys(mapping).length>20000)throw Error("Invalid Atlas Journal links.");
    clean[type]={};
    for(const [id,uuid] of Object.entries(mapping)) {
      if(!id||id.length>160||!validJournalUuid(uuid))throw Error("Invalid Atlas Journal link.");
      clean[type][id]=normalizeJournalUuid(uuid);
    }
  }
  return clean;
}
/** Accept world/pack Journal Entries and individual embedded Journal Entry Pages. */
export function normalizeJournalUuid(value) {
  if(typeof value!=="string")return "";
  const trimmed=value.trim();
  const rich=trimmed.match(/^@UUID\[([^\]]+)\](?:\{[^}]*\})?$/);
  return rich ? rich[1] : trimmed;
}
export function validJournalUuid(value) {
  const uuid=normalizeJournalUuid(value);
  return uuid.length<=300&&
    (/^JournalEntry\.[A-Za-z0-9]{16}(?:\.JournalEntryPage\.[A-Za-z0-9]{16})?$/.test(uuid)||
    /^Compendium\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.JournalEntry\.[A-Za-z0-9]{16}(?:\.JournalEntryPage\.[A-Za-z0-9]{16})?$/.test(uuid));
}
export function readAtlasJournalLinks(scene) {
  return validateAtlasJournalLinks(scene?.getFlag?.(MODULE_ID,ATLAS_JOURNALS_FLAG));
}
export function journalUuidFor(links,kind,id) {
  if(!["road","checkpoint"].includes(kind))throw Error("Unknown Atlas Journal association type.");
  const state=validateAtlasJournalLinks(links);
  return state[kind==="road"?"roads":"checkpoints"][id]??null;
}
export function setJournalUuid(links,kind,id,uuid) {
  if(!["road","checkpoint"].includes(kind)||typeof id!=="string"||
    !id||id.length>160||(uuid!==null&&!validJournalUuid(uuid)))
    throw Error("Invalid Atlas Journal association.");
  const before=validateAtlasJournalLinks(links);
  const prop=kind==="road"?"roads":"checkpoints";
  const collection={...before[prop]};
  if(uuid===null)delete collection[id];
  else collection[id]=normalizeJournalUuid(uuid);
  return validateAtlasJournalLinks({...before,[prop]:collection});
}
async function resolveJournal(uuid) {
  const lookup=globalThis.foundry?.utils?.fromUuid??globalThis.fromUuid;
  if(typeof lookup!=="function")throw Error("Foundry Journal lookup is unavailable.");
  const doc=await lookup(uuid);
  if(!doc||!["JournalEntry","JournalEntryPage"].includes(doc.documentName))
    throw Error("That Journal Entry or Page does not exist or cannot be accessed.");
  return doc;
}
export async function canOpenAtlasJournal(uuid,user=globalThis.game?.user) {
  if(!validJournalUuid(uuid)||!user)return false;
  try {
    const doc=await resolveJournal(normalizeJournalUuid(uuid));
    if(user.isGM)return true;
    const parent=doc.documentName==="JournalEntryPage" ? doc.parent : doc;
    return Boolean(parent?.testUserPermission?.(user,"OBSERVER") &&
      doc.testUserPermission?.(user,"OBSERVER"));
  } catch { return false; }
}
export async function openAtlasJournal(uuid) {
  if(!validJournalUuid(uuid))throw Error("No valid Journal Entry or Page is linked.");
  const doc=await resolveJournal(normalizeJournalUuid(uuid));
  if(!await canOpenAtlasJournal(uuid))
    throw Error("You do not have permission to read this Journal or Page.");
  if(doc.documentName==="JournalEntryPage") {
    const sheet=doc.parent?.sheet;
    if(!sheet)throw Error("The parent Journal sheet is unavailable.");
    await sheet.render({force:true,pageId:doc.id});
    await sheet.goToPage?.(doc.id);
  } else await doc.sheet?.render({force:true});
  return doc;
}
export async function saveAtlasJournalLink(scene,{kind,id,uuid,expected}) {
  if(!game.user?.isGM||!scene?.canUserModify?.(game.user,"update"))
    throw Error("Only a GM may change Atlas Journal links.");
  const before=readAtlasJournalLinks(scene);
  if(JSON.stringify(before)!==JSON.stringify(validateAtlasJournalLinks(expected)))
    throw Error("Atlas Journal links changed. Reopen this settings window.");
  const atlas=readAtlas(scene);
  if(!(kind==="road"?atlas.roads:kind==="checkpoint"?atlas.checkpoints:[])
    ?.some(item=>item.id===id))throw Error("Atlas road or checkpoint no longer exists.");
  if(uuid!==null)await resolveJournal(normalizeJournalUuid(uuid));
  const next=setJournalUuid(before,kind,id,uuid);
  if(JSON.stringify(next)!==JSON.stringify(before))
    await scene.setFlag(MODULE_ID,ATLAS_JOURNALS_FLAG,next);
  return next;
}
