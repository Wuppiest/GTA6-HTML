
// =====================================================================
//  WELTBAU: Teile-Baukasten → wenige zusammengeführte Meshes (Vertex-Farben)
// =====================================================================
const UG = {};
const sri = (a, b) => Math.floor(sr(a, b + 1)); // deterministische Ganzzahl
function nonIdx(g) { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; }
const ug = (k, f) => UG[k] || (UG[k] = noUv(f()));
function noUv(g) { if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1'); g.clearGroups(); return g; }
function frustumGeo(tx, tz, oz = 0) { // Quader mit verjüngter Oberseite (Kabinen, Dächer, Sockel)
  const b = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]], t = [[-0.5 * tx, 1, -0.5 * tz + oz], [0.5 * tx, 1, -0.5 * tz + oz], [0.5 * tx, 1, 0.5 * tz + oz], [-0.5 * tx, 1, 0.5 * tz + oz]];
  const F = [[t[0], t[3], t[2], t[1]], [b[0], b[1], b[2], b[3]], [b[3], b[2], t[2], t[3]], [b[1], b[0], t[0], t[1]], [b[2], b[1], t[1], t[2]], [b[0], b[3], t[3], t[0]]], pos = [];
  for (const q of F) pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const G = {
  box: () => ug('box', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
  cyl: (n = 8) => ug('cyl' + n, () => new THREE.CylinderGeometry(0.5, 0.5, 1, n).translate(0, 0.5, 0)),
  tcyl: (n = 8, r = 0.6) => ug('tcyl' + n + r, () => new THREE.CylinderGeometry(0.5 * r, 0.5, 1, n).translate(0, 0.5, 0)),
  cone: (n = 8) => ug('cone' + n, () => new THREE.ConeGeometry(0.5, 1, n).translate(0, 0.5, 0)),
  sph: (n = 8) => ug('sph' + n, () => new THREE.SphereGeometry(0.5, n, Math.max(4, Math.round(n * 0.6)))),
  hsph: (n = 10) => ug('hsph' + n, () => new THREE.SphereGeometry(0.5, n, Math.max(3, n >> 1), 0, Math.PI * 2, 0, Math.PI / 2)),
  pyr: () => ug('pyr', () => new THREE.ConeGeometry(0.7071, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0)),
  gable: () => ug('gable', () => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0); return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5); }),
  quad: () => ug('quad', () => new THREE.PlaneGeometry(1, 1)),
  frus: (tx, tz, oz = 0) => ug('fr' + tx + '_' + tz + '_' + oz, () => frustumGeo(tx, tz, oz)),
  torus: (t = 0.15) => ug('tor' + t, () => new THREE.TorusGeometry(0.5, t, 6, 16)),
  hcyl: (n = 10) => ug('hcyl' + n, () => { const s = new THREE.Shape(); s.moveTo(0.5, 0); s.absarc(0, 0, 0.5, 0, Math.PI, false); s.lineTo(0.5, 0); return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: n }).translate(0, 0, -0.5).rotateY(Math.PI / 2); }),
};
// ---------- WELT-MATERIALIEN (echte Texturen, PBR) ----------
// Jeder Schlüssel = ein Material; tile = Kachelgröße der Textur in Metern (UVs werden in Metern erzeugt)
const WM_DEF = {
  solid: { rough: 0.8 }, shiny: { rough: 0.25, metal: 0.3 }, metal: { rough: 0.35, metal: 0.8 },
  plaster: { tex: 'plaster', tile: 3.2, rough: 0.92 }, concrete: { tex: 'concrete', tile: 3.5, rough: 0.9 }, brick: { tex: 'brick', tile: 2.4, rough: 0.9 },
  roof: { tex: 'roofTile', tile: 2.6, rough: 0.8 }, slate: { tex: 'roofSlate', tile: 2.6, rough: 0.85 }, steel: { tex: 'steel', tile: 3, rough: 0.5, metal: 0.55 },
  walk: { tex: 'walk', tile: 3, rough: 0.9 }, plaza: { tex: 'plaza', tile: 4, rough: 0.85 }, planks: { tex: 'planks', tile: 2.6, rough: 0.8 }, pool: { tex: 'pool', tile: 2, rough: 0.15 },
  road: { tex: 'asphalt', tile: 7, rough: 0.92, offset: -2 }, mark: { rough: 0.6, offset: -4 },
  fac12: { tex: 'fac12', tile: 16, emissive: true }, fac13: { tex: 'fac13', tile: 16, emissive: true }, fac15: { tex: 'fac15', tile: 16, emissive: true }, fac17: { tex: 'fac17', tile: 14, emissive: true },
  facGrid: { tex: 'facGrid', tile: 14, metal: 0.2 }, facGlass: { tex: 'facGlass', tile: 14, metal: 0.4 },
  carpaint: { rough: 0.3, metal: 0.5 }, carglass: { rough: 0.05, metal: 0.7 },
  win: { win: true }, glow: { basic: true },
};
const WM = {};
const FAC_KEYS = ['fac12', 'fac13', 'fac15', 'fac17', 'facGrid', 'facGlass'];
// Fenster-Atlas: 4 Fensterstile (Rahmen, Sprossen, Glas mit Himmelsreflex) + Leucht- und Rauheitskarte
const WinAtlas = {
  build() {
    const S = 512, H = 256, mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; }, cc = mk(), ce = mk(), cr = mk(), g = cc.getContext('2d'), ge = ce.getContext('2d'), gr = cr.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S); gr.fillStyle = '#d0d0d0'; gr.fillRect(0, 0, S, S);
    const styles = [{ frame: '#f2f0ea', bars: [[0.5, 'v'], [0.45, 'h']], b: 18 }, { frame: '#2b2e33', bars: [], b: 12 }, { frame: '#3a3d42', bars: [[0.33, 'v'], [0.66, 'v'], [0.82, 'h']], b: 10 }, { frame: '#e8e2d6', bars: [[0.5, 'v']], b: 16, blinds: true }];
    styles.forEach((st, i) => { const ox = (i % 2) * H, oy = Math.floor(i / 2) * H, b = st.b;
      g.fillStyle = st.frame; g.fillRect(ox, oy, H, H);
      const gr2 = g.createLinearGradient(0, oy + b, 0, oy + H - b); gr2.addColorStop(0, '#9db8cf'); gr2.addColorStop(0.45, '#4f6a82'); gr2.addColorStop(1, '#263544'); g.fillStyle = gr2; g.fillRect(ox + b, oy + b, H - 2 * b, H - 2 * b);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(ox + b, oy + H * 0.55); g.lineTo(ox + H * 0.55, oy + b); g.lineTo(ox + H * 0.75, oy + b); g.lineTo(ox + b, oy + H * 0.75); g.fill();
      if (st.blinds) { g.fillStyle = 'rgba(230,225,210,.55)'; for (let y = oy + b; y < oy + H * 0.45; y += 7) g.fillRect(ox + b, y, H - 2 * b, 4); }
      // Leuchten: Glasfläche mit leichtem Verlauf (Gardine), Rahmen dunkel
      const eg = ge.createLinearGradient(0, oy + b, 0, oy + H - b); eg.addColorStop(0, '#fff'); eg.addColorStop(1, '#b0a090'); ge.fillStyle = eg; ge.fillRect(ox + b, oy + b, H - 2 * b, H - 2 * b);
      gr.fillStyle = '#141414'; gr.fillRect(ox + b, oy + b, H - 2 * b, H - 2 * b);
      for (const [t, d] of st.bars) for (const [ctx, col] of [[g, st.frame], [ge, '#000'], [gr, '#d0d0d0']]) { ctx.fillStyle = col; if (d === 'v') ctx.fillRect(ox + t * H - b * 0.35, oy, b * 0.7, H); else ctx.fillRect(ox, oy + t * H - b * 0.35, H, b * 0.7); }
    });
    const tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    this.map = tx(cc, true); this.emis = tx(ce, true); this.rough = tx(cr, false);
  },
};
function worldMat(key) {
  const d = WM_DEF[key] || WM_DEF.solid, T = d.tex && Assets.tex[d.tex] || {}, pbr = Q().detail > 0;
  if (d.basic) return new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const o = { vertexColors: true }, M = pbr ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial;
  if (d.win) { Object.assign(o, { map: WinAtlas.map, emissive: 0xffffff, emissiveMap: WinAtlas.emis }); if (pbr) Object.assign(o, { roughnessMap: WinAtlas.rough, roughness: 1, metalness: 0.25 }); }
  else { if (T.c) o.map = T.c; if (pbr) { if (T.n) { o.normalMap = T.n; o.normalScale = new THREE.Vector2(0.8, 0.8); } if (T.r) o.roughnessMap = T.r; o.roughness = d.rough ?? 0.85; o.metalness = d.metal || 0; }
    if (d.emissive && T.e) { o.emissive = 0xffd9a0; o.emissiveMap = T.e; } }
  if (d.offset) Object.assign(o, { polygonOffset: true, polygonOffsetFactor: d.offset, polygonOffsetUnits: d.offset });
  const m = new M(o);
  if (key === 'road') m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vRC; varying vec2 vRUv;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRC = color; vRUv = uv;');
    sh.fragmentShader = 'varying vec3 vRC; varying vec2 vRUv;\nfloat lineM(float x, float c, float hw, float aa) { return clamp((hw - abs(x - c)) / aa + 0.5, 0.0, 1.0); }\n' + sh.fragmentShader
      .replace('#include <map_fragment>', 'float rtyp = vRC.b; bool coded = abs(rtyp - 0.25) < 0.04 || abs(rtyp - 0.5) < 0.04 || abs(rtyp - 0.75) < 0.04 || abs(rtyp - 0.9) < 0.04;\n#include <map_fragment>')
      .replace('#include <color_fragment>', `diffuseColor.rgb *= coded ? vec3(vRC.r) : vRC;
        if (coded) { float o = vRUv.x * ${(d.tile || 4).toFixed(1)}, s = vRUv.y * ${(d.tile || 4).toFixed(1)}, hw = vRC.g * 16.0, ao = abs(o), aa = max(fwidth(o), 0.015);
          if (rtyp > 0.85) { diffuseColor.rgb *= vec3(1.25, 1.05, 0.8); }
          else { float w = lineM(ao, hw - 0.45, 0.1, aa), y = 0.0;
            if (rtyp < 0.6) y = max(lineM(o, 0.22, 0.1, aa), lineM(o, -0.22, 0.1, aa));
            if (rtyp > 0.4 && rtyp < 0.6) w = max(w, lineM(ao, hw * 0.5, 0.08, aa) * step(0.5, fract(s / 12.0)));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.55, 0.05), y * 0.92); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.86, 0.83), w * 0.92); } }`);
  };
  if (d.win || d.emissive) m.onBeforeCompile = (sh) => { sh.uniforms.uNight = NIGHT_U;
    sh.vertexShader = (d.win ? 'attribute vec3 emis; varying vec3 vEmis;\n' : '') + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + (d.win ? '\nvEmis = emis;' : ''));
    sh.fragmentShader = 'uniform float uNight;' + (d.win ? ' varying vec3 vEmis;' : '') + '\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (d.win ? 'totalEmissiveRadiance *= vEmis * uNight * 1.4;' : 'totalEmissiveRadiance *= uNight * 1.3;')); };
  m.userData.key = key; return m;
}
function makeWorldMaterials() { WinAtlas.build(); for (const k of Object.keys(WM_DEF)) WM[k] = worldMat(k); }
// Wachsende Float32-Puffer pro Material & Kachel (Position, Normale, Farbe/Tönung, UV, Fenster-Leuchtfarbe)
// Sammel-Puffer pro Material & Kachel (indiziert: Quader 24 statt 36 Vertices)
class Acc {
  constructor(mat) { this.mat = mat; this.n = 0; this.ni = 0; this.cap = 2048; this.icap = 4096; this.p = new Float32Array(this.cap * 3); this.nr = new Float32Array(this.cap * 3); this.c = new Float32Array(this.cap * 3); this.uv = new Float32Array(this.cap * 2); this.e = mat === 'win' ? new Float32Array(this.cap * 3) : null; this.ix = new Uint32Array(this.icap); }
  grow(k, ki = k) {
    if (this.n + k > this.cap) { let c = this.cap; while (this.n + k > c) c *= 2; for (const key of ['p', 'nr', 'c', 'e', 'uv']) { if (!this[key]) continue; const a = new Float32Array(c * (key === 'uv' ? 2 : 3)); a.set(this[key]); this[key] = a; } this.cap = c; }
    if (this.ni + ki > this.icap) { let c = this.icap; while (this.ni + ki > c) c *= 2; const a = new Uint32Array(c); a.set(this.ix); this.ix = a; this.icap = c; }
  }
  // Viereck (A,B,C,D gegen den Uhrzeigersinn von oben/außen gesehen) → 4 Vertices, 6 Indizes
  quad(V, nx, ny, nz, color) { this.grow(4, 6); const b = this.n;
    for (const v of V) { const i = this.n * 3, j = this.n * 2; this.p[i] = v[0]; this.p[i + 1] = v[1]; this.p[i + 2] = v[2]; this.nr[i] = nx; this.nr[i + 1] = ny; this.nr[i + 2] = nz; this.c[i] = color.r; this.c[i + 1] = color.g; this.c[i + 2] = color.b; this.uv[j] = v[3]; this.uv[j + 1] = v[4]; if (this.e) { this.e[i] = this.e[i + 1] = this.e[i + 2] = 0; } this.n++; }
    this.ix.set([b, b + 1, b + 2, b, b + 2, b + 3], this.ni); this.ni += 6; VERTS += 4; }
  mesh() { const g = new THREE.BufferGeometry(), keep = (a) => a; // Arrays nach dem GPU-Upload freigeben
    const at = (arr, k) => { const a = new THREE.BufferAttribute(arr, k); a.onUpload(freeArr); return a; };
    g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(0, this.n * 3), 3)); g.setAttribute('normal', at(this.nr.slice(0, this.n * 3), 3)); g.setAttribute('color', at(this.c.slice(0, this.n * 3), 3));
    g.setAttribute('uv', at(this.uv.slice(0, this.n * 2), 2)); if (this.e) g.setAttribute('emis', at(this.e.slice(0, this.n * 3), 3));
    g.setIndex(at(this.ix.slice(0, this.ni), 1)); g.computeBoundingSphere(); g.attributes.position.onUpload(freeArr); keep(g); return g; }
}
function freeArr() { this.array = null; }
// Statische Kacheln (große Teile, Straßen) + Streaming-Kacheln für Kleinkram (werden nur in der Nähe gebaut)
const ACCS = new Map(), CHUNK = 400, DCHUNK = 150, DETAIL_DIST = 150;
let VERTS = 0;
function accFor(mat, x, z) { const cx = Math.floor((x + WS) / CHUNK), cz = Math.floor((z + WS) / CHUNK), k = mat + '|' + cx + '_' + cz; let a = ACCS.get(k); if (!a) { a = new Acc(mat); a.cx = -WS + (cx + 0.5) * CHUNK; a.cz = -WS + (cz + 0.5) * CHUNK; ACCS.set(k, a); } return a; }
const _M = new THREE.Matrix4(), _NM = new THREE.Matrix3(), _pv = V3(), _q2 = new THREE.Quaternion(), _e2 = new THREE.Euler(), _s2 = V3(), _t2 = V3();
const _cc = new Map(); function C3(c) { if (c && c.isColor) return c; let r = _cc.get(c); if (!r) { r = new THREE.Color(c); _cc.set(c, r); } return r; }
// Geometrie in einen Puffer schreiben. UV in Metern: Box-Projektion im lokalen (skalierten) Raum
function emitInto(a, g, M, c, e, sx, sy, sz, cell) {
  _NM.getNormalMatrix(M); const P = g.attributes.position, N = g.attributes.normal, n = P.count, I = g.index, ni = I ? I.count : n; a.grow(n, ni); VERTS += n;
  const d = WM_DEF[a.mat] || WM_DEF.solid, inv = 1 / (d.tile || 4), win = a.mat === 'win', cu = (cell % 2) * 0.5, cv = 0.5 - Math.floor(cell / 2) * 0.5, isQuad = g === UG.quad, m = M.elements, nm = _NM.elements, base = a.n;
  const pa = P.array, na = N.array;
  for (let i = 0; i < n; i++) { const k = (base + i) * 3, k2 = (base + i) * 2, lx = pa[i * 3], ly = pa[i * 3 + 1], lz = pa[i * 3 + 2], gx = na[i * 3], gy = na[i * 3 + 1], gz = na[i * 3 + 2];
    if (win) { a.uv[k2] = cu + clamp(lx + 0.5, 0, 1) * 0.5; a.uv[k2 + 1] = cv + clamp(isQuad ? ly + 0.5 : ly, 0, 1) * 0.5; }
    else { const ax = Math.abs(gx), ay = Math.abs(gy), az = Math.abs(gz);
      if (ay >= ax && ay >= az) { a.uv[k2] = lx * sx * inv; a.uv[k2 + 1] = lz * sz * inv; } else if (ax >= az) { a.uv[k2] = lz * sz * inv; a.uv[k2 + 1] = ly * sy * inv; } else { a.uv[k2] = lx * sx * inv; a.uv[k2 + 1] = ly * sy * inv; } }
    a.p[k] = m[0] * lx + m[4] * ly + m[8] * lz + m[12]; a.p[k + 1] = m[1] * lx + m[5] * ly + m[9] * lz + m[13]; a.p[k + 2] = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
    let nx = nm[0] * gx + nm[3] * gy + nm[6] * gz, ny = nm[1] * gx + nm[4] * gy + nm[7] * gz, nz = nm[2] * gx + nm[5] * gy + nm[8] * gz; const l = Math.hypot(nx, ny, nz) || 1; a.nr[k] = nx / l; a.nr[k + 1] = ny / l; a.nr[k + 2] = nz / l;
    a.c[k] = c.r; a.c[k + 1] = c.g; a.c[k + 2] = c.b;
    if (a.e) { a.e[k] = e ? e.r : 0; a.e[k + 1] = e ? e.g : 0; a.e[k + 2] = e ? e.b : 0; } }
  if (I) { const ia = I.array; for (let i = 0; i < ni; i++) a.ix[a.ni + i] = base + ia[i]; } else for (let i = 0; i < ni; i++) a.ix[a.ni + i] = base + i;
  // gespiegelte Matrix (negative Skalierung) → Dreiecke umdrehen
  if (M.determinant() < 0) for (let i = a.ni; i < a.ni + ni; i += 3) { const t = a.ix[i + 1]; a.ix[i + 1] = a.ix[i + 2]; a.ix[i + 2] = t; }
  a.n += n; a.ni += ni;
}
// Rezepte für Streaming-Kacheln: 24 Floats pro Teil statt hunderter Vertices im Speicher
const GEO_LIST = [], GEO_ID = new Map(), MAT_LIST = [], MAT_ID = new Map(), REC = 24;
const regId = (list, map, o) => { let i = map.get(o); if (i === undefined) { i = list.length; list.push(o); map.set(o, i); } return i; };
const Stream = {
  chunks: new Map(), list: [], jobs: [], built: 0,
  chunk(x, z) { const cx = Math.floor((x + WS) / DCHUNK), cz = Math.floor((z + WS) / DCHUNK), k = cx * 1000 + cz; let c = this.chunks.get(k);
    if (!c) { c = { x: -WS + (cx + 0.5) * DCHUNK, z: -WS + (cz + 0.5) * DCHUNK, n: 0, f: new Float32Array(64 * REC), meshes: null, job: null }; this.chunks.set(k, c); this.list.push(c); } return c; },
  record(mat, g, M, color, emis, sx, sy, sz, cell) { const c = this.chunk(M.elements[12], M.elements[14]);
    if ((c.n + 1) * REC > c.f.length) { const f = new Float32Array(c.f.length * 2); f.set(c.f); c.f = f; }
    const f = c.f, o = c.n * REC, m = M.elements, col = C3(color), e = emis ? C3(emis) : null; c.n++;
    f[o] = regId(GEO_LIST, GEO_ID, g); f[o + 1] = regId(MAT_LIST, MAT_ID, mat); for (let i = 0; i < 16; i++) if (i % 4 !== 3) f[o + 2 + i - (i >> 2)] = m[i];
    f[o + 14] = col.r; f[o + 15] = col.g; f[o + 16] = col.b; f[o + 17] = e ? e.r : -1; f[o + 18] = e ? e.g : 0; f[o + 19] = e ? e.b : 0; f[o + 20] = sx; f[o + 21] = sy; f[o + 22] = sz; f[o + 23] = cell; },
  _m: new THREE.Matrix4(), _c: new THREE.Color(), _e: new THREE.Color(),
  // Kachel schrittweise bauen (Zeitbudget pro Frame), fertige Meshes einhängen
  step(job, deadline) { const c = job.c, f = c.f, M = this._m;
    for (; job.i < c.n; job.i++) { if ((job.i & 31) === 0 && performance.now() > deadline) return false; const o = job.i * REC, mat = MAT_LIST[f[o + 1]];
      let a = job.accs.get(mat); if (!a) { a = new Acc(mat); job.accs.set(mat, a); }
      M.set(f[o + 2], f[o + 5], f[o + 8], f[o + 11], f[o + 3], f[o + 6], f[o + 9], f[o + 12], f[o + 4], f[o + 7], f[o + 10], f[o + 13], 0, 0, 0, 1);
      this._c.setRGB(f[o + 14], f[o + 15], f[o + 16]); const e = f[o + 17] >= 0 ? this._e.setRGB(f[o + 17], f[o + 18], f[o + 19]) : null;
      emitInto(a, GEO_LIST[f[o]], M, this._c, e, f[o + 20], f[o + 21], f[o + 22], f[o + 23]); }
    c.meshes = []; for (const [mat, a] of job.accs) { if (!a.n) continue; const m = new THREE.Mesh(a.mesh(), WM[mat] || WM.solid); m.castShadow = false; m.receiveShadow = mat !== 'glow'; m.matrixAutoUpdate = false; m.visible = false; scene.add(m); c.meshes.push(m); }
    c.job = null; this.built++; return true; },
  drop(c) { for (const m of c.meshes) { scene.remove(m); m.geometry.dispose(); } c.meshes = null; },
  update(cam, budgetMs = 3) {
    const deadline = performance.now() + budgetMs, show = DETAIL_DIST + DCHUNK * 0.6, buildR = show + 120, dropR = buildR + 140;
    for (const c of this.list) { const d = Math.hypot(c.x - cam.x, c.z - cam.z);
      if (c.meshes) { if (d > dropR) this.drop(c); else { const v = d < show; for (const m of c.meshes) m.visible = v; } }
      else if (!c.job && d < buildR && c.n) { c.job = { c, i: 0, accs: new Map(), d }; this.jobs.push(c.job); } else if (c.job) c.job.d = d; }
    if (!this.jobs.length) return; this.jobs.sort((a, b) => a.d - b.d);
    while (this.jobs.length && performance.now() < deadline) { const j = this.jobs[0]; if (j.d > dropR) { j.c.job = null; this.jobs.shift(); continue; } if (this.step(j, deadline)) this.jobs.shift(); else break; }
  },
  // beim Laden: alles im Umkreis sofort bauen
  prime(cam) { this.update(cam, 1e9); },
};
function emit(mat, g, M, color, emis, sx = 1, sy = 1, sz = 1, cell = 0, det = false) {
  if (det) { Stream.record(mat, g, M, color, emis, sx, sy, sz, cell); return; }
  emitInto(accFor(mat, M.elements[12], M.elements[14]), g, M, C3(color), emis ? C3(emis) : null, sx, sy, sz, cell);
}
function part(F, g, x, y, z, sx, sy, sz, color, o) {
  _e2.set(o && o.rx || 0, o && o.ry || 0, o && o.rz || 0, o && o.order || 'XYZ'); _q2.setFromEuler(_e2); _M.compose(_t2.set(x, y, z), _q2, _s2.set(sx, sy, sz)); if (F) _M.premultiply(F);
  // Kleinkram (klein oder dünn wie Masten, Geländer) → Streaming-Detailebene
  let det = o && o.det; if (!det && !(o && o.keep)) { const a = Math.abs(sx), b = Math.abs(sy), c = Math.abs(sz), mx = Math.max(a, b, c), mid = a + b + c - mx - Math.min(a, b, c); det = mx < 1.6 || (mid < 0.42 && g !== UG.quad); }
  emit(o && o.mat || 'solid', g, _M, color, o && o.emis, sx, sy, sz, o && o.cell || 0, det);
}
// Kurzformen (y = Unterkante)
const PB = (F, x, y, z, w, h, d, c, o) => part(F, G.box(), x, y, z, w, h, d, c, o);
const PC = (F, x, y, z, r, h, c, o) => part(F, G.cyl(o && o.seg || 8), x, y, z, r * 2, h, r * 2, c, o);
const PS = (F, x, y, z, r, c, o) => part(F, G.sph(o && o.seg || 8), x, y, z, r * 2 * (o && o.sx || 1), r * 2 * (o && o.sy || 1), r * 2 * (o && o.sz || 1), c, o);
// Fenster: Stil 0 = Sprossenfenster, 1 = modern, 2 = Schaufenster, 3 = mit Jalousie
let WIN_STYLE = 1;
const PW = (F, x, y, z, w, h, ry, lit, style) => part(F, G.quad(), x, y, z, w, h, 1, '#ffffff', { ry, mat: 'win', emis: lit || 0x000000, cell: typeof style === 'number' ? style : WIN_STYLE });
const PG = (F, x, y, z, w, h, d, c, o) => part(F, G.box(), x, y, z, w, h, d, c, Object.assign({ mat: 'glow' }, o));
function seg(x1, y1, z1, x2, y2, z2, w, h, c, o) { const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), L3 = Math.hypot(L, y2 - y1); part(null, G.box(), x1, y1, z1, w, h, L3, c, Object.assign({ ry: Math.atan2(dx, dz), rx: -Math.atan2(y2 - y1, L), order: 'YXZ' }, o || {})); }
const FR = (x, y, z, yaw) => new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
const FRL = (F, x, y, z, yaw = 0) => F.clone().multiply(new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z));
const LP = (F, x, y, z) => V3(x, y, z).applyMatrix4(F);
const MATFAR = { win: 700, metal: 520, shiny: 420, carpaint: 360, carglass: 360, pool: 420, planks: 520, mark: 360, walk: 620, plaza: 620, steel: 800, slate: 900, roof: 950, brick: 950, glow: 1000 };
function flushParts() {
  for (const [, a] of ACCS) { if (!a.n) continue; const m = new THREE.Mesh(a.mesh(), WM[a.mat] || WM.solid);
    m.castShadow = !['glow', 'mark', 'road', 'walk', 'plaza', 'win', 'carglass', 'pool'].includes(a.mat); m.receiveShadow = a.mat !== 'glow'; m.matrixAutoUpdate = false; scene.add(m);
    const far = MATFAR[a.mat]; if (far) World.lod.push({ obj: m, x: a.cx, z: a.cz, far }); }
  ACCS.clear();
}
// ---------- SCHILDER-ATLAS (alle Laden-/Werbeschilder in einer Textur) ----------
const Signs = {
  cv: null, g: null, cells: new Map(), next: 0, COLS: 8, ROWS: 32, CW: 256, CH: 64, pos: [], uv: [],
  init() { this.cv = document.createElement('canvas'); this.cv.width = this.COLS * this.CW; this.cv.height = this.ROWS * this.CH; this.g = this.cv.getContext('2d'); },
  cell(text, bg, fg, span = 1, style = 0) {
    const key = text + bg + fg + span + style; if (this.cells.has(key)) return this.cells.get(key);
    let i = this.next; if ((i % this.COLS) + span > this.COLS) i = Math.ceil(i / this.COLS) * this.COLS; if (i / this.COLS >= this.ROWS) return this.cells.values().next().value;
    this.next = i + span; const x = (i % this.COLS) * this.CW, y = Math.floor(i / this.COLS) * this.CH, w = this.CW * span, h = this.CH, g = this.g;
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    if (style === 1) { const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, bg); gr.addColorStop(1, fg); g.fillStyle = gr; g.fillRect(x, y, w, h); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
    let fs = 40; g.font = `bold ${fs}px Arial Black, Impact, sans-serif`; while (g.measureText(text).width > w - 20 && fs > 12) { fs -= 2; g.font = `bold ${fs}px Arial Black, Impact, sans-serif`; }
    g.fillStyle = style === 1 ? '#ffffff' : fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + h / 2 + 2);
    const W = this.cv.width, H = this.cv.height, r = [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H]; this.cells.set(key, r); return r;
  },
  quad(F, x, y, z, w, h, ry, cell, back = false) {
    const c = Math.cos(ry), s = Math.sin(ry), pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]].map(([lx, ly]) => LP(F, x + lx * c, y + ly, z - lx * s));
    const [u0, v0, u1, v1] = cell; const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]; const order = back ? [0, 3, 2, 0, 2, 1] : [0, 1, 2, 0, 2, 3];
    for (const i of order) { this.pos.push(pts[i].x, pts[i].y, pts[i].z); this.uv.push(uvs[i][0], uvs[i][1]); }
  },
  flush() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.computeBoundingSphere();
    const t = new THREE.CanvasTexture(this.cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; this.mat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -3 });
    const m = new THREE.Mesh(g, this.mat); m.matrixAutoUpdate = false; scene.add(m); neonMats.push(this.mat); },
};
const SHOPS = [['TACOS', '#ffcf3a', '#7a1a10'], ['CAFÉ CUBANO', '#5a2d1a', '#ffd9a0'], ['PIZZA', '#c0392b', '#fff'], ['SURF SHOP', '#1ec8e0', '#fff'], ['GELATO', '#ffd1e8', '#c0186b'], ['SUSHI', '#1a1a1a', '#ff4b6e'], ['BURGER', '#ff7a1a', '#fff'], ['24/7 MARKET', '#1f7a3a', '#fff'], ['PHARMACY', '#fff', '#1aa34a'], ['TATTOO', '#111', '#ffb03a'], ['BARBER', '#fff', '#1f4fa0'], ['LAUNDRY', '#3aa0ff', '#fff'], ['DINER', '#e8203a', '#fff'], ['ARCADE', '#5a1ab0', '#22e4ff'], ['BOUTIQUE', '#f4e4d4', '#a0306a'], ['BAKERY', '#f8e0b0', '#7a4a1a'], ['GYM', '#222', '#ffcc00'], ['BANK', '#1a3a6a', '#fff'], ['BOOKS', '#3a5a3a', '#fff'], ['JEWELRY', '#111', '#d4af37'], ['ELECTRONICS', '#0a3a7a', '#7ae0ff'], ['FLOWERS', '#ffe0ef', '#2a8a3a'], ['LIQUOR', '#7a1010', '#ffd23a'], ['PAWN', '#ffd23a', '#111'], ['SEAFOOD', '#0a4a6a', '#fff'], ['YOGA', '#e0f4e8', '#2a7a5a']];
const ADS = [['SOLARA COLA – ICE COLD', '#c0102a', '#ff7a7a'], ['FLY AIR LEONA', '#0a3a8a', '#3ac0ff'], ['VICE NIGHTS RADIO 88.4', '#5a10a0', '#ff2d95'], ['SUNBLOCK SPF 50', '#ff9a1a', '#ffe23a'], ['CORAL BEACH RESORT', '#0aa0b0', '#ffe0a0'], ['TURBO ENERGY DRINK', '#111', '#9dff3a'], ['RANGER XL – BUILT TOUGH', '#2a3a2a', '#c0c0a0'], ['PALMCORP REALTY', '#1a6a3a', '#ffd23a']];
const STREETS = ['OCEAN DR', 'COLLINS AVE', 'FLAMINGO ST', 'PALM AVE', 'CORAL WAY', 'MARLIN BLVD', 'SUNSET ST', 'BAYSHORE DR', 'LEONA AVE', 'VICE BLVD', 'HIBISCUS LN', 'MANGO ST', 'DOLPHIN WAY', 'PELICAN RD', 'BISCAYNE ST', 'LAGUNA DR'];

