import test from "node:test";
import assert from "node:assert/strict";
import {coordinateNativeTokenMovement}
  from "../scripts/navigation-native-movement-coordinator.js";

function nativeHarness({alterDestination=false,alterOrigin=false,
  detour=false,animationNeverEnds=false,alterMovementId=false}={}){
  const listeners=new Map();
  const calls=[];
  const hooks={
    on(name,fn){assert.equal(name,"moveToken");listeners.set(name,fn);return fn;},
    off(name,id){assert.equal(id,listeners.get(name));listeners.delete(name);}
  };
  const token={id:"party",x:0,y:0,stopped:false,moves:0,
    release:null,hold:null,
    pauseMovement(){
      this.hold=new Promise(resolve=>{this.release=resolve;});
      return async()=>{this.release?.();};
    },
    stopMovement(){this.stopped=true;this.release?.();return true;},
    async move(path,options){
      this.moves++;
      assert.equal(path.length,2,"native move() receives destinations, not its origin");
      for(const [index,to] of path.entries()){
        if(this.stopped)return false;
        const from={x:this.x,y:this.y};
        this.x=to.x+(alterDestination?4:0);this.y=to.y;
        this.hold=null;this.release=null;
        const movement={id:alterMovementId?"foreign-token-move":
          index?"second-native-id":options.id,
          chain:alterMovementId?[]:index?[options.id]:[],
          origin:alterOrigin?{x:from.x-5,y:from.y}:from,
          destination:{x:this.x,y:this.y},
          passed:{waypoints:detour?[from,{x:from.x+5,y:8},{x:this.x,y:this.y}]:
            [from,{x:this.x,y:this.y}]},
          animation:{ended:animationNeverEnds?new Promise(()=>{}):Promise.resolve()}};
        calls.push(movement);
        listeners.get("moveToken")(this,movement,{}, {isSelf:true});
        if(this.hold)await this.hold;
      }
      return !this.stopped;
    }
  };
  const plan={path:[{x:0,y:0},{x:10,y:0,checkpoint:true},
    {x:20,y:0,checkpoint:true}],checkpoints:[
      {index:0,from:{x:0,y:0},point:{x:10,y:0},distance:10},
      {index:1,from:{x:10,y:0},point:{x:20,y:0},distance:10}
    ]};
  return {token,plan,hooks,calls,listeners};
}

test("one native TokenDocument.move waits for a durable intent and each confirmed checkpoint",async()=>{
  const {token,plan,hooks,calls,listeners}=nativeHarness();
  const order=[];
  let awaitingSave=false;
  const result=await coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-42",movementSpeed:2,
    prepareCheckpoint:async point=>{
      order.push("intent:"+point.index);
      awaitingSave=true;
      await Promise.resolve();
      awaitingSave=false;
    },
    confirmCheckpoint:async(point,movement)=>{
      assert.equal(awaitingSave,false);
      assert.equal(token.x,point.point.x);
      assert.ok(movement.id);
      order.push("confirmed:"+point.index);
    }
  });
  assert.deepEqual(order,["intent:0","confirmed:0","intent:1","confirmed:1"]);
  assert.deepEqual(result,{completed:true,confirmed:2,error:null});
  assert.equal(token.moves,1);
  assert.equal(calls.length,2);
  assert.equal(listeners.size,0);
});

test("a failed Journal confirmation stops native movement and never credits another checkpoint",async()=>{
  const {token,plan,hooks,listeners}=nativeHarness();
  const confirmed=[];
  await assert.rejects(coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-43",movementSpeed:2,
    prepareCheckpoint:async()=>{},
    confirmCheckpoint:async(point)=>{
      confirmed.push(point.index);
      throw Error("Journal save failed");
    }
  }),/Journal save failed/);
  assert.deepEqual(confirmed,[0]);
  assert.equal(token.stopped,true);
  assert.equal(listeners.size,0);
});

test("a redirected native checkpoint stops without accepting visually close-enough progress",async()=>{
  const {token,plan,hooks}=nativeHarness({alterDestination:true});
  let confirmed=0;
  await assert.rejects(coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-44",movementSpeed:2,
    prepareCheckpoint:async()=>{},confirmCheckpoint:async()=>{confirmed++;}
  }),/does not match the approved native checkpoint/);
  assert.equal(confirmed,0);
  assert.equal(token.stopped,true);
});

test("a reported full-path origin is reconciled only with an exact passed approved interval",async()=>{
  const {token,plan,hooks}=nativeHarness({alterOrigin:true});
  const observed=[];
  const result=await coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-verified",movementSpeed:2,
    prepareCheckpoint:async()=>{},confirmCheckpoint:async()=>{},
    onCheckpointDiagnostics:event=>observed.push(event)
  });
  assert.equal(result.confirmed,2);
  assert.ok(observed.every(event=>event.details.reconciledFromPassed));
  assert.equal(observed[0].details.nativeCheckpointKey,"atlas-native-verified:0");
  assert.deepEqual(observed[0].details.expectedFrom,{x:0,y:0});
  assert.deepEqual(observed[0].details.nativeOrigin,{x:-5,y:0});
});

