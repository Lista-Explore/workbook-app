import { PDFDocument } from "../vendor/pdf-lib.esm.js";
import { listWorkbookFields } from "./field-matcher.js";

const CHECKBOX_GROUP_OPT_RE = /^(.*)__opt__(\d+)$/;
const TABLE_CELL_RE = /^(.*)__cell__(.*)__row__(\d+)$/;
const SCALE_ROW_RE = /^(.*)__scale__(\d+)$/;
const SCOREBOARD_ROW_RE = /^(.*)__score__(\d+)$/;

function readFieldValue(form, pdfFieldName) {
  const field = form.getFieldMaybe ? form.getFieldMaybe(pdfFieldName) : safeGetField(form, pdfFieldName);
  if (!field) return undefined;
  // Detect fields by their public API rather than constructor.name. The LMS
  // runtime is bundled/minified, so constructor names are not stable there.
  if (typeof field.getText === "function") return field.getText() || "";
  if (typeof field.isChecked === "function") return field.isChecked();
  if (typeof field.getSelected === "function") {
    const selected = field.getSelected();
    if (Array.isArray(selected)) return selected.length ? selected[0] : "";
    return selected || null;
  }
  return undefined;
}

function safeGetField(form, name) {
  try {
    return form.getField(name);
  } catch {
    return null;
  }
}

function selectedChoiceForWorkbook(form, pdfFieldName, field, value) {
  if (field.type !== "radio" || typeof value !== "string") return value;
  const options = (field.options || []).map((option) => String(option));
  if (options.includes(value)) return value;

  // Some PDF readers rewrite a radio group's internal export value while
  // keeping the option order intact. Map that value back by position.
  const pdfField = form.getFieldMaybe ? form.getFieldMaybe(pdfFieldName) : safeGetField(form, pdfFieldName);
  const pdfOptions = pdfField && typeof pdfField.getOptions === "function" ? pdfField.getOptions() : [];
  const selectedIndex = pdfOptions.indexOf(value);
  return selectedIndex >= 0 ? options[selectedIndex] || null : null;
}

function readRadioValue(form, pdfFieldName, field) {
  const pdfField = pdfFieldForName(form, pdfFieldName);
  if (!pdfField) return undefined;

  // Preserve the normal AcroForm radio-group path. Native radio groups
  // expose their selected export value directly; widget inspection is only
  // needed for editors that rewrote the group as a checkbox field.
  if (typeof pdfField.getSelected === "function") {
    return pdfField.getSelected() || "";
  }

  // Some PDF editors rewrite radio groups as checkbox fields with one
  // widget per option. The selected option is stored in the widget's
  // appearance state, not in getSelected(). Recover it by widget position.
  const widgets = pdfField.acroField?.getWidgets?.() || [];
  if (field.type === "radio" && widgets.length > 1) {
    const selectedIndex = widgets.findIndex((widget) => {
      const state = widget.getAppearanceState?.();
      if (!state || state.decodeText?.() === "Off") return false;
      const onValue = widget.getOnValue?.();
      return !onValue || state.decodeText?.() === onValue.decodeText?.();
    });
    if (selectedIndex >= 0) return String(field.options?.[selectedIndex] ?? "");
  }
  return readFieldValue(form, pdfFieldName);
}

function pdfFieldForName(form, name) {
  return form.getFieldMaybe ? form.getFieldMaybe(name) : safeGetField(form, name);
}

/**
 * PDF editors sometimes replace a radio group while preserving its widgets,
 * but give the replacement a new field name. Match only radio groups and
 * only when their option list identifies one workbook radio unambiguously.
 */
