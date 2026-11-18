import test from "node:test";
import assert from "node:assert/strict";
import { defaultAtlasJournalLinks, validateAtlasJournalLinks,
  journalUuidFor, setJournalUuid, validJournalUuid, normalizeJournalUuid,
  canOpenAtlasJournal }
  from "../scripts/atlas-journal-links.js";

const roadUuid="JournalEntry.abcdefghijklmnop";
const checkpointUuid="Compendium.world.travel.JournalEntry.ABCDEFGHIJKLMNOP";

test("unconfigured Scene has no Journal associations and is not migrated on read",()=>{
  const links=defaultAtlasJournalLinks();
  assert.deepEqual(validateAtlasJournalLinks(null),links);
  assert.equal(journalUuidFor(links,"road","r1"),null);
});
test("road and checkpoint Journal links are independent and reversible",()=>{
  let links=setJournalUuid(null,"road","road-one",roadUuid);
  links=setJournalUuid(links,"checkpoint","checkpoint-one",checkpointUuid);
  assert.equal(journalUuidFor(links,"road","road-one"),roadUuid);
  assert.equal(journalUuidFor(links,"checkpoint","checkpoint-one"),checkpointUuid);
  links=setJournalUuid(links,"road","road-one",null);
  assert.equal(journalUuidFor(links,"road","road-one"),null);
  assert.equal(journalUuidFor(links,"checkpoint","checkpoint-one"),checkpointUuid);
});
test("Journal Entry and Page UUIDs and rich UUID links are allowed",()=>{
  const page="JournalEntry.abcdefghijklmnop.JournalEntryPage.ABCDEFGHIJKLMNOP";
  const packPage=checkpointUuid+".JournalEntryPage.abcdefghijklmnop";
  assert.ok(validJournalUuid(page));
  assert.ok(validJournalUuid(packPage));
  const rich="@UUID["+page+"]{Kenku Woods}";
  assert.ok(validJournalUuid(rich));
  assert.equal(normalizeJournalUuid(rich),page);
  assert.equal(journalUuidFor(setJournalUuid(null,"checkpoint","c1",rich),"checkpoint","c1"),page);
  assert.ok(validJournalUuid(roadUuid));
  assert.ok(validJournalUuid(checkpointUuid));
  for (const bad of ["", "Actor.abcdefghijklmnop",
    "JournalEntry.abc", "Compendium.world.travel.Actor.ABCDEFGHIJKLMNOP",
    "JournalEntry.abcdefghijklmnop.Actor.abcdefghijklmnop",
    "JournalEntry.abcdefghijklmnop.JournalEntryPage.abc"]) {
    assert.ok(!validJournalUuid(bad),bad);
    assert.throws(()=>setJournalUuid(null,"road","r1",bad));
  }
  assert.throws(()=>validateAtlasJournalLinks({schemaVersion:1,roads:{},checkpoints:{},legacy:{}}));
});

test("page access follows the linked Page Observer permission, independently of parent",async()=>{
  const old=globalThis.foundry;
  const user={id:"player",isGM:false};
  const parent={documentName:"JournalEntry",testUserPermission:()=>true};
  const page={documentName:"JournalEntryPage",parent,
    testUserPermission:()=>false};
  globalThis.foundry={utils:{fromUuid:async()=>page}};
  try {
    const uuid="JournalEntry.abcdefghijklmnop.JournalEntryPage.ABCDEFGHIJKLMNOP";
    assert.equal(await canOpenAtlasJournal(uuid,user),false);
    page.testUserPermission=()=>true;
    assert.equal(await canOpenAtlasJournal(uuid,user),true);
    parent.testUserPermission=()=>false;
    assert.equal(await canOpenAtlasJournal(uuid,user),true);
  } finally { globalThis.foundry=old; }
});
