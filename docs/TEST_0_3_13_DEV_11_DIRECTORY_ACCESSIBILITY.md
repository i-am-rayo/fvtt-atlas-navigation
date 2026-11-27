# Atlas 0.3.13-dev.11 — Directory accessibility

PO reported dev.10 successful on 2026-11-24; exact baseline 3bc55bf788e5cc0ae94767b698e1e5dc35c1d82d (PR #534). No fresh journey logs were attached to that report. This is a presentation-only follow-up to #518, not a new Journey or Territory feature.

## Live Foundry v14 acceptance
1. Open Workspace > Map directory > All Roads. Use Tab to focus Locate, Settings or a disclosure on a record; trigger a same-view refresh without moving focus. The corresponding enabled visible control retains focus. With two matching display names, the correct record is retained by identity, not name. If the record is removed or the control disabled, do not focus a different record.
2. Check a visibility action whose icon changes from eye to eye-slash; its action identity is stable. This does not change visibility rules. Verify separate modeless editor focus is not stolen; actual browser focus after a button disables itself or a dialog opens is native and not guaranteed to return.
3. Enter search text and select a filter in All Roads; choose Z–A sorting. Select Clear filters. Search and type reset, list returns, focus moves to search, sorting remains Z–A. The button is disabled when there are no active filters.
4. In All Map Markers check both type and Territory filters. Clear filters affects only the active view, preserving the other views' filters and expansion state. Check By Territory too.
5. Resize to narrow Workspace widths; check long labels, keyboard access, dark/light native themes, and non-GM authoring restrictions. Existing action permissions and save/confirmation handlers remain authoritative. Verify no writes from refresh, search, sorting or clearing filters. No changes to native Region/Actor/Group/Token, Fog, pricing or Journey ledgers.
6. Unsaved settings-form refresh preservation is outside this slice; do not imply this issue is resolved. Recheck dev.10 focus/caret/scroll regression.

## Candidate
- Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-dev11-directory-accessibility/module.json
- Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-dev11-directory-accessibility.zip
- Draft PR #535. Main remains unchanged. Live GM/non-GM testing and separate integration approval remain required.
