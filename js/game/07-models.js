
// =====================================================================
//  MODELLE: Figuren (Skelett), Waffen, Autos, Motorrad, Boote, Luftfahrzeuge
//  Stil: Low-Poly mit flacher Schattierung, viele kleine Detailteile
// =====================================================================
function geoT(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  g = g.index ? g.toNonIndexed() : g.clone(); if (g.attributes.uv) g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(tmpV1.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz)), tmpV2.set(sx, sy, sz))); return g;
}
function colorize(g, c) { const cc = C3(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function mergeGeos(list) { const keepC = list.every(g => g.attributes.color); const gs = list.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keepC && k === 'color')) g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; }); return ADD.merge(gs); }
const mergeList = mergeGeos;
// Zentrierte Einheitskörper
const CG = {
  box: () => ug('cbox', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (n = 10, t = 1) => ug('ccyl' + n + '_' + t, () => new THREE.CylinderGeometry(0.5 * t, 0.5, 1, n)),
  sph: (n = 8) => ug('csph' + n, () => new THREE.SphereGeometry(0.5, n, Math.max(4, Math.round(n * 0.6)))),
  hsph: (n = 10) => ug('chsph' + n, () => new THREE.SphereGeometry(0.5, n, Math.max(3, n >> 1), 0, Math.PI * 2, 0, Math.PI / 2)),
  ico: (d = 0) => ug('cico' + d, () => new THREE.IcosahedronGeometry(0.5, d)),
  frus: (tx, tz, oz = 0) => ug('cfr' + tx + '_' + tz + '_' + oz, () => frustumGeo(tx, tz, oz).translate(0, -0.5, 0)),
  cone: (n = 8) => ug('ccone' + n, () => new THREE.ConeGeometry(0.5, 1, n)),
  tor: (t = 0.2, n = 12) => ug('ctor' + t + n, () => new THREE.TorusGeometry(0.5, t, 4, n)),
};
// Polygon (konvex) als Fläche, Normale zeigt von ref weg
function polyGeo(pts, ref) {
  const pos = [], c = pts.reduce((a, p) => a.add(p), V3()).multiplyScalar(1 / pts.length);
  const n = V3().subVectors(pts[1], pts[0]).cross(V3().subVectors(pts[2], pts[0])), flip = n.dot(V3().subVectors(c, ref)) < 0;
  for (let i = 1; i < pts.length - 1; i++) { const a = pts[0], b = flip ? pts[i + 1] : pts[i], d = flip ? pts[i] : pts[i + 1]; pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
// Loft: Querschnitte entlang z (gleiche Punktzahl) → facettierter Körper
function loftGeo(secs, { closed = true, caps = true, inside = [0, 0] } = {}) {
  const pos = [], n = secs[0].pts.length, cen = secs.map(s => { let x = 0, y = 0; for (const p of s.pts) { x += p[0]; y += p[1]; } return [x / n + inside[0], y / n + inside[1], s.z]; });
  const tri = (a, b, c, r) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (nx * nx + ny * ny + nz * nz < 1e-12) return;
    const mx = (a[0] + b[0] + c[0]) / 3 - r[0], my = (a[1] + b[1] + c[1]) / 3 - r[1], mz = (a[2] + b[2] + c[2]) / 3 - r[2]; if (nx * mx + ny * my + nz * mz < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c); };
  const P = (s, j) => [secs[s].pts[j][0], secs[s].pts[j][1], secs[s].z];
  for (let s = 0; s < secs.length - 1; s++) { const r = [(cen[s][0] + cen[s + 1][0]) / 2, (cen[s][1] + cen[s + 1][1]) / 2, (cen[s][2] + cen[s + 1][2]) / 2];
    for (let j = 0; j < (closed ? n : n - 1); j++) { const j2 = (j + 1) % n, a = P(s, j), b = P(s, j2), c = P(s + 1, j2), d = P(s + 1, j); tri(a, b, c, r); tri(a, c, d, r); } }
  if (caps) for (const [s, o] of [[0, 1], [secs.length - 1, secs.length - 2]]) { const c = cen[s], r = [cen[o][0], cen[o][1], cen[o][2]]; for (let j = 0; j < n; j++) tri([c[0], c[1], c[2]], P(s, j), P(s, (j + 1) % n), r); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const ring = (n, rx, ry, cx = 0, cy = 0, rot = 0) => { const p = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + rot; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; };
// Bausatz: Teile pro Materialgruppe sammeln, am Ende zusammenführen
class Kit {
  constructor() { this.b = {}; }
  add(k, g, x, y, z, sx, sy, sz, c, rx = 0, ry = 0, rz = 0) { const gg = geoT(g, x, y, z, rx, ry, rz, sx, sy, sz); if (c != null) colorize(gg, c); (this.b[k] || (this.b[k] = [])).push(gg); return this; }
  raw(k, g, c) { if (c != null) colorize(g, c); (this.b[k] || (this.b[k] = [])).push(g); return this; }
  box(k, w, h, d, x, y, z, c, rx = 0, ry = 0, rz = 0) { return this.add(k, CG.box(), x, y, z, w, h, d, c, rx, ry, rz); }
  cyl(k, r, len, x, y, z, c, axis = 'y', n = 10, rx = 0, ry = 0, rz = 0) { return this.add(k, CG.cyl(n), x, y, z, r * 2, len, r * 2, c, axis === 'z' ? Math.PI / 2 + rx : rx, ry, axis === 'x' ? Math.PI / 2 + rz : rz); }
  sph(k, r, x, y, z, c, sx = 1, sy = 1, sz = 1, n = 8) { return this.add(k, CG.sph(n), x, y, z, r * 2 * sx, r * 2 * sy, r * 2 * sz, c); }
  geo(k) { const L = this.b[k]; return L && L.length ? mergeGeos(L) : null; }
  geos() { const o = {}; for (const k of Object.keys(this.b)) o[k] = this.geo(k); return o; }
}

// ---------- FIGUR MIT SKELETT (1 Draw-Call pro Person) ----------
const BONES = [ // name, parent, x, y, z (relativ)
  ['root', -1, 0, 0, 0], ['hips', 0, 0, 0.98, 0], ['spine', 1, 0, 0.12, 0], ['chest', 2, 0, 0.2, 0], ['neck', 3, 0, 0.2, 0], ['head', 4, 0, 0.08, 0],
  ['uArmL', 3, 0.2, 0.16, 0], ['fArmL', 6, 0, -0.29, 0], ['handL', 7, 0, -0.26, 0], ['uArmR', 3, -0.2, 0.16, 0], ['fArmR', 9, 0, -0.29, 0], ['handR', 10, 0, -0.26, 0],
  ['thighL', 1, 0.1, -0.04, 0], ['shinL', 12, 0, -0.44, 0], ['footL', 13, 0, -0.43, 0], ['thighR', 1, -0.1, -0.04, 0], ['shinR', 15, 0, -0.44, 0], ['footR', 16, 0, -0.43, 0],
];
const SLOT = { skin: 0, shirt: 1, pants: 2, hair: 3, shoes: 4, eye: 5, legs: 6, sleeve: 7, belt: 8, sole: 9, lip: 10, white: 11 };
const _humBase = {};
function humanBase(female) {
  const key = female ? 'f' : 'm'; if (_humBase[key]) return _humBase[key];
  const parts = []; const P = (g, bone, slot) => parts.push([g, bone, slot]); const f = female ? 0.9 : 1, sw = female ? 0.86 : 1;
  const B = (w, h, d, x, y, z, bone, slot, rx = 0, ry = 0, rz = 0) => P(geoT(CG.box(), x, y, z, rx, ry, rz, w, h, d), bone, slot);
  const F = (w, h, d, tx, tz, x, y, z, bone, slot, rx = 0) => P(geoT(CG.frus(tx, tz), x, y, z, rx, 0, 0, w, h, d), bone, slot);
  const Cy = (r, h, x, y, z, bone, slot, n = 7, t = 1, rx = 0, rz = 0) => P(geoT(CG.cyl(n, t), x, y, z, rx, 0, rz, r * 2, h, r * 2), bone, slot);
  // Becken & Gürtel
  F(0.32 * (female ? 1.06 : 1), 0.2, 0.2, 1.08, 1.0, 0, 0.94, 0, 1, SLOT.pants);
  B(0.33 * (female ? 1.06 : 1), 0.05, 0.21, 0, 1.045, 0, 1, SLOT.belt); B(0.05, 0.04, 0.02, 0, 1.045, 0.107, 1, SLOT.white);
  // Rumpf: Taille → Brust (verjüngt), Schultern
  F(0.3 * f, 0.18, 0.18, 1.12, 1.05, 0, 1.15, 0, 2, SLOT.shirt);
  F(0.34 * sw, 0.3, 0.21, 1.14 * (female ? 1 : 1.04), 0.95, 0, 1.37, 0, 3, SLOT.shirt);
  B(0.42 * sw, 0.08, 0.19, 0, 1.495, 0, 3, SLOT.shirt);
  if (female) { P(geoT(CG.sph(6), 0.06, 1.36, 0.085, 0, 0, 0, 0.11, 0.1, 0.08), 3, SLOT.shirt); P(geoT(CG.sph(6), -0.06, 1.36, 0.085, 0, 0, 0, 0.11, 0.1, 0.08), 3, SLOT.shirt); }
  B(0.16, 0.03, 0.12, 0, 1.53, 0.0, 3, SLOT.shirt); // Kragen
  Cy(0.05, 0.1, 0, 1.56, 0, 4, SLOT.skin, 6);
  // Kopf: facettierter Würfel, Kinn, Nase, Ohren, Augen, Brauen, Mund
  F(0.19, 0.08, 0.2, 1.1, 1.08, 0, 1.59, 0.0, 5, SLOT.skin); // Kinn/Kiefer
  B(0.21, 0.16, 0.215, 0, 1.71, 0, 5, SLOT.skin); F(0.21, 0.05, 0.215, 0.82, 0.82, 0, 1.815, 0, 5, SLOT.skin);
  B(0.03, 0.04, 0.035, 0, 1.695, 0.118, 5, SLOT.skin, -0.25); B(0.025, 0.05, 0.04, 0.11, 1.705, 0, 5, SLOT.skin); B(0.025, 0.05, 0.04, -0.11, 1.705, 0, 5, SLOT.skin);
  for (const s of [1, -1]) { B(0.04, 0.026, 0.01, 0.045 * s, 1.727, 0.108, 5, SLOT.white); B(0.018, 0.022, 0.012, 0.045 * s, 1.726, 0.112, 5, SLOT.eye); B(0.05, 0.012, 0.012, 0.045 * s, 1.755, 0.109, 5, SLOT.hair, 0, 0, s * 0.12); }
  B(0.06, 0.012, 0.01, 0, 1.658, 0.108, 5, SLOT.lip);
  for (const s of [1, -1]) {
    const ai = s > 0 ? 0 : 3, x = 0.205 * s * sw;
    // Schulterkappe, Oberarm (Ärmel), Unterarm, Hand mit Daumen
    P(geoT(CG.sph(6), x, 1.47, 0, 0, 0, 0, 0.12, 0.11, 0.12), 6 + ai, SLOT.shirt);
    Cy(0.05 * f, 0.27, x, 1.33, 0, 6 + ai, SLOT.shirt, 6, 1.18);
    Cy(0.04 * f, 0.26, x, 1.045, 0, 7 + ai, SLOT.sleeve, 6, 1.15);
    B(0.06, 0.1, 0.085, x, 0.86, 0.005, 8 + ai, SLOT.skin); B(0.025, 0.05, 0.03, x + 0.03 * s, 0.885, 0.04, 8 + ai, SLOT.skin, 0, 0, -0.4 * s);
    const li = s > 0 ? 0 : 3, lx = 0.1 * s;
    // Oberschenkel, Unterschenkel, Schuh mit Sohle
    Cy(0.074 * (female ? 0.98 : 1), 0.44, lx, 0.72, 0, 12 + li, SLOT.pants, 7, 1.2);
    Cy(0.052, 0.42, lx, 0.29, 0, 13 + li, SLOT.legs, 7, 1.22);
    B(0.11, 0.09, 0.25, lx, 0.07, 0.045, 14 + li, SLOT.shoes); B(0.115, 0.03, 0.26, lx, 0.015, 0.045, 14 + li, SLOT.sole); B(0.1, 0.03, 0.05, lx, 0.1, 0.15, 14 + li, SLOT.shoes, -0.6);
  }
  const hp = (g) => geoT(g, 0, -1.58, 0); // Haar-Teile relativ zum Kopfknochen (Weltpos → lokal)
  const hairGeo = (list) => mergeGeos(list.map(([g, x, y, z, sx, sy, sz, rx = 0]) => hp(geoT(g, x, y, z, rx, 0, 0, sx, sy, sz))));
  const hair = {
    short: hairGeo([[CG.box(), 0, 1.835, -0.005, 0.235, 0.06, 0.24], [CG.box(), 0, 1.74, -0.1, 0.235, 0.18, 0.05], [CG.box(), 0.108, 1.775, -0.01, 0.025, 0.1, 0.2], [CG.box(), -0.108, 1.775, -0.01, 0.025, 0.1, 0.2], [CG.box(), 0.03, 1.81, 0.1, 0.16, 0.05, 0.05, -0.35]]),
    buzz: hairGeo([[CG.box(), 0, 1.83, -0.005, 0.222, 0.04, 0.225], [CG.box(), 0, 1.75, -0.1, 0.222, 0.14, 0.03]]),
    ponytail: hairGeo([[CG.box(), 0, 1.84, -0.005, 0.238, 0.07, 0.244], [CG.box(), 0, 1.72, -0.1, 0.238, 0.24, 0.05], [CG.box(), 0.111, 1.745, -0.02, 0.03, 0.2, 0.2], [CG.box(), -0.111, 1.745, -0.02, 0.03, 0.2, 0.2], [CG.box(), 0, 1.81, 0.105, 0.2, 0.05, 0.04, -0.4],
      [CG.frus(0.6, 0.6), 0, 1.63, -0.17, 0.08, 0.26, 0.08, 0.35], [CG.box(), 0, 1.77, -0.135, 0.06, 0.05, 0.05]]),
    long: hairGeo([[CG.box(), 0, 1.84, -0.005, 0.238, 0.07, 0.244], [CG.box(), 0, 1.63, -0.1, 0.24, 0.42, 0.06], [CG.box(), 0.112, 1.69, -0.02, 0.035, 0.3, 0.2], [CG.box(), -0.112, 1.69, -0.02, 0.035, 0.3, 0.2], [CG.box(), 0.04, 1.81, 0.105, 0.16, 0.05, 0.04, -0.4]]),
    bun: hairGeo([[CG.box(), 0, 1.84, -0.005, 0.234, 0.065, 0.238], [CG.box(), 0, 1.74, -0.1, 0.234, 0.19, 0.05], [CG.box(), 0.108, 1.76, -0.01, 0.026, 0.12, 0.2], [CG.box(), -0.108, 1.76, -0.01, 0.026, 0.12, 0.2], [CG.ico(0), 0, 1.9, -0.07, 0.12, 0.1, 0.12]]),
    cap: hairGeo([[CG.frus(0.9, 0.9), 0, 1.855, -0.005, 0.242, 0.08, 0.248], [CG.box(), 0, 1.822, 0.165, 0.21, 0.02, 0.14], [CG.box(), 0, 1.77, -0.1, 0.226, 0.1, 0.04]]),
    bald: hairGeo([[CG.box(), 0, 1.72, -0.106, 0.2, 0.05, 0.02]]),
  };
  const glasses = mergeGeos([hp(geoT(CG.box(), 0.047, 1.728, 0.12, 0, 0, 0, 0.065, 0.038, 0.012)), hp(geoT(CG.box(), -0.047, 1.728, 0.12, 0, 0, 0, 0.065, 0.038, 0.012)), hp(geoT(CG.box(), 0, 1.736, 0.12, 0, 0, 0, 0.22, 0.012, 0.01))]);
  const gs = [], slots = [], bones = [];
  for (const [g, b, s] of parts) { gs.push(g); const n = g.attributes.position.count; for (let i = 0; i < n; i++) { slots.push(s); bones.push(b); } }
  const res = { body: { gs, slots, bones }, hair, glasses }; _humBase[key] = res; return res;
}
const HUMAN_MAT = lam({ vertexColors: true, flatShading: true });
const _gunGeos = {};
function gunGeo(id) { // Waffenmodelle (Lauf zeigt entlang -y der Hand)
  if (_gunGeos[id]) return _gunGeos[id]; let L = [];
  const b = (w, h, d, x, y, z, rx = 0) => geoT(CG.box(), x, y, z, rx, 0, 0, w, h, d), c = (r, h, x, y, z) => geoT(CG.cyl(6), x, y, z, 0, 0, 0, r * 2, h, r * 2);
  if (id === 'pistol') L = [b(0.035, 0.2, 0.05, 0, -0.1, 0.03), b(0.032, 0.05, 0.11, 0, -0.01, -0.02, 0.25), c(0.009, 0.04, 0, -0.21, 0.035)];
  else if (id === 'smg') L = [b(0.05, 0.3, 0.08, 0, -0.14, 0.04), c(0.012, 0.12, 0, -0.34, 0.06), b(0.035, 0.05, 0.16, 0, -0.12, -0.05), b(0.03, 0.12, 0.03, 0, -0.04, -0.01)];
  else if (id === 'shotgun') L = [c(0.018, 0.62, 0, -0.3, 0.06), c(0.025, 0.25, 0, -0.22, 0.02), b(0.045, 0.3, 0.07, 0, 0.12, 0.04), b(0.05, 0.12, 0.05, 0, -0.32, 0.02)];
  else if (id === 'rifle') L = [b(0.05, 0.4, 0.09, 0, -0.12, 0.05), c(0.013, 0.3, 0, -0.47, 0.07), b(0.04, 0.06, 0.18, 0, -0.1, -0.06), b(0.045, 0.22, 0.07, 0, 0.17, 0.04), c(0.02, 0.14, 0, -0.15, 0.12), b(0.03, 0.12, 0.05, 0, -0.08, 0.11)];
  _gunGeos[id] = L.length ? mergeGeos(L) : null; return _gunGeos[id];
}
const GUN_LEN = { pistol: 0.22, smg: 0.4, shotgun: 0.62, rifle: 0.62 };
const GLASSES_MAT = new THREE.MeshPhongMaterial({ color: 0x101418, shininess: 120, specular: 0x8899aa, flatShading: true });
class LowHumanoid { // einfache Ersatzfigur (falls Modelle fehlen)
  constructor(look, shadows = false) {
    this.female = !!look.female; const base = humanBase(this.female);
    const geo = ADD.merge(base.body.gs.map(g => g.clone())); const n = geo.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = base.body.bones[i]; sw[i * 4] = 1; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); this.slots = base.body.slots; this.geo = geo;
    this.bones = []; const B = {};
    BONES.forEach(([name, parent, x, y, z], i) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent >= 0) this.bones[parent].add(b); this.bones.push(b); B[name] = b; });
    this.B = B; this.mesh = new THREE.SkinnedMesh(geo, HUMAN_MAT); this.mesh.add(this.bones[0]); this.mesh.updateMatrixWorld(true); this.mesh.bind(new THREE.Skeleton(this.bones));
    this.mesh.castShadow = shadows; this.mesh.frustumCulled = false;
    this.hairMat = lam({ color: look.hair, flatShading: true }); this.hairMeshes = {};
    for (const k of Object.keys(base.hair)) { const m = new THREE.Mesh(base.hair[k], this.hairMat); B.head.add(m); m.castShadow = shadows; this.hairMeshes[k] = m; }
    this.glasses = new THREE.Mesh(base.glasses, GLASSES_MAT); B.head.add(this.glasses);
    this.gun = new THREE.Mesh(new THREE.BufferGeometry(), MAT.gun); this.gun.position.y = -0.06; B.handR.add(this.gun); this.gunLen = 0.2; this.gunId = null;
    this.group = new THREE.Group(); this.group.add(this.mesh); L1(this.group); this.group.traverse(o => o.layers.set(1));
    this.phase = Math.random() * 6; this.deadAmt = 0; this.setLook(look); scene.add(this.group);
  }
  setLook(l) {
    const cols = [col(l.skin), col(l.shirt), col(l.pants), col(l.hair), col(l.shoes || '#222'), col('#1a1410'), col(l.shorts ? l.skin : l.pants), col(l.longSleeve ? l.shirt : l.skin), col(l.belt || '#2a2018'), col(l.sole || '#e8e4dc'), col('#b06a5a'), col('#f4f4f0')];
    const c = this.geo.attributes.color; for (let i = 0; i < this.slots.length; i++) { const k = cols[this.slots[i]]; c.setXYZ(i, k.r, k.g, k.b); } c.needsUpdate = true;
    const style = l.hairStyle || 'short'; this.hairMat.color.set(style === 'cap' ? (l.capColor || l.hair) : l.hair);
    for (const k of Object.keys(this.hairMeshes)) this.hairMeshes[k].visible = style === k;
    this.glasses.visible = !!l.glasses;
  }
  setWeapon(w) { const id = w && !w.melee ? w.id : null; if (id === this.gunId) return; this.gunId = id; this.gun.visible = !!id; if (id) { this.gun.geometry = gunGeo(id); this.gunLen = GUN_LEN[id]; } }
  muzzle(out) { out.set(0, -0.06 - this.gunLen, 0.06); this.group.updateMatrixWorld(true); return this.B.handR.localToWorld(out); }
  // Prozedurale Animation über Knochenrotationen
  animate(dt, s) {
    const B = this.B, sp = s.speed || 0; this.phase += dt * (sp < 0.1 ? 0 : 3.2 + sp * 1.25); const run = sp > 4.5;
    const a = Math.min(1, sp / 2) * (run ? 0.95 : 0.55), ph = this.phase;
    const T = { hipsY: 0.98 - (run ? Math.abs(Math.sin(ph)) * 0.04 : Math.abs(Math.sin(ph)) * 0.02 * Math.min(1, sp)), rootX: 0, rootY: 0, spineX: run ? 0.18 : 0.04, chestY: Math.sin(ph) * a * 0.15, headX: 0, tL: Math.sin(ph) * a, tR: -Math.sin(ph) * a, sL: Math.max(0, -Math.sin(ph - 0.9)) * a * 1.4 + 0.05, sR: Math.max(0, Math.sin(ph - 0.9)) * a * 1.4 + 0.05,
      tLz: 0, fL: 0, fR: 0, uaL: -Math.sin(ph) * a * 0.75, uaR: Math.sin(ph) * a * 0.75, faL: -0.25 - (run ? 0.9 : 0.2), faR: -0.25 - (run ? 0.9 : 0.2), uaLz: 0.08, uaRz: -0.08, uaLy: 0, uaRy: 0 };
    if (sp < 0.1) { const br = Math.sin(GameTime * 1.5 + this.phase) * 0.02; T.spineX = br; T.uaLz = 0.1; T.uaRz = -0.1; T.faL = T.faR = -0.15; T.chestY = 0; }
    if (s.air) { T.tL = -0.7; T.sL = 1.0; T.tR = 0.25; T.sR = 0.4; T.uaL = -0.6; T.uaR = -0.6; }
    if (s.crouch) { T.hipsY = 0.62; T.tL = -1.25 + T.tL * 0.25; T.tR = -1.25 + T.tR * 0.25; T.sL = 1.9; T.sR = 1.9; T.fL = T.fR = -0.6; T.spineX = 0.35; }
    if (s.sit) {
      if (s.bike) { T.hipsY = 0.12; T.tL = T.tR = -1.05; T.sL = T.sR = 1.75; T.fL = T.fR = -0.45; T.uaL = T.uaR = -1.43; T.faL = T.faR = -0.15; T.tLz = 0.28; T.spineX = 0.48; T.uaLz = 0.22; T.uaRz = -0.22; T.chestY = 0; }
      else { T.hipsY = 0.12; T.tL = T.tR = -1.5; T.sL = T.sR = 1.45; T.fL = T.fR = -0.1; T.uaL = T.uaR = -0.95; T.faL = T.faR = -0.55; T.spineX = -0.12; T.uaLz = 0.12; T.uaRz = -0.12; T.chestY = 0; }
    }
    if (s.swim) { T.rootX = 1.35; T.rootY = 0.15; T.uaL = Math.sin(ph * 0.8) * 2.6; T.uaR = Math.sin(ph * 0.8 + Math.PI) * 2.6; T.faL = T.faR = -0.3; T.tL = Math.sin(ph * 1.5) * 0.35; T.tR = -T.tL; T.sL = T.sR = 0.2; }
    if (s.aim) { const p = s.aimPitch || 0; T.uaR = -Math.PI / 2 + p; T.faR = -0.05; T.uaRz = 0.12; T.uaL = -1.2 + p * 0.8; T.uaLz = -0.62; T.uaLy = 0.25; T.faL = -0.55; T.spineX = s.crouch ? 0.25 : 0.02; T.chestY = 0.15; }
    if (s.punch > 0) { T.uaR = -1.6; T.faR = -0.1; T.uaRz = 0.25; T.chestY = -0.35; }
    if (s.cower) { T.hipsY = 0.6; T.tL = T.tR = -1.3; T.sL = T.sR = 2; T.uaL = T.uaR = -2.7; T.faL = T.faR = -1.9; T.uaLz = -0.5; T.uaRz = 0.5; T.spineX = 0.45; }
    if (s.handsUp) { T.uaL = T.uaR = -2.9; T.faL = T.faR = -0.4; }
    if (s.phone && !s.aim) { T.uaR = -0.45; T.uaRz = -0.5; T.faR = -2.35; T.spineX = 0.06; }
    this.deadAmt = s.dead ? Math.min(1, this.deadAmt + dt * 3) : 0;
    if (this.deadAmt > 0) { T.rootX = -Math.PI / 2 * smooth(this.deadAmt); T.rootY = 0.12 * this.deadAmt; T.tL = 0.15; T.tR = -0.2; T.sL = 0.3; T.sR = 0.1; T.uaL = -0.3; T.uaR = 0.4; T.uaLz = 1.1; T.uaRz = -1.1; T.faL = T.faR = -0.3; T.spineX = 0; T.hipsY = 0.98; }
    const k = 1 - Math.exp(-18 * dt), K = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    K(B.hips.position, 'y', T.hipsY); K(B.spine.rotation, 'x', T.spineX); K(B.chest.rotation, 'y', T.chestY);
    K(B.thighL.rotation, 'x', T.tL); K(B.thighR.rotation, 'x', T.tR); K(B.thighL.rotation, 'z', T.tLz); K(B.thighR.rotation, 'z', -T.tLz); K(B.shinL.rotation, 'x', T.sL); K(B.shinR.rotation, 'x', T.sR); K(B.footL.rotation, 'x', T.fL); K(B.footR.rotation, 'x', T.fR);
    K(B.uArmL.rotation, 'x', T.uaL); K(B.uArmR.rotation, 'x', T.uaR); K(B.uArmL.rotation, 'z', T.uaLz); K(B.uArmR.rotation, 'z', T.uaRz); K(B.uArmL.rotation, 'y', T.uaLy);
    K(B.fArmL.rotation, 'x', T.faL); K(B.fArmR.rotation, 'x', T.faR);
    if (this.deadAmt > 0) { B.root.rotation.x = T.rootX; B.root.position.y = T.rootY; } else { K(B.root.rotation, 'x', T.rootX); K(B.root.position, 'y', T.rootY); }
  }
}

// ---------- REALISTISCHE FIGUREN (GLB-Körper, Kleidung per Shader, Frisuren, Animation per Retargeting) ----------
// Die bewährte prozedurale Animation steuert ein unsichtbares Hilfsskelett; dessen Drehungen werden
// pro Bild auf das echte Skelett übertragen (Arme: T-Pose → hängend per Korrektur-Rotation).
const PeopleLib = {
  ok: false, base: {},
  HAIR: { short: 'hair-simpleparted', buzz: 'hair-buzzed', ponytail: 'hair-buns', long: 'hair-long', bun: 'hair-buns', cap: 'hair-buzzed', bald: null, femshort: 'hair-buzzedfemale', beard: 'hair-beard' },
  MAP: [['root', 'root'], ['hips', 'pelvis'], ['spine', 'spine_01'], ['chest', 'spine_03'], ['neck', 'neck_01'], ['head', 'Head'], ['uArmL', 'upperarm_l', 'L'], ['fArmL', 'lowerarm_l', 'L'], ['handL', 'hand_l', 'L'],
    ['uArmR', 'upperarm_r', 'R'], ['fArmR', 'lowerarm_r', 'R'], ['handR', 'hand_r', 'R'], ['thighL', 'thigh_l'], ['shinL', 'calf_l'], ['footL', 'foot_l'], ['thighR', 'thigh_r'], ['shinR', 'calf_r'], ['footR', 'foot_r']],
  init() { this.ok = !!(Assets.models['people/superhero-male-fullbody'] && Assets.models['people/superhero-female-fullbody']);
    this.fixL = new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), -Math.PI / 2); this.fixR = new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), Math.PI / 2); },
  // Kleidung: Masken aus der Bind-Pose (T-Pose) im Vertex-Shader, Farben als Uniforms je Figur
  clothMat(src, u) {
    const m = src.clone(); m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u);
      sh.vertexShader = 'uniform float uSleeve; uniform float uPantsEnd; varying vec3 vCloth;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 bp = position; float ax = abs(bp.x); float isArm = step(0.19, ax) * step(1.33, bp.y);
          float neckTop = 1.485 + 0.07 * smoothstep(0.035, 0.13, ax) - 0.035 * smoothstep(0.02, 0.09, bp.z) * (1.0 - smoothstep(0.03, 0.08, ax));
          float torso = (1.0 - isArm) * smoothstep(0.97, 1.01, bp.y) * (1.0 - smoothstep(neckTop - 0.012, neckTop + 0.012, bp.y));
          float sleeve = isArm * (1.0 - smoothstep(uSleeve - 0.015, uSleeve + 0.015, ax));
          float legs = (1.0 - isArm) * (1.0 - smoothstep(0.99, 1.02, bp.y)) * smoothstep(uPantsEnd - 0.015, uPantsEnd + 0.015, bp.y);
          float shoe = 1.0 - smoothstep(0.095, 0.115, bp.y); vCloth = vec3(max(torso, sleeve), legs * (1.0 - shoe), shoe); }`);
      sh.fragmentShader = 'uniform vec3 uShirt; uniform vec3 uPants; uniform vec3 uShoes; uniform vec3 uSkin; varying vec3 vCloth;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float cm = clamp(vCloth.x + vCloth.y + vCloth.z, 0.0, 1.0); float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 cloth = uShirt * vCloth.x + uPants * vCloth.y + uShoes * vCloth.z;
          diffuseColor.rgb = mix(diffuseColor.rgb * uSkin, cloth * (0.82 + lum * 0.5), cm);`)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, clamp(vCloth.x + vCloth.y + vCloth.z, 0.0, 1.0) * 0.75));')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.85, clamp(vCloth.x + vCloth.y + vCloth.z, 0.0, 1.0));'); };
    m.customProgramCacheKey = () => 'cloth1'; return m;
  },
};
const _hq1 = new THREE.Quaternion(), _hq2 = new THREE.Quaternion(), _hv1 = V3(), _hm1 = new THREE.Matrix4();
class Humanoid {
  constructor(look, shadows = false) {
    if (!PeopleLib.ok) return new LowHumanoid(look, shadows);
    this.female = !!look.female; this.shadows = shadows;
    const gl = Assets.models['people/superhero-' + (this.female ? 'female' : 'male') + '-fullbody'];
    this.root3 = ADD.cloneSkinned(gl.scene); this.group = new THREE.Group(); this.group.add(this.root3);
    this.u = { uShirt: { value: new THREE.Color() }, uPants: { value: new THREE.Color() }, uShoes: { value: new THREE.Color() }, uSkin: { value: new THREE.Color(1, 1, 1) }, uSleeve: { value: 0.36 }, uPantsEnd: { value: 0.1 } };
    this.meshes = []; this.bonesBy = {};
    this.root3.traverse(o => { if (o.isBone) this.bonesBy[o.name] = o;
      if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = shadows; this.meshes.push(o);
        if (/superhero/i.test(o.name)) { o.material = PeopleLib.clothMat(o.material, this.u); this.body = o; } else if (/eyebrow/i.test(o.name)) { o.material = o.material.clone(); this.brows = o; } } });
    // Hilfsskelett (unsichtbar) – wird von animate() gesteuert
    this.bones = []; const B = {}; BONES.forEach(([name, parent, x, y, z]) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent >= 0) this.bones[parent].add(b); this.bones.push(b); B[name] = b; });
    this.B = B; this.group.add(this.bones[0]); this.group.updateMatrixWorld(true);
    // Bind-Pose des echten Skeletts im Modellraum merken
    this.root3.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    this.order = []; const seen = new Set(), visit = (b) => { if (!b.isBone || seen.has(b)) return; seen.add(b); this.order.push(b); for (const c of b.children) visit(c); };
    visit(this.bonesBy.root);
    for (const b of this.order) { const m = new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld); b.userData.bindModelQ = new THREE.Quaternion().setFromRotationMatrix(m); b.userData.bindLocalQ = b.quaternion.clone(); b.userData.bindPos = b.position.clone(); b.userData.modelQ = new THREE.Quaternion(); }
    const pm = this.bonesBy.root.parent; this.armMatrix = new THREE.Matrix4().multiplyMatrices(inv, pm.matrixWorld); this.armQ = new THREE.Quaternion().setFromRotationMatrix(this.armMatrix);
    this.map = new Map(); for (const [d, g, side] of PeopleLib.MAP) { const gb = this.bonesBy[g]; if (gb) this.map.set(gb, { drv: B[d], fix: side === 'L' ? PeopleLib.fixL : side === 'R' ? PeopleLib.fixR : null }); }
    this.pelvisBind = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(inv, this.bonesBy.pelvis.matrixWorld)); this._rootM = new THREE.Matrix4();
    // Frisuren, Bart, Mütze, Brille, Waffe
    this.hairMeshes = {}; this.hairMat = null;
    this.gun = new THREE.Mesh(new THREE.BufferGeometry(), MAT.gun); this.gunLen = 0.2; this.gunId = null; this.attach(this.bonesBy.hand_r, this.gun, PeopleLib.fixR, V3(0, -0.06, 0));
    this.cap = new THREE.Mesh(mergeGeos([geoT(CG.frus(0.9, 0.9), 0, 0.235, -0.005, 0, 0, 0, 0.215, 0.075, 0.235), geoT(CG.box(), 0, 0.2, 0.15, -0.12, 0, 0, 0.2, 0.018, 0.13)]), new THREE.MeshStandardMaterial({ color: 0x223355, roughness: 0.8 }));
    this.attach(this.bonesBy.Head, this.cap, null, V3(0, 0, 0)); this.cap.position.add(V3(0, 0, 0)); 
    this.glasses = new THREE.Mesh(mergeGeos([geoT(CG.box(), 0.034, 0.1, 0.105, 0, 0, 0, 0.055, 0.03, 0.01), geoT(CG.box(), -0.034, 0.1, 0.105, 0, 0, 0, 0.055, 0.03, 0.01), geoT(CG.box(), 0, 0.108, 0.105, 0, 0, 0, 0.15, 0.008, 0.008)]), GLASSES_MAT);
    this.attach(this.bonesBy.Head, this.glasses, null, V3(0, 0, 0));
    L1(this.group); this.group.traverse(o => o.layers.set(1));
    this.phase = Math.random() * 6; this.deadAmt = 0; this.setLook(look); scene.add(this.group);
  }
  // Objekt an einen Knochen hängen; Lage wie am Hilfsskelett (Korrektur über Bind-Pose)
  attach(bone, obj, fix, pos) { const B = bone.userData.bindModelQ || new THREE.Quaternion(); const q = B.clone().invert(); if (fix) q.multiply(fix.clone().invert()); obj.quaternion.copy(q); obj.position.copy(pos).applyQuaternion(q); bone.add(obj); }
  hairFor(style) {
    const key = this.female && style === 'short' ? 'femshort' : style, file = PeopleLib.HAIR[key]; if (file === undefined || file === null) return null; if (this.hairMeshes[file]) return this.hairMeshes[file];
    const gl = Assets.models['people/' + file]; if (!gl) return null; let src = null; gl.scene.traverse(o => { if (o.isSkinnedMesh && !src) src = o; }); if (!src) return null;
    if (!this.hairMat) { this.hairMat = src.material.clone(); this.hairMat.roughness = 0.75; }
    const m = new THREE.SkinnedMesh(src.geometry, this.hairMat); m.frustumCulled = false; m.castShadow = this.shadows;
    m.bind(new THREE.Skeleton(src.skeleton.bones.map(b => this.bonesBy[b.name] || this.bonesBy.Head), src.skeleton.boneInverses), src.bindMatrix);
    this.root3.add(m); m.layers.set(1); this.hairMeshes[file] = m; return m;
  }
  setLook(l) {
    const u = this.u; u.uShirt.value.set(l.shirt || '#3a6a9a'); u.uPants.value.set(l.pants || '#2b3a55'); u.uShoes.value.set(l.shoes || '#222');
    const sk = col(l.skin || '#e0ac84'); u.uSkin.value.setRGB(clamp(sk.r * 1.6, 0.35, 1.35), clamp(sk.g * 1.75, 0.3, 1.3), clamp(sk.b * 2.0, 0.25, 1.3));
    u.uSleeve.value = l.longSleeve ? 0.69 : 0.33; u.uPantsEnd.value = l.shorts ? 0.52 : 0.1;
    const style = l.hairStyle || 'short'; for (const k of Object.keys(this.hairMeshes)) this.hairMeshes[k].visible = false;
    const h = this.hairFor(style); if (h) h.visible = true; if (this.hairMat) this.hairMat.color.set(l.hair || '#2a1a10').multiplyScalar(2.2);
    if (!this.female && l.beard) { const b = this.hairFor('beard'); if (b) b.visible = true; }
    if (this.brows) this.brows.material.color.set(l.hair || '#2a1a10').multiplyScalar(2.2);
    this.cap.visible = style === 'cap'; if (this.cap.visible) this.cap.material.color.set(l.capColor || l.hair || '#223355'); this.glasses.visible = !!l.glasses;
  }
  setWeapon(w) { const id = w && !w.melee ? w.id : null; if (id === this.gunId) return; this.gunId = id; this.gun.visible = !!id; if (id) { this.gun.geometry = gunGeo(id); this.gunLen = GUN_LEN[id]; } }
  muzzle(out) { out.set(0, -this.gunLen, 0.06); this.group.updateMatrixWorld(true); return this.gun.localToWorld(out); }
  set visibleMesh(v) { this.root3.visible = v; }
  animate(dt, s) { LowHumanoid.prototype.animate.call(this, dt, s); this.retarget(); }
  // Drehungen vom Hilfsskelett aufs echte Skelett übertragen
  retarget() {
    if (!this.root3.visible) return; const B = this.B;
    // Hilfsskelett: Modellraum-Rotationen (Kette ab root)
    for (const b of this.bones) { const p = b.parent; if (!p || !p.isBone) b.userData.mq = (b.userData.mq || new THREE.Quaternion()).copy(b.quaternion); else b.userData.mq = (b.userData.mq || new THREE.Quaternion()).multiplyQuaternions(p.userData.mq, b.quaternion); }
    for (const gb of this.order) { const ud = gb.userData, m = this.map.get(gb), parentQ = gb.parent && gb.parent.isBone ? gb.parent.userData.modelQ : this.armQ;
      if (m) { _hq1.copy(m.drv.userData.mq); if (m.fix) _hq1.multiply(m.fix); _hq1.multiply(ud.bindModelQ); ud.modelQ.copy(_hq1); gb.quaternion.copy(parentQ).invert().multiply(_hq1); }
      else { ud.modelQ.multiplyQuaternions(parentQ, ud.bindLocalQ); gb.quaternion.copy(ud.bindLocalQ); } }
    // Becken-Höhe (Hocken, Sitzen) und Wurzel-Versatz übernehmen
    const pel = this.bonesBy.pelvis, rootB = this.bonesBy.root, dy = B.hips.position.y - 0.98; _hv1.copy(this.pelvisBind); _hv1.y += dy;
    this._rootM.compose(rootB.position, rootB.quaternion, rootB.scale); _hm1.multiplyMatrices(this.armMatrix, this._rootM).invert(); pel.position.copy(_hv1.applyMatrix4(_hm1));
    this.root3.position.y = B.root.position.y;
  }
}

