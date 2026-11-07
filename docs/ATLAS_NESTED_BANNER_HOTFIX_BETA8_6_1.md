# v0.3.9-beta.8.6.1 — nested public territory Journey banner hotfix

## Owner's Foundry v14 result

The owner live-tested the Scene Paedor with **Valecor** classified as
Continent and **Hearth's Heart** classified as Town inside it. Both were
explicitly published to Journey banners, but Journey start and arrival
announcements showed **"your destination"**. The GM diagnostic confirmed
that a committed destination-reached pulse used the generic subject.

## Cause and fix

The existing safe public-Region fallback treated *all* overlapping native
Regions as ambiguous. The beta.8.6 geographic parent relationship was only
used by the GM's Road directory; the banner resolver never consulted it.

The new resolver honors a **strict ancestry precedence** for multiple
published native Regions at the *verified original Point B*. The deepest
published descendant wins only when every other public Region containing
Point B is among its validated Atlas geographic ancestors. For example:

- Hearth's Heart (Town, parent Valecor) + Valecor (Continent)
  → **Hearth's Heart**.
- Millstone (Village, parent Valecor) + Dirwest (Town, parent Valecor)
  → **generic**, since neither is an ancestor of the other.
- Missing, unlinked, corrupt or cyclic geographic parent metadata
  → **generic** for an ambiguous overlap.

This uses native `RegionDocument.testPoint` with Point B and the party
TokenDocument elevation, maintaining native polygon/holes/Levels authority.
Checkpoint name precedence, public-label opt-in, active-GM and Journal
confirmation remain unchanged. No private Region names, parent IDs, geometry,
or Journey Journal metadata are sent to players in the public pulse; only
the already-published, validated label is eligible.

## Verification and owner live-test checklist

1. With Valecor and Hearth's Heart *both* published, confirm Hearth's Heart
   has parent **Valecor** in its geographic editor (type Town).
2. Travel to a confirmed Point B inside both native Regions, but not at a
   qualifying checkpoint. The starting banner should lead to Hearth's Heart;
   the arrival banner should welcome the party to Hearth's Heart.
3. Travel to Point B inside Valecor but outside any Town. The banner should
   use Valecor when that Region is published and native containment succeeds.
4. Deliberately test an overlapping unrelated town or a missing parent:
   **your destination** must remain the safe fallback.
5. Verify player and GM names match and never expose unpublished native
   Region names. Repeat after canvas refresh; ensure no Journey movement,
   time, Journal, Regions or Token data change as a result of the hotfix.

## Separately observed

The attached console also contained `Invalid journey timing projection` in
the Navigation destination-stage rendering after a journey stopped. That is
an independent Atlas UI timing issue, **not changed** by this banner-only
hotfix. Third-party `MidiQOL is not defined` originates from the `cat`
package and is also not modified here.

Passing automated tests do not substitute for Foundry v14 GM/non-GM tests.
