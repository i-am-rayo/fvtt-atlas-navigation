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
    "break.ended","journey.paused"];
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
  assert.equal(pending[0].ms,4500);
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

test("Foundry integration is settings-only with no Scene or gameplay writes",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../module.json",import.meta.url),"utf8"));
  assert.match(manifest.version,/^0\.3\.9-beta\.[2-9]\d*$/,
    "beta.3 and later must retain the preview foundation");
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
