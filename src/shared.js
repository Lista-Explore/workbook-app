// Shared runtime utilities for both the Builder preview panel and
// LMS-rendered pages. This file re‑exports the core Workbook class and the
// registration/hydration helpers used by the runtime bundle. It also provides
// a convenience `mountWorkbook` helper that can be used by the preview panel
// to create and mount a workbook instance without needing to import the full
// `Workbook` class directly.

// Import core Workbook implementation and runtime helpers
import { Workbook } from "./core/workbook.js";
import { registerAllFields } from "./fields/index.js";
import { hydrateAllWorkbooks } from "./core/hydrate.js";
import { createPreviewStorage } from "./core/storage.js";

/**
 * Convenience wrapper that creates a new {@link Workbook} instance and mounts
 * it into the provided container. The function returns the workbook instance.
 *
 * @param {object} config - Workbook configuration object.
 * @param {HTMLElement} container - Element to mount the workbook into.
 * @returns {Promise<Workbook>} The mounted workbook.
 */
export async function mountWorkbook(config, container) {
  const workbook = new Workbook(config, { storage: createPreviewStorage(config.id) });
  await workbook.mount(container);
  return workbook;
}

// Re‑export for external consumers
export { Workbook, registerAllFields, hydrateAllWorkbooks };
