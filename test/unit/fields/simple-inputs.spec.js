import { describe, it, expect } from "vitest";
import { number } from "../../../src/fields/number.js";
import { email } from "../../../src/fields/email.js";
import { url } from "../../../src/fields/url.js";
import { tel } from "../../../src/fields/tel.js";
import { password } from "../../../src/fields/password.js";
import { date } from "../../../src/fields/date.js";
import { time } from "../../../src/fields/time.js";
import { datetime } from "../../../src/fields/datetime.js";
import { month } from "../../../src/fields/month.js";
import { week } from "../../../src/fields/week.js";
import { range } from "../../../src/fields/range.js";

const cases = [
  { module: number, type: "number", htmlType: "number", sample: "42" },
  { module: email, type: "email", htmlType: "email", sample: "a@b.com" },
  { module: url, type: "url", htmlType: "url", sample: "https://example.com" },
  { module: tel, type: "tel", htmlType: "tel", sample: "555-1234" },
  { module: password, type: "password", htmlType: "password", sample: "secret" },
  { module: date, type: "date", htmlType: "date", sample: "2026-08-20" },
  { module: time, type: "time", htmlType: "time", sample: "09:07" },
  { module: datetime, type: "datetime", htmlType: "datetime-local", sample: "2026-08-20T09:07" },
  { module: month, type: "month", htmlType: "month", sample: "2026-08" },
  { module: week, type: "week", htmlType: "week", sample: "2026-W34" },
];

describe.each(cases)("$type field", ({ module, type, htmlType, sample }) => {
  const field = { id: `f-${type}`, type, label: `Label ${type}`, required: true };

  it(`renders an <input type="${htmlType}">`, () => {
    const wrapper = module.render(field, null);
    const input = wrapper.querySelector(`input[type="${htmlType}"]`);
    expect(input).not.toBeNull();
    expect(input.id).toBe(field.id);
  });

  it("round-trips getValue/setValue", () => {
    const wrapper = module.render(field, null);
    module.setValue(wrapper, sample);
    expect(module.getValue(wrapper)).toBe(sample);
  });

  it("required validation fails when empty", () => {
    expect(module.validate(field, "")).not.toBe(true);
  });

  it("required validation passes when filled", () => {
    expect(module.validate(field, "value")).toBe(true);
  });
});

describe("range field", () => {
  const field = { id: "slider", type: "range", label: "Slider" };

  it("renders an <input type=range>", () => {
    const wrapper = range.render(field, 50);
    expect(wrapper.querySelector('input[type="range"]')).not.toBeNull();
  });

  it("always validates true (always has a value)", () => {
    expect(range.validate(field, "")).toBe(true);
  });
});