// ---------- FAHRZEUG-HILFEN ----------
function textPanel(text, color, bg, w, h) { const tex = canvasTex(256, 64, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 256, 64); g.fillStyle = color; g.font = 'bold 40px Arial Black, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34); }, { repeat: false }); return new THREE.Mesh(new THREE.PlaneGeometry(w, h), lam({ map: tex, transparent: bg === 'rgba(0,0,0,0)' })); }
const tailMatNew = () => lam({ color: 0x5a0808, emissive: 0xff1a10, emissiveIntensity: 0.5, flatShading: true });
const _wheelCache = {};
function wheelGeos(wr, tw, style = 0) {
  const key = wr + '_' + tw + '_' + style; return _wheelCache[key] || (_wheelCache[key] = (() => {
    const k = new Kit(), rr = wr * (style === 2 ? 0.55 : 0.64);
    k.cyl('tire', wr, tw, 0, 0, 0, '#1b1b1d', 'x', 14); k.cyl('tire', wr * 0.86, tw + 0.03, 0, 0, 0, '#262628', 'x', 14);
    k.cyl('rim', rr, tw + 0.05, 0, 0, 0, null, 'x', 12);
    const ns = style === 1 ? 6 : style === 2 ? 8 : 5; for (let i = 0; i < ns; i++) k.add('rim', CG.box(), tw / 2 + 0.03, 0, 0, 0.03, rr * 1.75, style === 2 ? 0.035 : 0.07, null, i / ns * Math.PI, 0, 0);
    k.cyl('rim', rr * 0.3, tw + 0.08, 0, 0, 0, null, 'x', 8);
    return { tire: k.geo('tire'), rim: k.geo('rim') }; })());
}
// Kabine: Dach, Säulen & Rahmen (Lack) + Scheiben (Glas), beidseitig → Insassen sichtbar
function cabin(k, bw, tw, zb0, zb1, zt0, zt1, y0, y1, opt = {}) {
  const c = V3(0, (y0 + y1) / 2, (zb0 + zb1) / 2);
  const both = (key, pts) => { const fc = pts.reduce((a, p) => a.add(p), V3()).multiplyScalar(1 / pts.length); k.raw(key, polyGeo(pts, c)); k.raw(key, polyGeo(pts, V3().subVectors(fc, c).multiplyScalar(2).add(c))); };
  const face = (b0, b1, t1, t0, wins) => { const L = (u, v) => V3().lerpVectors(V3().lerpVectors(b0, b1, u), V3().lerpVectors(t0, t1, u), v), R = (u0, u1, v0, v1, key) => both(key, [L(u0, v0), L(u1, v0), L(u1, v1), L(u0, v1)]);
    const v0 = wins[0][2], v1 = wins[0][3]; R(0, 1, 0, v0, 'paint'); R(0, 1, v1, 1, 'paint'); let u = 0;
    for (const w of wins) { if (w[0] > u) R(u, w[0], v0, v1, 'paint'); R(w[0], w[1], v0, v1, 'glass'); u = w[1]; } if (u < 1) R(u, 1, v0, v1, 'paint'); };
  const bl = (x, z) => V3(x, y0, z), tl = (x, z) => V3(x, y1, z), BW = bw / 2, TW = tw / 2;
  face(bl(-BW, zb1), bl(BW, zb1), tl(TW, zt1), tl(-TW, zt1), [[0.07, 0.93, 0.05, 0.93]]); // Frontscheibe
  face(bl(BW, zb0), bl(-BW, zb0), tl(-TW, zt0), tl(TW, zt0), [[0.09, 0.91, 0.1, 0.9]]); // Heckscheibe
  const sp = opt.split ?? 0.5;
  for (const s of [1, -1]) face(bl(s * BW, zb0), bl(s * BW, zb1), tl(s * TW, zt1), tl(s * TW, zt0), opt.twoDoor ? [[0.07, 0.93, 0.1, 0.88]] : [[0.06, sp - 0.03, 0.1, 0.88], [sp + 0.03, 0.94, 0.1, 0.88]]);
  both('paint', [tl(-TW, zt0), tl(TW, zt0), tl(TW, zt1), tl(-TW, zt1)]);
}
// Seitenprofil (z,y) extrudiert über die Breite, mit facettierten Kanten
function profileBody(pts, W, bev = 0.06) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); s.lineTo(pts[0][0], pts[0][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: W - bev * 2, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 1 }); g.translate(0, 0, -(W - bev * 2) / 2); g.rotateY(-Math.PI / 2); return nonIdx(g);
}
function archPts(zc, yb, r, ywc, front) { const p = []; // Radlauf (oben halbrund)
  const a = front ? [[zc + r, yb], [zc + r, ywc]] : [[zc + r, yb], [zc + r, ywc]]; p.push(...a); for (let i = 1; i < 6; i++) { const t = i / 6 * Math.PI; p.push([zc + Math.cos(t) * r, ywc + Math.sin(t) * r]); } p.push([zc - r, ywc], [zc - r, yb]); return p; }

