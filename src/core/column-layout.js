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

/**
 * Like `groupByColumn`, but first splits items into independent "layout
 * blocks" (each with its own column count), so a single section can mix
 * column counts — e.g. a full-width intro row followed by a two-column
 * block — the same way stacking separate standalone sections already lets
 * no-section questions do.
 *
 * `blockColumnCounts` is an ordered list, one entry per block, giving that
 * block's column count. `getBlock(item)` returns the item's stored block
 * index (0-based); missing/invalid values default to block 0, and a value
 * beyond the list clamps to the last block (mirroring `groupByColumn`'s own
 * out-of-range handling).
 *
 * Returns an array of `{ columnCount, columns }`, one per block in order;
 * `columns` has the same shape `groupByColumn` returns, with each entry's
 * `index` remapped back to the item's position in the original flat
 * `items` list (not the per-block subset) so callers that splice into that
 * flat array (e.g. the Builder) keep working unchanged.
 */
export function groupByBlockThenColumn(items, blockColumnCounts, getBlock, getColumn) {
  const blockCount = Math.max(blockColumnCounts.length || 1, 1);
  const blocks = Array.from({ length: blockCount }, () => []);

  items.forEach((item, index) => {
    const raw = getBlock ? getBlock(item) : 0;
    const blockIndex = Math.min(Math.max(Number.isInteger(raw) ? raw : 0, 0), blockCount - 1);
    blocks[blockIndex].push({ item, index });
  });

  return blocks.map((bucket, blockIndex) => {
    const columnCount = Math.max(blockColumnCounts[blockIndex] || 1, 1);
    const subColumns = groupByColumn(bucket.map((entry) => entry.item), columnCount, getColumn);
    const columns = subColumns.map((column) =>
      column.map((entry) => ({ item: entry.item, index: bucket[entry.index].index }))
    );
    return { columnCount, columns };
  });
}
