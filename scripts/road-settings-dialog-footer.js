/** Keep the existing form's submit button in its footer.
 * DialogV2 and the ApplicationV2 Road window both preserve form submission;
 * never move Save outside the form or replace its action handler.
 */
export function arrangeRoadDialogFooter(dialog) {
  const bar=dialog?.element?.querySelector?.("[data-atlas-road-actions]");
  const footer=dialog?.form?.querySelector?.(".form-footer") ??
    dialog?.element?.querySelector?.(".form-footer");
  const save=footer?.querySelector?.("button[data-atlas-road-submit]") ??
    footer?.querySelector?.('button[data-action="ok"]') ??
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
  // Keep the original submit button and its form ownership authoritative.
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
