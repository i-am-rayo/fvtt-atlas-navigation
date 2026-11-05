import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import { createJourneyRecord,checkpointJourneyRecord,resumeJourneyRecord,
  eligibleJourneyRecord,formatJourneyJournalHTML,saveJourneyJournal,
  findRecoverableJourney,ensureJourneyLogFolder,JOURNEY_JOURNAL_FLAG,
  JOURNEY_JOURNAL_PAGE,JOURNEY_JOURNAL_FOLDER }
  from "../scripts/navigation-journey-journal.js";
import { journeySummaryDue,persistJourneyState }
  from "../scripts/navigation-journey-state-store.js";
import { publishJourneySummary }
  from "../scripts/navigation-journey-summary-writer.js";
import {captureApprovedJourneyPath} from "../scripts/navigation-approved-path.js";
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

test("new Journey legs retain approved geometry; legacy Journal flags still read",()=>{
  const approvedPath=captureApprovedJourneyPath({status:"ok",legs:[{
    kind:"road",roadId:"road",segmentId:"segment-1",
    points:[{x:0,y:0},{x:120,y:30}]}]});
  const saved=createJourneyRecord({sceneId:"scene",tokenId:"token",atlasRevision:12,
    itinerary:itinerary(),approvedPath});
  assert.deepEqual(saved.legs[0].approvedPath,approvedPath);
  const prior=checkpointJourneyRecord(saved,{schedule,progress:45,status:"interrupted"});
  const resumed=resumeJourneyRecord(prior,{itinerary:itinerary(),atlasRevision:12,
    approvedPath});
  assert.deepEqual(resumed.legs.map(leg=>leg.approvedPath),[approvedPath,approvedPath]);
  assert.equal(createRecord().legs[0].approvedPath,undefined,
    "older Journal schema remains valid without silent migration");
  const corrupt=structuredClone(saved);
  corrupt.legs[0].approvedPath.legs[0].points[0].x=Infinity;
  assert.equal(eligibleJourneyRecord(corrupt,{sceneId:"scene",tokenId:"token",
    atlasRevision:12}),false,"corrupt path evidence must fail closed");
});

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

