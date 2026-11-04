import assert from "node:assert/strict";
import test from "node:test";
import {renderNavigationFooter} from "../scripts/navigation-footer.js";

const mockDOM=()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({tag,style:{},children:[],
    listeners:{},appendChild(child){this.children.push(child);},
    addEventListener(name,handler){this.listeners[name]=handler;},
    setAttribute(){}})};
  return ()=>{globalThis.document=previous;};
};
const button=(row,label)=>row.children.find(item=>item.ariaLabel===label);
const fixture=()=>{
  const calls=[];
  const nav={result:{status:"ok"},travelSession:null,pendingTransfer:null,
    journalStarting:false,journeyJournal:null,active:false,
    clear:()=>calls.push("clear"),refreshPartyDeparture:()=>calls.push("refresh"),
    startGuidedTravel:async()=>{calls.push("travel");return true;},
    pauseGuidedTravel:()=>{calls.push("pause");return true;},
    resumeGuidedTravel:()=>{calls.push("resume");return true;},
    choosePausedTravelRest:async action=>{calls.push(action);return true;},
    chooseDailyTravelBreak:action=>{calls.push(action);return true;},
    stopGuidedTravel:()=>{calls.push("end");return true;},
    isAtJourneyDestination:()=>true,
    stopAndReplanAtCheckpoint:async()=>{calls.push("stop-replan");return true;},
    continueFromCheckpoint:async()=>{calls.push("continue-cp");return true;},
    completeJourneyAtCheckpoint:async()=>{calls.push("complete");return true;}};
  return {nav,calls};
};
const rules={overnightHours:16,longRestHours:8,shortRestHours:1};

test("footer is presentation-only until an explicit action is clicked",async()=>{
  const restore=mockDOM();
  try{
    const {nav,calls}=fixture();
    const row=renderNavigationFooter(nav,{partyMode:true,
      methodAssessment:{guided:true}});
    assert.deepEqual(calls,[]);
    assert.equal(button(row,"Travel Route").disabled,false);
    button(row,"New Route").listeners.click();
    assert.deepEqual(calls,["clear","refresh"]);
    await button(row,"Travel Route").listeners.click();
    await Promise.resolve();
    assert.deepEqual(calls,["clear","refresh","travel"]);
    const blocked=renderNavigationFooter(nav,{methodAssessment:{guided:false}});
    assert.equal(button(blocked,"Travel Route").disabled,true);
    const repeated=renderNavigationFooter(nav,{assistedLegReady:true,
      repeatingCheckpoint:true,methodAssessment:{guided:true},
      transferPlan:{legs:[{arrivalCheckpoint:{name:"Port Barthos"}}]}});
    assert.equal(button(repeated,"Travel to Port Barthos").disabled,true);
  }finally{restore();}
});

test("paused Journey footer retains rest, resume, and end accessibility",async()=>{
  const restore=mockDOM();
  try{
    const {nav,calls}=fixture();
    nav.travelSession={phase:"paused",schedule:{rules,restEvents:0,events:[]}};
    const row=renderNavigationFooter(nav,{methodAssessment:{guided:false}});
    for(const label of ["Resume Travel","Short Rest (1h)",
      "Long Rest (8h)","Overnight Camp (16h)","End Journey"])
      assert.ok(button(row,label),label+" should be accessible");
    assert.deepEqual(calls,[],"rendering a Journey cannot approve a rest");
    await button(row,"Short Rest (1h)").listeners.click();
    await Promise.resolve();
    assert.deepEqual(calls,["short"]);
    button(row,"Resume Travel").listeners.click();
    assert.deepEqual(calls,["short","resume"]);
    nav.travelSession.phase="rest-applying";
    const busy=renderNavigationFooter(nav);
    assert.equal(button(busy,"Recording Break…").disabled,true);
    assert.equal(button(busy,"End Journey").disabled,true);
  }finally{restore();}
});

test("day-limit and checkpoint action sets remain isolated",()=>{
  const restore=mockDOM();
  try{
    const {nav,calls}=fixture();
    nav.travelSession={phase:"rest-choice",schedule:{rules,todayHours:8}};
    const day=renderNavigationFooter(nav);
    for(const label of ["Short Rest (1h)","Long Rest (8h)",
      "Overnight Camp (16h)","Continue March"])
      assert.ok(button(day,label));
    assert.equal(button(day,"Resume Travel"),undefined);
    button(day,"Continue March").listeners.click();
    assert.deepEqual(calls,["continue"]);
    nav.travelSession=null;nav.pendingTransfer={checkpoint:{id:"dock"}};
    const checkpoint=renderNavigationFooter(nav);
    assert.ok(button(checkpoint,"Complete Journey"));
    assert.ok(button(checkpoint,"Continue from checkpoint"));
    assert.equal(button(checkpoint,"New Route").disabled,true);
    assert.deepEqual(calls,["continue"],"render does not commit checkpoint decisions");
  }finally{restore();}
});
