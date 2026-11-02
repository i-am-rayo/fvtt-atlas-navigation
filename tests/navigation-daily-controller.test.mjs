import assert from "node:assert/strict";
import test from "node:test";

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
  globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},
    system:{id:"dnd5e"},settings:{get:(_module,key)=>({
      guidedTravelAdvanceWorldTime:clockEnabled,
      guidedTravelRulesProfile:"dnd5e2014",
      guidedTravelSecondsPerHour:2,
      overlandSpeed:1
    })[key]},time:{advance:async seconds=>{calls.push(seconds);}}};
  globalThis.window={innerWidth:1400,innerHeight:900};
  globalThis.PIXI=undefined;
  globalThis.ui={notifications:{error(message){throw Error(message);},warn(message){throw Error(message);}}};
  globalThis.document={createElement:tag=>({tag,style:{},children:[],textContent:"",
    listeners:new Map(),append(...nodes){this.children.push(...nodes);},
    appendChild(node){this.children.push(node);},
    addEventListener(name,handler){this.listeners.set(name,handler);}})};
  const token={x:50,y:50,width:1,height:1,canUserModify:()=>true,moves:[],
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
    atlasProvider:()=>atlas,partyTokenProvider:()=>token});
  nav.scene=scene;nav.routeRevision=5;
  nav.start=point(100,100);nav.end=point(300,200);
  nav.result={status:"ok",start:nav.start,end:nav.end,distance:hours,cost:hours,
    terrainAware:false,legs:[{kind:"road",roadId:"r",segmentId:"s",distance:hours,
      cost:hours,points:[point(100,100),point(200,150),point(300,200)]}]};
  nav.resolveTravel=()=>({sceneUnit:"km",travel:{speed:1,hoursPerDay:8,
    source:"party",actorName:"Group",pace:"normal"}});
  return {nav,token,calls,restore:()=>{nav.stop();Object.assign(globalThis,old);}};
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
    const overnight=find(panel,node=>node.tag==="button"&&node.textContent==="Overnight Camp (16h)");
    assert.ok(overnight,"daily break buttons remain accessible in the fixed footer");
    overnight.listeners.get("click")();
    assert.equal(await running,true);
    assert.equal(f.nav.travelProgress,100);
    assert.equal(f.nav.worldTravelAdvancedSeconds,10*3600);
    assert.equal(f.nav.worldRestAdvancedSeconds,16*3600);
    assert.equal(f.calls.reduce((a,b)=>a+b,0),26*3600);
    assert.equal(f.nav.journeySchedule.breakHours,16);
    assert.equal(f.nav.journeySchedule.estimate.totalHours,26);
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
  }finally{f.restore();}
});
