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
export function formatNavigationDuration(hours) {
  if(!Number.isFinite(hours)||hours<0)throw new Error("Invalid travel duration.");
  const minutes=Math.round(hours*60);
  const days=Math.floor(minutes/1440), remaining=minutes%1440;
  const h=Math.floor(remaining/60),m=remaining%60;
  return [days?days+"d":null,h?h+"h":null,m||(!days&&!h)?m+"m":null].filter(Boolean).join(" ");
}
