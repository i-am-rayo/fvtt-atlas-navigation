import test from "node:test";
import assert from "node:assert/strict";
import {nativeRegionColorHex,nativeRegionColorNumber}
  from "../scripts/native-region-color.js";

test("Atlas uses a Region's exact native green without substituting amber",()=>{
  assert.equal(nativeRegionColorHex("#4d972b"),"#4d972b");
  assert.equal(nativeRegionColorNumber("#4d972b"),0x4d972b);
  assert.equal(nativeRegionColorNumber(new Number(0x4d972b)),0x4d972b);
  assert.equal(nativeRegionColorNumber({toHTML:()=>"#4d972b"}),0x4d972b);
  assert.equal(nativeRegionColorNumber({valueOf:()=>0x4d972b}),0x4d972b);
  assert.equal(nativeRegionColorHex("#4d9"),"#44dd99");
  assert.equal(nativeRegionColorHex("0x4D972B"),"#4d972b");
  assert.equal(nativeRegionColorHex("rgb(77, 151, 43)"),"#4d972b");
  assert.equal(nativeRegionColorHex("rgb(77 151 43)"),"#4d972b");
  assert.equal(nativeRegionColorHex(0),"#000000");
  assert.equal(nativeRegionColorHex(0xffffff),"#ffffff");
});

test("unknown Region colors fail closed instead of misrepresenting native Appearance",()=>{
  for(const invalid of [undefined,null,{},"yellow","#12345g","#12345678",
    0x1000000,-1,Infinity,{},Object.create(null)]) {
    assert.equal(nativeRegionColorHex(invalid),null);
    assert.equal(nativeRegionColorNumber(invalid),null);
  }
});
