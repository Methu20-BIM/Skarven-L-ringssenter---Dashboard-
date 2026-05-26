/**
 * viewer.js — IFC 3D Viewer
 * ─────────────────────────────────────────────
 * Stack:
 *   Three.js       → 3D-rendering (unpkg CDN)
 *   OrbitControls  → kamera-kontroll (unpkg CDN)
 *   web-ifc        → IFC WASM-parser (esm.sh CDN)
 *
 * Ingen @thatopen/components — bare det som trengs.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { IfcAPI } from 'https://esm.sh/web-ifc@0.0.57';

/* WASM-binærene hentes fra unpkg (CORS ok) */
const WASM_PATH = 'https://unpkg.com/web-ifc@0.0.57/';

/* ══════════════════════════════════════════════
   BIMViewer
══════════════════════════════════════════════ */
export class BIMViewer {
  constructor(containerId) {
    this.containerId = containerId;
    this.container   = null;

    /* Three.js */
    this.renderer  = null;
    this.scene     = null;
    this.camera    = null;
    this.controls  = null;
    this._animId   = null;

    /* IFC */
    this.ifcAPI      = null;
    this.modelGroup  = null;

    /* State */
    this.initialized = false;

    /* Callbacks */
    this.onStatusChange     = null;   // (msg: string) => void
    this.onPropertiesSelect = null;   // (props | null) => void

    /* Raycasting */
    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();
  }

  /* ── Status-melding til UI ─────────────────── */
  _s(msg) {
    console.log('[IFC]', msg);
    this.onStatusChange?.(msg);
  }

  /* ── Initialiser scene, renderer og web-ifc ── */
  async init() {
    if (this.initialized) return;

    this.container = document.getElementById(this.containerId);
    if (!this.container) throw new Error(`#${this.containerId} ikke funnet`);

    /* ─ Scene ─────────────────────────────────── */
    this._s('Starter Three.js…');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0f1a);
    this.scene.fog = new THREE.FogExp2(0x0d0f1a, 0.002);

    /* ─ Renderer ──────────────────────────────── */
    const W = this.container.clientWidth  || 800;
    const H = this.container.clientHeight || 460;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    /* Sørg for at canvas fyller containeren */
    this.renderer.domElement.style.display  = 'block';
    this.renderer.domElement.style.width    = '100%';
    this.renderer.domElement.style.height   = '100%';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top      = '0';
    this.renderer.domElement.style.left     = '0';

