import { readPartyExploration, saveAutomaticCheckpointVisits }
  from "./party-exploration-storage.js";
import { readManualFog, applyManualFogBrush } from "./atlas-manual-fog-storage.js";
import { nativeFogCells } from "./atlas-manual-fog-geometry.js";
import { readAtlas } from "./atlas-storage.js";
import { tokenTravelPath, surveyTrailCells, discoveredOnPath }
  from "./atlas-token-survey.js";
import { atlasDebug } from "./atlas-debug.js";
import {atlasAnnouncementRuntime} from "./atlas-announcement-runtime.js";
import {checkpointKnowledge} from "./party-exploration-model.js";
import {readCheckpointDiscoveryMethods,checkpointDiscoveryMethod}
  from "./checkpoint-discovery-method.js";

const pending=new Map();
function primaryGM() {
  const ids=[...(game.users??[])].filter(u=>u.active&&u.isGM).map(u=>u.id).sort();
  return game.user?.isGM && ids[0]===game.user.id;
}
function enqueue(scene,job) {
  const old=pending.get(scene.id)??Promise.resolve();
  const next=old.catch(()=>{}).then(job);
  pending.set(scene.id,next);
  void next.finally(()=>{if(pending.get(scene.id)===next)pending.delete(scene.id);}).catch(()=>{});
  return next;
}
async function recordSurvey(scene,tokenId,path) {
  if(!primaryGM()||!canvas?.ready||canvas.scene?.id!==scene.id||!path.length)return;
  const config=readPartyExploration(scene);
  if(!config.enabled||config.tokenId!==tokenId||!readManualFog(scene).enabled)return;
  const gridSize=Number(scene.grid?.size),gridDistance=Number(scene.grid?.distance);
  if(!Number.isFinite(gridSize)||gridSize<=0||
      !Number.isFinite(gridDistance)||gridDistance<=0)throw Error("Invalid Scene survey grid scale.");
  const radiusPx=Math.max(gridSize*0.5,(config.radius/gridDistance)*gridSize);
  const cells=surveyTrailCells(nativeFogCells(canvas),path,radiusPx);
  atlasDebug("fog","Explorer survey calculated",{
    sceneId:scene.id,waypoints:path.length,exploredCells:cells.length
  },{level:"verbose"});
  if(cells.length)await applyManualFogBrush(scene,cells,"reveal");
  const checkpoints=discoveredOnPath(readAtlas(scene),path,radiusPx,
    {x:Number(canvas.dimensions.sceneX),y:Number(canvas.dimensions.sceneY)});
  if(checkpoints.length){
    const before=readPartyExploration(scene);
    let added;
    try{added=await saveAutomaticCheckpointVisits(scene,checkpoints);}
    catch(error){
      atlasDebug("announcement","Checkpoint discovery Scene write failed",{
        sceneId:scene.id,candidates:checkpoints.length},{level:"verbose"});
      throw error;
    }
    const committed=readPartyExploration(scene);
    const atlas=readAtlas(scene),methods=readCheckpointDiscoveryMethods(scene);
    for(const checkpointId of new Set(checkpoints)){
      const checkpoint=atlas.checkpoints.find(item=>item.id===checkpointId);
      if(added.includes(checkpointId)){
        // Only a committed automatic transition can produce a live banner.
        // Failure in the display layer cannot invalidate the Scene update.
        try{atlasAnnouncementRuntime.publishDiscovery({scene,kind:"checkpoint",
          recordId:checkpointId,previous:before,committed});}
        catch(error){console.warn("[fvtt-atlas-navigation] Discovery banner failed",error);}
      }else{
        atlasAnnouncementRuntime.diagnostic({type:"checkpoint.discovered",
          subject:checkpoint?.name,from:checkpointKnowledge(before,checkpointId),
          to:checkpointKnowledge(committed,checkpointId),
          method:checkpointDiscoveryMethod(methods,checkpointId),
          decision:"No new automatic visit; banner suppressed"});
      }
    }
  }
}
function report(error) {
  console.warn("[fvtt-atlas-navigation] Explorer survey failed",error);
  ui.notifications?.warn?.("Atlas explorer survey was not saved: "+(error.message||String(error)));
}
export function observeAtlasTokenMovement(document,movement) {
  const scene=document?.parent;
  if(!scene?.id||!primaryGM()||!canvas?.ready||canvas.scene?.id!==scene.id)return;
  const config=readPartyExploration(scene);
  if(!config.enabled||config.tokenId!==document.id||!readManualFog(scene).enabled)return;
  const path=tokenTravelPath(movement,Number(scene.grid?.size));
  if(!path.length)return;
  void enqueue(scene,()=>recordSurvey(scene,document.id,path)).catch(report);
}
/** The GM's deliberate token assignment reveals its current position once. */
export function revealAssignedExplorer(scene,token) {
  if(!token||!primaryGM()||!canvas?.ready||canvas.scene?.id!==scene.id)return;
  const gridSize=Number(scene.grid?.size);
  const width=Number.isFinite(token.width)?token.width:1;
  const height=Number.isFinite(token.height)?token.height:1;
  const path=[{x:token.x+width*gridSize/2,y:token.y+height*gridSize/2}];
  void enqueue(scene,()=>recordSurvey(scene,token.id,path)).catch(report);
}
