/** Native Foundry v14 square/hex cell traversal, anchored to Scene image. */
export function nativeFogCells(view, maxCells=40000) {
  const grid=view?.grid, dim=view?.scene?.dimensions;
  if (!grid || grid.isGridless || view.scene.grid?.type === (globalThis.CONST?.GRID_TYPES?.GRIDLESS ?? 0) ||
      typeof grid.getShape !== "function" || typeof grid.getCenterPoint !== "function") {
    throw new Error("Atlas manual fog requires a square or hex Scene grid.");
  }
  const rows=Number(dim?.rows), columns=Number(dim?.columns);
  if (!Number.isSafeInteger(rows)||!Number.isSafeInteger(columns)||rows<=0||columns<=0||
      rows*columns>maxCells) throw new Error("Atlas Scene grid exceeds the exploration cell limit.");
  const origin={x:Number(view.dimensions?.sceneX),y:Number(view.dimensions?.sceneY)};
  if (![origin.x,origin.y].every(Number.isFinite)) throw new Error("Invalid Scene image origin.");
  const shape=grid.getShape();
  if (!Array.isArray(shape)||shape.length<3||shape.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) {
    throw new Error("Invalid native grid cell polygon.");
  }
  const cells=[];
  for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
    const center=grid.getCenterPoint({i,j});
    if(!Number.isFinite(center?.x)||!Number.isFinite(center?.y))throw new Error("Invalid grid center.");
    cells.push({x:center.x-origin.x,y:center.y-origin.y,
      canvasX:center.x,canvasY:center.y,
      polygon:shape.map(p=>[center.x+p.x,center.y+p.y])});
  }
  return cells;
}
/** Brush radius zero selects one cell; nonzero expands by native center distance. */
export function brushCells(cells, position, radiusCells, gridSize) {
  if (!Number.isFinite(position?.x)||!Number.isFinite(position?.y)||
      !Number.isSafeInteger(radiusCells)||radiusCells<0||radiusCells>20||
      !Number.isFinite(gridSize)||gridSize<=0) throw new Error("Invalid brush size.");
  const nearest=cells.reduce((best,c)=> {
    const dist=Math.hypot(c.canvasX-position.x,c.canvasY-position.y);
    return dist<best.dist?{cell:c,dist}:best;
  },{cell:null,dist:Infinity}).cell;
  if(!nearest)return [];
  const maxRadius=radiusCells*gridSize*1.12+1e-6;
  return cells.filter(c=>Math.hypot(c.canvasX-nearest.canvasX,c.canvasY-nearest.canvasY)<=maxRadius)
    .map(c=>({x:c.x,y:c.y}));
}