// ---------- FARBPALETTEN ----------
const PAL = {
  pastel: ['#f6c6cf', '#fde2b8', '#bfeee0', '#d8cff5', '#fff0c4', '#f9cfb4', '#bfe6f2', '#fbfbf6', '#ffd6e8', '#c8f0d0'],
  accent: ['#ff5a8a', '#1fb5a8', '#ffb03a', '#4a90e2', '#9b59b6', '#e74c3c', '#2ecc71', '#16a3c7'],
  house: ['#fff4e0', '#ffe0d0', '#d4f0e8', '#f8eab0', '#e6dcff', '#ffffff', '#ffd8e4', '#dff0cc', '#f0e2d0', '#cfe6f4'],
  roof: ['#c0583a', '#b4553a', '#d8d0c4', '#8a9aaa', '#a84a30', '#e8e2d8', '#5a6a7a'],
  glass: [['#c9d6df', '#3d5a73'], ['#d8d2c4', '#5a4a3a'], ['#e2e6ea', '#2e4a5e'], ['#b6c8c0', '#3a5a52'], ['#f0ece4', '#4a6a8a'], ['#9fb2c4', '#2a3a4a']],
  ind: ['#8a9aa8', '#a8a090', '#6a7a8a', '#b0b8b0', '#9a6a5a', '#7a8f7a', '#c8c0a8'],
  neon: ['#ff2d95', '#22e4ff', '#ffb03a', '#9dff3a', '#b45cff', '#ff4040'],
  car: ['#c0392b', '#2b4f7a', '#e2e2da', '#5e7b4b', '#2a2a2e', '#c9b27c', '#8a8f96', '#ffcc00', '#1e90ff', '#7d1f2b'],
};
const litCol = () => { const r = srand(); return r < 0.2 ? 0xe8b060 : r < 0.27 ? 0xf0d4a0 : r < 0.3 ? 0x8aa8e0 : r < 0.315 ? 0xe080b8 : 0; };
const BLD = []; // Grundrisse für Minimap
const NEON = new Map(); let neonFlushed = false;
function flushNeon() { for (const [mat, gs] of NEON) { const m = new THREE.Mesh(ADD.merge(gs), mat); m.renderOrder = 2; m.matrixAutoUpdate = false; L1(m); scene.add(m); } NEON.clear(); neonFlushed = true; }
function addSign(text, color, x, y, z, yaw, w, h, vertical = false) {
  const mat = neonMat(text, color, vertical), g = new THREE.PlaneGeometry(w, h).rotateY(yaw).translate(x, y, z);
  if (neonFlushed) { const m = new THREE.Mesh(g, mat); m.renderOrder = 2; L1(m); scene.add(m); } else { let a = NEON.get(mat); if (!a) NEON.set(mat, a = []); a.push(g); }
  World.neonAnchors.push({ pos: V3(x + Math.sin(yaw) * 3, y, z + Math.cos(yaw) * 3), color: col(color) });
}
function signF(F, text, color, x, y, z, w, h, vertical, ry = 0) { const p = LP(F, x, y, z), e = F.elements; addSign(text, color, p.x, p.y, p.z, Math.atan2(e[8], e[10]) + ry, w, h, vertical); }

// ---------- FASSADEN-HELFER ----------
// Fenster auf allen vier Seiten eines Quaders (lokal: Breite w entlang x, Tiefe d entlang z, Front = +z)
function facade(F, w, d, y0, floors, fh, o = {}) {
  const sp = o.sp || 3.2, ww = o.ww || 1.3, wh = o.wh || fh * 0.55, sill = o.sill !== false, style = o.style ?? WIN_STYLE, det = Q().detail;
  const faces = [[0, d / 2, 0, w], [Math.PI, -d / 2, 0, w], [Math.PI / 2, 0, w / 2, d], [-Math.PI / 2, 0, -w / 2, d]];
  for (const [ry, fz, fx, len] of faces) {
    if (o.only && !o.only.includes(ry)) continue; const n = Math.max(1, Math.floor((len - 1) / sp)), c = Math.cos(ry), s = Math.sin(ry), fw = ry === 0 || ry === Math.PI;
    for (let f = o.skipGround ? 1 : 0; f < floors; f++) { const y = y0 + f * fh + (fh - wh) * 0.55;
      for (let i = 0; i < n; i++) { const t = -len / 2 + (i + 0.5) * len / n, x = fx + t * c + 0.04 * s, z = fz - t * s + 0.04 * c;
        if (o.door && f === 0 && ry === 0 && Math.abs(t - o.door) < 1.6) continue;
        PW(F, x, y + wh / 2, z, ww, wh, ry, litCol(), style);
        if (sill && ry === 0) PB(F, x + 0.04 * s, y - 0.12, z + 0.04 * c, fw ? ww + 0.24 : 0.2, 0.12, fw ? 0.2 : ww + 0.24, '#e8e4dc', { mat: 'concrete', det: true });
        if (det > 0 && o.lintel && ry === 0) PB(F, x + 0.03 * s, y + wh, z + 0.03 * c, fw ? ww + 0.3 : 0.12, 0.22, fw ? 0.12 : ww + 0.3, o.lintel, { mat: 'concrete', det: true });
        if (o.shutters && f < 3) { for (const sd of [-1, 1]) PB(F, x + (ww / 2 + 0.25) * sd * c + 0.04 * s, y, z - (ww / 2 + 0.25) * sd * s + 0.04 * c, fw ? 0.42 : 0.06, wh, fw ? 0.06 : 0.42, o.shutters, { det: true }); }
      } }
  }
}
function railing(F, x0, z0, x1, z1, y, h, c, posts = 1.2) { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / Math.max(posts, 1.2))), ry = Math.atan2(x1 - x0, z1 - z0);
  PB(F, (x0 + x1) / 2, y + h, (z0 + z1) / 2, 0.06, 0.06, L, c, { ry, mat: 'metal' }); PB(F, (x0 + x1) / 2, y + 0.1, (z0 + z1) / 2, 0.02, h - 0.15, L, '#7d8a94', { ry, mat: 'carglass' });
  for (let i = 0; i <= n; i++) { const t = i / n; PB(F, lerp(x0, x1, t), y, lerp(z0, z1, t), 0.05, h, 0.05, c, { mat: 'metal' }); } }
function acUnit(F, x, y, z, ry = 0) { PB(F, x, y, z, 1.0, 0.7, 0.6, '#c8ccd0', { ry, mat: 'metal' }); PC(F, x, y + 0.71, z, 0.3, 0.02, '#3a3e44', { seg: 10 }); }
function awning(F, x, y, z, w, c1, c2 = '#ffffff', depth = 1.4) { const n = Math.max(2, Math.round(w / 0.6)); for (let i = 0; i < n; i++) part(F, G.box(), x - w / 2 + (i + 0.5) * w / n, y, z + depth / 2, w / n, 0.06, depth, i % 2 ? c2 : c1, { rx: 0.35 }); PB(F, x, y - 0.25, z + depth * 0.95, w, 0.3, 0.04, c1, { rx: 0 }); }
function roofStuff(F, w, d, y, n = 2) { // Technik auf Flachdächern
  for (let i = 0; i < n; i++) acUnit(F, -w * 0.3 + i * 1.5, y, d * 0.15);
  if (Q().detail > 0) { PB(F, w * 0.25, y, -d * 0.2, 2.6, 2.4, 2.4, '#b8b4ac', { mat: 'concrete' }); PB(F, w * 0.25, y + 1.1, -d * 0.2 + 1.21, 0.9, 1.9, 0.06, '#5a5e64', { mat: 'metal' });
    for (let k = 0; k < 2; k++) PC(F, -w * 0.2 + k * 0.6, y, -d * 0.3, 0.08, 1.2, '#8a8e94', { seg: 6 }); }
}

