# beta.8.35 — Read-only GM preview of published Territory projection

This is **Stage 2B's first bounded slice**, stacked on Stage 2A beta.8.34. It is **not** a complete Foundry player impersonation, and does not close #198 or #269.

## GM acceptance

1. Open Atlas Layers, choose **Preview Published Territories**. The published Atlas Territory projection (only explicitly shared boundaries and separately public names) should render below Foundry's native Fog/vision layer, matching the Atlas player rendering path.
2. Verify private boundary with public Journey name is still absent. Share one native linked Region through the confirmed publication dialog; it should enter the preview. Revoke it; it should disappear after the native Region update.
3. Verify unsaved GM display preferences are unchanged. **Exit Territory Preview** restores the normal GM Regions layer and geographic names. Scene switch and canvas teardown also end the preview.
4. Check player session remains unaffected and no player preview or GM publication controls appear. Check Checkpoint labels, Roads, native Region Shapes/Behaviors and Journey state are unchanged.
5. Compare directly against a separate real player client, especially native Fog, discovery, Journal access and Road/Checkpoint visibility. The GM preview intentionally does **not** impersonate a selected player's native vision, Fog, native Region document permissions, personal Journal access, or Road overlay.

## Explicit limitation

The GM's native Foundry canvas still operates with GM permissions and vision. Atlas cannot claim a pixel-perfect player preview simply by applying player overlay rules. This mode is a **Territory-only publication projection**; GM-native visual elements may remain visible behind it. No World, Scene, Region, Journal, Token, player preference or exploration data is changed by toggling the preview. Journal interaction is disabled for projected labels.

## Future full preview (#198)

Player selection and account-specific Journal/permission summaries should be implemented as a **separate, safe read-only inspector**, with direct two-client verification. Full Fog/vision impersonation requires an explicit native Foundry v14-compatible design and must not be claimed by this slice. Keep #269's data-distribution/privacy gate open.
