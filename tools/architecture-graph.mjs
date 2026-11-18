/**
 * Atlas source dependency inventory. This is development tooling, not a
 * Foundry runtime dependency. It follows literal relative ESM references.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ownPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(ownPath), "..");

/** Return literal relative imports, re-exports and dynamic imports. */
export function relativeImports(source) {
  const patterns = [
    /\bfrom\s*["'](\.[^"']+)["']/g,
    /\bimport\s*["'](\.[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g
  ];
  return [...new Set(patterns.flatMap(pattern =>
    [...source.matchAll(pattern)].map(match => match[1])))].sort();
}

/** Pure graph projection; keys are repository-relative POSIX file paths. */
export function analyzeSourceGraph(sources) {
  const filenames = [...sources.keys()].sort();
  const known = new Set(filenames);
  const edges = new Map();
  const missing = [];
  for (const filename of filenames) {
    const imports = relativeImports(sources.get(filename));
    const targets = [];
    for (const specifier of imports) {
      const candidate = path.posix.normalize(path.posix.join(
        path.posix.dirname(filename), specifier));
      const target = [candidate, `${candidate}.js`, `${candidate}.mjs`,
        `${candidate}/index.js`].find(item => known.has(item));
      if (target) targets.push(target);
      else missing.push({ from: filename, specifier });
    }
    edges.set(filename, [...new Set(targets)].sort());
  }

  // Tarjan SCC: list genuine import cycles without counting separate paths
  // through the same strongly connected component multiple times.
  let sequence = 0;
  const indices = new Map(), lowLinks = new Map(), stack = [], onStack = new Set();
  const cycles = [];
  const visit = filename => {
    indices.set(filename, sequence); lowLinks.set(filename, sequence++);
    stack.push(filename); onStack.add(filename);
    for (const target of edges.get(filename)) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(filename, Math.min(lowLinks.get(filename), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(filename, Math.min(lowLinks.get(filename), indices.get(target)));
      }
    }
    if (lowLinks.get(filename) !== indices.get(filename)) return;
    const component = [];
    let popped;
    do {
      popped = stack.pop(); onStack.delete(popped); component.push(popped);
    } while (popped !== filename);
    if (component.length > 1 || edges.get(filename).includes(filename)) {
      cycles.push(component.sort());
    }
  };
  for (const filename of filenames) if (!indices.has(filename)) visit(filename);
  cycles.sort((a, b) => a.join("|").localeCompare(b.join("|")));
  return { filenames, edges, missing, cycles };
}

export function dependencyMermaid(graph, { focus = null } = {}) {
  const matches = focus ? new Set(graph.filenames.filter(file =>
    file.includes(focus))) : new Set(graph.filenames);
  if (focus && !matches.size) throw new Error(`No source file matches ${focus}`);
  const selected = new Set(matches);
  if (focus) {
    for (const [from, targets] of graph.edges) {
      if (matches.has(from)) for (const target of targets) selected.add(target);
      if (targets.some(target => matches.has(target))) selected.add(from);
    }
  }
  const files = [...selected].sort();
  const identifiers = new Map(files.map((file, index) => [file, `m${index}`]));
  const lines = ["flowchart LR"];
  for (const file of files) {
    lines.push(`  ${identifiers.get(file)}["${file}"]`);
  }
  for (const file of files) for (const target of graph.edges.get(file)) {
    if (selected.has(target)) lines.push(`  ${identifiers.get(file)} --> ${identifiers.get(target)}`);
  }
  return lines.join("\n") + "\n";
}

/** Baseline is an explicit debt register, never an exemption for new cycles. */
export function unexpectedCycles(graph, baseline) {
  const recorded = new Set(baseline.map(group => [...group].sort().join("|")));
  return graph.cycles.filter(group => !recorded.has(group.join("|")));
}

async function readScripts(directory, root, sources) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await readScripts(absolute, root, sources);
    else if (entry.isFile() && /\.m?js$/.test(entry.name)) {
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      sources.set(relative, await readFile(absolute, "utf8"));
    }
  }
}

export async function inspectRepository(root = projectRoot) {
  const sources = new Map();
  await readScripts(path.join(root, "scripts"), root, sources);
  return analyzeSourceGraph(sources);
}

async function main(args) {
  const graph = await inspectRepository();
  if (args.includes("--mermaid")) {
    const index = args.indexOf("--focus");
    process.stdout.write(dependencyMermaid(graph, {
      focus: index >= 0 ? args[index + 1] : null
    }));
    return;
  }
  if (args.includes("--json")) {
    process.stdout.write(JSON.stringify({
      files: graph.filenames,
      imports: Object.fromEntries(graph.edges),
      cycles: graph.cycles,
      missing: graph.missing
    }, null, 2) + "\n");
    return;
  }
  const dependencies = [...graph.edges.values()].reduce((sum, items) => sum + items.length, 0);
  const baseline = JSON.parse(await readFile(
    path.join(projectRoot, "tools/architecture-cycle-baseline.json"), "utf8"));
  const introduced = unexpectedCycles(graph, baseline.cycles);
  process.stdout.write(`Atlas imports: ${graph.filenames.length} files, `+
    `${dependencies} relationships, ${graph.cycles.length} cyclic groups, `+
    `${graph.missing.length} missing targets; ${introduced.length} new cyclic groups.\n`);
  for (const cycle of graph.cycles) process.stdout.write(`Cycle: ${cycle.join(" ↔ ")}\n`);
  for (const cycle of introduced) process.stderr.write(
    `New cycle: ${cycle.join(" ↔ ")}\n`);
  for (const item of graph.missing) process.stderr.write(
    `Missing: ${item.from} imports ${item.specifier}\n`);
  if (args.includes("--check") && (graph.missing.length || introduced.length)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === ownPath) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