// ---------- GEBÄUDETYPEN (lokales System: Front = +z zur Straße) ----------
function bTower(F, w, d, L) {
  const dist = Math.hypot(L.x - DOWNTOWN.x, L.z - DOWNTOWN.z), H = clamp(34 + 170 * Math.exp(-dist / 170) * sr(0.5, 1.15), 26, 210);
  const fac = spick(['fac12', 'fac13', 'fac15', 'fac17', 'fac17', 'facGlass', 'facGrid', 'fac13']), tint = spick(['#ffffff', '#f4f6fa', '#eef2f6', '#fff8f0']), lobby = 5.4, det = Q().detail;
  // Sockel: Naturstein, Glas-Lobby mit Vordach und Eingang
  PB(F, 0, -2, 0, w + 0.6, lobby + 2, d + 0.6, '#9a958c', { mat: 'concrete' });
  facade(F, w + 0.6, d + 0.6, 0.4, 1, lobby, { sp: 3.4, ww: 3.0, wh: 4.0, sill: false, door: 0, style: 2 });
  PB(F, 0, 0.1, d / 2 + 0.36, 3.2, 3.2, 0.08, '#ffffff', { mat: 'win', emis: 0xffe9c0 }); PB(F, 0, lobby - 0.4, d / 2 + 1.8, w * 0.5, 0.25, 3.4, '#d8dce0', { mat: 'metal' });
  for (const sx of [-1, 1]) PC(F, sx * w * 0.22, 0, d / 2 + 3.2, 0.12, lobby - 0.4, '#c8ccd0', { seg: 8, mat: 'metal' });
  PG(F, 0, lobby - 0.45, d / 2 + 3.5, w * 0.48, 0.06, 0.06, '#fff2d8');
  const tiers = H > 70 ? 2 : 1, H1 = tiers === 2 ? H * sr(0.55, 0.7) : H; let cw = w, cd = d, y = lobby;
  for (let t = 0; t < tiers; t++) {
    const top = t === 0 ? H1 : H; PB(F, 0, y, 0, cw, top - y, cd, tint, { mat: fac });
    if (det > 0) for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) PB(F, sx * cw / 2, y, sz * cd / 2, 0.5, top - y, 0.5, '#d4d6da', { mat: 'concrete' }); // Ecklisenen
    PB(F, 0, top, 0, cw + 0.4, 1.1, cd + 0.4, '#cfcac0', { mat: 'concrete' }); PB(F, 0, top + 0.6, 0, cw - 0.4, 0.1, cd - 0.4, '#77787a', { mat: 'concrete' });
    y = top; cw *= sr(0.62, 0.74); cd *= sr(0.62, 0.74);
  }
  const tw = w * (tiers === 2 ? 0.68 : 1), td = d * (tiers === 2 ? 0.68 : 1);
  PB(F, -tw * 0.18, H + 0.7, -td * 0.15, tw * 0.35, 4, td * 0.3, '#b8b4ac', { mat: 'concrete' }); PB(F, -tw * 0.18, H + 4.7, -td * 0.15, tw * 0.37, 0.3, td * 0.32, '#6a6e74', { mat: 'metal' });
  for (let i = 0; i < 3; i++) acUnit(F, tw * 0.15 + i * 1.4 - 1.4, H + 0.7, td * 0.25);
  if (H > 100) { PC(F, 0, H + 4.9, 0, 0.35, 22, '#d0d4d8', { seg: 6, mat: 'metal' }); PG(F, 0, H + 27, 0, 0.5, 0.5, 0.5, '#ff2020'); }
  else if (srand() < 0.4 && tiers === 1) { PC(F, tw * 0.15, H + 0.7, td * 0.1, 4.5, 0.12, '#55585e', { seg: 20, mat: 'concrete' }); for (const [x, z, ww, dd] of [[-1.1, 0, 0.35, 3], [1.1, 0, 0.35, 3], [0, 0, 1.9, 0.35]]) PB(F, tw * 0.15 + x, H + 0.83, td * 0.1 + z, ww, 0.02, dd, '#f0f0f0'); }
  if (H > 60 && srand() < 0.6) signF(F, spick(['SOLARA BANK', 'VICE TOWER', 'NEXUS', 'OCEANIC', 'AURORA', 'PALMCORP', 'HELIX', 'MERIDIAN']), spick(PAL.neon), 0, H1 - 6, d / 2 + 0.45, Math.min(20, w * 0.75), 4);
  return { top: H + 0.7, flat: true };
}
function bApartment(F, w, d, L, o = {}) {
  const floors = o.floors || sri(3, 7), fh = 3.1, wallC = spick(PAL.pastel), accent = spick(PAL.accent), H = 4.2 + (floors - 1) * fh, shop = o.shops !== false, det = Q().detail;
  WIN_STYLE = srand() < 0.5 ? 1 : 0;
  PB(F, 0, -2, 0, w + 0.3, 2.3, d + 0.3, '#a8a296', { mat: 'concrete' }); PB(F, 0, 0.2, 0, w, H, d, wallC, { mat: 'plaster' });
  if (shop) { // Ladenzeile im Erdgeschoss
    const n = Math.max(1, Math.round(w / 8)); for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n, sw = w / n - 1.2, sh = spick(SHOPS);
      PW(F, x + 0.4, 2.0, d / 2 + 0.06, sw - 1.0, 2.6, 0, 0xffe2b0, 2); PB(F, x - sw / 2 + 0.6, 0.2, d / 2 + 0.05, 1.0, 2.4, 0.1, '#ffffff', { mat: 'win', emis: 0xffe2b0, cell: 2 });
      awning(F, x, 3.6, d / 2, sw + 0.4, sh[1] === '#fff' ? sh[2] : sh[1]); Signs.quad(F, x, 3.95, d / 2 + 0.09, sw * 0.8, 0.7, 0, Signs.cell(sh[0], sh[1], sh[2])); }
  } else facade(F, w, d, 0.2, 1, 4.2, { only: [0], door: 0 });
  facade(F, w, d, 4.4, floors - 1, fh, { sp: 3.2, ww: 1.3, wh: 1.7, shutters: srand() < 0.3 ? accent : null, lintel: srand() < 0.5 ? '#f4f0e8' : null });
  facade(F, w, d, 0.2, 1, 4.2, { only: [Math.PI, Math.PI / 2, -Math.PI / 2], sp: 4, ww: 1.2 });
  if (det > 0 && srand() < 0.7) for (let f = 1; f < floors; f++) for (let x = -w / 2 + 3.2; x < w / 2 - 1.5; x += 6.4) { const y = 4.2 + (f - 1) * fh; PB(F, x, y, d / 2 + 0.7, 2.6, 0.15, 1.4, '#e8e4dc', { mat: 'concrete' }); railing(F, x - 1.3, d / 2 + 1.38, x + 1.3, d / 2 + 1.38, y + 0.15, 0.9, '#e8e8e8', 0.3); }
  for (let f = 1; f < floors; f++) PB(F, 0, 4.2 + (f - 1) * fh - 0.15, 0, w + 0.12, 0.18, d + 0.12, '#f4f0e8', { mat: 'concrete' });
  PB(F, 0, 0.2 + H, 0, w + 0.35, 0.6, d + 0.35, accent, { mat: 'plaster' }); PB(F, 0, 4.0, 0, w + 0.25, 0.3, d + 0.25, '#f4f0e8', { mat: 'concrete' });
  roofStuff(F, w, d, 0.8 + H, 2);
  if (srand() < 0.4) for (let f = 1; f < floors; f++) acUnit(F, w / 2 + 0.3, 4.6 + (f - 1) * fh, sri(-1, 1) * 2, Math.PI / 2);
  return { top: 0.8 + H, flat: true };
}
function bHotel(F, w, d, L) {
  const floors = sri(4, 9), fh = 3.2, H = 4.6 + (floors - 1) * fh, wallC = spick(PAL.pastel), acc = spick(PAL.accent), nc = spick(PAL.neon), r = Math.min(4, w * 0.12);
  WIN_STYLE = 1;
  PB(F, 0, -2, 0, w + 0.3, 2.3, d + 0.3, '#a8a296', { mat: 'concrete' }); PB(F, 0, 0.2, -r / 2, w, H, d - r, wallC, { mat: 'plaster' }); PB(F, 0, 0.2, d / 2 - r / 2, w - 2 * r, H, r, wallC, { mat: 'plaster' });
  for (const sx of [-1, 1]) PC(F, sx * (w / 2 - r), 0.2, d / 2 - r, r, H, wallC, { seg: 20, mat: 'plaster' });
  facade(F, w - 2 * r, d, 4.8, floors - 1, fh, { only: [0], sp: 2.8, ww: 1.6, wh: 1.7 });
  facade(F, w, d - r, 4.8, floors - 1, fh, { only: [Math.PI, Math.PI / 2, -Math.PI / 2], sp: 3.2, ww: 1.3, wh: 1.6 });
  for (let f = 1; f < floors; f++) { const y = 4.6 + (f - 1) * fh + 2.25; PB(F, 0, y, d / 2 + 0.3, w - 2 * r, 0.12, 0.7, '#ffffff', { mat: 'concrete' }); for (const sx of [-1, 1]) PC(F, sx * (w / 2 - r), y, d / 2 - r, r + 0.35, 0.12, '#ffffff', { seg: 20, mat: 'concrete' }); }
  PB(F, 0, 0.2 + H, -r / 2, w + 0.3, 0.9, d - r + 0.3, acc, { mat: 'plaster' }); PB(F, 0, 0.2 + H, d / 2 - r / 2, w - 2 * r, 0.9, r + 0.3, acc, { mat: 'plaster' });
  PG(F, 0, 0.6 + H, d / 2 + 0.2, w - 2 * r, 0.14, 0.08, nc); for (const sx of [-1, 1]) PG(F, sx * (w / 2 + 0.12), 0.6 + H, -r / 2, 0.08, 0.14, d - r, nc);
  PB(F, 0, 4.6, d / 2 + 0.3, 1.0, H - 1, 1.2, acc, { mat: 'plaster' }); PB(F, 0, H + 1.1, d / 2 - 0.2, 1.4, 4, 1.4, acc, { mat: 'plaster' });
  signF(F, spick(['FLAMINGO', 'MIRAGE', 'SOLARA', 'AZUL', 'CORAL', 'LAGUNA', 'PARADISO', 'BREEZE', 'NEPTUNE', 'CABANA', 'DELMAR', 'MARLIN']), nc, 0, 4.8 + (H - 4.6) * 0.5, d / 2 + 0.95, 1.6, Math.min((H - 4.6) * 0.85, 18), true);
  PW(F, 0, 2.2, d / 2 + 0.07, w - 2 * r - 2, 3, 0, 0xffe0a8, 2); PB(F, 0, 3.9, d / 2 + 2.2, w * 0.45, 0.3, 4.4, '#ffffff', { mat: 'concrete' }); for (const sx of [-1, 1]) PC(F, sx * w * 0.2, 0, d / 2 + 4.1, 0.18, 3.9, '#ffffff', { mat: 'concrete' });
  PG(F, 0, 3.85, d / 2 + 4.35, w * 0.45, 0.06, 0.06, nc); PB(F, 0, 0.2, d / 2 + 0.8, w - 2, 0.25, 2.8, '#e0d4c0', { mat: 'plaza' });
  for (let i = 0; i < 3; i++) { const x = -w * 0.35 + i * w * 0.35; if (Math.abs(x) < w * 0.25) continue; PC(F, x, 0.45, d / 2 + 4.5, 0.5, 0.75, '#ffffff', { seg: 10, mat: 'metal' }); PC(F, x, 0.45, d / 2 + 4.5, 0.05, 2.2, '#888'); part(F, G.cone(10), x, 2.6, d / 2 + 4.5, 2.6, 0.6, 2.6, spick(PAL.accent)); }
  roofStuff(F, w, d, 1.1 + H, 2);
  return { top: 1.1 + H, flat: true };
}
function bHouse(F, w, d, L, o = {}) {
  const wall = o.wall || spick(PAL.house), slate = srand() < 0.3, two = srand() < 0.35, h = two ? 6.0 : 3.3, trim = '#ffffff', doorX = sr(-w * 0.2, w * 0.2), det = Q().detail;
  WIN_STYLE = srand() < 0.6 ? 0 : 3;
  PB(F, 0, -1.5, 0, w + 0.5, 1.8, d + 0.5, '#bdb3a2', { mat: 'concrete' }); PB(F, 0, 0.3, 0, w, h, d, wall, { mat: 'plaster' }); PB(F, 0, 0.3 + h - 0.25, 0, w + 0.2, 0.25, d + 0.2, trim, { mat: 'concrete' });
  const rm = { mat: slate ? 'slate' : 'roof' }, rc = slate ? '#c8ccd4' : '#ffffff';
  if (srand() < 0.7) part(F, G.pyr(), 0, 0.3 + h, 0, w + 1.3, sr(1.8, 2.8), d + 1.3, rc, rm); else part(F, G.gable(), 0, 0.3 + h, 0, w + 1.2, sr(2, 3), d + 1.2, rc, rm);
  PB(F, doorX, 0.3, d / 2 + 0.02, 1.1, 2.2, 0.12, spick(['#7a4a2a', '#2a4a6a', '#ffffff', '#a03a2a'])); PB(F, doorX, 2.5, d / 2 + 0.03, 1.5, 0.12, 0.2, trim, { mat: 'concrete' }); PG(F, doorX + 0.9, 2.1, d / 2 + 0.1, 0.18, 0.25, 0.1, '#ffd9a0');
  PB(F, doorX, 0, d / 2 + 0.7, 1.8, 0.3, 1.2, '#d8d0c4', { mat: 'concrete' });
  facade(F, w, d, 0.3, two ? 2 : 1, 3.0, { sp: 3.4, ww: 1.2, wh: 1.4, door: doorX, shutters: srand() < 0.5 ? spick(PAL.accent) : null });
  // Garage + Einfahrt
  const gx = w / 2 + 2.3, gh = 3.0; PB(F, gx, 0.3, -0.5, 4.4, gh, Math.min(d, 7), wall, { mat: 'plaster' }); { const gp = LP(F, gx, 0, -0.5), e = F.elements; World.addOBB(gp.x, gp.z, 2.2, Math.min(d, 7) / 2, Math.atan2(e[8], e[10]), gp.y + 3.3, gp.y - 2, 'building'); } PB(F, gx, 0.3 + gh, -0.5, 4.8, 0.3, Math.min(d, 7) + 0.4, trim, { mat: 'concrete' });
  PB(F, gx, 0.3, Math.min(d, 7) / 2 - 0.45, 3.4, 2.4, 0.1, '#e8e8e8', { mat: 'metal' }); for (let k = 1; k < 4; k++) PB(F, gx, 0.3 + k * 0.6, Math.min(d, 7) / 2 - 0.39, 3.4, 0.04, 0.04, '#c8c8c8');
  PB(F, gx, -1.2, Math.min(d, 7) / 2 + 4, 3.6, 1.34, 8, '#d0ccc4', { mat: 'concrete' });
  // Grundstück: Hecke, Briefkasten, Klimagerät, Pool
  if (det > 0) { PB(F, -w / 2 - 1.5, 0, 0, 0.8, 1.1, d + 4, '#3f6a32'); PB(F, 0, 0, -d / 2 - 1.8, w + 3, 1.1, 0.8, '#3f6a32'); }
  PB(F, -w / 2 + 0.8, 0, d / 2 + 4.6, 0.12, 1.1, 0.12, '#666', { mat: 'metal' }); PB(F, -w / 2 + 0.8, 1.1, d / 2 + 4.6, 0.35, 0.3, 0.55, spick(['#2a5aa0', '#ffffff', '#c0392b']), { mat: 'metal' });
  acUnit(F, -w / 2 - 0.5, 0.3, -d * 0.2, Math.PI / 2);
  if (srand() < 0.45 && det > 0) { PB(F, 0, 0.0, -d / 2 - 5, 9, 0.35, 5.5, '#f4f0e8', { mat: 'plaza' }); part(F, G.box(), 0, 0.31, -d / 2 - 5, 8, 0.06, 4.5, '#ffffff', { mat: 'pool' }); for (const sx of [-2.5, 2.5]) PB(F, sx, 0.35, -d / 2 - 1.8, 0.8, 0.3, 1.9, '#ffffff'); }
  if (srand() < 0.25 && det > 0 && !o.noCar) propCar(F, gx, d / 2 + 4.2, Math.PI, spick(PAL.car));
  return { top: 0.3 + h, flat: false };
}
function bShops(F, w, d, L) {
  const H = 5.2, wallC = spick(['#f4ecdc', '#e8d8c0', '#f8f0f0', '#dfe8ec', '#f0e0d0']), n = Math.max(2, Math.round(w / 7));
  PB(F, 0, -2, 0, w + 0.3, 2.3, d + 0.3, '#a8a296', { mat: 'concrete' }); PB(F, 0, 0.2, 0, w, H, d, wallC, { mat: 'plaster' }); PB(F, 0, 0.2 + H, d / 2 - 0.2, w + 0.2, 1.4, 0.4, wallC, { mat: 'plaster' }); PB(F, 0, 1.6 + H, d / 2 - 0.2, w + 0.3, 0.2, 0.5, spick(PAL.accent), { mat: 'concrete' });
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n, sw = w / n - 1, sh = spick(SHOPS);
    PW(F, x + 0.5, 2.0, d / 2 + 0.06, sw - 1.3, 2.8, 0, 0xfff0c8, 2); PB(F, x - sw / 2 + 0.6, 0.2, d / 2 + 0.05, 1.0, 2.5, 0.1, '#ffffff', { mat: 'win', emis: 0xfff0c8, cell: 2 }); PG(F, x - sw / 2 + 0.6, 2.75, d / 2 + 0.12, 0.2, 0.2, 0.08, '#ffd9a0');
    awning(F, x, 3.7, d / 2, sw + 0.2, sh[1] === '#fff' ? sh[2] : sh[1]); Signs.quad(F, x, 4.25, d / 2 + 0.1, sw * 0.85, 0.85, 0, Signs.cell(sh[0], sh[1], sh[2])); PB(F, x + sw / 2, 0.2, d / 2 - 0.1, 0.3, H, 0.3, '#e8e0d4', { mat: 'concrete' }); }
  roofStuff(F, w, d, 0.2 + H, n);
  return { top: 0.2 + H, flat: true };
}
function bWarehouse(F, w, d, L) {
  const H = sr(8, 12), c = spick(['#dfe4e8', '#d0d8de', '#e8e0d4', '#c8d4c8', '#d8c8c0', '#c4ccd8']), useBrick = srand() < 0.3;
  PB(F, 0, -1.5, 0, w + 0.4, 1.8, d + 0.4, '#8a8a84', { mat: 'concrete' }); PB(F, 0, 0.3, 0, w, H, d, useBrick ? '#ffffff' : c, { mat: useBrick ? 'brick' : 'steel' });
  part(F, G.hcyl(12), 0, 0.3 + H - 0.01, 0, w, d * 0.35, d, '#c8ccd0', { mat: 'steel' });
  const nd = Math.max(1, Math.floor(w / 9)); for (let i = 0; i < nd; i++) { const x = -w / 2 + (i + 0.5) * w / nd; PB(F, x, 0.3, d / 2 + 0.1, 4.2, 4.6, 0.12, '#e0e0dc', { mat: 'steel' }); PB(F, x, 4.9, d / 2 + 0.6, 5, 0.15, 1.2, '#555', { mat: 'metal' }); PG(F, x, 4.8, d / 2 + 0.25, 0.4, 0.18, 0.1, '#eaf2ff'); }
  PB(F, 0, 0, d / 2 + 1.6, w, 1.1, 3, '#9a9a94', { mat: 'concrete' }); for (let x = -w / 2 + 3; x < w / 2; x += 6) PC(F, x, 0.3 + H + d * 0.3, 0, 0.5, 1.2, '#b8bcc0', { seg: 8, mat: 'metal' });
  facade(F, w, d, 0.3, 1, H, { only: [Math.PI / 2, -Math.PI / 2], sp: 5, ww: 2.4, wh: 1.2, style: 1, sill: false });
  if (srand() < 0.5) Signs.quad(F, 0, H - 1.6, d / 2 + 0.12, Math.min(w * 0.6, 14), 1.4, 0, Signs.cell(spick(['RUST FLATS', 'CARGO CO', 'SOLARA FREIGHT', 'AUTO PARTS', 'STORAGE', 'MARINE SUPPLY', 'FISH MARKET']), '#1a2a3a', '#ffd23a', 2));
  return { top: 0.3 + H + d * 0.18, flat: false };
}
function bMotel(F, w, d, L) {
  const wallC = spick(PAL.pastel), acc = spick(PAL.accent), dd = Math.min(d, 9), n = Math.floor(w / 4);
  PB(F, 0, -1.5, -d / 2 + dd / 2, w, 1.8, dd, '#9a9488', { mat: 'concrete' }); PB(F, 0, 0.3, -d / 2 + dd / 2, w, 6.2, dd, wallC, { mat: 'plaster' }); PB(F, 0, 6.5, -d / 2 + dd / 2, w + 0.6, 0.4, dd + 0.6, acc, { mat: 'plaster' });
  const fz = -d / 2 + dd; PB(F, 0, 3.2, fz + 0.9, w, 0.2, 1.8, '#e8e4dc', { mat: 'concrete' }); railing(F, -w / 2, fz + 1.75, w / 2, fz + 1.75, 3.4, 0.9, '#f0f0f0', 0.4); for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 4) PB(F, x, 0.3, fz + 1.7, 0.15, 2.9, 0.15, '#ffffff', { mat: 'concrete' });
  for (let f = 0; f < 2; f++) for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n, y = 0.3 + f * 3.1; PB(F, x - 0.9, y, fz + 0.05, 0.95, 2.2, 0.08, spick(['#3a6a8a', '#8a3a3a', '#3a7a5a'])); PW(F, x + 0.6, y + 1.4, fz + 0.06, 1.3, 1.1, 0, litCol(), 3); PG(F, x - 0.9, y + 2.4, fz + 0.12, 0.15, 0.15, 0.08, '#ffd9a0'); }
  PB(F, w / 2 - 1, 0.3, fz + 2.5, 1.2, 3.1, 2, '#d8d0c4', { mat: 'plaster' });
  PC(F, -w / 2 - 3, 0, d / 2 - 2, 0.25, 7, '#888', { mat: 'metal' }); PB(F, -w / 2 - 3, 7, d / 2 - 2, 4.4, 2, 0.5, acc); signF(F, 'MOTEL', '#ff2d95', -w / 2 - 3, 8, d / 2 - 1.7, 4, 1.4);
  PB(F, 0, -0.5, fz + 7, w, 0.56, 8, '#ffffff', { mat: 'road' }); for (let x = -w / 2 + 2; x < w / 2; x += 3) PB(F, x, 0.07, fz + 7, 0.1, 0.02, 5, '#e8e8e8', { mat: 'mark' });
  return { top: 6.9, flat: true, depthUsed: dd };
}
function bChurch(F, w, d) {
  const wall = '#f8f2e4'; PB(F, 0, -1, 0, w + 0.5, 1.3, d + 0.5, '#bdb3a2', { mat: 'concrete' }); PB(F, 0, 0.3, -1, w, 8, d - 2, wall, { mat: 'plaster' }); part(F, G.gable(), 0, 8.3, -1, w + 0.8, 4, d - 1.4, '#ffffff', { mat: 'roof' });
  PB(F, 0, 0.3, d / 2 - 2, 4.4, 15, 4.4, wall, { mat: 'plaster' }); part(F, G.pyr(), 0, 15.3, d / 2 - 2, 5, 5, 5, '#ffffff', { mat: 'roof' }); PB(F, 0, 20.3, d / 2 - 2, 0.2, 2.2, 0.2, '#d4af37', { mat: 'metal' }); PB(F, 0, 21.4, d / 2 - 2, 1.2, 0.2, 0.2, '#d4af37', { mat: 'metal' });
  PB(F, 0, 0.3, d / 2 + 0.25, 1.8, 3.2, 0.12, '#5a3a20'); PW(F, 0, 11, d / 2 + 0.25, 1.4, 1.4, 0, 0xffe9b0, 0);
  facade(F, w, d - 2, 1.5, 1, 6, { only: [Math.PI / 2, -Math.PI / 2], sp: 4, ww: 1.1, wh: 4, sill: false, style: 0 });
  return { top: 8.3, flat: false };
}
// Geparktes Deko-Auto aus echtem Automodell (statisch in die Welt-Meshes gemischt, mit Kollision)
const PROP_CARS = ['normalcar1', 'normalcar2', 'suv', 'sportscar', 'sportscar2', 'taxi'];
function propCar(F, x, z, ry, c) {
  const M = FRL(F, x, 0, z, ry), parts = CarLib.staticParts(spick(PROP_CARS));
  if (parts) { const T = new THREE.Matrix4();
    for (const p of parts) { T.copy(M).multiply(p.m); emit(p.mat, p.geo, T, p.paint ? c : p.color, null, 1, 1, 1, 0, true); } }
  const p = LP(F, x, 0, z), e = F.elements; World.addOBB(p.x, p.z, 0.95, 2.3, Math.atan2(e[8], e[10]) + ry, p.y + 1.5);
}

