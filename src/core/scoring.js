import { FieldRegistry } from "../fields/registry.js";

/**
 * Cumulative scoring engine.
 *
 * Three field types share it:
 *   scale       — statements rated on a point scale; yields a running score.
 *   scoreboard  — adds up several scales (or checks the learner's own sums).
 *   scored-text — text whose {{tokens}} fill in from scores and answers.
 *
 * Everything here is pure: it works on a "snapshot" ({ fields: Map(id ->
 * { field, value }) }) so the exact same numbers drive the live screen
 * (snapshot read from the DOM), saved data and the PDF (snapshot built from
 * config + stored values).
 */

export const SCORING_TYPES = new Set(["scale", "scoreboard", "scored-text"]);
const SCORING_SELECTOR = ".wb-scale-table, .wb-scoreboard-table, .wb-scored-text";
const SNAPSHOT_SKIP_TYPES = new Set(["table", "file", "rich-text", "content", "image", "heading", "instructions", "statement", "password"]);

export const SCALE_PRESETS = {
  "1-5": { name: "1 to 5 (rarely true → almost always true)", labels: ["This rarely feels true for me", "This sometimes feels true for me", "This often feels true for me", "This usually feels true for me", "This almost always feels true for me"], values: [1, 2, 3, 4, 5] },
  "1-4": { name: "1 to 4 (no neutral midpoint)", labels: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"], values: [1, 2, 3, 4] },
  "1-7": { name: "1 to 7 (strongly disagree → strongly agree)", labels: ["Strongly disagree", "", "", "Neutral", "", "", "Strongly agree"], values: [1, 2, 3, 4, 5, 6, 7] },
  "1-10": { name: "1 to 10 (e.g. wheel of life)", labels: ["Not at all", "", "", "", "", "", "", "", "", "Completely"], values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  "0-3": { name: "0 to 3 (never → nearly every day)", labels: ["Not at all", "Several days", "More than half the days", "Nearly every day"], values: [0, 1, 2, 3] },
  "yes-no": { name: "Yes / No (1 point for yes)", labels: ["No", "Yes"], values: [0, 1] },
};

export function presetPoints(key) {
  const preset = SCALE_PRESETS[key] || SCALE_PRESETS["1-5"];
  return preset.values.map((value, index) => ({ value, label: preset.labels[index] || "" }));
}

/** A scale's points, always a non-empty ascending-by-position array of { value, label }. */
export function scalePoints(field) {
  const raw = Array.isArray(field?.points) ? field.points : [];
  const points = raw
    .map((point) => ({ value: Number(point?.value), label: String(point?.label ?? "") }))
    .filter((point) => Number.isFinite(point.value));
  return points.length ? points : presetPoints("1-5");
}

export function scaleStatements(field) {
  return Array.isArray(field?.statements) ? field.statements.map((s) => String(s ?? "")) : [];
}

export function normalizeBands(bands) {
  return (Array.isArray(bands) ? bands : [])
    .map((band) => ({
      min: Number(band?.min),
      max: Number(band?.max),
      label: String(band?.label ?? ""),
      text: String(band?.text ?? ""),
      tone: ["positive", "neutral", "attention"].includes(band?.tone) ? band.tone : "",
    }))
    .filter((band) => Number.isFinite(band.min) && Number.isFinite(band.max));
}

export function findBand(bands, score) {
  if (score == null || !Number.isFinite(score)) return null;
  return normalizeBands(bands).find((band) => score >= band.min && score <= band.max) || null;
}

/** Score for one rating scale: running total even when only partly answered. */
export function scoreScale(field, value) {
  const points = scalePoints(field);
  const allowed = new Set(points.map((p) => p.value));
  const low = Math.min(...allowed);
  const high = Math.max(...allowed);
  const statements = scaleStatements(field);
  const reverse = Array.isArray(field?.reverse) ? field.reverse : [];
  const answers = Array.isArray(value) ? value : [];

  let answered = 0;
  let score = 0;
  statements.forEach((_, index) => {
    const raw = answers[index];
    if (raw == null || raw === "") return;
    const v = Number(raw);
    if (!allowed.has(v)) return;
    answered += 1;
    score += reverse[index] ? low + high - v : v;
  });

  const total = statements.length;
  const max = total * high;
  const min = total * low;
  const complete = total > 0 && answered === total;
  return {
    score,
    min,
    max,
    answered,
    total,
    complete,
    percent: max > 0 ? Math.round((score / max) * 100) : 0,
    band: complete ? findBand(field?.bands, score) : null,
  };
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function areaLabel(row, source) {
  return row?.label || source?.field?.areaLabel || source?.field?.label || "Untitled area";
}

/**
 * Resolves a scoreboard against the snapshot.
 *
 * mode "auto": each row is the live score of its source scale.
 * mode "copy": the learner types each score themselves (retrieval practice —
 *   the friction is the point); each entry is checked against the real
 *   score but the answer is never handed over.
 */
export function resolveScoreboard(field, snapshot) {
  const mode = field?.mode === "copy" ? "copy" : "auto";
  const entered = snapshot.fields.get(field?.id)?.value;
  const enteredMap = entered && typeof entered === "object" && !Array.isArray(entered) ? entered : {};

  const rows = (field?.rows || []).map((row) => {
    const source = snapshot.fields.get(row.source);
    const isScale = source?.field?.type === "scale";
    const result = isScale ? scoreScale(source.field, source.value) : null;
    const label = areaLabel(row, source);
    const bands = normalizeBands(field?.bands).length ? field.bands : source?.field?.bands;

    if (mode === "copy") {
      const typed = numberOrNull(enteredMap[row.source]);
      let status = "empty";
      if (typed != null) status = !result || !result.complete ? "pending" : typed === result.score ? "match" : "mismatch";
      return {
        source: row.source, label, missingSource: !isScale, max: result?.max ?? 0, score: typed, actual: result?.complete ? result.score : null,
        complete: typed != null, answered: result?.answered ?? 0, total: result?.total ?? 0, status,
        band: typed != null && result?.complete ? findBand(bands, typed) : null,
      };
    }
    return {
      source: row.source, label, missingSource: !isScale, max: result?.max ?? 0,
      score: result && result.answered > 0 ? result.score : null, actual: result?.complete ? result.score : null,
      complete: Boolean(result?.complete), answered: result?.answered ?? 0, total: result?.total ?? 0,
      status: result?.complete ? "complete" : result?.answered ? "partial" : "empty",
      band: result?.complete ? findBand(bands, result.score) : null,
    };
  });

  const total = rows.reduce((sum, row) => sum + (row.score ?? 0), 0);
  const max = rows.reduce((sum, row) => sum + row.max, 0);
  const completeCount = rows.filter((row) => row.complete).length;
  const complete = rows.length > 0 && completeCount === rows.length;

  // Strongest / lowest compare percentages so scales of different sizes are
  // fairly ranked. Nothing is flagged until every row is in, or if all tie.
  let strongest = [];
  let lowest = [];
  if (complete && rows.length > 1) {
    const pct = (row) => (row.max > 0 ? row.score / row.max : 0);
    const top = Math.max(...rows.map(pct));
    const bottom = Math.min(...rows.map(pct));
    if (top !== bottom) {
      strongest = rows.filter((row) => pct(row) === top);
      lowest = rows.filter((row) => pct(row) === bottom);
    }
  }

  const firstSourceBands = (field?.rows || [])
    .map((row) => snapshot.fields.get(row.source)?.field?.bands)
    .find((bands) => normalizeBands(bands).length);
  const keyBands = normalizeBands(field?.bands).length ? normalizeBands(field.bands) : normalizeBands(firstSourceBands);

  return {
    mode, rows, total, max, complete, completeCount, keyBands,
    percent: max > 0 ? Math.round((total / max) * 100) : 0,
    band: complete ? findBand(field?.totalBands, total) : null,
    strongest, lowest,
  };
}

function humanize(text) {
  return String(text).replace(/[-_.]+/g, " ").trim();
}

const TOKEN_RE = /\{\{\s*([^{}|]+?)\s*(?:\|\s*([^{}]*?)\s*)?\}\}/g;

function formatValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value).trim();
}

function resolveToken(path, snapshot) {
  const dot = path.indexOf(".");
  const id = dot === -1 ? path : path.slice(0, dot);
  const prop = dot === -1 ? "" : path.slice(dot + 1);
  const entry = snapshot.fields.get(id);
  if (!entry) return "";

  if (entry.field.type === "scale") {
    const r = scoreScale(entry.field, entry.value);
    if (!r.complete) return "";
    switch (prop) {
      case "": case "score": return String(r.score);
      case "max": return String(r.max);
      case "percent": return String(r.percent);
      case "band": return r.band?.label || "";
      case "bandText": return r.band?.text || "";
      case "label": return entry.field.areaLabel || entry.field.label || "";
      default: return "";
    }
  }
  if (entry.field.type === "scoreboard") {
    const r = resolveScoreboard(entry.field, snapshot);
    if (!r.complete) return "";
    const names = (rows) => rows.map((row) => row.label).join(" and ");
    switch (prop) {
      case "": case "total": return String(r.total);
      case "max": return String(r.max);
      case "percent": return String(r.percent);
      case "band": return r.band?.label || "";
      case "bandText": return r.band?.text || "";
      case "strongest": return names(r.strongest);
      case "lowest": return names(r.lowest);
      case "strongestScore": return r.strongest[0] ? String(r.strongest[0].score) : "";
      case "lowestScore": return r.lowest[0] ? String(r.lowest[0].score) : "";
      default: return "";
    }
  }
  if (prop) return "";
  return formatValue(entry.value);
}

/** Fills `{{id}}`, `{{id.prop}}` and `{{id|fallback}}` tokens. Returns { parts, text }. */
export function renderTemplate(template, snapshot) {
  const source = String(template ?? "");
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN_RE)) {
    if (match.index > last) parts.push({ text: source.slice(last, match.index), missing: false });
    const value = resolveToken(match[1], snapshot);
    if (value) parts.push({ text: value, missing: false });
    else parts.push({ text: `[${match[2] || humanize(match[1])}]`, missing: true });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last), missing: false });
  return { parts, text: parts.map((part) => part.text).join("") };
}

