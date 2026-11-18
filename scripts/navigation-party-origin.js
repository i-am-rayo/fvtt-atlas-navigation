/** Canvas-space center of the Scene's placed party explorer TokenDocument. */
export function partyTokenCanvasCenter(token, gridSize) {
  if (!Number.isFinite(gridSize) || gridSize <= 0 ||
      !Number.isFinite(token?.x) || !Number.isFinite(token?.y) ||
      !Number.isFinite(token?.width) || token.width <= 0 ||
      !Number.isFinite(token?.height) || token.height <= 0) {
    throw Error("Assign a valid placed Atlas party explorer token before choosing its location.");
  }
  return {
    x: token.x + token.width * gridSize / 2,
    y: token.y + token.height * gridSize / 2
  };
}
