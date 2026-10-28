# Atlas Scene UI — Quick Guide (v0.2.31)

This page explains the Scene **Atlas** tab and its editing tools. All changes are made by a GM. Player-visible roads and discovered checkpoints remain separate from native Foundry vision and Regions.

## First steps

1. Open the Scene settings and choose **Atlas**.
2. Use **Exploration → Manual exploration** to turn Atlas map discovery on or off. **Paint map** opens the GM brush tools. On square or hex maps, Atlas can keep revealed terrain between sessions; it does not overwrite Foundry's native FogExploration.
3. Select **Road → All roads** to see everything, or pick a specific road to focus its list, checkpoints, Region links and terrain-generation tools.
4. Press **+** next to Roads to draw a road. Choose the map points and finish/save.
5. Press **›** next to a road name to expand its settings directly underneath. Only one road stays expanded at a time.

## Road settings

- **Road → Appearance** changes road name, player visibility, line appearance and the linked Journal Entry/Page UUID.
- **Road → Show / Hide** controls whether the road is drawn for players. This never changes checkpoint discovery.
- **Map tools → Edit path** moves stored road points. **Add connection** attaches road graph points; the existing confirmation and edit rules remain in place. **Add checkpoint** places a named location.
- **Journal → Link / change** opens appearance settings for assigning a whole Journal or a page. GMs can open linked journals; players need Foundry Observer permission.
- **Checkpoints** lists this road's checkpoints; choose one to edit its name, discovery, icon and journal. A checkpoint can be automatically encountered, GM-only, or lore-only depending on its discovery method.
- **Connections** counts graph connections without exposing backend node IDs in the everyday Atlas view.
- **Terrain → Travel type** sets the road's world travel/surface preset. It does not immediately rewrite native Regions.
- **Remove → Delete road** uses the existing deletion workflow. Make sure you intend to remove the road.

## More tools

- **Checkpoints:** detailed list and discovery/radius controls for the road selected by the top filter.
- **Generate Regions:** creates optional native Foundry Regions from checkpoints and road sections. For **All roads**, choose a target road in the generator. Generated Regions and native movement Behaviors are modified only by explicit GM actions.
- **Regions:** inspect and manage linked native Regions.
- **Grid:** the Scene's native Grid is the source of units and measurements.

## Journal and player visibility

A 📖 badge means a road or checkpoint has a linked Journal. The GM view also indicates whether configured players have Observer access. On the player canvas the badge only appears if Foundry allows access. Double-clicking a linked road or checkpoint opens the permitted Journal Entry/Page. A hidden road remains hidden even if its checkpoint is discovered.

## Troubleshooting

- If **Paint map** shows no explored territory for players, check the Scene's Token Vision settings and the Atlas manual-exploration toggle.
- If a road/checkpoint Journal will not open for a player, grant Observer permission to the linked Journal Entry or Page, then refresh that player's canvas.
- A road title is suppressed near checkpoint labels so names do not overlap; move the cursor to another part of the road to see its title.
- The Atlas connection graph, native Region geometries, movement Behaviors and existing Scene flags are not reset by the UI overhaul.
