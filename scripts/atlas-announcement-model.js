/** Pure, system-neutral presentation catalog. No Foundry, Scene or Journey access.
 * Future event producers must validate an authoritative commit separately. */
export const ATLAS_ANNOUNCEMENT_SCHEMA = 1;

export const ATLAS_ANNOUNCEMENT_TYPES = Object.freeze([
  {id:"checkpoint.discovered",label:"Checkpoint discovered",eyebrow:"Location Discovered",
    lead:"You have found",subject:"Port Barthos",icon:"✦",theme:"discovery"},
  {id:"road.discovered",label:"Road discovered",eyebrow:"New Path Discovered",
    lead:"The path is revealed",subject:"Millstone–Dirwest Road",icon:"⌁",theme:"discovery"},
  {id:"checkpoint.arrived",label:"Checkpoint reached",eyebrow:"Checkpoint Reached",
    lead:"You have arrived at",subject:"Port Barthos",icon:"⚑",theme:"arrival"},
  {id:"destination.reached",label:"Destination reached",eyebrow:"Destination Reached",
    lead:"Welcome to",subject:"Dirwest",icon:"✧",theme:"success"},
  {id:"journey.started",label:"Journey started",eyebrow:"The Journey Begins",
    lead:"The road ahead leads to",subject:"Hearth's Heart",icon:"➜",theme:"journey"},
  {id:"journey.ended",label:"Journey ended",eyebrow:"Journey Concluded",
    lead:"The expedition has ended",subject:"Until the next adventure",icon:"◆",theme:"ending"},
  {id:"break.started",label:"Break started",eyebrow:"Time to Rest",
    lead:"The party takes a",subject:"Long Rest",icon:"☾",theme:"rest"},
  {id:"break.ended",label:"Break ended",eyebrow:"Rest Complete",
    lead:"The party is ready to travel",subject:"The road awaits",icon:"☀",theme:"rest"},
  {id:"journey.paused",label:"Journey paused",eyebrow:"Journey Paused",
    lead:"Awaiting the GM's next decision",subject:"Travel is on hold",icon:"Ⅱ",theme:"pause"},
  {id:"journey.awaiting-gm",label:"Journey awaiting GM",eyebrow:"Journey Paused",
    lead:"Awaiting the GM's next decision",subject:"Travel is on hold",icon:"Ⅱ",theme:"pause"},
  {id:"journey.interrupted",label:"Journey interrupted",eyebrow:"Journey Interrupted",
    lead:"GM review is required",subject:"Travel is on hold",icon:"!",theme:"pause"}
].map(item=>Object.freeze(item)));

const LOOKUP = new Map(ATLAS_ANNOUNCEMENT_TYPES.map(item=>[item.id,item]));
const cleanText = (text,field) => {
  if(typeof text!=="string"||!text.trim()||text.length>160||
      /[\u0000-\u001f\u007f]/.test(text))
    throw new Error(`Atlas announcement ${field} must be 1–160 readable characters.`);
  return text.trim();
};

/** Display-only sample, never evidence of a committed gameplay transition. */
export function atlasAnnouncementPreview(type,{subject}={}){
  const item=LOOKUP.get(type);
  if(!item)throw new Error("Unsupported Atlas announcement type.");
  const finalSubject=cleanText(subject??item.subject,"subject");
  return Object.freeze({schemaVersion:ATLAS_ANNOUNCEMENT_SCHEMA,type:item.id,
    theme:item.theme,icon:item.icon,eyebrow:item.eyebrow,
    lead:type==="destination.reached"&&finalSubject==="your destination"?
      "You have reached":item.lead,subject:finalSubject});
}
