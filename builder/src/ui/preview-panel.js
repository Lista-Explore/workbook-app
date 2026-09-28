import { renderWorkbook } from "../../../src/core/renderer.js";
import { hydrateWorkbook } from "../../../src/core/hydrate.js";
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
  mount.dataset.workbook = config.id;
  renderWorkbook(config, mount);
  container.appendChild(mount);

  const workbook = await hydrateWorkbook(mount, { storage: createPreviewStorage(config.id) });
  return workbook;
}
