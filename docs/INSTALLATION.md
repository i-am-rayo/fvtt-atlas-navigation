# Phase 1 — Manual installation and Foundry v14 smoke test

This is a **development build** of FVTT Atlas Navigation. It contains only a module manifest, startup hooks, translations, and a GM-facing diagnostic setting. It **cannot** draw roads or calculate routes yet.

## Requirements

- A running **Foundry VTT v14** installation and permission to manage modules/world settings.
- Your own test World; do not use a valuable production world for initial smoke testing.
- Access to the private repository: https://github.com/i-am-rayo/fvtt-atlas-navigation

No Node.js runtime or npm installation is required **inside Foundry**. Node is optional for the repository's local static tests.

## Install from a checkout or GitHub ZIP

1. Obtain the branch you want to test (for this PR, `feature/phase-1-module-shell`). You can use your cloned repository or download its ZIP from GitHub while signed in.
2. Find your Foundry **User Data** directory. Foundry Setup exposes the configured User Data Path; consult [Module Management](https://foundryvtt.com/article/modules/) for manual installation. This is *not* the Foundry application/program installation directory.
3. Inside User Data, open `Data/modules/`. Create this directory if it does not exist.
4. Copy the module files into a folder named exactly `fvtt-atlas-navigation`. The manifest must be directly at:
   `Data/modules/fvtt-atlas-navigation/module.json`
5. Make sure `scripts/main.js` and `lang/en.json` exist relative to that manifest.
6. Start or restart the Foundry server/setup screen so it discovers manually added modules.
7. Launch a test World as a Gamemaster. In **Game Settings → Manage Modules**, enable **FVTT Atlas Navigation** and save/reload.

**Important:** This private development repository does not yet publish a release ZIP or public manifest URL. Do not paste a private GitHub source URL into Foundry's manifest installer and expect it to work. That packaging workflow is for a later release.

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