// ---------- AUTOS (echte 3D-Modelle, Räder zum Drehen abgetrennt) ----------
// Zielmaße in Metern (realistische Proportionen) + Radachsen/Radius im Modellmaß (aus der Geometrie ermittelt)
const CAR_MODELS = {
  sedan:   { m: 'cars/normalcar1', L: 4.75, W: 1.86, H: 1.42, zf: 1.195, zr: -1.24, r: 0.27, xi: 0.57 },
  compact: { m: 'cars/normalcar2', L: 4.15, W: 1.80, H: 1.42, zf: 1.04, zr: -0.955, r: 0.25, xi: 0.55 },
  taxi:    { m: 'cars/taxi', L: 4.85, W: 1.88, H: 1.52, zf: 1.30, zr: -1.14, r: 0.26, xi: 0.57 },
  police:  { m: 'cars/cop', L: 4.95, W: 1.95, H: 1.52, zf: 1.14, zr: -1.155, r: 0.28, xi: 0.55 },
  sport:   { m: 'cars/sportscar', L: 4.5, W: 1.96, H: 1.24, zf: 1.19, zr: -1.25, r: 0.26, xi: 0.58 },
  muscle:  { m: 'cars/sportscar2', L: 4.8, W: 1.96, H: 1.34, zf: 1.19, zr: -1.32, r: 0.28, xi: 0.59 },
  suv:     { m: 'cars/suv', L: 4.85, W: 2.0, H: 1.8, zf: 1.32, zr: -1.25, r: 0.33, xi: 0.62 },
};
const _carMat = {};
const carMat = {
  paint(hex) { const k = 'p' + hex; return _carMat[k] || (_carMat[k] = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.55, roughness: 0.28, envMapIntensity: 1.1 })); },
  get dark() { return _carMat.dark || (_carMat.dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.55, metalness: 0.2 })); },
  get tire() { return _carMat.tire || (_carMat.tire = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92, metalness: 0 })); },
  get chrome() { return _carMat.chrome || (_carMat.chrome = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.25, metalness: 0.95 })); },
  get glass() { return _carMat.glass || (_carMat.glass = new THREE.MeshStandardMaterial({ color: 0x0a1016, roughness: 0.04, metalness: 0.75, transparent: true, opacity: 0.82, envMapIntensity: 1.4 })); },
  get head() { return _carMat.head || (_carMat.head = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d0, emissiveIntensity: 0.6, roughness: 0.2 })); },
};
const CarLib = {
  cache: {},
  // Geometrien eines Typs vorbereiten: Skalierung auf Zielmaße, Boden auf y=0, Räder per Dreiecks-Klassifikation abtrennen
  prep(type) {
    if (this.cache[type] !== undefined) return this.cache[type]; const D = CAR_MODELS[type], gl = D && Assets.models[D.m]; if (!gl) return (this.cache[type] = null);
    gl.scene.updateMatrixWorld(true); const raw = []; const bb = new THREE.Box3();
    gl.scene.traverse(o => { if (!o.isMesh) return; let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); g.computeBoundingBox(); bb.union(g.boundingBox); raw.push([o.name || '', g]); });
    const sx = D.W / (bb.max.x - bb.min.x), sy = D.H / (bb.max.y - bb.min.y), sz = D.L / (bb.max.z - bb.min.z), cx = (bb.max.x + bb.min.x) / 2, cz = (bb.max.z + bb.min.z) / 2, y0 = bb.min.y;
    const wc = []; for (const [zz, front] of [[D.zf, 1], [D.zr, 0]]) for (const side of [1, -1]) wc.push({ side, front, zc: zz, yc: y0 + D.r, r: D.r });
    const groups = {}, wheelTris = wc.map(() => []), add = (key, arr) => (groups[key] || (groups[key] = [])).push(...arr);
    for (const [name, g] of raw) {
      const P = g.attributes.position.array, N = g.attributes.normal.array, key = /window/i.test(name) ? 'glass' : /tail/i.test(name) ? 'tail' : /headlight/i.test(name) ? 'head' : /bluelight/i.test(name) ? 'barB' : /whitelight/i.test(name) ? 'barR' : /black/i.test(name) ? 'dark' : /grey/i.test(name) ? 'grey' : /white/i.test(name) && type === 'police' ? 'white' : 'paint';
      const canWheel = key === 'dark' || key === 'grey';
      for (let t = 0; t < P.length; t += 9) { const tri = Array.from(P.slice(t, t + 9)), nor = Array.from(N.slice(t, t + 9));
        if (canWheel) { const mx = (tri[0] + tri[3] + tri[6]) / 3, my = (tri[1] + tri[4] + tri[7]) / 3, mz = (tri[2] + tri[5] + tri[8]) / 3; let hit = -1;
          for (let w = 0; w < 4; w++) { const W = wc[w]; if (Math.sign(mx - cx) !== W.side || Math.abs(mx - cx) < D.xi) continue; if (Math.hypot(my - W.yc, mz - W.zc) < W.r * 1.12) { hit = w; break; } }
          if (hit >= 0) { wheelTris[hit].push([tri, nor, key]); continue; } }
        add(key, [[tri, nor]]); } }
    const mkGeo = (list, tx = 0, ty = 0, tz = 0) => { const p = new Float32Array(list.length * 9), n = new Float32Array(list.length * 9);
      list.forEach(([tri, nor], i) => { for (let v = 0; v < 3; v++) { p[i * 9 + v * 3] = (tri[v * 3] - cx) * sx - tx; p[i * 9 + v * 3 + 1] = (tri[v * 3 + 1] - y0) * sy - ty; p[i * 9 + v * 3 + 2] = (tri[v * 3 + 2] - cz) * sz - tz; n[i * 9 + v * 3] = nor[v * 3] / sx; n[i * 9 + v * 3 + 1] = nor[v * 3 + 1] / sy; n[i * 9 + v * 3 + 2] = nor[v * 3 + 2] / sz; } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); g.normalizeNormals(); g.computeBoundingSphere(); return g; };
    const body = {}; for (const [k, list] of Object.entries(groups)) if (list.length) body[k] = mkGeo(list);
    const wheels = wc.map((W, i) => { const px = (W.side * (D.xi + 0.1)) * sx, py = D.r * sy, pz = (W.zc - cz) * sz; const tire = wheelTris[i].filter(t => t[2] === 'dark'), rim = wheelTris[i].filter(t => t[2] === 'grey');
      return { x: px, y: py, z: pz, front: !!W.front, tire: tire.length ? mkGeo(tire, px, py, pz) : null, rim: rim.length ? mkGeo(rim, px, py, pz) : null }; });
    // Statische Variante (für geparkte Deko-Autos): alles inkl. Räder in Weltmaßen
    const stat = []; for (const [k, g] of Object.entries(body)) stat.push({ key: k, geo: g });
    wheels.forEach(w => { const T = new THREE.Matrix4().makeTranslation(w.x, w.y, w.z); if (w.tire) stat.push({ key: 'tire', geo: w.tire.clone().applyMatrix4(T) }); if (w.rim) stat.push({ key: 'grey', geo: w.rim.clone().applyMatrix4(T) }); });
    return (this.cache[type] = { D, body, wheels, stat, wr: D.r * sy, L: D.L, W: D.W, H: D.H });
  },
  // Für den Weltbau: Teile mit Welt-Material-Schlüsseln
  staticParts(model) { const type = Object.keys(CAR_MODELS).find(t => CAR_MODELS[t].m === 'cars/' + model) || 'sedan', P = this.prep(type); if (!P) return null;
    const map = { paint: ['carpaint', null, true], dark: ['solid', '#151516'], tire: ['solid', '#141414'], grey: ['metal', '#9a9ea4'], glass: ['carglass', '#0c1218'], head: ['glow', '#d8d4c8'], tail: ['glow', '#6a0c0c'], white: ['carpaint', '#f2f2f2'], barB: ['glow', '#1030a0'], barR: ['glow', '#a01010'] };
    return P.stat.map(s => { const m = map[s.key] || map.paint; return { geo: s.geo, mat: m[0], color: m[1] || '#ffffff', paint: !!m[2], m: new THREE.Matrix4() }; }); },
  build(type, color) {
    const P = this.prep(type); if (!P) return null; const grp = new THREE.Group(), body = new THREE.Group(); grp.add(body);
    const add = (geo, mat, cast = true) => { if (!geo) return null; const m = new THREE.Mesh(geo, mat); m.castShadow = cast; body.add(m); return m; };
    const paint = add(P.body.paint, carMat.paint(color)); add(P.body.dark, carMat.dark); add(P.body.grey, carMat.chrome); add(P.body.glass, carMat.glass, false); add(P.body.head, carMat.head, false);
    add(P.body.white, carMat.paint('#f2f2f2')); const tailMat = new THREE.MeshStandardMaterial({ color: 0x3a0505, emissive: 0xff1810, emissiveIntensity: 0.5, roughness: 0.3 }); add(P.body.tail, tailMat, false);
    let bar = null; if (P.body.barB || P.body.barR) { bar = [new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1010, emissiveIntensity: 0.2 }), new THREE.MeshStandardMaterial({ color: 0x000040, emissive: 0x1050ff, emissiveIntensity: 0.2 })]; add(P.body.barR, bar[0], false); add(P.body.barB, bar[1], false); }
    const wheels = P.wheels.map(w => { const piv = new THREE.Group(); piv.position.set(w.x, w.y, w.z); const spin = new THREE.Group(); piv.add(spin);
      if (w.tire) { const t = new THREE.Mesh(w.tire, carMat.tire); t.castShadow = true; spin.add(t); } if (w.rim) spin.add(new THREE.Mesh(w.rim, carMat.chrome)); grp.add(piv); return { piv, spin, front: w.front, x: w.x, z: w.z, rest: w.y }; });
    if (type === 'taxi') { const p = textPanel('TAXI', '#111', '#ffe28a', 0.62, 0.18); p.position.set(0, P.H + 0.02, -0.25); body.add(p); }
    const blinkers = { L: [], R: [] }; if (!carMat.blink) { carMat.blink = new THREE.MeshBasicMaterial({ color: 0xffa020, toneMapped: false }); carMat.blinkGeo = new THREE.BoxGeometry(0.16, 0.07, 0.05); }
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const b = new THREE.Mesh(carMat.blinkGeo, carMat.blink); b.position.set(sx * (P.W / 2 - 0.14), P.H * (sz > 0 ? 0.47 : 0.55), sz * (P.L / 2 - 0.02)); b.visible = false; body.add(b); (sx > 0 ? blinkers.L : blinkers.R).push(b); }
    const seatY = Math.max(0.18, P.H - 1.05);
    return { group: grp, body, paint, wheels, tailMat, bar, blinkers, seat: V3(0.38, seatY, -0.15), len: P.L, wid: P.W, height: P.H, wr: P.wr, pose: 'sit' };
  },
};

