import { sanitizeContent } from "../fields/content.js";
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
// Matches the Runtime's .wb-column padding (1.1em ~= 16px) and its red
// required-marker color (--wb-danger: #b42318) — a bordered multi-column
// section should read like the on-screen table, not fields flush against
// the divider lines with no breathing room.
const COLUMN_PADDING = 14;
const REQUIRED_COLOR = rgb(0.706, 0.137, 0.094);
// Vertical breathing room after a section's content, before the next
// section's banner starts — without this, one section's fields sit flush
// against the next section's title with no separation at all.
const SECTION_GAP = 20;

// A collapsible section's title is a colored banner on screen (the host
// LMS's own ".content-summary" class), not plain text — matching that in
// the PDF using the exact colors from the host's own uploaded stylesheet
// (builder/savanna-styles-FIT.css: --color-secondary, --color-accent,
// --color-light), not invented ones. pdf-lib has no native gradient fill,
// so this approximates the CSS's left-to-right gradient by painting many
// thin adjacent rectangles with linearly interpolated color.
const COLLAPSIBLE_BANNER_HEIGHT = 26;
const COLLAPSIBLE_BANNER_FROM = { r: 0x42 / 255, g: 0x78 / 255, b: 0xec / 255 }; // --color-secondary
const COLLAPSIBLE_BANNER_TO = { r: 0xdf / 255, g: 0x8c / 255, b: 0xbb / 255 }; // --color-accent
const COLLAPSIBLE_BANNER_TEXT_COLOR = rgb(1, 1, 1); // --color-light

function drawCollapsibleBanner({ page, text, font, x, y, width, height }) {
  const steps = 60;
  const stepWidth = width / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const color = rgb(
      COLLAPSIBLE_BANNER_FROM.r + t * (COLLAPSIBLE_BANNER_TO.r - COLLAPSIBLE_BANNER_FROM.r),
      COLLAPSIBLE_BANNER_FROM.g + t * (COLLAPSIBLE_BANNER_TO.g - COLLAPSIBLE_BANNER_FROM.g),
      COLLAPSIBLE_BANNER_FROM.b + t * (COLLAPSIBLE_BANNER_TO.b - COLLAPSIBLE_BANNER_FROM.b)
    );
    page.drawRectangle({ x: x + i * stepWidth, y: y - height, width: stepWidth + 0.5, height, color });
  }
  const size = 12;
  page.drawText(text, { x: x + 12, y: y - height / 2 - size / 2 + 3, size, font, color: COLLAPSIBLE_BANNER_TEXT_COLOR });
}

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

  async function embedImage(key, src) {
    try {
      const normalizedSrc = normalizeImageSrc(src);
      const { bytes, contentType } = await loadImageBytes(normalizedSrc);
      const isPng = contentType.includes("png") || /^data:image\/png/i.test(normalizedSrc) || /\.png(\?|$)/i.test(normalizedSrc);
      const isJpg =
        contentType.includes("jpeg") ||
        contentType.includes("jpg") ||
        /^data:image\/jpe?g/i.test(normalizedSrc) ||
        /\.jpe?g(\?|$)/i.test(normalizedSrc);
      if (!isPng && !isJpg) {
        throw new Error(`unsupported image type (only PNG/JPEG can be embedded)${contentType ? `, got "${contentType}"` : ""}`);
      }
      const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      embedded.set(key, image);
    } catch (err) {
      embedded.set(key, null);
      const reason =
        err instanceof TypeError
          ? "the image's host blocked this from reading it (a cross-origin restriction on their end)"
          : err.message;
      errors.set(key, reason);
    }
  }

  for (const worksheet of config.worksheets || []) {
    for (const section of worksheet.sections || []) {
      for (const field of section.fields || []) {
        if (field.type === "image" && field.src) {
          jobs.push(embedImage(field.id, field.src));
        }
        if (field.type === "content") {
          contentEntries(field).forEach((entry) => {
            if (entry.type === "image" && entry.src) jobs.push(embedImage(entry.key, entry.src));
          });
        }
      }
    }
  }

  await Promise.all(jobs);
  return { embedded, errors };
}

