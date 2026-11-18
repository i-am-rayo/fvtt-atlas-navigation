export const BRUSH_MODIFIERS={shift:"Shift",alt:"Alt / Option",
  ctrl:"Ctrl",meta:"Cmd / Meta",off:"Disabled"};
export function resolveManualBrushMode(selectedMode, event, shortcuts, paletteOpen) {
  if(!paletteOpen)return selectedMode??null;
  const pressed=key=>key==="shift"?!!event.shiftKey:key==="alt"?!!event.altKey:
    key==="ctrl"?!!event.ctrlKey:key==="meta"?!!event.metaKey:false;
  const reveal=shortcuts.reveal,hide=shortcuts.hide;
  if(reveal!=="off"&&reveal===hide&&pressed(reveal))return selectedMode??null;
  if(hide!=="off"&&pressed(hide))return "hide";
  if(reveal!=="off"&&pressed(reveal))return "reveal";
  return selectedMode??null;
}
