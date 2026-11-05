import test from "node:test";
import assert from "node:assert/strict";
import {coordinateNativeTokenMovement}
  from "../scripts/navigation-native-movement-coordinator.js";

function nativeHarness({alterDestination=false}={}){
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
      assert.equal(path.length,3);
      for(const [index,to] of path.slice(1).entries()){
        if(this.stopped)return false;
        const from={x:this.x,y:this.y};
        this.x=to.x+(alterDestination?4:0);this.y=to.y;
        this.hold=null;this.release=null;
        const movement={id:index?"second-native-id":options.id,
          chain:index?[options.id]:[],origin:from,
          destination:{x:this.x,y:this.y},
          animation:{ended:Promise.resolve()}};
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