function normalizeImageSrc(src) {
  return String(src || "").replace(/^\/(data:image\/)/i, "$1");
}

async function loadImageBytes(src) {
  if (/^data:image\//i.test(src)) {
    const match = src.match(/^data:([^;,]+)(;base64)?,(.*)$/i);
    if (!match) throw new Error("invalid data image URL");
    const contentType = match[1].toLowerCase();
    if (match[2]) {
      const data = match[3].replace(/\s/g, "");
      let binary;
      try {
        binary = atob(data);
      } catch {
        if (typeof Buffer === "undefined") throw new Error("invalid base64 image data");
        binary = Buffer.from(data, "base64").toString("binary");
      }
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { bytes, contentType };
    }
    const data = decodeURIComponent(match[3]);
    return { bytes: new TextEncoder().encode(data), contentType };
  }

  const res = await fetch(src);
  if (!res.ok) throw new Error(`server returned ${res.status} ${res.statusText || ""}`.trim());
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    contentType: (res.headers.get("content-type") || "").toLowerCase(),
  };
}

/** Scales an embedded image to fit within `maxWidth`, capped at MAX_IMAGE_HEIGHT. */
function scaledImageSize(image, maxWidth) {
  const ratio = Math.min(maxWidth / image.width, MAX_IMAGE_HEIGHT / image.height, 1);
  return { width: image.width * ratio, height: image.height * ratio };
}

function scaledContentImageSize(image, maxWidth, widthRatio = 1) {
  const constrainedRatio = Math.min(Math.max(Number(widthRatio) || 1, 0.05), 1);
  const targetWidth = maxWidth * constrainedRatio;
  const ratio = Math.min(targetWidth / image.width, MAX_IMAGE_HEIGHT / image.height, 1);
  return { width: image.width * ratio, height: image.height * ratio };
}

function alignedContentX(x, availableWidth, renderedWidth, align) {
  if (align === "right") return x + availableWidth - renderedWidth;
  if (align === "center") return x + (availableWidth - renderedWidth) / 2;
  return x;
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

function checklistItemContent(field, index) {
  const plain = document.createElement("div");
  plain.textContent = field.options[index];
  return { id: `${field.id}-item-${index}`, html: field.optionsHtml?.[index] || plain.innerHTML.replace(/\n/g, "<br>") };
}

function checklistRowHeights(field, font, boldFont, width) {
  return (field.options || []).map((_, index) => Math.max(22,
    contentHeight(checklistItemContent(field, index), new Map(), { font, boldFont: boldFont || font }, width - 36, new Map()) + 8));
}

function fieldRowHeight(field, embeddedImages, font, width, imageErrors, boldFont) {
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
  if (field.type === "content") {
    return contentHeight(field, embeddedImages, { font, boldFont: boldFont || font }, width, imageErrors);
  }
  if (field.type === "rich-text") {
    const labelLines = wrapText(field.label, boldFont || font, 10, width).length;
    const labelHeight = (labelLines - 1) * LINE_HEIGHT;
    return 110 + labelHeight;
  }
  if (field.type === "heading" || field.type === "instructions" || field.type === "statement") {
    const labelFont = field.type === "heading" ? boldFont || font : font;
    const lines = wrapText(field.label, labelFont, field.type === "heading" ? 12 : 10, width);
    return lines.length * LINE_HEIGHT + 8;
  }
  // Every other field draws a wrapped label above its widget — reserve
  // space for however many lines that label actually needs. Measured with
  // the bold font it's actually drawn in, since bold glyphs are wider and
  // can wrap a line earlier than the regular font would.
  const labelLines = wrapText(field.label, boldFont || font, 10, width).length;
  const labelHeight = (labelLines - 1) * LINE_HEIGHT;

  if (field.type === "long-text") return 90 + labelHeight;
  if (field.type === "radio" || field.type === "checkbox-group") {
    const count = (field.options || []).length || 1;
    return 20 + count * 16 + labelHeight;
  }
  if (field.type === "checklist") {
    // Must match the space the "checklist" case in drawField() actually
    // consumes: the progress line/bar (20), the card's own top/bottom
    // padding (8 each), and each row's height (22).
    return 40 + 8 * 2 + checklistRowHeights(field, font, boldFont, width).reduce((sum, height) => sum + height, 0) + labelHeight;
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

function drawFieldLabel({ page, field, boldFont, x, y, width }) {
  const size = 10;
  const lines = wrapText(field.label || "", boldFont, size, width);
  let lineY = y;
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: lineY, size, font: boldFont, color: rgb(0, 0, 0) });
    if (field.required && index === lines.length - 1) {
      const lineWidth = boldFont.widthOfTextAtSize(line, size);
      page.drawText(" *", { x: x + lineWidth, y: lineY, size, font: boldFont, color: REQUIRED_COLOR });
    }
    lineY -= LINE_HEIGHT;
  });
  return lineY;
}

