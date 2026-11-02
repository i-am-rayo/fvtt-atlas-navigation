import assert from "node:assert/strict";
import test from "node:test";
import { createJourneyRecord,checkpointJourneyRecord,resumeJourneyRecord,
  eligibleJourneyRecord,formatJourneyJournalHTML,saveJourneyJournal,
  findRecoverableJourney,ensureJourneyLogFolder,JOURNEY_JOURNAL_FLAG,
  JOURNEY_JOURNAL_PAGE,JOURNEY_JOURNAL_FOLDER }
  from "../scripts/navigation-journey-journal.js";
const MODULE_ID="fvtt-atlas-navigation";
const itinerary=()=>({schemaVersion:1,scene:{name:"Paedor",units:"km"},
  endpoints:{departure:{x:0,y:0},destination:{x:120,y:30}},
  measurements:{distance:94.2,travelHours:18,terrainAware:false},
  travel:{speedPerHour:94.2/18},directions:[
    {kind:"road",instruction:"Continue on <Bridge> & Road",distance:94.2,cost:94.2,
      terrain:"Stone Road",roadId:"road"}
  ]});
const createRecord=()=>createJourneyRecord({sceneId:"scene",tokenId:"token",
  atlasRevision:12,itinerary:itinerary(),now:"2026-11-02T12:00:00Z"});
const schedule={completedHours:8,todayHours:0,permittedExtraUntil:0,
  restEvents:1,lastForcedCheck:null,
  events:[{action:"long",atHours:8,hours:8}]};

test("one versioned record contains readable route, rest history, and recovery status",()=>{
  const created=createRecord();
  assert.equal(created.status,"moving");
  assert.deepEqual(created.destination,{x:120,y:30});
  assert.equal(created.legs.length,1);
  assert.equal(created.legs[0].directions.length,1);
  const changed=checkpointJourneyRecord(created,{schedule,progress:45,status:"interrupted",
    worldTravelSeconds:28800,worldRestSeconds:28800});
  assert.equal(changed.status,"interrupted");
  assert.equal(changed.legs[0].completedMovingHours,8);
  assert.equal(changed.day.restEvents,1);
  assert.equal(created.status,"moving","saved metadata is not mutated in place");
  assert.equal(eligibleJourneyRecord(changed,{sceneId:"scene",tokenId:"token",atlasRevision:12}),true);
  assert.equal(eligibleJourneyRecord(changed,{sceneId:"scene",tokenId:"other",atlasRevision:12}),false);
  assert.equal(eligibleJourneyRecord(changed,{sceneId:"scene",tokenId:"token",atlasRevision:13}),false);
  const html=formatJourneyJournalHTML(changed);
  assert.match(html,/Interrupted — may resume/);
  assert.match(html,/Long Rest/);
  assert.match(html,/Confirmed progress: 45%/);
  assert.match(html,/Only confirmed travel and approved stops/);
  assert.match(html,/Moving time: 18h/,
    "full intended itinerary remains available as metadata");
  assert.doesNotMatch(html,/94\.20 km<\/li>/,
    "an interrupted leg must not claim all planned directions were traveled");
  assert.match(html,/&lt;Bridge&gt; &amp; Road/);
  assert.doesNotMatch(html,/<Bridge>/);
  const resumed=resumeJourneyRecord(changed,{itinerary:itinerary(),atlasRevision:12});
  assert.equal(resumed.legs.length,2);
  assert.equal(resumed.status,"moving");
  assert.equal(resumed.day.restEvents,1);
  assert.equal(eligibleJourneyRecord({...resumed,status:"completed"},
    {sceneId:"scene",tokenId:"token",atlasRevision:12}),false);
  assert.throws(()=>resumeJourneyRecord(changed,{itinerary:itinerary(),atlasRevision:13}),/cannot safely/);
});

