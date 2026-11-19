# Atlas 0.3.11-dev.21 — Canvas Editor layout and duplicate instruction hotfix

**Build manifest:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-painter-dock-framing-hotfix/module.json

**Prior owner result:** dev.20 **failed** visual acceptance: Road Editor flowed into the right-side Foundry Settings pane instead of occupying its own floating panel; redundant instructional toast overlapped the top of the page. Owner's Paint Territory screenshot is the visual reference. This is a corrective hotfix in Milestone 01, not a release.

## Mandatory Foundry v14 GM acceptance

- [ ] Open **Paint Territory**, cancel, and start **Edit Road Points** while the **Foundry Game Settings sidebar remains open**. The Road Editor must appear at approximately the same top-left anchored canvas position as Paint Territory (x≈24 px, y≈90 px), **without moving, overlapping or changing the Settings sidebar's layout**. Dark panel, heading, status, shortcuts and footer are contained within the standalone floating UI.
- [ ] Verify native frame title bar is **not visibly duplicated** above the custom `Atlas · Edit Road` heading. Drag that heading and use focused arrow keys, including Shift+arrow. Panel moves but Road geometry does not, and never snaps into the sidebar. Close/cancel and reopen without leaked listeners.
- [ ] Verify the on-panel shortcuts now mention **promote white bends**, **demote eligible gold pass-through nodes**, **detach junctions** and **disconnect Road branches**, along with drag, double-click, undo and redo. UI status remains visible at 200% Foundry UI scale or narrowed viewport; scrolling the panel does not scroll or reposition Settings.
- [ ] Start a new Road, Road junction placement, Map Marker placement, and independent Map Marker relocation. All start in separate canvas panels with correct Road vs Map Marker titles and purpose; no duplicated **starting-instructions info toast** is displayed. Distinct GM warnings, errors, successful save notices and confirmation dialogs must still appear.
- [ ] Connected Map Marker relocation through Road point editing remains unchanged; independent Map Marker map-click relocation continues to require existing explicit GM approval and version-checked persistence. Press Cancel or Esc to discard. Confirm untouched Road/Map Marker IDs, graph connectivity, native Region Behaviors and ownership, Scene flags, fog, Journey Journal, Token/Actor and World time.
- [ ] Non-GM client must not access Atlas canvas authoring; sidebar and player-safe controls should work. Verify no hidden data exposure.
- [ ] If dev.21 passes, record owner acceptance before updating the **separate release-safe** mainline integration draft PR #451. Do not merge, tag, publish or close Milestone 01 automatically.

## Automated gates

Run `npm run check`, `npm run architecture:check`, syntax checks, GitHub patch whitespace and local `git diff --check` when a checkout exists. Note that automated tests cannot establish visual placement in a live Foundry v14 browser.

**Separate issue:** intermittent Atlas post-install startup fetch failure is #453 and still requires Network logs if it recurs; no speculative retry/auto-refresh change is included.
