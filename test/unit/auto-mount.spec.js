import { describe, it, expect, beforeEach } from "vitest";

describe("auto-mount.js — the one-time setup's loader", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("injects a cache-busted stylesheet link and a cache-busted module script pointing at the CDN bundle", async () => {
    const url = `../../src/auto-mount.js?t=${Math.random()}`;
    await import(/* @vite-ignore */ url);

    const link = document.head.querySelector('link[rel="stylesheet"]');
    const script = document.head.querySelector("script[type=module]");

    expect(link).not.toBeNull();
    expect(link.href).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/Lista-Explore\/workbook-app@main\/src\/styles\.css\?t=\d+$/
    );

    expect(script).not.toBeNull();
    expect(script.src).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/Lista-Explore\/workbook-app@main\/src\/dist\/runtime\.bundle\.js\?t=\d+$/
    );
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
