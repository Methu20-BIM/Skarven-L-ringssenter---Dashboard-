/**
 * files.js — IFC filhåndtering
 * ═══════════════════════════════════════════════════════════
 *
 *  Prioritert rekkefølge for å hente IFC-filer:
 *
 *  1. SERVER-MODUS (lokal utvikling)
 *     node server.js serverer /ifc/<filnavn> fra lokal IFC-mappe.
 *
 *  2. STATISK WEB-MODUS (GitHub Pages / Azure Static Web Apps)
 *     Henter IFC-filer fra ../IFC/<filnavn> relativt til HTML-siden.
 *     Fungerer uten server så lenge IFC-filene ligger i repoet.
 *
 *  3. MAPPE-VELGER / ONEDRIVE-SYNK (fallback)
 *     File System Access API + IndexedDB — brukeren velger
 *     sin lokalt synkroniserte OneDrive IFC-mappe én gang.
 *     Tillatelsen huskes til neste gang.
 *     Chrome/Edge støttes fullt. Firefox: bruk fil-knappen.
 *
 * ══════════════════════════════════════════════════════════
 */

const IFC_FILE_MAP = {
  'Fischer-Nikolai_SL1-B_E-2026.ifc':    { group: 'ark',      member: 'Fischer' },
  'Saelid-Kristoffer_SL1-A_E-2026.ifc':  { group: 'ark',      member: 'Sælid'   },
  'Castro-Maria_LARK_E-2026.ifc':        { group: 'lark',     member: 'Castro'  },
  'Kilinc-Kaan_RIE_SL1-B_E-2026.ifc':   { group: 'rie',      member: 'Kilinc'  },
  'Thurairajah-Methuban_VA_E-2026.ifc':  { group: 'methuban', member: 'VA'      },
  'Thurairajah-Methuban_VEG_E-2026.ifc': { group: 'methuban', member: 'VEG'     },
};

/* ─── Relativ sti til IFC-mappen fra HTML/-katalogen ────────
   På GitHub Pages / Azure Static Web Apps:
     HTML/index.html → ../IFC/filnavn.ifc
   Endre denne hvis du legger IFC-filene et annet sted.    */
const STATIC_IFC_BASE = '../IFC/';

/* ═══════════════════════════════════════════════════════════
   IndexedDB-hjelper (kun for mappe-velger fallback)
════════════════════════════════════════════════════════════ */
const _DB_NAME  = 'bim-dashboard-v1';
const _DB_STORE = 'fs-handles';
const _DIR_KEY  = 'ifc-folder';

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(_DB_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
async function _saveHandle(h) {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(_DB_STORE, 'readwrite');
    const r  = tx.objectStore(_DB_STORE).put(h, _DIR_KEY);
    r.onsuccess = () => res();
    r.onerror   = e => rej(e.target.error);
  });
}
async function _loadHandle() {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(_DB_STORE, 'readonly');
    const r  = tx.objectStore(_DB_STORE).get(_DIR_KEY);
    r.onsuccess = e => res(e.target.result ?? null);
    r.onerror   = e => rej(e.target.error);
  });
}

/* ═══════════════════════════════════════════════════════════
   FolderManager
════════════════════════════════════════════════════════════ */
class FolderManager {
  constructor() {
    this._handle   = null;   // FileSystemDirectoryHandle (mappe-velger)
    this._mode     = null;   // 'server' | 'static' | 'picker'
    this._serverOK = false;
  }

  /* ── Prøv gjenopprett fra forrige økt ───────────────────
     Prioritet: server → statisk web → lagret mappe-handle
     Returnerer: 'granted' | 'prompt' | 'none'
  ────────────────────────────────────────────────────────── */
  async tryRestore() {

    /* 1. Server-modus (lokal node server.js) */
    try {
      const r = await fetch('/api/ifc-ready', { cache: 'no-store' });
      if (r.ok) {
        const { available } = await r.json();
        if (available) {
          this._serverOK = true;
          this._mode     = 'server';
          return 'granted';
        }
      }
    } catch (_) { /* ingen server — prøver neste */ }

    /* 2. Statisk web-modus (GitHub Pages / Azure / Netlify)
       Tester om en IFC-fil finnes på den relative stien.    */
    try {
      const testName = Object.keys(IFC_FILE_MAP)[0];
      const testUrl  = STATIC_IFC_BASE + encodeURIComponent(testName);
      const r = await fetch(testUrl, { method: 'HEAD', cache: 'no-store' });
      if (r.ok) {
        this._mode = 'static';
        return 'granted';
      }
    } catch (_) { /* IFC-filer ikke i repoet — prøver mappe-velger */ }

    /* 3. Lagret mappe-handle fra IndexedDB (OneDrive-synk) */
    try {
      const handle = await _loadHandle();
      if (!handle) return 'none';

      let perm = await handle.queryPermission({ mode: 'read' });
      if (perm === 'prompt') {
        perm = await handle.requestPermission({ mode: 'read' }).catch(() => 'denied');
      }
      if (perm === 'granted') {
        this._handle = handle;
        this._mode   = 'picker';
        return 'granted';
      }
      return 'prompt';
    } catch (_) {
      return 'none';
    }
  }

