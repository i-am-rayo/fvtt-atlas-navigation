/**
 * Read-only preflight for the Sunday native Scene JSON handoff.
 * Does NOT create a proprietary import/export format or copy external
 * Journals/assets. Foundry owns Scene/native Region serialization.
 */
import {readAtlas} from "./atlas-storage.js";
import {readAtlasJournalLinks} from "./atlas-journal-links.js";
import {readPendingTerritoryCellTransfer} from "./territory-grid-transfer.js";

const elem=(tag,txt)=>{
  const e=document.createElement(tag);
  if(txt!==undefined)e.textContent=txt;
  return e;
};

export function atlasPortabilitySnapshot(scene) {
  if(!globalThis.game?.user?.isGM||!scene?.id||
      !scene.canUserModify?.(game.user,"update"))
    throw Error("Only a Scene-authorized GM can audit Atlas portability.");
  const atlas=readAtlas(scene);
  const links=readAtlasJournalLinks(scene);
  // Native Scene image and external checkpoint icons are NOT embedded in
  // Foundry Scene JSON; collecting paths cannot prove they exist elsewhere.
  const assets=new Set();
  for(const path of [
    scene.background?.src,scene.foreground,
    ...(atlas.checkpoints??[]).map(cp=>cp.appearance?.type==="image"
      ? cp.appearance.image:null)
  ]){
    if(typeof path==="string"&&path.trim())assets.add(path.trim());
  }
  // Fail closed when pending native batch recovery is invalid or unresolved.
  let pending=null;
  let recoveryError=null;
  try{pending=readPendingTerritoryCellTransfer(scene);}
  catch(error){recoveryError=error.message??String(error);}
  const journalUUIDs=[...new Set([
    ...Object.values(links.roads),...Object.values(links.checkpoints)
  ])];
  const regions=[...(scene.regions?.contents??scene.regions??[])];
  return {
    sceneId:scene.id,revision:atlas.revision,schemaVersion:atlas.schemaVersion,
    roads:atlas.roads?.length??0,checkpoints:atlas.checkpoints?.length??0,
    regions:regions.length,
    regionBehaviors:regions.reduce((sum,region)=>
      sum+(region.behaviors?.contents?.length??region.behaviors?.length??0),0),
    journals:journalUUIDs,
    assets:[...assets],
    pendingRecovery:Boolean(pending)||Boolean(recoveryError),
    pendingRecoveryCount:pending?.records?.length??0,
    recoveryError
  };
}

export function createAtlasWorkspacePortabilityPanel(scene) {
  const snapshot=atlasPortabilitySnapshot(scene);
  const root=elem("section");
  root.setAttribute("data-atlas-portability-panel","");
  root.appendChild(elem("h3","Native Scene export & import preflight"));
  root.appendChild(elem("p","Export this Scene using Foundry's native Scene " +
    "directory Export Data action, then import into a backed-up destination " +
    "World. Atlas Scene flags, native Regions and Shapes are owned by Foundry. " +
    "External assets and Journal documents are NOT included in this export."));
  const details=elem("dl");
  for(const [label,value] of [
    ["Atlas graph revision",String(snapshot.revision)],
    ["Schema version",String(snapshot.schemaVersion)],
    ["Roads / Checkpoints",snapshot.roads+" / "+snapshot.checkpoints],
    ["Native Regions / Behaviors",snapshot.regions+" / "+snapshot.regionBehaviors],
    ["Referenced Journals / Pages",String(snapshot.journals.length)],
    ["External map/icon asset paths",String(snapshot.assets.length)]
  ]){
    const row=elem("div");row.className="atlas-workspace-stat";
    row.append(elem("dt",label),elem("dd",value));details.appendChild(row);
  }
  root.appendChild(details);
  if(snapshot.pendingRecovery){
    const alert=elem("p",snapshot.recoveryError
      ? "STOP: The native Region recovery state is invalid: "+
        snapshot.recoveryError+". Preserve the source World and review recovery."
      : "STOP: "+snapshot.pendingRecoveryCount+
        " native Region recovery record(s) require GM review before export.");
    alert.setAttribute("role","alert");
    alert.setAttribute("data-atlas-portability-blocked","");
    root.appendChild(alert);
  }else{
    root.appendChild(elem("p","No pending Atlas native Region transfer " +
      "recovery was detected. Back up the World before proceeding."));
  }
  const assets=elem("details");
  assets.appendChild(elem("summary","Referenced external asset paths ("+
    snapshot.assets.length+")"));
  for(const path of snapshot.assets){
    assets.appendChild(elem("p",path));
  }
  assets.appendChild(elem("p","The destination Foundry installation must " +
    "serve these paths separately. Verify background, icons and thumbnail " +
    "on both GM and player clients."));
  root.appendChild(assets);
  const journalDetails=elem("details");
  journalDetails.appendChild(elem("summary","Referenced Journal UUIDs ("+
    snapshot.journals.length+")"));
  for(const uuid of snapshot.journals){
    journalDetails.appendChild(elem("p",uuid));
  }
  root.appendChild(journalDetails);
  const status=elem("p","Journal UUIDs have not yet been checked in this World.");
  status.setAttribute("aria-live","polite");
  root.appendChild(status);
  const check=elem("button","Check Journal UUID resolution (read-only)");
  check.type="button";
  check.disabled=snapshot.journals.length===0;
  check.addEventListener("click",async event=>{
    event.preventDefault();check.disabled=true;
    try{
      if(!game.user?.isGM||scene.id!==snapshot.sceneId)
        throw Error("Only the source Scene GM may verify linked Journals.");
      const lookup=globalThis.foundry?.utils?.fromUuid??globalThis.fromUuid;
      if(typeof lookup!=="function")
        throw Error("Foundry Journal UUID resolution is unavailable.");
      const missing=[];
      for(const uuid of snapshot.journals){
        const document=await lookup(uuid).catch(()=>null);
        if(!document||!["JournalEntry","JournalEntryPage"].includes(document.documentName))
          missing.push(uuid);
      }
      status.textContent=missing.length
        ? missing.length+" of "+snapshot.journals.length+
          " referenced Journals could not be resolved. Check shared " +
          "Compendium availability and UUIDs before transfer: "+missing.join(", ")
        : "All "+snapshot.journals.length+
          " Journal UUIDs resolve for this GM in this World. " +
          "Destination GM/player permissions must be checked separately.";
    }catch(error){
      status.textContent="Journal preflight unavailable: "+
        (error.message??String(error));
    }finally{check.disabled=false;}
  });
  root.appendChild(check);
  root.appendChild(elem("p","Before Sunday handoff: verify the destination " +
    "background and icons, Journal UUID and access permissions, native Region " +
    "Shapes/Behaviors, Atlas flags and player Fog. Export the destination " +
    "Scene again and compare semantic counts/IDs. Do not import over an " +
    "existing Scene or bypass pending Region recovery."));
  return root;
}
