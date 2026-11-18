# Checkpoint and party explorer UX — beta.8.51

Based on PR #355 / beta.8.50. Draft; no merge or stable release approval.

## Requested changes

- The same party-explorer checkbox is available on placed and prototype tokens. Explicit prototype save stores a default on the Actor prototype; a newly created token inherits it. The primary active GM fills only an empty or deleted-token Scene assignment. Existing valid Scene assignments win. No migration or automatic discovery is performed when opening configuration.
- Party discovery radius moves to Workspace → Settings → Exploration & travel, using native Scene distance units and an explicit save. Movement-speed diagnostics are removed from Token configuration.
- Checkpoint settings use staged Show/Hide icons, with discovery method separate. Existing lore status is preserved through hide/show. The selected preset is summarized beside Change preset. Save as preset is a separate footer action supporting explicit new/confirmed replacement with stale-catalog guards.
- Marker selection uses a bounded native popover. A live marker/label sample shows draft appearance. Transportation plus buttons use the compact shared size. Checkpoint color terminology is simplified.
- Terrain and road connections are grouped. Move opens the existing staged geometry editor; road connection uses the existing guarded topology action. Shared junction detachment stays blocked. X retains unsaved-change protection; redundant Cancel is removed.
- Elevation uses the existing measurement preference resolver with native Scene fallback and preserves exact canonical meters when the display was not edited.

## Discovery behavior reviewed

Party proximity discovers Automatic checkpoints inside the configured party radius. A discovered checkpoint's terrain radius reveals map cells, not neighboring checkpoints. These distinct behaviors are now explained beside their controls. No discovery algorithm or saved radius is silently changed. A new entry-trigger rule remains a separate gameplay decision.

## Regression evidence

Full npm run check, architecture gate, all tracked JavaScript syntax, and whitespace checks must pass before installation. Automated regressions cover prototype-only writes, empty/deleted assignment recovery, existing-assignment preservation, GM permissions, staged visibility, icon selection, editor save handlers, stale revisions and existing navigation behavior. Browser checks are recorded separately from persistence acceptance.

## Product Owner acceptance checklist

Read-only checks in the authorized Sandbox:
- [ ] Installed candidate version and Sandbox document ID match.
- [ ] General / Marker & labels / Terrain / Transportation remain usable at the current viewport.
- [ ] Icon popover opens, searches, selects and closes with Escape without changing window dimensions.
- [ ] Preview reflects staged marker/label settings; closing discards or prompts for unsaved changes.
- [ ] Preset change, preset save, checkpoint save, Move and Delete are distinct.
- [ ] Prototype and placed Token configuration show the same explorer checkbox wording.
- [ ] Workspace discovery slider and native Scene units are readable.

Owner-controlled persistence checks on disposable records (not performed by read-only QA):
- [ ] Save prototype default, place a token in an empty explorer slot, delete/recreate it, and verify inherited assignment. A different existing explorer must remain assigned.
- [ ] Two simultaneous prototype-token creations yield one explorer; non-GM cannot change configuration.
- [ ] Change survey radius and verify Automatic versus GM-only/Lore-only discovery; terrain reveal never recursively discovers checkpoints.
- [ ] Save Show/Hide with lore history; inspect player client visibility separately from Journal permissions.
- [ ] Create a preset, replace it after confirmation, cancel replacement, and reject a concurrent catalog change.
- [ ] Save an unrelated field with fractional elevation; canonical meters remain exact. Verify metric/imperial settings and native Scene fallback.
- [ ] Move/connect/disconnect a disposable checkpoint using existing confirmations, including far-road suggestions and shared-junction rejection.
- [ ] No regression in native Regions, Journey playback, World clock or Journals.

Keep the PR draft until live GM/non-GM and persistence acceptance are complete.
