# Milestone 01 mainline integration candidate — v0.3.11

**Status:** Draft integration preparation only. No merge, public release, tag or Milestone/issue closure is authorized by building this branch.

## Why a separate branch

- `main` is currently `0.3.10`, whereas the 19 cumulative development builds use branch-specific `0.3.11-dev.*` URLs.
- A previous attempt to bring a development manifest into `main` was correctly blocked by `tests/release-manifest.test.mjs`. Never weaken that test.
- This candidate contains the cumulative Milestone 01 implementation and the **release-formatted** `0.3.11` package/module versions, with manifest and ZIP URLs pointing to `main` as required once merged.
- Use the separate [dev.19 installer](https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/fix/0.3.11-m01-final-ui-exit-batch/module.json) to conduct the Product Owner's final live testing. This integration branch is **not** the dev.19 installer.

## Integration gates

1. Verify cumulative `main...` diff contains **only** Product Owner-accepted Milestone 01 UI changes, docs and tests. Keep previous stacked PRs unchanged; preserve native Region/Scene, Road/Checkpoint, Fog, Token, Actor, Journal and Journey authority.
2. Verify `npm run check`, `npm run architecture:check`, syntax, `git diff --check`, release manifest values, and mainline URLs.
3. Record actual Foundry v14 GM + non-GM final dev.19 live acceptance, including 200% UI scale, multi-window Save/Cancel and permission checks. Any failed live test blocks this integration; issue #216/#289 remain open.
4. Obtain the Product Owner's explicit permission for the `main` merge and version 0.3.11 publication. No tag, GitHub release or issue/milestone closure merely because a draft PR exists.
5. After the owner approves and integration is successful, reconcile old stacked draft PRs without destroying branch history; close only issues whose *full* acceptance criteria are verified. Keep unrelated #265 native recovery and #135/#189/#224 Journey safety work open.
