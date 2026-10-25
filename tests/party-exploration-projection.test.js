import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyAtlas } from "../scripts/atlas-model.js";
import { addRoad } from "../scripts/road-model.js";
import { addRoadCheckpoint } from "../scripts/checkpoint-model.js";
import { setCheckpointPlayerVisibility, playerAtlasOverlay }
  from "../scripts/player-visibility.js";
import { defaultPartyExploration, setCheckpointKnowledge }
  from "../scripts/party-exploration-model.js";

test("player projection excludes newly added checkpoint on previously explored terrain", () => {
  let i = 0;
  const idFactory = () => "id" + ++i;
  let atlas = addRoad(createEmptyAtlas(), {
    name: "Road", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], idFactory
  });
  const roadId = atlas.roads[0].id;
  const candidate = { kind: "node", nodeId: atlas.segments[0].from };
  atlas = addRoadCheckpoint(atlas, {
    roadId, candidate, name: "Port", idFactory
  });
  atlas = addRoadCheckpoint(atlas, {
    roadId, candidate: { kind: "node", nodeId: atlas.segments[0].to },
    name: "New Guild", idFactory
  });
  const [port, guild] = atlas.checkpoints;
  atlas = setCheckpointPlayerVisibility(atlas, { checkpointId: port.id, visible: true });
  atlas = setCheckpointPlayerVisibility(atlas, { checkpointId: guild.id, visible: true });
  let exploration = { ...defaultPartyExploration(), enabled: true, tokenId: "party" };
  exploration = setCheckpointKnowledge(exploration, port.id, "visited");
  const projection = playerAtlasOverlay(atlas, exploration);
  assert.deepEqual(projection.checkpoints.map(cp => cp.name), ["Port"]);
  assert.ok(!JSON.stringify(projection).includes("New Guild"));
  exploration = setCheckpointKnowledge(exploration, guild.id, "lore");
  const loreProjection = playerAtlasOverlay(atlas, exploration);
  assert.deepEqual(loreProjection.checkpoints.map(cp => cp.name), ["Port", "New Guild"]);
  assert.equal(loreProjection.checkpoints[1].discoveryMode, "lore");
  assert.equal(loreProjection.checkpoints[1].roadId, null,
    "lore reveal must not disclose an unrevealed road");
});
