import DOMPurify from "../vendor/purify.es.mjs";
import { createWrapper } from "./field-helpers.js";

export function sanitizeContent(html) {
  return DOMPurify.sanitize(html || "", {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["input", "button", "textarea", "select", "form", "style"],
    FORBID_ATTR: ["contenteditable", "id"],
  });
}

export function migrateContentField(field) {
  if (!["heading", "instructions", "statement", "image"].includes(field.type)) return;
  const block = document.createElement(field.type === "heading" ? "h3" : field.type === "image" ? "figure" : "p");
  if (field.type === "image") {
    const img = document.createElement("img");
    img.setAttribute("src", field.src || "");
    img.alt = field.alt || "";
    block.append(img);
    if (field.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = field.caption;
      block.append(caption);
    }
  } else block.textContent = field.label || "";
  field.html = sanitizeContent(block.outerHTML);
  field.type = "content";
  field.required = false;
}

export function contentText(field) {
  const el = document.createElement("div");
  el.innerHTML = sanitizeContent(field.html);
  el.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  el.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote").forEach((node) => node.append("\n"));
  el.querySelectorAll("img").forEach((img) => img.replaceWith(img.alt ? `[${img.alt}]` : "[Image]"));
  return el.textContent.trim();
}

export const content = {
  render(field) {
    const wrapper = createWrapper(field);
    const body = document.createElement("div");
    body.className = "wb-content";
    body.innerHTML = sanitizeContent(field.html);
    wrapper.append(body);
    return wrapper;
  },
  getValue() { return undefined; },
  setValue() {},
  validate() { return true; },
};
