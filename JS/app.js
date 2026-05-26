/* ═══════════════════════════════════════════════════════════
   app.js — Skarven BIM Dashboard
   Avhenger av window.folderManager (files.js) og
   window.BIMViewer (viewer.js) — begge ES-moduler
════════════════════════════════════════════════════════════ */

/* ─── Vent til ES-modul er klar på window ───────────────── */
function waitFor(getter, timeout = 12000) {
  if (getter()) return Promise.resolve(getter());
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const v = getter();
      if (v) { clearInterval(id); resolve(v); }
      else if (Date.now() - t0 > timeout) {
        clearInterval(id);
        reject(new Error('Modul ikke lastet: ' + getter.toString()));
      }
    }, 80);
  });
}

/* ═══════════════════════════════════════════════════════════
   GRUPPE- OG MEDLEMSDATA
   photo = filnavn i ../PB gruppemedlemmer/
════════════════════════════════════════════════════════════ */
const groups = {
  ark: {
    members: [
      {
        tabLabel:   'Fischer',
        firstName:  'Nikolai',
        lastName:   'Fischer',
        discipline: 'Arkitektur (ARK) — SL1-B',
        problem:    'Problemstilling kommer her.',
        file:       'Fischer-Nikolai_SL1-B_E-2026.ifc',
        photo:      '../PB gruppemedlemmer/Nikolai.jpg'
      },
      {
        tabLabel:   'Sælid',
        firstName:  'Kristoffer Frydenlund',
        lastName:   'Sælid',
        discipline: 'Arkitektur (ARK) — SL1-A',
        problem:    'Problemstilling kommer her.',
        file:       'Saelid-Kristoffer_SL1-A_E-2026.ifc',
        photo:      '../PB gruppemedlemmer/Kristoffer.jpg'
      }
    ]
  },
  lark: {
    members: [
      {
        tabLabel:   'Castro',
        firstName:  'Maria Romina',
        lastName:   'Castro Mendoza',
        discipline: 'Landskapsarkitektur (LARK)',
        problem:    'Problemstilling kommer her.',
        file:       'Castro-Maria_LARK_E-2026.ifc',
        photo:      '../PB gruppemedlemmer/Romina.jpg'
      }
    ]
  },
  rie: {
    members: [
      {
        tabLabel:   'Kilinc',
        firstName:  'Kaan Efe',
        lastName:   'Kilinc',
        discipline: 'Elektro (RIE) — SL1-B',
        problem:    'Problemstilling kommer her.',
        file:       'Kilinc-Kaan_RIE_SL1-B_E-2026.ifc',
        photo:      '../PB gruppemedlemmer/Kaan.jpg'
      }
    ]
  },
  methuban: {
    members: [
      {
        tabLabel:   'VA',
        firstName:  'Methuban',
        lastName:   'Thurairajah',
        discipline: 'Vann og avløp (VA)',
        problem:    'Problemstilling kommer her.',
        file:       'Thurairajah-Methuban_VA_E-2026.ifc',
        photo:      '../PB gruppemedlemmer/Methuban.jpg'
      },
      {
        tabLabel:   'VEG',
        firstName:  'Methuban',
        lastName:   'Thurairajah',
        discipline: 'Veg (VEG)',
        problem:    'Problemstilling kommer her.',
        file:       'Thurairajah-Methuban_VEG_E-2026.ifc',
        photo:      '../PB gruppemedlemmer/Methuban.jpg'
      }
    ]
  }
};

/* ═══════════════════════════════════════════════════════════
   DOM-REFERANSER
════════════════════════════════════════════════════════════ */
const detailPanel       = document.getElementById('memberDetail');
const detailTabs        = document.getElementById('detailTabs');
const closeBtn          = document.getElementById('closeDetail');
const detailPhoto       = document.getElementById('detailPhoto');
const detailPhotoWrap   = document.getElementById('detailPhotoWrap');
const ifcViewerStatus   = document.getElementById('ifcViewerStatus');
const ifcErrorHint      = document.getElementById('ifcErrorHint');