test("an interrupted Journal renders only reached directions and approved rests",()=>{
  const record=createRecord();
  record.legs[0].directions=[
    {kind:"road",instruction:"Head to First Stop",distance:47.1,cost:47.1},
    {kind:"road",instruction:"Head to Final Stop",distance:47.1,cost:47.1}
  ];
  const partial=checkpointJourneyRecord(record,{schedule:{...schedule,
    completedHours:6,events:[{action:"short",atHours:5,hours:1}]},
    progress:33.333,status:"interrupted"});
  const html=formatJourneyJournalHTML(partial);
  assert.match(html,/First Stop/);
  assert.match(html,/Short Rest/);
  assert.doesNotMatch(html,/Final Stop/);
  assert.equal(partial.legs[0].directions.length,2,
    "the persisted full route is not edited to fit the confirmed summary");
});

test("Journal creation, metadata updates, and the managed summary all use one record",async()=>{
  const prev={game:globalThis.game,CONST:globalThis.CONST};
  const created=[];
  try{
    globalThis.game={user:{isGM:true}};
    globalThis.CONST={JOURNAL_ENTRY_PAGE_FORMATS:{HTML:1},DOCUMENT_OWNERSHIP_LEVELS:{NONE:0}};
    const page={id:"page-1",name:JOURNEY_JOURNAL_PAGE};
    const journal={id:"journal-1",pages:[page],history:[],
      async update(changes){this.history.push(["flags",changes]);},
      async updateEmbeddedDocuments(type,changes){this.history.push([type,changes]);},
      getFlag(namespace,key){return namespace===MODULE_ID&&key===JOURNEY_JOURNAL_FLAG?
        this.record:null;}};
    const creation=async data=>{created.push(data);journal.record=data.flags[MODULE_ID][JOURNEY_JOURNAL_FLAG];return journal;};
    assert.equal(await saveJourneyJournal(createRecord(),{create:creation,
      folderProvider:async()=>({id:"folder-1"})}),journal);
    assert.equal(created.length,1);
    assert.equal(created[0].folder,"folder-1");
    assert.equal(created[0].ownership.default,0,"Journeys are GM-only by default");
    assert.match(created[0].pages[0].text.content,/Directions/);
    const updated=checkpointJourneyRecord(createRecord(),{schedule,progress:45,status:"paused"});
    await saveJourneyJournal(updated,{journal});
    assert.equal(journal.history.length,2);
    assert.equal(journal.history[0][1][`flags.${MODULE_ID}.${JOURNEY_JOURNAL_FLAG}`].status,"paused");
    assert.equal(journal.history[1][0],"JournalEntryPage");
    const candidates=[{...journal,getFlag:()=>updated}];
    assert.equal(findRecoverableJourney(candidates,
      {sceneId:"scene",tokenId:"token",atlasRevision:12}),candidates[0]);
    globalThis.game.user.isGM=false;
    await assert.rejects(saveJourneyJournal(updated,{journal}),/Only a GM/);
  }finally{globalThis.game=prev.game;globalThis.CONST=prev.CONST;}
});

test("Atlas Journey Journals share a native Journal folder and reuse its stable ID",async()=>{
  const before=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    const folders=[];
    const created=[];
    const create=async data=>{
      created.push(data);
      const folder={id:"atlas-log-folder",...data};
      folders.push(folder);
      return folder;
    };
    const [first,parallel]=await Promise.all([
      ensureJourneyLogFolder({folders,create}),
      ensureJourneyLogFolder({folders,create})
    ]);
    assert.equal(first.id,parallel.id);
    assert.equal(created.length,1,"concurrent journeys must not duplicate the folder");
    assert.equal(created[0].type,"JournalEntry");
    assert.equal(created[0].name,JOURNEY_JOURNAL_FOLDER);
    const reused=await ensureJourneyLogFolder({folders,create});
    assert.equal(reused.id,first.id);
    assert.equal(created.length,1);
  }finally{globalThis.game=before;}
});
