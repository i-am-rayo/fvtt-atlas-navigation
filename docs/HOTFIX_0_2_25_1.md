# v0.2.25.1 — Group token vision compatibility and hotfix installation

**Draft hotfix** stacked on the v0.2.25 global curvature/labels/explored-fog draft. It does not merge either branch and does not replace Foundry's or a third-party module's vision engine.

## Install v0.2.25.1

Foundry Setup → Add-on Modules → Install Module → Manifest URL:

```text
https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/hotfix/v0.2.25.1-group-vision-labels/module.json
```

This manifest downloads the same hotfix branch:

```text
https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/hotfix/v0.2.25.1-group-vision-labels.zip
```

The old v0.2.25 manifest points to `feature/phase-2q-road-curvature`; installing that URL does **not** track this hotfix. Verify that Foundry shows `0.2.25.1` after updating and reload both GM and player clients. Updating an existing installation may require manually using the new manifest URL because the old branch URL is different. Before manual replacement, preserve any local module customizations.

## D&D5e Group actors and Vision 5e

This is a **compatibility configuration**, not an Atlas dependency.

Vision 5e (https://github.com/dev7355608/vision-5e) automatically derives sight/detection data from actor senses and disables manual sight-range editing in Token Configuration. A D&D5e Group actor is primarily a travel/party record and may lack the normal character/NPC senses from which Vision 5e derives range.

Recommended setup in a **test World**:

1. Keep Scene **Token Vision** enabled. Set Exploration Mode to **Shared** if the party should reveal a single persistent map.
2. Keep the D&D5e Group actor for travel pace, advancement, members, etc.
3. If the Group token is not a functioning vision source, add a separate party exploration token using a suitable character/NPC actor whose senses Vision 5e supports. Give player users the required token/actor permissions, enable Vision, and set an appropriate bounded sense/range in that actor's supported fields. On the **placed** token, verify the actual sight source rather than relying only on Prototype Token settings.
4. Check the result from an ordinary player client. Move the party exploration token into unknown terrain; Atlas should show only GM-revealed roads and checkpoints in explored terrain and preserve them as the token departs.
5. If Vision 5e still blocks sight, test temporarily disabling it in a disposable/test World to isolate the conflict. Do not automatically disable Vision 5e for the whole campaign or let Atlas override another module's token/sense computations.

With Token Vision disabled, Foundry reveals the whole Scene; Atlas therefore cannot use a meaningful explored-fog boundary. Shared exploration does not create vision by itself. Global Illumination supplies light, not ownership of a working token vision source.

Atlas's own road/checkpoint player-visible flags remain independent of Foundry fog. This hotfix does not alter Scene flags, Region shapes/Behaviors, movement costs, or road topology.

## Label behavior carried forward

The v0.2.25 draft now includes the checkpoint-split Always-label correction (189 automated tests passing on that branch), as well as cursor-relative Hover labels. Both are inherited here. Live Foundry v14 GM/player acceptance is still required, especially on long roads spanning several screenfuls.

## Hotfix discipline

- The **feature branch/PR** is frozen for functional follow-ups once the corresponding hotfix is opened.
- Every follow-up gets its own branch, `module.json` and `package.json` version, and stacked draft PR.
- No hotfix merges into `main` without the owner's Foundry acceptance.
