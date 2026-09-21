// The JS half of the Builder's "One-time setup" (the CSS is its own
// separate <link> line). This file stays trivial and essentially never
// changes; its only job is to load the real, bundled runtime fresh on
// every page load — no re-pasting, no browser cache to fight.
//
// A plain jsDelivr "@main" URL is NOT enough for that: jsDelivr caches
// which commit "@main" currently resolves to, separately from — and much
// longer than — its per-file cache, and a query-string cache-buster on the
// file URL does nothing to bust *that*. So this resolves the actual latest
// commit from GitHub's API first (never long-cached), then loads the
// runtime from a commit-pinned jsDelivr URL, which is always correct the
// instant it's requested. If that lookup ever fails (offline, rate
// limited), it falls back to the plain "@main" URL rather than breaking.
const REPO = "Lista-Explore/workbook-app";

async function resolveRuntimeUrl() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const { sha } = await res.json();
    return `https://cdn.jsdelivr.net/gh/${REPO}@${sha}/src/dist/runtime.bundle.js`;
  } catch {
    return `https://cdn.jsdelivr.net/gh/${REPO}@main/src/dist/runtime.bundle.js?t=${Date.now()}`;
  }
}

const script = document.createElement("script");
script.type = "module";
script.src = await resolveRuntimeUrl();
document.head.appendChild(script);
