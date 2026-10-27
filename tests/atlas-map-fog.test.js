import test from "node:test";
import assert from "node:assert/strict";
import { defaultPartyExploration, setCheckpointKnowledge } from "../scripts/party-exploration-model.js";
import {
  defaultAtlasMapFog, validateAtlasMapFog, atlasMapFogSelected,
  appendAtlasFogTrail, atlasFogSurveyRadiusCells, atlasMapFogDiscs,
  atlasMapPointRevealed, removeAtlasFogTrailPoint, clearAtlasFogTrail,
  MAX_ATLAS_FOG_TRAIL_POINTS
} from "../scripts/atlas-map-fog-model.js";

const atlas = {
  nodes: [{ id: "n1", x: 40, y: 80 }],
  checkpoints: [{ id: "bridge", nodeId: "n1" }]
};
const convert = node => ({ x: node.x + 100, y: node.y + 200 });

test("map fog defaults off; no existing Foundry exploration is imported or changed", () => {
  assert.deepEqual(defaultAtlasMapFog(), { schemaVersion: 1, enabled: false, trail: [] });
  assert.equal(atlasMapFogSelected(defaultAtlasMapFog(), defaultPartyExploration()), false);
  assert.throws(() => validateAtlasMapFog({
    schemaVersion: 1, enabled: true, trail: [], nativeFogExploration: "overwrite"
  }));
});

test("lore/visited circles combine with persisted travel, not background snapshots", () => {
  let party = { ...defaultPartyExploration(), enabled: true,
    tokenId: "placed-party", radius: 10 };
  party = setCheckpointKnowledge(party, "bridge", "lore");
  const fog = appendAtlasFogTrail({ ...defaultAtlasMapFog(), enabled: true },
    { x: 30, y: 50, radiusCells: 2 });
  const discs = atlasMapFogDiscs(atlas, party, fog, 50, convert);
  assert.deepEqual(discs, [
    { x: 140, y: 280, radius: 150 },
    { x: 130, y: 250, radius: 100 }
  ]);
  assert.equal(atlasMapPointRevealed({ x: 140, y: 280 }, discs), true);
  assert.equal(atlasMapPointRevealed({ x: 600, y: 800 }, discs), false);
  assert.equal(atlasMapFogDiscs(atlas, party, { ...fog, enabled: false },
    50, convert).length, 0);
});

test("selected fog mode fails closed even if party assignment is removed", () => {
  const fog = { ...defaultAtlasMapFog(), enabled: true };
  assert.equal(atlasMapFogSelected(fog, defaultPartyExploration()), true);
  assert.deepEqual(atlasMapFogDiscs(atlas, defaultPartyExploration(),
    fog, 50, convert), []);
});

test("exploration points deduplicate and never silently truncate saved travels", () => {
  let fog = { ...defaultAtlasMapFog(), enabled: true };
  fog = appendAtlasFogTrail(fog, { x: 0, y: 0, radiusCells: 2 });
  const duplicate = appendAtlasFogTrail(fog, { x: 0.1, y: 0.1, radiusCells: 2 });
  assert.deepEqual(duplicate, fog);
  fog = appendAtlasFogTrail(fog, { x: 100, y: 100, radiusCells: 2 });
  assert.equal(fog.trail.length, 2);
  assert.throws(() => appendAtlasFogTrail({
    ...fog,
    trail: Array.from({ length: MAX_ATLAS_FOG_TRAIL_POINTS },
      (_, index) => ({ x: index, y: 0, radiusCells: 1 }))
  }, { x: 9000, y: 0, radiusCells: 1 }), /full/);
  for (const point of [
    { x: Infinity, y: 0, radiusCells: 1 },
    { x: 0, y: 0, radiusCells: 101 },
    { x: 0, y: 0, radiusCells: 0 }
  ]) assert.throws(() => appendAtlasFogTrail(fog, point));
});

test("survey range uses native Scene grid units with bounded cell radius", () => {
  const party = { ...defaultPartyExploration(), radius: 10 };
  assert.equal(atlasFogSurveyRadiusCells(party, 5), 2);
  assert.throws(() => atlasFogSurveyRadiusCells(party, 0));
  assert.throws(() => atlasFogSurveyRadiusCells(party, 0.01));
  assert.equal(atlasFogSurveyRadiusCells(party, 1), 10);
});

test("current party token adds a temporary reveal without native Token writes", () => {
  const party = { ...defaultPartyExploration(), enabled: true,
    tokenId: "placed-party", radius: 10 };
  const fog = { ...defaultAtlasMapFog(), enabled: true };
  const discs = atlasMapFogDiscs(atlas, party, fog, 50, convert,
    { x: 250, y: 350, gridDistance: 5 });
  assert.deepEqual(discs, [{ x: 250, y: 350, radius: 100 }]);
});

test("GM corrections remove only requested travel geometry without changing fog mode", () => {
  const fog = {
    ...defaultAtlasMapFog(), enabled: true,
    trail: [{ x: 10, y: 20, radiusCells: 2.6666666666666665 },
      { x: 30, y: 40, radiusCells: 0.5 }]
  };
  const corrected = removeAtlasFogTrailPoint(fog, 0);
  assert.deepEqual(corrected.trail, [fog.trail[1]]);
  assert.equal(corrected.enabled, true);
  assert.equal(fog.trail.length, 2, "inputs remain unchanged");
  assert.deepEqual(clearAtlasFogTrail(fog), { ...fog, trail: [] });
  assert.throws(() => removeAtlasFogTrailPoint(fog, -1));
  assert.throws(() => removeAtlasFogTrailPoint(fog, 5));
  assert.throws(() => removeAtlasFogTrailPoint(fog, 0.5));
});

test("new travel records preserve their image-local path and fill gaps between endpoints", () => {
  const party = { ...defaultPartyExploration(), enabled: true,
    tokenId: "placed-party", radius: 10 };
  const first = appendAtlasFogTrail(
    { ...defaultAtlasMapFog(), enabled: true },
    { x: 0, y: 0, radiusCells: 1 });
  const second = appendAtlasFogTrail(first, { x: 100, y: 0, radiusCells: 1 });
  assert.deepEqual(second.trail[1],
    { x: 100, y: 0, radiusCells: 1, fromX: 0, fromY: 0 });
  const discs = atlasMapFogDiscs({ nodes: [], checkpoints: [] }, party, second, 10,
    p => ({ x: p.x, y: p.y }));
  assert.equal(atlasMapPointRevealed({ x: 50, y: 0 }, discs), true);
  assert.equal(atlasMapPointRevealed({ x: 50, y: 50 }, discs), false);
  assert.deepEqual(validateAtlasMapFog(first).trail[0],
    { x: 0, y: 0, radiusCells: 1 }, "older exploration points stay unchanged");
  const corrected = removeAtlasFogTrailPoint(second, 1);
  assert.equal(atlasMapPointRevealed({ x: 50, y: 0 }, atlasMapFogDiscs(
    { nodes: [], checkpoints: [] }, party, corrected, 10,
    p => ({ x: p.x, y: p.y })), false);
});
