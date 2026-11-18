import test from "node:test";
import assert from "node:assert/strict";
import {confirmAtlasVisibilityChange} from "../scripts/atlas-visibility-confirmation.js";

test("manual Atlas publication confirmation is cancel-safe and uses plain text",async()=>{
  const priorFoundry=globalThis.foundry,priorDocument=globalThis.document;
  let answer=null,dialog=null;
  const element=tag=>({tag,children:[],textContent:"",
    appendChild(child){this.children.push(child);return child;}});
  try{
    globalThis.document={createElement:element};
    globalThis.foundry={applications:{api:{DialogV2:{
      confirm:async config=>{dialog=config;return answer;}
    }}}};
    const hostile='Dirwest <img src=x onerror=alert(1)> & "hidden"';
    const input={kind:"road",name:hostile,show:true};
    for(const result of [null,false]){
      answer=result;
      assert.equal(await confirmAtlasVisibilityChange(input),false);
    }
    assert.equal(dialog.content.tag,"div",
      "Foundry v14 requires a div root for DialogV2 content");
    assert.equal(dialog.content.children.length,3);
    assert.equal(dialog.content.children[0].textContent.includes(hostile),true);
    assert.equal(dialog.content.children.some(child=>child.tag!=="p"),false,
      "authored names must never become markup");
    assert.equal(dialog.rejectClose,false);
    assert.equal(dialog.modal,true);
    assert.equal(dialog.yes.label,"Show Road");
    assert.equal(dialog.no.label,"Cancel");
    answer=true;
    assert.equal(await confirmAtlasVisibilityChange(input),true);
    assert.equal(dialog.content.children[2].textContent.includes("save checks"),true);
    assert.equal(await confirmAtlasVisibilityChange({
      kind:"marker",name:"Bridge",show:false,staged:true
    }),true);
    assert.equal(dialog.yes.label,"Hide Map Marker");
    assert.match(dialog.content.children[2].textContent,/only the current draft/);
    assert.equal(await confirmAtlasVisibilityChange({
      kind:"discovery",name:"Bridge",show:true,staged:true
    }),true);
    assert.match(dialog.content.children[1].textContent,/known to the party/);
    assert.equal(await confirmAtlasVisibilityChange({
      kind:"territory",name:"Valecor",show:true
    }),true);
    assert.equal(dialog.yes.label,"Share Territory Boundary");
    assert.match(dialog.content.children[1].textContent,/unexplored/);
    assert.match(dialog.content.children[1].textContent,/Journey name/);
    await assert.rejects(()=>confirmAtlasVisibilityChange({
      kind:"unknown",name:"X",show:true
    }),/Invalid Atlas/);
  }finally{
    globalThis.foundry=priorFoundry;
    globalThis.document=priorDocument;
  }
});
