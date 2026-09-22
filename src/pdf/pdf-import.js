import { PDFDocument } from "../vendor/pdf-lib.esm.js";
import { listWorkbookFields } from "./field-matcher.js";

const CHECKBOX_GROUP_OPT_RE = /^(.*)__opt__(\d+)$/;

function readFieldValue(form, pdfFieldName) {
  const field = form.getFieldMaybe ? form.getFieldMaybe(pdfFieldName) : safeGetField(form, pdfFieldName);
  if (!field) return undefined;
  const ctor = field.constructor.name;
  if (ctor === "PDFTextField") return field.getText() || "";
  if (ctor === "PDFCheckBox") return field.isChecked();
  if (ctor === "PDFDropdown") {
    const selected = field.getSelected();
    return selected && selected.length ? selected[0] : "";
  }
  if (ctor === "PDFRadioGroup") return field.getSelected() || null;
  return undefined;
}

function safeGetField(form, name) {
  try {
    return form.getField(name);
  } catch {
    return null;
  }
}

function isBlank(value) {
  return value == null || value === "" || value === false;
}

/**
 * Reads a filled PDF and merges its non-blank answers into `existingData`
 * (the student's current in-browser workbook data). Never regenerates HTML —
 * this only produces the merged data object; the caller applies it to the
 * already-rendered form and persists it via the normal storage layer.
 *
 * Returns { data, matchedCount, unmatchedInPdf, unmatchedInWorkbook }.
 */
export async function importWorkbookPdf(config, pdfBytes, existingData = {}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const pdfFields = form.getFields();
  const pdfFieldNames = pdfFields.map((f) => f.getName());

  const mergedWorksheets = { ...(existingData.worksheets || {}) };
  const workbookFields = listWorkbookFields(config);
  const workbookFieldById = new Map(workbookFields.map((f) => [f.fieldId, f]));

  let matchedCount = 0;
  const matchedIds = new Set();
  const checkboxGroupSelections = new Map(); // fieldId -> Set(optionIndex checked)

  for (const pdfFieldName of pdfFieldNames) {
    const groupMatch = pdfFieldName.match(CHECKBOX_GROUP_OPT_RE);
    if (groupMatch) {
      const [, fieldId, indexStr] = groupMatch;
      const entry = workbookFieldById.get(fieldId);
      if (!entry || (entry.field.type !== "checkbox-group" && entry.field.type !== "checklist")) continue;
      const checked = readFieldValue(form, pdfFieldName);
      if (checked) {
        if (!checkboxGroupSelections.has(fieldId)) checkboxGroupSelections.set(fieldId, new Set());
        checkboxGroupSelections.get(fieldId).add(Number(indexStr));
      }
      continue;
    }

    const entry = workbookFieldById.get(pdfFieldName);
    if (!entry) continue;
    const value = readFieldValue(form, pdfFieldName);
    if (isBlank(value)) continue;

    if (!mergedWorksheets[entry.worksheetId]) mergedWorksheets[entry.worksheetId] = {};
    mergedWorksheets[entry.worksheetId][entry.fieldId] = value;
    matchedIds.add(entry.fieldId);
    matchedCount += 1;
  }

  for (const [fieldId, indices] of checkboxGroupSelections) {
    const entry = workbookFieldById.get(fieldId);
    const options = entry.field.options || [];
    const values = [...indices].sort((a, b) => a - b).map((i) => options[i]).filter(Boolean);
    if (values.length === 0) continue;
    if (!mergedWorksheets[entry.worksheetId]) mergedWorksheets[entry.worksheetId] = {};
    mergedWorksheets[entry.worksheetId][fieldId] = values;
    matchedIds.add(fieldId);
    matchedCount += 1;
  }

  const unmatchedInWorkbook = workbookFields.filter((f) => !matchedIds.has(f.fieldId));
  const knownPdfNames = new Set([
    ...workbookFieldById.keys(),
    ...[...checkboxGroupSelections.keys()].flatMap((fieldId) => {
      const entry = workbookFieldById.get(fieldId);
      return (entry.field.options || []).map((_, i) => `${fieldId}__opt__${i}`);
    }),
  ]);
  const unmatchedInPdf = pdfFieldNames.filter((name) => !knownPdfNames.has(name) && !CHECKBOX_GROUP_OPT_RE.test(name));

  return {
    data: {
      workbookId: config.id,
      version: 1,
      updatedAt: new Date().toISOString(),
      worksheets: mergedWorksheets,
    },
    matchedCount,
    unmatchedInPdf,
    unmatchedInWorkbook,
  };
}
