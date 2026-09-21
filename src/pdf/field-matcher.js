/**
 * Matches a workbook's field ids to a PDF's AcroForm field names.
 * A single, clean scheme: the PDF form field name is exactly the
 * workbook field's stable id.
 */

/** Flattens the workbook config into a list of { worksheetId, fieldId, field }. */
export function listWorkbookFields(config) {
  const list = [];
  for (const worksheet of config.worksheets || []) {
    for (const section of worksheet.sections || []) {
      for (const field of section.fields || []) {
        list.push({ worksheetId: worksheet.id, fieldId: field.id, field });
      }
    }
  }
  return list;
}

/**
 * Given the workbook config and a list of PDF form field names, returns:
 *   matched:   [{ worksheetId, fieldId, field }]  — present in both
 *   unmatchedInPdf:      pdf field names with no corresponding workbook field
 *   unmatchedInWorkbook: workbook fields with no corresponding pdf field
 */
export function matchFields(config, pdfFieldNames) {
  const workbookFields = listWorkbookFields(config);
  const pdfNameSet = new Set(pdfFieldNames);
  const workbookIdSet = new Set(workbookFields.map((f) => f.fieldId));

  const matched = workbookFields.filter((f) => pdfNameSet.has(f.fieldId));
  const unmatchedInPdf = pdfFieldNames.filter((name) => !workbookIdSet.has(name));
  const unmatchedInWorkbook = workbookFields.filter((f) => !pdfNameSet.has(f.fieldId));

  return { matched, unmatchedInPdf, unmatchedInWorkbook };
}
