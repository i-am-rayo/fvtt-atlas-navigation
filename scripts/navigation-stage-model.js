/**
 * Navigation stage projection. The Journal and active guided session remain the
 * authorities; a stage is never persisted or used to authorize a transition.
 * This module has no Foundry, DOM, canvas, or persistence dependencies.
 */
export const NAVIGATION_STAGES=Object.freeze({
  DESTINATION:"destination",JOURNEY:"journey",CHECKPOINT:"checkpoint",
  COMPLETED:"completed"
});

export function resolveNavigationStage({pendingTransfer=null,travelSession=null,
  completedRecord=null,completedRoute=false}={}){
  if(travelSession)return NAVIGATION_STAGES.JOURNEY;
  if(pendingTransfer)return NAVIGATION_STAGES.CHECKPOINT;
  if(completedRecord?.status==="completed"||completedRoute)
    return NAVIGATION_STAGES.COMPLETED;
  return NAVIGATION_STAGES.DESTINATION;
}