// ---------- GRUNDSTÜCKE ----------
const _nn = [];
function lotFree(x, z, w, d, yaw, margin = 3) {
  const c = Math.cos(yaw), s = Math.sin(yaw), corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [0, 0], [0, d / 2], [0, -d / 2], [w / 2, 0], [-w / 2, 0]]; let mn = 1e9, mx = -1e9;
  for (const [lx, lz] of corners) { const X = x + lx * c + lz * s, Z = z - lx * s + lz * c; const r = Roads.nearest(X, Z, 30); if (r && r.d < r.e.hw + margin) return null;
    for (const n of Roads.nodesNear(X, Z, 24, _nn)) if (Math.hypot(n.x - X, n.z - Z) < n.r + margin + 2) return null;
    const h = terrainHeight(X, Z); mn = Math.min(mn, h); mx = Math.max(mx, h); }
  if (mn < 1.4 || mx - mn > 7) return null;
  const R = Math.hypot(w, d) / 2 + 3; const near = World.query(x - R, z - R, x + R, z + R, _qb);
  for (const b of near) { if (b.tag === 'prop') continue; if (obbHit(x, z, w / 2, d / 2, yaw, b, LOT_GAP)) return null; }
  return { x, z, w, d, yaw, y: (mn + mx) / 2 - 0.1 };
}
// Gelände unter einem Grundstück auf dessen Höhe ziehen (Straßen & Gehwege bleiben unberührt)
function flattenRect(cx, cz, hx, hz, yaw, y, pad = 4, fall = 8) {
  const c = Math.cos(yaw), s = Math.sin(yaw), R = Math.hypot(hx, hz) + pad + fall;
  const i0 = Math.max(0, Math.floor((cx - R + WS) / CELL)), i1 = Math.min(GN - 1, Math.ceil((cx + R + WS) / CELL)), j0 = Math.max(0, Math.floor((cz - R + WS) / CELL)), j1 = Math.min(GN - 1, Math.ceil((cz + R + WS) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = -WS + i * CELL, z = -WS + j * CELL, dx = x - cx, dz = z - cz, lx = dx * c - dz * s, lz = dx * s + dz * c;
    const ex = Math.max(0, Math.abs(lx) - hx - pad), ez = Math.max(0, Math.abs(lz) - hz - pad), w = 1 - sstep(0, fall, Math.hypot(ex, ez)); if (w <= 0) continue;
    const r = Roads.nearest(x, z, 30); if (r && r.d < r.e.hw + 3.8) continue; const k = j * GN + i; HGT[k] = lerp(HGT[k], y, w); }
}
function placeBuilding(L, fn, opts) {
  flattenRect(L.x, L.z, L.w / 2, L.d / 2, L.yaw, L.y + 0.08, fn === bHouse ? 7 : 3, 7);
  const F = FR(L.x, L.y, L.z, L.yaw); const r = fn(F, L.w, L.d, L, opts) || { top: 6 }; L.top = r.top;
  const dd = r.obbD || r.depthUsed || L.d, ww = r.obbW || L.w, oz = r.depthUsed ? -(L.d - dd) / 2 : 0, cx = L.x + Math.sin(L.yaw) * oz, cz = L.z + Math.cos(L.yaw) * oz;
  World.addOBB(cx, cz, ww / 2, dd / 2, L.yaw, L.y + r.top, L.y - 3, 'building'); if (r.flat) World.addRoof(cx, cz, ww / 2, dd / 2, L.yaw, L.y + r.top);
  BLD.push({ x: cx, z: cz, w: ww, d: dd, yaw: L.yaw, h: r.top }); return F;
}
function zoneAt(x, z) {
  if (inBase(x, z, 25)) return 'base';
  const D = distAt(x, z); if (D) return D.k;
  if (onStrip(x, z)) return 'strip';
  if (inUrban(x, z)) return 'urban';
  for (const k of KEYS) if (Math.hypot(x - k.x, z - k.z) < k.r + 40) return 'keys';
  if (Math.hypot(x - STAR.x, z - STAR.z) < STAR.r + 30) return 'heights';
  if (Math.hypot(x - SWAMP.x, z - SWAMP.z) < SWAMP.r) return 'swamp';
  if (terrainHeight(x, z) > 60) return 'mountain';
  return 'rural';
}
function lotsAlong(cb) {
  for (const e of Roads.edges) { const A = Roads.nodes[e.a], B = Roads.nodes[e.b]; let s = A.r + 9;
    while (s < e.len - B.r - 9) { const k = Math.round(s / e.len * (e.pts.length - 1)), p = e.pts[k]; const step = cb(e, p, zoneAt(p.x, p.z), s); s += step || 20; } }
}
function lotAt(e, p, side, off, w, d, margin) { const x = p.x - p.tz * off * side, z = p.z + p.tx * off * side, yaw = Math.atan2(p.tz * side, -p.tx * side); return lotFree(x, z, w, d, yaw, margin); }
function specialLot(px, pz, w, d, filter = (e) => e.type !== 'highway') {
  for (let rad = 0; rad < 320; rad += 15) for (let a = 0; a < 8; a++) {
    const r = Roads.nearest(px + Math.cos(a) * rad, pz + Math.sin(a) * rad, 80, filter); if (!r) continue; const p = r.p, e = r.e;
    for (const side of [1, -1]) { const off = e.hw + 3.6 + 2 + d / 2, x = p.x - p.tz * off * side, z = p.z + p.tx * off * side, yaw = Math.atan2(p.tz * side, -p.tx * side);
      const L = lotFree(x, z, w, d, yaw, 2.5); if (L) { L.front = V3(p.x - p.tz * (e.hw + 2) * side, p.y, p.z + p.tx * (e.hw + 2) * side); L.road = r; return L; } }
  }
  return null;
}
function lotPoint(L, lx, lz) { const c = Math.cos(L.yaw), s = Math.sin(L.yaw); return V3(L.x + lx * c + lz * s, L.y, L.z - lx * s + lz * c); }
function reserve(L) { flattenRect(L.x, L.z, L.w / 2, L.d / 2, L.yaw, L.y + 0.08, 2, 7); World.addOBB(L.x, L.z, L.w / 2, L.d / 2, L.yaw, -100, -50, 'reserve'); }
function paved(F, w, d, c = '#3a3b40', y = 0) { PB(F, 0, y - 1, 0, w, 1.12, d, c); }
function parkLines(F, x0, x1, z, len, c = '#e8e8e8') { for (let x = x0; x <= x1; x += 2.8) PB(F, x, 0.13, z, 0.12, 0.02, len, c); }

// ---------- SONDERORTE ----------
function buildSpecials() {
  // Krankenhaus
  let L = specialLot(DOWNTOWN.x - 110, DOWNTOWN.z - 120, 48, 36);
  if (L) { placeBuilding(L, (F, w, d) => { PB(F, 0, -2, 0, w + 0.4, 2.3, d + 0.4, '#8a8378'); PB(F, 0, 0.2, 0, w, 22, d, '#f4f6f8'); facade(F, w, d, 0.4, 6, 3.6, { sp: 3, ww: 2, wh: 1.6, door: 0 });
      for (const x of [-w / 2 - 0.2, w / 2 + 0.2]) PG(F, x, 0.2, d / 2 - 0.4, 0.15, 22, 0.15, '#ff3030'); PB(F, 0, 0.2, d / 2 + 3, 12, 0.3, 6, '#f0f0f0'); PB(F, 0, 4, d / 2 + 3, 14, 0.4, 7, '#d8e0e8');
      signF(F, 'HOSPITAL', '#ff3030', 0, 18, d / 2 + 0.3, 16, 3.6); signF(F, '+', '#ff2020', -w / 2 + 4, 12, d / 2 + 0.3, 4, 4); PC(F, w * 0.25, 22.2, -d * 0.2, 6, 0.15, '#5a5e64', { seg: 16 }); PB(F, w * 0.25 - 1.4, 22.36, -d * 0.2, 0.4, 0.02, 3.5, '#ffffff'); PB(F, w * 0.25 + 1.4, 22.36, -d * 0.2, 0.4, 0.02, 3.5, '#ffffff'); PB(F, w * 0.25, 22.36, -d * 0.2, 2.4, 0.02, 0.4, '#ffffff');
      return { top: 22.2, flat: true }; });
    LOC.hospital = L.front; LOC.hospital.yaw = L.yaw; PICKUP_SPOTS.push(['health', L.front.x, L.front.z]); }
  // Polizei-Hauptquartier
  L = specialLot(DOWNTOWN.x + 110, DOWNTOWN.z + 120, 46, 30);
  if (L) { const F = placeBuilding(L, (F, w, d) => { PB(F, 0, -2, 0, w + 0.4, 2.3, d + 0.4, '#8a8378'); PB(F, 0, 0.2, -4, w, 14, d - 8, '#dfe6ef'); facade(F, w, d - 8, 0.4, 4, 3.4, { sp: 3, ww: 2, wh: 1.4, door: 0, day: '#4a6a8a' });
      PB(F, 0, 0.2 + 14, -4, w + 0.3, 0.8, d - 7.7, '#1f3a6a'); PG(F, 0, 14.6, d / 2 - 7.8, w, 0.15, 0.1, '#2a6aff'); PB(F, 0, 0, d / 2 - 4, w, 0.12, 8, '#4a4a4e'); parkLines(F, -w / 2 + 3, w / 2 - 3, d / 2 - 4, 5);
      for (let i = 0; i < 5; i++) PC(F, -w / 2 + 3 + i * 1.5, 0, d / 2 - 0.5, 0.15, 0.9, '#2a6aff'); signF(F, 'POLICE', '#3a7bff', 0, 10.5, d / 2 - 7.7, 14, 3.4); return { top: 15, flat: true, depthUsed: d }; });
    LOC.police = L.front; LOC.police.yaw = L.yaw; PICKUP_SPOTS.push(['armor', L.front.x, L.front.z]); const pp = lotPoint(L, -6, L.d / 2 - 4); PARKED.push(['police', pp.x, pp.z, L.yaw + Math.PI]); const pp2 = lotPoint(L, 4, L.d / 2 - 4); PARKED.push(['police', pp2.x, pp2.z, L.yaw + Math.PI]); }
  // Kais Safehouse
  L = specialLot(SUBURB.x + 20, SUBURB.z - 20, 20, 22);
  if (L) { placeBuilding(L, (F, w, d) => { const r = bHouse(F, 13, 11, L, { wall: '#f8f0e0', noCar: true }); Signs.quad(F, -3.5, 2.6, 5.6, 1.6, 0.4, 0, Signs.cell('KAI', '#1fb5a8', '#fff')); return Object.assign(r, { obbW: 13, obbD: 11 }); });
    LOC.safehouse = L.front; LOC.safehouse.yaw = L.yaw; const cp = lotPoint(L, 8.8, 7.2); PARKED.push(['muscle', cp.x, cp.z, L.yaw + Math.PI]); const bp = lotPoint(L, 5.6, 8.2); PARKED.push(['bike', bp.x, bp.z, L.yaw + Math.PI * 0.85]); }
  // Parkplatz Mission 1 (mit Kiosk)
  L = specialLot(SUBURB.x - 150, SUBURB.z + 110, 42, 30);
  if (L) { reserve(L); const F = FR(L.x, L.y, L.z, L.yaw); paved(F, L.w, L.d); parkLines(F, -L.w / 2 + 3, L.w / 2 - 3, -L.d / 2 + 5, 5); parkLines(F, -L.w / 2 + 3, L.w / 2 - 3, L.d / 2 - 5, 5);
    for (const x of [-12, 4, 10]) propCar(F, x + 1.4, -L.d / 2 + 5, 0, spick(PAL.car));
    PB(F, L.w / 2 - 3, 0, 0, 3, 2.6, 4, '#f4f0e8'); PW(F, L.w / 2 - 4.55, 1.5, 0, 2.6, 1.2, -Math.PI / 2, 0xfff0c8); Signs.quad(F, L.w / 2 - 3, 2.65, 2.05, 2.5, 0.6, 0, Signs.cell('PARKING', '#1f4fa0', '#fff'));
    LOC.m1lot = L.front; LOC.m1car = lotPoint(L, -2, L.d / 2 - 5); LOC.m1car.yaw = L.yaw; }
  // Neon Plaza (Mission 2) mit Brunnen
  const cn = Roads.groups.dt[3][3]; L = specialLot(cn.x + 30, cn.z + 30, 36, 36);
  if (L) { World.addOBB(L.x, L.z, 4.6, 4.6, L.yaw, L.y + 1, L.y - 2); reserve(L); const F = FR(L.x, L.y, L.z, L.yaw);
    PB(F, 0, -1, 0, L.w, 1.25, L.d, '#e6d6bc'); for (let i = -2; i <= 2; i++) PB(F, i * 6, 0.25, 0, 0.3, 0.02, L.d, '#d0c0a4');
    PC(F, 0, 0.25, 0, 4.6, 0.8, '#f4f4f0', { seg: 20 }); part(F, G.cyl(20), 0, 0.9, 0, 8.4, 0.15, 8.4, '#3fc8e8', { mat: 'shiny' }); PC(F, 0, 0.25, 0, 0.7, 3.4, '#ffffff', { seg: 12 }); PC(F, 0, 3.6, 0, 1.6, 0.25, '#ffffff', { seg: 12 });
    for (let a = 0; a < 8; a++) { const x = Math.cos(a / 8 * Math.PI * 2) * 13, z = Math.sin(a / 8 * Math.PI * 2) * 13; const p = LP(F, x, 0, z); TREES.push({ t: 'palm', x: p.x, z: p.z, s: 1 }); PB(F, x * 1.2, 0.25, z * 1.2, 2.2, 0.45, 0.6, '#8a6a4a', { ry: Math.atan2(x, z) }); }
    signF(F, 'NEON PLAZA', '#ff2d95', 0, 5, L.d / 2 + 0.5, 12, 2.6); LOC.plaza = L.front; LOC.plaza.yaw = L.yaw; }
  // Chop Shop
  L = specialLot(PORT.x - 60, PORT.z - 40, 40, 28);
  if (L) { placeBuilding(L, (F, w, d) => { const r = bWarehouse(F, w, d, L); signF(F, 'CHOP SHOP', '#ffb03a', 0, 9.5, d / 2 + 0.4, 12, 2.6); return r; }); LOC.chop = L.front; }
  // Tankstellen
  for (const [gx, gz, brand, name] of [[MIDTOWN.x + 215, MIDTOWN.z - 240, '#c8202a', 'SOLGAS'], [UPTOWN.x - 170, UPTOWN.z + 160, '#1f6fd0', 'BLUE PUMP'], [SUBURB.x - 60, SUBURB.z - 300, '#16a34a', 'PALM FUEL'], [SUBURB2.x + 290, SUBURB2.z - 240, '#ff8a1a', 'GULF']]) {
    L = specialLot(gx, gz, 36, 28); if (L) gasStation(L, [brand, name]); }
  // Diner
  L = specialLot(DOWNTOWN.x - 280, DOWNTOWN.z - 40, 24, 16);
  if (L) placeBuilding(L, (F, w, d) => { PB(F, 0, -1, 0, w, 1.3, d, '#bdb3a2'); PB(F, -3, 0.3, 0, w - 6, 3.8, d - 2, '#f4f4f0'); PC(F, w / 2 - 6, 0.3, 0, (d - 2) / 2, 3.8, '#f4f4f0', { seg: 16 }); part(F, G.box(), -3, 2.6, d / 2 - 0.95, w - 6, 0.25, 0.1, '#c0c8d0', { mat: 'shiny' });
    PW(F, -3, 1.7, d / 2 - 0.92, w - 7, 1.4, 0, 0xfff0c8); PG(F, -3, 3.9, d / 2 - 0.9, w - 6, 0.15, 0.1, '#ff2d95'); signF(F, 'DINER', '#ff2d95', -3, 5.6, d / 2 - 0.9, 7, 1.8); PB(F, -3, 4.1, 0, w - 5, 0.3, d - 1.6, '#c0392b'); return { top: 4.4, flat: true }; });
  // Shops & Dienstleister (für Aktivitäten)
  const shop = (k, px, pz, w, d, sign, color, fn) => { const L2 = specialLot(px, pz, w, d); if (!L2) return; placeBuilding(L2, (F, ww, dd) => { const r = fn(F, ww, dd, L2); PB(F, 0, (r.top || 6), dd / 2 - 0.6, Math.min(ww * 0.85, 13), 2.6, 0.3, '#1a1c22', { keep: true }); signF(F, sign, color, 0, (r.top || 6) + 1.3, dd / 2 - 0.4, Math.min(ww * 0.8, 12), 2.2); return r; }); LOC[k] = L2.front.clone(); LOC[k].yaw = L2.yaw; };
  shop('dealer', DOWNTOWN.x - 180, DOWNTOWN.z + 140, 30, 22, 'SOLARA MOTORS', '#4aa3ff', (F, w, d, L2) => { const r = bShops(F, w, d, L2); for (const x of [-6, 0, 6]) propCar(F, x, d / 2 + 4, Math.PI * 0.85, spick(PAL.car)); return r; });
  shop('customs', PORT.x - 140, PORT.z - 90, 26, 20, 'SOLARA CUSTOMS', '#ffb03a', (F, w, d, L2) => bWarehouse(F, w, d, L2));
  shop('guns', DOWNTOWN.x + 200, DOWNTOWN.z - 60, 18, 14, 'SOLARA ARMS', '#ff4a4a', (F, w, d, L2) => bShops(F, w, d, L2));
  shop('clothes', beachCX(-420) + 20, -420, 20, 14, 'OCEAN THREADS', '#ff2d95', (F, w, d, L2) => bShops(F, w, d, L2));
  shop('realty', SUBURB.x + 120, SUBURB.z - 120, 18, 14, 'PALM REALTY', '#5fd35f', (F, w, d, L2) => bShops(F, w, d, L2));
  shop('pizza', VILLAGE.x + 40, VILLAGE.z - 60, 18, 14, 'PIZZA PIAZZA', '#ff7a1a', (F, w, d, L2) => bShops(F, w, d, L2));
  buildStadium(); buildPier();
}
function buildStadium() {
  const L = specialLot(DOWNTOWN.x + 30, DOWNTOWN.z - 300, 110, 90); if (!L) return; reserve(L); LOC.stadium = V3(L.x, L.y, L.z); LOC.stadium.yaw = L.yaw; const F = FR(L.x, L.y, L.z, L.yaw);
  PB(F, 0, -1, 0, L.w, 1.1, L.d, '#9a9a94'); PB(F, 0, 0.1, 0, 60, 0.1, 36, '#3a9a3a'); for (let i = -2; i <= 2; i++) PB(F, i * 12, 0.2, 0, 6, 0.02, 36, '#48a848');
  PB(F, 0, 0.21, 0, 60, 0.02, 0.2, '#ffffff'); PC(F, 0, 0.21, 0, 4.5, 0.02, '#ffffff', { seg: 20 }); PC(F, 0, 0.215, 0, 4.3, 0.02, '#3a9a3a', { seg: 20 });
  const N = 28; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), rx = 46, rz = 34; for (let k = 0; k < 4; k++) part(F, G.box(), c * (rx + k * 2.4), 0.1 + k * 1.8, s * (rz + k * 2.4), 2.2, 1.8, 2 * Math.PI * (rx + 4) / N + 1, k % 2 ? '#d8d8d8' : spick(['#1f6fd0', '#c8202a']), { ry: Math.atan2(c / rx, s / rz) }); }
  for (const [x, z] of [[-44, -32], [44, -32], [-44, 32], [44, 32]]) { PC(F, x, 0, z, 0.6, 30, '#8a8a90'); PB(F, x, 30, z, 6, 2.4, 0.6, '#3a3a40', { ry: Math.atan2(-x, -z) }); PG(F, x, 30.3, z, 5.4, 1.8, 0.7, '#fffbe8', { ry: Math.atan2(-x, -z) }); World.lampAnchors.push(LP(F, x * 0.9, 28, z * 0.9)); }
  World.addOBB(L.x, L.z, 2, 2, 0, L.y - 1); signF(F, 'SOLARA ARENA', '#22e4ff', 0, 10, 46, 20, 4); BLD.push({ x: L.x, z: L.z, w: 100, d: 76, yaw: L.yaw });
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, p = LP(F, Math.cos(a) * 50, 0, Math.sin(a) * 38); World.addOBB(p.x, p.z, 2.5, 2.5, 0, L.y + 7); }
}
function buildPier() { // Vergnügungs-Pier mit Riesenrad am Ocean Drive
  const p = beachAt(520, 0.0), dir = V3(1, 0, 0), side = V3(-dir.z, 0, dir.x), yaw = Math.atan2(dir.x, dir.z), Lp = 150;
  const base = p.clone().addScaledVector(dir, -20), F = FR(base.x, 0, base.z, yaw); LOC.pier = base.clone();
  PB(F, 0, 2.0, Lp / 2, 14, 0.5, Lp, '#9a7a5a'); World.platforms.push({ cx: base.x + dir.x * Lp / 2, cz: base.z + dir.z * Lp / 2, hx: 7, hz: Lp / 2, c: Math.cos(yaw), s: Math.sin(yaw), top: 2.5 });
  for (let z = 4; z < Lp; z += 8) for (const x of [-6.5, 6.5]) { PC(F, x, -4, z, 0.3, 6.2, '#6a4a2a'); }
  railing(F, -7, 0, -7, Lp, 2.5, 1, '#f4f4f0', 2); railing(F, 7, 0, 7, Lp, 2.5, 1, '#f4f4f0', 2);
  for (let z = 10; z < Lp; z += 22) { PB(F, -4.5, 2.5, z, 0.12, 4, 0.12, '#444'); PB(F, -4.5, 6.5, z, 1.2, 0.2, 0.4, '#333'); PG(F, -4.5, 6.3, z, 0.6, 0.15, 0.3, '#ffd9a0'); World.lampAnchors.push(LP(F, -4.5, 6, z)); }
  for (const [z, c, n] of [[30, '#ff5a8a', 'CORN DOGS'], [50, '#1fb5a8', 'ICE CREAM'], [70, '#ffb03a', 'GAMES']]) { PB(F, 4.8, 2.5, z, 3, 3, 4, '#f8f0e8'); awning(F, 3.3 - 0.0, 4.6, z, 4, c); Signs.quad(F, 3.29, 5.6, z, 3.2, 0.7, -Math.PI / 2, Signs.cell(n, c, '#fff')); }
  // Riesenrad (animiert)
  const wheel = new THREE.Group(), wp = LP(F, 0, 2.5, 110); wheel.position.set(wp.x, wp.y + 23, wp.z); wheel.rotation.y = yaw + Math.PI / 2;
  const rimG = []; const R = 20, n = 16;
  for (const zz of [-1.5, 1.5]) { const t = new THREE.TorusGeometry(R, 0.35, 5, 40); t.translate(0, 0, zz); rimG.push(nonIdx(t)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = new THREE.BoxGeometry(0.25, R, 0.25); b.translate(0, R / 2, zz); b.rotateZ(a); rimG.push(nonIdx(b)); } }
  const hub = nonIdx(new THREE.CylinderGeometry(1.4, 1.4, 4, 10)); hub.rotateX(Math.PI / 2); rimG.push(hub);
  wheel.add(new THREE.Mesh(ADD.merge(rimG.map(g => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; })), lam({ color: 0xf4f4f0, flatShading: true })));
  const lights = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, s = new THREE.SphereGeometry(0.3, 4, 3); s.translate(Math.cos(a) * R, Math.sin(a) * R, 1.6); lights.push(nonIdx(s)); }
  const lm = new THREE.Mesh(ADD.merge(lights.map(g => { g.deleteAttribute('normal'); g.computeVertexNormals(); return g; })), new THREE.MeshBasicMaterial({ color: 0xff5ad0, toneMapped: false })); wheel.add(lm); neonMats.push(lm.material);
  const cabins = []; for (let i = 0; i < 12; i++) { const c = new THREE.Group(); const a = i / 12 * Math.PI * 2; c.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); const cm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.6), lam({ color: new THREE.Color().setHSL(i / 12, 0.7, 0.55), flatShading: true })); cm.position.y = -1.6; c.add(cm); wheel.add(c); cabins.push(c); }
  scene.add(wheel); World.anim.push((dt) => { wheel.rotation.z += dt * 0.06; for (const c of cabins) c.rotation.z = -wheel.rotation.z; });
  for (const sx of [-1, 1]) { seg(wp.x + side.x * 0 + dir.x * sx * 10, wp.y, wp.z + dir.z * sx * 10, wp.x, wp.y + 23, wp.z, 0.8, 0.8, '#d8d8d8'); }
  World.addOBB(wp.x, wp.z, 3, 3, yaw, wp.y + 44, wp.y - 1); for (const sx of [-6.8, 6.8]) PB(F, sx, 2.5, 1, 0.4, 7.5, 0.4, '#f4f4f0'); PB(F, 0, 8.6, 1, 14, 0.4, 0.5, '#f4f4f0'); signF(F, 'SOLARA PIER', '#22e4ff', 0, 7, 0.7, 13, 2.6, false, Math.PI);
}

