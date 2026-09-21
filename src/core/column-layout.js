/**
 * Groups a flat, ordered list of items into N independent vertical column
 * stacks, using each item's own explicit column assignment (not a count
 * derived from position/total). This is what makes "column 1" and "column
 * 2" stable, actual independent stacks: adding or removing an item in one
 * column never reshuffles which column any other item appears in.
 *
 * `getColumn(item)` returns the item's stored column index (0-based);
 * missing/invalid values default to column 0. A value beyond the section's
 * current column count clamps to the last column (e.g. after a section is
 * changed from 3 columns down to 2).
 *
 * Returns an array of `columnCount` arrays, each entry `{ item, index }`
 * where `index` is the item's position in the original flat list — callers
 * that need to insert relative to the flat source array (e.g. the Builder)
 * use that index.
 */
export function groupByColumn(items, columnCount, getColumn) {
  const count = Math.max(columnCount || 1, 1);
  const columns = Array.from({ length: count }, () => []);

  items.forEach((item, index) => {
    const raw = getColumn ? getColumn(item) : 0;
    const columnIndex = Math.min(Math.max(Number.isInteger(raw) ? raw : 0, 0), count - 1);
    columns[columnIndex].push({ item, index });
  });

  return columns;
}
