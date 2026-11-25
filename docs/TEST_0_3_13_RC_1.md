# 0.3.13-rc.1 — UI/UX consolidation

Status: draft candidate, not a released module. Main remains 0.3.12 at 9508f93e3d2265323a3be2e7cb24c0e05ac699c7. Candidate is derived directly from PO-tested dev.11 at 9aec43a2d5ec2cceb11f985bd3c1bdec0c132f99; no runtime source changes after dev.11. The main-base comparison of dev.11 was 101 commits, 46 changed files, zero behind. The rejected dev.4/5/6 heads (PRs #523/#525/#526) each diverge at dev.3 (0aa9a5d147607da582886289e68e97dcf948f4ab); none is an ancestor of dev.11. Do not reintroduce those experiments.

## Scope and status

| Slice | Issues | Evidence |
| --- | --- | --- |
| dev.1–2 | #515 #516 #517 #518 #519 | PR #520, accepted stack baseline; live subcase evidence varies |
| dev.3 | #521 | PR #522, PO accepted |
| dev.7–8 | #527 | PRs #529/#530, PO accepted |
| dev.9–9.1 | #517 #532 | PRs #531/#533; dev.9 partial, dev.9.1 accepted |
| dev.10–11 | #518 | PRs #534/#535, PO accepted |

Latest PO report 2026-11-24: dev.11 successful. Console shows canvasReady and Module ready, no Atlas exception observed. It contains no completed Journey records; prior reported successful Journey and interrupted recovery tests are distinct. Foundry warns about 1011px viewport below its 1024px minimum. World CLI helper and BBMM resource warnings are not evidence of an Atlas regression. No raw session logs copied to repo.

## Final consolidated acceptance

Use a backed-up test World, Foundry v14 build 370 or supported newer v14, GM and separate non-GM. Use supported viewport >=1024 x 768 CSS px; resize individual Atlas windows independently. Verify:

1. Map directory single Create group, stable filters/sort/scroll/focus, Clear filters, keyboard and duplicate-name records. Narrow and wide layouts, native themes and 200% zoom where Foundry viewport permits.
2. Both Road creation entry points, cancel/undo, valid Save opens exact saved Road Settings; no stale or duplicate write. Map Marker and independent modeless editors, explicit saves, cancellation and conflicts.
3. Territory classification and read-only native conflict review, Cancel zero writes. No new cross-Level transfer behavior; do not exercise unresolved destructive recovery on production data.
4. Layers player preview/exit and exploration brush scope, separate player access/hidden metadata checks, native Fog and Region Behaviors retained.
5. Party role and reserved rider labels, owned vehicles and seat/animal counts, inherited/local hire offers, correct draft Save/Cancel and unchanged native Group membership.
6. Single and mixed land summaries, valid approval, declines, active GM preflight, estimated costs not deducted; supported water/air and onward/recovered paths only within existing contracts. Verify Journal and confirmed native movement/World time, no duplicate effects. Keep prior completed records untouched.
7. Cold and warm launch; if intermittent first-load failure recurs, record failed resource/network evidence without session secrets for #453/#455. Do not introduce speculative retry/caching.
8. Re-run npm run check and npm run architecture:check on candidate; review full main-base diff, no added trailing whitespace. Verify manifest version/branch/download alignment, installation and rollback to dev.11.

## Open gates / exclusions

#417 broad Territory appearance deferred; #453/#455 require network/HAR evidence; #513 broader Journey parity and historic Journal/timing observations remain separate. #264/#265 cross-Level ownership/recovery remain outside this release. Unsaved settings-form refresh and exhaustive non-GM acceptance not proven. Existing individual PRs remain draft and issues open until separate PO integration authorization. No main merge, stable version, tag, release or force push in this candidate.

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/release/0.3.13-rc.1/module.json
Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/release/0.3.13-rc.1.zip
