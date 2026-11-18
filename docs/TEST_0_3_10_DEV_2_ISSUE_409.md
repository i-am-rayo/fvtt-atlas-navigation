# Atlas 0.3.10-dev.2 — GM confirmations before manual Show/Hide

**Issue:** [#409](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues/409) · **Milestone:** [01 — Workspace & UI/UX](https://github.com/i-am-rayo/fvtt-atlas-navigation/milestone/1) · **Target:** Foundry VTT v14.

**Test manifest (standalone branch based on released v0.3.9):**

`https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/0.3.10-m01-409-visibility-confirmations/module.json`

**Test archive:**

`https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feature/0.3.10-m01-409-visibility-confirmations.zip`

**Important:** This is an **independent**, focused development build based on `main`, **not** a cumulative successor to the accepted `0.3.10-dev.1` marker-preset fix. The dev.1 fix remains in draft PR #424 until the Product Owner authorizes that merge. Do not use this dev.2 build to re-test #412.

## Scope

- Road, Map Marker, and Territory boundary **directory** Show/Hide actions now require explicit confirmation before committing through the existing GM/revision-checked writers.
- Directory Map Marker **Reveal through lore / Hide from party** requires confirmation when party discovery mode is enabled.
- The Road Settings and Map Marker Settings **visibility eye** confirms **draft-only** changes. Confirmation does not write; the existing Save button remains the commit boundary.
- Confirmation uses a Foundry v14 `DialogV2.confirm` with text-node item names, an explicit action label, Cancel, and a concise explanation of which player-facing feature changes. The Territory boundary dialog distinguishes published boundary sharing from public Journey name and native data.
- Existing directory buttons cannot dispatch a second action while their previous asynchronous action is pending.
- **No changes** to Scene, Region, Road, Map Marker, Fog, Journal or Journey storage/schema, native Foundry ownership, automatic discovery, or authoritative travel behavior.

## GM / non-GM live acceptance (backed-up disposable Foundry v14 World)

1. **Road directory:** For a hidden Road named *Coast Road*, click the visibility icon. Confirm the dialog names the Road, states what players can see, and offers **Show Road** and **Cancel**. Cancel, Escape and X must leave both map and Scene flags unchanged. Confirm once: Road becomes shown, icon displays its actual state; its discovery announcement fires exactly once after successful Save. Hide again with a distinct confirmation.
2. **Road Settings:** Open Road Settings and click the eye icon. Decline, then accept a second try. Until clicking **Save**, neither player view nor Atlas Scene flag changes. Cancel/Discard restores the original state; Save commits exactly once and does not open a second confirmation.
3. **Map Marker directory, discovery disabled:** Show/Hide must confirm the marker's name, not a linked Road's name. Cancel leaves the marker unchanged; acceptance calls the existing writer. Check independent Road visibility and Journal access.
4. **Map Marker directory, party discovery enabled:** Show through Lore or Hide from party requires confirmation. This changes Atlas party knowledge, not Foundry Journal permissions or the Road's playerVisible setting. Verify previously explored terrain is not implicitly rolled back.
5. **Map Marker Settings:** With discovery enabled and then disabled, click its visibility icon. The confirmation must explicitly say **draft only**. Cancel leaves controls unchanged; acceptance changes only the editable state until Save. Reopen and verify the value. The marker's name must appear safely even if it contains punctuation or angle brackets.
6. **Territory boundary:** From Map directory or Territory Settings, confirm **Share Territory Boundary** / **Hide Territory Boundary**. Verify that the dialog distinguishes player-visible geometry from separately published Journey names, including the possible display of unexplored boundaries, and that native Region Shapes/Behaviors remain unchanged. Declining does not write.
7. **Concurrency:** Double-click a directory eye control quickly; only one confirmation/commit may occur. If the Scene or Region changes in another client while a confirmation is open, the stale snapshot must fail safely rather than override the newer record.
8. **Non-GM client:** Verify permitted Atlas Layers/Fog and Journal privacy, plus the absence of GM authoring controls. A visual Hide is not data confidentiality.

**Stop condition:** If Cancel, Escape or close writes anything; a direct visibility action bypasses confirmation; a replayed click double-writes; or a stale approval overrides newer authoring, leave the PR draft and report the console log and affected World backup.

## Required automated checks

`npm run check`, `npm run architecture:check`, syntax checks and `git diff --check`. DOM tests verify dialog content, cancel/accept return values and no markup injection; Workspace tests verify accessible visibility state and duplicate-click guarding; Map Marker Settings tests verify Cancel and staged changes. Successful Node CI is not a substitute for the GM/non-GM live test.
