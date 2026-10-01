import { createWrapper, createLabel } from "./field-helpers.js";

/**
 * Personalised text: a template whose {{tokens}} fill in live from the
 * learner's scores and answers — e.g. an AI prompt that already contains
 * their results, a summary callout, or a certificate-style statement. Until
 * a token has a value it shows as a highlighted [placeholder], so the learner
 * can see exactly what is still missing. Display-only: nothing is stored.
 */
export const scoredText = {
  render(field) {
    const wrapper = createWrapper(field);
    wrapper.dataset.template = field.template || "";
    wrapper.appendChild(createLabel(field, null));

    const variant = field.variant === "callout" ? "callout" : "prompt";
    const box = document.createElement("div");
    box.className = `wb-scored-text wb-scored-text-${variant}`;
    box.dataset.copy = field.copyButton === false ? "false" : "true";
    box.dataset.variant = variant;
    const body = document.createElement("div");
    body.className = "wb-scored-text-body";
    box.appendChild(body);
    wrapper.appendChild(box);

    if (field.copyButton !== false) {
      const actions = document.createElement("div");
      actions.className = "wb-scored-text-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wb-scored-text-copy";
      button.textContent = field.copyLabel || "Copy to clipboard";
      actions.appendChild(button);
      const status = document.createElement("span");
      status.className = "wb-scored-text-status";
      status.setAttribute("aria-live", "polite");
      actions.appendChild(status);
      wrapper.appendChild(actions);
    }

    // Plain-text first paint (tokens unresolved) so the template is readable
    // before the first scoring refresh.
    body.textContent = field.template || "";
    return wrapper;
  },

  /** Paints a renderTemplate() result. */
  update(wrapper, { parts }) {
    const body = wrapper.querySelector(".wb-scored-text-body");
    if (!body) return;
    body.textContent = "";
    for (const part of parts) {
      if (part.missing) {
        const mark = document.createElement("mark");
        mark.className = "wb-token-missing";
        mark.textContent = part.text;
        body.appendChild(mark);
      } else {
        body.appendChild(document.createTextNode(part.text));
      }
    }
  },

  getValue() {
    return undefined;
  },

  setValue() {
    // derived from other fields, nothing to restore
  },

  validate() {
    return true;
  },

  configFromWrapper(wrapper) {
    const box = wrapper.querySelector(".wb-scored-text");
    const labelEl = wrapper.querySelector(".wb-field-label");
    return {
      id: wrapper.dataset.fieldId,
      type: "scored-text",
      label: labelEl
        ? [...labelEl.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim()
        : "",
      template: wrapper.dataset.template || "",
      variant: box?.dataset.variant === "callout" ? "callout" : "prompt",
      copyButton: box?.dataset.copy !== "false",
      copyLabel: wrapper.querySelector(".wb-scored-text-copy")?.textContent || "",
    };
  },
};
