import { describe, it, expect } from 'vitest';
import { serializeWorkbookHtml } from '../../builder/src/ui/html-serializer.js';
import { workbookHtml } from '../../builder/src/ui/publish-panel.js';
import { domToConfig } from '../../src/core/dom-config.js';

function element(html) {
  const holder = document.createElement('div'); holder.innerHTML = html;
  return holder.firstElementChild;
}
describe('HTML export serialization', () => {
  it('cleans pasted empty paragraphs and consistently indents block content without mutating the source', () => {
    const source = element('<div class="wb-content"><p>Title</p><p> </p>\n <blockquote><p>Example</p></blockquote><p>&nbsp;</p></div>');
    expect(serializeWorkbookHtml(source)).toBe('<div class="wb-content">\n  <p>Title</p>\n  <blockquote>\n    <p>Example</p>\n  </blockquote>\n</div>');
    expect(source.querySelectorAll('p').length).toBe(4);
  });
  it('preserves inline adjacency, spaces, explicit breaks and preformatted content', () => {
    const source = element('<div class="wb-content"><p>A <strong>bold</strong> word<em>s</em>.</p><p><br></p><pre>  a\n    b &lt;c&gt;</pre><p style="height: 2em"> </p></div>');
    const output = element(serializeWorkbookHtml(source));
    expect([...output.children].map(n => n.outerHTML)).toEqual([...source.children].map(n => n.outerHTML));
  });
  it('escapes labels and option text through publish and DOM reconstruction', () => {
    const label = 'Use <img src=x onerror=alert(1)> & explain';
    const config = { id: 'safe', title: 'A < B & C', worksheets: [{ id: 'ws', title: 'Sheet', sections: [{ id: 's', title: 'Section', fields: [{ id: 'answer', type: 'radio', label, options: ['<b>literal</b>', 'A & B'] }] }] }] };
    const html = workbookHtml(config);
    const root = element(html);
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.wb-title').textContent).toBe(config.title);
    const field = domToConfig(root).worksheets[0].sections[0].fields[0];
    expect(field.label).toBe(label);
    expect(field.options).toEqual(config.worksheets[0].sections[0].fields[0].options);
  });
  it('is stable across repeated serialization', () => {
    const once = serializeWorkbookHtml(element('<div><div class="wb-content"><p>A &amp; B</p> <p> </p><ul><li>One</li><li>Two</li></ul></div></div>'));
    expect(serializeWorkbookHtml(element(once))).toBe(once);
  });
});