test("a native passed-path detour is rejected even if its final endpoint matches",async()=>{
  const {token,plan,hooks}=nativeHarness({alterOrigin:true,detour:true});
  const observed=[];
  await assert.rejects(coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-detour",movementSpeed:2,
    prepareCheckpoint:async()=>{},confirmCheckpoint:async()=>{},
    onCheckpointDiagnostics:event=>observed.push(event)
  }),/does not match the approved native checkpoint/);
  assert.equal(token.stopped,true);
  assert.equal(observed[0].mismatch,true);
  assert.equal(observed[0].details.originDifferencePixels,5);
  assert.deepEqual(observed[0].details.tokenDocument,{x:10,y:0});
});

test("native checkpoint failures report Atlas checkpoint and road IDs with both coordinate sets",async()=>{
  const {token,plan,hooks}=nativeHarness({alterDestination:true});
  plan.checkpoints[0].roadId="road-port";
  plan.checkpoints[0].segmentId="segment-ship";
  plan.checkpoints[0].atlasCheckpointId="checkpoint-harbor";
  const observed=[];
  await assert.rejects(coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-coordinates",movementSpeed:2,
    prepareCheckpoint:async()=>{},confirmCheckpoint:async()=>{},
    onCheckpointDiagnostics:event=>observed.push(event)
  }),/does not match the approved native checkpoint/);
  assert.deepEqual(observed[0].details.expectedTo,{x:10,y:0});
  assert.deepEqual(observed[0].details.nativeDestination,{x:14,y:0});
  assert.equal(observed[0].details.destinationDifferencePixels,4);
  assert.equal(observed[0].details.roadId,"road-port");
  assert.equal(observed[0].details.segmentId,"segment-ship");
  assert.equal(observed[0].details.atlasCheckpointId,"checkpoint-harbor");
  assert.equal(observed[0].details.failureReason,"native-checkpoint-mismatch");
  assert.deepEqual(observed[0].details.failedChecks,["destination","token-document"]);
  assert.equal(observed[0].details.nativeOperationId,"atlas-native-coordinates");
  assert.equal(observed[0].details.nativeCheckpointKey,"atlas-native-coordinates:0");
  assert.deepEqual(observed[0].details.expectedFrom,{x:0,y:0});
  assert.deepEqual(observed[0].details.nativeOrigin,{x:0,y:0});
  assert.deepEqual(observed[0].details.tokenDocument,{x:14,y:0});
  assert.equal(observed[0].details.pendingWaypointCount,null);
  assert.equal(observed[0].details.nativeSubpathId,null);
  const exported=JSON.parse(JSON.stringify(observed[0].details));
  assert.deepEqual(exported.failedChecks,["destination","token-document"],
    "native mismatch diagnostics must survive plain-text JSON export");
  assert.equal(exported.atlasCheckpointId,"checkpoint-harbor");
});

test("a foreign native movement ID emits an actionable failure without Journal confirmation",async()=>{
  const {token,plan,hooks}=nativeHarness({alterMovementId:true});
  const observed=[];
  let confirmed=0;
  await assert.rejects(coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-owned",movementSpeed:2,
    prepareCheckpoint:async()=>{},confirmCheckpoint:async()=>{confirmed++;},
    onCheckpointDiagnostics:event=>observed.push(event)
  }),/Another native movement displaced/);
  assert.equal(confirmed,0);
  assert.equal(token.stopped,true);
  assert.equal(observed[0].details.failureReason,"foreign-native-movement-id");
  assert.deepEqual(observed[0].details.failedChecks,["movement-id"]);
  assert.equal(observed[0].details.nativeMovementId,"foreign-token-move");
  assert.equal(observed[0].details.nativeOperationId,"atlas-native-owned");
  assert.deepEqual(observed[0].details.expectedTo,{x:10,y:0});
});

test("preparation fails before any native Document position changes",async()=>{
  const {token,plan,hooks,listeners}=nativeHarness();
  await assert.rejects(coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-45",movementSpeed:2,
    prepareCheckpoint:async()=>{throw Error("Journal unavailable");},
    confirmCheckpoint:async()=>{}
  }),/Journal unavailable/);
  assert.equal(token.moves,0);
  assert.equal(token.x,0);
  assert.equal(listeners.size,0);
});

test("canvas abort stops a movement whose native animation promise never settles",async()=>{
  const {token,plan,hooks,listeners}=nativeHarness({animationNeverEnds:true});
  const abort=new AbortController();
  let confirmed=0;
  const pending=coordinateNativeTokenMovement({token,plan,hooks,
    operationId:"atlas-native-abort",movementSpeed:2,signal:abort.signal,
    prepareCheckpoint:async()=>{},confirmCheckpoint:async()=>{confirmed++;}
  });
  for(let index=0;index<100&&token.x===0;index++)await Promise.resolve();
  assert.equal(token.x,10,"the TokenDocument has already updated");
  abort.abort();
  await assert.rejects(pending,/Canvas lifecycle cancelled native travel/);
  assert.equal(token.stopped,true);
  assert.equal(confirmed,0);
  assert.equal(listeners.size,0);
});
