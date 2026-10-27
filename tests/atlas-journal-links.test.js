import test from "node:test";
import assert from "node:assert/strict";
import { defaultAtlasJournalLinks, validateAtlasJournalLinks,
  journalUuidFor, setJournalUuid, validJournalUuid }
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
test("only JournalEntry UUIDs and known schema fields are allowed",()=>{
  assert.ok(validJournalUuid(roadUuid));
  assert.ok(validJournalUuid(checkpointUuid));
  for (const bad of ["", "Actor.abcdefghijklmnop",
    "JournalEntry.abc", "Compendium.world.travel.Actor.ABCDEFGHIJKLMNOP",
    "JournalEntry.abcdefghijklmnop.JournalEntryPage.abcdefghijklmnop"]) {
    assert.ok(!validJournalUuid(bad),bad);
    assert.throws(()=>setJournalUuid(null,"road","r1",bad));
  }
  assert.throws(()=>validateAtlasJournalLinks({schemaVersion:1,roads:{},checkpoints:{},legacy:{}}));
});