/** Every token a designer can insert, for the Builder's "Insert" menu. */
export function availableTokens(workbookConfig) {
  const tokens = [];
  for (const worksheet of workbookConfig?.worksheets || []) {
    for (const section of worksheet.sections || []) {
      for (const field of section.fields || []) {
        const name = field.areaLabel || field.label || field.id;
        if (field.type === "scale") {
          tokens.push({ token: `{{${field.id}.score}}`, label: `${name} — score` });
          tokens.push({ token: `{{${field.id}.max}}`, label: `${name} — out of` });
          tokens.push({ token: `{{${field.id}.band}}`, label: `${name} — result label` });
        } else if (field.type === "scoreboard") {
          for (const [prop, text] of [["total", "total score"], ["max", "total out of"], ["band", "total result label"], ["strongest", "strongest area"], ["lowest", "lowest area"], ["strongestScore", "strongest area's score"], ["lowestScore", "lowest area's score"]]) {
            tokens.push({ token: `{{${field.id}.${prop}}}`, label: `${field.label || "Scoreboard"} — ${text}` });
          }
        } else if (!SNAPSHOT_SKIP_TYPES.has(field.type) && field.type !== "scored-text" && field.type !== "checkbox") {
          tokens.push({ token: `{{${field.id}}}`, label: `Answer: ${field.label || field.id}` });
        }
      }
    }
  }
  return tokens;
}

