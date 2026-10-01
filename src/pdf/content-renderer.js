import { sanitizeContent } from '../fields/content.js';
import html2canvas from '../vendor/html2canvas.esm.js';

// Render rich HTML with the same browser/CSS engine used by the workbook.
// Widths are PDF points; CSS pixels are converted at 96 dpi. Content remains
// display-only, while answer controls are created separately as AcroForm fields.
export async function renderContent(pdfDoc, html, width) {
  if (!document.createRange || !document.body || !document.documentElement.getBoundingClientRect().width) return null;
  const host = document.createElement('div');
  host.className = 'lms-workbook';
  Object.assign(host.style, { position: 'absolute', left: '-100000px', top: '0', width: `${width / .75}px`, background: '#fff', padding: '0', margin: '0', pointerEvents: 'none' });
  const content = document.createElement('div');
  content.className = 'wb-content';
  content.innerHTML = sanitizeContent(html);
  Object.assign(content.style, { display: 'flow-root', width: '100%', overflowWrap: 'anywhere' });
  host.append(content);
  document.body.append(host);
  try {
    await document.fonts?.ready;
    await Promise.all(Array.from(content.querySelectorAll('img')).map(async (img) => {
      img.crossOrigin = 'anonymous';
      try { await img.decode(); }
      catch { const label = document.createElement('span'); label.textContent = `[Image unavailable${img.alt ? `: ${img.alt}` : ''}]`; img.replaceWith(label); }
    }));
    const rect = content.getBoundingClientRect();
    if (!rect.height) return { height: 0, slices: [] };
    // Text line rectangles prevent page cuts through glyphs. Prefer keeping
    // images and table rows whole, but allow oversized rows to split at lines.
    const protectedRanges = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(walker.currentNode);
      for (const box of range.getClientRects()) protectedRanges.push([box.top - rect.top, box.bottom - rect.top]);
    }
    for (const element of content.querySelectorAll('img, table, tr, pre, blockquote, h1, h2, h3, h4, h5, h6')) {
      const box = element.getBoundingClientRect();
      if (box.height < 600) protectedRanges.push([box.top - rect.top, box.bottom - rect.top]);
    }
    const canvas = await html2canvas(content, { scale: 2, backgroundColor: '#fff', useCORS: true, logging: false, windowWidth: document.documentElement.clientWidth });
    const scale = canvas.height / rect.height;
    // Short strips let the PDF paginator use remaining page space, without
    // imposing arbitrary whole-paragraph or whole-field page breaks.
    const cuts = [0];
    let start = 0;
    while (start < rect.height) {
      let end = Math.min(start + 160, rect.height);
      if (end < rect.height) {
        let changed = true;
        while (changed) {
          changed = false;
          for (const [top, bottom] of protectedRanges) {
            if (top < end && bottom > end && top > start + 1) { end = top; changed = true; }
          }
        }
        if (end <= start + 1) end = Math.min(start + 160, rect.height);
        // A row/image beginning at this strip's start must stay together.
        for (const [top, bottom] of protectedRanges) if (top <= start + 1 && bottom > end) end = Math.min(bottom, rect.height);
      }
      cuts.push(end); start = end;
    }
    const slices = [];
    for (let i = 1; i < cuts.length; i++) {
      const top = Math.round(cuts[i - 1] * scale), bottom = Math.round(cuts[i] * scale);
      if (bottom <= top) continue;
      const tile = document.createElement('canvas'); tile.width = canvas.width; tile.height = bottom - top;
      tile.getContext('2d').drawImage(canvas, 0, top, canvas.width, tile.height, 0, 0, canvas.width, tile.height);
      slices.push({ image: await pdfDoc.embedPng(tile.toDataURL('image/png')), height: tile.height / scale * .75 });
    }
    return { height: slices.reduce((sum, slice) => sum + slice.height, 0), slices };
  } finally { host.remove(); }
}
