import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PDFDocument, StandardFonts } from "../../src/vendor/pdf-lib.esm.js";
import { exportWorkbookPdf, wrapText, embedImageFields } from "../../src/pdf/pdf-export.js";

function widgetRect(form, fieldName) {
  const field = form.getField(fieldName);
  return field.acroField.getWidgets()[0].getRectangle();
}

// A real, minimal 1x1 transparent PNG — small enough to inline, valid
// enough for pdf-lib's embedPng to accept.
const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function pngBytes() {
  const binary = atob(ONE_PX_PNG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

describe("exportWorkbookPdf — column layout", () => {
  it("places fields in the PDF using each field's own stored column, not a row-major slice of the flat list", async () => {
    const config = {
      id: "wb1",
      title: "Column Layout Test",
      worksheets: [
        {
          id: "ws1",
          title: "Worksheet 1",
          sections: [
            {
              id: "s1",
              title: "Section 1",
              columns: 2,
              fields: [
                { id: "field-a", type: "short-text", label: "A", column: 0 },
                { id: "field-b", type: "short-text", label: "B", column: 1 },
                { id: "field-c", type: "short-text", label: "C", column: 0 },
              ],
            },
          ],
        },
      ],
    };

    const bytes = await exportWorkbookPdf(config, {});
    const pdfDoc = await PDFDocument.load(bytes);
    const form = pdfDoc.getForm();

    const rectA = widgetRect(form, "field-a");
    const rectB = widgetRect(form, "field-b");
    const rectC = widgetRect(form, "field-c");

    // A and C are both column 0 -> same x slot.
    expect(rectA.x).toBeCloseTo(rectC.x, 5);
    // B is column 1 -> a different (further right) x slot.
    expect(rectB.x).toBeGreaterThan(rectA.x);
    // A and C stack vertically within column 0: C sits below A.
    expect(rectC.y).toBeLessThan(rectA.y);
  });

  it("does not reshuffle a column's fields when another column has more items (regression: previously used a row-major flat slice)", async () => {
    const config = {
      id: "wb2",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              columns: 2,
              fields: [
                { id: "left-1", type: "short-text", label: "Left 1", column: 0 },
                { id: "left-2", type: "short-text", label: "Left 2", column: 0 },
                { id: "left-3", type: "short-text", label: "Left 3", column: 0 },
                { id: "right-1", type: "short-text", label: "Right 1", column: 1 },
              ],
            },
          ],
        },
      ],
    };

    const bytes = await exportWorkbookPdf(config, {});
    const pdfDoc = await PDFDocument.load(bytes);
    const form = pdfDoc.getForm();

    const left1 = widgetRect(form, "left-1");
    const left2 = widgetRect(form, "left-2");
    const left3 = widgetRect(form, "left-3");
    const right1 = widgetRect(form, "right-1");

    // All three "left" fields share the same x (column 0), in order top-to-bottom.
    expect(left2.x).toBeCloseTo(left1.x, 5);
    expect(left3.x).toBeCloseTo(left1.x, 5);
    expect(left2.y).toBeLessThan(left1.y);
    expect(left3.y).toBeLessThan(left2.y);

    // "right-1" is its own column, at a different x than the left column.
    expect(right1.x).toBeGreaterThan(left1.x);
  });
});

describe("exportWorkbookPdf — form field font size (regression: auto-size (0) rendered huge in a tall multiline box)", () => {
  it("gives every text field, dropdown, and long-text box an explicit font size, not the auto-size default", async () => {
    const config = {
      id: "wb-fontsize",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              fields: [
                { id: "short", type: "short-text", label: "Short", column: 0 },
                { id: "long", type: "long-text", label: "Long", column: 0 },
                { id: "select", type: "dropdown", label: "Select", options: ["A", "B"], column: 0 },
              ],
            },
          ],
        },
      ],
    };

    const bytes = await exportWorkbookPdf(config, {});
    const pdfDoc = await PDFDocument.load(bytes);
    const form = pdfDoc.getForm();

    for (const name of ["short", "long", "select"]) {
      const field = form.getField(name);
      const fontSize = field.acroField.getDefaultAppearance
        ? field.acroField.getDefaultAppearance()
        : undefined;
      // The DA string embeds the font size as "... /Font <size> Tf ..." —
      // asserting it's explicitly present and non-zero (not "0 Tf", which
      // is the auto-size default that caused the oversized text).
      expect(fontSize).toBeDefined();
      expect(fontSize).not.toMatch(/\s0\s+Tf/);
      expect(fontSize).toMatch(/\s10\s+Tf/);
    }
  });
});

