/**
 * Presentation-only, accessible icon actions shared by Atlas v14 windows.
 * This module has no Foundry, Scene, Actor, or permission dependencies.
 * Its callers remain responsible for authorization and confirming destructive work.
 */
export function createAtlasIconButton({icon,label,onClick=null,size="compact",danger=false}={}) {
  if(typeof icon!=="string" || !/^[a-z][a-z0-9-]*$/.test(icon) ||
      typeof label!=="string" || !label.trim() ||
      (onClick!==null && typeof onClick!=="function") ||
      !["compact","footer"].includes(size) || typeof danger!=="boolean") {
    throw new Error("Invalid Atlas icon action.");
  }

  const button=document.createElement("button");
  button.type="button";
  button.title=label;
  button.ariaLabel=label;
  button.setAttribute?.("aria-label",label);
  button.className=`atlas-ui-icon-button atlas-ui-icon-button--${size}`+
    (danger?" atlas-ui-icon-button--danger":"");
  if(danger)button.style.color="var(--color-level-error, #d56859)";

  const glyph=document.createElement("i");
  glyph.className=`fa-solid fa-${icon}`;
  glyph.setAttribute?.("aria-hidden","true");
  button.appendChild(glyph);
  if(onClick)button.addEventListener("click",onClick);
  return button;
}