// ---------- MOTORRAD ----------
let _bikeGeo = null;
function buildBike(color) {
  if (!_bikeGeo) { const k = new Kit(), dark = '#1b1c20', grey = '#4a4d54', chrome = '#c8ccd2';
    // Rahmen & Schwinge
    k.box('vc', 0.08, 0.08, 0.95, 0, 0.66, 0.05, grey, -0.35); k.box('vc', 0.07, 0.07, 0.75, 0.12, 0.42, -0.42, grey, 0.12); k.box('vc', 0.07, 0.07, 0.75, -0.12, 0.42, -0.42, grey, 0.12);
    // Motor, Zylinder, Kühler, Auspuff
    k.box('vc', 0.32, 0.32, 0.46, 0, 0.42, 0.06, '#5a5e66'); k.box('vc', 0.28, 0.22, 0.2, 0, 0.62, 0.2, grey, 0.3); k.box('vc', 0.36, 0.28, 0.05, 0, 0.6, 0.38, dark, 0.2);
    for (let i = 0; i < 4; i++) k.box('vc', 0.34, 0.02, 0.04, 0, 0.18 + 0.06 * i + 0.3, 0.39, '#2a2c30', 0.2);
    k.cyl('chrome', 0.05, 0.6, 0.14, 0.28, -0.2, null, 'z', 8, 0.08); k.cyl('chrome', 0.07, 0.4, 0.14, 0.5, -0.62, null, 'z', 10, -0.35); k.cyl('vc', 0.055, 0.02, 0.14, 0.57, -0.82, dark, 'z', 10, -0.35);
    // Tank, Verkleidung, Heck
    k.add('paint', CG.frus(0.75, 0.7, -0.08), 0, 0.92, 0.18, 0.4, 0.24, 0.6);
    k.add('paint', CG.frus(0.55, 0.45, -0.1), 0, 0.85, 0.66, 0.42, 0.42, 0.42, null, Math.PI / 2 - 0.35, 0, 0);
    k.box('paint', 0.06, 0.32, 0.6, 0.2, 0.66, 0.5, null, -0.2); k.box('paint', 0.06, 0.32, 0.6, -0.2, 0.66, 0.5, null, -0.2);
    k.add('paint', CG.frus(0.5, 0.5, 0.15), 0, 0.98, -0.56, 0.3, 0.2, 0.5, null, -0.25, 0, 0);
    k.box('vc', 0.28, 0.08, 0.5, 0, 0.92, -0.25, '#2a2a2e', 0.05); k.box('vc', 0.22, 0.06, 0.3, 0, 1.0, -0.6, '#2a2a2e', -0.25);
    k.raw('glass', polyGeo([V3(-0.16, 1.02, 0.78), V3(0.16, 1.02, 0.78), V3(0.11, 1.24, 0.62), V3(-0.11, 1.24, 0.62)], V3(0, 0.9, 0.5)));
    // Gabel, Lenker, Spiegel
    for (const s of [1, -1]) { k.cyl('chrome', 0.03, 0.72, s * 0.1, 0.62, 0.86, null, 'y', 6, -0.42); k.box('vc', 0.045, 0.045, 0.16, s * 0.25, 1.15, 0.41, dark, 0, 0.25 * s); k.box('vc', 0.025, 0.14, 0.025, s * 0.2, 1.2, 0.6, dark); k.box('vc', 0.1, 0.06, 0.02, s * 0.2, 1.28, 0.6, '#9fb0c0'); }
    k.box('vc', 0.5, 0.035, 0.035, 0, 1.15, 0.42, dark); k.box('vc', 0.06, 0.06, 0.2, 0.16, 0.52, -0.12, dark); k.box('vc', 0.06, 0.06, 0.2, -0.16, 0.52, -0.12, dark); // Fußrasten
    k.box('vc', 0.18, 0.04, 0.4, 0, 0.62, 0.95, dark, -0.4); k.box('vc', 0.18, 0.04, 0.35, 0, 0.6, -0.72, dark, 0.5); // Schutzbleche
    k.box('head', 0.16, 0.08, 0.05, 0, 0.95, 0.88, null, -0.35); k.box('tail', 0.14, 0.05, 0.04, 0, 1.0, -0.84);
    k.box('vc', 0.06, 0.05, 0.04, 0.09, 0.92, 0.86, '#ffa020'); k.box('vc', 0.06, 0.05, 0.04, -0.09, 0.92, 0.86, '#ffa020');
    _bikeGeo = k.geos(); _bikeGeo.wheel = wheelGeos(0.31, 0.15, 2); }
  const grp = new THREE.Group(), body = new THREE.Group(); grp.add(body); const G2 = _bikeGeo;
  const add = (g, m, cast = true) => { if (!g) return; const mm = new THREE.Mesh(g, m); mm.castShadow = cast; body.add(mm); return mm; };
  add(G2.paint, paintMat(color)); add(G2.vc, MAT.vehVC); add(G2.chrome, MAT.chrome); add(G2.glass, MAT.glassDark, false); add(G2.head, MAT.headlight, false); const tailMat = tailMatNew(); add(G2.tail, tailMat, false);
  const wr = 0.31, wheels = [];
  for (const [z, front] of [[0.74, 1], [-0.72, 0]]) { const piv = new THREE.Group(); piv.position.set(0, wr, z); const spin = new THREE.Group(); piv.add(spin); const t = new THREE.Mesh(G2.wheel.tire, MAT.tire); t.castShadow = true; spin.add(t); spin.add(new THREE.Mesh(G2.wheel.rim, MAT.rim));
    const disc = new THREE.Mesh(CG.cyl(12), MAT.chrome); disc.scale.set(0.38, 0.015, 0.38); disc.rotation.z = Math.PI / 2; disc.position.x = 0.09; spin.add(disc); grp.add(piv); wheels.push({ piv, spin, front: !!front, x: 0, z, rest: wr }); }
  return { group: grp, body, paint: null, wheels, tailMat, seat: V3(0, 0.95, -0.3), len: 2.1, wid: 0.8, height: 1.3, wr, pose: 'bike' };
}

