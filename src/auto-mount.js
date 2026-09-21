import { registerAllFields } from "./fields/index.js";
import { hydrateAllWorkbooks } from "./core/hydrate.js";

// The CDN <script> include in the Builder's "One-time setup". The Workbook
// HTML the Builder gives you is already a real, rendered form — no JSON, no
// config to load. This just adds behavior to it: restores previously saved
// answers, autosaves on every change, and adds the download/upload/reset
// controls, all by reading the HTML that's already there.
registerAllFields();
hydrateAllWorkbooks();
