import { describe, it, expect } from "vitest";
import { image } from "../../../src/fields/image.js";

const field = { id: "pic", type: "image", src: "photo.png", alt: "A photo", caption: "A caption" };

describe("image field", () => {
  it("renders a figure with the image and caption", () => {
    const wrapper = image.render(field);
    const img = wrapper.querySelector("img");
    expect(img.src).toContain("photo.png");
    expect(img.alt).toBe("A photo");
    expect(wrapper.querySelector("figcaption").textContent).toBe("A caption");
  });

  it("omits the figcaption when there is no caption", () => {
    const wrapper = image.render({ ...field, caption: "" });
    expect(wrapper.querySelector("figcaption")).toBeNull();
  });

  it("getValue returns undefined (no stored answer)", () => {
    const wrapper = image.render(field);
    expect(image.getValue(wrapper)).toBeUndefined();
  });

  it("validate always passes", () => {
    expect(image.validate(field, undefined)).toBe(true);
  });
});
