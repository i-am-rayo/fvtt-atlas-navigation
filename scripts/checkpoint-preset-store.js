/** World-setting reads for checkpoint presets; independent of both GM windows. */
import { MODULE_ID } from "./atlas-storage.js";
import { CHECKPOINT_PRESET_SETTING,validateCheckpointPresets }
  from "./checkpoint-preset-model.js";

/** Return the same validated catalog previously read from the settings window. */
export function readWorldCheckpointPresets(){
  return validateCheckpointPresets(game.settings.get(MODULE_ID,CHECKPOINT_PRESET_SETTING));
}
