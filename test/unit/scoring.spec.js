import { describe, it, expect, beforeAll } from "vitest";
import { registerAllFields } from "../../src/fields/index.js";
import { renderWorkbook } from "../../src/core/renderer.js";
import { hydrateWorkbook } from "../../src/core/hydrate.js";
import { domToConfig } from "../../src/core/dom-config.js";
import { createPreviewStorage } from "../../src/core/storage.js";
import { computeProgress } from "../../src/core/progress.js";
import {
  scoreScale, resolveScoreboard, renderTemplate, snapshotFromConfig, findBand, presetPoints, availableTokens,
} from "../../src/core/scoring.js";
import { careerConfidence } from "../fixtures/career-confidence.js";

beforeAll(() => registerAllFields());

const all = (n, v) => Array.from({ length: n }, () => v);
const dataWith = (values) => ({ worksheets: { ws1: values } });

describe("scoreScale", () => {
  const field = { statements: ["a", "b", "c"], points: presetPoints("1-5") };

  it("keeps a running total while partly answered", () => {
    const r = scoreScale(field, [4, null, 5]);
    expect(r).toMatchObject({ score: 9, max: 15, answered: 2, total: 3, complete: false });
    expect(r.band).toBeNull();
  });

  it("completes and finds a band", () => {
    const bands = [{ min: 1, max: 8, label: "low" }, { min: 9, max: 15, label: "high" }];
    const r = scoreScale({ ...field, bands }, [3, 3, 3]);
    expect(r.complete).toBe(true);
    expect(r.band.label).toBe("high");
  });

  it("mirrors reverse-scored statements", () => {
    expect(scoreScale({ ...field, reverse: [false, true, false] }, [5, 1, 5]).score).toBe(15);
  });

  it("supports 0-based scales and ignores values outside the scale", () => {
    const f = { statements: ["a", "b"], points: presetPoints("0-3") };
    expect(scoreScale(f, [3, 99])).toMatchObject({ score: 3, answered: 1, max: 6 });
  });
});

describe("findBand", () => {
  it("is inclusive on both ends and null outside every band", () => {
    const bands = [{ min: 8, max: 19, label: "x" }];
    expect(findBand(bands, 8).label).toBe("x");
    expect(findBand(bands, 19).label).toBe("x");
    expect(findBand(bands, 20)).toBeNull();
  });
});

describe("career confidence workbook (the PDF's structure)", () => {
  const values = { communication: all(8, 5), decision: all(8, 3), adapt: all(8, 2), advocacy: all(8, 4) };

  it("adds the four areas to a /160 total with strongest and lowest", () => {
    const snap = snapshotFromConfig(careerConfidence, dataWith(values));
    const board = resolveScoreboard(snap.fields.get("profile").field, snap);
    expect(board.rows.map((r) => r.score)).toEqual([40, 24, 16, 32]);
    expect(board.total).toBe(112);
    expect(board.max).toBe(160);
    expect(board.complete).toBe(true);
    expect(board.strongest.map((r) => r.label)).toEqual(["Communication"]);
    expect(board.lowest.map((r) => r.label)).toEqual(["Adaptability"]);
    expect(board.rows.map((r) => r.band.label)).toEqual(["Confidence strength", "Emerging area", "Growth edge", "Confidence strength"]);
    expect(board.band.label).toBe("Room to grow");
  });

  it("does not rank anything until every area is complete", () => {
    const snap = snapshotFromConfig(careerConfidence, dataWith({ communication: all(8, 5), decision: [3] }));
    const board = resolveScoreboard(snap.fields.get("profile").field, snap);
    expect(board.complete).toBe(false);
    expect(board.strongest).toEqual([]);
    expect(board.total).toBe(43);
  });

  it("flags nothing when every area ties", () => {
    const tie = { communication: all(8, 3), decision: all(8, 3), adapt: all(8, 3), advocacy: all(8, 3) };
    const snap = snapshotFromConfig(careerConfidence, dataWith(tie));
    const board = resolveScoreboard(snap.fields.get("profile").field, snap);
    expect(board.strongest).toEqual([]);
    expect(board.lowest).toEqual([]);
  });

  it("fills the AI prompt from scores and reflections, with visible placeholders", () => {
    const snap = snapshotFromConfig(careerConfidence, dataWith({ ...values, "why-low": "fear of change" }));
    const out = renderTemplate(snap.fields.get("prompt").field.template, snap);
    expect(out.text).toBe("Communication: 40/40\nStrongest: Communication\nLowest: Adaptability because fear of change");

    const early = renderTemplate("Lowest: {{profile.lowest}} / {{why-low|your reason}}", snapshotFromConfig(careerConfidence, dataWith({})));
    expect(early.text).toBe("Lowest: [profile lowest] / [your reason]");
    expect(early.parts.filter((p) => p.missing)).toHaveLength(2);
  });

  it("lists insertable tokens for the Builder", () => {
    const tokens = availableTokens(careerConfidence).map((t) => t.token);
    expect(tokens).toContain("{{communication.score}}");
    expect(tokens).toContain("{{profile.strongest}}");
    expect(tokens).toContain("{{why-low}}");
  });
});