describe("wrapText — regression: long text used to overflow its column into the next one", () => {
  it("never returns a line wider than maxWidth", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const text = "Here are questions and add them so i can move to next section, this is a long sentence";
    const maxWidth = 200;

    const lines = wrapText(text, font, 10, maxWidth);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(maxWidth);
    }
    // Every word survives the wrap — nothing dropped.
    expect(lines.join(" ")).toBe(text);
  });

  it("a long instructions field reserves more vertical space than a short one, instead of a fixed height that ignores wrapping", async () => {
    const instructionsField = (label) => ({
      id: "instructions-field",
      type: "instructions",
      label,
      column: 0,
    });
    const buildConfig = (label) => ({
      id: "wb-wrap",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              columns: 1,
              fields: [instructionsField(label), { id: "after", type: "short-text", label: "After", column: 0 }],
            },
          ],
        },
      ],
    });

    const shortBytes = await exportWorkbookPdf(buildConfig("Short."), {});
    const shortAfterRect = widgetRect((await PDFDocument.load(shortBytes)).getForm(), "after");

    const longBytes = await exportWorkbookPdf(
      buildConfig(
        "Here are questions and add them so i can move to next section, this is a long sentence that must wrap across several lines instead of running off the page."
      ),
      {}
    );
    const longAfterRect = widgetRect((await PDFDocument.load(longBytes)).getForm(), "after");

    // The long paragraph needs several wrapped lines' worth of room above
    // "after" — with the old fixed-height assumption these would match.
    expect(longAfterRect.y).toBeLessThan(shortAfterRect.y);
  });
});

describe("exportWorkbookPdf — image embedding", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const imageConfig = {
    id: "wb-image",
    worksheets: [
      {
        id: "ws1",
        sections: [
          {
            id: "s1",
            fields: [{ id: "pic", type: "image", src: "https://example.com/pic.png", alt: "A picture" }],
          },
        ],
      },
    ],
  };

  // Font embedding (Poppins) fetches from fonts.gstatic.com regardless of
  // the test — these mocks only fake the *image* fetch, and pass every
  // other URL (the font files) through to the real network.
  function mockImageFetch(imageResponder) {
    global.fetch = vi.fn((url) => {
      if (url === "https://example.com/pic.png") return imageResponder(url);
      return originalFetch(url);
    });
  }

  it("embeds the actual image when it can be fetched (not just a text placeholder)", async () => {
    mockImageFetch(async () => ({
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => pngBytes().buffer,
    }));

    const bytes = await exportWorkbookPdf(imageConfig, {});
    const pdfDoc = await PDFDocument.load(bytes);

    expect(global.fetch).toHaveBeenCalledWith("https://example.com/pic.png");
    // An embedded image becomes an XObject on the page, not just text.
    const page = pdfDoc.getPages()[0];
    const xObjects = page.node.Resources().lookup(pdfDoc.context.obj("XObject"));
    expect(xObjects).toBeDefined();
  });

  it("falls back to a text placeholder when the image can't be fetched, without failing the export", async () => {
    mockImageFetch(async () => ({ ok: false, status: 404, statusText: "Not Found" }));

    const bytes = await exportWorkbookPdf(imageConfig, {});
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("falls back gracefully when fetch itself throws (e.g. offline)", async () => {
    mockImageFetch(async () => {
      throw new Error("network down");
    });

    await expect(exportWorkbookPdf(imageConfig, {})).resolves.toBeInstanceOf(Uint8Array);
  });

  // These check the actual failure reason at the source (embedImageFields'
  // own `errors` map) rather than round-tripping through rendered PDF
  // text — the placeholder uses a custom subset font with 2-byte CID glyph
  // codes, which a simple hex/Latin-1 test decoder can't read back.
  it("records the real reason a non-2xx response failed, not a mute placeholder", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === "https://example.com/pic.png") return { ok: false, status: 404, statusText: "Not Found" };
      return originalFetch(url);
    });
    const pdfDoc = await PDFDocument.create();
    const { embedded, errors } = await embedImageFields(pdfDoc, imageConfig);
    expect(embedded.get("pic")).toBeNull();
    expect(errors.get("pic")).toContain("404");
  });

  it("names a cross-origin block specifically, since that's the actual common cause (a message-less TypeError)", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === "https://example.com/pic.png") throw new TypeError("Failed to fetch");
      return originalFetch(url);
    });
    const pdfDoc = await PDFDocument.create();
    const { errors } = await embedImageFields(pdfDoc, imageConfig);
    expect(errors.get("pic")).toContain("cross-origin");
  });
});
