# Atlas engineering tooling

Verified locally on 2026-11-13, branch `chore/codex-engineering-tooling`, base `d8877b9`, module/package version `0.3.9-beta.8.50`. Tooling-only changes prepared for a dedicated draft PR against `test/v0.3.9-beta.8.50-active-journey-controls`; no gameplay, version, merge or release changes. OmniRoute remains deferred.

## Availability and compatibility

- Agent Skills 0.6.15 is discovered in this Codex session through the installed plugin cache. All 25 SKILL.md files are readable and contain name/description frontmatter. The using-agent-skills workflow and shared Definition of Done were read successfully. There is no separate Agent Skills copy under ~/.agents/skills or ~/.codex/skills; plugin discovery is the working installation mechanism. This verifies discovery and instruction use, not every workflow's optional tool integrations (for example Chrome DevTools).
- Graphify distribution `graphifyy==0.9.108` runs at `~/.local/bin/graphify`, using its uv-managed Python 3.10 environment. Imports of Graphify and installed metadata succeed. Tree-sitter 0.25.2 and tree-sitter-javascript 0.25.0 are present. Graphify is callable as a CLI; no Graphify skill was advertised in this session's skill catalog.
- Node v26.10.0 ran the checks; CI specifies Node 24. No dependency installation or host configuration change was needed.

## Project-scoped installer preview and decision

The installed package's `_agents_install(project_dir, "codex", project=True)` was exercised against a temporary copy of AGENTS.md outside the repository. The original charter remained a byte-identical prefix. It proposed appending the following section and creating .codex/hooks.json with a Bash PreToolUse command `graphify hook-check`:

~~~markdown
## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
~~~

The installed installer explicitly describes that Codex Desktop hook as an intentional no-op (additionalContext is rejected). Neither the hook nor the stock instructions were installed in Atlas. Mandatory graph-first browsing, restricting source reads, and accepting generated graph churn unconditionally would weaken source verification and review.

Instead, AGENTS.md receives only an additive Atlas-specific block: Graphify is advisory, source inspection remains available, Atlas's architecture checker and regression gates remain authoritative, and external LLM work/hooks/watchers/uploads are excluded. All preexisting charter bytes are preserved. No full third-party skill is vendored.

## Reproducible local extraction

From the repository root:

~~~sh
graphify extract scripts --code-only --no-cluster --max-workers 2 --out .
graphify query "native movement" --budget 1000 --depth 1
graphify explain atlas_storage_readatlas
graphify path atlas_storage_readatlas atlas_model_validateatlas
graphify god-nodes --top 5 --json
npm run architecture:check
npm run check
~~~

The reviewed code-only CLI branch clears semantic inputs; no-cluster bypasses clustering and community labeling. Initial extraction scanned exactly 211 runtime JavaScript files, zero documents/papers/images, and returned exit 0 with no stderr. It produced 1,871 nodes and 6,520 edges; graph metadata records 0 input and 0 output LLM tokens. No external LLM processing was invoked. These are local AST results, not semantic or live Foundry analysis.

Output is ignored at /graphify-out/ (graph, manifest, build configuration, source-root marker and cache). Source locations are relative to scripts/, so atlas-storage.js means scripts/atlas-storage.js. Repeat the same extraction command after source changes; do not substitute unrestricted semantic extraction. No background updater or Git hook was installed.

## Comparison with the existing architecture checker

Both tools cover all 211 scripts. Mapping Graphify imports_from source/target IDs to source_file paths, prefixing scripts/, and deduplicating ordered file pairs produces exactly the same 683 import relationships as tools/architecture-graph.mjs --json: no missing or extra pairs. Graphify records 684 raw imports_from edges because a file pair can have multiple source occurrences.

| Graphify relation | Raw edges |
| --- | ---: |
| contains | 1,360 |
| imports_from | 684 |
| imports | 1,272 |
| calls | 2,864 |
| method | 300 |
| indirect_call | 25 |
| dynamic_import | 2 |
| re_exports | 13 |

Graphify adds symbol-level navigation. Successful query, explain, path and god-nodes smoke tests locate readAtlas() at atlas-storage.js:7 and its call to validateAtlas() at line 11; direct source inspection confirms that call. Reported hubs include main.actions (degree 126), readAtlas (83), AtlasNavigationController (74), validateAtlas (65), and RoadCanvasController (64). Degree mixes containment, import and call relationships; it is not a defect score or authorization to refactor.

Atlas remains the dependency gate: it reports zero cycles, zero missing targets and zero new cyclic groups, and tests its scanner/baseline behavior. Graphify's richer AST associations do not prove dynamic Foundry hook dispatch, permissions, runtime behavior or complete call coverage. No cycle baseline was changed. Clustering, semantic inference and community names were deliberately not generated.

## Validation and scope

- npm run architecture:check: PASS, 4/4 tests, 211 files / 683 relationships, no cycles or missing targets.
- npm run check: PASS, syntax checks and 1,067/1,067 tests, zero failures/skips/cancellations.
- git diff --check: PASS.
- Original AGENTS.md preserved as an exact prefix; runtime code, package.json, module.json, tests, CI and architecture checker unchanged.
- Foundry v14 GM/player live testing was not run; this tooling integration does not claim gameplay acceptance or lift existing draft gates.

