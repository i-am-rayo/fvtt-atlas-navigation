import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {ATLAS_ANNOUNCEMENT_TYPES,atlasAnnouncementPreview}
  from "../scripts/atlas-announcement-model.js";
import {AtlasAnnouncementPreviewRenderer}
  from "../scripts/atlas-announcement-view.js";

function fakeElement(tagName){
  return {
    tagName,children:[],attributes:{},textContent:"",className:"",parent:null,
    append(...children){for(const child of children){this.children.push(child);child.parent=this;}},
    appendChild(child){this.append(child);return child;},
    replaceChildren(...children){for(const child of this.children)child.parent=null;
      this.children=[];this.append(...children);},
    setAttribute(key,value){this.attributes[key]=value;},
    remove(){if(this.parent){this.parent.children=this.parent.children.filter(child=>child!==this);
      this.parent=null;}}
  };
}

test("every requested Journey/discovery banner has a distinct validated template",()=>{
  const expected=["checkpoint.discovered","road.discovered","checkpoint.arrived",
    "destination.reached","journey.started","journey.ended","break.started",
    "break.ended","journey.paused","journey.awaiting-gm","journey.interrupted"];
  assert.deepEqual(ATLAS_ANNOUNCEMENT_TYPES.map(type=>type.id),expected);
  assert.equal(new Set(ATLAS_ANNOUNCEMENT_TYPES.map(type=>type.id)).size,expected.length);
  for(const type of ATLAS_ANNOUNCEMENT_TYPES){
    const spec=atlasAnnouncementPreview(type.id);
    assert.equal(spec.schemaVersion,1);
    assert.equal(spec.type,type.id);
    for(const prop of ["eyebrow","lead","subject","icon","theme"])
      assert.ok(spec[prop]);
  }
  assert.equal(atlasAnnouncementPreview("journey.ended").eyebrow,"Journey Concluded");
  assert.equal(atlasAnnouncementPreview("destination.reached").eyebrow,"Destination Reached");
  assert.equal(atlasAnnouncementPreview("destination.reached",{
    subject:"your destination"}).lead,"You have reached");
  assert.equal(atlasAnnouncementPreview("destination.reached",{
    subject:"Dirwest"}).lead,"Welcome to");
});

test("preview specs fail closed for unsupported events and malformed text",()=>{
  assert.throws(()=>atlasAnnouncementPreview("token.teleported"),/Unsupported/);
  assert.throws(()=>atlasAnnouncementPreview("checkpoint.discovered",{subject:""}),/readable/);
  assert.throws(()=>atlasAnnouncementPreview("checkpoint.discovered",{subject:"bad\nname"}),/readable/);
  assert.throws(()=>atlasAnnouncementPreview("checkpoint.discovered",{subject:"x".repeat(161)}),/readable/);
  assert.equal(atlasAnnouncementPreview("checkpoint.discovered",{subject:"  Port Barthos  "}).subject,
    "Port Barthos");
});

test("DOM preview is local, escaped by textContent, and reuses one overlay",()=>{
  const body=fakeElement("body"),created=[];
  const documentRef={body,createElement(tag){const el=fakeElement(tag);created.push(el);return el;}};
  const cancelled=[],pending=[];
  const renderer=new AtlasAnnouncementPreviewRenderer({documentRef,
    setTimeoutFn:(fn,ms)=>{pending.push({fn,ms});return pending.length;},
    clearTimeoutFn:id=>cancelled.push(id)});
  assert.equal(renderer.show("checkpoint.discovered",{subject:"<script>alert('x')</script>"}),true);
  assert.equal(body.children.length,1);
  const first=body.children[0];
  const banner=first.children[0];
  const copy=banner.children[1];
  assert.equal(copy.children[2].textContent,"<script>alert('x')</script>");
  assert.equal(copy.children[2].children.length,0,
    "untrusted visible names must never become raw HTML");
  assert.equal(banner.attributes.role,"status");
  assert.equal(first.attributes["aria-live"],"polite");
  assert.equal(pending[0].ms,5000);
  assert.equal(renderer.show("journey.paused"),true);
  assert.equal(body.children.length,1);
  assert.equal(body.children[0],first);
  assert.equal(first.children.length,1);
  assert.deepEqual(cancelled,[1]);
  pending[0].fn();
  assert.equal(body.children.length,1,
    "a callback queued before the next sample cannot dismiss its replacement");
  pending[1].fn();
  assert.equal(body.children.length,0);
  assert.equal(renderer.layer,null);
  renderer.destroy();
});

