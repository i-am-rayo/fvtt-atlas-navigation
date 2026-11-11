# v0.3.9-beta.8.28 — Object-specific Atlas Settings titles

Status: stacked draft; owner live Foundry v14 acceptance required.

## Scope

- Existing Checkpoint Settings windows show **Atlas — {Checkpoint name} — Checkpoint Settings**. The title is bound to the saved Checkpoint identity when opened and stays visible while changing General, Marker & Labels, Terrain Region, and Transportation tabs.
- Existing Road Settings dialogs show **Atlas — {Road name} — Road Settings** while moving among their tabs.
- Foundry's native RegionConfig launched via an Atlas Terrain Region settings button shows **Atlas — {native Region name} — Terrain Region Settings**. It remains the same native Foundry RegionConfig class and form behavior; only the title getter in this particular Atlas-launched sheet is customized.
- Geographic Territory and Public Territory setting dialogs include their specific native Region name.
- New Checkpoint and Road creation windows explicitly show **New Checkpoint** / **New Road**. Title changes do not commit or modify names.
- Title strings are display-only, with newline/control-character normalization. There is no change to Atlas settings persistence, native Region data, geometry, Journals, permissions, fog, travel rules or Scene schemas.

## GM acceptance

1. Open Checkpoint Settings for **Dirwest** and **Ježibaba - Abandoned Town** in two separate windows. Both titles should identify their own saved Checkpoint; switch across all Checkpoint tabs and confirm titles remain correct.
2. Open Road Settings for two differently named Roads. Confirm each window title identifies the Road while switching tabs. Cancel/close without saving and verify no Road data changed.
3. Use Atlas's Terrain Region settings control for **Dirwest**'s native Region. Confirm the title contains its native Region name and that all ordinary native Foundry Region controls still work as before.
4. Open **Geographic Territory** and **Public Territory** editors for different Regions and confirm their titles are object-specific.
5. Begin a new Road and a new Checkpoint: verify **New Road** and **New Checkpoint**, with no misleading saved object identity.
6. Rename a Checkpoint or Road but cancel before saving. Reopen to confirm the authoritative saved name still appears; no title-only action should cause a Scene update.
7. With a non-GM player client, verify authoring permissions remain unchanged. No player overlay, native Fog/Atlas Fog or Journal behavior should be affected.

## Deferred

- A consolidated Terrain Region Settings experience replacing the numerous individual Region action buttons.
- Further aesthetic design and layout work for the Atlas settings panels.

Automated tests verify title composition, escaping/whitespace normalization, Checkpoint editor initialization, and native RegionConfig inheritance. Full v14 visual acceptance remains mandatory before merge.