// ---------- BOOTE ----------
// Rumpf als Loft: Spanten von Heck (-L/2) bis Bug (+L/2)
function hullGeos(L, W, top, keel, o = {}) {
  const N = 10, sides = [], deck = [], bow = o.bow ?? 0.55;
  for (let i = 0; i <= N; i++) { const t = i / N, z = -L / 2 + t * L;
    const hw = W / 2 * (t < bow ? 1 - (bow - t) * (o.sternTaper ?? 0.12) : Math.max(0.0, 1 - Math.pow((t - bow) / (1 - bow), 1.6)));
    const ys = top + Math.pow(t, 2.6) * (o.sheer ?? 0.4), yk = -keel * (t > 0.65 ? 1 - (t - 0.65) / 0.35 * 0.75 : 1), yc = lerp(yk, ys, 0.42);
    sides.push({ z, pts: [[-hw, ys], [-hw * 0.97, yc], [-hw * 0.5, lerp(yk, yc, 0.35)], [0, yk], [hw * 0.5, lerp(yk, yc, 0.35)], [hw * 0.97, yc], [hw, ys]] });
    deck.push({ z, pts: [[-hw * 0.96, ys - 0.06], [hw * 0.96, ys - 0.06]] }); }
  return { hull: loftGeo(sides, { closed: false, caps: false }), deck: loftGeo(deck, { closed: false, caps: false, inside: [0, -1] }), transom: polyGeo(sides[0].pts.map(([x, y]) => V3(x, y, -L / 2)), V3(0, top * 0.5, -L / 2 + 1)) };
}
const _boatCache = {};
function boatGeos(type) {
  if (_boatCache[type]) return _boatCache[type];
  const S = CFG.VEHICLES[type], L = S.len, W = S.wid, k = new Kit(), white = '#f6f6f2', dark = '#1d1e22', teak = '#b0804a', chrome = '#d0d4d8'; let seat, pose = 'sit', height = 2;
  const hull = (top, keel, hullC, o) => { const h = hullGeos(L, W, top, keel, o); hullC === 'paint' ? k.raw('paint', h.hull) : k.raw('vc', h.hull, hullC); k.raw('vc', h.deck, o && o.deckC || teak); hullC === 'paint' ? k.raw('paint', h.transom) : k.raw('vc', h.transom, hullC); };
  if (type === 'jetski') {
    hull(0.42, 0.28, 'paint', { bow: 0.5, sheer: 0.25, deckC: '#2a2c30' }); k.box('vc', W * 0.75, 0.06, L * 0.6, 0, 0.12, -0.1, '#f4f4f0');
    k.add('vc', CG.frus(0.8, 0.8), 0, 0.5, -0.35, 0.42, 0.22, 1.1, '#202226'); k.add('paint', CG.frus(0.6, 0.6, 0.1), 0, 0.55, 0.55, 0.62, 0.3, 0.7);
    k.box('vc', 0.7, 0.04, 0.05, 0, 0.88, 0.45, dark); k.cyl('vc', 0.035, 0.42, 0, 0.7, 0.5, dark, 'y', 6, -0.4); k.box('vc', 0.14, 0.04, 0.4, 0.38, 0.28, -0.4, dark); k.box('vc', 0.14, 0.04, 0.4, -0.38, 0.28, -0.4, dark);
    k.box('head', 0.18, 0.06, 0.04, 0, 0.6, 0.92); k.box('tail', 0.14, 0.05, 0.04, 0, 0.45, -L / 2 + 0.02);
    seat = V3(0, 0.6, -0.35); pose = 'bike'; height = 1.2;
  } else if (type === 'speedboat') {
    hull(0.95, 0.55, white, { bow: 0.55, sheer: 0.35 });
    for (const s of [1, -1]) { k.box('paint', 0.04, 0.2, L * 0.62, s * (W / 2 - 0.02), 0.6, -0.4); k.box('paint', 0.04, 0.08, L * 0.62, s * (W / 2 - 0.02), 0.36, -0.4); }
    k.box('vc', W * 0.82, 0.45, 1.3, 0, 1.08, -0.8, '#f0ece2'); k.box('vc', W * 0.82, 0.55, 0.15, 0, 1.4, -1.42, '#f0ece2');
    k.box('vc', 0.6, 0.45, 0.5, 0.4, 1.1, 0.35, '#f0ece2'); k.box('vc', 0.6, 0.55, 0.12, 0.4, 1.4, 0.08, '#f0ece2'); k.box('vc', 0.5, 0.7, 0.6, -0.4, 1.15, 0.5, white);
    k.cyl('vc', 0.16, 0.03, 0.4, 1.6, 0.62, dark, 'z', 10, -0.6); k.box('vc', 0.45, 0.25, 0.3, 0.4, 1.45, 0.7, dark, -0.4);
    k.raw('glass', polyGeo([V3(-W * 0.44, 1.15, 1.25), V3(W * 0.44, 1.15, 1.25), V3(W * 0.38, 1.6, 0.9), V3(-W * 0.38, 1.6, 0.9)], V3(0, 1, 0)));
    k.box('vc', 0.5, 1.0, 0.45, 0, 0.6, -L / 2 - 0.25, '#202226'); k.box('paint', 0.55, 0.45, 0.55, 0, 1.25, -L / 2 - 0.25); k.box('vc', 0.12, 0.6, 0.25, 0, 0.1, -L / 2 - 0.28, '#2a2c30');
    for (const s of [1, -1]) k.box('chrome', 0.04, 0.04, 1.6, s * (W / 2 - 0.1), 1.25, 2.1);
    k.box('head', 0.2, 0.1, 0.05, 0, 1.0, L / 2 - 0.15); k.box('tail', 0.15, 0.1, 0.05, 0, 1.1, -L / 2 + 0.05);
    seat = V3(0.4, 1.32, 0.35); height = 1.8;
  } else if (type === 'yacht') {
    hull(2.2, 1.3, white, { bow: 0.6, sheer: 0.6, deckC: teak }); for (const s of [1, -1]) { k.box('vc', 0.04, 0.35, L * 0.7, s * (W / 2 - 0.02), 1.3, -0.8, '#1d2b4a'); for (let i = 0; i < 6; i++) k.cyl('vc', 0.12, 0.05, s * (W / 2 + 0.01), 1.3, -L / 2 + 3 + i * 1.6, '#1d2b4a', 'x', 8); }
    k.add('vc', CG.frus(0.92, 0.9, -0.02), 0, 3.3, -1.4, W * 0.8, 2.0, L * 0.56, white); k.add('vc', CG.frus(0.9, 0.85, -0.03), 0, 5.0, -2.3, W * 0.68, 1.5, L * 0.34, white); k.add('vc', CG.frus(0.85, 0.8), 0, 6.15, -2.6, W * 0.5, 0.8, L * 0.16, white);
    for (const s of [1, -1]) { k.box('glass', 0.02, 0.8, L * 0.48, s * W * 0.395, 3.35, -1.4); k.box('glass', 0.02, 0.6, L * 0.28, s * W * 0.335, 5.05, -2.3); }
    { const zf = (y) => -1.4 + lerp(L * 0.28, L * 0.28 * 0.9 - L * 0.56 * 0.02 * 1, (y - 2.3) / 2.0) + 0.03; k.raw('glass', polyGeo([V3(-W * 0.36, 2.6, zf(2.6)), V3(W * 0.36, 2.6, zf(2.6)), V3(W * 0.33, 3.9, zf(3.9)), V3(-W * 0.33, 3.9, zf(3.9))], V3(0, 3, -1.4))); }
    k.box('vc', 0.9, 0.9, 0.5, 0.6, 6.2, 0.35, white); k.cyl('vc', 0.2, 0.04, 0.6, 6.7, 0.1, '#2a2c30', 'z', 10, -0.6); for (const sx of [0.6, -0.4]) { k.box('vc', 0.55, 0.2, 0.55, sx, 5.85, -0.4, '#f0ece2'); k.box('vc', 0.55, 0.6, 0.12, sx, 6.15, -0.7, '#f0ece2'); }
    k.cyl('chrome', 0.08, 3.4, 0, 8.2, -3.2, null); k.box('chrome', 1.6, 0.08, 0.08, 0, 8.6, -3.2); k.box('vc', 1.4, 0.15, 0.3, 0, 7.1, -3.2, white); k.cyl('vc', 0.4, 0.4, 0, 7.4, -2.5, white, 'y', 10);
    for (const s of [1, -1]) { k.box('chrome', 0.04, 0.04, L * 0.8, s * (W / 2 - 0.15), 2.95, 0.2); for (let i = 0; i < 12; i++) k.box('chrome', 0.03, 0.7, 0.03, s * (W / 2 - 0.15), 2.6, -L * 0.38 + i * L * 0.068); }
    k.box('vc', W * 0.6, 0.25, 2.2, 0, 2.3, L / 2 - 3.5, '#f0ece2'); k.box('vc', W * 0.8, 0.15, 1.6, 0, 0.6, -L / 2 - 0.6, teak);
    k.box('head', 0.25, 0.12, 0.05, 0, 2.2, L / 2 - 0.3); k.box('tail', 0.2, 0.12, 0.05, 0, 2.2, -L / 2 + 0.02);
    seat = V3(0.6, 5.88, -0.4); height = 6.6;
  } else { // Fischerboot
    hull(1.6, 1.0, 'paint', { bow: 0.58, sheer: 0.55, deckC: '#8a7a64' }); for (const s of [1, -1]) k.box('vc', 0.04, 0.25, L * 0.85, s * (W / 2 - 0.01), 1.45, 0.1, white);
    k.add('vc', CG.frus(0.92, 0.9), 0, 2.7, 1.3, W * 0.66, 2.2, 3.0, white); k.box('vc', W * 0.74, 0.18, 3.3, 0, 3.85, 1.3, '#2a6f97');
    for (const s of [1, -1]) { k.box('glass', 0.02, 0.6, 2.4, s * W * 0.32, 3.25, 1.3); } k.raw('glass', polyGeo([V3(-W * 0.3, 2.95, 2.81), V3(W * 0.3, 2.95, 2.81), V3(W * 0.29, 3.55, 2.78), V3(-W * 0.29, 3.55, 2.78)], V3(0, 3, 1)));
    k.cyl('vc', 0.1, 5.5, 0, 4.4, -1.6, '#2a2c30'); k.cyl('vc', 0.06, 4.6, 0, 4.0, -3.0, '#2a2c30', 'y', 6, 0.9); for (const s of [1, -1]) k.cyl('vc', 0.05, 5, s * 1.9, 4.6, -1.6, '#2a2c30', 'y', 6, 0, 0, s * 1.0);
    k.cyl('vc', 0.6, 1.2, 0, 2.2, -3.2, '#4a6a3a', 'x', 10); k.add('vc', CG.tor(0.25), 1.75, 2.6, 0.5, 0.6, 0.6, 0.6, '#ff6a20', 0, Math.PI / 2, 0); k.add('vc', CG.tor(0.25), -1.75, 2.6, -1.5, 0.6, 0.6, 0.6, '#ff6a20', 0, Math.PI / 2, 0);
    for (let i = 0; i < 4; i++) k.box('vc', 0.6, 0.5, 0.6, (i % 2 ? 0.5 : -0.5), 1.85, -2 - Math.floor(i / 2) * 0.7, '#3a6a9a');
    k.box('head', 0.2, 0.1, 0.05, 0, 2.2, L / 2 - 0.5); k.box('tail', 0.15, 0.1, 0.05, 0, 2.0, -L / 2 + 0.02);
    seat = V3(0, 1.55, 1.2); height = 3.4;
  }
  _boatCache[type] = { geos: k.geos(), seat, pose, height }; return _boatCache[type];
}
function buildBoat(type, color) {
  const S = CFG.VEHICLES[type], B2 = boatGeos(type), grp = new THREE.Group(), body = new THREE.Group(); grp.add(body);
  const add = (g, m, cast = true) => { if (!g) return; const mm = new THREE.Mesh(g, m); mm.castShadow = cast; body.add(mm); return mm; };
  const G2 = B2.geos; add(G2.paint, paintMat(color)); add(G2.vc, MAT.vehVC); add(G2.chrome, MAT.chrome); add(G2.glass, MAT.glassDark, false); add(G2.head, MAT.headlight, false); const tailMat = tailMatNew(); add(G2.tail, tailMat, false);
  return { group: grp, body, paint: null, wheels: [], tailMat, seat: B2.seat.clone(), len: S.len, wid: S.wid, height: B2.height, pose: B2.pose };
}

