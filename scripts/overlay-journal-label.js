/** Journal status appended only to an already eligible on-canvas label.
 * Never supplies a checkpoint/territory name or grants discovery visibility. */
import {canOpenAtlasJournal} from "./atlas-journal-links.js";
import {territoryJournalBadgeData} from "./territory-journal-indicator.js";

export async function overlayJournalLabelSuffix(uuid,{viewer=globalThis.game?.user,
  users=globalThis.game?.users}={}){
  if(!uuid||!viewer)return "";
  if(viewer.isGM){
    const status=await territoryJournalBadgeData(uuid,{viewer,users});
    return status?` ${status.text}`:"";
  }
  // The other players' Journal permissions are GM-only metadata. A player
  // sees only the generic book glyph when *they* may read an eligible label.
  return await canOpenAtlasJournal(uuid,viewer)?" 📖":"";
}

/** Bounded in-memory permission refresh without re-rendering the whole canvas
 * whenever Foundry resolves an Entry or Page. No Scene/World writes. */
export class OverlayJournalStatusCache {
  constructor({now=()=>Date.now(),ttlMs=15000}={}){
    this.now=now;this.ttlMs=ttlMs;this.entries=new Map();
  }

  clear(){this.entries.clear();}

  get(uuid,{viewer=globalThis.game?.user,users=globalThis.game?.users}={}){
    if(!uuid||!viewer)return null;
    const key=`${viewer.id??"unknown"}:${viewer.isGM?"GM":"player"}:${uuid}`;
    const current=this.entries.get(key);
    if(current&&this.now()-current.started<this.ttlMs)return current;
    const item={value:null,started:this.now(),promise:null};
    item.promise=overlayJournalLabelSuffix(uuid,{viewer,users})
      .then(suffix=>{item.value=suffix;return suffix;})
      .catch(()=>{item.value="";return "";});
    this.entries.set(key,item);
    if(this.entries.size>160)this.entries.delete(this.entries.keys().next().value);
    return item;
  }
}

/** Installs a suffix on the *same* native Pixi Text once permission resolves.
 * Callers must guard scene, label lifecycle, and player discovery in isCurrent. */
export function attachOverlayJournalSuffix(cache,uuid,label,base,isCurrent,onApplied=null){
  if(!label||typeof base!=="string"||!uuid)return;
  const item=cache?.get(uuid);
  if(!item)return;
  const apply=suffix=>{
    if(isCurrent?.()!==true)return;
    label.text=base+suffix;
    onApplied?.(suffix);
  };
  if(item.value!==null)apply(item.value);
  else void item.promise.then(apply);
}
