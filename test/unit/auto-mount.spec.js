import { describe, it, expect, beforeEach } from "vitest";

describe("auto-mount.js — the one-time setup's loader", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("injects a cache-busted module script pointing at the CDN bundle (CSS is its own separate <link> line, not injected)", async () => {
    const url = `../../src/auto-mount.js?t=${Math.random()}`;
    await import(/* @vite-ignore */ url);

    const script = document.head.querySelector("script[type=module]");
    expect(script).not.toBeNull();
    expect(script.src).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/Lista-Explore\/workbook-app@main\/src\/dist\/runtime\.bundle\.js\?t=\d+$/
    );

    expect(document.head.querySelector('link[rel="stylesheet"]')).toBeNull();
  });

  it("uses a different cache-busting value on each load, so a browser can never reuse a stale cached copy", async () => {
    await import(/* @vite-ignore */ "../../src/auto-mount.js?run=1");
    const firstScript = document.head.querySelector("script[type=module]");
    const firstBust = new URL(firstScript.src).searchParams.get("t");

    await new Promise((resolve) => setTimeout(resolve, 5));
    document.head.innerHTML = "";
    await import(/* @vite-ignore */ "../../src/auto-mount.js?run=2");
    const secondScript = document.head.querySelector("script[type=module]");
    const secondBust = new URL(secondScript.src).searchParams.get("t");

    expect(secondBust).not.toBe(firstBust);
  });
});
