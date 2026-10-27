import test from "node:test";
import assert from "node:assert/strict";
import { checkpointRevealKeys, clearHiddenForCheckpoint } from "../scripts/checkpoint-exploration.js";
import { defaultPartyExploration, setCheckpointKnowledge, setCheckpointRevealRadius }
  from "../scripts/party-exploration-model.js";

const atlas={schemaVersion:9,nodes:[{id:"n1",x:100,y:100}],
  checkpoints:[{id:"cp1",nodeId:"n1"}]};
const cells=[];
for(let x=0;x<=200;x+=50)for(let y=0;y<=200;y+=50)cells.push({x,y});
const asKeys=(party)=>checkpointRevealKeys(cells,atlas,party,50);

test("undiscovered checkpoint reveals no terrain",()=>{
  assert.equal(asKeys({...defaultPartyExploration(),enabled:true}).size,0);
});
test("visited checkpoint projects persistent square/hex-independent centers",()=>{
  let state={...defaultPartyExploration(),enabled:true};
  state=setCheckpointRevealRadius(state,"cp1",1);
  state=setCheckpointKnowledge(state,"cp1","visited");
  const seen=asKeys(state);
  assert.equal(seen.size,5);
  assert.ok(seen.has("100,100"));
  assert.ok(!seen.has("200,200"));
});
test("lore can reveal terrain and radius zero reveals none",()=>{
  let state={...defaultPartyExploration(),enabled:true};
  state=setCheckpointKnowledge(state,"cp1","lore");
  state=setCheckpointRevealRadius(state,"cp1",0);
  assert.equal(asKeys(state).size,0);
  state=setCheckpointRevealRadius(state,"cp1",1);
  assert.equal(asKeys(state).size,5);
  state=setCheckpointKnowledge(state,"cp1","unknown");
  assert.equal(asKeys(state).size,0);
});
test("legacy absolute nodes are anchored to image origin",()=>{
  const legacy={...atlas,schemaVersion:1,nodes:[{id:"n1",x:600,y:700}]};
  let state={...defaultPartyExploration(),enabled:true};
  state=setCheckpointKnowledge(state,"cp1","visited");
  state=setCheckpointRevealRadius(state,"cp1",1);
  const result=checkpointRevealKeys(cells,legacy,state,50,{x:500,y:600});
  assert.ok(result.has("100,100"));
});

test("explicit checkpoint reveal clears only covered hidden overrides",()=>{
  let state={...defaultPartyExploration(),enabled:true};
  state=setCheckpointKnowledge(state,"cp1","visited");
  state=setCheckpointRevealRadius(state,"cp1",1);
  const cleared=clearHiddenForCheckpoint([{x:100,y:100},{x:200,y:200}],asKeys(state));
  assert.deepEqual(cleared,[{x:200,y:200}]);
  state=setCheckpointRevealRadius(state,"cp1",0);
  assert.deepEqual(clearHiddenForCheckpoint([{x:100,y:100}],asKeys(state)),
    [{x:100,y:100}]);
});

test("GM re-reveal targets only checkpoint whose status changed",()=>{
  const two={...atlas,nodes:[...atlas.nodes,{id:"n2",x:200,y:200}],
    checkpoints:[...atlas.checkpoints,{id:"cp2",nodeId:"n2"}]};
  let party={...defaultPartyExploration(),enabled:true};
  party=setCheckpointRevealRadius(party,"cp1",1);
  party=setCheckpointRevealRadius(party,"cp2",1);
  party=setCheckpointKnowledge(party,"cp1","visited");
  party=setCheckpointKnowledge(party,"cp2","lore");
  const both=checkpointRevealKeys(cells,two,party,50);
  assert.ok(both.has("100,100")&&both.has("200,200"));
  const only=checkpointRevealKeys(cells,two,party,50,{x:0,y:0},new Set(["cp1"]));
  assert.ok(only.has("100,100"));
  assert.ok(!only.has("200,200"));
  const remainder=clearHiddenForCheckpoint(
    [{x:100,y:100},{x:200,y:200}],only);
  assert.deepEqual(remainder,[{x:200,y:200}]);
});
test("new Scene default checkpoint radius is 2 cells",()=>{
  assert.equal(defaultPartyExploration().defaultRevealRadiusCells,2);
});
