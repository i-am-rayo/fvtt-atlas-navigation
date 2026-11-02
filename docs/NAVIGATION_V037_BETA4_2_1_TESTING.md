# Atlas v0.3.7-beta.4.2.1 — Single Debug Dropdown Hotfix

**Draft test release** stacked on v0.3.7-beta.4.2; do not merge until the owner tests Foundry v14.

## What changed

- Replace the previous **one logging-level dropdown plus five category checkboxes** with one **Atlas Debug — Console Logging Level** dropdown at the top of the Atlas Module Settings. Options: **Off, Standard, Verbose, Trace**. No second step or redundant checkboxes.
- Keep all five internal log categories (Journey, Token Movement, World Time, Exploration/Fog, Scene/Windows), tagged in the console for searching, with detail controlled by the one level. Standard shows major events; Verbose adds native token movement, clock and fog activity; Trace adds per-refresh and Scene events. Warnings/errors remain visible when Off.
- Store this **local console preference as a Foundry Client setting**, not a World setting. Debug verbosity is browser-specific and should not require a World setting write or force other connected clients to emit logs. The previous beta.4.2 World-level debug settings are no longer registered or used; no saved gameplay settings are removed or modified.
- The provided Foundry console dump repeatedly reports **“You may not set a World-level Setting before the Game is ready”** from Foundry's `SettingsConfig._onSubmitForm` → `ClientSettings.set`. The trace does not identify an Atlas callback as the cause; changing this one debug preference to Client scope avoids a World setting write for debugging, but does **not** override Foundry's readiness restriction for other World settings.

## Live acceptance

1. Wait for Foundry to finish loading the World, then open **Configure Settings → Module Settings → FVTT Atlas Navigation**. Confirm there is **one debug dropdown at the top**, without five debug category checkboxes.
2. Select **Verbose**, save, close Settings and reopen. Verify **Verbose** remains selected. Repeat with **Off** and **Trace**. A second browser can have a different selection.
3. With Verbose, open Navigation and start a token journey. Console entries should include a `[fvtt-atlas-navigation][journey]` prefix, plus `movement`/`clock` events when relevant. With Trace, fog/Scene events should also appear. With Off, ordinary debug messages disappear, but warnings/errors remain.
4. Confirm changing **only** the debug dropdown does not produce a World-level setting save error. If saving unrelated World settings still produces the readiness error, wait for the World to finish initializing and collect the new console output; that issue is outside the local debug preference.
5. Confirm all v0.3.7-beta.4.2 navigation interruption warnings, fog refresh filters and daily-travel behavior remain unchanged.

## Limits

This hotfix does **not** change the rest of Atlas's World settings, game readiness lifecycle, roads, checkpoints, terrain Regions, Actors, clock arithmetic or journey recovery. Existing beta.4.2 debug category setting values are ignored, not deleted. Future recoverable journeys and Journal integration remain a separate gated milestone.