function findRenamedRadioEntry(form, pdfFieldName, workbookFields, usedIds) {
  const pdfField = pdfFieldForName(form, pdfFieldName);
  if (!pdfField || typeof pdfField.getOptions !== "function") return null;
  const pdfOptions = pdfField.getOptions().map((option) => String(option));
  if (pdfOptions.length === 0) return null;

  const candidates = workbookFields.filter(({ fieldId, field }) => {
    if (usedIds.has(fieldId) || field.type !== "radio") return false;
    const options = (field.options || []).map((option) => String(option));
    const overlap = pdfOptions.filter((option) => options.includes(option)).length;
    return overlap > 0 || (pdfOptions.length === options.length && pdfOptions.length === 1);
  });
  return candidates.length === 1 ? candidates[0] : null;
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
  const matchedPdfNames = new Set();
  const checkboxGroupSelections = new Map(); // fieldId -> Set(optionIndex checked)
  const tableCellValues = new Map(); // fieldId -> { entry, rows }
  const scaleAnswers = new Map(); // fieldId -> { entry, answers[] }
  const scoreboardEntries = new Map(); // fieldId -> { entry, scores{} }

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

    const scaleMatch = pdfFieldName.match(SCALE_ROW_RE);
    if (scaleMatch) {
      const [, fieldId, indexStr] = scaleMatch;
      const scaleEntry = workbookFieldById.get(fieldId);
      if (!scaleEntry || scaleEntry.field.type !== "scale") continue;
      const picked = Number(readFieldValue(form, pdfFieldName));
      if (!Number.isFinite(picked) || readFieldValue(form, pdfFieldName) == null || readFieldValue(form, pdfFieldName) === "") continue;
      if (!scaleAnswers.has(fieldId)) scaleAnswers.set(fieldId, { entry: scaleEntry, answers: [] });
      scaleAnswers.get(fieldId).answers[Number(indexStr)] = picked;
      continue;
    }

    const scoreMatch = pdfFieldName.match(SCOREBOARD_ROW_RE);
    if (scoreMatch) {
      const [, fieldId, indexStr] = scoreMatch;
      const boardEntry = workbookFieldById.get(fieldId);
      if (!boardEntry || boardEntry.field.type !== "scoreboard") continue;
      const typed = readFieldValue(form, pdfFieldName);
      const source = boardEntry.field.rows?.[Number(indexStr)]?.source;
      if (isBlank(typed) || !source || !Number.isFinite(Number(typed))) continue;
      if (!scoreboardEntries.has(fieldId)) scoreboardEntries.set(fieldId, { entry: boardEntry, scores: {} });
      scoreboardEntries.get(fieldId).scores[source] = Number(typed);
      continue;
    }

    const tableMatch = pdfFieldName.match(TABLE_CELL_RE);
    if (tableMatch) {
      const [, fieldId, cellId, rowIndexStr] = tableMatch;
      const tableEntry = workbookFieldById.get(fieldId);
      if (!tableEntry || tableEntry.field.type !== "table") continue;
      const value = readFieldValue(form, pdfFieldName);
      if (isBlank(value)) continue;
      if (!tableCellValues.has(fieldId)) tableCellValues.set(fieldId, { entry: tableEntry, rows: [] });
      const target = tableCellValues.get(fieldId);
      const rowIndex = Number(rowIndexStr);
      if (!target.rows[rowIndex]) target.rows[rowIndex] = {};
      target.rows[rowIndex][cellId] = value;
      continue;
    }

    let entry = workbookFieldById.get(pdfFieldName);
    // A PDF editor may recreate a radio group with a different field name.
    // Use its option values as a constrained fallback, never for other field
    // types and never when the match would be ambiguous.
    if (!entry) {
      entry = findRenamedRadioEntry(form, pdfFieldName, workbookFields, matchedIds);
    }
    if (!entry) continue;
    const rawValue = entry.field.type === "radio"
      ? readRadioValue(form, pdfFieldName, entry.field)
      : readFieldValue(form, pdfFieldName);
    const value = selectedChoiceForWorkbook(form, pdfFieldName, entry.field, rawValue);
    if (isBlank(value)) continue;

    if (!mergedWorksheets[entry.worksheetId]) mergedWorksheets[entry.worksheetId] = {};
    mergedWorksheets[entry.worksheetId][entry.fieldId] = value;
    matchedIds.add(entry.fieldId);
    matchedPdfNames.add(pdfFieldName);
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

  for (const [fieldId, { entry, answers }] of scaleAnswers) {
    const count = (entry.field.statements || []).length;
    const filled = Array.from({ length: count }, (_, i) => (answers[i] == null ? null : answers[i]));
    if (!mergedWorksheets[entry.worksheetId]) mergedWorksheets[entry.worksheetId] = {};
    mergedWorksheets[entry.worksheetId][fieldId] = filled;
    matchedIds.add(fieldId);
    matchedCount += 1;
  }

  for (const [fieldId, { entry, scores }] of scoreboardEntries) {
    if (!mergedWorksheets[entry.worksheetId]) mergedWorksheets[entry.worksheetId] = {};
    mergedWorksheets[entry.worksheetId][fieldId] = scores;
    matchedIds.add(fieldId);
    matchedCount += 1;
  }

  for (const [fieldId, { entry, rows }] of tableCellValues) {
    const compactRows = rows.map((row) => row || {}).filter((row) => Object.keys(row).length > 0);
    if (compactRows.length === 0) continue;
    if (!mergedWorksheets[entry.worksheetId]) mergedWorksheets[entry.worksheetId] = {};
    mergedWorksheets[entry.worksheetId][fieldId] = compactRows;
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
  const unmatchedInPdf = pdfFieldNames.filter((name) => !matchedPdfNames.has(name) && !knownPdfNames.has(name) && !CHECKBOX_GROUP_OPT_RE.test(name) && !TABLE_CELL_RE.test(name) && !SCALE_ROW_RE.test(name) && !SCOREBOARD_ROW_RE.test(name));

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