function contentImageKey(fieldId, index) {
  return `${fieldId}__content_image__${index}`;
}

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre", "td", "th"]);
const SIZE_BY_TAG = { h1: 18, h2: 16, h3: 14, h4: 12, h5: 11, h6: 10 };

function parseCssColor(value) {
  const color = String(value || "").trim();
  const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) return rgb(Number(rgbMatch[1]) / 255, Number(rgbMatch[2]) / 255, Number(rgbMatch[3]) / 255);
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1].length === 3 ? hexMatch[1].split("").map((c) => c + c).join("") : hexMatch[1];
    return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  }
  return null;
}

function styleForElement(node, inherited = {}) {
  const tag = node.tagName ? node.tagName.toLowerCase() : "";
  const fontWeight = inlineStyleValue(node, "font-weight");
  const fontStyle = inlineStyleValue(node, "font-style");
  const textDecoration = `${inlineStyleValue(node, "text-decoration")} ${inlineStyleValue(node, "text-decoration-line")}`;
  const fontSize = parseFloat(inlineStyleValue(node, "font-size"));
  const color = parseCssColor(inlineStyleValue(node, "color"));
  return {
    ...inherited,
    bold: inherited.bold || ["strong", "b", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag) || fontWeight === "bold" || Number(fontWeight) >= 600,
    italic: inherited.italic || tag === "em" || tag === "i" || fontStyle === "italic",
    underline: inherited.underline || tag === "u" || textDecoration.includes("underline"),
    strike: inherited.strike || tag === "s" || tag === "strike" || tag === "del" || textDecoration.includes("line-through"),
    muted: inherited.muted || tag === "figcaption",
    size: Number.isFinite(fontSize) ? Math.min(Math.max(fontSize * 0.75, 7), 24) : SIZE_BY_TAG[tag] || inherited.size || 10,
    color: color || inherited.color || null,
  };
}

function textAlignForNode(node) {
  const align = inlineStyleValue(node, "text-align");
  if (["center", "right", "left"].includes(align)) return align;
  return "left";
}

function collectTextRuns(node, inherited = {}) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.replace(/\s+/g, " ");
    return text ? [{ text, ...inherited }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return [{ text: "\n", ...inherited }];
  const style = styleForElement(node, inherited);
  const runs = [];
  if (tag === "li") runs.push({ text: "• ", ...style });
  node.childNodes.forEach((child) => runs.push(...collectTextRuns(child, style)));
  if (tag === "td" || tag === "th") runs.push({ text: "  ", ...style });
  return runs;
}

function textEntryForNode(node) {
  const tag = node.tagName ? node.tagName.toLowerCase() : "";
  const runs = collectTextRuns(node, styleForElement(node, {})).filter((run) => run.text !== "");
  const normalizedRuns = [];
  for (const run of runs) {
    const text = run.text.replace(/\s+/g, " ");
    if (!text) continue;
    normalizedRuns.push({ ...run, text });
  }
  const hasText = normalizedRuns.some((run) => run.text.trim());
  return hasText ? { type: "text", runs: normalizedRuns, align: textAlignForNode(node), muted: tag === "figcaption" } : null;
}

