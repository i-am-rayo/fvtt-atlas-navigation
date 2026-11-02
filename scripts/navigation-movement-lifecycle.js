/**
 * Foundry's TokenDocument.move() settles authoritative movement, while the
 * visible Canvas Token may still be animating. Keep Atlas's journey lock until
 * the public Token.movementAnimationPromise settles as well. This is read-only:
 * never starts another move or manipulates native animation internals.
 */
export async function waitForTokenTravelAnimation(token){
  // Let movement-update microtasks expose the current Canvas animation chain.
  await Promise.resolve();
  const animation=token?.object?.movementAnimationPromise;
  if(animation&&typeof animation.then==="function")await animation;
}
