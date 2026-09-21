import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PDFDocument } from "../../src/vendor/pdf-lib.esm.js";
import { exportWorkbookPdf } from "../../src/pdf/pdf-export.js";

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

  it("embeds the actual image when it can be fetched (not just a text placeholder)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => pngBytes().buffer,
    });

    const bytes = await exportWorkbookPdf(imageConfig, {});
    const pdfDoc = await PDFDocument.load(bytes);

    expect(global.fetch).toHaveBeenCalledWith("https://example.com/pic.png");
    // An embedded image becomes an XObject on the page, not just text.
    const page = pdfDoc.getPages()[0];
    const xObjects = page.node.Resources().lookup(pdfDoc.context.obj("XObject"));
    expect(xObjects).toBeDefined();
  });

  it("falls back to a text placeholder when the image can't be fetched, without failing the export", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    const bytes = await exportWorkbookPdf(imageConfig, {});
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("falls back gracefully when fetch itself throws (e.g. offline)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(exportWorkbookPdf(imageConfig, {})).resolves.toBeInstanceOf(Uint8Array);
  });
});