const ifcViewerWrap     = document.getElementById('ifcViewerWrap');
const ifcDropZone       = document.getElementById('ifcDropZone');
const dropExpectedFile  = document.getElementById('dropExpectedFile');
const ifcLoadingOverlay = document.getElementById('ifcLoadingOverlay');
const ifcLoadingTitle   = document.getElementById('ifcLoadingTitle');
const ifcLoadingFile    = document.getElementById('ifcLoadingFile');
const ifcErrorOverlay   = document.getElementById('ifcErrorOverlay');
const ifcErrorMsg       = document.getElementById('ifcErrorMsg');
const ifcPropsPanel     = document.getElementById('ifcPropsPanel');
const ifcFileInput      = document.getElementById('ifcFileInput');
const loadIfcBtn        = document.getElementById('loadIfcBtn');
const fitCameraBtn      = document.getElementById('fitCameraBtn');
const dropZoneBtn       = document.getElementById('dropZoneBtn');
const retryBtn          = document.getElementById('retryBtn');
const pickFolderBtn     = document.getElementById('pickFolderBtn');
const folderDot         = document.getElementById('folderDot');
const folderLabel       = document.getElementById('folderLabel');
const lsteps            = [1,2,3,4].map(n => document.getElementById(`lstep${n}`));

/* ═══════════════════════════════════════════════════════════
   MAPPE-STATUS UI
════════════════════════════════════════════════════════════ */
function setFolderUI(state, label) {
  if (folderDot)   folderDot.className     = `folder-dot folder-dot--${state}`;
  if (folderLabel) folderLabel.textContent = label;
  if (pickFolderBtn) {
    /* Skjul knappen i server-modus (auto-tilkobling) */
    const isServer = window.folderManager?.mode === 'server';
    pickFolderBtn.style.display = (state === 'ready' && isServer) ? 'none' : '';
  }
}

/* ═══════════════════════════════════════════════════════════
   SISTE VALG — husker sist åpnet gruppe + fane
════════════════════════════════════════════════════════════ */
const _LS_GROUP  = 'skarven_lastGroup';
const _LS_MEMBER = 'skarven_lastMember';

function saveLastSelection(groupKey, memberIndex) {
  try {
    localStorage.setItem(_LS_GROUP,  groupKey);
    localStorage.setItem(_LS_MEMBER, String(memberIndex ?? 0));
  } catch (_) {}
}

function loadLastSelection() {
  try {
    return {
      group:  localStorage.getItem(_LS_GROUP)  ?? null,
      member: parseInt(localStorage.getItem(_LS_MEMBER) ?? '0', 10),
    };
  } catch (_) { return { group: null, member: 0 }; }
}

/* ═══════════════════════════════════════════════════════════
   VIEWER TILSTAND
════════════════════════════════════════════════════════════ */
let viewer       = null;
let activeMember = null;

function showDropZone() {
  ifcDropZone.hidden        = false;
  ifcLoadingOverlay.hidden  = true;
  ifcErrorOverlay.hidden    = true;
  ifcPropsPanel.hidden      = true;
  fitCameraBtn.disabled     = true;
}

function showLoading(title, filename) {
  ifcDropZone.hidden        = false;
  ifcLoadingOverlay.hidden  = false;
  ifcErrorOverlay.hidden    = true;
  ifcLoadingTitle.textContent = title    || 'Laster…';
  ifcLoadingFile.textContent  = filename || '';
  lsteps.forEach(s => s?.classList.remove('active','done'));
  lsteps[0]?.classList.add('active');
}

function setStep(idx) {
  lsteps.forEach((s,i) => {
    if (!s) return;
    s.classList.remove('active','done');
    if (i < idx)   s.classList.add('done');
    if (i === idx) s.classList.add('active');
  });
}

function showError(msg, hint = '') {
  ifcDropZone.hidden       = true;
  ifcLoadingOverlay.hidden = true;
  ifcErrorOverlay.hidden   = false;
  ifcPropsPanel.hidden     = true;
  ifcErrorMsg.textContent  = msg || 'Ukjent feil';
  if (ifcErrorHint) ifcErrorHint.textContent = hint;
}

function showLoaded() {
  ifcDropZone.hidden       = true;
  ifcLoadingOverlay.hidden = true;
  ifcErrorOverlay.hidden   = true;
  fitCameraBtn.disabled    = false;
  lsteps[3]?.classList.add('done');
}

