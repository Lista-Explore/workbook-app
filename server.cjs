// Local preview must revalidate modules so Download uses the current exporter.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const mime = require('mime-types');
const root = __dirname;
// During local authoring the user's supplied stylesheet is the source of truth,
// not a second copy that silently drifts away from it. The repository copy is
// retained for deployments on machines where that source file is unavailable.
const localBrandStylesheet = process.env.SAVANNA_STYLESHEET || '/Users/lista/Documents/DS-Modularisation/savanna-styles-FIT.css';
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  let target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  if (url.pathname === '/builder/savanna-styles-FIT.css' && fs.existsSync(localBrandStylesheet)) {
    target = localBrandStylesheet;
  }
  fs.readFile(target, (error, data) => {
    res.setHeader('Cache-Control', 'no-store');
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.setHeader('Content-Type', mime.lookup(target) || 'application/octet-stream');
    res.end(data);
  });
}).listen(4173, '127.0.0.1', () => console.log('Workbook: http://127.0.0.1:4173/builder/'));
