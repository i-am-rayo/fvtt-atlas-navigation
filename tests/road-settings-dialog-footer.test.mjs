import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {arrangeRoadDialogFooter} from "../scripts/road-settings-dialog-footer.js";

test("Road Settings keeps Foundry's Save button in its native DialogV2 footer",()=>{
  const edit={id:"edit"},connection={id:"connection"},save={id:"save"},remove={id:"delete"};
  const bar={style:{},querySelector:selector=>({
    '[data-atlas-road-tool="edit"]':edit,
    '[data-atlas-road-tool="connection"]':connection,
    '[data-atlas-road-tool="delete"]':remove
  })[selector]};
  const footer={nodes:[save],style:{},
    querySelector:()=>save,
    insertBefore(item,before){
      const current=this.nodes.indexOf(item);
      if(current!==-1)this.nodes.splice(current,1);
      this.nodes.splice(this.nodes.indexOf(before),0,item);
    },
    appendChild(item){this.nodes.push(item);}
  };
  const dialog={element:{querySelector:()=>bar},form:{querySelector:()=>footer}};
  assert.equal(arrangeRoadDialogFooter(dialog),save);
  assert.deepEqual(footer.nodes,[edit,connection,save,remove]);
  assert.equal(bar.style.display,"none");
  assert.match(footer.style.cssText,/justify-content:flex-end/);
  assert.equal(footer.nodes[2],save,"native Save stays in Foundry's form footer");
});

test("missing native footer leaves Road Settings controls untouched",()=>{
  const dialog={element:{querySelector:()=>({style:{},querySelector:()=>null})},
    form:{querySelector:()=>null}};
  assert.equal(arrangeRoadDialogFooter(dialog),null);
});

test("Road Settings Save is compact before the render callback moves footer tools",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../module.json",import.meta.url),"utf8"));
  assert.ok(manifest.styles.includes("styles/road-settings-dialog.css"));
  const css=readFileSync(new URL("../styles/road-settings-dialog.css",import.meta.url),"utf8");
  assert.match(css,/\.application:has\(\[data-atlas-road-live\]\) \.form-footer/);
  assert.match(css,/button\[data-action="ok"\]/);
  assert.match(css,/flex: 0 0 2\.5rem !important/);
  assert.match(css,/\[data-atlas-road-actions\]/);
  assert.doesNotMatch(css,/\.application \.form-footer\s*\{/,
    "Do not resize Save buttons in unrelated Foundry dialogs");
});