  /* ── Bruker velger mappe manuelt (OneDrive-synk fallback) ─
     Brukes bare når statisk web-modus ikke er tilgjengelig.
  ────────────────────────────────────────────────────────── */
  async pickFolder() {
    if (!window.showDirectoryPicker) {
      throw new Error(
        'File System Access API støttes ikke i denne nettleseren.\n' +
        'Bruk Chrome 86+ eller Edge 86+.'
      );
    }
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    this._handle = handle;
    this._mode   = 'picker';
    await _saveHandle(handle);
    return handle;
  }

  /* ── Henter én IFC-fil ──────────────────────────────────
     Server-modus:     fetch /ifc/<filnavn>
     Statisk web-modus: fetch ../IFC/<filnavn>
     Mappe-modus:      File System Access API
  ────────────────────────────────────────────────────────── */
  async getFile(filename) {

    /* Server-modus */
    if (this._mode === 'server') {
      const url = '/ifc/' + encodeURIComponent(filename);
      const r   = await fetch(url);
      if (!r.ok) throw new Error(`Serveren svarte ${r.status} for "${filename}"`);
      const blob = await r.blob();
      return new File([blob], filename, { type: 'application/octet-stream' });
    }

    /* Statisk web-modus (GitHub Pages / Azure) */
    if (this._mode === 'static') {
      const url = STATIC_IFC_BASE + encodeURIComponent(filename);
      const r   = await fetch(url);
      if (!r.ok) throw new Error(
        `IFC-filen "${filename}" ble ikke funnet på ${url}.\n` +
        `Sjekk at filen er lastet opp til IFC/-mappen i repoet.`
      );
      const blob = await r.blob();
      return new File([blob], filename, { type: 'application/octet-stream' });
    }

    /* Mappe-velger-modus (OneDrive-synk) */
    if (!this._handle) {
      throw new Error('Ingen mappe valgt — klikk "Velg IFC-mappe" først');
    }
    try {
      const fh = await this._handle.getFileHandle(filename);
      return fh.getFile();
    } catch (_) {
      throw new Error(
        `"${filename}" ikke funnet i mappen "${this._handle.name}". ` +
        `Sjekk at filnavnet er riktig (store/små bokstaver teller).`
      );
    }
  }

  async hasFile(filename) {
    if (this._mode === 'server') {
      try {
        const r = await fetch('/ifc/' + encodeURIComponent(filename), { method: 'HEAD' });
        return r.ok;
      } catch (_) { return false; }
    }
    if (this._mode === 'static') {
      try {
        const r = await fetch(STATIC_IFC_BASE + encodeURIComponent(filename), { method: 'HEAD' });
        return r.ok;
      } catch (_) { return false; }
    }
    if (!this._handle) return false;
    try { await this._handle.getFileHandle(filename); return true; }
    catch (_) { return false; }
  }

  async listIFC() {
    if (this._mode === 'server' || this._mode === 'static') return Object.keys(IFC_FILE_MAP);
    if (!this._handle) return [];
    const out = [];
    for await (const [name] of this._handle.entries()) {
      if (name.toLowerCase().endsWith('.ifc')) out.push(name);
    }
    return out.sort();
  }

  get isReady() {
    if (this._mode === 'server') return this._serverOK;
    if (this._mode === 'static') return true;
    return !!this._handle;
  }
  get folderName() {
    if (this._mode === 'server') return '📡 Autolastet fra server';
    if (this._mode === 'static') return '🌐 Lastet fra web';
    return this._handle?.name ?? null;
  }
  get mode()    { return this._mode; }
  get fileMap() { return IFC_FILE_MAP; }
}

window.folderManager  = new FolderManager();
window.IFC_FILE_MAP   = IFC_FILE_MAP;
