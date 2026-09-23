import { describe, it, expect } from "vitest";
import { richText } from "../../../src/fields/rich-text.js";

const field = { id: "response", type: "rich-text", label: "Response", required: true };

describe("rich text field", () => {
  it("renders a contenteditable answer area with light formatting controls", () => {
    const wrapper = richText.render(field, "<h2>Title</h2><p><strong>Bold</strong></p>");
    expect(wrapper.querySelector('[contenteditable="true"]')).not.toBeNull();
    expect(wrapper.querySelector('.wb-rich-text-format option[value="H1"]')).not.toBeNull();
    expect(wrapper.querySelector('button[aria-label="Bold"]')).not.toBeNull();
    expect(richText.getValue(wrapper)).toContain("<h2>Title</h2>");
    expect(richText.getValue(wrapper)).toContain("<strong>Bold</strong>");
  });

  it("sanitizes stored HTML", () => {
    const wrapper = richText.render(field, '<p onclick="alert(1)">Safe</p><script>alert(1)</script>');
    const value = richText.getValue(wrapper);
    expect(value).toContain("Safe");
    expect(value).not.toContain("script");
    expect(value).not.toContain("onclick");
  });

  it("validates required content by visible text", () => {
    expect(richText.validate(field, "<p><br></p>")).not.toBe(true);
    expect(richText.validate(field, "<h3>Done</h3>")).toBe(true);
  });
});
