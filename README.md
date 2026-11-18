# FVTT Atlas Navigation

**An interactive world atlas and overland travel companion for Foundry Virtual Tabletop v14.**

Turn a Scene map into a network of named roads, recognizable locations, geographic territories, and planned journeys. **Atlas helps the Game Master (GM) organize a world map, describe routes, and guide party travel**, while Foundry remains responsible for its native Scenes, Regions, Tokens, Journals, and permissions.

**Current version:** 0.3.10 · **Foundry compatibility:** v14

## What can Atlas do?

| Area | GM capabilities |
| --- | --- |
| **Map directory** | Browse a Scene's map content **by territory**, **all roads**, or **all Map Markers**. Search, organize, inspect, and locate authored places. |
| **Road networks** | Draw named roads with bends and junctions; edit their shapes and connections with explicit confirmation. Customize road lines, labels, visibility, and travel-surface presets. |
| **Map Markers** | Mark cities, towns, villages, bridges, landmarks, and other locations. Place independent markers or attach them to the road network. Customize icons, labels, elevation, discovery, and linked Journals. |
| **Territories** | Organize geographic areas using native Foundry Regions. Classify settlements and larger areas, link territories to Map Markers, and edit polygon or grid-cell boundaries with GM review. |
| **Terrain surfaces** | Preview and create native Regions around Map Markers or along road corridors. Assign travel presets; optionally apply a native movement-cost Behavior only after explicit approval. |
| **Exploration and map layers** | Manage Atlas's manual map fog, preview map presentation as GM, and choose which road, marker, and territory visuals may be shown to players. Players can adjust their permitted Atlas Layers locally. |
| **Navigation** | Plan routes through connected roads, inspect distance and travel estimates, choose available travel methods, and run GM-approved guided journeys using native Token movement. |
| **Journey records** | Record confirmed travel, breaks, and progress in a Journey Journal; optionally advance Foundry World time. Show Journey and discovery announcement banners. |
| **Scene transfers** | Review map dependencies before using Foundry's native Scene export/import tools. |

Atlas is designed to be **game-system neutral**. Where supported, optional D&D travel-rule profiles and Group transportation integrations are available; they are not required for basic map authoring.

## Install Atlas

1. In Foundry v14, open **Add-on Modules** and choose **Install Module**.
2. Paste this **Manifest URL** into the installation field:

   `https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/main/module.json`

3. Install the module, enable **FVTT Atlas Navigation** in your World, and open the Scene you want to map.

The manifest follows the maintained `main` version. Back up your World before making substantial changes to existing map data.

## Your first Atlas map

Atlas's authoring tools are available to the **GM** from the Scene canvas toolbar.

1. **Open the workspace.** With a Scene active, find **Atlas Exploration** in the canvas controls and select **Atlas Scene Workspace (GM)** (the gear icon). This opens the Atlas workspace for that Scene.
2. **Create a road.** In **Map directory**, choose **Add road**, or use the **Draw Atlas Road** canvas tool. Define its name and properties, place the road points on the map, and save. Roads are not automatically connected simply because their lines cross.
3. **Place Map Markers.** Choose **Add Map Marker** or the matching canvas tool. Add a landmark independently or associate it with an eligible road location. Use its Settings to choose the marker type, icon, label, discovery settings, and any Journal link.
4. **Add geographic territories (optional).** Use **Add territory** or the Territory tools in **Settings → Advanced map operations**. Atlas uses Foundry's native Regions for territory shapes; it can also offer a matching one-cell Territory after saving a settlement Map Marker.
5. **Choose what to show.** Use **Atlas Layers** for map presentation and individual Road, Map Marker, and Territory settings to control the appropriate player-visible elements. Review visibility using a separate player account.
6. **Plan a journey.** From the workspace **Overview**, choose **Plan a route**, or open the compass-shaped **Atlas Navigation** canvas tool. Select a destination, review the route, travel method, and estimate, then explicitly approve travel when ready.

The workspace is organized around **Overview**, **Map directory**, and **Settings**. Advanced Road, Map Marker, native Region, Fog, travel-rule, and import/export tools are available within those sections.

## Map authoring

### Roads and Map Markers

Roads are saved as an editable network, not just decorative strokes. You can add bends, join eligible graph nodes, manage junctions, and reposition supported Map Markers. Connections that change the network require a deliberate GM action. Road and marker editors offer staged changes and Save/Cancel controls, with Undo where supported.

