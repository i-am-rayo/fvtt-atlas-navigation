/** Shared unsaved-changes policy for Atlas settings windows. */
export function editableSettingsSnapshot(root, extra = () => null) {
  const controls = Array.from(root?.querySelectorAll?.("input, select, textarea") ?? [])
    .filter(control => control.type !== "search" && !control.dataset.atlasIgnoreDirty)
    .map(control => ({
      name: control.name || control.getAttribute("aria-label") || "",
      type: control.type,
      value: control.type === "checkbox" || control.type === "radio"
        ? control.checked : control.value
    }));
  return JSON.stringify({ controls, extra: extra() });
}

export function trackSettingsChanges(root, extra) {
  const initial = editableSettingsSnapshot(root, extra);
  return () => editableSettingsSnapshot(root, extra) !== initial;
}

/** Read a staged control from its live editor, not a stale dialog result. */
export function liveSettingsFieldValue(root, name, fallback = undefined) {
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) throw Error("Invalid settings field name.");
  const control = root?.querySelector?.('[name="' + name + '"]');
  return typeof control?.value === "string" ? control.value : fallback;
}

/** Guard the native Foundry window X even when its action bypasses close(). */
export function interceptDialogHeaderClose(dialog, isDirty) {
  const closeButton=dialog?.element?.querySelector?.('.window-header [data-action="close"]');
  if(!closeButton)return false;
  closeButton.addEventListener("click",event=>{
    if(!isDirty())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void dialog.close();
  },true);
  return true;
}

/** Closing the prompt itself is the same as continuing to edit. */
export async function confirmUnsavedSettings(title = "Settings") {
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Unsaved " + title },
    content: "<p>You have unsaved changes. What would you like to do?</p>",
    buttons: [
      { action: "save", label: "Save changes", icon: "fa-solid fa-floppy-disk" },
      { action: "discard", label: "Discard changes", icon: "fa-solid fa-trash" },
      { action: "continue", label: "Continue editing", default: true }
    ],
    rejectClose: false,
    modal: true
  });
  return ["save", "discard"].includes(choice) ? choice : "continue";
}

/** Return true only if it is safe to close. A failed Save keeps the form open. */
export async function approveSettingsClose({ isDirty, save, title }) {
  if (!isDirty?.()) return true;
  const choice = await confirmUnsavedSettings(title);
  if (choice === "continue") return false;
  if (choice === "discard") return true;
  return await save() === true;
}
