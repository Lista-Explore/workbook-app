import { registerAllFields } from "./fields/index.js";
import { hydrateAllWorkbooks } from "./core/hydrate.js";

// Bundled (via `npm run build:runtime`) into a single file the loader
// fetches fresh on every page load. The Workbook HTML the Builder gives you
// is already a real, rendered form — no JSON, no config to load. This just
// adds behavior to it: restores previously saved answers, autosaves on
// every change, and adds the download/upload/reset controls, all by
// reading the HTML that's already there.
registerAllFields();
hydrateAllWorkbooks();
