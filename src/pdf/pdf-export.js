import { PDFDocument, StandardFonts, rgb } from "../vendor/pdf-lib.esm.js";
import { DISPLAY_ONLY_FIELD_TYPES } from "../fields/index.js";
import { groupByColumn } from "../core/column-layout.js";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const GAP = 10;
const MAX_IMAGE_HEIGHT = 160;

/**
 * Fetches and embeds every image field's picture into the PDF document up
 * front (embedding is async; the layout pass below is not), so drawing can
 * look up an already-embedded image by field id. A field whose image can't
 * be fetched or isn't a PNG/JPEG (the only formats pdf-lib can embed) maps
 * to `null` — draw falls back to a text placeholder for that one field
 * rather than failing the whole export.
 */
async function embedImageFields(pdfDoc, config) {
  const embedded = new Map();
  const jobs = [];

  for (const worksheet of config.worksheets || []) {
    for (const section of worksheet.sections || []) {
      for (const field of section.fields || []) {
        if (field.type !== "image" || !field.src) continue;
        jobs.push(
          (async () => {
            try {
              const res = await fetch(field.src);
              if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
              const contentType = (res.headers.get("content-type") || "").toLowerCase();
              const bytes = new Uint8Array(await res.arrayBuffer());
              const isPng = contentType.includes("png") || /\.png(\?|$)/i.test(field.src);
              const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
              embedded.set(field.id, image);
            } catch {
              embedded.set(field.id, null);
            }
          })()
        );
      }
    }
  }

  await Promise.all(jobs);
  return embedded;
}

/** Scales an embedded image to fit within `maxWidth`, capped at MAX_IMAGE_HEIGHT. */
function scaledImageSize(image, maxWidth) {
  const ratio = Math.min(maxWidth / image.width, MAX_IMAGE_HEIGHT / image.height, 1);
  return { width: image.width * ratio, height: image.height * ratio };
}

function fieldRowHeight(field, embeddedImages) {
  if (field.type === "image") {
    const image = embeddedImages?.get(field.id);
    if (image) {
      const { height } = scaledImageSize(image, CONTENT_WIDTH);
      return height + (field.caption ? 14 : 0);
    }
    return 24; // placeholder-text fallback height
  }
  if (field.type === "long-text") return 90;
  if (field.type === "heading") return 28;
  if (field.type === "instructions" || field.type === "statement") return 34;
  if (field.type === "radio" || field.type === "checkbox-group") {
    const count = (field.options || []).length || 1;
    return 20 + count * 16;
  }
  return 40;
}

/**
 * Draws a real, fillable AcroForm widget for one field at (x, y, width),
 * named exactly `field.id` (or, for checkbox-group, `${field.id}__opt__${i}`
 * per option — there is no single native PDF control for a multi-select
 * checklist). File fields are skipped: browsers cannot restore a File into
 * a template, so there is nothing meaningful to export for them.
 */
function drawField({ form, font, page, field, value, x, y, width }) {
  const labelY = y;
  page.drawText(field.label || "", { x, y: labelY, size: 10, font, color: rgb(0, 0, 0) });
  const widgetY = labelY - 16;

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
      return;
    }
  }
}

/** Draws one field — an actual embedded image when available, its display-only text, or its form widget. */
function drawFieldOrPlaceholder({ form, font, page, field, value, x, y, width, embeddedImages }) {
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
    // Fetch/embed failed (offline, unreachable URL, unsupported format) —
    // fall back to a text placeholder so the PDF isn't silently missing
    // content where an image was placed.
    const text = field.caption || field.alt || "[image]";
    page.drawText(text, { x, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    return;
  }
  if (DISPLAY_ONLY_FIELD_TYPES.has(field.type) && field.type !== "heading") {
    page.drawText(field.label || "", { x, y, size: 10, font });
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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const form = pdfDoc.getForm();
  const embeddedImages = await embedImageFields(pdfDoc, config);

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
    ensureSpace(22);
    page.drawText(worksheet.title || "", { x: MARGIN, y, size: 14, font: boldFont });
    y -= 24;

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
        col.reduce((sum, { item }) => sum + fieldRowHeight(item, embeddedImages) + GAP, 0)
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
          });
          colY -= fieldRowHeight(field, embeddedImages) + GAP;
        }

        lowestY = Math.min(lowestY, colY);
      });

      y = lowestY;
    }
  }

  return pdfDoc.save();
}