A **Map Marker** is a place on your map; it does not need to be part of a Road. You can attach a Foundry Journal Entry or Page for its lore and control who can read that Journal through Foundry's own permissions.

Map Markers and roads also support appearance choices such as colors, icons, names, and hover labels. Visibility settings for a road and for its Map Markers are separate.

### Territories and terrain

**Geographic Territories** describe places such as continents, cities, towns, villages, and other areas. Atlas uses **native Foundry Region shapes** for their boundaries, including supported square/hex-grid painting. A Territory can be explicitly linked to a compatible Map Marker without merging their identities or Journals.

**Terrain Regions** describe map surfaces or travel corridors. Atlas can generate a previewed Region along a Road or around a Map Marker. A surface preset can describe conditions for Atlas's travel estimates; it does **not** automatically change a token's movement cost. A native movement-cost Behavior is a separate, GM-confirmed operation.

Use Foundry's own Region editor for native Shapes, elevation, and Behaviors. Atlas does not silently rebuild a Region when you change a Road or Map Marker.

## Planning and running journeys

Atlas Navigation uses the authored Road network and the active Scene's **native grid measurements** to find connected paths and estimate travel. The GM can plan travel using available walking, mount, or vehicle options according to the configured World and checkpoint services.

For an approved guided Journey, Atlas can move the selected party Token through Foundry's native movement system. The Journey interface supports progress, travel directions, visual playback controls, and GM decisions for breaks or continuation. Atlas maintains a Journey Journal for confirmed travel and rest decisions.

**Travel animation speed and in-world travel speed are different.** Making the animation faster does not by itself increase the party's travel pace or advance World time.

In **Settings → Exploration & travel** or **Atlas — Transportation Presets** in Foundry's module settings, the GM can configure travel rules and playback options. Supported rule choices include D&D 2014, D&D 2024/5.5e, and custom settings where applicable.

**Advance World Time is optional and disabled by default.** Atlas does not automatically restore Actor resources, apply exhaustion, or treat a visual journey preview as committed travel.

## Players, discovery, and Journals

The GM decides which Roads and Map Markers are shown and may separately publish a Territory's **boundary** and **public Journey name**. Showing one does not automatically publish the other.

Eligible players have their own **Atlas Layers** canvas control to adjust the presentation of shared Territories, such as outlines, labels, and fills. Foundry's Fog of War, Atlas manual fog, discovery settings, and Journal permissions each affect different parts of what a player can see.

**Important:** Hiding Atlas graphics is not the same as making data confidential. Do not store secrets in Scene flags or other data accessible to player clients solely on the assumption that a hidden map overlay will protect them. Check visibility and Journal access with a real player account.

## Moving a map to another World

Open **Settings → Import / Export** to review referenced assets and Journal links. For a transfer, use Foundry's **native Scene Export Data / Import Data** commands rather than expecting Atlas to package an entire World.

A native Scene export includes the Scene's Atlas data and native Regions, but **external map images, custom icon files, and linked Journal documents may need to be transferred separately**. Verify paths, Journal IDs, permissions, Regions, and Fog in the destination World. Import into a new Scene in a backed-up World rather than overwriting your source.

## Important limitations

Atlas v0.3.10 is a maintained mainline version, but some advanced workflows still require caution:

- **Journey recovery:** A canvas reload, weather-related Scene rebuild, or interrupted transfer can leave a Journey needing GM review. If Atlas reports an inconsistency between a Token and the saved Journey, preserve the Journal and investigate rather than restarting movement to force progress.
- **Territory transfers:** Complex multi-Region grid edits and interrupted writes may require the built-in recovery review. Back up the World and do not override a pending recovery warning.
- **Player confidentiality:** Test public presentation and permissions using both GM and non-GM clients; hidden overlays alone do not secure underlying Scene data.
- **Scene portability:** Atlas does not automatically copy external images, Journals, or their permissions into another World.
- **Navigation scope:** Routes use the current Scene's authored network. Google Maps-style route dragging, unrestricted alternative-route selection, and automatic inter-Scene travel are not features of this version.

When editing a longstanding World, make a backup first and review native Region changes before confirming them.

## Help and feedback

Found a problem or have a feature idea? Use the project's [GitHub Issues](https://github.com/i-am-rayo/fvtt-atlas-navigation/issues) and include your Foundry version, Atlas version, a brief reproduction, and any relevant console error.

FVTT Atlas Navigation is an independent community module and is not affiliated with Foundry Virtual Tabletop.
