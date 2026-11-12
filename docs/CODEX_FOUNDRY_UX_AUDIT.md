# Codex live Foundry VTT v14: Atlas user-experience audit playbook

**Status:** review-only test protocol. **Scope:** `fvtt-atlas-navigation` / Foundry v14 / one explicitly designated World and Scene. This document is a checklist, not a grant of browser permissions or a sandbox. Product Owner approval is required before changing World data, repository code, or merging/releasing anything.

## 1. The mission

Evaluate Atlas **as a first-time GM and as a player**, not only as a developer: discoverability, coherent menu structure, readable typography, accessible controls, helpful terminology, empty/loading/error states, minimized windows, state preservation, visual layers, and permission-safe player views. Produce a prioritized, screenshot-supported UX inventory and small separately approved draft PRs. Do not silently change gameplay, persisted schema, recovery, permissions, or Foundry-native features to improve appearance.

**Start here:** read `AGENTS.md`, `README.md`, the active milestone in GitHub issue #271, related issue acceptance criteria, and the latest tested PR/branch. Never infer that old `AGENTS.md` date-stamped release notes are the currently installed module. Confirm installed `module.json` version **in Foundry**, branch/commit and latest Product Owner live-test outcomes. See also `docs/FUTURE_FEATURE_MILESTONES.md` and per-beta live checklists as historical references.

## 2. Scope and authorization boundary — STOP rules

Before any browser interaction, the Product Owner must provide **in the Codex session, not in Git**:
- Foundry browser tab or URL and explicit browser/computer-use permission (sign in themselves; do not collect/store credentials).
- Exact **World ID** and **Scene ID** selected for testing, plus expected Scene name and current module version. Record a session-only reference to them; do not commit IDs/URLs/tokens/screenshots containing secrets.
- Authorized mode: **A — visual/read-only** (default), **B — reversible authoring on a backed-up test World** (only after explicit approval), or **C — journey/world-time/destructive/recovery simulations** (separately approved, never part of ordinary UX review).
- Whether a separate non-GM test account/session is available; do not simulate player confidentiality using GM-only preview alone.

**Preflight on each session and after every reload, Scene switch, reconnection, or modal navigation:**
1. Confirm the same Foundry host, World ID, Scene ID, module version, user role and expected open Scene.
2. If identifiers are unavailable/unreliable, stop and request owner verification before interacting.
3. Interact only with the designated Scene. **Never use navigation to change World or Scene.** Do not open another World in Setup, activate another Scene, follow external hyperlinks or access other browser tabs.
4. Read-only inspection can open Atlas panels and safe native settings **without saving**. Do not click Save/Create/Delete/Apply/Publish/Revoke, modify flags, toggle persistent privacy settings, launch Journey/Travel, import/export to a World, advance time, move Tokens, change Actor resources, modify Journals, or run Region transfers under mode A.
5. For mode B, require a disposable/verified backed-up World and owner-approved named actions with explicit postflight restoration/check. Treat all changes as durable until proven reverted. Do not use a production GM account for untrusted browser automation.
6. Never run mode C without a separate test plan and explicit permission for each high-risk activity.
7. Stop immediately on unexpected World/Scene, missing permissions, newly appearing recovery ledger, uncommitted Journey, unknown import prompt, unresolved native transfer, or unexplained document mutation. Capture non-sensitive diagnostic evidence and **do not bypass guards or try to repair it automatically**.

**Important:** Repository instructions are advisory, not an enforceable security boundary. A GM account generally has access beyond a single Scene. For meaningful restriction, use an isolated cloned World/server or appropriately constrained Foundry account plus browser/network isolation; scene-specific GM authority cannot be guaranteed merely by this playbook. Never store private server addresses or credentials in Git.

## 3. Workflow: two passes, no unapproved mutations

### Pass 1 — read-only UI tour
- Confirm install, World, Scene, role, canvas ready, Atlas Workspace location and any existing warnings.
- Record first-visit path: how a GM discovers Atlas, gets help, creates a draft Road/Checkpoint/Territory, opens Settings, finds Layers and Navigation, understands Save/Cancel/Undo and returns to the map. **Do not commit drafts** in mode A.
- Inspect all visible Atlas Workspace tabs, panes, dialogs, toolbars and menu actions. Track any remaining Atlas-specific controls under native Scene Configuration → Atlas; compare placement and discoverability. Native Scene controls remain native.
- Inspect modeless window opening/minimizing/maximizing, scrolling, tab focus, keyboard navigation, Escape, tooltips, resize, visual ordering and hovered labels. Check 100% and 125% browser zoom if permitted; resize only as a transient browser action.
- Verify labels above Road/Region strokes, hover text, icons/Journal indicators, Territory and Road filters, color contrast and text overflow across a busy and an empty area of the authorized Scene.
- Inspect Navigation **planning/read-only preview only**. Do not press guided movement/Travel, rest, approve service, charge costs, or advance World time.
- Check player-visible views **only through an actual authorized non-GM client**; do not conclude secrecy from GM preview. Respect native Fog, Atlas manual Fog, published Territory geometry/names, Journal permissions and discovered Checkpoints.
- Note each screen's terminology that a first-time GM would not understand, e.g. internal schema/revision/offset/ledger terminology. Recommend user-friendly labels with advanced diagnostics moved into a collapsed GM-only section.

### Pass 2 — explicitly authorized safe authoring
Only with mode B approval and backup, create/edit/cancel narrowly scoped fixtures in the designated Scene; verify restoration, stable IDs, native Region Behaviors, and no side effects on Tokens/Journey/Fog/World time. Use one mutation per observation, capture before/after snapshots and stop on deviation. Never test interrupted native multi-Region transfer or Journey recovery without separate mode C authorization.

## 4. Feature inventory and navigation coverage

