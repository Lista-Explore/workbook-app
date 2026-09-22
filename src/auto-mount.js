// The entire Builder's "One-time setup" — one script tag. This file stays
// trivial and essentially never changes; its only job is to load the real,
// bundled runtime AND its stylesheet fresh on every page load — no
// re-pasting, no browser cache to fight, for either one.
//
// A plain jsDelivr "@main" URL is NOT enough for that: jsDelivr caches
// which commit "@main" currently resolves to, separately from — and much
// longer than — its per-file cache, and a query-string cache-buster on the
// file URL does nothing to bust *that*. So this resolves the actual latest
// commit from GitHub's API first (never long-cached), then loads both
// files from that commit-pinned jsDelivr URL, which is always correct the
// instant it's requested. If that lookup ever fails (offline, rate
// limited), it falls back to the plain "@main" URL rather than breaking.
//
// Previously the CSS was its own static <link> line in the setup snippet,
// pinned to a commit by hand in publish-panel.js — every change to
// styles.css needed that pin bumped, and forgetting it (twice) silently
// left old CSS live on already-pasted pages. Resolving it dynamically here
// instead, the same way the JS bundle already was, makes that whole class
// of mistake impossible: there's nothing left to remember to bump.
const REPO = "Lista-Explore/workbook-app";

async function resolveCommit() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const { sha } = await res.json();
  return sha;
}

let cssUrl;
let jsUrl;
try {
  const sha = await resolveCommit();
  cssUrl = `https://cdn.jsdelivr.net/gh/${REPO}@${sha}/src/styles.css`;
  jsUrl = `https://cdn.jsdelivr.net/gh/${REPO}@${sha}/src/dist/runtime.bundle.js`;
} catch {
  cssUrl = `https://cdn.jsdelivr.net/gh/${REPO}@main/src/styles.css?t=${Date.now()}`;
  jsUrl = `https://cdn.jsdelivr.net/gh/${REPO}@main/src/dist/runtime.bundle.js?t=${Date.now()}`;
}

const link = document.createElement("link");
link.rel = "stylesheet";
link.href = cssUrl;
document.head.appendChild(link);

const script = document.createElement("script");
script.type = "module";
script.src = jsUrl;
document.head.appendChild(script);