// ---------- MILITÄRBASIS ----------
function buildBase() {
  const y = BASE.h, bx = BASE.x, bz = BASE.z, rx = bx - 70, F0 = FR(0, 0, 0, 0);
  PB(F0, rx, y - 1, bz, 46, 1.08, 840, '#55575c'); for (let z = -400; z <= 400; z += 30) PB(F0, rx, y + 0.09, bz + z, 1, 0.02, 14, '#f0f0f0');
  for (const e of [-1, 1]) { for (let k = -8; k <= 8; k++) if (Math.abs(k) > 1) PB(F0, rx + k * 2.6, y + 0.09, bz + e * 392, 1.6, 0.02, 24, '#f0f0f0'); for (let k = -10; k <= 10; k++) PG(F0, rx + k * 2.2, y + 0.1, bz + e * 418, 0.4, 0.15, 0.4, e > 0 ? '#3aff6a' : '#ff3a3a'); }
  for (let z = -410; z <= 410; z += 20) for (const s of [-1, 1]) PG(F0, rx + s * 23.5, y + 0.1, bz + z, 0.3, 0.2, 0.3, '#ffe9a0');
  PB(F0, bx - 10, y - 1, bz, 20, 1.08, 640, '#5e6064'); for (let z = -300; z <= 300; z += 4) PB(F0, bx - 10, y + 0.09, bz + z, 0.25, 0.02, 2, '#ffd23a');
  for (const z of [-310, 0, 310]) PB(F0, bx - 40, y - 1, bz + z, 60, 1.08, 18, '#5e6064');
  PB(F0, bx + 35, y - 1, bz, 70, 1.07, 340, '#7a7c80');
  LOC.runway = V3(rx, y, bz + 360); LOC.runway.yaw = Math.PI; LOC.base = V3(bx + 30, y, bz);
  for (const hz of [-120, 0, 120]) { const hx = bx + 92, F = FR(hx, y, bz + hz, 0);
    part(F, G.hcyl(12), 0, 0, 0, 34, 17, 34, '#6f7a6a'); PB(F, 0, 0, 0, 34, 0.1, 34, '#8a8c90');
    PB(F, 16.7, 0, 0, 0.6, 14, 34, '#5f6a5a'); for (let z = -15; z <= 15; z += 3) PB(F, -16.6, 0, z, 0.4, 7, 2.6, '#4a4e50');
    PG(F, -17, 9, 0, 0.2, 0.8, 8, '#eaf2ff'); Signs.quad(F, -17.05, 11, 0, 8, 1.6, -Math.PI / 2, Signs.cell('HANGAR ' + (hz / 120 + 2), '#2a3a2a', '#ffd23a'));
    World.addOBB(hx + 16.5, bz + hz, 0.6, 17, 0, y + 17); World.addOBB(hx, bz + hz - 17, 17, 0.6, 0, y + 12); World.addOBB(hx, bz + hz + 17, 17, 0.6, 0, y + 12); BLD.push({ x: hx, z: bz + hz, w: 34, d: 34, yaw: 0 }); }
  const tF = FR(bx + 40, y, bz - 230, 0); PC(tF, 0, 0, 0, 3.4, 26, '#d8d8d0', { seg: 12 }); part(tF, G.tcyl(12, 1.25), 0, 26, 0, 10, 5, 10, '#3d5a73', { mat: 'win', emis: 0x9fd0ff }); PC(tF, 0, 31, 0, 6.4, 0.8, '#6a6e74', { seg: 12 }); PC(tF, 0, 31.8, 0, 0.2, 6, '#ccc'); PG(tF, 0, 37.8, 0, 0.5, 0.5, 0.5, '#ff2020');
  World.addOBB(bx + 40, bz - 230, 3.5, 3.5, 0, y + 32); World.addRoof(bx + 40, bz - 230, 5, 5, 0, y + 31.8); BLD.push({ x: bx + 40, z: bz - 230, w: 8, d: 8, yaw: 0 });
  for (const k of [0, 1]) { const L = { x: bx + 60, y, z: bz + 230 + k * 30, w: 50, d: 16, yaw: 0 }; placeBuilding(L, (F, w, d) => { PB(F, 0, -1, 0, w, 8, d, '#a8a890'); facade(F, w, d, 0.5, 2, 3.4, { sp: 3.4, ww: 1.4, wh: 1.2 }); part(F, G.gable(), 0, 7, 0, w + 0.6, 2.5, d + 0.8, '#5a6a4a', { ry: Math.PI / 2 * 0 }); return { top: 7, flat: false }; }); }
  LOC.helipads = []; for (const k of [0, 1, 2]) { const hx = bx + 10, hz = bz + 190 + k * 40; PC(F0, hx, y - 1, hz, 10, 1.18, '#6a6c70', { seg: 20 }); PC(F0, hx, y + 0.17, hz, 9, 0.02, '#ffd23a', { seg: 20 }); PC(F0, hx, y + 0.18, hz, 8.4, 0.02, '#6a6c70', { seg: 20 });
    PB(F0, hx - 2.2, y + 0.19, hz, 1.2, 0.02, 7, '#f0f0f0'); PB(F0, hx + 2.2, y + 0.19, hz, 1.2, 0.02, 7, '#f0f0f0'); PB(F0, hx, y + 0.19, hz, 3.4, 0.02, 1.2, '#f0f0f0'); LOC.helipads.push(V3(hx, y, hz)); }
  // Radar (dreht sich)
  const rp = V3(bx + 60, y, bz - 300); PB(F0, rp.x, y, rp.z, 4, 6, 4, '#c8c8c0'); const radar = new THREE.Group(); radar.position.set(rp.x, y + 7, rp.z);
  const dish = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 0.4), lam({ color: 0xe0e0e0, flatShading: true })); dish.rotation.x = -0.3; dish.position.y = 1; radar.add(dish); scene.add(radar); World.anim.push((dt) => { radar.rotation.y += dt * 1.2; }); World.addOBB(rp.x, rp.z, 2, 2, 0, y + 6);
  // Tanks, Sandsäcke, Wachposten, Zaun
  for (let i = 0; i < 3; i++) { PC(F0, bx + 100, y, bz - 280 + i * 16, 6, 7, '#d8d8d0', { seg: 14 }); World.addOBB(bx + 100, bz - 280 + i * 16, 5, 5, 0, y + 7); }
  const gx = bx + BASE.hx; PB(F0, gx - 2, y, bz + 40, 3, 3, 3, '#a8a890'); PB(F0, gx - 2, y + 3, bz + 40, 3.6, 0.3, 3.6, '#5a6a4a'); PB(F0, gx + 1, y + 1, bz + 60, 0.3, 0.3, 36, '#e8e8e8', { rx: 0 }); for (let z = 44; z < 80; z += 4) PB(F0, gx + 1, y + 1.05, bz + z, 0.32, 0.32, 1.8, '#c0392b');
  const fx0 = bx - BASE.hx, fx1 = bx + BASE.hx, fz0 = bz - BASE.hz, fz1 = bz + BASE.hz;
  const fence = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 4); for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n), z = lerp(z0, z1, i / n), h = terrainHeight(x, z); PB(F0, x, h, z, 0.12, 3, 0.12, '#8a8f94'); }
    for (const yy of [1, 2, 2.9]) seg(x0, terrainHeight(x0, z0) + yy, z0, x1, terrainHeight(x1, z1) + yy, z1, 0.04, 0.04, '#a0a4a8'); World.addOBB((x0 + x1) / 2, (z0 + z1) / 2, 0.2, L / 2, Math.atan2(x1 - x0, z1 - z0), Math.max(terrainHeight(x0, z0), terrainHeight(x1, z1)) + 3); };
  fence(fx0, fz0, fx1, fz0); fence(fx0, fz1, fx1, fz1); fence(fx0, fz0, fx0, fz1); fence(fx1, fz0, fx1, bz + 40); fence(fx1, bz + 80, fx1, fz1);
  addSign('SOLARA AIR BASE', '#ffb03a', fx1 + 1, y + 7, bz + 60, Math.PI / 2, 16, 3);
  PARKED.push(['jet', bx + 25, bz - 60, -Math.PI / 2], ['jet', bx + 25, bz - 20, -Math.PI / 2], ['plane', bx + 25, bz + 40, -Math.PI / 2], ['heli', LOC.helipads[0].x, LOC.helipads[0].z, -Math.PI / 2], ['heli', LOC.helipads[1].x, LOC.helipads[1].z, -Math.PI / 2, '#1d2b4a']);
  PICKUP_SPOTS.push(['armor', bx + 60, bz + 200], ['ammo', bx + 60, bz + 205]);
}

