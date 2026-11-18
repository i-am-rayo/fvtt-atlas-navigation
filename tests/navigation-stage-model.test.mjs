import assert from "node:assert/strict";
import test from "node:test";
import {NAVIGATION_STAGES,resolveNavigationStage}
  from "../scripts/navigation-stage-model.js";
import {createNavigationStageShell,renderNavigationStageIntro,
  renderNavigationCompletedOverview} from "../scripts/navigation-stage-view.js";

test("Navigation stages are derived from authoritative state without mutation",()=>{
  const done={status:"completed"};
  const waiting={checkpoint:{name:"Port"}};
  const moving={phase:"paused"};
  assert.equal(resolveNavigationStage(),NAVIGATION_STAGES.DESTINATION);
  assert.equal(resolveNavigationStage({completedRecord:done}),NAVIGATION_STAGES.COMPLETED);
  assert.equal(resolveNavigationStage({completedRoute:true}),NAVIGATION_STAGES.COMPLETED);
  assert.equal(resolveNavigationStage({completedRecord:{status:"interrupted"}}),
    NAVIGATION_STAGES.DESTINATION);
  assert.equal(resolveNavigationStage({pendingTransfer:waiting,completedRecord:done}),
    NAVIGATION_STAGES.CHECKPOINT);
  assert.equal(resolveNavigationStage({pendingTransfer:waiting,travelSession:moving}),
    NAVIGATION_STAGES.JOURNEY);
  assert.deepEqual(done,{status:"completed"});
  assert.deepEqual(waiting,{checkpoint:{name:"Port"}});
  assert.deepEqual(moving,{phase:"paused"});
});

test("independent stage view renders read-only summary and safely escapes names",()=>{
  const before=globalThis.document;
  let actions=0;
  try{
    globalThis.document={createElement:tag=>({tag,children:[],style:{},
      textContent:"",append(...nodes){this.children.push(...nodes);},
      appendChild(node){this.children.push(node);},
      addEventListener(){actions++;}})};
    const {root,body}=createNavigationStageShell();
    body.append(...renderNavigationStageIntro({title:"Journey completed"}));
    const model={title:"Test <Harbor>",departed:"Day 1",arrived:"Day 2",
      moving:"4h",downtime:"8h",elapsed:"12h",legs:[{
        label:"Leg 1 · Test <Harbor>",details:"12 mi · 4h moving · Ship"}]};
    body.append(renderNavigationCompletedOverview(model));
    root.append(body);
    const nodes=element=>[element,...(element.children??[]).flatMap(nodes)];
    const flattened=nodes(root);
    assert.ok(flattened.some(node=>node.textContent==="Test <Harbor>"));
    assert.ok(flattened.some(node=>node.textContent==="12 mi · 4h moving · Ship"));
    assert.equal(flattened.some(node=>node.tag==="button"),false);
    assert.equal(actions,0);
    assert.deepEqual(model.legs,[{label:"Leg 1 · Test <Harbor>",
      details:"12 mi · 4h moving · Ship"}]);
  }finally{globalThis.document=before;}
});
