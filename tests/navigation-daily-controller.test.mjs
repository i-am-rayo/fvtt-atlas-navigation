import assert from "node:assert/strict";
import test from "node:test";
import { createNavigationItinerary } from "../scripts/navigation-itinerary.js";
import { formatJourneyJournalHTML } from "../scripts/navigation-journey-journal.js";

const priorFoundry=globalThis.foundry;
globalThis.foundry={applications:{api:{ApplicationV2:class {
  render(){this.renders=(this.renders??0)+1;}
}}}};
const { AtlasNavigationController }=await import("../scripts/navigation-controller.js");
globalThis.foundry=priorFoundry;

const point=(x,y)=>({x,y});
const tickUntil=async condition=>{
  for(let i=0;i<1000;i++){
    if(condition())return;
    await Promise.resolve();
  }
  throw Error("Guided journey did not reach its expected state.");
};

async function journeyFixture({clockEnabled=true,hours=10}={}){
  const old={game:globalThis.game,window:globalThis.window,PIXI:globalThis.PIXI,
    ui:globalThis.ui,document:globalThis.document};
  const calls=[];
  const journalStates=[];
  const clock={worldTime:30*86400+9*3600,
    calendar:{format(seconds){
      const day=Math.floor(seconds/86400)+1;
      const hour=Math.floor(seconds%86400/3600);
      return `Day ${day}, ${String(hour).padStart(2,"0")}:00`;
    }},
    async advance(seconds){calls.push(seconds);this.worldTime+=seconds;}};
  globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},
    system:{id:"dnd5e"},settings:{get:(_module,key)=>({
      guidedTravelAdvanceWorldTime:clockEnabled,
      guidedTravelRulesProfile:"dnd5e2014",
      guidedTravelSecondsPerHour:2,
      overlandSpeed:1
    })[key]},time:clock};
  globalThis.window={innerWidth:1400,innerHeight:900};
  globalThis.PIXI=undefined;
  globalThis.ui={notifications:{error(message){throw Error(message);},warn(message){throw Error(message);}}};
  globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
    listeners:new Map(),append(...nodes){this.children.push(...nodes);},
    appendChild(node){this.children.push(node);},
    addEventListener(name,handler){this.listeners.set(name,handler);}})};
  const token={id:"daily-token",x:50,y:50,width:1,height:1,canUserModify:()=>true,moves:[],
    async move(waypoints){
      this.moves.push(waypoints);
      const end=waypoints.at(-1);
      this.x=end.x;this.y=end.y;
      return true;
    }};
  const scene={id:"daily-scene",name:"Atlas",grid:{size:100,units:"km"},
    canUserModify:()=>true,getFlag:()=>null};
  const view={scene,ready:true};
  const atlas={revision:5,nodes:[{id:"a",x:100,y:100},{id:"b",x:300,y:200}],
    roads:[{id:"r",name:"Main Road"}],
    segments:[{id:"s",roadId:"r",from:"a",to:"b",via:[]}]};
  const nav=new AtlasNavigationController({canvasProvider:()=>view,
    atlasProvider:()=>atlas,partyTokenProvider:()=>token,
    journeyJournalStore:{save:async(record,{journal}={})=>{
      journalStates.push(structuredClone(record));
      return journal??{id:"daily-journal"};
    },
      find:()=>null}});
  nav.scene=scene;nav.routeRevision=5;
  nav.start=point(100,100);nav.end=point(300,200);
  nav.result={status:"ok",start:nav.start,end:nav.end,distance:hours,cost:hours,
    terrainAware:false,legs:[{kind:"road",roadId:"r",segmentId:"s",distance:hours,
      cost:hours,points:[point(100,100),point(200,150),point(300,200)]}]};
  nav.resolveTravel=()=>({sceneUnit:"km",travel:{speed:1,hoursPerDay:8,
    source:"party",actorName:"Group",pace:"normal"}});
  nav.itinerary=createNavigationItinerary({sceneId:scene.id,sceneName:scene.name,
    sceneUnits:scene.grid.units,atlasRevision:atlas.revision,route:nav.result,
    travel:{speed:1}});
  return {nav,token,calls,journalStates,
    restore:()=>{nav.stop();Object.assign(globalThis,old);}};
}

