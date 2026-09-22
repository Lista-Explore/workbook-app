import { describe, it, expect } from "vitest";
import { checklist } from "../../../src/fields/checklist.js";

const field = {
  id: "steps",
  type: "checklist",
  label: "Steps",
  required: true,
  options: ["Read the brief", "Draft an outline", "Write the report"],
};

const lockedField = { ...field, sequentialLock: true };

describe("checklist field", () => {
  it("renders one checkbox per item", () => {
    const wrapper = checklist.render(field, []);
    expect(wrapper.querySelectorAll('.wb-checklist-item input[type="checkbox"]').length).toBe(3);
  });

  it("pre-checks values in the given array", () => {
    const wrapper = checklist.render(field, ["Read the brief"]);
    expect(checklist.getValue(wrapper)).toEqual(["Read the brief"]);
  });

  it("setValue replaces the checked set", () => {
    const wrapper = checklist.render(field, ["Read the brief"]);
    checklist.setValue(wrapper, ["Draft an outline"]);
    expect(checklist.getValue(wrapper)).toEqual(["Draft an outline"]);
  });

  it("required validation fails when nothing is checked", () => {
    expect(checklist.validate(field, [])).not.toBe(true);
    expect(checklist.validate(field, ["Read the brief"])).toBe(true);
  });

  it("shows a live 'X of N done' progress count", () => {
    const wrapper = checklist.render(field, []);
    expect(wrapper.querySelector(".wb-checklist-progress").textContent).toBe("0 of 3 done");

    const boxes = wrapper.querySelectorAll(".wb-checklist-item input");
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(wrapper.querySelector(".wb-checklist-progress").textContent).toBe("1 of 3 done");
  });

  it("without sequential lock, every item starts enabled", () => {
    const wrapper = checklist.render(field, []);
    const boxes = wrapper.querySelectorAll(".wb-checklist-item input");
    expect([...boxes].every((box) => !box.disabled)).toBe(true);
  });

  it("with sequential lock, only the first item starts enabled", () => {
    const wrapper = checklist.render(lockedField, []);
    const boxes = wrapper.querySelectorAll(".wb-checklist-item input");
    expect(boxes[0].disabled).toBe(false);
    expect(boxes[1].disabled).toBe(true);
    expect(boxes[2].disabled).toBe(true);
  });

  it("with sequential lock, checking item N unlocks item N+1", () => {
    const wrapper = checklist.render(lockedField, []);
    const boxes = wrapper.querySelectorAll(".wb-checklist-item input");
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(boxes[1].disabled).toBe(false);
    expect(boxes[2].disabled).toBe(true);
  });

  it("with sequential lock, unchecking item N re-locks (and un-checks) item N+1", () => {
    const wrapper = checklist.render(lockedField, ["Read the brief", "Draft an outline"]);
    const boxes = wrapper.querySelectorAll(".wb-checklist-item input");
    // Both start checked via pre-fill, but syncChecklistState only re-locks
    // on a live change event — uncheck the first item to trigger it.
    boxes[0].checked = false;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(boxes[1].disabled).toBe(true);
    expect(boxes[1].checked).toBe(false);
  });

  it("the reset button unchecks every item and fires a change event", () => {
    const wrapper = checklist.render(field, ["Read the brief", "Draft an outline"]);
    document.body.appendChild(wrapper);
    let changeFired = false;
    wrapper.addEventListener("change", () => (changeFired = true));

    wrapper.querySelector(".wb-checklist-reset").click();

    expect(checklist.getValue(wrapper)).toEqual([]);
    expect(changeFired).toBe(true);
    document.body.removeChild(wrapper);
  });
});
