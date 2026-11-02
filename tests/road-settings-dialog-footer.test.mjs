import test from "node:test";
import assert from "node:assert/strict";
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
