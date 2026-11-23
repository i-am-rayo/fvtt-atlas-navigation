import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {renderNavigationTransportApproval} from "../scripts/navigation-transport-summary-view.js";

const fakeDocument=()=>({
  createElement(tag){return {tag,children:[],className:"",textContent:"",
    get attributes(){return this.className?[{name:"class"}]:[];},
    append(...nodes){this.children.push(...nodes);},
    appendChild(node){this.children.push(node);return node;}};}
});
const walk=(node,predicate)=>[node,...(node.children??[]).flatMap(child=>walk(child,predicate))].filter(predicate);
const text=(node)=>[node.textContent,...(node.children??[]).map(text)].join(" ");

test("shared transportation approval shows four semantic metric tiles, method table and estimate caveats",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document=fakeDocument();
    const content=renderNavigationTransportApproval({
      heading:"Transportation summary",destination:"Current leg to Port Barthos",
      rows:[{method:"Riding Horse",travelers:"Cassian, Jonathan",units:"2",cost:"2 SP"},
        {method:"Warhorse",travelers:"Lucious",units:"1",cost:"1 SP"},
        {method:"Walking",travelers:"Torrus, Nyx",units:"—",cost:"—"}],
      metrics:[["Total travelers","5"],["Group travel speed","3.00 mph"],
        ["Estimated moving time","9h 39m"],["Estimated transportation cost","3 SP"]],
      notes:["One Group explorer represents only these travelers.",
        "Estimates only; no boarding, payment or Actor modification."]});
    assert.equal(content.tag,"div","Foundry v14 DialogV2.content requires HTMLDivElement");
    assert.equal(content.attributes.length,0,
      "Foundry v14 DialogV2.content outer div must have NO attributes");
    assert.equal(content.children.length,1);
    assert.equal(content.children[0].className,"atlas-transport-approval",
      "layout styling belongs on the nested element, not the DialogV2 root");
    const headings=walk(content,node=>node.tag==="th");
    assert.deepEqual(headings.map(node=>node.textContent),["Method","Travelers","Units","Cost"]);
    assert.ok(headings.every(node=>node.scope==="col"));
    assert.equal(walk(content,node=>node.tag==="tbody")[0].children.length,3);
    assert.equal(walk(content,node=>node.tag==="dl").length,1);
    assert.equal(walk(content,node=>node.tag==="dt").length,4);
    assert.equal(walk(content,node=>node.tag==="dd").length,4);
    assert.equal(walk(content,node=>node.className==="atlas-transport-approval-metric").length,4);
    assert.match(text(content),/Current leg to Port Barthos/);
    assert.match(text(content),/no boarding, payment or Actor modification/);
  }finally{globalThis.document=previous;}
});

test("the same approval view supports single-vessel passenger and physical mount manifests",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document=fakeDocument();
    const content=renderNavigationTransportApproval({
      heading:"Transportation summary",destination:"Current leg to Hearth's Heart Dock",
      rows:[{method:"Ship passage (hired)",travelers:"Cassian, Lucious, Torrus, Nyx",
        units:"1",cost:"28 GP · 65 CP"}],
      metrics:[["Total travelers","4"],["Group travel speed","2.00 mph"],
        ["Estimated moving time","1d 23h 45m"],["Estimated transportation cost","28 GP · 65 CP"]],
      notes:["Not traveling: Jonathan Reid","Physical mounts: 2 Riding Horses and 1 Warhorse embarked",
        "Animal fare is included; no payment is deducted."]});
    assert.equal(content.attributes.length,0,"the vessel approval also uses a plain outer div");
    assert.equal(walk(content,node=>node.tag==="tbody")[0].children.length,1);
    assert.match(text(content),/Not traveling: Jonathan Reid/);
    assert.match(text(content),/2 Riding Horses and 1 Warhorse embarked/);
    assert.equal(walk(content,node=>node.tag==="dd").length,4);
    assert.ok(!("innerHTML" in content));
  }finally{globalThis.document=previous;}
});

test("transport approval tiles use a two-column narrow container and four equal wide columns",()=>{
  const css=readFileSync(new URL("../styles/atlas-ui.css",import.meta.url),"utf8");
  assert.match(css,/\.atlas-transport-approval-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css,/@container[^}]*min-width:\s*40rem[^}]*\.atlas-transport-approval-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css,/\.atlas-transport-approval\s*\{[^}]*container-type:\s*inline-size/s);
});
