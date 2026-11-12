// Format block structure without inserting whitespace into inline text or code.
const BLOCKS = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'details', 'summary', 'fieldset', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const PRESERVE = new Set(['pre', 'textarea', 'script', 'style']);

export function serializeWorkbookHtml(element) {
  const root = element.cloneNode(true);
  // Whitespace-only paragraphs imported from pasted documents are not content.
  // Keep explicit line breaks, styled spacers, anchors and editor placeholders.
  root.querySelectorAll('.wb-content p').forEach(p => {
    if (!p.attributes.length && !p.children.length && !p.textContent.trim()) p.remove();
  });
  function format(el, depth) {
    const indent = '  '.repeat(depth);
    const tag = el.localName;
    if (PRESERVE.has(tag) || /white-space\s*:\s*(pre|break-spaces)/i.test(el.getAttribute('style') || '')) return indent + el.outerHTML;
    const children = [...el.childNodes];
    const elements = [...el.children];
    const hasText = children.some(n => n.nodeType === 3 && n.textContent.trim());
    // Browser serialization escapes text and attributes and preserves inline
    // adjacency (e.g. word<strong>s</strong>) and meaningful spaces exactly.
    if (hasText || !elements.length || !elements.every(child => BLOCKS.has(child.localName))) return indent + el.outerHTML;
    const shell = el.cloneNode(false).outerHTML;
    const opening = shell.slice(0, shell.indexOf('>') + 1);
    return `${indent}${opening}\n${elements.map(child => format(child, depth + 1)).join('\n')}\n${indent}</${tag}>`;
  }
  return format(root, 0);
}
