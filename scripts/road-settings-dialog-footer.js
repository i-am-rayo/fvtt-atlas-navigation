/** Keep Foundry DialogV2's native Save button in its own form footer.
 * DialogV2 owns that button's submit lifecycle; moving it into the dialog
 * content can turn a Save click into a close with no serialized form result.
 */
export function arrangeRoadDialogFooter(dialog) {
  const bar=dialog?.element?.querySelector?.("[data-atlas-road-actions]");
  const footer=dialog?.form?.querySelector?.(".form-footer") ??
    dialog?.element?.querySelector?.(".form-footer");
  const save=footer?.querySelector?.('button[data-action="ok"]') ??
    footer?.querySelector?.("button");
  const edit=bar?.querySelector?.('[data-atlas-road-tool="edit"]');
  const connection=bar?.querySelector?.('[data-atlas-road-tool="connection"]');
  const remove=bar?.querySelector?.('[data-atlas-road-tool="delete"]');
  if(!footer||!save||!edit||!connection||!remove)return null;
  const cancel = dialog.element.ownerDocument.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => dialog.close());
  footer.insertBefore(edit,save);
  footer.insertBefore(connection,save);
  footer.insertBefore(cancel,save);
  // Destructive action comes last in both visual and keyboard DOM order.
  footer.appendChild(remove);
  // Keep Foundry's original data-action="ok" submit control authoritative.
  save.title="Save Road";
  save.setAttribute("aria-label","Save Road");
  save.replaceChildren();
  const icon=dialog.element.ownerDocument.createElement("i");
  icon.className="fa-solid fa-floppy-disk";
  icon.setAttribute("aria-hidden","true");
  save.appendChild(icon);
  save.classList.add("atlas-ui-icon-button","atlas-ui-icon-button--footer");
  bar.style.display="none";
  return save;
}
