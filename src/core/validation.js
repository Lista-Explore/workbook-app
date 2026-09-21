import { FieldRegistry } from "../fields/registry.js";

/**
 * Validates a full workbook data object against its config.
 * Returns an array of { worksheetId, fieldId, message } for every failing field.
 */
export function validateWorkbook(config, data) {
  const failures = [];
  const worksheetsData = (data && data.worksheets) || {};

  for (const worksheet of config.worksheets || []) {
    const wsData = worksheetsData[worksheet.id] || {};
    for (const section of worksheet.sections || []) {
      for (const field of section.fields || []) {
        const module = FieldRegistry.get(field.type);
        const result = module.validate(field, wsData[field.id]);
        if (result !== true) {
          failures.push({ worksheetId: worksheet.id, fieldId: field.id, message: result });
        }
      }
    }
  }

  return failures;
}
