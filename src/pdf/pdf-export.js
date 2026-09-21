import { PDFDocument, rgb } from "../vendor/pdf-lib.esm.js";
import fontkit from "../vendor/fontkit.esm.js";
import { DISPLAY_ONLY_FIELD_TYPES } from "../fields/index.js";
import { groupByColumn } from "../core/column-layout.js";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const GAP = 10;
const MAX_IMAGE_HEIGHT = 160;

// Google's own font CDN — permanent, CORS-enabled (confirmed:
// access-control-allow-origin: *), so these fetch identically whether this
// code runs locally in the Builder or from the bundled CDN runtime. Pinned
// to specific file URLs (not the @font-face CSS endpoint) so this doesn't
// depend on parsing CSS to find them.
const POPPINS_REGULAR_URL = "https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrFJA.ttf";
const POPPINS_BOLD_URL = "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7V1s.ttf";

async function embedPoppins(pdfDoc) {
  pdfDoc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fetch(POPPINS_REGULAR_URL).then((res) => res.arrayBuffer()),
    fetch(POPPINS_BOLD_URL).then((res) => res.arrayBuffer()),
  ]);
  const [font, boldFont] = await Promise.all([
    pdfDoc.embedFont(regularBytes, { subset: true }),
    pdfDoc.embedFont(boldBytes, { subset: true }),
  ]);
  return { font, boldFont };
}

/**
 * Fetches and embeds every image field's picture into the PDF document up
 * front (embedding is async; the layout pass below is not), so drawing can
 * look up an already-embedded image by field id. A field whose image can't
 * be fetched or isn't a PNG/JPEG (the only formats pdf-lib can embed) maps
 * to `null` in `embedded`, with the actual reason recorded in `errors` — so
 * the fallback placeholder can show *why* it failed (network error, a
 * non-2xx status, wrong content type) instead of a mute "[image]".
 */
export async function embedImageFields(pdfDoc, config) {
  const embedded = new Map();
  const errors = new Map();
  const jobs = [];

  for (const worksheet of config.worksheets || []) {
    for (const section of worksheet.sections || []) {
      for (const field of section.fields || []) {
        if (field.type !== "image" || !field.src) continue;
        jobs.push(
          (async () => {
            try {
              const res = await fetch(field.src);
              if (!res.ok) throw new Error(`server returned ${res.status} ${res.statusText || ""}`.trim());
              const contentType = (res.headers.get("content-type") || "").toLowerCase();
              const bytes = new Uint8Array(await res.arrayBuffer());
              const isPng = contentType.includes("png") || /\.png(\?|$)/i.test(field.src);
              const isJpg = contentType.includes("jpeg") || contentType.includes("jpg") || /\.jpe?g(\?|$)/i.test(field.src);
              if (!isPng && !isJpg) {
                throw new Error(`unsupported image type (only PNG/JPEG can be embedded)${contentType ? `, got "${contentType}"` : ""}`);
              }
              const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
              embedded.set(field.id, image);
            } catch (err) {
              embedded.set(field.id, null);
              // A cross-origin fetch blocked by the image host shows up as
              // a generic, message-less TypeError — that's the signature,
              // not a bug in this code, so name it plainly instead of
              // surfacing pdf-lib's opaque "Failed to fetch".
              const reason =
                err instanceof TypeError
                  ? "the image's host blocked this from reading it (a cross-origin restriction on their end)"
                  : err.message;
              errors.set(field.id, reason);
            }
          })()
        );
      }
    }
  }

  await Promise.all(jobs);
  return { embedded, errors };
}

/** Scales an embedded image to fit within `maxWidth`, capped at MAX_IMAGE_HEIGHT. */
function scaledImageSize(image, maxWidth) {
  const ratio = Math.min(maxWidth / image.width, MAX_IMAGE_HEIGHT / image.height, 1);
  return { width: image.width * ratio, height: image.height * ratio };
}

/**
 * Breaks `text` into lines that each fit within `maxWidth` at the given
 * font/size — without this, a label or instructions text longer than its
 * column runs straight past the column boundary and visually overlaps
 * whatever is in the next column, since drawText() never wraps on its own.
 */
