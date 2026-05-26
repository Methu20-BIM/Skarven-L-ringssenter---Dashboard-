/**
 * server.js — Skarven BIM Dashboard dev-server
 *
 * Kjør:   node server.js
 * Åpne:   http://localhost:7777/HTML/index.html
 *
 * Fungerer på alle PCs med Autodesk Desktop Connector —
 * IFC-mappen finnes alltid relativt til denne filen:
 *   ../../03 IFC/01 IN/
 *
 * MERK: COOP/COEP-headere settes IKKE (med vilje).
 *   web-ifc bruker da single-threaded WASM uten workers,
 *   noe som fungerer perfekt fra CDN uten bundler.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 7777;
const ROOT = __dirname;   // .../11 PWERBI/Methuban/

/* IFC-mappen er alltid 2 nivåer opp, deretter inn i 03 IFC/01 IN
   Dette er likt på alle PCer med Autodesk Desktop Connector.     */
const IFC_FOLDER = path.join(__dirname, '../../03 IFC/01 IN');
const IFC_OK     = fs.existsSync(IFC_FOLDER);

const MIME = {
  html: 'text/html; charset=utf-8',
  js:   'application/javascript',
  mjs:  'application/javascript',
  css:  'text/css',
  ifc:  'application/octet-stream',
  wasm: 'application/wasm',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  png:  'image/png',
  json: 'application/json',
};

const CORS = { 'Access-Control-Allow-Origin': '*' };

http.createServer((req, res) => {
  const raw     = decodeURIComponent(req.url.split('?')[0]);
  const urlPath = raw === '/' ? '/HTML/index.html' : raw;

  /* ── /api/ifc-ready  ──────────────────────────────────────
     Forteller klienten om serveren finner IFC-mappen.       */
  if (urlPath === '/api/ifc-ready') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ available: IFC_OK, folder: IFC_OK ? IFC_FOLDER : null }));
    return;
  }

  /* ── /ifc/<filnavn>  ──────────────────────────────────────
     Serverer én IFC-fil direkte fra lokal IFC-mappe.        */
  if (urlPath.startsWith('/ifc/')) {
    if (!IFC_OK) {
      res.writeHead(503, CORS);
      res.end('IFC-mappe ikke funnet');
      return;
    }
    const filename = path.basename(urlPath.slice(5)); // hindre path traversal
    const filePath = path.join(IFC_FOLDER, filename);
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', ...CORS });
      res.end(data);
    } catch (_) {
      res.writeHead(404, CORS);
      res.end('Fil ikke funnet: ' + filename);
    }
    return;
  }

  /* ── Statiske filer (HTML/CSS/JS/bilder) ─────────────────── */
  const filePath = path.join(ROOT, urlPath);
  try {
    const data = fs.readFileSync(filePath);
    const ext  = path.extname(filePath).slice(1).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', ...CORS });
    res.end(data);
  } catch (_) {
    res.writeHead(404, CORS);
    res.end('Not found: ' + urlPath);
  }

}).listen(PORT, () => {
  console.log('\n✅  Skarven BIM Dashboard');
  console.log('   http://localhost:' + PORT + '/HTML/index.html');
  if (IFC_OK) {
    console.log('   IFC-mappe: ' + IFC_FOLDER);
  } else {
    console.log('   ⚠️  IFC-mappe ikke funnet — bruk "Velg IFC-mappe" i dashboardet');
    console.log('   Forventet sti: ' + IFC_FOLDER);
  }
  console.log();
});