This is a **discovery checklist, not a claim every feature is complete or enabled**. Check actual installed branch and current controls; mark absent/deferred rather than inventing UI.

| Area | Expected workflows / questions for the tester | Safety / ownership |
| --- | --- | --- |
| Atlas entry + Workspace | Entry point, Scene selection context, search/lists, tabs, empty states, native Scene → Atlas parity, settings discoverability | GM-only authored changes; UI drafts must not write |
| Roads / graph | Road directory, create/edit, points/bends/junctions, smoothing/appearance, Locate Road, staged Save/Cancel/Undo, labels and hover | Scene Atlas IDs/graph; no connectivity changes on cancel |
| Checkpoints | Create/edit/inspect, icon/labels/elevation, Road association, Journal indicator/open, Territory semantic links, clustering, future independent node support | Stable checkpoint IDs; no fake Road creation; permission-aware Journals |
| Territories / native Regions | Atlas Layers, native Hex/Grid or polygon boundary, Geography hierarchy, Region classification, paint/preview, associated Checkpoint, Locate, native Region editor | Native Region Shapes/Behaviors/Levels authoritative; never overwrite native edits |
| Region seam and batch tools | Inspector, shared ownership, pending recovery warnings, confirmed transfer flows | **Mode C only** for multi-Region writes/recovery; unresolved #265 incident |
| Canvas presentation | Road strokes, Territory fills/borders/names, Checkpoint markers/hover, deterministic overlay order, Fog layering | No hidden information from overlays; preserve canvas lifecycle |
| Player Layers / discovery | Public-name banner vs separately shared geometry, player-local toggles, Seen/Lore/Explored/Fog, Journal entry permissions | Actual separate player account; privacy not proven by appearance alone |
| Navigation / Journeys | Route A/B, selected destinations, leg previews, method/transport, service availability, pacing, rests, banner and Journey Journal states | Read-only by default; movement/time/currency/Actor/Journal writes **mode C** |
| Transportation and settings | Owned/hired methods, catalogs, native movement-cost adapters, world presets, Group Actor settings if present | World settings and Actors outside the authorized Scene: observe only; do not edit |
| Portability (Sunday milestone) | Export/import entry, inclusion/dependency report, Scene assets, Journals, Regions, ID remap, dry-run | Read-only UI only until dedicated backed-up two-World import test |
| Accessibility / help | Tooltips, icons, terminology, headings, typography, keyboard-only paths, WCAG contrast, reduced motion and focus | Presentation-only recommendations preferred |

## 5. UX review standard

For each panel record **task**, **navigation path**, **role**, **screenshot reference**, **observed label**, **problem**, **proposed simpler copy/interaction**, **severity**, **risk to authority/persistence**, and **verification status**. Prefer reusable design tokens and shared controls instead of per-dialog CSS overrides.

- **P0 safety:** an action looks harmless but writes data; misleads about Save/Cancel; leaks hidden player data; an irreversible action has no confirmation; unhandled recovery state.
- **P1 blocking usability:** cannot find entry or complete core workflow; no scrolling; truncated important action; hidden buttons; stale/misleading action status; keyboard trap.
- **P2 consistency:** inconsistent fonts, spacing, icon meaning, menu hierarchy, modal/modeless patterns or unfamiliar technical text in normal flows.
- **P3 polish:** low-impact decoration, animation or microcopy.

Typography: choose a small reusable set of font roles (body, headings, labels, supporting text) consistent with Foundry v14; define sizes, weights, line-height and fallback fonts; test desktop widths and 125% zoom. Do not ship new bundled font files without explicit license/security review. Keep focus outlines, semantic labels, usable contrast and text scaling.

Do not remove diagnostics altogether. Move schema IDs, UUIDs, revision hashes, ownership counts and recovery internals to GM-only Advanced/Diagnostics where needed; retain actionable errors and audit evidence.

## 6. Deliverables, reporting and stop conditions

Create `docs/UX_AUDIT_<date>.md` (or GitHub issue) with (a) exact installed version/branch/Scene pseudonym, (b) screens inspected and not inspected, (c) a prioritized issue table, (d) screenshot refs with sensitive content redacted, (e) no-write evidence, (f) GM/non-GM differentiation, (g) recommended shared type/menu component rules and (h) bounded draft-PR proposals.

Mark observations **observed**, **source-inferred**, **automated-tested**, **owner-live-tested**, or **untested**. Never claim browser UI verification without actually using the browser. Before any code changes, identify exact components and risks, seek owner scope approval, then use focused stacked **draft** PRs; run tests, `npm run check`, `npm run architecture:check`, syntax checks and `git diff --check`. Never merge, force-push, publish a release, modify a different World/Scene or authorize gameplay writes without the Product Owner.

**Known high-risk/open:** #135, #189, #218, #224 Journey/canvas recovery; #265 Region batch recovery; #269 player-data confidentiality. A successful visual walkthrough does not resolve these.

## 7. Session handoff prompt (paste into Codex desktop)

> Read `AGENTS.md` and `docs/CODEX_FOUNDRY_UX_AUDIT.md`. Audit the currently open Foundry v14 tab strictly in **mode A (read-only)**. Before clicking, ask me to confirm the exact World ID, Scene ID, expected Scene name, installed Atlas version and browser-use authorization. Stop if you cannot verify the same World/Scene after reload. Do not save, move tokens, advance time, change Journeys, edit Journals/Regions/Actors, import, or switch Worlds/Scenes. Treat the World and Scene open at authorization as the only allowed targets, and do not visit any other tabs. Survey Atlas as a first-time GM, record screenshots and navigation paths, list all visible menus and workflows, and deliver a prioritized UX audit with separate GM/player test gaps. Propose small draft PRs, but do not implement changes without my approval.
