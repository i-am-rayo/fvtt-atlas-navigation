import assert from "node:assert/strict";
import test from "node:test";
import {createRoadMeasuredDistanceRow} from "../scripts/road-settings-distance-view.js";

class Element {
  constructor(tag){this.tag=tag;this.children=[];this.className="";this.textContent="";
    this.attributes=new Map();}
  append(...children){this.children.push(...children);}
  appendChild(child){this.children.push(child);return child;}
  setAttribute(name,value){this.attributes.set(name,String(value));}
}

test("Road Settings General shows a read-only measured Road distance in native Scene units",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    const scene={id:"paedor",grid:{units:"km"}};
    const atlas={schemaVersion:10,nodes:[{id:"a",x:0,y:0},{id:"b",x:3,y:4}],
      segments:[{id:"s",roadId:"road",from:"a",to:"b",via:[]}]};
    const measured=[],view={ready:true,scene:{id:"paedor"},
      dimensions:{sceneX:100,sceneY:200},grid:{measurePath:points=>{
        measured.push(points);
        return {distance:Math.hypot(points[1].x-points[0].x,
          points[1].y-points[0].y)};
      }}};
    const panel=createRoadMeasuredDistanceRow({scene,roadId:"road",
      atlasProvider:()=>atlas,canvasProvider:()=>view});
    assert.equal(panel.row.children[0].textContent,"Authored Road distance");
    assert.equal(panel.output.tag,"output","read-only: no form input");
    assert.equal(panel.output.textContent,"5.00 km");
    assert.deepEqual(measured[0],[{x:100,y:200},{x:103,y:204}],
      "image-relative nodes map to native Canvas pixels");
    assert.match(panel.hint.textContent,/visual curves.*terrain/i);
    atlas.nodes[1].x=6;
    panel.refresh();
    assert.equal(panel.output.textContent,Math.hypot(6,4).toFixed(2)+" km",
      "refresh reflects current saved geometry without submitting a form");
    assert.equal(atlas.nodes[1].x,6);
  }finally{globalThis.document=previous;}
});

test("Road Settings distance refuses to guess when the Scene canvas is inactive",()=>{
  const previous=globalThis.document;
  try{
    globalThis.document={createElement:tag=>new Element(tag)};
    const scene={id:"a",grid:{units:"mi"}};
    let measurements=0;
    const atlas={schemaVersion:10,nodes:[{id:"a",x:0,y:0},{id:"b",x:3,y:4}],
      segments:[{roadId:"road",from:"a",to:"b",via:[]}]};
    let active={ready:true,scene:{id:"other"},grid:{measurePath:()=>{
      measurements++;return {distance:99};}}};
    const panel=createRoadMeasuredDistanceRow({scene,roadId:"road",
      atlasProvider:()=>atlas,canvasProvider:()=>active});
    assert.match(panel.output.textContent,/Unavailable/);
    assert.equal(measurements,0);
    active={ready:true,scene:{id:"a"},dimensions:{sceneX:0,sceneY:0},
      grid:{measurePath:()=>({distance:NaN})}};
    panel.refresh();
    assert.match(panel.output.textContent,/Unavailable/);
  }finally{globalThis.document=previous;}
});
