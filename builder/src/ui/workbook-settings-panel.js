export function renderWorkbookSettingsPanel(container, state, onChange) {
  container.innerHTML = "";
  const wb = state.workbook;

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Workbook title";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.id = "builder-workbook-title";
  titleInput.value = wb.title;
  titleInput.addEventListener("input", () => {
    state.setTitle(titleInput.value);
    onChange();
  });
  titleLabel.appendChild(titleInput);

  container.appendChild(titleLabel);
}
