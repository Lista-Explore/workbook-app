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
// instant it's requested.
//
// If that lookup ever fails (offline, rate limited), this falls back to a
// hardcoded, occasionally-bumped "last known good" commit — NOT jsDelivr's
// "@main", which is exactly the stale branch-resolution cache this whole
// function exists to dodge, and NOT raw.githubusercontent.com either (it
// serves every file as text/plain, which browsers refuse to run as a
// module script). FALLBACK_COMMIT doesn't need bumping on every change —
// only occasionally, so a rare API failure doesn't strand a page on
// something ancient.
const REPO = "Lista-Explore/workbook-app";
const FALLBACK_COMMIT = "70e58fdd45bf0bcf04d452bdbd292cdad1c2c4e0";

async function resolveRuntimeUrl() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const { sha } = await res.json();
    return `https://cdn.jsdelivr.net/gh/${REPO}@${sha}/src/dist/runtime.bundle.js`;
  } catch {
    return `https://cdn.jsdelivr.net/gh/${REPO}@${FALLBACK_COMMIT}/src/dist/runtime.bundle.js`;
  }
}

const script = document.createElement("script");
script.type = "module";
script.src = await resolveRuntimeUrl();
document.head.appendChild(script);
