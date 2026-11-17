# v0.3.9-beta.8.55 — Explicit Checkpoint banner details (annotation 8 of PR #358)

## Source / boundaries
- Stacked on beta.8.54 numeric controls (#360) and beta.8.53 UI (#359), derived from the beta.8.52 reviewed baseline.
- Only optional Checkpoint presentation changes. Native Region geometry, hidden state, Behaviors, elevation validity, Foundry Token movement, World time, Actor rests and Journal permissions remain their respective native owners.
- Draft/unmerged. GitHub CI is not live Foundry GM/player acceptance.

## Storage and compatibility contract
- **Existing** Scene Atlas `Checkpoint.appearance.showRoadName` remains the single canonical Road-name toggle. Its old rendering behavior remains when no new fields are selected.
- **Optional additive** `Checkpoint.appearance.banner` contains exactly four validated keys: `showType:boolean`, `showElevation:boolean`, `territoryRegionId:string|null`, and `territorySceneId:string|null`. The last two together identify a stable native Region in its originating Scene, not a cached name or copied geometry. Both must be null when no Territory is selected. All fields off and no Region selected means the optional property can be omitted.
- Legacy v8–v10 appearances without a `banner` property, including those without `borderColor`, remain readable with no Scene migration on read. A new saved Territory selection requires both the native Region ID and its originating Scene ID; a missing/mismatched pair is rejected. Existing Checkpoints retain their banner until explicitly edited. Unknown fields and invalid identifiers are refused; no write-on-open. The next Scene Atlas revision remains controlled by the existing GM Scene-authorized, revision-checked appearance save.
- An older module that doesn't understand the optional `banner` must not be used to edit a World with new banner fields without restoring a backed-up compatible version. No automatic downgrade/field stripping.
- Copy/export/import of the containing validated Atlas appearance retains the selected native Region and its originating Scene ID. On another Scene the selection becomes unavailable; the renderer rejects a matching Region ID in a different Scene instead of treating the same ID as equivalent. GM may clear the unavailable ID in the editor; it is not silently rewritten or migrated.
- **World templates** may store portable banner type/elevation and Road switch defaults. Scene-specific native `territoryRegionId` (and its paired `territorySceneId`) is strictly forbidden in reusable World preset data. Existing Checkpoint Territory selection remains Scene-local across applying a portable template. Unrelated bulk style edits retain the current banner and do not publish new metadata.

## Editor workflow and appearance
- **Marker & Labels → Include in checkpoint banner:** checkbox Type, Elevation, Road name, plus an explicitly selected Territory from validated native linked geography candidates. Checkpoint name always remains primary.
- GM can choose **City or Continent** when both contain or are validly explicitly associated with the Checkpoint; never auto-pick based on kind, depth, draw order or lexicographic name.
- `None / No Territory` available. An unavailable previously selected Region is shown as an unavailable ID for GM inspection/clearing; no cached name. New placement drafts cannot pick Territory until actual Scene membership is established.
- Reuses the same pure text-line composition in editor Map Preview and GM/player canvas. Checkpoint name is prominent; subordinate optional lines are smaller; Road names italic, others normal. Elevation uses the current Scene's unit family while persisted elevations remain canonical meters.
- Off/Hover/Always and existing icon/hover interaction semantics remain; duplicated GM elevation QuickInfo is suppressed if already shown in the configured label. Native PIXI rendering and HTML preview differ in font rasterization only, not content.

## Player projection and permissions
- Checkpoint appearance banner fields and elevation are projected **only on visible or discovered Checkpoints**. Hidden/unknown Checkpoints are excluded. Elevation remains null by default for legacy or unopted-in Checkpoints.
- Road names are resolved from the **independently filtered player-visible Road projection**. Selecting a Checkpoint's Road checkbox never reveals hidden Road metadata.
- Selected Territory name resolves read-only from an available Atlas-linked native geographic Region and a valid grid-cell membership or explicit Checkpoint association. It must be revalidated on every draw. Deleted, unlinked, invalid, moved and player-hidden Regions yield **no player detail**, never a cached string.
- When a public Territory name alias exists, players see that approved alias. Otherwise selecting a visible Region explicitly publishes its native name **only in the selected shown Checkpoint banner**; this does not publish Region boundaries, native Behaviors, all other Region metadata, linked Journals, or create a new confidentiality boundary on client-readable Scene flags.
- Player-facing rendering uses plain text, never interpolated HTML or extra Scene flags. No automatic permission changes.

## Automated verification
- Legacy appearance unchanged on read; valid additive option validation/rejection; malformed/unknown fields rejected.
- Pure banner line composition, unit conversion and lack of fabricated withheld labels.
- Player projection hides Road name, unopted-in altitude, and hidden Checkpoints; opt-in category/elevation display through actual RoadCanvas player render.
- Native grid containment/explicit association with City+Continent choices; Region rename, hidden, movement, deletion, unsupported grid, bad flags; read-only Scene behavior.
- World preset portable banner toggles survive and Scene-specific Territory ID is rejected.
- `npm run check`, syntax, `npm run architecture:check`, `git diff --check`, zero new import cycles/missing targets.

## Owner Foundry v14 GM/non-GM live acceptance (backed-up Sandbox)
1. On Dirwest City Checkpoint, enable Type, Elevation, Road and select containing **Valecor Continent** rather than Dirwest City. Verify four subordinate rows in Map Preview and native GM canvas, with new banner displayed only for selected label mode and correct ft/m.
2. Open a second player client. Reveal Dirwest but keep its Road hidden: player may see GM-authorized Type, Elevation, selected Continent public name, **not Road name**, unshared Region boundary or Journal text. Show Road explicitly and confirm subtitle appears; hide checkpoint and confirm all disappear. Test manual Lore/Visited discovery.
3. Choose a different valid city/continent selection; save/reload, rename its native Region and compare live labels. Hide, move, delete or unlink Region and verify no stale player label. Remove selection to clear it; test unsupported polygon/gridless geometry and ambiguous peers without choosing a default.
4. Confirm old Checkpoints lacking `banner` still draw previous Road/name labels and hide legacy elevations from players. Compare original Scene flag before/after merely opening and closing; no write.
5. Save a World preset with Type/Elevation enabled, apply to a checkpoint on another Scene: portable display toggles apply, but **no native Region ID** is copied. Unrelated appearance edits/bulk changes preserve the existing Scene selection.
6. Test GM and non-GM permission/fog/Region behaviors, Road labels at 0.5× / 1× / 2× zoom, default dot/FontAwesome/custom image markers, long text, keyboard, narrow window, cancel/dirty close, and recovery Journey unaffected.
7. Do not merge or release without owner success. Validate separate PRs #359 and #360 first if changes are stacked.

Manifest: https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/test/v0.3.9-beta.8.55-checkpoint-public-banner/module.json

Archive: https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/test/v0.3.9-beta.8.55-checkpoint-public-banner.zip
