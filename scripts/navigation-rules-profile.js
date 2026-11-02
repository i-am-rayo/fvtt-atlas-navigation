/** Rule selection is separate from travel animation and never alters Actor data. */
export const NAVIGATION_RULES_PROFILE_SETTING="guidedTravelRulesProfile";
export const NAVIGATION_RULES_PROFILE_DEFAULT="system";
export const NAVIGATION_RULES_PROFILES=Object.freeze({
  system:"Use current game system (recommended)",
  dnd5e2014:"D&D 5e — 2014 rules",
  dnd5e2024:"D&D 5e — 2024 / 5.5e rules",
  custom:"Custom travel rules (future editor)"
});

export function validateNavigationRulesProfile(value){
  if(typeof value!=="string"||!Object.hasOwn(NAVIGATION_RULES_PROFILES,value))
    throw Error("Unknown travel rules profile.");
  return value;
}
