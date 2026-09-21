import { Workbook } from "../../../src/core/workbook.js";
import { createPreviewStorage } from "../../../src/core/storage.js";

/**
 * Renders a live Runtime preview of the in-progress workbook. Uses the
 * `preview:<workbookId>` storage namespace so a designer's test answers
 * never collide with real student data, but do survive re-renders as the
 * designer keeps editing.
 */
export async function renderPreviewPanel(container, state) {
  container.innerHTML = "";
  const config = state.toConfig();
  if (!config.id) {
    const note = document.createElement("p");
    note.textContent = "Add a workbook title above to see the live preview.";
    container.appendChild(note);
    return null;
  }

  const mount = document.createElement("div");
  mount.className = "lms-workbook";
  container.appendChild(mount);

  const workbook = new Workbook(config, { storage: createPreviewStorage(config.id) });
  await workbook.mount(mount);
  return workbook;
}