/** Snapshot from a config and its stored data (used by the PDF export). */
export function snapshotFromConfig(config, data) {
  const fields = new Map();
  const worksheets = (data && data.worksheets) || {};
  for (const worksheet of config?.worksheets || []) {
    const values = worksheets[worksheet.id] || {};
    for (const section of worksheet.sections || []) {
      for (const field of section.fields || []) {
        if (SNAPSHOT_SKIP_TYPES.has(field.type)) continue;
        fields.set(field.id, { field, value: values[field.id] });
      }
    }
  }
  return { fields };
}

/** Snapshot from a mounted workbook (every worksheet panel, shown or hidden). */
export function snapshotFromDom(root) {
  const fields = new Map();
  root.querySelectorAll(".wb-field[data-field-id][data-field-type]").forEach((wrapper) => {
    const type = wrapper.dataset.fieldType;
    if (SNAPSHOT_SKIP_TYPES.has(type) || !FieldRegistry.has(type)) return;
    const module = FieldRegistry.get(type);
    const base = module.configFromWrapper
      ? module.configFromWrapper(wrapper)
      : { id: wrapper.dataset.fieldId, type, label: wrapper.querySelector(".wb-field-label")?.childNodes[0]?.textContent?.trim() || "" };
    fields.set(wrapper.dataset.fieldId, { field: base, value: module.getValue(wrapper) });
  });
  return { fields };
}

