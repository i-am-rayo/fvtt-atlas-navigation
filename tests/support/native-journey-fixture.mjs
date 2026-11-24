import assert from "node:assert/strict";

// Test-only Foundry v14 operation/Hook adapter for historical controller
// fixtures that test travel-day decisions with simpler token simulators.
export function installNativeJourneyFixture(AtlasNavigationController){
let nativeSerial=0;
// Older controller fixtures supplied a simple move() that changed x/y, but
// no v14 movement IDs/hooks. Give those fakes public native movement evidence
// without changing runtime code or loosening the production recovery guard.
// Native-specific test harnesses with their own Hooks remain untouched.
const runGuidedWithNativeFixture=AtlasNavigationController.prototype.startGuidedTravel;
AtlasNavigationController.prototype.startGuidedTravel=async function(...args){
  let token;
  try{token=this.getPartyToken?.();}catch{return runGuidedWithNativeFixture.apply(this,args);}
  if(typeof token?.move!=="function"||
      (typeof globalThis.Hooks?.on==="function"&&
       typeof token.getCompleteMovementPath==="function"))
    return runGuidedWithNativeFixture.apply(this,args);
  const old={hooks:globalThis.Hooks,utils:globalThis.foundry?.utils,
    movementPath:token.getCompleteMovementPath,move:token.move,
    stop:token.stopMovement,time:globalThis.game?.time};
  const listeners=new Map();
  globalThis.Hooks={...old.hooks,
    on(name,fn){listeners.set(name,fn);return fn;},
    off(name,fn){assert.equal(listeners.get(name),fn);listeners.delete(name);}};
  globalThis.foundry??={};
  globalThis.foundry.utils={...(old.utils??{}),
    randomID:()=>"MockNative"+String(++nativeSerial).padStart(6,"0")};
  token.getCompleteMovementPath=path=>path;
  token.stopMovement??=()=>true;
  globalThis.game??={};
  globalThis.game.time??={worldTime:0};
  if(!Number.isSafeInteger(globalThis.game.time.worldTime))
    globalThis.game.time.worldTime=0;
  token.move=async function(waypoints,options){
    const from={x:this.x,y:this.y};
    const submitted=waypoints.map(p=>({...p}));
    const end=submitted.at(-1);
    const movement={id:options.id,chain:[],origin:from,
      destination:{x:end.x,y:end.y},constrained:false,
      passed:{waypoints:[from,...submitted.map(p=>({...p,movementId:options.id}))]},
      pending:{waypoints:[]},animation:{ended:Promise.resolve()},state:"completed"};
    if(listeners.get("preMoveToken")?.(this,movement)===false)return false;
    // Preserve the old fixture's inclusive waypoint contract only inside
    // this test adapter. The actual v14 TokenDocument receives destinations.
    const completed=await old.move.call(this,[from,...submitted],options);
    if(completed){
      this.movement=movement;
      listeners.get("moveToken")?.(this,movement);
      listeners.get("updateToken")?.(this,{x:this.x,y:this.y});
    }
    return completed;
  };
  try{return await runGuidedWithNativeFixture.apply(this,args);}
  finally{
    globalThis.Hooks=old.hooks;
    if(old.utils===undefined)delete globalThis.foundry.utils;
    else globalThis.foundry.utils=old.utils;
    if(old.movementPath===undefined)delete token.getCompleteMovementPath;
    else token.getCompleteMovementPath=old.movementPath;
    token.move=old.move;
    if(old.stop===undefined)delete token.stopMovement;
    else token.stopMovement=old.stop;
    if(old.time===undefined)delete globalThis.game.time;
    else globalThis.game.time=old.time;
  }
};
}
