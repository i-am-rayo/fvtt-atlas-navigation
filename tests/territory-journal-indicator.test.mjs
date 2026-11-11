import test from "node:test";
import assert from "node:assert/strict";
import {territoryCheckpointJournal,territoryJournalBadgeData}
  from "../scripts/territory-journal-indicator.js";

const journal="JournalEntry.abcdefghijklmnop";
const page=journal+".JournalEntryPage.ABCDEFGHIJKLMNOP";
const links=uuid=>({schemaVersion:1,roads:{},checkpoints:{cp:uuid}});
const native=flag=>({getFlag:(_mod,key)=>key==="territoryCheckpoint"?flag:null});
const checkpoint=new Map([["cp",{id:"cp",name:"Genasi Village"}]]);

test("Territory Journal projection uses stable Checkpoint ID and rejects missing or invalid links",()=>{
  const linked=native({schemaVersion:1,checkpointId:"cp"});
  assert.deepEqual(territoryCheckpointJournal(linked,checkpoint,links(page)),
    {uuid:page,checkpointId:"cp",checkpointName:"Genasi Village"});
  assert.equal(territoryCheckpointJournal(linked,checkpoint,links(null)),null);
  assert.equal(territoryCheckpointJournal(linked,new Map(),links(page)),null);
  assert.equal(territoryCheckpointJournal(native(null),checkpoint,links(page)),null);
  assert.equal(territoryCheckpointJournal(native({schemaVersion:14,checkpointId:"cp"}),
    checkpoint,links(page)),null);
  assert.equal(territoryCheckpointJournal(linked,checkpoint,null),null);
});

test("Journal badge requires verified GM access and summarizes Observer access per player",async()=>{
  const prior={foundry:globalThis.foundry,game:globalThis.game};
  const gm={id:"gm",isGM:true};
  const p1={id:"p1",isGM:false},p2={id:"p2",isGM:false};
  try{
    const doc={documentName:"JournalEntryPage",
      testUserPermission:user=>user.id==="p1"};
    globalThis.foundry={utils:{fromUuid:async uuid=>uuid===page?doc:null}};
    globalThis.game={user:gm,users:[gm,p1,p2]};
    assert.deepEqual(await territoryJournalBadgeData(page),
      {text:"📖 ◐",status:"1 of 2 players have Observer access"});
    assert.equal(await territoryJournalBadgeData(page,{viewer:p1}),null,
      "non-GM cannot query private Region Journal badges");
    assert.equal(await territoryJournalBadgeData(journal),null,
      "stale native Journal links are omitted");
    doc.testUserPermission=()=>true;
    assert.equal((await territoryJournalBadgeData(page)).text,"📖 ✓");
    doc.testUserPermission=()=>false;
    assert.equal((await territoryJournalBadgeData(page)).text,"📖 🔒");
    assert.equal((await territoryJournalBadgeData(page,{users:[gm]})).text,"📖 —");
  }finally{globalThis.foundry=prior.foundry;globalThis.game=prior.game;}
});