test("guided travel waits at 8h and confirms 16h overnight before moving again",async()=>{
  const f=await journeyFixture();
  try{
    const initial=await f.nav._renderHTML();
    const find=(node,match)=>match(node)?node:node.children.map(x=>find(x,match)).find(Boolean);
    assert.ok(find(initial,node=>node.tag==="strong"&&node.textContent==="10h 0m"));
    assert.ok(find(initial,node=>node.tag==="strong"&&node.textContent==="1d 2h"),
      "Total Trip must include overnight downtime separately from moving time");
    const running=f.nav.startGuidedTravel();
    await tickUntil(()=>f.nav.travelSession?.phase==="rest-choice");
    assert.ok(Math.abs(f.nav.travelProgress-80)<0.01);
    assert.ok(Math.abs(f.nav.travelSession.schedule.todayHours-8)<1e-7);
    assert.equal(f.calls.reduce((a,b)=>a+b,0),8*3600);
    const panel=await f.nav._renderHTML();
    const overnight=find(panel,node=>node.tag==="button"&&
      node.ariaLabel==="Overnight Camp (16h)");
    assert.ok(overnight,"daily break buttons remain accessible in the fixed footer");
    overnight.listeners.get("click")();
    assert.equal(await running,true);
    assert.equal(f.nav.travelProgress,100);
    assert.equal(f.nav.worldTravelAdvancedSeconds,10*3600);
    assert.equal(f.nav.worldRestAdvancedSeconds,16*3600);
    assert.equal(f.calls.reduce((a,b)=>a+b,0),26*3600);
    assert.equal(f.nav.journeySchedule.breakHours,16);
    assert.equal(f.nav.journeySchedule.estimate.totalHours,26);
    assert.equal(f.journalStates.at(-1).status,"completed");
    assert.ok(f.journalStates.some(state=>state.legs[0].events.some(event=>
      event.action==="overnight")),"GM rest decisions persist in the same Journal");
  }finally{f.restore();}
});

test("short rest then forced march leaves daily hours intact and requires manual checks",async()=>{
  const f=await journeyFixture();
  try{
    const running=f.nav.startGuidedTravel();
    await tickUntil(()=>f.nav.travelSession?.phase==="rest-choice");
    assert.equal(f.nav.chooseDailyTravelBreak("short"),true);
    try{await tickUntil(()=>f.nav.travelSession?.phase==="rest-choice"&&
      f.nav.travelSession.schedule.breakHours===1);}
    catch(error){throw new Error(`${error.message}; phase=${f.nav.travelSession?.phase}; today=${f.nav.travelSession?.schedule.todayHours}; completed=${f.nav.travelSession?.schedule.completedHours}; break=${f.nav.travelSession?.schedule.breakHours}; notice=${f.nav.travelNotice}`);}
    assert.ok(Math.abs(f.nav.travelSession.schedule.todayHours-8)<1e-7);
    const view=await f.nav._renderHTML();
    const findAll=(node,match)=>[...(match(node)?[node]:[]),...node.children.flatMap(child=>findAll(child,match))];
    assert.ok(findAll(view,node=>node.textContent==="Short Rest").length>0,
      "the confirmed rest appears between route directions at eight moving hours");
    assert.ok(findAll(view,node=>node.textContent==="ETA remaining (in-game)").length>0);
    assert.ok(findAll(view,node=>node.textContent?.includes?.("does not restore daily travel hours")).length>0,
      "the GM sees why a short rest does not permit more travel");
    assert.equal(f.nav.chooseDailyTravelBreak("continue"),true);
    await tickUntil(()=>f.nav.travelSession?.phase==="rest-choice"&&
      f.nav.travelSession.schedule.lastForcedCheck?.dc===11);
    assert.ok(Math.abs(f.nav.travelSession.schedule.todayHours-9)<1e-7);
    assert.equal(f.nav.chooseDailyTravelBreak("continue"),true);
    assert.equal(await running,true);
    assert.equal(f.nav.journeySchedule.breakHours,1);
    assert.equal(f.nav.journeySchedule.estimate.totalHours,11);
    assert.equal(f.calls.reduce((a,b)=>a+b,0),11*3600);
    assert.match(f.nav.travelNotice,/DC 12 Constitution saves manually/);
  }finally{f.restore();}
});

test("ending at a day-limit prompt never adds unapproved rest time",async()=>{
  const f=await journeyFixture();
  try{
    const running=f.nav.startGuidedTravel();
    await tickUntil(()=>f.nav.travelSession?.phase==="rest-choice");
    assert.equal(f.nav.stopGuidedTravel(),true);
    assert.equal(await running,false);
    assert.equal(f.nav.worldTimeAdvancedSeconds,8*3600);
    assert.equal(f.calls.reduce((a,b)=>a+b,0),8*3600);
    assert.ok(f.nav.travelProgress<100);
    assert.equal(f.nav.journeySchedule.breakHours,0);
    assert.equal(f.journalStates.at(-1).status,"ended",
      "End Journey is terminal, distinct from an interrupted journey");
  }finally{f.restore();}
});

