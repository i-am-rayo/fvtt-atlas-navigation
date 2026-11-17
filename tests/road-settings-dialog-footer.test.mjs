import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {arrangeRoadDialogFooter} from "../scripts/road-settings-dialog-footer.js";

test("Road Settings keeps Foundry's Save button in its native DialogV2 footer",()=>{
  const edit={id:"edit"},connection={id:"connection"},remove={id:"delete"};
  const classes=new Set();
  const save={id:"save",dataset:{action:"ok"},attrs:{},
    setAttribute(name,value){this.attrs[name]=value;},
    replaceChildren(...children){this.children=children;},
    appendChild(child){this.children.push(child);},
    classList:{add(...names){for(const name of names)classes.add(name);}}};
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
  const dialog={element:{ownerDocument:{createElement:tag=>tag==="i"?
    {tag,className:"",attrs:{},setAttribute(k,v){this.attrs[k]=v;}}:cancel},querySelector:()=>bar},
    form:{querySelector:()=>footer}, close:()=>closed++};
  assert.equal(arrangeRoadDialogFooter(dialog),save);
  assert.deepEqual(footer.nodes,[edit,connection,cancel,save,remove],
    "Road utility actions lead, native Save stays in the form, Delete is last");
  assert.equal(bar.style.display,"none");
  assert.equal(cancel.type,"button");
  assert.equal(cancel.textContent,"Cancel");
  assert.equal(save.dataset.action,"ok","native DialogV2 submit ownership is intact");
  assert.equal(save.title,"Save Road");
  assert.equal(save.attrs["aria-label"],"Save Road");
  assert.ok(classes.has("atlas-ui-icon-button"));
  assert.equal(save.children[0].className,"fa-solid fa-floppy-disk");
  assert.equal(save.children[0].attrs["aria-hidden"],"true");
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
  assert.match(css,/margin-inline-start: auto/);
  assert.match(css,/width: auto/);
  assert.match(css,/\[data-atlas-road-actions\]/);
  assert.doesNotMatch(css,/\.application \.form-footer\s*\{/,
    "Do not resize Save buttons in unrelated Foundry dialogs");
});