function parsePercent(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const ratio = Number(match[1]) / 100;
  return Number.isFinite(ratio) && ratio > 0 ? Math.min(ratio, 1) : null;
}

function inlineStyleValue(node, property) {
  const style = node?.getAttribute?.("style") || "";
  const rule = style.split(";").find((part) => part.trim().toLowerCase().startsWith(`${property.toLowerCase()}:`));
  return rule ? rule.split(":").slice(1).join(":").trim() : "";
}

function imageLayoutForNode(img) {
  const figure = img.closest?.("figure");
  const component = img.closest?.(".se-component");
  const align =
    img.getAttribute("data-align") ||
    (component?.classList.contains("__se__float-center") ? "center" : "") ||
    (component?.classList.contains("__se__float-right") ? "right" : "") ||
    (component?.classList.contains("__se__float-left") ? "left" : "") ||
    inlineStyleValue(component, "text-align") ||
    inlineStyleValue(figure, "text-align") ||
    "left";
  const widthRatio =
    parsePercent(img.getAttribute("data-percentage")) ||
    parsePercent(img.getAttribute("data-size")) ||
    parsePercent(inlineStyleValue(figure, "width")) ||
    parsePercent(inlineStyleValue(component, "width")) ||
    parsePercent(inlineStyleValue(img, "width")) ||
    1;
  return { align: ["center", "right", "left"].includes(align) ? align : "left", widthRatio };
}

export function contentEntries(field) {
  const host = document.createElement("div");
  host.innerHTML = sanitizeContent(field.html);
  const entries = [];
  let imageIndex = 0;

  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) entries.push({ type: "text", runs: [{ text, bold: false, italic: false, underline: false, strike: false, size: 10, color: null }], align: "left" });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      entries.push({ type: "image", src, alt: node.getAttribute("alt") || "", key: contentImageKey(field.id, imageIndex++), ...imageLayoutForNode(node) });
      return;
    }
    if (tag === "figure") {
      const img = node.querySelector("img");
      if (img) {
        const src = img.getAttribute("src") || "";
        entries.push({ type: "image", src, alt: img.getAttribute("alt") || "", key: contentImageKey(field.id, imageIndex++), ...imageLayoutForNode(img) });
      }
      const caption = node.querySelector("figcaption");
      if (caption?.textContent.trim()) {
        const captionEntry = textEntryForNode(caption);
        if (captionEntry) entries.push({ ...captionEntry, muted: true });
      }
      return;
    }

    if (node.querySelector("img,figure")) {
      Array.from(node.childNodes).forEach(visit);
      return;
    }

    const textEntry = textEntryForNode(node);
    if (textEntry) entries.push(textEntry);
  }

  const children = Array.from(host.childNodes);
  if (children.length === 0 && host.textContent.trim()) entries.push({ type: "text", runs: [{ text: host.textContent.trim(), bold: false, italic: false, underline: false, strike: false, size: 10, color: null }], align: "left" });
  children.forEach(visit);
  return entries;
}

function fontForRun(run, fonts) {
  return run.bold ? fonts.boldFont : fonts.font;
}

function runColor(run) {
  return run.muted ? rgb(0.4, 0.4, 0.4) : run.color || rgb(0, 0, 0);
}

function splitRunWords(run) {
  const parts = String(run.text || "").split(/(\n|\s+)/).filter((part) => part !== "");
  return parts.map((text) => ({ ...run, text }));
}

function layoutRichText(runs, fonts, maxWidth) {
  const lines = [];
  let current = [];
  let width = 0;
  function pushLine() {
    lines.push({ runs: current, width });
    current = [];
    width = 0;
  }
  for (const run of runs.flatMap(splitRunWords)) {
    if (run.text === "\n") {
      pushLine();
      continue;
    }
    const font = fontForRun(run, fonts);
    const runWidth = font.widthOfTextAtSize(run.text, run.size || 10);
    if (run.text.trim() && width > 0 && width + runWidth > maxWidth) pushLine();
    current.push(run);
    width += runWidth;
  }
  if (current.length || lines.length === 0) pushLine();
  return lines;
}

