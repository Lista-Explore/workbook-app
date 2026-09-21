import { describe, it, expect, beforeEach } from "vitest";
import { mountAllWorkbooks, LMSWorkbook } from "../../src/index.js";

beforeEach(() => {
  document.body.innerHTML = "";
  LMSWorkbook._reset();
});

const config = {
  id: "wb1",
  title: "Test Workbook",
  worksheets: [{ id: "ws1", sections: [{ id: "s1", fields: [{ id: "name", type: "short-text", label: "Name" }] }] }],
};

describe("mountAllWorkbooks", () => {
  it("mounts using an explicitly passed config", async () => {
    document.body.innerHTML = '<div data-workbook="wb1"></div>';
    await mountAllWorkbooks({ wb1: config });
    expect(document.querySelector(".wb-title").textContent).toBe("Test Workbook");
  });

  it("falls back to a sibling embedded <script type=application/json data-workbook-config> when no config is passed", async () => {
    document.body.innerHTML = `
      <div data-workbook="wb1"></div>
      <script type="application/json" data-workbook-config="wb1">${JSON.stringify(config)}</script>
    `;
    await mountAllWorkbooks();
    expect(document.querySelector(".wb-title").textContent).toBe("Test Workbook");
  });

  it("prefers an explicitly passed config over an embedded one with the same id", async () => {
    const otherConfig = { ...config, title: "From configsById" };
    document.body.innerHTML = `
      <div data-workbook="wb1"></div>
      <script type="application/json" data-workbook-config="wb1">${JSON.stringify(config)}</script>
    `;
    await mountAllWorkbooks({ wb1: otherConfig });
    expect(document.querySelector(".wb-title").textContent).toBe("From configsById");
  });

  it("skips a mount point with neither a passed config nor an embedded one, without throwing", async () => {
    document.body.innerHTML = '<div data-workbook="missing"></div>';
    await expect(mountAllWorkbooks()).resolves.toEqual([]);
  });

  it("silently skips a mount point whose embedded JSON is malformed", async () => {
    document.body.innerHTML = `
      <div data-workbook="wb1"></div>
      <script type="application/json" data-workbook-config="wb1">{ not valid json </script>
    `;
    await expect(mountAllWorkbooks()).resolves.toEqual([]);
  });
});
