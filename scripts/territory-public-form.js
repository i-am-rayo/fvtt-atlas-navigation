/** Public-name approval dialog. Pure DOM presentation: no native document writes. */
import { createSettingsInput } from "./settings-input.js";

export function createPublicTerritoryForm({ nativeName, published = null, hidden = false }) {
  const form = document.createElement("div");
  const hint = document.createElement("p");
  hint.textContent = "Only explicitly published territory labels appear to players " +
    "in Journey banners. The native Region name is suggested for convenience, " +
    "but stays private until you approve publication. Native Region geometry " +
    "and Behaviors are never changed here.";
  form.appendChild(hint);

  const row = document.createElement("div");
  row.className = "form-group";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Public territory name";
  nameLabel.htmlFor = "atlasPublicTerritoryName";
  const field = createSettingsInput("text", published?.label ?? nativeName,
    { name: "publicName", ariaLabel: "Public territory name" });
  field.id = "atlasPublicTerritoryName";
  field.maxLength = 120;
  row.append(nameLabel, field);
  form.appendChild(row);

  const toggleLabel = document.createElement("label");
  const toggle = createSettingsInput("checkbox", Boolean(published), { name: "publish" });
  toggle.value = "true";
  toggleLabel.append(toggle, document.createTextNode(
    " Show this name in Journey banners (public to players)"));
  form.appendChild(toggleLabel);

  if (hidden) {
    const warning = document.createElement("p");
    warning.textContent = "This native Region is hidden. Unhide it before enabling a public name.";
    form.appendChild(warning);
  }
  return form;
}
