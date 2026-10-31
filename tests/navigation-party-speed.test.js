import test from "node:test";
import assert from "node:assert/strict";
import { convertGroupSpeed, readGroupTravelSpeed, resolveNavigationTravelSpeed }
  from "../scripts/navigation-party-speed.js";

function party({daily=40,hours=8,units="kph",pace="normal"}={}) {
  return {name:"The Party",type:"group",system:{
    attributes:{travel:{time:hours,units,pace}},
    getTravelPace:()=>({pace:{value:pace},paces:{land:daily}})
  }};
}

test("D&D 5e Group Actor travel pace determines hourly scene speed",()=>{
  const result=readGroupTravelSpeed(party(),"km",{systemId:"dnd5e"});
  assert.equal(result.speed,5);
  assert.equal(result.source,"party");
  assert.equal(result.actorName,"The Party");
  assert.equal(result.pace,"normal");
});

test("travel pace and hours per day alter estimated hourly speed",()=>{
  assert.equal(readGroupTravelSpeed(party({daily:24}),"km").speed,3);
  assert.equal(readGroupTravelSpeed(party({daily:40,hours:10}),"km").speed,4);
});

test("converts metric and imperial units without guessing unrelated units",()=>{
  assert.equal(convertGroupSpeed(10,"kph","mi"),10/1.609344);
  assert.equal(convertGroupSpeed(10,"mph","km"),10*1.609344);
  assert.equal(convertGroupSpeed(10,"kph","ft"),null);
});

test("other systems, missing speeds, incompatible units, and invalid speed fall back safely",()=>{
  const token={actor:party()};
  const props={token,sceneUnits:"km",systemId:"dnd5e",worldSpeed:5};
  assert.equal(resolveNavigationTravelSpeed(props).source,"party");
  assert.equal(resolveNavigationTravelSpeed({...props,systemId:"pf2e"}).source,"world");
  assert.equal(resolveNavigationTravelSpeed({...props,token:{actor:party({daily:0})}}).speed,5);
  assert.equal(resolveNavigationTravelSpeed({...props,sceneUnits:"ft"}).source,"world");
  assert.equal(resolveNavigationTravelSpeed({...props,token:{actor:party({daily:999999})}}).source,"world");
  assert.equal(resolveNavigationTravelSpeed({...props,token:null}).source,"world");
});

test("missing or broken Group API never causes a write or route failure",()=>{
  assert.equal(readGroupTravelSpeed({type:"group",system:{}},"km"),null);
  assert.equal(readGroupTravelSpeed({type:"group",system:{attributes:{travel:{time:8,units:"kph"}},
    getTravelPace(){throw Error("bad actor");}}},"km"),null);
});