test("live announcements display FIFO for five seconds each, even when simultaneous",()=>{
  const body=fakeElement("body");
  const documentRef={body,createElement:fakeElement};
  const timers=[],cancelled=[];
  const renderer=new AtlasAnnouncementPreviewRenderer({documentRef,
    setTimeoutFn:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
    clearTimeoutFn:id=>cancelled.push(id)});
  assert.equal(renderer.enqueue("checkpoint.discovered",{subject:"Hearth's Heart"}),true);
  assert.equal(renderer.enqueue("road.discovered",{subject:"Old King's Road"}),true);
  assert.equal(renderer.enqueue("destination.reached",{subject:"Dirwest"}),true);
  assert.equal(timers.length,1,"one active timer, not one per event");
  assert.equal(renderer.queue.length,2);
  const layer=body.children[0];
  const visibleSubject=()=>layer.children[0].children[1].children[2].textContent;
  assert.equal(visibleSubject(),"Hearth's Heart");
  assert.equal(timers[0].ms,5000);
  timers[0].fn();
  assert.equal(visibleSubject(),"Old King's Road");
  assert.equal(timers[1].ms,5000);
  timers[1].fn();
  assert.equal(visibleSubject(),"Dirwest");
  assert.equal(timers[2].ms,5000);
  timers[2].fn();
  assert.equal(body.children.length,0);
  assert.deepEqual(cancelled,[],"completed timers need no cancellation");
});

test("queue is bounded; destroy or manual preview replaces and clears pending items",()=>{
  const body=fakeElement("body");
  const timers=[];
  const renderer=new AtlasAnnouncementPreviewRenderer({
    documentRef:{body,createElement:fakeElement},maxQueue:1,
    setTimeoutFn:fn=>{timers.push(fn);return timers.length;},clearTimeoutFn:()=>{}});
  assert.equal(renderer.enqueue("journey.started"),true);
  assert.equal(renderer.enqueue("checkpoint.arrived"),true);
  assert.equal(renderer.enqueue("journey.ended"),false);
  assert.equal(renderer.queue.length,1);
  assert.equal(renderer.show("journey.paused"),true);
  assert.equal(renderer.queue.length,0);
  timers[0]();
  assert.equal(body.children.length,1,"stale timer cannot advance a replaced banner");
  renderer.enqueue("destination.reached");
  renderer.destroy();
  assert.equal(renderer.queue.length,0);
  assert.equal(body.children.length,0);
  timers.at(-1)();
  assert.equal(body.children.length,0,"stale callback cannot recreate a banner");
});

test("native Window timers are invoked with their original host context",()=>{
  const realSetTimeout=globalThis.setTimeout;
  const realClearTimeout=globalThis.clearTimeout;
  try{
    globalThis.setTimeout=function(callback,ms){
      assert.equal(this,globalThis,"browser timer must not bind to Atlas renderer");
      assert.equal(ms,5000);
      return 19;
    };
    globalThis.clearTimeout=function(id){
      assert.equal(this,globalThis,"browser timer clear must retain host context");
      assert.equal(id,19);
    };
    const renderer=new AtlasAnnouncementPreviewRenderer({
      documentRef:{body:fakeElement("body"),createElement:fakeElement}});
    assert.equal(renderer.show("journey.started"),true);
    renderer.destroy();
  }finally{
    globalThis.setTimeout=realSetTimeout;
    globalThis.clearTimeout=realClearTimeout;
  }
});

test("Foundry integration is settings-only with no Scene or gameplay writes",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../module.json",import.meta.url),"utf8"));
  assert.match(manifest.version,/^0\.3\.9-beta\.[2-9]\d*(?:\.\d+)?$/,
    "beta.3 hotfixes and later must retain the preview foundation");
  assert.ok(manifest.styles.includes("styles/atlas-announcements.css"));
  assert.ok(manifest.esmodules.includes("scripts/atlas-announcement-settings.js"));
  const settingsSource=readFileSync(new URL("../scripts/atlas-announcement-settings.js",import.meta.url),"utf8");
  assert.match(settingsSource,/game\.settings\.registerMenu/);
  assert.match(settingsSource,/restricted:true/);
  assert.match(settingsSource,/game\?\.user\?\.isGM/);
  assert.doesNotMatch(settingsSource,/game\.socket|\.setFlag\(|\.update\(/);
  const styles=readFileSync(new URL("../styles/atlas-announcements.css",import.meta.url),"utf8");
  assert.match(styles,/prefers-reduced-motion: reduce/);
  assert.match(styles,/\.atlas-announcement-layer/);
});
