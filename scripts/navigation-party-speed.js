/**
 * Read-only D&D 5e Group Actor travel pace adapter.
 * No Actor/Token writes. Other systems use the Atlas world fallback.
 */
import { validateNavigationSpeed } from "./navigation-time.js";

const normalize = unit => String(unit ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");

/** Converts kilometers/hour or miles/hour to the active Scene grid units/hour. */
export function convertGroupSpeed(speed, groupUnit, sceneUnit) {
  const source=normalize(groupUnit), target=normalize(sceneUnit);
  const metric=new Set(["kph","kmh","km","kilometer","kilometers","kilometre","kilometres"]);
  const imperial=new Set(["mph","mih","mi","mile","miles"]);
  if(metric.has(source)&&metric.has(target))return speed;
  if(imperial.has(source)&&imperial.has(target))return speed;
  if(metric.has(source)&&imperial.has(target))return speed/1.609344;
  if(imperial.has(source)&&metric.has(target))return speed*1.609344;
  return null;
}

export function readGroupTravelSpeed(actor, sceneUnits, { systemId="dnd5e", mode="land" }={}) {
  if(systemId!=="dnd5e"||actor?.type!=="group"||typeof actor.system?.getTravelPace!=="function")return null;
  const travel=actor.system?.attributes?.travel;
  const hours=travel?.time;
  if(!Number.isFinite(hours)||hours<=0)return null;
  let pace;
  try { pace=actor.system.getTravelPace(); } catch { return null; }
  const daily=pace?.paces?.[mode];
  if(!Number.isFinite(daily)||daily<=0)return null;
  const speed=convertGroupSpeed(daily/hours,travel.units,sceneUnits);
  if(speed===null)return null;
  try {validateNavigationSpeed(speed);}catch{return null;}
  return { speed, actorName:actor.name || "Party", pace:pace.pace?.value||travel.pace||"normal",
    mode, source:"party", hoursPerDay:hours };
}

export function resolveNavigationTravelSpeed({ token, sceneUnits, systemId, worldSpeed }) {
  const party=readGroupTravelSpeed(token?.actor,sceneUnits,{systemId});
  if(party)return party;
  const speed=validateNavigationSpeed(worldSpeed);
  return { speed, actorName:token?.actor?.name||null, pace:null, mode:"land",
    source:"world",hoursPerDay:null };
}
