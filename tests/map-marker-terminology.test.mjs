import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CHECKPOINT_TYPE_GROUPS,CHECKPOINT_TYPE_FLAG} from "../scripts/checkpoint-types.js";

test("Map Marker terminology preserves internal checkpoint keys and literal categories",()=>{
  const language=JSON.parse(readFileSync(new URL("../lang/en.json",import.meta.url),"utf8"));
  assert.equal(language["FVTTATLAS.Checkpoints.Title"],"Map Markers");
  assert.match(language["FVTTATLAS.Checkpoints.Add"],/Map Marker/);
  assert.equal(CHECKPOINT_TYPE_FLAG,"checkpointCategories");
  const categories=CHECKPOINT_TYPE_GROUPS.flatMap(([,options])=>options);
  assert.equal(categories.find(([id])=>id==="security")[1],"Security Checkpoint");
});

test("Map Marker Settings, Territory links and World presets use public-facing names",()=>{
  const source=path=>readFileSync(new URL("../scripts/"+path,import.meta.url),"utf8");
  const marker=source("checkpoint-appearance-editor.js");
  const preset=source("checkpoint-preset-editor.js");
  const territory=source("atlas-territory-settings.js");
  const transport=source("checkpoint-transportation-editor.js");
  assert.match(marker,/Save Map Marker applies your changes to this place/);
  assert.match(marker,/Map Marker settings/);
  assert.match(preset,/Atlas — Edit Map Marker Preset/);
  assert.match(territory,/Map Marker & Journal/);
  assert.match(territory,/Link or unlink Map Marker/);
  assert.match(transport,/ at this Map Marker/);
  assert.doesNotMatch(marker,/Save Checkpoint applies your changes/);
  assert.doesNotMatch(territory,/Link or unlink Checkpoint/);
  // Internal storage/API identifiers are intentionally NOT renamed.
  assert.match(marker,/saveCheckpointPresentation/);
  assert.match(preset,/checkpointPresetAppearance/);
  assert.match(territory,/readTerritoryCheckpointLink/);
});
