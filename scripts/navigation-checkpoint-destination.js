/** Preview a named destination using the same Atlas coordinates and route solver as a canvas click. */
export function checkpointDestinationControl(planner) {
  const scene = planner.scene;
  const locked = () => planner.travelSession || planner.pendingTransfer || planner.recoveryRecord ||
    planner.recoverableJourney || planner.completedRecord || planner.completedRoute;
  if (!scene || locked()) return null;
  const atlas = planner.atlasProvider(scene);
  if (!atlas?.checkpoints?.length) return null;
  const label = document.createElement("label");
  label.textContent = "Destination checkpoint";
  const select = document.createElement("select");
  const option = (value,text) => {
    const entry = document.createElement("option");
    entry.value = value;
    entry.textContent = text;
    select.appendChild(entry);
  };
  option("","Choose a checkpoint");
  const names = new Map();
  for (const cp of atlas.checkpoints) names.set(cp.name,(names.get(cp.name)??0)+1);
  for (const cp of [...atlas.checkpoints].sort((a,b)=>a.name.localeCompare(b.name))) {
    option(cp.id,names.get(cp.name)>1 ? cp.name+" · "+cp.id : cp.name);
  }
  select.disabled = !planner.start;
  select.addEventListener("change",async()=>{
    const view = planner.canvasProvider();
    if (!select.value || locked() || !planner.start || planner.scene!==scene || !game.user?.isGM ||
      !view?.ready || view.scene?.id!==scene.id || !scene.canUserModify?.(game.user,"update")) return;
    try {
      const current = planner.atlasProvider(scene);
      const cp = current.checkpoints.find(item=>item.id===select.value);
      const node = cp && current.nodes.find(item=>item.id===cp.nodeId);
      if (!Number.isFinite(node?.x) || !Number.isFinite(node?.y)) throw Error("This checkpoint is no longer available.");
      if (planner.sourceMode==="party") planner.syncPartyDeparture(view,current);
      if (!planner.start) return;
      planner.notice = "";
      planner.end = {x:node.x,y:node.y};
      planner.calculateRoute(view,current);
      planner.draw();
      await planner.render(true);
    } catch (error) { ui.notifications.error(error.message); }
  });
  label.appendChild(select);
  return label;
}
