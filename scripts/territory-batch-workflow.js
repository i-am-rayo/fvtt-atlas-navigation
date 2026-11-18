/** Direct a staged Hex/Grid batch from its Paint editor without requiring
 * the GM to find the Workspace between destinations or for final review.
 * All actual native writes remain in the separately guarded commit callback.
 */
export async function routeTerritoryBatchAfterStage({batch,regionId,nextUnstaged,
  decision={},getBatch,openEditor,reviewAndApply,restoreWorkspace}){
  if(getBatch()!==batch)return "stale";
  const {advance=false,targetId=null,review=false}=decision;
  if(targetId&&targetId!==regionId){
    if(!batch.targetIds.includes(targetId))
      throw Error("Choose a selected destination in this Territory batch.");
    await openEditor(targetId);
    return "switched";
  }
  if(advance&&nextUnstaged){await openEditor(nextUnstaged);return "advanced";}
  if(review){
    let applied;
    try{
      applied=await reviewAndApply();
      if(applied===false&&getBatch()===batch){
        await openEditor(regionId);
        return "review-cancelled";
      }
    }catch(error){
      await restoreWorkspace();
      throw error;
    }
    await restoreWorkspace();
    return applied===true?"committed":"returned";
  }
  await restoreWorkspace();
  return "workspace";
}
