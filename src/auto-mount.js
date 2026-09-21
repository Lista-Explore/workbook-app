// The JS half of the Builder's "One-time setup" (the CSS is its own
// separate <link> line). This file stays trivial and essentially never
// changes; its only job is to inject a freshly cache-busted <script> tag
// pointing at the real, bundled runtime, on every single page load. That
// means a future fix to the runtime's JS takes effect the next time the
// page loads — no re-pasting, no browser cache to fight.
const script = document.createElement("script");
script.type = "module";
script.src = `https://cdn.jsdelivr.net/gh/Lista-Explore/workbook-app@main/src/dist/runtime.bundle.js?t=${Date.now()}`;
document.head.appendChild(script);
