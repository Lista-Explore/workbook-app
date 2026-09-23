import DOMPurify from "../vendor/purify.es.mjs";
import { createWrapper } from "./field-helpers.js";

export function sanitizeContent(html) {
  return DOMPurify.sanitize(html || "", {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["input", "button", "textarea", "select", "form", "style"],
    FORBID_ATTR: ["contenteditable", "id"],
  });
}

const PDF_TEXT_JOIN_REPAIRS = [
  ["directlyshapes", "directly shapes"],
  ["yousomething", "you something"],
  ["asyou", "as you"],
  ["onlyneed", "only need"],
  ["Theyrange", "They range"],
  ["uses,name", "uses, name"],
  ["schedulingand", "scheduling and"],
  ["Professionaltone", "Professional tone"],
  ["ofexperience", "of experience"],
  ["caregiving.Respond", "caregiving. Respond"],
  ["warm,forward", "warm, forward"],
];

export function repairPdfTextSpacing(text) {
  let repaired = String(text || "").replace(/\u200b/g, "");
  for (const [joined, spaced] of PDF_TEXT_JOIN_REPAIRS) {
    repaired = repaired.replaceAll(joined, spaced);
  }
  return repaired
    .replace(/([,.;:!?])(?=[A-Za-z])/g, "$1 ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

export function repairContentHtmlSpacing(html) {
  const host = document.createElement("div");
  host.innerHTML = sanitizeContent(html);
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.textContent = repairPdfTextSpacing(node.textContent);
  });
  return sanitizeContent(host.innerHTML);
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
  field.html = repairContentHtmlSpacing(block.outerHTML);
  field.type = "content";
  field.required = false;
}

export function contentText(field) {
  const el = document.createElement("div");
  el.innerHTML = repairContentHtmlSpacing(field.html);
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
    body.innerHTML = repairContentHtmlSpacing(field.html);
    wrapper.append(body);
    return wrapper;
  },
  getValue() { return undefined; },
  setValue() {},
  validate() { return true; },
};