    /* ─ Kamera ────────────────────────────────── */
    this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 10000);
    this.camera.position.set(25, 18, 25);

    /* ─ Orbit-kontroller ─────────────────────── */
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 2000;

    /* ─ Belysning ─────────────────────────────── */
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(50, 80, 30);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x94b4d4, 1.5);
    fill.position.set(-30, 20, -30);
    this.scene.add(fill);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));

    /* ─ Rutenett ─────────────────────────────── */
    const grid = new THREE.GridHelper(200, 80, 0x1e2235, 0x181b28);
    this.scene.add(grid);

    /* ─ Klikk-valg ───────────────────────────── */
    this.renderer.domElement.addEventListener('click', e => this._pick(e));

    /* ─ Resize ───────────────────────────────── */
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.container);

    /* ─ Render-løkke ─────────────────────────── */
    this._loop();

    /* ─ web-ifc init ─────────────────────────── */
    this._s('Laster IFC WASM…');
    this.ifcAPI = new IfcAPI();
    this.ifcAPI.SetWasmPath(WASM_PATH, true);
    await this.ifcAPI.Init();

    this.initialized = true;
    this._s('Klar ✓');
  }

  /* ── Last en IFC-fil (File-objekt) ─────────── */
  async loadFile(file) {
    if (!this.initialized) await this.init();

    /* Fjern forrige modell */
    if (this.modelGroup) {
      this.scene.remove(this.modelGroup);
      this.modelGroup.traverse(o => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
      });
      this.modelGroup = null;
    }

    /* Les fil */
    this._s(`Leser ${file.name} (${(file.size/1e6).toFixed(1)} MB)…`);
    const buffer = await file.arrayBuffer();
    const data   = new Uint8Array(buffer);

    /* Åpne i web-ifc */
    this._s('Parser IFC…');
    const modelID = this.ifcAPI.OpenModel(data, {
      COORDINATE_TO_ORIGIN: true,
      USE_FAST_BOOLS: true,
    });

    /* Bygg Three.js-geometri */
    this._s('Bygger 3D…');
    const group    = new THREE.Group();
    const flatMesh = this.ifcAPI.LoadAllGeometry(modelID);
    const total    = flatMesh.size();

    /* Materialcache — gjenbruk like farger */
    const matCache = new Map();

    for (let i = 0; i < total; i++) {
      if (i % 300 === 0 && i > 0) {
        this._s(`Geometri ${Math.round(i / total * 100)}%…`);
        /* Gi nettleseren et pust mellom batches */
        await new Promise(r => setTimeout(r, 0));
      }

      const fm  = flatMesh.get(i);
      const eid = fm.expressID;
      const gms = fm.geometries;

      for (let j = 0; j < gms.size(); j++) {
        const placed   = gms.get(j);
        const geomData = this.ifcAPI.GetGeometry(modelID, placed.geometryExpressID);

        const verts   = this.ifcAPI.GetVertexArray(
          geomData.GetVertexData(), geomData.GetVertexDataSize());
        const indices = this.ifcAPI.GetIndexArray(
          geomData.GetIndexData(),  geomData.GetIndexDataSize());
        geomData.delete();

        /* Bygg BufferGeometry */
        const nVerts = verts.length / 6;
        const pos    = new Float32Array(nVerts * 3);
        const nrm    = new Float32Array(nVerts * 3);

        for (let k = 0; k < nVerts; k++) {
          pos[k*3]   = verts[k*6];
          pos[k*3+1] = verts[k*6+1];
          pos[k*3+2] = verts[k*6+2];
          nrm[k*3]   = verts[k*6+3];
          nrm[k*3+1] = verts[k*6+4];
          nrm[k*3+2] = verts[k*6+5];
        }

        const bufGeom = new THREE.BufferGeometry();
        bufGeom.setAttribute('position', new THREE.BufferAttribute(pos,  3));
        bufGeom.setAttribute('normal',   new THREE.BufferAttribute(nrm,  3));
        bufGeom.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

        /* Plasseringsmatrise (kolonne-major fra web-ifc → Three.js) */
        const ft = placed.flatTransformation;
        bufGeom.applyMatrix4(new THREE.Matrix4().set(
          ft[0],  ft[4],  ft[8],  ft[12],
          ft[1],  ft[5],  ft[9],  ft[13],
          ft[2],  ft[6],  ft[10], ft[14],
          ft[3],  ft[7],  ft[11], ft[15]
        ));

        /* Material — cache basert på RGBA */
        const c    = placed.color;
        const key  = `${c.x.toFixed(3)}_${c.y.toFixed(3)}_${c.z.toFixed(3)}_${c.w.toFixed(3)}`;
        let   mat  = matCache.get(key);
        if (!mat) {
          mat = new THREE.MeshLambertMaterial({
            color:       new THREE.Color(c.x, c.y, c.z),
            side:        THREE.DoubleSide,
            transparent: c.w < 0.98,
            opacity:     c.w,
            depthWrite:  c.w >= 0.98,
          });
          matCache.set(key, mat);
        }

        const mesh = new THREE.Mesh(bufGeom, mat);
        mesh.userData.expressID = eid;
        group.add(mesh);
      }
    }

    this.ifcAPI.CloseModel(modelID);
    this.scene.add(group);
    this.modelGroup = group;

    this._s('Tilpasser kamera…');
    this._fit(group);
    this._s(`Ferdig — ${total} elementer ✓`);
    return group;
  }

  /* ── Zoomer kamera til å passe modellen ─────── */
  fitToModel() { if (this.modelGroup) this._fit(this.modelGroup); }

  /* ── Rydd opp ────────────────────────────────── */
  dispose() {
    this._ro?.disconnect();
    cancelAnimationFrame(this._animId);
    this.renderer?.dispose();
    this.initialized = false;
  }

  /* ═══ Private ═══════════════════════════════ */

  _loop() {
    this._animId = requestAnimationFrame(() => this._loop());
    this.controls?.update();
    this.renderer?.render(this.scene, this.camera);
  }

  _resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _fit(obj) {
    const box    = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const d      = Math.max(size.x, size.y, size.z) * 1.8;

    this.camera.position.set(
      center.x + d * 0.8,
      center.y + d * 0.6,
      center.z + d * 0.8
    );
    this.controls.target.copy(center);
    this.controls.update();
  }

  _pick(event) {
    if (!this.modelGroup) return;
    const el   = this.renderer.domElement;
    const rect = el.getBoundingClientRect();
    this._mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this._raycaster.intersectObjects(this.modelGroup.children, false);

    if (!hits.length) { this.onPropertiesSelect?.(null); return; }

    const eid = hits[0].object.userData.expressID;
    this.onPropertiesSelect?.({
      type: 'IFC Element',
      name: `Element #${eid}`,
      id:   eid,
      globalId: '—',
      tag:      '—',
    });
  }
}

/* Eksponér globalt — app.js bruker window.BIMViewer */
window.BIMViewer = BIMViewer;