test("beta.1 Journal hero, metrics and confirmed progress are decorative read-only markup",()=>{
  const record=checkpointJourneyRecord(createRecord(),{
    schedule,progress:45,status:"interrupted",
    worldTravelSeconds:28800,worldRestSeconds:28800});
  record.title="Dirwest <script>alert('journey')</script> & Harbor";
  record.startedTimeLabel="0998-01-01 00:00";
  record.updatedAt="2026-11-06T00:00:00Z";
  const before=structuredClone(record);
  const html=formatJourneyJournalHTML(record);
  assert.match(html,/<article class="atlas-journey-journal atlas-journey-status-interrupted">/);
  assert.match(html,/<header class="atlas-journey-banner">/);
  assert.match(html,/Atlas Navigation \/ Journey Log/);
  assert.match(html,/class="atlas-journey-status-badge">Interrupted — may resume/);
  assert.match(html,/class="atlas-journey-metrics"/);
  assert.match(html,/role="progressbar" aria-label="Leg 1 confirmed progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="45"/);
  assert.match(html,/style="width:45%"/);
  assert.match(html,/class="atlas-journey-rest-event"/);
  assert.match(html,/Dirwest &lt;script&gt;alert\(&#39;journey&#39;\)&lt;\/script&gt; &amp; Harbor/);
  assert.doesNotMatch(html,/<script>/);
  assert.doesNotMatch(html,/Arrived \(World time\)/);
  assert.deepEqual(record,before,"formatting never changes Journey recovery metadata");
});

test("completed Journal styles the status without altering confirmed log data",()=>{
  const record=checkpointJourneyRecord(createRecord(),{
    schedule:{...schedule,completedHours:18},progress:100,status:"completed",
    arrivedWorldTime:2300,arrivedTimeLabel:"0998-01-03 06:00"});
  const html=formatJourneyJournalHTML(record);
  assert.match(html,/atlas-journey-status-completed/);
  assert.match(html,/Arrived \(World time\):<\/strong> 0998-01-03 06:00/);
  assert.match(html,/aria-valuenow="100"/);
  assert.match(html,/Confirmed progress: 100%/);
});

test("beta.1 stylesheet is shipped and namespaced to the generated Journal",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../module.json",import.meta.url),"utf8"));
  const sheet="styles/atlas-journey-journal.css";
  assert.match(manifest.version,/^0\.3\.9-beta\.[1-9]\d*$/,
    "subsequent 0.3.9 betas must retain the beta.1 Journal stylesheet");
  assert.ok(manifest.styles.includes(sheet));
  const css=readFileSync(new URL("../"+sheet,import.meta.url),"utf8");
  assert.match(css,/\.atlas-journey-journal \.atlas-journey-banner/);
  assert.match(css,/@media print/);
  assert.doesNotMatch(css,/\.journal-entry-page\s*\{|\.window-content\s*\{/,
    "never override native Foundry Journal windows");
});

test("confirmed completion and an explicitly ended Journal cannot be reopened by late lifecycle writes",()=>{
  const completed=checkpointJourneyRecord(createRecord(),{
    schedule:{...schedule,completedHours:18},progress:100,status:"completed",
    arrivedWorldTime:2300,arrivedTimeLabel:"0997-12-21 00:06"});
  assert.equal(eligibleJourneyRecord(completed,{
    sceneId:"scene",tokenId:"token",atlasRevision:12}),false);
  assert.throws(()=>checkpointJourneyRecord(completed,{
    schedule,progress:100,status:"interrupted"}),/finalized Journey/);
  assert.equal(completed.status,"completed");
  assert.match(formatJourneyJournalHTML(completed),/Completed/);
  const ended={...createRecord(),status:"ended"};
  assert.throws(()=>checkpointJourneyRecord(ended,{
    schedule,progress:10,status:"paused"}),/finalized Journey/);
  const unresolved={...createRecord(),pendingNativeMove:{schemaVersion:1,
    operationId:"checkpoint-123",tokenId:"token",checkpointIndex:0,
    from:{x:0,y:0},to:{x:10,y:0},nativeDistance:10,movingHours:1,
    worldTimeBefore:100,worldAdvanceSeconds:3600,atlasRevision:12}};
  assert.throws(()=>checkpointJourneyRecord(unresolved,{
    schedule,progress:100,status:"completed"}),/pending native TokenDocument/);
});

test("legacy interrupted metadata never claims arrival or carries stale arrival into a resumed leg",()=>{
  const partial=checkpointJourneyRecord(createRecord(),{
    schedule,progress:45,status:"interrupted"});
  partial.arrivedWorldTime=123456;
  partial.arrivedTimeLabel="old beta terminal stamp";
  assert.doesNotMatch(formatJourneyJournalHTML(partial),/Arrived \(World time\)/);
  const next=resumeJourneyRecord(partial,{itinerary:itinerary(),atlasRevision:12});
  assert.equal(next.arrivedWorldTime,undefined);
  assert.equal(next.arrivedTimeLabel,undefined);
  assert.equal(next.status,"moving");
  assert.equal(partial.arrivedTimeLabel,"old beta terminal stamp",
    "historical Journal data is not changed on read or local resume preparation");
});

test("land method selections persist independently of completed checkpoint transports",()=>{
  const land=itinerary();
  land.travel={...land.travel,methodId:"riding-horse",methodName:"Riding Horse",
    arrangement:"owned",operation:"normal"};
  const created=createJourneyRecord({sceneId:"scene",tokenId:"token",
    atlasRevision:12,itinerary:land});
  assert.deepEqual(created.legs[0].travelMethod,{
    id:"riding-horse",name:"Riding Horse",arrangement:"owned",operation:"normal"});
  const partial=checkpointJourneyRecord(created,{schedule:{
    completedHours:1,todayHours:1,permittedExtraUntil:0,
    restEvents:0,lastForcedCheck:null,events:[]},
    progress:45,status:"interrupted"});
  assert.equal(eligibleJourneyRecord(partial,{
    sceneId:"scene",tokenId:"token",atlasRevision:12}),true);
  assert.match(formatJourneyJournalHTML(partial),/traveled using Riding Horse/);
  const resumed=resumeJourneyRecord(partial,{itinerary:land,atlasRevision:12});
  assert.equal(resumed.legs.at(-1).travelMethod.id,"riding-horse");
  const invalid=structuredClone(partial);
  invalid.legs[0].travelMethod.operation="timewarp";
  assert.equal(eligibleJourneyRecord(invalid,{
    sceneId:"scene",tokenId:"token",atlasRevision:12}),false);
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

test("backend checkpoints do not regenerate the readable Journal until a leg is confirmed",async()=>{
  const previous=globalThis.game;
  globalThis.game={user:{isGM:true}};
  const writes=[];
  const journal={id:"journey",pages:[{id:"page",name:JOURNEY_JOURNAL_PAGE}],
    async update(data){writes.push({kind:"state",data});},
    async updateEmbeddedDocuments(type,data){writes.push({kind:"page",type,data});}};
  try{
    const moving=checkpointJourneyRecord(createRecord(),{schedule,
      progress:45,status:"moving"});
    await saveJourneyJournal(moving,{journal,updatePage:false});
    assert.equal(writes.length,1,"intermediate progress persists exactly one native flag");
    assert.equal(writes[0].kind,"state");
    assert.equal(writes[0].data[`flags.${MODULE_ID}.${JOURNEY_JOURNAL_FLAG}`].status,"moving");
    const interrupted=checkpointJourneyRecord(moving,{schedule,
      progress:45,status:"interrupted"});
    await saveJourneyJournal(interrupted,{journal,
      updatePage:journeySummaryDue({status:interrupted.status,
        completedPercent:interrupted.legs.at(-1).completedPercent})});
    assert.deepEqual(writes.map(entry=>entry.kind),["state","state"],
      "even an unexpected canvas interruption does not publish partial narrative history");
    const arrived=checkpointJourneyRecord(interrupted,{schedule:{...schedule,
      completedHours:18},progress:100,status:"paused"});
    await saveJourneyJournal(arrived,{journal,
      updatePage:journeySummaryDue({status:arrived.status,
        completedPercent:arrived.legs.at(-1).completedPercent})});
    assert.deepEqual(writes.map(entry=>entry.kind),["state","state","state","page"]);
    assert.match(writes.at(-1).data[0]["text.content"],/Confirmed progress: 100%/);
    assert.equal(journeySummaryDue({status:"paused",completedPercent:50}),false);
    assert.equal(journeySummaryDue({status:"paused",completedPercent:100,
      pendingNativeMove:{operationId:"pending"}}),false);
    assert.equal(journeySummaryDue({status:"completed",completedPercent:100}),true);
    assert.equal(journeySummaryDue({status:"ended",completedPercent:50}),true,
      "the GM's deliberate End Journey action is a final publication event");
  }finally{globalThis.game=previous;}
});

test("a failed state write must not publish an uncommitted leg summary",async()=>{
  const before=globalThis.game;
  globalThis.game={user:{isGM:true}};
  const journal={id:"j",pages:[{id:"p",name:JOURNEY_JOURNAL_PAGE}],
    async update(){throw Error("stale revision");},
    async updateEmbeddedDocuments(){assert.fail("no uncommitted page write");}};
  try{
    await assert.rejects(saveJourneyJournal(createRecord(),{journal}),/stale revision/);
    await assert.rejects(persistJourneyState(null,createRecord()),/persisted Journey/);
    await assert.rejects(publishJourneySummary(journal,"no"),/uncommitted page write/);
  }finally{globalThis.game=before;}
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

test("a new Journey keeps its trip-start title across recovery and checkpoints",async()=>{
  const title="14 Marpenoth 1492 — Dirwest to Millstone";
  const record=createJourneyRecord({sceneId:"scene",tokenId:"token",atlasRevision:12,
    itinerary:itinerary(),title});
  const changed=checkpointJourneyRecord(record,{schedule,progress:45,status:"interrupted"});
  const continued=resumeJourneyRecord(changed,{itinerary:itinerary(),atlasRevision:12});
  assert.equal(continued.title,title);
  assert.match(formatJourneyJournalHTML(continued),/14 Marpenoth 1492 — Dirwest to Millstone — In progress/);
  const previous=globalThis.game;
  globalThis.game={user:{isGM:true}};
  try{
    let name;
    await saveJourneyJournal(record,{folderProvider:async()=>({id:"log-folder"}),
      create:async data=>{name=data.name;return {id:"new-journal"};}});
    assert.equal(name,title);
  }finally{globalThis.game=previous;}
});

test("the saved Journey destination is the original Point B, not the current checkpoint",()=>{
  const first=itinerary();
  first.endpoints.destination={x:40,y:20};
  const originalB={x:120,y:30};
  const record=createJourneyRecord({sceneId:"scene",tokenId:"token",
    atlasRevision:12,itinerary:first,journeyDestination:originalB});
  assert.deepEqual(record.destination,originalB,
    "Port Barthos is only the first-leg endpoint");
  assert.deepEqual(record.legs[0].destination,{x:40,y:20});
  const resumed=resumeJourneyRecord({...record,status:"paused"},
    {itinerary:itinerary(),atlasRevision:12});
  assert.deepEqual(resumed.destination,originalB,
    "a resumed leg must not silently replace the full Journey destination");
  const deliberateChange=resumeJourneyRecord({...record,status:"paused"},
    {itinerary:itinerary(),atlasRevision:12,journeyDestination:{x:180,y:90}});
  assert.deepEqual(deliberateChange.destination,{x:180,y:90},
    "an explicitly selected new Point B may replace the final destination");
  assert.throws(()=>createJourneyRecord({sceneId:"scene",tokenId:"token",
    atlasRevision:12,itinerary:first,journeyDestination:{x:NaN,y:1}}),
    /valid Point B/);
});
