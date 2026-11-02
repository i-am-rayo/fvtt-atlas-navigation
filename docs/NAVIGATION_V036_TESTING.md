# v0.3.6-beta.1 — Navigation test guide

This is a **draft test build** stacked on the owner-accepted v0.3.5-beta.5.1 settings hotfix. Test in a backed-up Foundry VTT v14 world as GM, then inspect a separate player client. Do not merge until the owner approves the live results.

## GM navigation interaction

1. Open Atlas Navigation on a Scene with connected roads. Plain-click **A**, then plain-click **B**; note the completed orange route, distance, travel-time estimate and directions.
2. Plain-click several other map locations, pan/zoom, and reopen or resize the Navigation panel. A, B, the route and directions should remain unchanged; ordinary clicks should still be available to other Foundry controls.
3. **Shift+click** another location. Only A should change; B stays and the route recalculates. **Alt/Option+click** another location. Only B should change. Check the route overlay and estimates after each gesture.
4. Test an unsupported disconnected pair. The panel should show a clear failure; change an endpoint explicitly to recover. Test Ctrl, Command/Meta, combined Shift+Alt and right-click; none should move the endpoints.
5. Use **New Route** near the top of the panel. Both points and the overlay should clear. Plain-click a fresh A and B.

## Change invalidation and permissions

1. While a route is complete, make an unrelated Scene update (for example, a non-Atlas Scene field). The route should stay.
2. Edit a road, alter Scene Grid/dimensions, reorder terrain Region priority, or edit/create/delete a native Region. The stale route must clear and explain why. No road or native Region information should be silently rewritten by Navigation.
3. Switch Scenes and exit Navigation. Previous transient A/B overlays should be removed. Reload to ensure no itinerary was stored as a Scene flag.
4. In a **separate non-GM client**, confirm the route picker is unavailable and does not grant extra visibility or token-movement privileges. Existing native Fog and Atlas party exploration must remain unchanged.

## Directions and future integrations

- Route along consecutive same-road/same-heading sections: repeated steps should combine. A material turn, different road, changed terrain or native Region must remain a separate instruction with suitable distance and time.
- Confirm that surface/movement cost, D&D5e Group Actor speed and hours-per-day assumptions still match the previous Navigation behavior. Map-line curves are presentation only; native measured distance remains the calculation source.
- `createNavigationItinerary` (`scripts/navigation-itinerary.js`) exposes schema version **1**, with independent scene/revision, A/B, native measurements, travel pace/speed, ordered road/segment geometry and terrain slices, plus human-readable directions. `getItinerarySnapshot()` returns a copy, never writes one. A future v0.3.7 movement engine and v0.3.9 Journal exporter may consume it only after further authorization, validation and permission testing.

Automated verification: `npm run check`. Passing Node tests do not substitute for live Foundry v14 verification.
