import test from "node:test";
import assert from "node:assert/strict";
import {coordinateNativeTokenMovement} from "../scripts/navigation-native-movement-coordinator.js";

test("v14 Region boundary is independently predicted and accepted, but a detour fails closed",async()=>{
  const from={x:3729,y:2235},bend={x:3738,y:2267},
    region={x:3741,y:2286},to={x:3793,y:2350};
  const operationId="RegionTest000001";
  for(const detour of [false,true]){
    const callbacks=new Map(),events=[];
    const hooks={
      on(name,callback){callbacks.set(name,callback);return callback;},
      off(name,callback){assert.equal(callbacks.get(name),callback);callbacks.delete(name);}
    };
    const base=[from,bend,to],predicted=[from,bend,region,to];
    const passed=[bend,{...region,intermediate:true,explicit:true,checkpoint:false},to]
      .map(p=>({...p,movementId:operationId}));
    if(detour)passed[1].y+=5;
    const movement={id:operationId,chain:[],origin:from,destination:to,
      constrained:false,passed:{waypoints:passed},pending:{waypoints:[]},
      animation:{ended:Promise.resolve()}};
    let stopped=0;
    const token={...from,stopMovement(){stopped++;return true;},
      getCompleteMovementPath(){return base;},
      object:{createTerrainMovementPath(expanded){
        assert.deepEqual(expanded.map(p=>({x:p.x,y:p.y})),base);
        return predicted;
      }},
      async move(waypoints,options){
        assert.deepEqual(waypoints,[bend,to]);
        assert.equal(options.id,operationId);
        if(callbacks.get("preMoveToken")(this,movement)===false)return false;
        callbacks.get("moveToken")(this,movement);
        Object.assign(this,to);
        this.movement={...movement,state:"completed"};
        callbacks.get("updateToken")(this);
        return true;
      }};
    const result=coordinateNativeTokenMovement({
      token,hooks,operationId,movementSpeed:2,
      plan:{path:base,checkpoints:[{index:0,from,point:to,distance:150}]},
      prepareCheckpoint:async(_checkpoint,_id,path,nativePath)=>{
        assert.deepEqual(path,base);
        assert.deepEqual(nativePath,predicted);
        events.push("intent");
      },
      recordCheckpointEvidence:async()=>events.push("evidence"),
      confirmCheckpoint:async()=>events.push("confirmed")
    });
    if(detour){
      await assert.rejects(result,/does not match the approved native checkpoint/);
      assert.deepEqual({x:token.x,y:token.y},from);
      assert.deepEqual(events,["intent"]);
    }else{
      assert.equal((await result).completed,true);
      assert.deepEqual(events,["intent","evidence","confirmed"]);
      assert.equal(stopped,0);
    }
    assert.equal(callbacks.size,0);
  }
});
