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

  it("resolves the latest commit from GitHub's API and loads the runtime from a commit-pinned jsDelivr URL", async () => {
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
    expect(document.head.querySelector('link[rel="stylesheet"]')).toBeNull();
  });

  it("falls back to a cache-busted @main URL if the GitHub API lookup fails, instead of breaking", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));

    const url = `../../src/auto-mount.js?t=${Math.random()}`;
    await import(/* @vite-ignore */ url);

    const script = document.head.querySelector("script[type=module]");
    expect(script).not.toBeNull();
    expect(script.src).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/Lista-Explore\/workbook-app@main\/src\/dist\/runtime\.bundle\.js\?t=\d+$/
    );
  });
});
