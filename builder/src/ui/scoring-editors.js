import { SCALE_PRESETS, presetPoints, availableTokens, normalizeBands } from "../../../src/core/scoring.js";

/**
 * Builder editors for the three scoring field types. Same conventions as the
 * other field editors: text edits mutate the live field and call
 * `onLightChange()` (no re-render, so typing keeps focus); structural edits
 * (add/remove/reorder) call `onChange(patch)`, which updates state and
 * re-renders.
 */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function labelled(text, control, className = "builder-scoring-labelled") {
  const wrap = el("label", className);
  wrap.appendChild(el("span", "builder-scoring-labelled-text", text));
  wrap.appendChild(control);
  return wrap;
}

function textInput({ value, placeholder, onInput, className }) {
  const input = el("input", className);
  input.type = "text";
  input.value = value || "";
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function checkbox(text, checked, onChange) {
  const label = el("label", "builder-scoring-check");
  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  label.appendChild(input);
  label.appendChild(document.createTextNode(` ${text}`));
  return label;
}

function button(text, onClick, className = "builder-scoring-btn") {
  const btn = el("button", className, text);
  btn.type = "button";
  btn.addEventListener("click", onClick);
  return btn;
}

function section(title, hint) {
  const wrap = el("div", "builder-scoring-group");
  wrap.appendChild(el("strong", "builder-scoring-group-title", title));
  if (hint) wrap.appendChild(el("p", "builder-scoring-hint", hint));
  return wrap;
}

/** Result bands: "this score range means this". */
function renderBandsEditor({ title, hint, field, key, onChange, onLightChange, copyFrom = [] }) {
  const wrap = section(title, hint);
  const bands = field[key] || (field[key] = []);

  bands.forEach((band, index) => {
    const row = el("div", "builder-band-row");
    const min = el("input");
    min.type = "number";
    min.value = band.min ?? "";
    min.setAttribute("aria-label", "From score");
    min.addEventListener("input", () => { band.min = min.value === "" ? "" : Number(min.value); onLightChange(); });
    const max = el("input");
    max.type = "number";
    max.value = band.max ?? "";
    max.setAttribute("aria-label", "To score");
    max.addEventListener("input", () => { band.max = max.value === "" ? "" : Number(max.value); onLightChange(); });
    const range = el("span", "builder-band-range");
    range.appendChild(min);
    range.appendChild(document.createTextNode(" to "));
    range.appendChild(max);

    const tone = el("select");
    [["", "No colour"], ["positive", "Strength (green)"], ["neutral", "Emerging (amber)"], ["attention", "Needs attention (red)"]].forEach(([value, text]) => {
      const opt = el("option", null, text);
      opt.value = value;
      tone.appendChild(opt);
    });
    tone.value = band.tone || "";
    tone.addEventListener("change", () => { band.tone = tone.value; onLightChange(); });

    row.appendChild(range);
    row.appendChild(textInput({ value: band.label, placeholder: "Result label, e.g. Confidence strength", className: "builder-band-label", onInput: (v) => { band.label = v; onLightChange(); } }));
    row.appendChild(tone);
    row.appendChild(textInput({ value: band.text, placeholder: "What it means (optional)", className: "builder-band-text", onInput: (v) => { band.text = v; onLightChange(); } }));
    row.appendChild(button("Remove band", () => onChange({ [key]: bands.filter((_, i) => i !== index) })));
    wrap.appendChild(row);
  });

  const actions = el("div", "builder-scoring-actions");
  actions.appendChild(button("+ Add result band", () => onChange({ [key]: [...bands, { min: 0, max: 0, label: "", text: "", tone: "" }] })));
  const sources = copyFrom.filter((source) => normalizeBands(source.bands).length);
  if (sources.length) {
    const select = el("select", "builder-scoring-copy-bands");
    const none = el("option", null, "Copy bands from…");
    none.value = "";
    select.appendChild(none);
    sources.forEach((source, index) => {
      const opt = el("option", null, source.name);
      opt.value = String(index);
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      if (select.value === "") return;
      onChange({ [key]: JSON.parse(JSON.stringify(sources[Number(select.value)].bands)) });
    });
    actions.appendChild(select);
  }
  wrap.appendChild(actions);
  return wrap;
}

export function renderScaleEditor(field, { onChange, onLightChange, otherScales = [] }) {
  const wrap = el("div", "builder-scoring-editor builder-scale-editor");

  if (!Array.isArray(field.points) || !field.points.length) field.points = presetPoints("1-5");
  if (!Array.isArray(field.statements)) field.statements = [];
  if (!Array.isArray(field.reverse)) field.reverse = [];
  while (field.reverse.length < field.statements.length) field.reverse.push(false);

  const names = el("div", "builder-scoring-grid");
  names.appendChild(labelled("Short name (used in score summaries)", textInput({ value: field.areaLabel, placeholder: "e.g. Communication", onInput: (v) => { field.areaLabel = v; onLightChange(); } })));
  names.appendChild(labelled("Score line", textInput({ value: field.scoreLabel, placeholder: "e.g. Communication Confidence Score", onInput: (v) => { field.scoreLabel = v; onLightChange(); } })));
  wrap.appendChild(names);
  wrap.appendChild(labelled("Instructions (optional)", textInput({ value: field.description, placeholder: "Shown above the statements", onInput: (v) => { field.description = v; onLightChange(); } })));

  // Answer scale
  const scaleGroup = section("Answer scale", "The same choices appear beside every statement. Scores add up the chosen values.");
  const preset = el("select", "builder-scale-preset");
  const custom = el("option", null, "Custom");
  custom.value = "";
  preset.appendChild(custom);
  Object.entries(SCALE_PRESETS).forEach(([key, { name }]) => {
    const opt = el("option", null, name);
    opt.value = key;
    preset.appendChild(opt);
  });
  const current = Object.entries(SCALE_PRESETS).find(([, p]) => JSON.stringify(p.values) === JSON.stringify(field.points.map((pt) => pt.value)));
  preset.value = current ? current[0] : "";
  preset.addEventListener("change", () => {
    if (preset.value) onChange({ points: presetPoints(preset.value) });
  });
  scaleGroup.appendChild(labelled("Start from", preset));
  field.points.forEach((point, index) => {
    const row = el("div", "builder-scale-point-row");
    const value = el("input");
    value.type = "number";
    value.value = point.value;
    value.setAttribute("aria-label", "Point value");
    value.addEventListener("input", () => { point.value = Number(value.value); onLightChange(); });
    row.appendChild(value);
    row.appendChild(textInput({ value: point.label, placeholder: "What this choice means (optional)", onInput: (v) => { point.label = v; onLightChange(); } }));
    const remove = button("Remove point", () => onChange({ points: field.points.filter((_, i) => i !== index) }));
    remove.disabled = field.points.length <= 2;
    row.appendChild(remove);
    scaleGroup.appendChild(row);
  });
  scaleGroup.appendChild(button("+ Add point", () => {
    const next = Math.max(...field.points.map((p) => Number(p.value) || 0)) + 1;
    onChange({ points: [...field.points, { value: next, label: "" }] });
  }));
  wrap.appendChild(scaleGroup);

  // Statements
  const stmtGroup = section("Statements", "Tick “reverse-scored” for negatively worded statements — 5 is counted as 1, and so on.");
  field.statements.forEach((statement, index) => {
    const row = el("div", "builder-scale-statement-row");
    row.appendChild(el("span", "builder-scale-statement-num", `${index + 1}.`));
    row.appendChild(textInput({ value: statement, placeholder: `Statement ${index + 1}`, className: "builder-scale-statement-input", onInput: (v) => { field.statements[index] = v; onLightChange(); } }));
    row.appendChild(checkbox("Reverse-scored", Boolean(field.reverse[index]), (checked) => { field.reverse[index] = checked; onLightChange(); }));
    row.appendChild(button("Remove", () => onChange({ statements: field.statements.filter((_, i) => i !== index), reverse: field.reverse.filter((_, i) => i !== index) })));
    stmtGroup.appendChild(row);
  });
  const addActions = el("div", "builder-scoring-actions");
  addActions.appendChild(button("+ Add statement", () => onChange({ statements: [...field.statements, ""], reverse: [...field.reverse, false] })));
  const bulk = el("textarea", "builder-scale-bulk");
  bulk.rows = 3;
  bulk.placeholder = "Or paste several statements here, one per line…";
  addActions.appendChild(bulk);
  addActions.appendChild(button("Add pasted statements", () => {
    const lines = bulk.value.split("\n").map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
    if (!lines.length) return;
    // Pasting replaces the blank starter statements rather than sitting below them.
    let keep = field.statements.length;
    while (keep > 0 && !field.statements[keep - 1].trim()) keep -= 1;
    onChange({
      statements: [...field.statements.slice(0, keep), ...lines],
      reverse: [...field.reverse.slice(0, keep), ...lines.map(() => false)],
    });
  }));
  stmtGroup.appendChild(addActions);
  wrap.appendChild(stmtGroup);

  wrap.appendChild(checkbox("Show the running score under the statements", field.showScore !== false, (checked) => { field.showScore = checked; onChange({ showScore: checked }); }));

  if (!Array.isArray(field.bands)) field.bands = [];
  wrap.appendChild(renderBandsEditor({
    title: "Result bands (optional)",
    hint: "Once every statement is answered, the matching band is shown — e.g. 32–40 “Confidence strength”.",
    field, key: "bands", onChange, onLightChange,
    copyFrom: otherScales.map((other) => ({ name: other.areaLabel || other.label || other.id, bands: other.bands })),
  }));
  return wrap;
}

export function renderScoreboardEditor(field, { onChange, onLightChange, scales = [] }) {
  const wrap = el("div", "builder-scoring-editor builder-scoreboard-editor");
  if (!Array.isArray(field.rows)) field.rows = [];

  const modeSelect = el("select");
  [["auto", "Fill in automatically"], ["copy", "Learner types each score in (practice mode)"]].forEach(([value, text]) => {
    const opt = el("option", null, text);
    opt.value = value;
    modeSelect.appendChild(opt);
  });
  modeSelect.value = field.mode === "copy" ? "copy" : "auto";
  modeSelect.addEventListener("change", () => onChange({ mode: modeSelect.value }));
  wrap.appendChild(labelled("Scores", modeSelect));
  if (field.mode === "copy") {
    wrap.appendChild(el("p", "builder-scoring-hint", "Learners copy each score across from their ratings. Each entry is checked (✓ / “recheck”) without showing the right number — a little friction that makes them re-read their results."));
  }

  const rowsGroup = section("Areas to add up", "Each row pulls the score from one rating scale.");
  field.rows.forEach((row, index) => {
    const line = el("div", "builder-scoreboard-row");
    const select = el("select", "builder-scoreboard-source");
    const known = new Set(scales.map((scale) => scale.id));
    if (row.source && !known.has(row.source)) {
      const missing = el("option", null, `(missing: ${row.source})`);
      missing.value = row.source;
      select.appendChild(missing);
    }
    scales.forEach((scale) => {
      const opt = el("option", null, scale.areaLabel || scale.label || scale.id);
      opt.value = scale.id;
      select.appendChild(opt);
    });
    select.value = row.source || "";
    select.addEventListener("change", () => onChange({ rows: field.rows.map((r, i) => (i === index ? { ...r, source: select.value } : r)) }));
    line.appendChild(select);
    line.appendChild(textInput({ value: row.label, placeholder: "Row name (blank = the scale's short name)", onInput: (v) => { row.label = v; onLightChange(); } }));
    line.appendChild(button("Remove", () => onChange({ rows: field.rows.filter((_, i) => i !== index) })));
    rowsGroup.appendChild(line);
  });
  const rowActions = el("div", "builder-scoring-actions");
  const unused = scales.filter((scale) => !field.rows.some((row) => row.source === scale.id));
  rowActions.appendChild(button("+ Add area", () => {
    const next = unused[0] || scales[0];
    onChange({ rows: [...field.rows, { source: next ? next.id : "", label: "" }] });
  }));
  if (unused.length > 1) rowActions.appendChild(button("Add all rating scales", () => onChange({ rows: [...field.rows, ...unused.map((scale) => ({ source: scale.id, label: "" }))] })));
  if (!scales.length) rowActions.appendChild(el("span", "builder-scoring-hint", "Add a Rating scale question first, then come back."));
  rowsGroup.appendChild(rowActions);
  wrap.appendChild(rowsGroup);

  const options = el("div", "builder-scoring-grid");
  options.appendChild(checkbox("Show a total row", field.showTotal !== false, (checked) => onChange({ showTotal: checked })));
  options.appendChild(labelled("Total row name", textInput({ value: field.totalLabel, placeholder: "Total", onInput: (v) => { field.totalLabel = v; onLightChange(); } })));
  options.appendChild(checkbox("Mark the strongest area and growth edge", field.highlight !== false, (checked) => onChange({ highlight: checked })));
  options.appendChild(checkbox("Show a “what the scores mean” key", Boolean(field.showBandKey), (checked) => onChange({ showBandKey: checked })));
  wrap.appendChild(options);

  if (!Array.isArray(field.totalBands)) field.totalBands = [];
  if (!Array.isArray(field.bands)) field.bands = [];
  wrap.appendChild(renderBandsEditor({
    title: "Result for the total (optional)", hint: "Matched against the combined score.",
    field, key: "totalBands", onChange, onLightChange,
  }));
  wrap.appendChild(renderBandsEditor({
    title: "Result for each area (optional)",
    hint: "Leave empty to use each rating scale's own bands. Fill in to give every area the same bands.",
    field, key: "bands", onChange, onLightChange,
    copyFrom: scales.map((scale) => ({ name: scale.areaLabel || scale.label || scale.id, bands: scale.bands })),
  }));
  return wrap;
}

export function renderScoredTextEditor(field, { onChange, onLightChange, workbookConfig }) {
  const wrap = el("div", "builder-scoring-editor builder-scored-text-editor");

  const area = el("textarea", "builder-scored-text-template");
  area.rows = 8;
  area.value = field.template || "";
  area.placeholder = "Write your text. Use the Insert menu to drop in scores and answers, e.g. {{communication.score}}/40";
  area.addEventListener("input", () => { field.template = area.value; onLightChange(); });
  wrap.appendChild(labelled("Text", area));

  const insert = el("select", "builder-scored-text-insert");
  const head = el("option", null, "Insert a score or answer…");
  head.value = "";
  insert.appendChild(head);
  const tokens = availableTokens(workbookConfig).filter((entry) => !entry.token.startsWith(`{{${field.id}`));
  tokens.forEach((entry) => {
    const opt = el("option", null, entry.label);
    opt.value = entry.token;
    insert.appendChild(opt);
  });
  insert.addEventListener("change", () => {
    if (!insert.value) return;
    const start = area.selectionStart ?? area.value.length;
    const end = area.selectionEnd ?? start;
    area.value = `${area.value.slice(0, start)}${insert.value}${area.value.slice(end)}`;
    const caret = start + insert.value.length;
    area.focus();
    area.setSelectionRange(caret, caret);
    field.template = area.value;
    insert.value = "";
    onLightChange();
  });
  const insertRow = el("div", "builder-scoring-actions");
  insertRow.appendChild(insert);
  if (!tokens.length) insertRow.appendChild(el("span", "builder-scoring-hint", "Add rating scales or questions first and they will appear here."));
  wrap.appendChild(insertRow);
  wrap.appendChild(el("p", "builder-scoring-hint", "Until a value exists the learner sees a highlighted [placeholder]. Add a fallback with {{id|your words}}."));

  const variant = el("select");
  [["prompt", "Copy-ready box (monospace, e.g. an AI prompt)"], ["callout", "Highlighted callout"]].forEach(([value, text]) => {
    const opt = el("option", null, text);
    opt.value = value;
    variant.appendChild(opt);
  });
  variant.value = field.variant === "callout" ? "callout" : "prompt";
  variant.addEventListener("change", () => onChange({ variant: variant.value }));
  const options = el("div", "builder-scoring-grid");
  options.appendChild(labelled("Look", variant));
  options.appendChild(checkbox("Show a “Copy to clipboard” button", field.copyButton !== false, (checked) => onChange({ copyButton: checked })));
  wrap.appendChild(options);
  return wrap;
}