test("a rest-triggered canvas rebuild waits for its World-time and Journal checkpoint",async()=>{
  const f=await journeyFixture();
  try{
    const notices=[];
    globalThis.ui.notifications.warn=message=>notices.push(message);
    const running=f.nav.startGuidedTravel();
    await tickUntil(()=>f.nav.travelSession?.phase==="rest-choice"&&
      Boolean(f.nav.travelSession.restWaiter));
    const oldAdvance=game.time.advance;
    game.time.advance=async seconds=>{
      await oldAdvance.call(game.time,seconds);
      if(seconds===8*3600)f.nav.tearDown("canvasTearDown");
    };
    assert.equal(f.nav.chooseDailyTravelBreak("long"),true);
    assert.equal(await running,false,"canvas interruption stops the old movement loop");
    const pending=f.nav.autoResumePending;
    assert.ok(pending?.requiresRestCheckpoint);
    assert.equal(pending.session.restCheckpointed,true);
    assert.equal(f.calls.reduce((sum,value)=>sum+value,0),16*3600,
      "the confirmed 8h movement and 8h rest are each credited once");
    const final=f.journalStates.at(-1);
    assert.equal(final.status,"interrupted");
    assert.equal(final.legs[0].events.at(-1).action,"long");
    let recovered=0;
    f.nav.activate=()=>{f.nav.scene=pending.session.token&&{
      id:pending.sceneId};f.nav.recoverableJourney={id:pending.journalId};};
    f.nav.recoverSavedJourney=()=>{recovered++;return true;};
    f.nav.startGuidedTravel=async()=>true;
    assert.equal(await f.nav.autoResumeAfterCanvasReady(),true);
    assert.equal(recovered,1);
  }finally{f.restore();}
});

test("native movement Journal writes are batched, but rest boundaries and arrival are immediate",async()=>{
  const f=await journeyFixture({clockEnabled:false,hours:10});
  try{
    const running=f.nav.startGuidedTravel();
    await tickUntil(()=>f.nav.travelSession?.phase==="rest-choice"&&
      Boolean(f.nav.travelSession.restWaiter));
    assert.ok(f.journalStates.some(state=>state.status==="paused"));
    assert.equal(f.nav.chooseDailyTravelBreak("overnight"),true);
    assert.equal(await running,true);
    assert.ok(f.token.moves.length>5);
    assert.ok(f.journalStates.length<f.token.moves.length,
      "do not issue a flag/page write for every short native movement segment");
    assert.equal(f.journalStates.at(-1).status,"completed");
    assert.equal(f.journalStates.at(-1).startedWorldTime,
      f.journalStates.at(-1).arrivedWorldTime,
      "the disabled World clock must not invent elapsed calendar time");
    assert.match(formatJourneyJournalHTML(f.journalStates.at(-1)),/World clock unchanged/);
  }finally{f.restore();}
});

test("Journey logs snapshot campaign departure, both rest times, and confirmed arrival",async()=>{
  const f=await journeyFixture({hours:10});
  try{
    const running=f.nav.startGuidedTravel();
    await tickUntil(()=>f.nav.travelSession?.phase==="rest-choice"&&
      Boolean(f.nav.travelSession.restWaiter));
    assert.equal(f.nav.chooseDailyTravelBreak("long"),true);
    assert.equal(await running,true);
    const record=f.journalStates.at(-1);
    assert.equal(record.startedTimeLabel,"Day 31, 09:00");
    assert.equal(record.arrivedTimeLabel,"Day 32, 03:00");
    const rest=record.legs[0].events.find(event=>event.action==="long");
    assert.equal(rest.startedTimeLabel,"Day 31, 17:00");
    assert.equal(rest.endedTimeLabel,"Day 32, 01:00");
    const html=formatJourneyJournalHTML(record);
    assert.match(html,/Departed \(World time\):<\/strong> Day 31, 09:00/);
    assert.match(html,/Arrived \(World time\):<\/strong> Day 32, 03:00/);
    assert.match(html,/World time: Day 31, 17:00 to Day 32, 01:00/);
  }finally{f.restore();}
});
