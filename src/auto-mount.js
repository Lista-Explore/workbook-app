// The one line that goes in the Builder's "One-time setup" — and the only
// one that should ever need to be pasted there again. This file itself
// stays trivial and essentially never changes; its only job is to inject a
// freshly cache-busted <script> tag pointing at the real, bundled runtime,
// on every single page load. That means a future fix to any part of the
// runtime (styles, field types, PDF export, anything) takes effect the
// next time the page loads — no re-pasting, no browser cache to fight.
const BASE = "https://cdn.jsdelivr.net/gh/Lista-Explore/workbook-app@main/src";
const bust = Date.now();

const link = document.createElement("link");
link.rel = "stylesheet";
link.href = `${BASE}/styles.css?t=${bust}`;
document.head.appendChild(link);

const script = document.createElement("script");
script.type = "module";
script.src = `${BASE}/dist/runtime.bundle.js?t=${bust}`;
document.head.appendChild(script);
