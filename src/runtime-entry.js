import { registerAllFields, hydrateAllWorkbooks } from "./shared.js";

// Bundled (via `npm run build:runtime`) into a single file the loader
// fetches fresh on every page load. The Workbook HTML the Builder gives you
// is already a real, rendered form — no JSON, no config to load. This just
// adds behavior to it: restores previously saved answers, autosaves on
// every change, and adds the download/upload/reset controls, all by
// reading the HTML that's already there.
registerAllFields();

// LMS pages may load this module before the pasted workbook HTML exists.
// Hydration is the only path that can attach working controls, because it
// builds the workbook adapter used by PDF export/import/reset.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => hydrateAllWorkbooks());
} else {
  hydrateAllWorkbooks();
}