export function wrapText(text, font, size, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

const LINE_HEIGHT = 13;

function fieldRowHeight(field, embeddedImages, font, width, imageErrors) {
  if (field.type === "image") {
    const image = embeddedImages?.get(field.id);
    if (image) {
      const { height } = scaledImageSize(image, CONTENT_WIDTH);
      return height + (field.caption ? 14 : 0);
    }
    const reason = imageErrors?.get(field.id);
    const text = `[image not embedded${reason ? `: ${reason}` : ""}]`;
    return wrapText(text, font, 8, width).length * LINE_HEIGHT + 8;
  }
  if (field.type === "heading" || field.type === "instructions" || field.type === "statement") {
    const lines = wrapText(field.label, font, field.type === "heading" ? 12 : 10, width);
    return lines.length * LINE_HEIGHT + 8;
  }
  // Every other field draws a wrapped label above its widget — reserve
  // space for however many lines that label actually needs.
  const labelLines = wrapText(field.label, font, 10, width).length;
  const labelHeight = (labelLines - 1) * LINE_HEIGHT;

  if (field.type === "long-text") return 90 + labelHeight;
  if (field.type === "radio" || field.type === "checkbox-group") {
    const count = (field.options || []).length || 1;
    return 20 + count * 16 + labelHeight;
  }
  return 40 + labelHeight;
}

/**
 * Draws a real, fillable AcroForm widget for one field at (x, y, width),
 * named exactly `field.id` (or, for checkbox-group, `${field.id}__opt__${i}`
 * per option — there is no single native PDF control for a multi-select
 * checklist). File fields are skipped: browsers cannot restore a File into
 * a template, so there is nothing meaningful to export for them.
 */
function drawWrappedText({ page, text, font, size, x, y, width, color }) {
  const lines = wrapText(text, font, size, width);
  let lineY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: lineY, size, font, color });
    lineY -= LINE_HEIGHT;
  }
  return lineY;
}

function drawField({ form, font, page, field, value, x, y, width }) {
  const labelBottomY = drawWrappedText({ page, text: field.label || "", font, size: 10, x, y, width, color: rgb(0, 0, 0) });
  const widgetY = labelBottomY - 4;

  switch (field.type) {
    case "heading":
    case "instructions":
    case "statement":
      // display-only: label already drawn above, nothing else to render
      return;

    case "file":
      // not exportable into a PDF form field
      return;

    case "long-text": {
      const tf = form.createTextField(field.id);
      tf.enableMultiline();
      if (value) tf.setText(String(value));
      tf.addToPage(page, { x, y: widgetY - 60, width, height: 64, font, borderWidth: 1 });
      // setFontSize() needs a /DA entry to already exist, which addToPage()
      // is what creates — must come after. Without an explicit size,
      // pdf-lib leaves it at 0 ("auto"), and a PDF viewer then picks its
      // own size to fill the widget, which for a tall multiline box with
      // little text in it can render enormous. Match the label's size
      // instead of leaving it to the viewer's guess.
      tf.setFontSize(10);
      return;
    }

    case "checkbox": {
      const cb = form.createCheckBox(field.id);
      cb.addToPage(page, { x, y: widgetY - 14, width: 14, height: 14 });
      if (value) cb.check();
      return;
    }

    case "dropdown": {
      const dd = form.createDropdown(field.id);
      dd.addOptions(field.options || []);
      if (value) dd.select(value);
      dd.addToPage(page, { x, y: widgetY - 16, width, height: 18, font });
      dd.setFontSize(10);
      return;
    }

    case "radio": {
      const rg = form.createRadioGroup(field.id);
      let optionY = widgetY;
      for (const option of field.options || []) {
        rg.addOptionToPage(option, page, { x, y: optionY - 12, width: 12, height: 12 });
        page.drawText(option, { x: x + 18, y: optionY - 11, size: 9, font });
        optionY -= 16;
      }
      if (value) rg.select(value);
      return;
    }

    case "checkbox-group": {
      const selected = new Set(Array.isArray(value) ? value : []);
      let optionY = widgetY;
      (field.options || []).forEach((option, index) => {
        const cb = form.createCheckBox(`${field.id}__opt__${index}`);
        cb.addToPage(page, { x, y: optionY - 12, width: 12, height: 12 });
        if (selected.has(option)) cb.check();
        page.drawText(option, { x: x + 18, y: optionY - 11, size: 9, font });
        optionY -= 16;
      });
      return;
    }

    default: {
      // every other type (short-text, number, email, url, tel, password,
      // date, time, datetime, month, week, datalist, signature) is a
      // single-line text field in the PDF
      const tf = form.createTextField(field.id);
      if (value != null) tf.setText(String(value));
      tf.addToPage(page, { x, y: widgetY - 16, width, height: 18, font, borderWidth: 1 });
      tf.setFontSize(10);
      return;
    }
  }
}

