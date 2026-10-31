/** System-neutral overland time; speed is native Scene grid distance units/hour. */
export const NAVIGATION_SPEED_SETTING="overlandSpeed";
export const DEFAULT_NAVIGATION_SPEED=5;
export function validateNavigationSpeed(value) {
  if(!Number.isFinite(value)||value<=0||value>1000)
    throw new Error("Atlas travel speed must be greater than zero and at most 1000 Scene units/hour.");
  return value;
}
export function navigationHours(weightedDistance,speed) {
  validateNavigationSpeed(speed);
  if(!Number.isFinite(weightedDistance)||weightedDistance<0)
    throw new Error("A nonnegative route distance is required for travel time.");
  return weightedDistance/speed;
}
export function formatNavigationDuration(hours, hoursPerDay=24) {
  if(!Number.isFinite(hours)||hours<0)throw new Error("Invalid travel duration.");
  if(!Number.isFinite(hoursPerDay)||hoursPerDay<=0||hoursPerDay>24)
    throw new Error("Invalid hours traveled per day.");
  const minutes=Math.round(hours*60);
  const dayMinutes=Math.round(hoursPerDay*60);
  const days=Math.floor(minutes/dayMinutes), remaining=minutes%dayMinutes;
  const h=Math.floor(remaining/60),m=remaining%60;
  return [days?days+"d":null,h?h+"h":null,m||(!days&&!h)?m+"m":null].filter(Boolean).join(" ");
}