describe("copy mode scoreboard", () => {
  const config = structuredClone(careerConfidence);
  config.worksheets[0].sections[1].fields[0].mode = "copy";
  const values = { communication: all(8, 5), decision: all(8, 3), adapt: all(8, 2), advocacy: [4] };

  it("checks typed scores without handing over the answer", () => {
    const snap = snapshotFromConfig(config, dataWith({ ...values, profile: { communication: 40, decision: 25, adapt: 16, advocacy: 4 } }));
    const board = resolveScoreboard(snap.fields.get("profile").field, snap);
    expect(board.rows.map((r) => r.status)).toEqual(["match", "mismatch", "match", "pending"]);
    expect(board.total).toBe(85);
  });
});

describe("rendered workbook", () => {
  function mountWorkbook(data) {
    const mount = document.createElement("div");
    renderWorkbook(careerConfidence, mount, { data: data && dataWith(data) });
    document.body.appendChild(mount);
    return mount;
  }

  it("updates the running score and result as radios are picked", () => {
    const mount = mountWorkbook();
    const wrapper = mount.querySelector('[data-field-id="communication"]');
    expect(wrapper.querySelector(".wb-score-max").textContent).toBe(" / 40");
    const rows = wrapper.querySelectorAll(".wb-scale-row");
    rows.forEach((row) => {
      const radio = row.querySelector('input[value="4"]');
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(wrapper.querySelector(".wb-score-value").textContent).toBe("32");
    expect(wrapper.querySelector(".wb-score-band-label").textContent).toBe("Confidence strength");
    expect(wrapper.querySelector(".wb-score-band").hidden).toBe(false);
    // the summary elsewhere on the page follows
    expect(mount.querySelector('[data-source="communication"] .wb-scoreboard-score-value').textContent).toBe("32");
    expect(mount.querySelector(".wb-scoreboard-total-score").textContent).toBe("32");
    expect(mount.querySelector(".wb-scoreboard-note").textContent).toMatch(/1 of 4 areas complete/);
    mount.remove();
  });

  it("restores saved ratings and the personalised prompt", () => {
    const mount = mountWorkbook({ communication: all(8, 5), decision: all(8, 3), adapt: all(8, 2), advocacy: all(8, 4), "why-low": "change" });
    expect(mount.querySelector(".wb-scoreboard-total-score").textContent).toBe("112");
    expect(mount.querySelector(".wb-is-strongest .wb-scoreboard-area-name").textContent).toBe("Communication");
    expect(mount.querySelector(".wb-is-lowest .wb-scoreboard-badge").textContent).toBe("Growth edge");
    expect(mount.querySelector(".wb-scored-text-body").textContent).toContain("Lowest: Adaptability because change");
    mount.remove();
  });

  it("round-trips through the published HTML (domToConfig)", () => {
    const mount = mountWorkbook();
    const config = domToConfig(mount);
    const fields = config.worksheets[0].sections.flatMap((s) => s.fields);
    const scale = fields.find((f) => f.id === "communication");
    expect(scale).toMatchObject({ type: "scale", areaLabel: "Communication", scoreLabel: "Communication Confidence Score" });
    expect(scale.statements).toHaveLength(8);
    expect(scale.points.map((p) => p.value)).toEqual([1, 2, 3, 4, 5]);
    expect(scale.bands).toHaveLength(3);
    const board = fields.find((f) => f.id === "profile");
    expect(board.rows.map((r) => r.source)).toEqual(["communication", "decision", "adapt", "advocacy"]);
    expect(board.totalBands).toHaveLength(2);
    expect(board.showBandKey).toBe(true);
    expect(fields.find((f) => f.id === "prompt").template).toContain("{{profile.strongest}}");
    mount.remove();
  });

  it("hydrated static HTML is live and persists answers", async () => {
    const source = mountWorkbook();
    const html = source.innerHTML;
    source.remove();

    const mount = document.createElement("div");
    mount.className = "lms-workbook";
    mount.dataset.workbook = "career-confidence-hydrate";
    mount.innerHTML = html;
    document.body.appendChild(mount);
    const storage = createPreviewStorage("career-confidence-hydrate");
    await storage.delete("state");
    await hydrateWorkbook(mount, { storage });

    mount.querySelectorAll('[data-field-id="decision"] .wb-scale-row').forEach((row) => {
      const radio = row.querySelector('input[value="3"]');
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(mount.querySelector('[data-field-id="decision"] .wb-score-value').textContent).toBe("24");
    expect(mount.querySelector('[data-source="decision"] .wb-scoreboard-result').textContent).toBe("Emerging area");
    await new Promise((resolve) => setTimeout(resolve, 600));
    const saved = await storage.get("state");
    expect(Object.values(saved.worksheets)[0].decision).toEqual(all(8, 3));
    mount.remove();
  });

  it("copy button puts the filled prompt on the clipboard", async () => {
    const mount = mountWorkbook({ communication: all(8, 5), decision: all(8, 3), adapt: all(8, 2), advocacy: all(8, 4) });
    let copied = "";
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => { copied = t; } }, configurable: true });
    mount.querySelector(".wb-scored-text-copy").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(copied).toContain("Communication: 40/40");
    expect(mount.querySelector(".wb-scored-text-status").textContent).toMatch(/Copied/);
    mount.remove();
  });
});

describe("required scales and progress", () => {
  it("require every statement and only count when complete", () => {
    const field = { id: "s", type: "scale", required: true, statements: ["a", "b"], points: presetPoints("1-5") };
    const module = { validate: (f, v) => (Array.isArray(v) && v.filter((x) => x != null).length === f.statements.length ? true : "Please rate every statement.") };
    expect(module.validate(field, [1, null])).not.toBe(true);
    const config = { worksheets: [{ id: "w", sections: [{ fields: [field] }] }] };
    expect(computeProgress(config, { worksheets: { w: { s: [1, null] } } }).answered).toBe(0);
    expect(computeProgress(config, { worksheets: { w: { s: [1, 2] } } }).answered).toBe(1);
  });
});

describe("PDF export and import", () => {
  it("exports a fillable PDF with each rating, and imports a filled one back", async () => {
    const { exportWorkbookPdf } = await import("../../src/pdf/pdf-export.js");
    const { importWorkbookPdf } = await import("../../src/pdf/pdf-import.js");
    const { PDFDocument } = await import("../../src/vendor/pdf-lib.esm.js");

    const data = dataWith({ communication: [5, 4, 3, 2, 1, 5, 4, 3], decision: all(8, 3), adapt: all(8, 2), advocacy: all(8, 4), "why-low": "change" });
    const bytes = await exportWorkbookPdf(careerConfidence, data);
    const doc = await PDFDocument.load(bytes);
    const names = doc.getForm().getFields().map((f) => f.getName());
    expect(names.filter((n) => n.startsWith("communication__scale__"))).toHaveLength(8);
    expect(doc.getPageCount()).toBeGreaterThan(1);

    const imported = await importWorkbookPdf(careerConfidence, bytes, {});
    expect(imported.data.worksheets.ws1.communication).toEqual([5, 4, 3, 2, 1, 5, 4, 3]);
    expect(imported.data.worksheets.ws1.adapt).toEqual(all(8, 2));
    expect(imported.unmatchedInPdf).toEqual([]);
  }, 30000);

  it("round-trips typed scores for a copy-mode scoreboard", async () => {
    const { exportWorkbookPdf } = await import("../../src/pdf/pdf-export.js");
    const { importWorkbookPdf } = await import("../../src/pdf/pdf-import.js");
    const config = structuredClone(careerConfidence);
    config.worksheets[0].sections[1].fields[0].mode = "copy";
    const data = dataWith({ communication: all(8, 5), profile: { communication: 40, decision: 12 } });
    const bytes = await exportWorkbookPdf(config, data);
    const imported = await importWorkbookPdf(config, bytes, {});
    expect(imported.data.worksheets.ws1.profile).toEqual({ communication: 40, decision: 12 });
  }, 30000);
});