// ---------- KÜSTE ----------
const TREES = [];
function coastAt(th, e = 0.0) { const r = coastRadius(th, e); return V3(Math.cos(th) * r, 0, Math.sin(th) * r); }
function buildCoast() {
  const F0 = FR(0, 0, 0, 0);
  for (let bz = -1330; bz <= 1060; bz += 34) { // Strandleben an der Ostküste der Strandinsel
    const p = beachAt(bz + sr(-8, 8), 0.022), q = beachAt(p.z, 0.05), h = terrainHeight(p.x, p.z); if (h < 1.25 || h > 4) continue;
    const yaw = Math.atan2(p.x - q.x, p.z - q.z), F = FR(p.x, h, p.z, yaw), sc = spick(['#ff2d95', '#22e4ff', '#ffb03a', '#ffffff', '#9dff3a', '#ff6a3a']);
    PC(F, 0, -0.3, 0, 0.05, 2.9, '#eeeeee'); part(F, G.cone(10), 0, 2.2, 0, 3.6, 0.7, 3.6, sc); for (let k = 0; k < 5; k++) part(F, G.box(), 0, 2.24, 0, 3.4, 0.05, 0.15, k % 2 ? '#ffffff' : sc, { ry: k * Math.PI / 5 });
    for (const sx of [-1.2, 1.2]) { PB(F, sx, -0.1, 1.6, 0.75, 0.25, 1.9, '#ffffff'); part(F, G.box(), sx, 0.15, 0.85, 0.75, 0.06, 0.7, '#ffffff', { rx: -0.6 }); }
    PB(F, 0.2, -0.1, -1.4, 1.1, 0.03, 2, spick(['#ff5a8a', '#1fb5a8', '#ffd23a', '#4a90e2'])); if (srand() < 0.3) PB(F, -2.2, -0.2, 0, 0.55, 2.1, 0.1, spick(PAL.accent), { rx: 0.2 });
    if (srand() < 0.35) TREES.push({ t: 'palm', x: q.x + sr(-6, 6), z: q.z + sr(-6, 6), s: sr(1.0, 1.3) });
  }
  for (const tz of [-1100, -700, -300, 150, 820]) { const p = beachAt(tz, 0.03), h = terrainHeight(p.x, p.z), q = beachAt(tz, 0.05), F = FR(p.x, h, p.z, Math.atan2(q.x - p.x, q.z - p.z) + Math.PI), c = spick(['#ff6a8a', '#2ad0c0', '#ffd23a']);
    for (const [a, b] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) PB(F, a, -0.5, b, 0.22, 3.0, 0.22, '#eee');
    PB(F, 0, 2.4, 0, 3.4, 2.1, 3.4, c); PW(F, 0, 3.6, 1.72, 2.6, 0.9, 0, 0, '#3a5a7a'); PB(F, 0, 4.5, 0, 4.0, 0.3, 4.0, '#fff'); part(F, G.pyr(), 0, 4.8, 0, 3.6, 1, 3.6, '#ffffff');
    part(F, G.box(), 0, 0.4, 2.6, 1.2, 0.1, 3.4, '#dddddd', { rx: -0.7 }); PB(F, 1.9, 2.4, 0, 0.1, 1.6, 0.8, '#ff2020'); World.addOBB(p.x, p.z, 1.7, 1.7, 0, h + 4.8, h + 2.3); }
  // Strandbar
  { const p = beachAt(-60, 0.03), q = beachAt(-60, 0.06), h = terrainHeight(p.x, p.z), F = FR(p.x, h, p.z, Math.atan2(q.x - p.x, q.z - p.z) + Math.PI);
    PB(F, 0, -0.3, 0, 8, 0.4, 6, '#9a7a5a'); for (const [a, b] of [[-3.5, -2.5], [3.5, -2.5], [-3.5, 2.5], [3.5, 2.5]]) PC(F, a, 0, b, 0.15, 3, '#8a6a4a'); part(F, G.pyr(), 0, 3, 0, 10, 2.2, 8, '#d8b878');
    PB(F, 0, 0.1, 1.4, 6, 1.1, 0.8, '#8a6a4a'); for (let i = -2; i <= 2; i++) PC(F, i * 1.2, 0.1, 2.4, 0.25, 0.8, '#3a2a1a', { seg: 8 }); Signs.quad(F, 0, 2.3, 2.5, 4, 0.7, 0, Signs.cell('TIKI BAR', '#2a8a6a', '#ffe0a0')); PG(F, 0, 2.9, 0, 6, 0.05, 0.05, '#ffcf7a');
    World.addOBB(p.x, p.z, 4, 3, Math.atan2(q.x - p.x, q.z - p.z), h + 5); World.lampAnchors.push(V3(p.x, h + 2.5, p.z)); }
  LOC.beach = beachAt(80, 0.04); LOC.beach.y = terrainHeight(LOC.beach.x, LOC.beach.z);
  // Marina
  const mp = shoreEast(500, 745, 0.0), dir = V3(1, 0, 0), side = V3(-dir.z, 0, dir.x), myaw = Math.atan2(dir.x, dir.z); LOC.marina = mp.clone(); LOC.boats = [];
  for (let k = -2; k <= 2; k++) { const base = mp.clone().addScaledVector(side, k * 26).addScaledVector(dir, -6), L = 70, F = FR(base.x, 0, base.z, myaw);
    PB(F, 0, 1.15, L / 2, 4, 0.4, L, '#a8805a'); World.platforms.push({ cx: base.x + dir.x * L / 2, cz: base.z + dir.z * L / 2, hx: 2, hz: L / 2, c: Math.cos(myaw), s: Math.sin(myaw), top: 1.55 });
    for (let q = 0; q < L; q += 9) for (const sd of [-1.8, 1.8]) PC(F, sd, -3, q, 0.2, 4.6, '#6a4a2a'); for (let q = 6; q < L; q += 12) { PC(F, 1.6, 1.55, q, 0.12, 0.5, '#e8e8e8'); PC(F, -1.6, 1.55, q, 0.12, 0.5, '#e8e8e8'); }
    for (let q = 10; q < L; q += 20) { PB(F, -1.7, 1.55, q, 0.1, 3, 0.1, '#444'); PG(F, -1.7, 4.4, q, 0.25, 0.25, 0.25, '#ffd9a0'); World.lampAnchors.push(LP(F, -1.7, 4.3, q)); }
    LOC.boats.push(base.clone().addScaledVector(dir, 25).addScaledVector(side, 8), base.clone().addScaledVector(dir, 50).addScaledVector(side, -8)); }
  { const F = FR(mp.x - dir.x * 22, terrainHeight(mp.x - dir.x * 22, mp.z - dir.z * 22), mp.z - dir.z * 22, myaw); PB(F, 0, -1, 0, 18, 6, 10, '#f4f0e8'); PW(F, 0, 2.2, 5.03, 14, 2.2, 0, 0xfff0c8, '#7aa0c0'); part(F, G.pyr(), 0, 5, 0, 20, 2.4, 12, '#1f6fd0'); Signs.quad(F, 0, 4.3, 5.1, 8, 1, 0, Signs.cell('SOLARA MARINA', '#0a4a6a', '#fff', 2)); const p2 = LP(F, 0, 0, 0); World.addOBB(p2.x, p2.z, 9, 5, myaw, p2.y + 7); }
  PARKED.push(['speedboat', LOC.boats[0].x, LOC.boats[0].z, myaw], ['yacht', LOC.boats[3].x + dir.x * 10, LOC.boats[3].z + dir.z * 10, myaw], ['fishing', LOC.boats[5].x, LOC.boats[5].z, myaw],
    ['jetski', LOC.boats[6].x, LOC.boats[6].z, myaw], ['speedboat', LOC.boats[8].x, LOC.boats[8].z, myaw, '#0d3b66'], ['jetski', LOC.boats[9].x, LOC.boats[9].z, myaw, '#22e4ff']);
  // Hafen: Kaimauer, Kräne, Container, Frachter
  const pc = V3(PORT.x, 3, PORT.z + 40); let qz = pc.z; for (; qz < pc.z + 400; qz += 4) if (terrainHeight(pc.x, qz) < 0) break; LOC.quay = V3(pc.x, 3, qz - 12);
  PB(F0, pc.x, -6, qz - 2, 380, 9.05, 4, '#8a8a84'); for (let x = -180; x <= 180; x += 12) PC(F0, pc.x + x, 3.05, qz - 1.2, 0.35, 0.7, '#3a3a40');
  for (const dx of [-110, -40, 40, 110]) { const F = FR(pc.x + dx, 3, qz - 8, 0), yc = '#e8b02a';
    for (const [lx, lz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) { PB(F, lx, 0, lz, 1.2, 34, 1.2, yc); World.addOBB(pc.x + dx + lx, qz - 8 + lz, 0.7, 0.7, 0, 40); }
    for (const yy of [10, 20, 30]) { PB(F, 0, yy, -4, 13, 0.5, 0.5, yc); PB(F, 0, yy, 4, 13, 0.5, 0.5, yc); PB(F, -6, yy, 0, 0.5, 0.5, 9, yc); PB(F, 6, yy, 0, 0.5, 0.5, 9, yc); }
    PB(F, 0, 34, 15, 3, 3, 80, '#d23a2a'); PB(F, 0, 37, 0, 9, 6, 9, yc); PW(F, 0, 39, 4.53, 6, 2, 0, 0x9fd0ff); PB(F, 0, 31, 40, 2, 3, 2, '#333'); for (const sx of [-0.7, 0.7]) PB(F, sx, 18, 40, 0.06, 13, 0.06, '#222'); PG(F, 0, 40.2, 0, 0.4, 0.4, 0.4, '#ff2020'); }
  LOC.portYard = V3(PORT.x + 20, 3, PORT.z + 30); const yard = LOC.portYard;
  for (let i = -4; i <= 4; i++) for (let j = -2; j <= 2; j++) { if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue; const x = yard.x + i * 8, z = yard.z + j * 15; if (terrainHeight(x, z) < 1.5 || Roads.nearest(x, z, 14)) continue;
    const n = sri(1, 4); for (let s = 0; s < n; s++) container(F0, x, 3 + s * 2.6, z, 0, spick(['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#5d6d7e', '#ca6f1e'])); World.addOBB(x, z, 1.25, 6.1, 0, 3 + n * 2.6); BLD.push({ x, z, w: 2.5, d: 12, yaw: 0 }); }
  { const sx = pc.x, sz = qz + 30, F = FR(sx, 0, sz, Math.PI / 2); PB(F, 0, -6, 0, 24, 14, 150, '#1f3a5a'); part(F, G.frus(0.2, 0.5, 0.25), 0, -6, 81.5, 24, 14, 13, '#1f3a5a', { rx: 0 }); PB(F, 0, 7.6, 0, 24.2, 0.6, 162, '#a83228'); PB(F, 0, 8.2, 0, 23, 0.3, 160, '#5a5e64');
    PB(F, 0, 8, -62, 20, 15, 16, '#f4f4f0'); facade(F, 20, 16, 9, 4, 3.2, { only: [0], sp: 2.5, ww: 1.6, wh: 1.2 }); PB(F, 0, 23, -66, 6, 6, 4, '#c0392b'); PB(F, 0, 23, -62, 26, 0.5, 6, '#f4f4f0');
    for (let k = -4; k <= 4; k++) for (let l = 0; l < 3; l++) for (const zz of [-6, 0, 6]) container(F, zz * 1.3, 8.5 + l * 2.6, k * 13 + 6, Math.PI / 2, spick(['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7a7a7a']));
    World.addOBB(sx, sz, 81, 12.5, 0, 24, -10); World.addRoof(sx, sz, 81, 12.5, 0, 16.3); BLD.push({ x: sx, z: sz, w: 160, d: 26, yaw: 0 }); }
  // Leuchtturm mit drehendem Lichtkegel
  const lh = LOC.lighthouse, ly = terrainHeight(lh.x, lh.z), FL = FR(lh.x, ly, lh.z, 0);
  PC(FL, 0, -1, 0, 4, 1.6, '#bdb3a2', { seg: 12 }); for (let k = 0; k < 6; k++) part(FL, G.tcyl(14, 0.93), 0, 0.6 + k * 4, 0, 5.4 - k * 0.38, 4, 5.4 - k * 0.38, k % 2 ? '#c1121f' : '#ffffff');
  PC(FL, 0, 24.6, 0, 2.6, 0.4, '#333', { seg: 14 }); part(FL, G.cyl(12), 0, 25, 0, 3.6, 3, 3.6, '#3d5a73', { mat: 'win', emis: 0xfff0b0 }); part(FL, G.cone(12), 0, 28, 0, 4.4, 2.2, 4.4, '#c1121f'); railing(FL, -2.4, -2.4, 2.4, -2.4, 25, 1, '#222'); railing(FL, -2.4, 2.4, 2.4, 2.4, 25, 1, '#222');
  World.addOBB(lh.x, lh.z, 2.6, 2.6, 0, ly + 28); LOC.lighthouse.y = ly;
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 70, 16, 1, true).rotateZ(Math.PI / 2).translate(35, 0, 0), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(lh.x, ly + 26.5, lh.z); scene.add(beam); L1(beam); World.anim.push((dt) => { beam.rotation.y += dt * 0.8; beam.material.opacity = 0.16 * Env.night; beam.visible = Env.night > 0.2; });
  // Gipfel: Observatorium + Funkturm
  const s = LOC.summit, syy = terrainHeight(s.x, s.z); s.y = syy; const FS = FR(s.x + 25, syy, s.z, 0);
  PC(FS, 0, -2, 0, 9, 9, '#f0f0f0', { seg: 18 }); part(FS, G.hsph(14), 0, 7, 0, 18, 16, 18, '#dfe3e8'); PB(FS, 0, 9, 0, 1.6, 7, 18.2, '#3a3e44', { rz: 0 }); facade(FS, 18, 18, 0, 1, 4, { sp: 4, ww: 1.4, wh: 1.4, only: [0, Math.PI] });
  World.addOBB(s.x + 25, s.z, 9, 9, 0, syy + 15); BLD.push({ x: s.x + 25, z: s.z, w: 18, d: 18, yaw: 0 });
  const tx = s.x - 25, tz = s.z + 12; for (let k = 0; k < 8; k++) { const r0 = lerp(3, 0.6, k / 8), r1 = lerp(3, 0.6, (k + 1) / 8), y0 = syy + k * 6, y1 = y0 + 6; for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) seg(tx + a * r0, y0, tz + b * r0, tx + a * r1, y1, tz + b * r1, 0.25, 0.25, k % 2 ? '#d02020' : '#f0f0f0'); seg(tx + r0, y0, tz + r0, tx - r1, y1, tz + r1, 0.12, 0.12, '#bbb'); }
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); blink.position.set(tx, syy + 48.5, tz); scene.add(blink); World.anim.push(() => { blink.visible = Math.floor(GameTime * 1.5) % 2 === 0; }); World.addOBB(tx, tz, 3, 3, 0, syy + 48);
}
function container(F, x, y, z, ry, c) { const M = FRL(F, x, y, z, ry), dark = C3(c).clone().multiplyScalar(0.78); PB(M, 0, 0, 0, 2.45, 2.55, 12.2, c); if (Q().detail > 1) for (let k = -5.6; k <= 5.6; k += 0.8) { PB(M, 1.24, 0.1, k, 0.04, 2.35, 0.3, dark); PB(M, -1.24, 0.1, k, 0.04, 2.35, 0.3, dark); } PB(M, 0, 0.1, 6.11, 2.3, 2.35, 0.04, dark); PB(M, 0.4, 0.2, 6.15, 0.06, 2.1, 0.06, '#555'); PB(M, -0.4, 0.2, 6.15, 0.06, 2.1, 0.06, '#555'); }

// ---------- STRASSEN, MARKIERUNGEN, GEHWEGE ----------
const ROADC = { asph: C3('#d6d6d6'), asph2: C3('#cfcfcf'), white: C3('#eeeeea'), yellow: C3('#e8c23a'), curb: C3('#ece8e0'), walk: C3('#f2eee6'), walk2: C3('#d8d4cc') };
// Band entlang einer Straße (UV: quer = Versatz, längs = Strecke, beide in Metern / Kachelgröße)
function ribbon(mat, e, o0, o1, y, color, k0 = 0, k1 = null, dash = 0) {
  const P = e.pts, a = accFor(mat, P[P.length >> 1].x, P[P.length >> 1].z), inv = 1 / ((WM_DEF[mat] || {}).tile || 4); k1 = k1 === null ? P.length - 1 : k1;
  for (let k = k0; k < k1; k++) { if (dash && Math.floor(P[k].s / dash) % 2) continue; const p = P[k], q = P[k + 1];
    const A = [p.x - p.tz * o0, p.y + y, p.z + p.tx * o0, o0 * inv, p.s * inv], B = [q.x - q.tz * o0, q.y + y, q.z + q.tx * o0, o0 * inv, q.s * inv], Cc = [q.x - q.tz * o1, q.y + y, q.z + q.tx * o1, o1 * inv, q.s * inv], D = [p.x - p.tz * o1, p.y + y, p.z + p.tx * o1, o1 * inv, p.s * inv];
    a.quad(o1 > o0 ? [A, D, Cc, B] : [A, B, Cc, D], 0, 1, 0, color); }
}
function wall(mat, e, o, y0, y1, color, k0, k1, flip = false) { // senkrechte Kante (Bordstein, Leitplanke)
  const P = e.pts, a = accFor(mat, P[P.length >> 1].x, P[P.length >> 1].z), inv = 1 / ((WM_DEF[mat] || {}).tile || 4);
  for (let k = k0; k < k1; k++) { const p = P[k], q = P[k + 1]; const A = [p.x - p.tz * o, p.y + y0, p.z + p.tx * o, p.s * inv, y0 * inv], B = [q.x - q.tz * o, q.y + y0, q.z + q.tx * o, q.s * inv, y0 * inv], Cc = [q.x - q.tz * o, q.y + y1, q.z + q.tx * o, q.s * inv, y1 * inv], D = [p.x - p.tz * o, p.y + y1, p.z + p.tx * o, p.s * inv, y1 * inv];
    const sg = Math.sign(o) * (flip ? -1 : 1); a.quad(sg > 0 ? [A, B, Cc, D] : [A, D, Cc, B], -p.tz * sg, 0, p.tx * sg, color); }
}
function buildRoadMeshes() {
  for (const e of Roads.edges) {
    const A = Roads.nodes[e.a], B = Roads.nodes[e.b], P = e.pts, n = P.length, hw = e.hw;
    const kA = Math.min(n - 1, Math.ceil((A.r + 1) / 4)), kB = Math.max(0, n - 1 - Math.ceil((B.r + 1) / 4));
    ribbon('road', e, -hw, hw, 0.06, new THREE.Color(ROADC.asph.r, hw / 16, e.type === 'highway' ? 0.5 : e.type === 'service' ? 0.75 : e.dirt ? 0.9 : 0.25));
    const zone = zoneAt(P[n >> 1].x, P[n >> 1].z), urban = !['rural', 'mountain', 'swamp'].includes(zone) && !e.bridge && !e.dirt;
    if (e.bridge) for (const sd of [1, -1]) { const o = (hw + 0.35) * sd; wall('concrete', e, o, -0.2, 1.0, ROADC.curb, 0, n - 1); wall('concrete', e, o + 0.4 * sd, -0.2, 1.0, ROADC.curb, 0, n - 1, true); ribbon('concrete', e, Math.min(o, o + 0.4 * sd), Math.max(o, o + 0.4 * sd), 1.0, ROADC.curb); wall('concrete', e, (hw + 0.75) * sd, -3.5, -0.2, ROADC.walk2, 0, n - 1); }
    else if (e.type === 'street' && urban && kB > kA) { // Gehwege mit Bordstein
      for (const sd of [1, -1]) { const o0 = (hw) * sd, o1 = (hw + 3.2) * sd; ribbon('walk', e, Math.min(o0, o1), Math.max(o0, o1), 0.2, ROADC.walk, kA, kB); ribbon('concrete', e, Math.min(o0, o0 + 0.3 * sd), Math.max(o0, o0 + 0.3 * sd), 0.205, ROADC.curb, kA, kB); wall('concrete', e, o0, 0.0, 0.2, ROADC.curb, kA, kB); wall('concrete', e, o1, -0.8, 0.2, ROADC.walk2, kA, kB); } }
    else if (e.type === 'highway' && zone !== 'strip' && kB > kA) for (const sd of [1, -1]) { wall('metal', e, (hw + 1.22) * sd, 0.45, 0.75, C3('#c4c8cc'), kA, kB); wall('metal', e, (hw + 1.18) * sd, 0.45, 0.75, C3('#c4c8cc'), kA, kB, true); for (let k = kA; k < kB; k += 1) { const p = P[k]; PB(null, p.x - p.tz * (hw + 1.25) * sd, p.y, p.z + p.tx * (hw + 1.25) * sd, 0.12, 0.7, 0.12, '#8a8e92', { mat: 'metal' }); } }
    // Zebrastreifen & Haltelinien an großen Kreuzungen
    if (e.type === 'street') for (const [node, end] of [[A, 0], [B, 1]]) { if (node.edges.length < 3) continue;
      const k = end === 0 ? Math.min(n - 1, Math.ceil((node.r + 2) / 4)) : Math.max(0, n - 1 - Math.ceil((node.r + 2) / 4)), p = P[k], F = FR(p.x, p.y + 0.08, p.z, Math.atan2(p.tx, p.tz));
      for (let s = -hw + 0.9; s <= hw - 0.9; s += 1.2) PB(F, s, 0, 0, 0.6, 0.02, 2.8, '#ececec', { mat: 'mark', keep: true }); PB(F, (end === 0 ? -1 : 1) * hw / 2, 0, (end === 0 ? 2.2 : -2.2), hw - 0.6, 0.02, 0.4, '#ececec', { mat: 'mark' }); }
  }
  for (const nd of Roads.nodes) { const two = nd.edges.length <= 2, R = two ? Math.max(...nd.edges.map(i => Roads.edges[i].hw)) + 0.2 : nd.r - 0.6; part(null, G.cyl(24), nd.x, nd.y - 0.5, nd.z, R * 2, two ? 0.535 : 0.565, R * 2, ROADC.asph2, { mat: 'road', keep: true }); }
}