// ---------- LUFTFAHRZEUGE ----------
function wingGeo(pts, th) { const s = new THREE.Shape(); s.moveTo(pts[0][0], -pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], -p[1]); const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th * 0.4, bevelSize: th * 0.4, bevelSegments: 1 }); g.translate(0, 0, -th / 2); g.rotateX(-Math.PI / 2); return nonIdx(g); }
function mirrorX(g) { const h = g.clone(); h.scale(-1, 1, 1); const p = h.attributes.position, n = h.attributes.normal; for (let i = 0; i < p.count; i += 3) { for (const a of [p, n]) { const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1); a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); } } return h; }
const _airCache = {};
function airGeos(type) {
  if (_airCache[type]) return _airCache[type]; const k = new Kit(), dark = '#1d1e22', grey = '#5a5f66', chrome = '#c8ccd2';
  const fus = (secs, key = 'paint') => k.raw(key, loftGeo(secs.map(([z, rx, ry, cy, n = 10]) => ({ z, pts: ring(n, Math.max(rx, 0.005), Math.max(ry, 0.005), 0, cy, Math.PI / n) }))));
  if (type === 'jet') {
    fus([[-7.9, 0.5, 0.45, 1.75], [-6.8, 0.82, 0.62, 1.75], [-3, 1.02, 0.78, 1.72], [1, 1.0, 0.78, 1.72], [3.4, 0.86, 0.72, 1.78], [5.6, 0.55, 0.52, 1.75], [7.0, 0.28, 0.3, 1.72], [8.0, 0.03, 0.04, 1.7]]);
    const wing = wingGeo([[0.8, -4.6], [5.4, -3.6], [5.4, -2.7], [0.8, 1.6]], 0.14); k.raw('paint', geoT(wing, 0, 1.45, 0)); k.raw('paint', mirrorX(geoT(wing, 0, 1.45, 0)));
    const stab = wingGeo([[0.6, -7.4], [3.0, -7.0], [3.0, -6.4], [0.6, -5.2]], 0.1); k.raw('paint', geoT(stab, 0, 1.5, 0)); k.raw('paint', mirrorX(geoT(stab, 0, 1.5, 0)));
    const fin = wingGeo([[0, -7.5], [2.7, -7.0], [2.7, -6.2], [0, -4.4]], 0.1); k.raw('paint', geoT(fin, 0.5, 2.2, 0, 0, 0, 1.3)); k.raw('paint', mirrorX(geoT(fin, 0.5, 2.2, 0, 0, 0, 1.3)));
    for (const s of [1, -1]) { k.add('paint', CG.frus(0.9, 0.9), s * 1.0, 1.55, 0.6, 0.55, 0.8, 3.6, null); k.box('vc', 0.42, 0.62, 0.05, s * 1.0, 1.6, 2.42, dark);
      k.cyl('vc', 0.12, 2.8, s * 3.6, 1.2, -1.5, '#e8e8e4', 'z', 8); k.add('vc', CG.cone(8), s * 3.6, 1.2, 0.1, 0.24, 0.5, 0.24, '#c0392b', Math.PI / 2, 0, 0); k.cyl('vc', 0.12, 2.6, s * 2.5, 1.15, -1.2, '#e8e8e4', 'z', 8);
      k.cyl('vc', 0.05, 0.3, s * 5.45, 1.45, -3.1, '#e8e8e4', 'z', 6); }
    k.raw('glass', loftGeo([[2.2, 0.05, 0.05], [2.8, 0.42, 0.32], [4.0, 0.5, 0.42], [5.0, 0.36, 0.3], [5.6, 0.05, 0.05]].map(([z, rx, ry]) => ({ z, pts: ring(10, rx, ry, 0, 2.38, Math.PI / 10) }))));
    k.cyl('vc', 0.52, 1.0, 0, 1.72, -8.1, '#2a2c30', 'z', 12); k.cyl('vc', 0.4, 1.02, 0, 1.72, -8.1, '#3a1a10', 'z', 12);
    k.box('vc', 0.5, 0.02, 3, 0, 2.52, -1.5, grey); for (const s of [1, -1]) k.box('vc', 0.02, 0.3, 0.6, s * 0.72, 1.95, 4.6, '#c0392b');
    _airCache[type] = { geos: k.geos(), seat: V3(0, 1.85, 3.4), len: 15.6, wid: 10.8, height: 4, gearH: 1.7 };
  } else if (type === 'plane') {
    fus([[-4.5, 0.12, 0.12, 1.85, 8], [-3.2, 0.32, 0.38, 1.75, 8], [-1, 0.62, 0.72, 1.62, 8], [0.4, 0.68, 0.8, 1.62, 8], [2.2, 0.66, 0.74, 1.58, 8], [3.4, 0.5, 0.55, 1.55, 8], [4.1, 0.3, 0.32, 1.55, 8]]);
    k.box('paint', 11, 0.14, 1.55, 0, 2.4, 0.9); for (const s of [1, -1]) { k.box('vc', 0.06, 0.16, 1.57, s * 5.3, 2.4, 0.9, '#c0392b'); k.cyl('vc', 0.04, 1.6, s * 1.05, 1.62, 0.85, dark, 'y', 6, 0, 0, s * 0.85); }
    k.box('paint', 3.6, 0.08, 0.9, 0, 1.82, -4.0); k.raw('paint', geoT(wingGeo([[0, -4.6], [1.6, -4.2], [1.6, -3.5], [0, -2.9]], 0.08), 0.04, 1.85, 0, 0, 0, Math.PI / 2));
    for (const s of [1, -1]) { k.raw('glass', polyGeo([V3(s * 0.66, 1.75, 0.0), V3(s * 0.66, 1.75, 1.6), V3(s * 0.58, 2.25, 1.5), V3(s * 0.58, 2.25, 0.1)], V3(0, 1.9, 0.8))); k.box('vc', 0.6, 0.02, 3.2, s * 0, 1.6, 0, '#c0392b');
      k.cyl('vc', 0.035, 1.3, s * 0.95, 0.85, 1.2, dark, 'y', 6, 0, 0, s * 0.45); k.add('paint', CG.frus(0.7, 0.6), s * 1.3, 0.35, 1.2, 0.26, 0.4, 0.75); }
    k.raw('glass', polyGeo([V3(-0.55, 2.0, 2.15), V3(0.55, 2.0, 2.15), V3(0.45, 2.38, 1.45), V3(-0.45, 2.38, 1.45)], V3(0, 1.8, 1.5)));
    for (const s of [1, -1]) k.box('vc', 0.02, 0.07, 3.6, s * 0.7, 1.5, -0.6, '#c0392b');
    k.cyl('vc', 0.035, 1.0, 0, 1.0, 3.2, dark); k.cyl('vc', 0.2, 0.35, 0, 1.55, 4.2, '#e8e8e4', 'z', 10); k.add('vc', CG.cone(10), 0, 1.55, 4.5, 0.4, 0.35, 0.4, '#e8e8e4', Math.PI / 2, 0, 0);
    for (const [x, y, z] of [[1.3, 0.3, 1.2], [-1.3, 0.3, 1.2], [0, 0.28, 3.2]]) k.cyl('vc', 0.3, 0.16, x, y, z, '#1b1b1d', 'x', 12);
    _airCache[type] = { geos: k.geos(), seat: V3(0, 1.32, 1.1), len: 8.6, wid: 11, height: 3, gearH: 1.25 };
  } else { // Helikopter
    fus([[-1.4, 0.55, 0.6, 1.6, 10], [-0.4, 1.05, 1.0, 1.75, 10], [0.8, 1.1, 1.05, 1.72, 10], [1.8, 0.92, 0.9, 1.62, 10], [2.5, 0.5, 0.55, 1.45, 10], [2.8, 0.08, 0.1, 1.4, 10]]);
    fus([[-6.6, 0.12, 0.16, 2.2, 6], [-1.2, 0.3, 0.42, 2.0, 6]]);
    k.raw('glass', loftGeo([[0.6, 0.98, 0.5, 1.95], [1.6, 0.86, 0.5, 1.85], [2.35, 0.48, 0.35, 1.62], [2.62, 0.1, 0.1, 1.5]].map(([z, rx, ry, cy]) => ({ z, pts: ring(10, rx, ry, 0, cy, Math.PI / 10) }))));
    for (const s of [1, -1]) k.raw('glass', polyGeo([V3(s * 1.08, 1.55, -0.2), V3(s * 1.08, 1.55, 0.8), V3(s * 1.0, 2.25, 0.7), V3(s * 1.0, 2.25, -0.1)], V3(0, 1.8, 0.3)));
    k.raw('paint', geoT(wingGeo([[0, -7.0], [1.3, -6.8], [1.3, -6.25], [0, -5.9]], 0.07), 0.03, 2.15, 0, 0, 0, Math.PI / 2)); k.box('paint', 1.7, 0.07, 0.5, 0, 2.15, -6.0);
    k.add('vc', CG.frus(0.8, 0.8), 0, 2.85, -0.1, 1.1, 0.5, 2.0, grey); k.cyl('vc', 0.12, 0.4, 0, 3.2, 0.2, dark); k.cyl('vc', 0.18, 0.5, 0, 2.6, -1.4, dark, 'z', 8);
    for (const s of [1, -1]) { k.cyl('vc', 0.06, 4.2, s * 0.95, 0.12, 0.3, dark, 'z', 6); k.cyl('vc', 0.05, 0.95, s * 0.82, 0.55, 1.2, dark, 'y', 6, 0, 0, s * 0.3); k.cyl('vc', 0.05, 0.95, s * 0.82, 0.55, -0.7, dark, 'y', 6, 0, 0, s * 0.3);
      k.box('paint', 1.2, 0.08, 0.5, s * 1.55, 1.4, 0.2); k.cyl('vc', 0.16, 1.2, s * 2.1, 1.25, 0.25, '#3a3d34', 'z', 8); }
    k.box('vc', 0.02, 0.28, 0.9, 1.06, 1.25, -0.6, '#f4f4f0'); k.box('vc', 0.02, 0.28, 0.9, -1.06, 1.25, -0.6, '#f4f4f0');
    _airCache[type] = { geos: k.geos(), seat: V3(0.4, 1.12, 0.9), len: 12, wid: 2.6, height: 3.4, gearH: 0 };
  }
  return _airCache[type];
}
function buildAircraft(type, color) {
  const A = airGeos(type), G2 = A.geos, grp = new THREE.Group(), body = new THREE.Group(); grp.add(body); const pm = paintMat(color);
  const add = (g, m, cast = true) => { if (!g) return; const mm = new THREE.Mesh(g, m); mm.castShadow = cast; body.add(mm); return mm; };
  add(G2.paint, pm); add(G2.vc, MAT.vehVC); add(G2.glass, MAT.glassDark, false);
  const res = { group: grp, body, paint: null, wheels: [], tailMat: tailMatNew(), gear: null, rotor: null, tailRotor: null, prop: null, burner: null, seat: A.seat.clone(), pose: 'sit', len: A.len, wid: A.wid, height: A.height, gearH: A.gearH };
  if (type === 'jet') {
    const burnMat = new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    res.burner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.2, 10, 1, true), burnMat); res.burner.rotation.x = -Math.PI / 2; res.burner.position.set(0, 1.72, -10.2); body.add(res.burner);
    const gear = new THREE.Group(); for (const [x, z] of [[0, 4.5], [1.4, -1.5], [-1.4, -1.5]]) { const s = new THREE.Mesh(CG.cyl(6), MAT.chrome); s.scale.set(0.12, 1.3, 0.12); s.position.set(x, 0.95, z); gear.add(s); const t = new THREE.Mesh(CG.cyl(12), MAT.tire); t.scale.set(0.66, 0.22, 0.66); t.rotation.z = Math.PI / 2; t.position.set(x, 0.33, z); gear.add(t); } body.add(gear); res.gear = gear;
  } else if (type === 'plane') {
    const prop = new THREE.Group(); prop.position.set(0, 1.55, 4.42); const pg = mergeGeos([geoT(CG.box(), 0, 0.5, 0, 0, 0.3, 0, 0.14, 1.0, 0.03), geoT(CG.box(), 0, -0.5, 0, 0, -0.3, 0, 0.14, 1.0, 0.03)]); prop.add(new THREE.Mesh(pg, MAT.trim)); body.add(prop); res.prop = prop;
  } else {
    const rotor = new THREE.Group(); rotor.position.set(0, 3.45, 0.2); rotor.add(new THREE.Mesh(mergeGeos([0, 1, 2, 3].map(k => geoT(CG.box(), Math.sin(k * Math.PI / 2) * 2.8, 0, Math.cos(k * Math.PI / 2) * 2.8, 0, k * Math.PI / 2, 0, 0.3, 0.04, 5.6)).concat([geoT(CG.cyl(8), 0, 0, 0, 0, 0, 0, 0.4, 0.2, 0.4)])), MAT.trim)); body.add(rotor); res.rotor = rotor;
    const tr = new THREE.Group(); tr.position.set(0.22, 2.35, -6.55); tr.add(new THREE.Mesh(mergeGeos([geoT(CG.box(), 0, 0, 0, 0, 0, 0, 0.03, 1.5, 0.15), geoT(CG.box(), 0, 0, 0, 0, 0, 0, 0.03, 0.15, 1.5)]), MAT.trim)); body.add(tr); res.tailRotor = tr;
  }
  const nav = type === 'jet' ? [[0xff2020, 5.45, 1.45, -3.1], [0x20ff40, -5.45, 1.45, -3.1]] : type === 'plane' ? [[0xff2020, 5.5, 2.4, 0.9], [0x20ff40, -5.5, 2.4, 0.9]] : [[0xff2020, 0, 2.3, -6.6], [0x20ff40, 0, 1.0, 2.6]];
  for (const [c, x, y, z] of nav) { const m = new THREE.Mesh(CG.sph(6), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.scale.setScalar(0.18); m.position.set(x, y, z); body.add(m); }
  return res;
}
function buildVehicleModel(type, color) {
  const S = CFG.VEHICLES[type]; let m;
  if (S.cls === 'car') m = S.bike ? buildBike(color) : CarLib.build(type, color); else if (S.cls === 'boat') m = buildBoat(type, color); else m = buildAircraft(type, color);
  m.group.traverse(o => { if (o.isMesh) o.receiveShadow = true; }); return m;
}
