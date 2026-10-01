import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { scalePoints, scaleStatements, normalizeBands, scoreScale } from "../core/scoring.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Rating scale: a block of statements, each answered on the same point scale
 * (Likert 1–5, 0–3 frequency, yes/no, 1–10 …), with a running cumulative
 * score. Reverse-scored statements are mirrored before they're added up.
 * Value: an array with one entry per statement — the chosen point value, or
 * null when unanswered.
 */
export const scale = {
  render(field, value) {
    const points = scalePoints(field);
    const statements = scaleStatements(field);
    const reverse = Array.isArray(field.reverse) ? field.reverse : [];
    const answers = Array.isArray(value) ? value : [];

    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field, null));
    if (field.description) wrapper.appendChild(el("p", "wb-scale-description", field.description));

    if (points.some((p) => p.label)) {
      const legend = el("dl", "wb-scale-legend");
      legend.setAttribute("aria-label", "What each rating means");
      points.forEach((point) => {
        if (!point.label) return;
        const item = el("div", "wb-scale-legend-item");
        item.appendChild(el("dt", null, String(point.value)));
        item.appendChild(el("dd", null, point.label));
        legend.appendChild(item);
      });
      wrapper.appendChild(legend);
    }

    const scroll = el("div", "wb-table-scroll");
    const table = el("table", "wb-scale-table");
    table.dataset.points = JSON.stringify(points);
    table.dataset.bands = JSON.stringify(normalizeBands(field.bands));
    table.dataset.scoreLabel = field.scoreLabel || "";
    table.dataset.areaLabel = field.areaLabel || "";
    table.dataset.showScore = field.showScore === false ? "false" : "true";

    const head = el("thead");
    const headRow = el("tr");
    const statementHead = el("th", "wb-scale-statement-head", "Statement");
    statementHead.scope = "col";
    headRow.appendChild(statementHead);
    points.forEach((point) => {
      const th = el("th", "wb-scale-point-head", String(point.value));
      th.scope = "col";
      if (point.label) th.title = point.label;
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = el("tbody");
    statements.forEach((statement, index) => {
      const row = el("tr", "wb-scale-row");
      row.dataset.reverse = reverse[index] ? "true" : "false";
      const th = el("th", "wb-scale-statement");
      th.scope = "row";
      th.appendChild(document.createTextNode(statement));
      row.appendChild(th);
      points.forEach((point) => {
        const cell = el("td", "wb-scale-cell");
        const choice = el("label", "wb-scale-choice");
        if (point.label) choice.title = point.label;
        const input = el("input");
        input.type = "radio";
        input.name = `${field.id}__${index}`;
        input.value = String(point.value);
        input.checked = answers[index] != null && Number(answers[index]) === point.value;
        if (field.required) input.setAttribute("aria-required", "true");
        choice.appendChild(input);
        choice.appendChild(el("span", "wb-scale-choice-num", String(point.value)));
        cell.appendChild(choice);
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.appendChild(body);
    scroll.appendChild(table);
    wrapper.appendChild(scroll);

    const readout = el("div", "wb-score-readout");
    readout.setAttribute("aria-live", "polite");
    if (field.showScore === false) readout.hidden = true;
    const top = el("div", "wb-score-top");
    top.appendChild(el("span", "wb-score-label", field.scoreLabel || "Your score"));
    const figure = el("span", "wb-score-figure");
    figure.appendChild(el("strong", "wb-score-value", "0"));
    figure.appendChild(el("span", "wb-score-max", ""));
    top.appendChild(figure);
    readout.appendChild(top);
    const meter = el("div", "wb-score-meter");
    meter.appendChild(el("div", "wb-score-meter-fill"));
    readout.appendChild(meter);
    readout.appendChild(el("div", "wb-score-progress"));
    const band = el("div", "wb-score-band");
    band.hidden = true;
    band.appendChild(el("strong", "wb-score-band-label"));
    band.appendChild(el("span", "wb-score-band-text"));
    readout.appendChild(band);
    wrapper.appendChild(readout);

    wrapper.appendChild(createErrorSlot(field));
    scale.update(wrapper, scoreScale(field, answers));
    return wrapper;
  },

  /** Paints a scoreScale() result into the wrapper's readout. */
  update(wrapper, result) {
    const set = (selector, text) => {
      const node = wrapper.querySelector(selector);
      if (node) node.textContent = text;
    };
    set(".wb-score-value", String(result.score));
    set(".wb-score-max", ` / ${result.max}`);
    set(
      ".wb-score-progress",
      result.complete ? "All statements answered" : `${result.answered} of ${result.total} answered — your score updates as you go`
    );
    const fill = wrapper.querySelector(".wb-score-meter-fill");
    if (fill) fill.style.width = `${Math.min(result.percent, 100)}%`;
    const readout = wrapper.querySelector(".wb-score-readout");
    if (readout) readout.dataset.complete = result.complete ? "true" : "false";
    const bandEl = wrapper.querySelector(".wb-score-band");
    if (bandEl) {
      bandEl.hidden = !result.band;
      bandEl.className = `wb-score-band${result.band?.tone ? ` wb-tone-${result.band.tone}` : ""}`;
      set(".wb-score-band-label", result.band?.label || "");
      set(".wb-score-band-text", result.band?.text ? ` ${result.band.text}` : "");
    }
  },

  getValue(wrapper) {
    const rows = [...wrapper.querySelectorAll(".wb-scale-row")];
    const answers = rows.map((row) => {
      const checked = row.querySelector("input[type=radio]:checked");
      return checked ? Number(checked.value) : null;
    });
    return answers.some((answer) => answer != null) ? answers : [];
  },

  setValue(wrapper, value) {
    const answers = Array.isArray(value) ? value : [];
    wrapper.querySelectorAll(".wb-scale-row").forEach((row, index) => {
      row.querySelectorAll("input[type=radio]").forEach((input) => {
        input.checked = answers[index] != null && Number(input.value) === Number(answers[index]);
      });
    });
    const field = scale.configFromWrapper(wrapper);
    scale.update(wrapper, scoreScale(field, answers));
  },

  validate(field, value) {
    if (!field.required) return true;
    const answers = Array.isArray(value) ? value : [];
    const total = scaleStatements(field).length;
    const done = answers.filter((answer) => answer != null).length;
    return total > 0 && done === total ? true : "Please rate every statement.";
  },

  configFromWrapper(wrapper) {
    const table = wrapper.querySelector(".wb-scale-table");
    const rows = [...wrapper.querySelectorAll(".wb-scale-row")];
    const labelEl = wrapper.querySelector(".wb-field-label");
    const label = labelEl
      ? [...labelEl.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim()
      : "";
    return {
      id: wrapper.dataset.fieldId,
      type: "scale",
      label,
      required: Boolean(wrapper.querySelector(".wb-required-marker")),
      description: wrapper.querySelector(".wb-scale-description")?.textContent || "",
      points: parseJson(table?.dataset.points, []),
      statements: rows.map((row) => row.querySelector(".wb-scale-statement")?.textContent.trim() || ""),
      reverse: rows.map((row) => row.dataset.reverse === "true"),
      bands: parseJson(table?.dataset.bands, []),
      scoreLabel: table?.dataset.scoreLabel || "",
      areaLabel: table?.dataset.areaLabel || "",
      showScore: table?.dataset.showScore !== "false",
    };
  },
};
