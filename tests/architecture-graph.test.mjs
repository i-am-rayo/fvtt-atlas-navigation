import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { analyzeSourceGraph, dependencyMermaid, inspectRepository,
  relativeImports, unexpectedCycles } from "../tools/architecture-graph.mjs";

test("dependency scanner recognizes relative imports and re-exports", () => {
  const source = [
    'import { one,',
    '  two } from "./one.js";',
    'export { three } from "../three.js";',
    'import "./setup.js";',
    'const lazy = import("./lazy.js");',
    'import { again } from "./one.js";'
  ].join("\n");
  assert.deepEqual(relativeImports(source), [
    "../three.js", "./lazy.js", "./one.js", "./setup.js"
  ]);
});

test("missing files are reported and SCCs identify cycles once", () => {
  const graph = analyzeSourceGraph(new Map([
    ["scripts/a.js", 'import "./b.js";'],
    ["scripts/b.js", 'import "./c.js";'],
    ["scripts/c.js", 'import "./a.js"; import "./missing.js";'],
    ["scripts/unrelated.js", "export const ready = true;"]
  ]));
  assert.deepEqual(graph.cycles, [["scripts/a.js", "scripts/b.js", "scripts/c.js"]]);
  assert.deepEqual(graph.missing, [
    { from: "scripts/c.js", specifier: "./missing.js" }
  ]);
  assert.deepEqual(unexpectedCycles(graph, []), graph.cycles);
  assert.deepEqual(unexpectedCycles(graph, graph.cycles), []);
});

test("focused Mermaid shows direct consumers and dependencies only", () => {
  const graph = analyzeSourceGraph(new Map([
    ["scripts/entry.js", 'import "./controller.js";'],
    ["scripts/controller.js", 'import "./model.js";'],
    ["scripts/model.js", 'import "./storage.js";'],
    ["scripts/storage.js", "export const saved = true;"],
    ["scripts/other.js", "export const other = true;"]
  ]));
  const focused = dependencyMermaid(graph, { focus: "controller.js" });
  assert.match(focused, /scripts\/entry\.js/);
  assert.match(focused, /scripts\/controller\.js/);
  assert.match(focused, /scripts\/model\.js/);
  assert.doesNotMatch(focused, /scripts\/storage\.js/);
  assert.doesNotMatch(focused, /scripts\/other\.js/);
  assert.throws(() => dependencyMermaid(graph, { focus: "unknown" }),
    /No source file matches/);
});

test("actual Atlas source has resolvable relative imports and no untracked cycles", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const graph = await inspectRepository(root);
  const baseline = JSON.parse(await readFile(path.join(root,
    "tools/architecture-cycle-baseline.json"), "utf8"));
  assert.ok(graph.filenames.length >= 100);
  assert.deepEqual(graph.missing, []);
  assert.deepEqual(unexpectedCycles(graph, baseline.cycles), []);
});