// ---------- STRASSENMÖBEL ----------
function lampPost(x, y, z, yaw, c = '#2a2c30') { const F = FR(x, y, z, yaw); PC(F, 0, 0, 0, 0.13, 7.4, c, { seg: 6 }); PB(F, 0, 7.2, 0.9, 0.12, 0.12, 2, c); PB(F, 0, 7.05, 1.9, 0.5, 0.2, 0.9, c); PG(F, 0, 6.98, 1.9, 0.4, 0.06, 0.75, '#fff0c8'); PC(F, 0, 0, 0, 0.22, 0.5, c, { seg: 6 });
  World.lampAnchors.push(LP(F, 0, 6.6, 1.9)); World.addOBB(x, z, 0.2, 0.2, 0, y + 7.4, y - 1, 'prop'); }
// ---------- AMPELN (echte Schaltung: Grün → Gelb → Rot, gegenüberliegende Zufahrten gemeinsam) ----------
const Signals = {
  lamps: [], nodes: new Map(), mesh: null, t: 0, upT: 0,
  addLamp(p, nodeId, edgeId, kind) { this.lamps.push({ p, nodeId, edgeId, kind }); },
  // Zufahrten einer Kreuzung in zwei Gruppen teilen (Achse A und quer dazu)
  group(nodeId, edgeId) { let n = this.nodes.get(nodeId); if (!n) { const nd = Roads.nodes[nodeId], dirs = nd.edges.map(ei => { const e = Roads.edges[ei], P = e.pts, q = e.a === nodeId ? P[Math.min(3, P.length - 1)] : P[Math.max(0, P.length - 4)]; return [ei, Math.atan2(q.x - nd.x, q.z - nd.z)]; });
      const a0 = dirs[0][1], g = new Map(dirs.map(([ei, a]) => [ei, Math.abs(Math.cos(a - a0)) > 0.7 ? 0 : 1])); n = { g, off: hash2(nodeId, 7) * 28 }; this.nodes.set(nodeId, n); } return n.g.get(edgeId) ?? 0; },
  // Zustand für eine Zufahrt: 'g' grün, 'y' gelb, 'r' rot (Zyklus 28 s)
  state(nodeId, edgeId) { const n = this.nodes.get(nodeId); if (!n) return 'g'; const grp = n.g.get(edgeId) ?? 0, c = (this.t + n.off) % 28, t = grp === 0 ? c : (c + 14) % 28; return t < 10 ? 'g' : t < 12.5 ? 'y' : 'r'; },
  has(nodeId) { return this.nodes.has(nodeId); },
  build() { if (!this.lamps.length) return; for (const L of this.lamps) this.group(L.nodeId, L.edgeId);
    const g = new THREE.OctahedronGeometry(0.15, 0), m = new THREE.MeshBasicMaterial({ toneMapped: false }); this.mesh = new THREE.InstancedMesh(g, m, this.lamps.length);
    this.lamps.forEach((L, i) => { tmpM.makeTranslation(L.p.x, L.p.y, L.p.z); this.mesh.setMatrixAt(i, tmpM); this.mesh.setColorAt(i, C3('#111')); }); this.mesh.computeBoundingSphere(); scene.add(this.mesh); this.paint(); },
  paint() { const on = [C3('#30ff70'), C3('#ffb020'), C3('#ff2a20'), C3('#f4f4f4')], off = [C3('#0c2a14'), C3('#2a1e06'), C3('#2a0806'), C3('#3a1206')];
    this.lamps.forEach((L, i) => { const st = this.state(L.nodeId, L.edgeId), lit = L.kind === 0 ? st === 'g' : L.kind === 1 ? st === 'y' : L.kind === 2 ? st === 'r' : null;
      this.mesh.setColorAt(i, L.kind === 3 ? (st === 'r' ? on[3] : off[3]) : lit ? on[L.kind] : off[L.kind]); }); this.mesh.instanceColor.needsUpdate = true; },
  update(dt) { this.t += dt; this.upT -= dt; if (this.upT <= 0 && this.mesh) { this.upT = 0.25; this.paint(); } },
};
function trafficLight(x, y, z, yaw, arm, nodeId, edgeId) { const F = FR(x, y, z, yaw); PC(F, 0, 0, 0, 0.15, 6.2, '#3a3c40', { seg: 6, mat: 'metal', keep: true }); PB(F, -arm / 2, 6, 0, arm, 0.18, 0.18, '#3a3c40', { mat: 'metal', keep: true });
  for (const ax of [-arm + 1.2, -arm * 0.5]) { PB(F, ax, 4.9, 0, 0.45, 1.3, 0.35, '#1e2024', { keep: true }); for (let i = 0; i < 3; i++) Signals.addLamp(LP(F, ax, 5.15 + i * 0.4, 0.2), nodeId, edgeId, 2 - i); }
  PB(F, 0.1, 2.5, 0.12, 0.3, 0.5, 0.2, '#1e2024'); Signals.addLamp(LP(F, 0.1, 2.75, 0.24), nodeId, edgeId, 3); World.addOBB(x, z, 0.2, 0.2, 0, y + 6, y - 1, 'prop'); }
function bench(F, x, z, ry) { const M = FRL(F, x, 0.2, z, ry); PB(M, 0, 0.42, 0, 1.8, 0.08, 0.5, '#8a5a3a'); PB(M, 0, 0.62, -0.22, 1.8, 0.4, 0.06, '#8a5a3a'); for (const sx of [-0.75, 0.75]) PB(M, sx, 0, 0, 0.08, 0.45, 0.45, '#2a2a2e'); }
function busStop(F, x, z, ry) { const M = FRL(F, x, 0.2, z, ry); PB(M, 0, 2.5, 0, 4, 0.15, 1.8, '#d8dce0'); for (const sx of [-1.9, 1.9]) PB(M, sx, 0, -0.8, 0.1, 2.5, 0.1, '#7a7e84'); PW(M, 0, 1.3, -0.85, 3.8, 2.2, 0, 0x203040, '#9fc0d8'); PB(M, 0, 0.45, -0.6, 3.2, 0.08, 0.45, '#5a5e64');
  PB(M, 2.4, 0, 0.6, 0.08, 2.8, 0.08, '#7a7e84'); PB(M, 2.4, 2.4, 0.6, 0.6, 0.6, 0.06, '#1f4fa0'); PG(M, 0, 2.42, 0.2, 3.6, 0.04, 0.2, '#eaf2ff'); Signs.quad(M, 0, 2.66, 0.91, 3.4, 0.5, 0, Signs.cell(spick(ADS)[0], '#111', '#ffd23a', 2)); }
function hydrant(F, x, z) { const M = FRL(F, x, 0.2, z, 0); PC(M, 0, 0, 0, 0.16, 0.6, '#d82020'); PS(M, 0, 0.62, 0, 0.17, '#d82020'); PC(M, 0, 0.35, 0, 0.07, 0.1, '#d82020', { rx: Math.PI / 2 }); }
function bin(F, x, z) { const M = FRL(F, x, 0.2, z, 0); PC(M, 0, 0, 0, 0.3, 0.9, '#2a5a3a', { seg: 8 }); PC(M, 0, 0.9, 0, 0.33, 0.08, '#1a3a2a', { seg: 8 }); }
function newsBox(F, x, z, ry) { const M = FRL(F, x, 0.2, z, ry); PB(M, 0, 0, 0, 0.5, 1.0, 0.45, spick(['#1f4fa0', '#c0392b', '#ffd23a'])); }
function streetSign(x, y, z, yaw, name) { const F = FR(x, y, z, yaw); PB(F, 0, 0, 0, 0.08, 3.2, 0.08, '#6a6e74'); Signs.quad(F, 0, 2.9, 0, 1.8, 0.35, Math.PI / 2, Signs.cell(name, '#1a6a3a', '#fff')); Signs.quad(F, 0, 2.9, 0, 1.8, 0.35, -Math.PI / 2, Signs.cell(name, '#1a6a3a', '#fff')); }
function buildStreetFurniture() {
  let ni = 0;
  for (const e of Roads.edges) {
    const A = Roads.nodes[e.a], B = Roads.nodes[e.b], P = e.pts, n = P.length, zone = zoneAt(P[n >> 1].x, P[n >> 1].z), urban = ['downtown', 'strip', 'suburb', 'heights', 'village', 'port', 'uptown', 'midtown', 'oldtown', 'industrial', 'keys', 'urban'].includes(zone) || !!e.bridge;
    const name = STREETS[e.id % STREETS.length];
    // Laternen
    const lampSp = urban ? 30 : 45; for (let s = A.r + 6, k = 0; s < e.len - B.r - 6; s += lampSp, k++) { const i = Math.round(s / e.len * (n - 1)), p = P[i], sd = k % 2 ? 1 : -1, off = e.hw + (e.type === 'highway' ? 2.1 : 0.9);
      if (zone === 'mountain' && k % 2) continue; if (e.type === 'service') continue; lampPost(p.x - p.tz * off * sd, p.y + (e.type === 'street' && urban ? 0.2 : 0), p.z + p.tx * off * sd, Math.atan2(p.tz * sd, -p.tx * sd)); }
    if (e.type !== 'street') { // Werbetafeln am Highway
      if (e.type === 'highway' && zone !== 'strip' && srand() < 0.35) { const i = n >> 1, p = P[i], sd = srand() < 0.5 ? 1 : -1, off = e.hw + 9, x = p.x - p.tz * off * sd, z = p.z + p.tx * off * sd, h = terrainHeight(x, z), F = FR(x, h, z, Math.atan2(p.tz * sd, -p.tx * sd));
        for (const sx of [-3, 3]) PB(F, sx, -1, 0, 0.35, 8, 0.35, '#5a5e64'); PB(F, 0, 6.5, -0.15, 13, 4.4, 0.3, '#2a2c30'); const ad = spick(ADS); Signs.quad(F, 0, 6.7, 0.05, 12.4, 4, 0, Signs.cell(ad[0], ad[1], ad[2], 2, 1)); PG(F, 0, 11, 0.6, 12, 0.12, 0.12, '#fff0c8'); World.addOBB(x, z, 6.5, 0.4, Math.atan2(p.tz * sd, -p.tx * sd), h + 11); }
      continue; }
    if (!urban) { // Strommasten auf dem Land
      let prev = null; for (let s = A.r + 8; s < e.len - B.r - 8; s += 38) { const i = Math.round(s / e.len * (n - 1)), p = P[i], off = e.hw + 3.5, x = p.x - p.tz * off, z = p.z + p.tx * off, h = terrainHeight(x, z), F = FR(x, h, z, Math.atan2(p.tx, p.tz));
        PC(F, 0, -0.5, 0, 0.16, 9.2, '#6a4a2a', { seg: 6 }); PB(F, 0, 8.2, 0, 2.6, 0.15, 0.15, '#6a4a2a'); for (const sx of [-1.1, 0, 1.1]) PC(F, sx, 8.35, 0, 0.06, 0.25, '#c8d0d8', { seg: 5 });
        if (prev) for (const sx of [-1.1, 0, 1.1]) { const a = LP(prev, sx, 8.5, 0), b = LP(F, sx, 8.5, 0); seg(a.x, a.y, a.z, b.x, b.y, b.z, 0.035, 0.035, '#1a1a1a'); } prev = F; World.addOBB(x, z, 0.2, 0.2, 0, h + 9, h - 1, 'prop'); }
      continue; }
    // Bänke, Mülleimer, Hydranten, Bushaltestellen, Zeitungsboxen
    for (let s = A.r + 12; s < e.len - B.r - 12; s += sr(14, 26)) { const i = Math.round(s / e.len * (n - 1)), p = P[i], sd = srand() < 0.5 ? 1 : -1, off = e.hw + 2.2, F = FR(p.x - p.tz * off * sd, p.y, p.z + p.tx * off * sd, Math.atan2(-p.tz * sd, p.tx * sd)); const r = srand();
      if (r < 0.2) bench(F, 0, 0.4, 0); else if (r < 0.45) bin(F, 0, 0); else if (r < 0.6) hydrant(F, 0, 0); else if (r < 0.68 && zone !== 'suburb') newsBox(F, 0, 0, 0);
      else if (r < 0.78 && ['downtown', 'strip', 'uptown', 'urban', 'midtown'].includes(zone)) { const q = LP(F, 0, 0, 0); TREES.push({ t: 'palm', x: q.x, z: q.z, s: 0.9 }); PB(F, 0, 0.2, 0, 1.6, 0.4, 1.6, '#b8b4aa'); } }
    if ((zone === 'downtown' || zone === 'strip' || zone === 'village') && e.len > 70) { const i = n >> 1, p = P[i], sd = e.id % 2 ? 1 : -1, off = e.hw + 2.4; busStop(FR(p.x - p.tz * off * sd, p.y, p.z + p.tx * off * sd, Math.atan2(-p.tz * sd, p.tx * sd)), 0, 0, 0); }
    // Ampeln & Straßenschilder an Kreuzungen
    for (const [node, end] of [[A, 0], [B, 1]]) { if (node.edges.length < 3) continue; const k = end === 0 ? Math.min(n - 1, Math.ceil((node.r + 3.5) / 4)) : Math.max(0, n - 1 - Math.ceil((node.r + 3.5) / 4)), p = P[k], dir = end === 0 ? -1 : 1;
      const tx = p.tx * -dir, tz = p.tz * -dir, sx = p.x - tz * (e.hw + 1.2), sz = p.z + tx * (e.hw + 1.2);
      if (urban && zone !== 'suburb' && zone !== 'heights') trafficLight(sx, p.y + 0.2, sz, Math.atan2(-tz, tx), e.hw, node.id, e.id); else if (end === 0) streetSign(sx, p.y + 0.2, sz, Math.atan2(tx, tz), name); }
  }
}

