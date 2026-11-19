# Milestone 01 — Release-formatted mainline integration for 0.3.11

This document records the integration of the **owner-accepted cumulative dev.21** UI implementation. The earlier dev.19 candidate was superseded without force-pushing: integration history includes the dev.21 head as a parent, with only release metadata/documentation changed relative to the dev.21 implementation.

- Version: `0.3.11` in `module.json` and `package.json`.
- Manifest: `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/main/module.json`.
- Archive: `https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/main.zip`.
- Keep `tests/release-manifest.test.mjs` unchanged and passing.
- Confirm `npm run check`, `npm run architecture:check`, syntax and patch whitespace before merging.
- Product Owner explicitly approved the **mainline merge** in the 2026-11-19 conversation, after confirming dev.21 working. That is distinct from any GitHub tag/release publication; no tag/release is authorized here.
- Once the mainline PR is merged, close prior M01 stacked draft PRs **as integrated/superseded**, not as individually GitHub-merged PRs, and close only the implemented-and-owner-accepted UI issues.
- **Do not close** ongoing post-update startup failure #453 or startup performance review #455 as solved. High-risk native Region/Journey recovery issues remain separate and unresolved.
