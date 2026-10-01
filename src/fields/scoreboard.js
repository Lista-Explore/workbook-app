import { createWrapper, createLabel } from "./field-helpers.js";
import { normalizeBands } from "../core/scoring.js";

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

const STATUS_TEXT = {
  match: "✓ Matches your ratings",
  mismatch: "Doesn't match — recheck that area's ratings",
  pending: "Finish rating this area first",
};

/**
 * Score summary: gathers the scores of several rating scales into one
 * table with a cumulative total, a result for each area and an overall
 * result. In "auto" mode it fills itself in. In "copy" mode the learner
 * types each score in (deliberate friction: it makes them re-read and
 * re-engage with their own results) and each entry is checked, without
 * ever revealing the right number.
 * Value (copy mode only): { [sourceFieldId]: number }.
 */
export const scoreboard = {
  render(field, value) {
    const mode = field.mode === "copy" ? "copy" : "auto";
    const rows = Array.isArray(field.rows) ? field.rows : [];
    const entered = value && typeof value === "object" && !Array.isArray(value) ? value : {};

    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field, null));

    const scroll = el("div", "wb-table-scroll");
    const table = el("table", "wb-scoreboard-table");
    table.dataset.mode = mode;
    table.dataset.showTotal = field.showTotal === false ? "false" : "true";
    table.dataset.totalLabel = field.totalLabel || "Total";
    table.dataset.highlight = field.highlight === false ? "false" : "true";
    table.dataset.showKey = field.showBandKey ? "true" : "false";
    table.dataset.bands = JSON.stringify(normalizeBands(field.bands));
    table.dataset.totalBands = JSON.stringify(normalizeBands(field.totalBands));

    const head = el("thead");
    const headRow = el("tr");
    [field.areaHeading || "Area", mode === "copy" ? "Your score (type it in)" : "Your score", "Out of", "What it means"].forEach((text) => {
      const th = el("th", null, text);
      th.scope = "col";
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = el("tbody");
    rows.forEach((row, index) => {
      const tr = el("tr", "wb-scoreboard-row");
      tr.dataset.source = row.source || "";
      if (row.label) tr.dataset.customLabel = row.label;
      const th = el("th", "wb-scoreboard-area");
      th.scope = "row";
      th.appendChild(el("span", "wb-scoreboard-area-name", row.label || ""));
      tr.appendChild(th);

      const scoreCell = el("td", "wb-scoreboard-score");
      if (mode === "copy") {
        const input = el("input");
        input.type = "number";
        input.inputMode = "numeric";
        input.min = "0";
        input.name = `${field.id}__score__${index}`;
        input.setAttribute("aria-label", `${row.label || "Area"} score`);
        if (entered[row.source] != null && entered[row.source] !== "") input.value = String(entered[row.source]);
        scoreCell.appendChild(input);
      } else {
        scoreCell.appendChild(el("span", "wb-scoreboard-score-value", "—"));
      }
      tr.appendChild(scoreCell);
      tr.appendChild(el("td", "wb-scoreboard-max", ""));
      tr.appendChild(el("td", "wb-scoreboard-result", ""));
      body.appendChild(tr);
    });
    table.appendChild(body);

    const foot = el("tfoot");
    const totalRow = el("tr", "wb-scoreboard-total");
    const totalLabel = el("th", null, field.totalLabel || "Total");
    totalLabel.scope = "row";
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(el("td", "wb-scoreboard-total-score", "0"));
    totalRow.appendChild(el("td", "wb-scoreboard-total-max", ""));
    totalRow.appendChild(el("td", "wb-scoreboard-total-result", ""));
    if (field.showTotal === false) totalRow.hidden = true;
    foot.appendChild(totalRow);
    table.appendChild(foot);

    scroll.appendChild(table);
    wrapper.appendChild(scroll);

    const note = el("div", "wb-scoreboard-note");
    note.setAttribute("aria-live", "polite");
    wrapper.appendChild(note);
    wrapper.appendChild(el("div", "wb-band-key-slot"));
    return wrapper;
  },

  /** Paints a resolveScoreboard() result into the wrapper. */
  update(wrapper, result) {
    const table = wrapper.querySelector(".wb-scoreboard-table");
    if (!table) return;
    const highlight = table.dataset.highlight !== "false";
    const strongest = new Set(result.strongest.map((row) => row.source));
    const lowest = new Set(result.lowest.map((row) => row.source));

    wrapper.querySelectorAll(".wb-scoreboard-row").forEach((tr, index) => {
      const row = result.rows[index];
      if (!row) return;
      tr.dataset.status = row.status;
      tr.querySelector(".wb-scoreboard-area-name").textContent = row.label;
      tr.classList.toggle("wb-is-strongest", highlight && strongest.has(row.source));
      tr.classList.toggle("wb-is-lowest", highlight && lowest.has(row.source));

      const nameCell = tr.querySelector(".wb-scoreboard-area");
      let badge = nameCell.querySelector(".wb-scoreboard-badge");
      const badgeText = highlight && strongest.has(row.source) ? "Strongest" : highlight && lowest.has(row.source) ? "Growth edge" : "";
      if (badgeText && !badge) {
        badge = el("span", "wb-scoreboard-badge");
        nameCell.appendChild(badge);
      }
      if (badge) {
        badge.textContent = badgeText;
        badge.hidden = !badgeText;
      }

      const valueEl = tr.querySelector(".wb-scoreboard-score-value");
      if (valueEl) valueEl.textContent = row.score == null ? "—" : String(row.score);
      tr.querySelector(".wb-scoreboard-max").textContent = row.missingSource ? "" : String(row.max);

      const resultCell = tr.querySelector(".wb-scoreboard-result");
      resultCell.className = `wb-scoreboard-result${row.band?.tone ? ` wb-tone-${row.band.tone}` : ""}`;
      if (row.missingSource) resultCell.textContent = "Rating scale not found";
      else if (result.mode === "copy" && row.status !== "match") resultCell.textContent = STATUS_TEXT[row.status] || "";
      else if (row.band) resultCell.textContent = row.band.label;
      else if (row.status === "partial") resultCell.textContent = `In progress (${row.answered} of ${row.total})`;
      else resultCell.textContent = "";
      if (result.mode === "copy") tr.classList.toggle("wb-is-mismatch", row.status === "mismatch");
    });

    table.querySelector(".wb-scoreboard-total-score").textContent = String(result.total);
    table.querySelector(".wb-scoreboard-total-max").textContent = String(result.max);
    const totalResult = table.querySelector(".wb-scoreboard-total-result");
    totalResult.className = `wb-scoreboard-total-result${result.band?.tone ? ` wb-tone-${result.band.tone}` : ""}`;
    totalResult.textContent = result.band?.label || "";

    const note = wrapper.querySelector(".wb-scoreboard-note");
    if (result.complete) {
      const names = (rows) => rows.map((row) => row.label).join(" and ");
      note.textContent = highlight && result.strongest.length
        ? `Strongest: ${names(result.strongest)}. Growth edge: ${names(result.lowest)}.${result.band?.text ? ` ${result.band.text}` : ""}`
        : result.band?.text || "";
    } else {
      note.textContent = `${result.completeCount} of ${result.rows.length} areas complete — the total is a running sum until every area is done.`;
    }

    const slot = wrapper.querySelector(".wb-band-key-slot");
    const signature = table.dataset.showKey === "true" ? JSON.stringify(result.keyBands) : "";
    if (slot && slot.dataset.signature !== signature) {
      slot.dataset.signature = signature;
      slot.innerHTML = "";
      if (signature && result.keyBands.length) {
        const key = el("table", "wb-band-key");
        const head = el("thead");
        const headRow = el("tr");
        ["Score", "What it means"].forEach((text) => headRow.appendChild(el("th", null, text)));
        head.appendChild(headRow);
        key.appendChild(head);
        const body = el("tbody");
        result.keyBands.forEach((band) => {
          const tr = el("tr", band.tone ? `wb-tone-${band.tone}` : "");
          tr.appendChild(el("td", "wb-band-key-range", `${band.min}–${band.max}`));
          const meaning = el("td");
          meaning.appendChild(el("strong", null, band.label));
          if (band.text) meaning.appendChild(document.createTextNode(` ${band.text}`));
          tr.appendChild(meaning);
          body.appendChild(tr);
        });
        key.appendChild(body);
        slot.appendChild(key);
      }
    }
  },

  getValue(wrapper) {
    const rows = [...wrapper.querySelectorAll(".wb-scoreboard-row")];
    const out = {};
    rows.forEach((row) => {
      const input = row.querySelector("input");
      if (input && input.value !== "") out[row.dataset.source] = Number(input.value);
    });
    return Object.keys(out).length ? out : undefined;
  },

  setValue(wrapper, value) {
    const map = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    wrapper.querySelectorAll(".wb-scoreboard-row").forEach((row) => {
      const input = row.querySelector("input");
      if (input) input.value = map[row.dataset.source] != null ? String(map[row.dataset.source]) : "";
    });
  },

  validate() {
    return true;
  },

  configFromWrapper(wrapper) {
    const table = wrapper.querySelector(".wb-scoreboard-table");
    const labelEl = wrapper.querySelector(".wb-field-label");
    return {
      id: wrapper.dataset.fieldId,
      type: "scoreboard",
      label: labelEl
        ? [...labelEl.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim()
        : "",
      mode: table?.dataset.mode === "copy" ? "copy" : "auto",
      showTotal: table?.dataset.showTotal !== "false",
      totalLabel: table?.dataset.totalLabel || "Total",
      highlight: table?.dataset.highlight !== "false",
      showBandKey: table?.dataset.showKey === "true",
      areaHeading: table?.querySelector("thead th")?.textContent.trim() || "Area",
      bands: parseJson(table?.dataset.bands, []),
      totalBands: parseJson(table?.dataset.totalBands, []),
      rows: [...wrapper.querySelectorAll(".wb-scoreboard-row")].map((row) => ({
        source: row.dataset.source,
        label: row.dataset.customLabel || "",
      })),
    };
  },
};
