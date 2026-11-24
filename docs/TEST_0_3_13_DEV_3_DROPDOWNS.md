# Atlas 0.3.13-dev.3 — Alphabetical dropdowns (Milestone 01 / #521)

## Test candidate
- Branch: `feat/0.3.13-m01-dropdown-alphabetical`
- Feature PR: #522 (draft, targets the existing 0.3.13 integration branch)
- Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feat/0.3.13-m01-dropdown-alphabetical/module.json
- Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feat/0.3.13-m01-dropdown-alphabetical.zip

This is a development test build, **not** a release or PO acceptance.

## Expected behavior

Names shown by Atlas in selectable lists appear A–Z **within their existing context or category**. The visual ordering never changes underlying persisted IDs, methods, eligibility, pricing, Journey approval, Foundry Region/Token authority or current selection.

Fixed semantically ordered controls stay deliberately sequenced: currency denominations, operation schedules, travel time and pace levels, first/last action choices, geographic hierarchy, road-material priority, native Level/elevation, destructive confirmation scopes and the special **Not traveling** planning action. No new Foundry hooks or CSS.

## GM live checklist

- [ ] Map Marker Settings → transportation → Add for **Land**, **Water (rivers/lakes)**, **Sea (coastal/ocean)**, and **Air**: choices A–Z, correct surface and names; select a middle/later option, save, reopen and verify ID and overrides.
- [ ] Map Marker preset dropdown and Map Marker type dropdown: item names A–Z within relevant groups, existing selection preserved.
- [ ] World transportation settings and Party Group transportation: named preset/rider choices A–Z, no profile, seat count, fare, ownership or assignment changes.
- [ ] Atlas Map Directory filters, Territory parent selectors, Road/Map Marker links and other named lists: A–Z, with **All/None/Choose** prompts still at the top.
- [ ] Planner travel-method dropdown and transfer-method dropdown: A–Z *inside* Party/checkpoint source groups; grouping, available offers, fare basis and selected method still correct. Journey traveler method list sorts names while **Not traveling** stays available.
- [ ] Territory boundary editor: seam-peer and batch-target selectors A–Z while disabled/too-large peers stay disabled.
- [ ] Multiple settings dialogs open with edits to independent records: no false conflicts or data loss; cancel without any write.
- [ ] At 200% zoom and via keyboard, focus remains visible and select labels readable; no clipped options or unwarranted focus jumps.
- [ ] Reload a saved World/Scene with older preset IDs and confirm no data changes, automatic migration, disappearance or reordering of persisted records.

## Player regression

- [ ] Open Navigation as non-GM. Player-safe destination and travel-method choices remain accessible where authorized; no GM-only data or options leak.
- [ ] Player cannot edit World/Scene settings or change authoring roles through dropdown selection.
- [ ] Existing approved Journey recovery, Token movement, Journal history, costs and native Region behaviors are unchanged.

## Release gate

Automated CI and architecture check are distinct from the **PO Foundry v14 live acceptance** above. Do not merge #522 into the integration branch, or #520 into main, without explicit PO authorization. **Before merging #522**, update `module.json` test manifest/archive URLs from this temporary feature branch to the persistent release-integration branch and revalidate the final integrated build.