/* ═══════════════════════════════════════════════════════════
   LAST IFC-FIL
════════════════════════════════════════════════════════════ */
async function loadIFCFile(file) {
  if (!file?.name.toLowerCase().endsWith('.ifc')) {
    showError('Ugyldig filtype — kun .ifc støttes'); return;
  }
  showLoading('Forbereder viewer…', file.name);
  try {
    if (!viewer) {
      setStep(0);
      ifcLoadingTitle.textContent = 'Initialiserer 3D-viewer…';
      const BIMViewer = await waitFor(() => window.BIMViewer);
      viewer = new BIMViewer('ifcViewerWrap');
    }
    if (!viewer.initialized) await viewer.init();

    // Koble status-callback til UI-linjen
    viewer.onStatusChange     = msg => { if (ifcViewerStatus) ifcViewerStatus.textContent = msg; };
    viewer.onPropertiesSelect = renderProperties;

    setStep(1); ifcLoadingTitle.textContent = 'Parser IFC-fil…';
    await delay(40);

    setStep(2); ifcLoadingTitle.textContent = 'Bygger 3D-geometri…';
    await viewer.loadFile(file);

    setStep(3); showLoaded();

  } catch (err) {
    console.error('[app] IFC-feil:', err);
    const msg = err.message ?? String(err);
    // Gi hint om løsning basert på feiltype
    let hint = '';
    if (msg.includes('SharedArrayBuffer') || msg.includes('COOP') || msg.includes('COEP')) {
      hint = '💡 Åpne filen via VS Code Live Server (høyreklikk HTML → Open with Live Server) for å løse dette.';
    } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
      hint = '💡 Sjekk internettforbindelsen — viewer-biblioteket lastes fra CDN (esm.sh).';
    } else if (msg.includes('importmap') || msg.includes('module')) {
      hint = '💡 Bruk Chrome 89+ eller Edge 89+. Importmap støttes ikke i eldre nettlesere.';
    }
    showError(msg, hint);
  }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

/* ═══════════════════════════════════════════════════════════
   AUTO-LAST FRA MAPPE
════════════════════════════════════════════════════════════ */
async function autoLoad(filename) {
  const fm = window.folderManager;
  if (!fm?.isReady) return false;
  try {
    const file = await fm.getFile(filename);
    await loadIFCFile(file);
    return true;
  } catch (err) {
    console.warn('[app] Auto-load feilet:', err.message);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════
   EGENSKAPS-PANEL
════════════════════════════════════════════════════════════ */
function renderProperties(props) {
  if (!props) { ifcPropsPanel.hidden = true; return; }
  ifcPropsPanel.hidden = false;
  document.getElementById('propType').textContent      = props.type     ?? '—';
  document.getElementById('propName').textContent      = props.name     ?? '—';
  document.getElementById('propGlobalId').textContent  = props.globalId ?? '—';
  document.getElementById('propTag').textContent       = props.tag      ?? '—';
  document.getElementById('propExpressId').textContent = props.id       ?? '—';
}

/* ═══════════════════════════════════════════════════════════
   RENDER MEMBER — fyller detaljpanel
════════════════════════════════════════════════════════════ */
function renderMember(member) {
  activeMember = member;

  detailPanel.querySelector('[data-field="firstName"]').textContent  = member.firstName;
  detailPanel.querySelector('[data-field="lastName"]').textContent   = member.lastName;
  detailPanel.querySelector('[data-field="discipline"]').textContent = member.discipline;
  detailPanel.querySelector('[data-field="problem"]').textContent    = member.problem;
  detailPanel.querySelector('[data-field="file"]').textContent       = member.file;

  /* Profilbilde — vises kun i detaljpanel etter kortklikk */
  if (detailPhoto && detailPhotoWrap) {
    if (member.photo) {
      detailPhoto.src = member.photo;
      detailPhoto.alt = member.firstName + ' ' + member.lastName;
      detailPhotoWrap.style.display = '';
    } else {
      detailPhotoWrap.style.display = 'none';
    }
  }

  if (dropExpectedFile) dropExpectedFile.textContent = member.file;
  showDropZone();
  renderProperties(null);
}

/* ═══════════════════════════════════════════════════════════
   ÅPNE GRUPPE
════════════════════════════════════════════════════════════ */
async function openGroup(key, startMemberIndex = 0) {
  const group = groups[key];
  if (!group) return;

  const idx = Math.min(startMemberIndex, group.members.length - 1);

  /* Bygg faner */
  detailTabs.innerHTML = '';
  if (group.members.length > 1) {
    group.members.forEach((m, i) => {
      const tab = document.createElement('button');
      tab.className   = 'detail-tab' + (i === idx ? ' active' : '');
      tab.textContent = m.tabLabel;
      tab.addEventListener('click', async () => {
        detailTabs.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        saveLastSelection(key, i);
        renderMember(m);
        await autoLoad(m.file);
      });
      detailTabs.appendChild(tab);
    });
  }

  saveLastSelection(key, idx);
  renderMember(group.members[idx]);
  detailPanel.hidden = false;
  detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /* Auto-last valgt fil */
  await autoLoad(group.members[idx].file);
}

/* ═══════════════════════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════════════════════════ */

/* Member-kort */
document.querySelectorAll('.member-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.member-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    openGroup(card.dataset.group);
  });
});

