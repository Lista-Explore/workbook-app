/**
 * Renders the worksheet tab strip. Clicking a tab makes it the active
 * worksheet for the section editor below; the active tab's name becomes an
 * editable text field (that's the only way to rename a worksheet — there's
 * no separate "settings" panel for it). "+" to add a worksheet sits inline
 * at the end of the same tab strip, since adding one is a peer action to
 * the tabs themselves, not a separate global action.
 */
export function renderWorksheetList(container, state, { activeWorksheetId, onSelect, onChange, onRename }) {
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "builder-worksheet-list";
  list.setAttribute("role", "tablist");

  state.workbook.worksheets.forEach((worksheet) => {
    const isActive = worksheet.id === activeWorksheetId;
    const tab = document.createElement("div");
    tab.className = "builder-worksheet-tab";
    tab.setAttribute("role", "tab");
    if (isActive) tab.classList.add("builder-worksheet-tab-active");

    if (isActive) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "builder-worksheet-name-input";
      nameInput.value = worksheet.title || "";
      nameInput.placeholder = "Worksheet name";
      // size (not just CSS width) so the box grows with what's actually
      // typed — a fixed width was clipping the last character(s) of
      // anything longer than the default box. `size`'s "average character
      // width" estimate runs narrow for a proportional font, so pad it by
      // a couple of characters rather than sizing exactly to the count.
      const sizeFor = (text) => Math.max(text.length, nameInput.placeholder.length, 1) + 2;
      nameInput.size = sizeFor(nameInput.value);
      nameInput.addEventListener("input", () => {
        worksheet.title = nameInput.value;
        nameInput.size = sizeFor(nameInput.value);
        (onRename || onChange)();
      });
      tab.appendChild(nameInput);
    } else {
      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "builder-worksheet-select-btn";
      selectBtn.textContent = worksheet.title || "(untitled worksheet)";
      selectBtn.addEventListener("click", () => onSelect(worksheet.id));
      tab.appendChild(selectBtn);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "builder-worksheet-remove-btn";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${worksheet.title || "worksheet"}`);
    removeBtn.title = "Remove worksheet";
    removeBtn.addEventListener("click", () => {
      state.removeWorksheet(worksheet.id);
      onChange();
    });

    tab.appendChild(removeBtn);
    list.appendChild(tab);
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.id = "builder-add-worksheet-btn";
  addBtn.setAttribute("aria-label", "Add worksheet");
  addBtn.title = "Add worksheet";
  addBtn.textContent = "+";
  addBtn.addEventListener("click", () => {
    const worksheet = state.addWorksheet("New worksheet");
    onSelect(worksheet.id);
    onChange();
  });
  list.appendChild(addBtn);

  container.appendChild(list);
}
