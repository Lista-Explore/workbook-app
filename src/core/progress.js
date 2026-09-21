import { DISPLAY_ONLY_FIELD_TYPES } from "../fields/index.js";

/**
 * Computes what fraction of required fields across the whole workbook
 * currently have an answered (non-empty) value.
 * Returns { answered, total, percent } — percent is 100 when total is 0.
 */
export function computeProgress(config, data) {
  const worksheetsData = (data && data.worksheets) || {};
  let total = 0;
  let answered = 0;

  for (const worksheet of config.worksheets || []) {
    const wsData = worksheetsData[worksheet.id] || {};
    for (const section of worksheet.sections || []) {
      for (const field of section.fields || []) {
        if (!field.required || DISPLAY_ONLY_FIELD_TYPES.has(field.type)) continue;
        total += 1;
        const value = wsData[field.id];
        const isEmpty =
          value == null ||
          value === "" ||
          value === false ||
          (Array.isArray(value) && value.length === 0);
        if (!isEmpty) answered += 1;
      }
    }
  }

  return {
    answered,
    total,
    percent: total === 0 ? 100 : Math.round((answered / total) * 100),
  };
}
