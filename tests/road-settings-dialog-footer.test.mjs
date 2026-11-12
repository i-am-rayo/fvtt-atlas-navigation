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
  let closed = 0;
  const cancel = {addEventListener(type, handler) { this[type] = handler; }};
  const dialog={element:{ownerDocument:{createElement:()=>cancel},querySelector:()=>bar},
    form:{querySelector:()=>footer}, close:()=>closed++};
  assert.equal(arrangeRoadDialogFooter(dialog),save);
  assert.deepEqual(footer.nodes,[remove,edit,connection,cancel,save]);
  assert.equal(bar.style.display,"none");
  assert.equal(cancel.type,"button");
  assert.equal(cancel.textContent,"Cancel");
  cancel.click();
  assert.equal(closed,1);
});

test("missing native footer leaves Road Settings controls untouched",()=>{
  const dialog={element:{querySelector:()=>({style:{},querySelector:()=>null})},
    form:{querySelector:()=>null}};
  assert.equal(arrangeRoadDialogFooter(dialog),null);
});

test("Road Settings footer permits visible labels and separates Delete",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../module.json",import.meta.url),"utf8"));
  assert.ok(manifest.styles.includes("styles/road-settings-dialog.css"));
  const css=readFileSync(new URL("../styles/road-settings-dialog.css",import.meta.url),"utf8");
  assert.match(css,/\.application:has\(\[data-atlas-road-live\]\) \.form-footer/);
  assert.match(css,/margin-inline-end: auto/);
  assert.match(css,/width: auto/);
  assert.match(css,/\[data-atlas-road-actions\]/);
  assert.doesNotMatch(css,/\.application \.form-footer\s*\{/,
    "Do not resize Save buttons in unrelated Foundry dialogs");
});