/** Draws one field — an actual embedded image when available, its display-only text, or its form widget. */
function drawFieldOrPlaceholder({ form, font, page, field, value, x, y, width, embeddedImages, imageErrors }) {
  if (field.type === "image") {
    const image = embeddedImages?.get(field.id);
    if (image) {
      const { width: w, height: h } = scaledImageSize(image, width);
      page.drawImage(image, { x, y: y - h, width: w, height: h });
      if (field.caption) {
        page.drawText(field.caption, { x, y: y - h - 12, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      }
      return;
    }
    // Fetch/embed failed — fall back to a text placeholder so the PDF
    // isn't silently missing content, and say why it failed rather than a
    // mute "[image]", so the actual cause is visible without guessing.
    const reason = imageErrors?.get(field.id);
    const text = `[image not embedded${reason ? `: ${reason}` : ""}]`;
    drawWrappedText({ page, text, font, size: 8, x, y, width, color: rgb(0.55, 0.15, 0.15) });
    return;
  }
  if (field.type === "heading" || field.type === "instructions" || field.type === "statement") {
    drawWrappedText({ page, text: field.label || "", font, size: field.type === "heading" ? 12 : 10, x, y, width, color: rgb(0, 0, 0) });
    return;
  }
  drawField({ form, font, page, field, value, x, y, width });
}

/**
 * Generates a brand-new fillable PDF from a workbook config + its student
 * data — the designer never has to supply or design a PDF template
 * themselves. Returns the PDF bytes (Uint8Array), with real, fillable
 * AcroForm fields and actual embedded images (falling back to a text
 * placeholder per-image if it can't be fetched).
 */
export async function exportWorkbookPdf(config, data) {
  const worksheetsData = (data && data.worksheets) || {};

  const pdfDoc = await PDFDocument.create();
  const { font, boldFont } = await embedPoppins(pdfDoc);
  const form = pdfDoc.getForm();
  const { embedded: embeddedImages, errors: imageErrors } = await embedImageFields(pdfDoc, config);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(height) {
    if (y - height < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  if (config.title) {
    ensureSpace(24);
    page.drawText(config.title, { x: MARGIN, y, size: 18, font: boldFont });
    y -= 30;
  }

  for (const worksheet of config.worksheets || []) {
    if (worksheet.title) {
      ensureSpace(22);
      page.drawText(worksheet.title, { x: MARGIN, y, size: 14, font: boldFont });
      y -= 24;
    }

    const wsValues = worksheetsData[worksheet.id] || {};

    for (const section of worksheet.sections || []) {
      ensureSpace(18);
      if (section.title) {
        page.drawText(section.title, { x: MARGIN, y, size: 12, font: boldFont });
        y -= 20;
      }

      const columnCount = section.columns || 1;
      const fields = section.fields || [];
      const colWidth = (CONTENT_WIDTH - GAP * (columnCount - 1)) / columnCount;

      // Same stable, explicit-`field.column`-based grouping the Builder and
      // Runtime use — not a row-major slice of the flat field list, which
      // would ignore where the designer actually placed each question.
      const columnGroups = groupByColumn(fields, columnCount, (field) => field.column);

      const columnHeights = columnGroups.map((col) =>
        col.reduce((sum, { item }) => sum + fieldRowHeight(item, embeddedImages, font, colWidth, imageErrors) + GAP, 0)
      );
      const maxColumnHeight = Math.max(0, ...columnHeights);
      ensureSpace(maxColumnHeight);

      const sectionStartY = y;
      let lowestY = sectionStartY;

      columnGroups.forEach((column, colIndex) => {
        let colY = sectionStartY;
        const x = MARGIN + colIndex * (colWidth + GAP);

        for (const { item: field } of column) {
          drawFieldOrPlaceholder({
            form,
            font,
            page,
            field,
            value: wsValues[field.id],
            x,
            y: colY,
            width: colWidth,
            embeddedImages,
            imageErrors,
          });
          colY -= fieldRowHeight(field, embeddedImages, font, colWidth, imageErrors) + GAP;
        }

        lowestY = Math.min(lowestY, colY);
      });

      // A multi-column section gets a real border + column dividers, so it
      // actually reads as a table instead of just floating groups of
      // fields separated by whitespace.
      if (columnCount > 1) {
        const gridColor = rgb(0.82, 0.84, 0.87);
        page.drawRectangle({
          x: MARGIN,
          y: lowestY,
          width: CONTENT_WIDTH,
          height: sectionStartY - lowestY,
          borderColor: gridColor,
          borderWidth: 1,
        });
        for (let colIndex = 1; colIndex < columnCount; colIndex++) {
          const dividerX = MARGIN + colIndex * (colWidth + GAP) - GAP / 2;
          page.drawLine({
            start: { x: dividerX, y: sectionStartY },
            end: { x: dividerX, y: lowestY },
            color: gridColor,
            thickness: 1,
          });
        }
      }

      y = lowestY;
    }
  }

  return pdfDoc.save();
}
