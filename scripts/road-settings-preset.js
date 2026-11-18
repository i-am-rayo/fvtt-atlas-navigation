/** Staged Road Settings travel preset, independent of DialogV2 form serialization.
 * The same handler accepts input and change; it never writes to a Scene.
 */
export function createRoadPresetStage(initialId, roadDialogToken) {
  let value=initialId??null;
  const selector='[data-atlas-road-live="'+roadDialogToken+'"]';
  return {
    get value() { return value; },
    handle(event) {
      const select=event?.target;
      if(select?.name!=="atlasRoadPresetId"||!select.closest?.(selector))return false;
      value=select.value||null;
      return true;
    }
  };
}
