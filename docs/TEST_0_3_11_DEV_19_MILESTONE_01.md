# 0.3.11-dev.19 — Milestone 01 final UI exit test

**Build:** https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-final-ui-exit-batch/module.json

**ZIP:** https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/fix/0.3.11-m01-final-ui-exit-batch.zip

**Scope:** Final small UI/keyboard/scaling fixes on cumulative owner-approved dev.18. The complete [Milestone 01 acceptance matrix](MILESTONE_01_EXIT_REVIEW.md) also covers earlier owner-accepted slices.

- [ ] **Existing Road point editing:** Start editing a Road named e.g. The Eyrie Road. Editor title identifies that Road; new Road creation still shows its staged name. Undo/Redo and cancel cannot save silently. Save Points still respects GM and revision checks.
- [ ] **Selected Territory tab:** Use keyboard arrow/Home/End; focused tab and visually highlighted selected tab agree; other pages stay hidden and no write occurs on tab navigation.
- [ ] **Modeless Territory window @ 200% UI scale:** narrow/re-expand window while on each of the four tabs. Labels, tab buttons and actions wrap by window width; no horizontal clipping or inaccessible Save action.
- [ ] **Workspace icons:** Territory/Map Marker collection action buttons use a consistent shared 2rem target at 100% and 200% UI scaling, with visible focus and nontruncated accessible labels. The actual on-map markers are not resized by this UI patch.
- [ ] **GM/non-GM:** Verify no new player authoring access; map visibility, discovery, native Regions/Behaviors, Journey Journal, Token/Actor, World time, Fog unaffected. Repeat two unrelated Settings window saves, stale same-record rejection and conditional Road hover/banner behavior from previously approved builds.
- [ ] **Integration:** Final human approval and separate release-safe integration PR to main; no merge or release merely because CI passes.