/* Lukk detaljpanel */
closeBtn?.addEventListener('click', () => {
  detailPanel.hidden = true;
  document.querySelectorAll('.member-card').forEach(c => c.classList.remove('active'));
  renderProperties(null);
});

/* Velg IFC-mappe */
pickFolderBtn?.addEventListener('click', async () => {
  const fm = window.folderManager;
  if (!fm) { return; }
  try {
    setFolderUI('loading', 'Velger mappe…');
    await fm.pickFolder();
    setFolderUI('ready', '📁 ' + fm.folderName);
    if (activeMember) await autoLoad(activeMember.file);
  } catch (err) {
    if (err.name === 'AbortError') setFolderUI('none',  'Ingen mappe valgt');
    else                           setFolderUI('error', err.message);
  }
});

/* Fil-knapper */
loadIfcBtn?.addEventListener('click',  () => ifcFileInput?.click());
dropZoneBtn?.addEventListener('click', () => ifcFileInput?.click());

ifcFileInput?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (file) await loadIFCFile(file);
  ifcFileInput.value = '';
});

fitCameraBtn?.addEventListener('click', () => viewer?.fitToModel());

retryBtn?.addEventListener('click', () => {
  showDropZone();
  if (activeMember && dropExpectedFile) dropExpectedFile.textContent = activeMember.file;
});

/* Drag & Drop */
ifcViewerWrap?.addEventListener('dragover', e => {
  e.preventDefault(); ifcViewerWrap.classList.add('drag-over');
});
ifcViewerWrap?.addEventListener('dragleave', e => {
  if (!ifcViewerWrap.contains(e.relatedTarget)) ifcViewerWrap.classList.remove('drag-over');
});
ifcViewerWrap?.addEventListener('drop', async e => {
  e.preventDefault(); ifcViewerWrap.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) await loadIFCFile(file);
});

/* Nav — ikke blokker ekte lenker */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    const href = item.getAttribute('href');
    if (!href || href === '#') {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    }
  });
});

/* Filter-chips */
document.querySelectorAll('.filter-chips').forEach(grp => {
  grp.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      grp.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
});

/* Live sync-puls */
setInterval(() => {
  const dot = document.querySelector('.sync-dot');
  if (dot) { dot.style.background = '#f59e0b'; setTimeout(() => { dot.style.background = '#10b981'; }, 400); }
}, 8000);

/* ═══════════════════════════════════════════════════════════
   OPPSTART — koble til IFC-kilde og gjenopprett siste valg
════════════════════════════════════════════════════════════ */

/* Hjelpefunksjon: gjenopprett UI + gruppe etter tilkobling */
async function _onConnected(fm) {
  setFolderUI('ready', fm.folderName);
  const { group, member } = loadLastSelection();
  if (group && groups[group]) {
    document.querySelectorAll('.member-card').forEach(c => {
      c.classList.toggle('active', c.dataset.group === group);
    });
    await openGroup(group, member);
  }
}

(async () => {
  /* Kun relevant på index.html — de andre sidene har ikke folderStatus-elementer */
  if (!folderDot && !folderLabel) return;

  setFolderUI('loading', 'Kobler til…');
  try {
    const fm     = await waitFor(() => window.folderManager, 8000);
    const result = await fm.tryRestore();

    if (result === 'granted') {
      await _onConnected(fm);
      return;                         // ferdig — ingen retry nødvendig
    }

    if (result === 'prompt') {
      setFolderUI('none', 'Klikk for å gi tilgang igjen');
    } else {
      setFolderUI('none', 'Ingen mappe valgt');
    }

    /* ── Auto-retry: prøv server-tilkobling hvert 4. sekund ──
       Håndterer faner som åpnet FØR server.js var oppe,
       eller midlertidige nettverksfeil.
       Stopper så snart server svarer OK.
    ──────────────────────────────────────────────────────── */
    const _retryId = setInterval(async () => {
      try {
        const r = await fetch('/api/ifc-ready', { cache: 'no-store' });
        if (!r.ok) return;
        const { available } = await r.json();
        if (!available) return;

        clearInterval(_retryId);
        fm._serverOK = true;
        fm._mode     = 'server';
        await _onConnected(fm);
      } catch (_) { /* server ikke klar ennå — prøv igjen */ }
    }, 4000);

  } catch (_) {
    setFolderUI('error', 'files.js ikke lastet');
  }
})();
