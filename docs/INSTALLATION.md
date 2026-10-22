# Phase 1 — Manual installation and Foundry v14 smoke test

This is a **development build** of FVTT Atlas Navigation. It contains only a module manifest, startup hooks, translations, and a GM-facing diagnostic setting. It **cannot** draw roads or calculate routes yet.

## Requirements

- **Foundry VTT v14** and permission to install modules and manage a test World.
- An internet connection from the Foundry server to GitHub.
- A test World rather than a valuable production world. No game-system dependency is required.

## Install from the URL (recommended)

1. Open Foundry **Setup → Add-on Modules → Install Module**.
2. At the bottom of the installer, paste this **Manifest URL** (the raw JSON file, not a GitHub `blob` page):

   ```text
   https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-1-module-shell/module.json
   ```

3. Click **Install**. Foundry reads the manifest and retrieves the publicly accessible ZIP linked by its `download` field.
4. Open your test World as Gamemaster.
5. In **Game Settings → Manage Modules**, enable **FVTT Atlas Navigation** and save/reload.

The code currently lives in the **`feature/phase-1-module-shell` development branch**, not `main`. The URL above intentionally follows that branch until Phase 1 has passed its Foundry smoke tests.

## Update through Foundry

1. Once a newer module version has been published on this same branch, open Foundry **Setup → Add-on Modules**.
2. Use Foundry's **Check for Updates / Update** controls for FVTT Atlas Navigation.
3. Relaunch your test World as needed.

**Developer note:** Foundry detects new releases via the manifest's `version`. Each published module change must increment the version in **both `module.json` and `package.json`**; pushing commits with the same version will not reliably trigger an update. The branch ZIP is intended for early development; versioned GitHub Release ZIPs and a stable main/release manifest are preferable for general distribution.

## Manual fallback

If URL installation fails, first capture the complete Foundry error and report it. You can still download the branch ZIP from GitHub, extract it, and place the module files at `{userData}/Data/modules/fvtt-atlas-navigation/` so `module.json`, `scripts/main.js` and `lang/en.json` are directly under that module folder. Restart Foundry to discover it. See [Foundry's module installation guide](https://foundryvtt.com/article/modules/).

## Verify in Foundry

1. Open **Game Settings → Configure Settings** as a Gamemaster.
2. Find **FVTT Atlas Navigation** and its checkbox **Show GM startup confirmation**.
3. Enable it and save settings.
4. Reload the World.
5. You should see a GM-only notification: **"FVTT Atlas Navigation: Phase 1 module loaded successfully."**
6. Open your browser's developer console if desired. As GM, you should see `[fvtt-atlas-navigation] Phase 1 initialized`.
7. Turn the checkbox off, save, and reload again. The startup notification should no longer appear, though the module remains enabled.
8. Disable the module in **Manage Modules** and reload. The module setting and its runtime diagnostic should no longer be active.

### Player check (optional but useful)

With the diagnostic checkbox enabled, connect from a second browser session using a **non-GM** account. The player should not receive the startup notification or the GM console status message. No scene content or hidden atlas state is created by Phase 1.

World-scope settings are governed by Foundry's normal Configure Settings permissions; trusted roles with that permission might also be able to edit world settings. The diagnostic notification itself is explicitly gated by `game.user.isGM`.

### Compatibility note

The manifest declares Foundry v14 as the *minimum*, but intentionally does **not** claim a `verified` v14 version yet. Manual tests by the project owner will determine when that claim is warranted. No game-system identifiers are used; testing in a second system is still recommended.

## Optional static checks

From the repository root, with Node.js 20 or later:

```bash
npm test
npm run check
```

These use Node's built-in test runner and syntax checker. They require **no downloaded npm dependencies** and check only the manifest/localization/hook contract with lightweight mocks. They do not launch Foundry and cannot prove actual v14 compatibility.

## What to report after testing

- Foundry's exact version/build and the World game system.
- Whether the module appears in Manage Modules and enables successfully.
- Whether its Configure Settings checkbox appears and persists after reload.
- Whether the GM notification and console log appear as described.
- Any errors from the browser console, or a screenshot of the result.

If a step fails, report it before merging the Phase 1 PR. Leave Phase 2 (atlas calibration/road editing) for a separate review.
