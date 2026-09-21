import { describe, it, expect, vi } from "vitest";
import { renderTabs, selectTab, showWorksheetPanel } from "../../src/core/navigation.js";

const worksheets = [{ title: "Worksheet 1" }, { title: "Worksheet 2" }, { title: "Worksheet 3" }];

describe("renderTabs", () => {
  it("renders one tab per worksheet with an explicit index attribute", () => {
    const nav = renderTabs(worksheets);
    const tabs = nav.querySelectorAll(".wb-tab");
    expect(tabs.length).toBe(3);
    tabs.forEach((tab, i) => expect(tab.dataset.workbookTabIndex).toBe(String(i)));
  });

  it("marks the active index as selected", () => {
    const nav = renderTabs(worksheets, { activeIndex: 1 });
    const tabs = nav.querySelectorAll(".wb-tab");
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(tabs[0].getAttribute("aria-selected")).toBe("false");
  });

  it("calls onSelect with the clicked tab's index, including tabs beyond the second", () => {
    const onSelect = vi.fn();
    const nav = renderTabs(worksheets, { onSelect });
    const tabs = nav.querySelectorAll(".wb-tab");
    tabs[2].click();
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});

describe("selectTab", () => {
  it("updates aria-selected and active class based on index, not DOM position", () => {
    const nav = renderTabs(worksheets);
    selectTab(nav, 2);
    const tabs = nav.querySelectorAll(".wb-tab");
    expect(tabs[2].getAttribute("aria-selected")).toBe("true");
    expect(tabs[2].classList.contains("wb-tab-active")).toBe(true);
    expect(tabs[0].classList.contains("wb-tab-active")).toBe(false);
  });
});

describe("showWorksheetPanel", () => {
  it("shows only the panel matching the given index", () => {
    const panels = [0, 1, 2].map((i) => {
      const el = document.createElement("div");
      el.dataset.workbookPanelIndex = String(i);
      return el;
    });
    showWorksheetPanel(panels, 1);
    expect(panels[0].hidden).toBe(true);
    expect(panels[1].hidden).toBe(false);
    expect(panels[2].hidden).toBe(true);
  });
});