Reviewable changes: AGENTS.md appendix, .gitignore for local development output, and this document. Commit/push and a dedicated draft PR are owner-authorized; merge and release are not. PR #354 remains untouched.

## Installation and persistence

Graphify is an optional per-developer tool, not a package.json or Foundry dependency. With uv already installed, reproduce the tested version using `uv tool install graphifyy==0.9.108`; ensure `~/.local/bin` is on PATH, then run `graphify --help` and the extraction command above. Do not run `graphify codex install` in this repository: the reviewed Atlas appendix already supplies the intended instructions.

Install/enable the Agent Skills plugin in Codex (tested plugin version 0.6.15), then start a new session in this workspace. Verify the available-skills catalog includes `agent-skills:using-agent-skills`, `agent-skills:code-review-and-quality`, and `agent-skills:git-workflow-and-versioning`; read the discovery skill and its referenced Definition of Done. The plugin and Graphify executable persist in the host user profile, not Git. A clone receives only these project instructions and documentation; it must install its own tools and build its own graph. Plugin cache paths are observations, not portable installation targets.

Fresh-session verification passed in a separate Codex task (01a1d4fa-1e86-7f51-91ee-38daf5d245eb): all three named skills appeared in its supplied catalog; their SKILL.md files and the shared Definition of Done were readable at the installed 0.6.15 plugin root. This verifies discovery beyond the original conversation, not every optional workflow integration or future host installation.

The root .gitignore excludes graphify-out/ recursively (graph, caches, manifests, logs), common local caches, temporary files and environment credentials. Temporary installer/fresh-session evidence lives under /private/tmp and is not needed at runtime. Ignoring output does not prevent a naive filesystem ZIP from including it: build release artifacts from reviewed tracked module files and explicitly exclude development output. No packaging or release workflow is changed here.

## Practical evaluation: rest playback and controller

At base d8877b9, Graphify directly extracts the controller import of both rest helpers at navigation-controller.js:80 and the call from waitForDailyTravelChoice to visualRestDurationMs at line 1630. A two-level reverse calls traversal also finds startGuidedTravel at line 2035. Actual source confirms these relationships. Atlas's file-level checker independently identifies navigation-controller.js as the sole runtime importer of navigation-rest-playback.js and reports no relative imports from the latter.

~~~sh
graphify explain navigation_rest_playback --all
graphify explain navigation_rest_playback_visualrestdurationms --all
graphify affected navigation_rest_playback_visualrestdurationms --relation calls --depth 2
graphify affected navigation_rest_playback_createvisualresthold --relation calls --depth 2
node tools/architecture-graph.mjs --mermaid --focus navigation-rest-playback
rg -n "createVisualRestHold|visualRestDurationMs|restHoldFactory" scripts tests
~~~

The second affected query reports **No affected nodes found** for createVisualRestHold. Source proves a real dependency through constructor injection: restHoldFactory defaults to createVisualRestHold at controller line 133, is assigned to this.restHoldFactory at 146, and is invoked at 1637. Graphify records the import but does not resolve this injected call to the default implementation. The rest hold's finished/cancel/finish lifecycle also needs source and tests to establish behavior.

These behavioral conclusions are source-grounded human/agent interpretation, not Graphify semantic inference: the controller awaits commitGuidedTravelBreak before constructing a presentation-only hold (1623–1637), awaits hold.finished, and cancels in finally (1640–1645). The helper itself writes neither World time nor Journal state. Injection permits replacement implementations, so a statically assumed default is not proof of every runtime call. No LLM-inferred relationships were generated in this code-only evaluation.

**Impact-analysis verdict:** materially more precise for direct calls (specific methods and call sites beyond a file-import edge), but not a complete change-impact oracle. For the injected timer factory it adds no reliable caller coverage beyond imports and would give a false-negative impact assessment if used alone. Runtime-only extraction also intentionally omits tests; rg finds navigation-rest-playback.test.mjs and navigation-daily-controller.test.mjs, which must remain in the review. Broad keyword queries can match unrelated symbols (the rest-playback query also found restoreTerritoryPolygonBackup) and may exceed a requested token budget when edges are included. Prefer exact symbol IDs for focused inspection.

Use Graphify for locating unfamiliar direct callers, tracing explicit symbol paths and generating a candidate review list. Prefer Atlas architecture checks for deterministic missing-import/cycle gates; rg and source inspection for injected callbacks, lifecycle/permission guards and test discovery; Node tests for executable regression evidence. Foundry live acceptance remains necessary for gameplay changes, but is not required solely for these non-shipped tooling instructions.

## Finalization review

Reviewed every tracked diff and each untracked file separately. No executable logic was introduced, so mutation tests are inapplicable. The original AGENTS.md is an exact prefix, and the appendix explicitly subordinates third-party workflows to the charter. Graphify remains optional and all original native Foundry ownership, permissions and acceptance boundaries remain in force. No runtime, manifest, version, schema, tests, CI, architecture baseline or release artifacts changed.

The final quality gate reran npm run check (1,067/1,067), npm run architecture:check (4/4, no cycles or missing imports), all 395 tracked JavaScript/MJS files through node --check, and whitespace validation (including untracked files separately). Local Node is v26.10.0; CI remains on Node 24. These tools are ready for routine optional use with fresh local extraction and mandatory source verification, subject to the injected-call and runtime-analysis limitations above. OmniRoute remains deferred.
