import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("auto-mount.js — the one-time setup's loader", () => {
  let originalFetch;

  beforeEach(() => {
    document.head.innerHTML = "";
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves the latest commit from GitHub's API and loads both the runtime AND its stylesheet from commit-pinned jsDelivr URLs (regression: the CSS used to be a separately hand-pinned <link>, which went stale twice when that pin was forgotten)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sha: "abc123deadbeef" }),
    });

    const url = `../../src/auto-mount.js?t=${Math.random()}`;
    await import(/* @vite-ignore */ url);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/Lista-Explore/workbook-app/commits/main",
      { cache: "no-store" }
    );

    const script = document.head.querySelector("script[type=module]");
    expect(script).not.toBeNull();
    expect(script.src).toBe(
      "https://cdn.jsdelivr.net/gh/Lista-Explore/workbook-app@abc123deadbeef/src/dist/runtime.bundle.js"
    );

    const link = document.head.querySelector('link[rel="stylesheet"]');
    expect(link).not.toBeNull();
    expect(link.href).toBe(
      "https://cdn.jsdelivr.net/gh/Lista-Explore/workbook-app@abc123deadbeef/src/styles.css"
    );
  });

  it("falls back to cache-busted @main URLs, for both files, if the GitHub API lookup fails, instead of breaking", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));

    const url = `../../src/auto-mount.js?t=${Math.random()}`;
    await import(/* @vite-ignore */ url);

    const script = document.head.querySelector("script[type=module]");
    expect(script).not.toBeNull();
    expect(script.src).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/Lista-Explore\/workbook-app@main\/src\/dist\/runtime\.bundle\.js\?t=\d+$/
    );

    const link = document.head.querySelector('link[rel="stylesheet"]');
    expect(link).not.toBeNull();
    expect(link.href).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/Lista-Explore\/workbook-app@main\/src\/styles\.css\?t=\d+$/
    );
  });
});
