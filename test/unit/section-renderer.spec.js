import { describe, it, expect, beforeAll } from "vitest";
import { renderSection } from "../../src/sections/section-renderer.js";
import { registerAllFields } from "../../src/fields/index.js";

beforeAll(() => {
  registerAllFields();
});

const baseSection = {
  id: "basic-info",
  title: "Basic Information",
  fields: [
    { id: "customer_name", type: "short-text", label: "Customer name", required: true },
    { id: "customer_type", type: "dropdown", label: "Customer type", options: ["A", "B"] },
  ],
};

describe("renderSection", () => {
  it("renders a plain (non-collapsible) section as a div with a heading", () => {
    const el = renderSection(baseSection);
    expect(el.tagName).toBe("DIV");
    expect(el.querySelector("h2").textContent).toBe("Basic Information");
  });

  it("renders a collapsible section as <details>/<summary>", () => {
    const el = renderSection({ ...baseSection, collapsible: true });
    expect(el.tagName).toBe("DETAILS");
    expect(el.querySelector("summary").textContent).toBe("Basic Information");
    expect(el.open).toBe(true);
  });

  it("starts collapsed when startCollapsed is set", () => {
    const el = renderSection({ ...baseSection, collapsible: true, startCollapsed: true });
    expect(el.open).toBe(false);
  });

  it("sets data-columns on the fields container", () => {
    const el = renderSection({ ...baseSection, columns: 3 });
    expect(el.querySelector(".wb-section-fields").dataset.columns).toBe("3");
  });

  it("defaults to a single column", () => {
    const el = renderSection(baseSection);
    expect(el.querySelector(".wb-section-fields").dataset.columns).toBe("1");
  });

  it("renders an image field at whatever position it appears in the fields list", () => {
    const el = renderSection({
      id: "s1",
      fields: [
        { id: "before-text", type: "short-text", label: "Before" },
        { id: "pic", type: "image", src: "pic.png", alt: "A picture", caption: "Caption" },
        { id: "after-text", type: "short-text", label: "After" },
      ],
    });
    const figure = el.querySelector("figure.wb-field-image");
    const beforeInput = el.querySelector("#before-text");
    const afterInput = el.querySelector("#after-text");
    expect(figure).not.toBeNull();
    expect(figure.querySelector("img").src).toContain("pic.png");
    expect(figure.querySelector("figcaption").textContent).toBe("Caption");
    // the image should sit between the two text fields, matching field order
    expect(beforeInput.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(figure.compareDocumentPosition(afterInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("pre-fills field values", () => {
    const el = renderSection(baseSection, { values: { customer_name: "Acme Ltd" } });
    expect(el.querySelector("#customer_name").value).toBe("Acme Ltd");
  });

  it("calls onFieldChange when a field's value changes", () => {
    const changes = [];
    const el = renderSection(baseSection, {
      onFieldChange: (id, value) => changes.push([id, value]),
    });
    document.body.appendChild(el);
    const input = el.querySelector("#customer_name");
    input.value = "New Co";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(changes).toEqual([["customer_name", "New Co"]]);
    document.body.removeChild(el);
  });
});