// ---------- VEGETATION (echte Modelle, instanziert in Kacheln, Wind-Animation) ----------
const _glbM = {};
// GLB-Modell → eine Geometrie mit Vertex-Farben (aus den Materialfarben), optional skaliert
function glbMerged(name, scale = 1) {
  const key = name + '@' + scale; if (_glbM[key] !== undefined) return _glbM[key]; const g = Assets.models[name]; if (!g) return (_glbM[key] = null);
  g.scene.updateMatrixWorld(true); const list = [];
  g.scene.traverse(o => { if (!o.isMesh) return; let geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const c = (o.material && o.material.color) || new THREE.Color(1, 1, 1), n = geo.attributes.position.count, ca = new Float32Array(n * 3); for (let i = 0; i < n; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(ca, 3)); list.push(geo); });
  const m = list.length ? ADD.merge(list) : null; if (m && scale !== 1) m.scale(scale, scale, scale); return (_glbM[key] = m);
}
function lodGeo(kind) { const L = [];
  if (kind === 'palm') { L.push([new THREE.CylinderGeometry(0.22, 0.3, 4.4 * 2.4, 4, 1, true).translate(0.4, 5.3, 0), '#7a6448']); for (let k = 0; k < 6; k++) { const g = new THREE.PlaneGeometry(1.2, 4.2).rotateX(-1.1).translate(0, 0.4, 2.0).rotateY(k * 1.05).translate(0.8, 10.2, 0); L.push([g, '#3f7a34']); } }
  else if (kind === 'tree') { L.push([new THREE.CylinderGeometry(0.25, 0.35, 3.5, 4, 1, true).translate(0, 1.75, 0), '#6a5038'], [new THREE.IcosahedronGeometry(2.8, 0).translate(0, 5.5, 0), '#4f7a36']); }
  else if (kind === 'pine') { L.push([new THREE.ConeGeometry(2.6, 8.5, 6).translate(0, 5.5, 0), '#2f5a32'], [new THREE.CylinderGeometry(0.2, 0.3, 2, 4, 1, true).translate(0, 1, 0), '#5a4030']); }
  else if (kind === 'bush') L.push([new THREE.IcosahedronGeometry(0.9, 0).scale(1, 0.75, 1).translate(0, 0.6, 0), '#3f6a32']);
  else if (kind === 'rock') L.push([new THREE.DodecahedronGeometry(1.2, 0).scale(1, 0.6, 1), '#8a8478']);
  else return null;
  const gs = L.map(([g, c]) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = C3(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
  return ADD.merge(gs); }
const VEG = { palm: [['nature/palmtree-1', 2.4], ['nature/palmtree-3', 2.5], ['nature/palmtree-4', 2.6], ['nature/palmtree-2', 2.2]], tree: [['nature/commontree-1', 3.0], ['nature/commontree-2', 2.8], ['nature/commontree-3', 2.9]],
  pine: [['nature/pinetree-1', 3.6], ['nature/pinetree-2', 3.4]], bush: [['nature/bush-1', 1.3], ['nature/bush-2', 1.3], ['nature/bushberries-1', 1.2]], rock: [['nature/rock-1', 3], ['nature/rock-2', 3.5], ['nature/rock-3', 3.2], ['nature/rock-moss-1', 3]],
  flower: [['nature/flowers', 1.4], ['nature/plant-1', 1.3]] };
function buildVegetation() {
  const dens = Q().trees;
  const NOVEG = new Set(['base', 'downtown', 'port', 'uptown', 'industrial', 'midtown', 'oldtown']);
  for (let k = 0; k < 24000 * dens; k++) {
    const x = sr(-1950, 1950), z = sr(-1950, 1950), h = terrainHeight(x, z); if (h < (Math.hypot(x - SWAMP.x, z - SWAMP.z) < SWAMP.r ? 0.35 : 1.5)) continue; const zone = zoneAt(x, z); if (NOVEG.has(zone) || fieldAt(x, z) || inPark(x, z)) continue;
    const r = Roads.nearest(x, z, 24); if (r && r.d < r.e.hw + 5) continue; if (World.query(x - 3, z - 3, x + 3, z + 3, _qb).length) continue;
    const e = islandE(x, z), fo = fbm(x / 160 + 30, z / 160 - 10, 3); let t;
    if (zone === 'swamp') t = srand() < 0.55 ? 'tree' : srand() < 0.8 ? 'bush' : 'palm';
    else if (h > 40) t = srand() < 0.75 ? 'pine' : 'rock'; else if (e < 0.12 || zone === 'strip') t = srand() < 0.85 ? 'palm' : 'bush'; else if (zone === 'suburb' || zone === 'heights' || zone === 'village') t = srand() < 0.4 ? 'palm' : srand() < 0.55 ? 'tree' : srand() < 0.7 ? 'bush' : 'flower';
    else t = fo > 0.1 ? (srand() < 0.7 ? 'tree' : 'pine') : srand() < 0.3 ? 'tree' : srand() < 0.35 ? 'palm' : srand() < 0.75 ? 'bush' : srand() < 0.85 ? 'rock' : null;
    if (!t || (t !== 'rock' && h > 40 && srand() < 0.25)) continue; if (fo < -0.05 && zone === 'rural' && srand() < 0.55) continue;
    TREES.push({ t, x, z, s: sr(0.8, 1.25) });
  }
  for (let k = 0; k < 34000 * dens; k++) { // dichte Wälder in Waldflächen
    const x = sr(-1950, 1950), z = sr(-1950, 1950), fo = fbm(x / 160 + 30, z / 160 - 10, 3), h = terrainHeight(x, z), sw = Math.hypot(x - SWAMP.x, z - SWAMP.z) < SWAMP.r * 0.95, mt = h > 45;
    if (fo < (sw ? -0.2 : mt ? -0.08 : 0.1)) continue; if (h < (sw ? 0.3 : 2) || h > 175) continue;
    const zone = zoneAt(x, z); if (zone !== 'rural' && zone !== 'mountain' && zone !== 'swamp') continue; if (fieldAt(x, z)) continue; const r = Roads.nearest(x, z, 20); if (r && r.d < r.e.hw + 6) continue; if (World.query(x - 4, z - 4, x + 4, z + 4, _qb).length) continue;
    TREES.push({ t: sw ? (srand() < 0.6 ? 'tree' : 'bush') : mt ? (srand() < 0.85 ? 'pine' : 'rock') : srand() < 0.3 ? 'pine' : srand() < 0.12 ? 'bush' : 'tree', x, z, s: sw ? sr(0.6, 1.0) : sr(0.85, 1.35) }); }
  World.palmU = { uTime: { value: 0 }, uWind: { value: 0.6 } };
  const pbr = Q().detail > 0, mats = {};
  const matFor = (sway) => { const k = sway ? 'sway' + sway : 'still'; if (mats[k]) return mats[k];
    const mat = new (pbr ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial)({ vertexColors: true, ...(pbr ? { roughness: 0.85, metalness: 0 } : {}) });
    if (sway) mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = World.palmU.uTime; sh.uniforms.uWind = World.palmU.uWind; sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.11;
      #else
      float ph = 0.0;
      #endif
      float wv = max(position.y - ${sway.toFixed(1)}, 0.0) * 0.035 * uWind; transformed.x += sin(uTime * 1.6 + ph) * wv; transformed.z += cos(uTime * 1.2 + ph) * wv * 0.7;`); };
    return (mats[k] = mat); };
  // Nah: volle Modelle in kleinen Kacheln · Fern: einfache Ersatzmodelle in großen Kacheln (nahe Instanzen werden dort ausgeblendet)
  const place = (kind, list, cast, sway) => { const vars = VEG[kind].map(([n, sc]) => glbMerged(n, sc)).filter(Boolean); if (!vars.length || !list.length) return;
    const S = VegLOD.S, B = VegLOD.B, lg = lodGeo(kind), byBig = new Map();
    list.forEach((p, i) => { p.v = (i * 7 + Math.floor(Math.abs(p.x))) % vars.length; p.r = p.r ?? i * 2.39; p.cs = Math.floor((p.x + WS) / S) * 1000 + Math.floor((p.z + WS) / S); const kb = Math.floor((p.x + WS) / B) * 1000 + Math.floor((p.z + WS) / B); let a = byBig.get(kb); if (!a) byBig.set(kb, a = []); a.push(p); });
    const mtx = (p) => tmpM.compose(tmpV1.set(p.x, terrainHeight(p.x, p.z) - 0.1, p.z), tmpQ.setFromEuler(tmpE.set(0, p.r, 0)), tmpV2.set(p.s, p.s * (p.sy || 1), p.s));
    for (const [, arr] of byBig) { arr.sort((a, b) => a.cs - b.cs);
      const far = lg ? new THREE.InstancedMesh(lg, matFor(0), arr.length) : null; if (far) { arr.forEach((p, j) => far.setMatrixAt(j, mtx(p))); far.computeBoundingSphere(); far.castShadow = false; far.receiveShadow = true; scene.add(far); }
      let j0 = 0; while (j0 < arr.length) { let j1 = j0; while (j1 < arr.length && arr[j1].cs === arr[j0].cs) j1++; const grp = arr.slice(j0, j1), cell = VegLOD.cell(grp[0].cs);
        for (let v = 0; v < vars.length; v++) { const g2 = grp.filter(p => p.v === v); if (!g2.length) continue; const im = new THREE.InstancedMesh(vars[v], matFor(sway), g2.length); g2.forEach((p, j) => im.setMatrixAt(j, mtx(p)));
          im.computeBoundingSphere(); im.userData.cast = cast; im.castShadow = false; im.receiveShadow = true; im.visible = false; scene.add(im); cell.near.push(im); }
        if (far) cell.far.push({ mesh: far, start: j0, count: j1 - j0, orig: far.instanceMatrix.array.slice(j0 * 16, j1 * 16) }); j0 = j1; } } };
  for (const p of TREES) { if (p.t === 'rock' || p.t === 'bush' || p.t === 'flower') continue; World.addOBB(p.x, p.z, 0.32, 0.32, 0, terrainHeight(p.x, p.z) + 6, -50, 'prop'); }
  const by = (t) => TREES.filter(p => p.t === t);
  place('palm', by('palm'), true, 2.0); place('tree', by('tree'), true, 1.2); place('pine', by('pine'), true, 1.0); place('bush', by('bush'), false, 0); place('flower', by('flower'), false, 0);
  const rocks = by('rock'); rocks.forEach(p => { p.s = sr(0.8, 2.2); }); place('rock', rocks, true, 0);
}

// ---------- GELÄNDE-MESH (Felder, Wald, Strand, Fels) ----------
const FIELDS = [];
function fieldAt(x, z) { for (const f of FIELDS) { const dx = x - f.x, dz = z - f.z, lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c; if (Math.abs(lx) < f.hx && Math.abs(lz) < f.hz) return { f, lx }; } return null; }
// Gelände-Material: überblendet echte Texturen (Gras, Sand, Fels, Pflaster, Waldboden) über Gewichte pro Vertex
function terrainMaterial() {
  const T = Assets.tex, pbr = Q().detail > 0, m = new (pbr ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial)({ vertexColors: true, ...(pbr ? { roughness: 0.95, metalness: 0 } : {}) });
  const tx = (k) => (T[k] && T[k].c) || null;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tGrass: { value: tx('grass') }, tSand: { value: tx('sand') }, tRock: { value: tx('rock') }, tPave: { value: tx('concrete') }, tForest: { value: tx('forest') } });
    sh.vertexShader = 'attribute vec4 splat; attribute float splat2; varying vec4 vSplat; varying float vSplat2; varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vSplat2 = splat2; vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform sampler2D tGrass; uniform sampler2D tSand; uniform sampler2D tRock; uniform sampler2D tPave; uniform sampler2D tForest; varying vec4 vSplat; varying float vSplat2; varying vec3 vWP;\n' +
      sh.fragmentShader.replace('#include <map_fragment>', `
        vec2 wp = vWP.xz;
        vec3 cg = texture2D(tGrass, wp / 5.0).rgb * vec3(0.84, 0.9, 0.7), cs = texture2D(tSand, wp / 4.5).rgb, cr = texture2D(tRock, vec2(wp.x + vWP.y * 0.7, wp.y - vWP.y * 0.5) / 9.0).rgb, cp = texture2D(tPave, wp / 4.0).rgb * vec3(0.58, 0.57, 0.55), cf = texture2D(tForest, wp / 5.5).rgb;
        float macro = texture2D(tGrass, wp / 73.0).g * 1.6 + 0.2;
        vec3 tc = (cg * vSplat.x + cs * vSplat.y + cr * vSplat.z + cp * vSplat.w + cf * vSplat2) / max(0.001, vSplat.x + vSplat.y + vSplat.z + vSplat.w + vSplat2);
        diffuseColor.rgb *= tc * mix(1.0, macro, 0.35 * (vSplat.x + vSplat2));`);
  };
  return m;
}
function buildTerrain() {
  const cells = [80, 64, 48, 40, 32].find(c => (GN - 1) % c === 0), NC = (GN - 1) / cells, mat = terrainMaterial(); World.terrainChunks = [];
  // Gewichte & Tönung für jeden Gitterpunkt einmal berechnen
  const W = new Float32Array(GN * GN * 5), Ct = new Float32Array(GN * GN * 3), Nrm = new Float32Array(GN * GN * 3), c = new THREE.Color(), dry = C3('#e8dc9c'), fc = [['#e8d07a', '#d4b860'], ['#b8d080', '#98b860'], ['#c89870', '#a87850'], ['#c8e070', '#e8e090'], ['#a8e070', '#90d060'], ['#f0e0b0', '#e8d8a8']].map(p => p.map(C3));
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const k = j * GN + i, x = -WS + i * CELL, z = -WS + j * CELL, y = HGT[k];
    const hx = (HGT[j * GN + Math.min(GN - 1, i + 1)] - HGT[j * GN + Math.max(0, i - 1)]) / (2 * CELL), hz = (HGT[Math.min(GN - 1, j + 1) * GN + i] - HGT[Math.max(0, j - 1) * GN + i]) / (2 * CELL), nl = Math.hypot(hx, 1, hz);
    const ny = 1 / nl; Nrm[k * 3] = -hx / nl; Nrm[k * 3 + 1] = ny; Nrm[k * 3 + 2] = -hz / nl;
    const e = islandE(x, z), zn = zoneAt(x, z), fo = fbm(x / 160 + 30, z / 160 - 10, 3), nz = hash2(Math.floor(x / 9), Math.floor(z / 9));
    let g = 1, sa = 0, ro = 0, pv = 0, fr = 0;
    if (y < 2.6 && e < 0.1) { sa = clamp((2.6 - y) / 1.2, 0, 1) + (y < 0.4 ? 1 : 0); }
    if (zn === 'downtown' || zn === 'port' || zn === 'base' || zn === 'industrial' || zn === 'uptown') pv = 1.2; else if (zn === 'midtown' || zn === 'oldtown') pv = 0.9; else if (zn === 'urban') pv = 0.45 + fbm(x / 90, z / 90, 2) * 0.5;
    const park = pv > 0 && PARKS.length && inPark(x, z); if (park) pv = 0;
    const fld = FIELDS.length ? fieldAt(x, z) : null; if (fld && fld.f.type === 5) sa = 1.2;
    if (fo > 0.12 && pv === 0) fr = clamp((fo - 0.12) * 5, 0, 1.2);
    ro = clamp((0.86 - ny) * 6, 0, 3) + (y > 110 ? clamp((y - 110) / 40, 0, 1) : 0);
    W[k * 5] = g * (1 - Math.min(1, sa + pv)); W[k * 5 + 1] = sa; W[k * 5 + 2] = ro; W[k * 5 + 3] = pv; W[k * 5 + 4] = fr * (1 - Math.min(1, sa));
    c.setRGB(1, 1, 1); { const m = fbm(x / 420 + 7, z / 420 - 3, 2); if (m < 0) c.lerp(dry, clamp(-m * 1.6, 0, 0.55)); else c.multiplyScalar(1 - m * 0.18); } if (fo < -0.2) c.lerp(dry, 0.35); if (y < 0) c.multiplyScalar(clamp(1 + y / 30, 0.45, 1));
    if (fld) { const pal = fc[fld.f.type]; c.copy(Math.sin(fld.lx * (fld.f.type === 4 ? 0.35 : 1.4)) > 0 ? pal[0] : pal[1]); } else if (park) c.setRGB(0.86, 1.0, 0.78);
    if (zn === 'swamp') c.multiply(C3('#a8b088')); else if (zn === 'mountain' || y > 60) c.multiply(C3('#d8dcc0'));
    c.multiplyScalar(0.92 + nz * 0.14); Ct[k * 3] = c.r; Ct[k * 3 + 1] = c.g; Ct[k * 3 + 2] = c.b; }
  const mkChunk = (ci, cj, step) => { const cn = cells / step, n1 = cn + 1, nv = n1 * n1 + 4 * n1, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), sp = new Float32Array(nv * 4), sp2 = new Float32Array(nv), idx = [];
    const put = (v, gi, gj, dy) => { const k = gj * GN + gi; pos[v * 3] = -WS + gi * CELL; pos[v * 3 + 1] = HGT[k] - dy; pos[v * 3 + 2] = -WS + gj * CELL; for (let q = 0; q < 3; q++) { nor[v * 3 + q] = Nrm[k * 3 + q]; col[v * 3 + q] = Ct[k * 3 + q]; } for (let q = 0; q < 4; q++) sp[v * 4 + q] = W[k * 5 + q]; sp2[v] = W[k * 5 + 4]; };
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) put(j * n1 + i, ci * cells + i * step, cj * cells + j * step, 0);
    for (let j = 0; j < cn; j++) for (let i = 0; i < cn; i++) { const a = j * n1 + i, b = a + 1, c2 = a + n1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
    // Schürze: Randvertices 4 m nach unten gezogen (verdeckt Spalten zwischen Detailstufen)
    let v = n1 * n1; const edges = [[0, 0, 1, 0], [0, cn, 1, 0], [0, 0, 0, 1], [cn, 0, 0, 1]];
    for (const [i0, j0, di, dj] of edges) { const s0 = v; for (let t = 0; t < n1; t++) put(v++, ci * cells + (i0 + di * t) * step, cj * cells + (j0 + dj * t) * step, 4);
      for (let t = 0; t < cn; t++) { const top0 = (j0 + dj * t) * n1 + i0 + di * t, top1 = (j0 + dj * (t + 1)) * n1 + i0 + di * (t + 1), b0 = s0 + t, b1 = s0 + t + 1; idx.push(top0, b0, top1, top1, b0, b1, top0, top1, b0, top1, b1, b0); } }
    const g = new THREE.BufferGeometry(), at = (a, k) => { const b = new THREE.BufferAttribute(a, k); b.onUpload(freeArr); return b; };
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', at(nor, 3)); g.setAttribute('color', at(col, 3)); g.setAttribute('splat', at(sp, 4)); g.setAttribute('splat2', at(sp2, 1)); g.setIndex(idx); g.computeBoundingSphere(); g.attributes.position.onUpload(freeArr);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); return m; };
  for (let cj = 0; cj < NC; cj++) for (let ci = 0; ci < NC; ci++) {
    const hi = mkChunk(ci, cj, 1), lo = mkChunk(ci, cj, 4); lo.visible = false; World.terrainChunks.push(hi);
    World.lod.push({ obj: hi, alt: lo, x: -WS + (ci + 0.5) * cells * CELL, z: -WS + (cj + 0.5) * cells * CELL, far: 700, altFar: 1e9 });
  }
  World.terrain = World.terrainChunks[0];
}

// ---------- MINIMAP-BILD ----------
const MAP = { size: 1600, range: WS, s: 1600 / (2 * WS), canvas: null };
function buildMinimapImage() {
  const S = MAP.size, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), id = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const wx = x / MAP.s - WS, wz = y / MAP.s - WS, h = terrainHeight(wx, wz), i = (y * S + x) * 4; let r, gg, b;
    if (h < 0) { const d = clamp(-h / 25, 0, 1); r = 38 - d * 20; gg = 120 - d * 60; b = 150 - d * 40; } else if (h < 3 && islandE(wx, wz) < 0.09) { r = 214; gg = 194; b = 140; } else { const k = clamp(h / 180, 0, 1); r = 70 + k * 70; gg = 100 + k * 30; b = 62 + k * 50; }
    id.data[i] = r; id.data[i + 1] = gg; id.data[i + 2] = b; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0); const s = MAP.s, T = (x) => (x + WS) * s;
  g.fillStyle = 'rgba(120,124,130,.9)'; g.fillRect(T(BASE.x - BASE.hx), T(BASE.z - BASE.hz), BASE.hx * 2 * s, BASE.hz * 2 * s); g.fillStyle = '#3a3a3e'; g.fillRect(T(BASE.x - 93), T(BASE.z - 420), 46 * s, 840 * s);
  g.fillStyle = 'rgba(150,150,140,.5)'; for (const D of DISTS) { if (!['downtown', 'uptown', 'midtown', 'oldtown', 'port', 'industrial'].includes(D.k)) continue; g.save(); g.translate(T(D.cx), T(D.cz)); if (D.r) { g.beginPath(); g.arc(0, 0, D.r * s, 0, 7); g.fill(); } else { g.rotate(D.rot); g.fillRect(-D.hu * s, -D.hv * s, D.hu * 2 * s, D.hv * 2 * s); } g.restore(); }
  g.fillStyle = 'rgba(90,150,80,.8)'; for (const p of PARKS) { g.save(); g.translate(T(p.x), T(p.z)); g.rotate(-Math.atan2(p.s, p.c)); g.fillRect(-p.hx * s, -p.hz * s, p.hx * 2 * s, p.hz * 2 * s); g.restore(); }
  for (const f of FIELDS) { g.save(); g.translate(T(f.x), T(f.z)); g.rotate(-Math.atan2(f.s, f.c)); g.fillStyle = ['rgba(200,180,90,.6)', 'rgba(150,190,90,.6)', 'rgba(170,130,90,.6)', 'rgba(180,210,100,.6)', 'rgba(120,200,90,.75)', 'rgba(230,215,160,.9)'][f.type]; g.fillRect(-f.hx * s, -f.hz * s, f.hx * 2 * s, f.hz * 2 * s); g.restore(); }
  g.fillStyle = '#4a5058'; for (const b of BLD) { g.save(); g.translate(T(b.x), T(b.z)); g.rotate(-b.yaw); g.fillRect(-b.w / 2 * s, -b.d / 2 * s, b.w * s, b.d * s); g.restore(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [0, 1]) for (const e of Roads.edges) { g.strokeStyle = pass ? (e.type === 'highway' ? '#f0d890' : '#d8dce0') : '#22262a'; g.lineWidth = (e.hw * 2 + (pass ? 0 : 3)) * s; g.beginPath(); e.pts.forEach((p, k) => k ? g.lineTo(T(p.x), T(p.z)) : g.moveTo(T(p.x), T(p.z))); g.stroke(); }
  MAP.canvas = c;
}
function buildWorld() {
  makeWorldMaterials(); Signs.init();
  buildRoadNetwork(); carveRoads(); buildParks(); buildSpecials(); buildBase(); buildCoast(); buildBuildings(); buildInfill(); buildRural(); buildRoadMeshes(); buildStreetFurniture(); Signals.build(); buildStunts(); buildVegetation(); buildTerrain();
  flushParts(); Signs.flush(); flushNeon(); buildMinimapImage();
  console.log('Welt-Vertices:', VERTS, 'Gebäude:', BLD.length);
  LOC.kai = LOC.safehouse ? LOC.safehouse.clone() : V3(SUBURB.x, 5, SUBURB.z); LOC.elena = LOC.beach.clone();
  LOC.hospital = LOC.hospital || V3(DOWNTOWN.x, 5, DOWNTOWN.z); LOC.police = LOC.police || V3(DOWNTOWN.x + 50, 5, DOWNTOWN.z); LOC.chop = LOC.chop || V3(PORT.x, 3, PORT.z); LOC.m1car = LOC.m1car || V3(SUBURB.x, 5, SUBURB.z + 40); LOC.m1lot = LOC.m1lot || LOC.m1car.clone(); LOC.plaza = LOC.plaza || V3(DOWNTOWN.x, 5, DOWNTOWN.z);
  PICKUP_SPOTS.push(['health', LOC.beach.x, LOC.beach.z], ['cash', LOC.summit.x + 5, LOC.summit.z], ['armor', LOC.portYard.x, LOC.portYard.z + 5], ['cash', LOC.lighthouse.x + 6, LOC.lighthouse.z]);
}
