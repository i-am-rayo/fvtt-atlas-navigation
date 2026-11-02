import assert from "node:assert/strict";
import test from "node:test";
import {waitForTokenTravelAnimation} from "../scripts/navigation-movement-lifecycle.js";

test("waits for a client animation after the document has already finished moving",async()=>{
  let finish;
  const token={object:{movementAnimationPromise:new Promise(resolve=>{finish=resolve;})}};
  let settled=false;
  const pending=waitForTokenTravelAnimation(token).then(()=>{settled=true;});
  await Promise.resolve();
  assert.equal(settled,false);
  finish();
  await pending;
  assert.equal(settled,true);
});

test("tokens without a rendered canvas animation complete without polling",async()=>{
  await waitForTokenTravelAnimation({object:{movementAnimationPromise:null}});
  await waitForTokenTravelAnimation(null);
});
