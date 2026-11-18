import test from "node:test";
import assert from "node:assert/strict";
import { createPublicTerritoryForm } from "../scripts/territory-public-form.js";

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = new Map(); }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
}

function all(root) {
  return [root, ...(root.children ?? []).flatMap(all)];
}

function withDocument(fn) {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag),
    createTextNode: text => ({ textContent: text }) };
  try { fn(); } finally { globalThis.document = previous; }
}

test("existing public label and opt-in survive DialogV2 HTML serialization", () => withDocument(() => {
  const form = createPublicTerritoryForm({nativeName:"Internal GM title",
    published:{label:"Dirwest"}});
  const [name, publish] = all(form).filter(item => item.name);
  assert.equal(name.value, "Dirwest");
  assert.equal(name.defaultValue, "Dirwest", "Field default must survive dialog reconstruction");
  assert.equal(publish.checked, true);
  assert.equal(publish.defaultChecked, true, "Checkbox default must survive reconstruction");
  assert.equal(publish.value, "true");
}));

test("native name is offered without automatically publishing it", () => withDocument(() => {
  const form = createPublicTerritoryForm({nativeName:"Millstone", published:null});
  const [name, publish] = all(form).filter(item => item.name);
  assert.equal(name.defaultValue, "Millstone");
  assert.equal(publish.checked, false);
  assert.equal(publish.defaultChecked, false);
  name.value = "Millstone West Gate";
  name.listeners.get("input")();
  assert.equal(name.defaultValue, "Millstone West Gate",
    "Edited text must persist when native dialog recreates its form");
}));
