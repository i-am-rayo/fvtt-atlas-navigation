import test from "node:test";
import assert from "node:assert/strict";
import {overlayJournalLabelSuffix,OverlayJournalStatusCache,attachOverlayJournalSuffix}
  from "../scripts/overlay-journal-label.js";

const uuid="JournalEntry.abcdefghijklmnop";
test("GM gets all-player Journal status; players get only their own permitted book glyph",async()=>{
  const previous={foundry:globalThis.foundry,game:globalThis.game};
  const gm={id:"gm",isGM:true},reader={id:"read",isGM:false},
    hidden={id:"hidden",isGM:false};
  try{
    globalThis.game={user:gm,users:[gm,reader,hidden]};
    globalThis.foundry={utils:{fromUuid:async ref=>ref===uuid?{
      documentName:"JournalEntry",testUserPermission:user=>user.id==="read"}:null}};
    assert.equal(await overlayJournalLabelSuffix(uuid)," 📖 ◐");
    assert.equal(await overlayJournalLabelSuffix(uuid,{viewer:reader})," 📖");
    assert.equal(await overlayJournalLabelSuffix(uuid,{viewer:hidden}),"",
      "unprivileged players never see other users' Observer counts");
    assert.equal(await overlayJournalLabelSuffix("JournalEntry.missing"),"");
    globalThis.foundry.utils.fromUuid=async()=>null;
    assert.equal(await overlayJournalLabelSuffix(uuid),"",
      "stale or deleted Journals never advertise a readable status");
  }finally{Object.assign(globalThis,previous);}
});

test("bounded overlay status cache updates live labels, never stale or detached labels",async()=>{
  const previous={foundry:globalThis.foundry,game:globalThis.game};
  const gm={id:"gm",isGM:true};
  let now=0,queries=0,valid=true;
  try{
    globalThis.game={user:gm,users:[gm]};
    globalThis.foundry={utils:{fromUuid:async()=>{
      queries++;return {documentName:"JournalEntry"};}}};
    const cache=new OverlayJournalStatusCache({now:()=>now,ttlMs:100});
    const first={text:"Dirwest"},second={text:"Genasi Village"};
    attachOverlayJournalSuffix(cache,uuid,first,"Dirwest",()=>valid);
    attachOverlayJournalSuffix(cache,uuid,second,"Genasi Village",()=>valid);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(first.text,"Dirwest 📖 —");
    assert.equal(second.text,"Genasi Village 📖 —");
    assert.equal(queries,1,"two overlays reuse one permission lookup per UUID");
    valid=false;
    const detached={text:"Old label"};
    attachOverlayJournalSuffix(cache,uuid,detached,"Old label",()=>valid);
    assert.equal(detached.text,"Old label","stale labels cannot be updated");
    now=101;
    const updated={text:"New Dirwest"};
    attachOverlayJournalSuffix(cache,uuid,updated,"New Dirwest",()=>true);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(queries,2,"expired status is refreshed without a World/Scene write");
    assert.equal(updated.text,"New Dirwest 📖 —");
    cache.clear();
    assert.equal(cache.entries.size,0);
  }finally{Object.assign(globalThis,previous);}
});
