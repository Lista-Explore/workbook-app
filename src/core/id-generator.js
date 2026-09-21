export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

/**
 * Generates a stable id from a label and position, avoiding collisions
 * within the given set of already-used ids.
 */
export function generateId(label, index, usedIds) {
  const base = label ? slugify(label) : `item-${index}`;
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}
