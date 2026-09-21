import { registerAllFields } from "./fields/index.js";
import { LMSWorkbook } from "./core/workbook.js";

registerAllFields();

/**
 * Mounts every `[data-workbook]` element on the page. A config passed in
 * `configsById` wins; otherwise, each mount point's config is read from a
 * sibling `<script type="application/json" data-workbook-config="ID">` —
 * exactly what the Builder's "Paste this into your LMS page" snippet
 * includes, so a designer never has to write or host anything themselves
 * beyond that one paste plus the one-time Runtime include.
 */
export async function mountAllWorkbooks(configsById = {}) {
  const mounts = document.querySelectorAll("[data-workbook]");
  const results = [];
  for (const el of mounts) {
    const id = el.dataset.workbook;
    let config = configsById[id];
    if (!config) {
      const dataEl = document.querySelector(`script[type="application/json"][data-workbook-config="${id}"]`);
      if (dataEl) {
        try {
          config = JSON.parse(dataEl.textContent);
        } catch {
          config = null;
        }
      }
    }
    if (!config) continue;
    const instance = LMSWorkbook.has(id) ? LMSWorkbook.get(id) : LMSWorkbook.register(config);
    results.push(await instance.mount(el));
  }
  return results;
}

export { LMSWorkbook };
export { registerAllFields };
