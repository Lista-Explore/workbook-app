import { mountAllWorkbooks } from "./index.js";

// The CDN <script> include in the Builder's "One-time setup" is this file:
// unlike index.js (a library other code calls explicitly), this entry point
// mounts on its own, so including it is the whole step — no glue script.
mountAllWorkbooks();
