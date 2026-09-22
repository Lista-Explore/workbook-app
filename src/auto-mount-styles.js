// The CSS half of the Builder's "One-time setup" (the JS loader is its own
// separate file, src/auto-mount.js — kept as its own line/file so the
// setup snippet stays two separate lines, matching the JS loader's own
// shape). This file stays trivial and essentially never changes; its only
// job is to load the real, bundled stylesheet fresh on every page load —
// no re-pasting, no browser cache to fight.
//
// A plain jsDelivr "@main" URL is NOT enough for that: jsDelivr caches
// which commit "@main" currently resolves to, separately from — and much
// longer than — its per-file cache, and a query-string cache-buster on the
// file URL does nothing to bust *that*. So this resolves the actual latest
// commit from GitHub's API first (never long-cached), then loads the
// stylesheet from a commit-pinned jsDelivr URL, which is always correct
// the instant it's requested. If that lookup ever fails (offline, rate
// limited), it falls back to the plain "@main" URL rather than breaking.
//
// Previously this was a static <link> line pinned to a commit by hand in
// publish-panel.js — every change to styles.css needed that pin bumped,
// and forgetting it (twice) silently left old CSS live on already-pasted
// pages. Resolving it dynamically here instead, the same way the JS
// bundle already was, makes that whole class of mistake impossible.
const REPO = "Lista-Explore/workbook-app";

async function resolveStylesheetUrl() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const { sha } = await res.json();
    return `https://cdn.jsdelivr.net/gh/${REPO}@${sha}/src/styles.css`;
  } catch {
    return `https://cdn.jsdelivr.net/gh/${REPO}@main/src/styles.css?t=${Date.now()}`;
  }
}

const link = document.createElement("link");
link.rel = "stylesheet";
link.href = await resolveStylesheetUrl();
document.head.appendChild(link);
