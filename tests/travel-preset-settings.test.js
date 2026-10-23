import test from "node:test";
import assert from "node:assert/strict";

// Minimal reflected-attribute DOM stub: DialogV2 serializes the supplied
// HTMLElement to markup, rather than reusing the original node.
class ElementStub {
  constructor(tag) {
    this.tag = tag;
    this.attributes = [];
    this.children = [];
    this.style = {};
    Object.defineProperty(this.style, "cssText", {
      set: value => this.setAttribute("style", value)
    });
  }

  setAttribute(name, value) {
    const existing = this.attributes.find(attr => attr.name === name);
    if (existing) existing.value = String(value);
    else this.attributes.push({ name, value: String(value) });
  }

  getAttribute(name) {
    return this.attributes.find(attr => attr.name === name)?.value ?? null;
  }

  set textContent(value) { this.text = String(value); }
  set name(value) { this.setAttribute("name", value); }
  set required(value) { if (value) this.setAttribute("required", ""); }
  set maxLength(value) { this.setAttribute("maxlength", value); }
  set defaultValue(value) { this.setAttribute("value", value); }
  set defaultSelected(value) { if (value) this.setAttribute("selected", ""); }
  set type(value) { this.setAttribute("type", value); }
  set step(value) { this.setAttribute("step", value); }
  set min(value) { this.setAttribute("min", value); }
  set max(value) { this.setAttribute("max", value); }
  set value(value) {
    // The live value of an input is not its serialized HTML default value.
    if (this.tag === "option") this.setAttribute("value", value);
    else this.liveValue = String(value);
  }

  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
}

function namedField(parent, name) {
  const queue = [parent];
  while (queue.length) {
    const current = queue.shift();
    if (current.getAttribute("name") === name) return current;
    queue.push(...current.children);
  }
  throw new Error("Missing dialog field " + name);
}

test("Add and Edit use plain v14 DialogV2 content and persist serialized form defaults", async () => {
  const seen = [];
  globalThis.document = { createElement: tag => new ElementStub(tag) };
  globalThis.game = { user: { isGM: true } };
  globalThis.foundry = {
    applications: { api: {
      ApplicationV2: class {},
      DialogV2: { input: async ({ content }) => {
        assert.equal(content.tag, "div");
        assert.equal(content.attributes.length, 0,
          "Foundry v14 rejects attributes on the outermost dialog content div");
        seen.push(content);
        return null; // Cancel: no changes to world settings.
      } }
    } }
  };

  const { AtlasTravelPresetSettings } = await import("../scripts/travel-preset-settings.js");
  const settings = new AtlasTravelPresetSettings();

  await settings._editPreset({ id: "existing", mode: "air",
    name: "Rock & Ridge <North>", movementCostMultiplier: 1.75 });
  assert.equal(namedField(seen[0], "presetName").getAttribute("value"),
    "Rock & Ridge <North>");
  assert.equal(namedField(seen[0], "presetCost").getAttribute("value"), "1.75");
  const editMode = namedField(seen[0], "presetMode");
  assert.equal(editMode.children.find(option => option.getAttribute("selected") !== null)
    .getAttribute("value"), "air");

  await settings._editPreset(null, "water");
  assert.equal(namedField(seen[1], "presetName").getAttribute("value"), "");
  assert.equal(namedField(seen[1], "presetCost").getAttribute("value"), "1");
  const addMode = namedField(seen[1], "presetMode");
  assert.equal(addMode.children.find(option => option.getAttribute("selected") !== null)
    .getAttribute("value"), "water");
});