function richTextHeight(entry, fonts, width) {
  const lines = layoutRichText(entry.runs || [], fonts, width);
  return lines.reduce((total, line) => total + Math.max(LINE_HEIGHT, ...line.runs.map((run) => (run.size || 10) + 3)), 0) + 4;
}

function drawRichText({ page, entry, fonts, x, y, width }) {
  const lines = layoutRichText(entry.runs || [], fonts, width);
  let cursorY = y;
  for (const line of lines) {
    let cursorX = alignedContentX(x, width, line.width, entry.align);
    const lineHeight = Math.max(LINE_HEIGHT, ...line.runs.map((run) => (run.size || 10) + 3));
    for (const run of line.runs) {
      const font = fontForRun(run, fonts);
      const size = run.size || 10;
      const text = run.text;
      const textWidth = font.widthOfTextAtSize(text, size);
      if (text) {
        page.drawText(text, { x: cursorX, y: cursorY, size, font, color: runColor(run) });
        if (run.underline) {
          page.drawLine({ start: { x: cursorX, y: cursorY - 1.5 }, end: { x: cursorX + textWidth, y: cursorY - 1.5 }, thickness: 0.6, color: runColor(run) });
        }
        if (run.strike) {
          page.drawLine({ start: { x: cursorX, y: cursorY + size * 0.32 }, end: { x: cursorX + textWidth, y: cursorY + size * 0.32 }, thickness: 0.6, color: runColor(run) });
        }
      }
      cursorX += textWidth;
    }
    cursorY -= lineHeight;
  }
  return cursorY - 4;
}

function contentHeight(field, embeddedImages, fonts, width, imageErrors) {
  const entries = contentEntries(field);
  if (entries.length === 0) return LINE_HEIGHT;
  return entries.reduce((total, entry) => {
    if (entry.type === "image") {
      const image = embeddedImages?.get(entry.key);
      if (image) return total + scaledContentImageSize(image, width, entry.widthRatio).height + GAP;
      const reason = imageErrors?.get(entry.key);
      const text = `[image not embedded${reason ? `: ${reason}` : entry.alt ? `: ${entry.alt}` : ""}]`;
      return total + wrapText(text, fonts.font, 8, width).length * LINE_HEIGHT + GAP;
    }
    return total + richTextHeight(entry, fonts, width);
  }, 4);
}

function drawContent({ page, field, embeddedImages, imageErrors, fonts, x, y, width }) {
  let cursorY = y;
  for (const entry of contentEntries(field)) {
    if (entry.type === "image") {
      const image = embeddedImages?.get(entry.key);
      if (image) {
        const { width: w, height: h } = scaledContentImageSize(image, width, entry.widthRatio);
        page.drawImage(image, { x: alignedContentX(x, width, w, entry.align), y: cursorY - h, width: w, height: h });
        cursorY -= h + GAP;
      } else {
        const reason = imageErrors?.get(entry.key);
        const text = `[image not embedded${reason ? `: ${reason}` : entry.alt ? `: ${entry.alt}` : ""}]`;
        cursorY = drawWrappedText({ page, text, font: fonts.font, size: 8, x, y: cursorY, width, color: rgb(0.55, 0.15, 0.15) }) - 4;
      }
      continue;
    }

    cursorY = drawRichText({ page, entry, fonts, x, y: cursorY, width });
  }
}

