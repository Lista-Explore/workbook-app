import { workbookHtml } from "../../../builder/src/ui/publish-panel.js";
import { domToConfig } from "../../../src/core/dom-config.js";
import { describe, it, expect } from "vitest";
import { content, contentText, repairContentHtmlSpacing, repairPdfTextSpacing } from "../../../src/fields/content.js";
import { BuilderState } from "../../../builder/src/builder-state.js";
import { DESIGNER_FIELD_TYPES, DISPLAY_ONLY_FIELD_TYPES } from "../../../src/fields/index.js";

describe("Content", () => {
  it("preserves formatted text through published HTML and reconstruction", () => {
    const html = '<p>Hello <strong>bold</strong> &amp; &lt;safe&gt; text.</p>';
    const config = { id: "book", title: "Book", worksheets: [{ id: "w", title: "Worksheet", sections: [{ id: "s", title: "Section", fields: [{ id: "c", type: "content", html }] }] }] };
    const host = document.createElement("div");
    host.innerHTML = workbookHtml(config);
    const restored = domToConfig(host.firstElementChild);
    expect(restored.worksheets[0].sections[0].fields[0].html).toBe(html);
  });
  it("preserves formatting while removing executable HTML", () => {
    const el = content.render({ id: "c", type: "content", html: '<h2>Title</h2><p style="color: red"><strong>Bold</strong></p><img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Link</a>' });
    expect(el.querySelector("h2").textContent).toBe("Title");
    expect(el.querySelector("strong").textContent).toBe("Bold");
    expect(el.querySelector("p").style.color).toBe("red");
    expect(el.querySelector("script")).toBeNull();
    expect(el.querySelector("img").hasAttribute("onerror")).toBe(false);
    expect(el.querySelector("a").hasAttribute("href")).toBe(false);
    expect(content.getValue(el)).toBeUndefined();
    expect(content.validate({ required: true })).toBe(true);
  });
  it("consolidates legacy blocks without losing IDs, placement, or literal text", () => {
    const state = new BuilderState({ worksheets: [{ id: "w", sections: [{ id: "s", fields: [
      { id: "h", type: "heading", label: "<Example>", column: 1 },
      { id: "i", type: "image", src: "https://example.com/a.png", alt: "Diagram", caption: "Caption" },
    ] }] }] });
    const [heading, image] = state.toConfig().worksheets[0].sections[0].fields;
    expect(heading).toMatchObject({ id: "h", type: "content", column: 1, html: "<h3>&lt;Example&gt;</h3>" });
    expect(image.html).toContain('alt="Diagram"');
    expect(image.html).toContain("<figcaption>Caption</figcaption>");
    expect(DESIGNER_FIELD_TYPES.filter(({ type }) => DISPLAY_ONLY_FIELD_TYPES.has(type))).toEqual([{ type: "content", name: "Content" }]);
    expect(contentText({ html: "<p>One</p><p>Two</p>" })).toBe("One\nTwo");
  });
  it("repairs PDF-generated joined words in content HTML and checklist text", () => {
    expect(repairContentHtmlSpacing("<p>The way you phrase it directlyshapes what you get back and gives yousomething useful asyou work.</p>"))
      .toBe("<p>The way you phrase it directly shapes what you get back and gives you something useful as you work.</p>");
    expect(repairPdfTextSpacing("Theyrange from basic prompts that onlyneed a task and use blocks the prompt uses,name the gaps."))
      .toBe("They range from basic prompts that only need a task and use blocks the prompt uses, name the gaps.");
    expect(repairPdfTextSpacing("8 years ofexperience in schedulingand support. Professionaltone. caregiving.Respond warm,forward-looking."))
      .toBe("8 years of experience in scheduling and support. Professional tone. caregiving. Respond warm, forward-looking.");
  });
});