/** Recomputes every score readout, scoreboard and personalised text inside `root`. */
export function refreshScoring(root) {
  if (!root.querySelector(SCORING_SELECTOR)) return;
  const snapshot = snapshotFromDom(root);

  root.querySelectorAll('.wb-field[data-field-type="scale"]').forEach((wrapper) => {
    const entry = snapshot.fields.get(wrapper.dataset.fieldId);
    if (entry) FieldRegistry.get("scale").update(wrapper, scoreScale(entry.field, entry.value));
  });
  root.querySelectorAll('.wb-field[data-field-type="scoreboard"]').forEach((wrapper) => {
    const entry = snapshot.fields.get(wrapper.dataset.fieldId);
    if (entry) FieldRegistry.get("scoreboard").update(wrapper, resolveScoreboard(entry.field, snapshot));
  });
  root.querySelectorAll('.wb-field[data-field-type="scored-text"]').forEach((wrapper) => {
    const entry = snapshot.fields.get(wrapper.dataset.fieldId);
    if (entry) FieldRegistry.get("scored-text").update(wrapper, renderTemplate(entry.field.template, snapshot));
  });
}

const wiredRoots = new WeakSet();

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

/**
 * Keeps scoring live: refreshes on every edit and handles the copy buttons.
 * Delegated on `root`, so it works for freshly rendered workbooks and for
 * published static HTML (which can't carry listeners) alike. Idempotent.
 */
export function wireScoring(root) {
  if (!wiredRoots.has(root)) {
    wiredRoots.add(root);
    root.addEventListener("input", () => refreshScoring(root));
    root.addEventListener("change", () => refreshScoring(root));
    root.addEventListener("click", async (event) => {
      const button = event.target.closest?.(".wb-scored-text-copy");
      if (!button || !root.contains(button)) return;
      const wrapper = button.closest(".wb-field");
      const body = wrapper?.querySelector(".wb-scored-text-body");
      const status = wrapper?.querySelector(".wb-scored-text-status");
      if (!body) return;
      const ok = await copyToClipboard(body.textContent);
      if (status) {
        status.textContent = ok ? "Copied — paste it into your AI tool." : "Couldn't copy automatically. Select the text and copy it.";
        setTimeout(() => { status.textContent = ""; }, 4000);
      }
    });
  }
  refreshScoring(root);
}