function drawField({ form, font, boldFont, page, field, value, x, y, width }) {
  const labelBottomY = drawFieldLabel({ page, field, boldFont, x, y, width });
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

    case "rich-text": {
      if (value) {
        drawContent({ page, field: { ...field, type: "content", html: String(value) }, embeddedImages: new Map(), imageErrors: new Map(), fonts: { font, boldFont }, x, y: widgetY - 4, width });
      } else {
        page.drawRectangle({ x, y: widgetY - 84, width, height: 88, borderColor: rgb(0.82, 0.84, 0.87), borderWidth: 1 });
        page.drawText("Rich text response", { x: x + 8, y: widgetY - 16, size: 9, font, color: rgb(0.42, 0.45, 0.5) });
      }
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

    case "checklist": {
      // The grayscale "card" look this has on screen — a bordered list,
      // a static "X of N done" count, and struck-through checked items —
      // reproduced here so the PDF matches, not just a bare checkbox list
      // like checkbox-group. Interactivity (re-checking, the reset
      // button) can't exist in a PDF, so this only reflects whatever was
      // already checked at export time.
      const options = field.options || [];
      const selected = new Set(Array.isArray(value) ? value : []);
      const doneCount = options.filter((option) => selected.has(option)).length;
      const mutedColor = rgb(0.42, 0.45, 0.5);
      const gridColor = rgb(0.82, 0.84, 0.87);

      const progressText = `${doneCount} of ${options.length} done`;
      page.drawText(progressText, {
        x,
        y: widgetY,
        size: 9,
        font: boldFont || font,
        color: mutedColor,
      });
      const barY = widgetY - 8;
      const barWidth = Math.min(width, 160);
      page.drawRectangle({ x, y: barY, width: barWidth, height: 4, color: rgb(0.9, 0.91, 0.93) });
      if (options.length > 0 && doneCount > 0) {
        page.drawRectangle({ x, y: barY, width: barWidth * (doneCount / options.length), height: 4, color: rgb(0.25, 0.27, 0.31) });
      }

      const cardPad = 8;
      // ROW_HEIGHT must leave real clearance below the checkbox/text (which
      // sit near the TOP of each row) before the next row's divider line —
      // the previous values (row height 18, checkbox/text ~19-20 below the
      // row's own top) put the divider line inside the checkbox and
      // crossing straight through the text above it.
      const rowHeights = checklistRowHeights(field, font, boldFont, width);
      const cardTopY = widgetY - 20;
      const cardHeight = rowHeights.reduce((sum, height) => sum + height, 0) + cardPad * 2;
      const cardBottomY = cardTopY - cardHeight;

      page.drawRectangle({
        x,
        y: cardBottomY,
        width,
        height: cardHeight,
        borderColor: gridColor,
        borderWidth: 1,
      });

      let rowTopY = cardTopY - cardPad;
      options.forEach((option, index) => {
        const isChecked = selected.has(option);
        const cb = form.createCheckBox(`${field.id}__opt__${index}`);
        cb.addToPage(page, { x: x + 8, y: rowTopY - 16, width: 12, height: 12 });
        if (isChecked) cb.check();

        // No strikethrough here: it's fixed artwork drawn once at export
        // time, but the checkbox right next to it is a real, live,
        // interactive PDF form field — someone can check/uncheck it inside
        // the PDF itself, and that drawn line can never follow along. A
        // static decoration that visibly desyncs from the interactive
        // field beside it is worse than just leaving it off.
        const textX = x + 28;
        const textY = rowTopY - 13;
        drawContent({ page, field: checklistItemContent(field, index), embeddedImages: new Map(), imageErrors: new Map(), fonts: { font, boldFont }, x: textX, y: textY, width: width - 36 });
        if (index > 0) {
          page.drawLine({
            start: { x, y: rowTopY },
            end: { x: x + width, y: rowTopY },
            thickness: 0.5,
            color: gridColor,
          });
        }
        rowTopY -= rowHeights[index];
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
function drawFieldOrPlaceholder({ form, font, boldFont, page, field, value, x, y, width, embeddedImages, imageErrors }) {
  if (field.type === "content") {
    drawContent({ page, field, embeddedImages, imageErrors, fonts: { font, boldFont }, x, y, width });
    return;
  }
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
    // .wb-heading is bold in the Runtime CSS; instructions/statement text is not.
    const labelFont = field.type === "heading" ? boldFont : font;
    drawWrappedText({ page, text: field.label || "", font: labelFont, size: field.type === "heading" ? 12 : 10, x, y, width, color: rgb(0, 0, 0) });
    return;
  }
  drawField({ form, font, boldFont, page, field, value, x, y, width });
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

  (config.worksheets || []).forEach((worksheet, worksheetIndex) => {
    // Each worksheet is its own tab on screen — fully separated. Cramming
    // them together on the same PDF page (previous worksheet's last field
    // directly against the next worksheet's heading, no visual break) read
    // as cluttered; a fresh page per worksheet gives them the same real
    // separation here.
    if (worksheetIndex > 0) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    if (worksheet.title) {
      ensureSpace(22);
      page.drawText(worksheet.title, { x: MARGIN, y, size: 14, font: boldFont });
      y -= 24;
    }

    const wsValues = worksheetsData[worksheet.id] || {};

    for (const section of worksheet.sections || []) {
      const columnCount = section.columns || 1;
      const fields = section.fields || [];
      const colWidth = (CONTENT_WIDTH - GAP * (columnCount - 1)) / columnCount;
      // A bordered multi-column table needs its own inset so fields don't
      // sit flush against the divider lines/outer border — a single-column
      // section has no border to breathe away from, so it stays unpadded.
      const padX = columnCount > 1 ? COLUMN_PADDING : 0;
      const padTop = columnCount > 1 ? COLUMN_PADDING : 0;
      const padBottom = columnCount > 1 ? COLUMN_PADDING : 0;
      const innerWidth = colWidth - padX * 2;

      // Same stable, explicit-`field.column`-based grouping the Builder and
      // Runtime use — not a row-major slice of the flat field list, which
      // would ignore where the designer actually placed each question.
      const columnGroups = groupByColumn(fields, columnCount, (field) => field.column);

      const columnHeights = columnGroups.map((col) =>
        col.reduce((sum, { item }) => sum + fieldRowHeight(item, embeddedImages, font, innerWidth, imageErrors, boldFont) + GAP, 0)
      );
      const maxColumnHeight = Math.max(0, ...columnHeights) + padTop + padBottom;
      const bannerHeight = section.title ? COLLAPSIBLE_BANNER_HEIGHT + 12 : 0;
      ensureSpace(bannerHeight + maxColumnHeight);

      // Every titled section is the collapsible banner element now, not a
      // per-section choice. Reserve the banner together with the section
      // body so a banner is not stranded at the bottom of the previous page.
      if (section.title) {
        drawCollapsibleBanner({ page, text: section.title, font: boldFont, x: MARGIN, y, width: CONTENT_WIDTH, height: COLLAPSIBLE_BANNER_HEIGHT });
        y -= bannerHeight;
      }

      const sectionStartY = y;
      let lowestY = sectionStartY;

      columnGroups.forEach((column, colIndex) => {
        let colY = sectionStartY - padTop;
        const x = MARGIN + colIndex * (colWidth + GAP) + padX;

        for (const { item: field } of column) {
          drawFieldOrPlaceholder({
            form,
            font,
            boldFont,
            page,
            field,
            value: wsValues[field.id],
            x,
            y: colY,
            width: innerWidth,
            embeddedImages,
            imageErrors,
          });
          colY -= fieldRowHeight(field, embeddedImages, font, innerWidth, imageErrors, boldFont) + GAP;
        }

        lowestY = Math.min(lowestY, colY - padBottom);
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
            dashArray: [1, 2],
          });
        }
      }

      y = lowestY - SECTION_GAP;
    }
  });

  // Without this, some PDF viewers render certain checkboxes' checked
  // state inconsistently (a well-known pdf-lib quirk) — the field's real
  // value is correct, but the viewer's own default appearance stream
  // doesn't reliably reflect it unless every field's appearance is
  // explicitly regenerated once, right before saving.
  form.updateFieldAppearances(font);

  return pdfDoc.save();
}
