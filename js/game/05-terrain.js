// =====================================================================
//  WELT: Gelände (Höhenfeld), organisches Straßennetz, Bebauung, Kollision
//  Solara: Festland mit Stadtvierteln, Bucht, langgezogene Strandinsel, Keys
// =====================================================================
const WS = CFG.WORLD, GN = CFG.GRID, CELL = 2 * WS / (GN - 1);
// Bezirke (x = Osten, z = Süden)
const DOWNTOWN = { x: 555, z: -150 }, UPTOWN = { x: 430, z: -800 }, OLDTOWN = { x: -40, z: -560 }, MIDTOWN = { x: 30, z: 300 };
const SUBURB = { x: -520, z: 330 }, SUBURB2 = { x: -330, z: 1030 }, PORT = { x: 430, z: 930 }, INDUS = { x: 60, z: 880 };
const HEIGHTS = { x: 170, z: -1210 }, VILLAGE = { x: -960, z: 830 }, VILLAGE2 = { x: -620, z: -1230 };
const MOUNT = { x: -1180, z: -980 }, BASE = { x: -1480, z: 230, hx: 125, hz: 430, h: 9 }, SWAMP = { x: -1130, z: 1290, r: 430 };
const LAKES = [{ x: -300, z: 640, r: 105, d: 7 }, { x: -640, z: -560, r: 80, d: 6 }];
const KEYS = [{ x: 1230, z: 1330, r: 95 }, { x: 1050, z: 1500, r: 112 }, { x: 850, z: 1615, r: 90 }];
const STAR = { x: 995, z: -268, r: 72 };
const LOC = {}; const PARKED = []; const PICKUP_SPOTS = [];
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
// genäherter Abstand zum Rand einer Ellipse (positiv = innen)
function sdEll(x, z, cx, cz, rx, rz) { const dx = (x - cx) / rx, dz = (z - cz) / rz, q = Math.hypot(dx, dz) || 1e-6, g = Math.hypot(dx / rx, dz / rz) / q; return (1 - q) / Math.max(g, 1e-6); }
const beachCX = (z) => 1290 + 48 * Math.sin(z * 0.0011 + 0.4);
// Festland allein (für Küstenstraße)
function mainSD(x, z) {
  let m = sdEll(x, z, -480, -30, 1300, 1620);
  m = smax(m, sdEll(x, z, -1420, -650, 430, 560), 120); // Westkap
  m = smax(m, sdEll(x, z, -1120, 1290, 560, 330), 140); // Sumpf-Halbinsel
  m = smax(m, sdEll(x, z, 180, -1330, 520, 300), 120); // Nordkap
  m = Math.min(m, -sdEll(x, z, -1760, -420, 200, 260)); // Sunset Bay
  return m + fbm(x * 0.0021 + 3.1, z * 0.0021 - 7.7, 3) * 90 + fbm(x * 0.009, z * 0.009, 2) * 20;
}
function landSD(x, z) {
  let e = mainSD(x, z);
  const u = x - beachCX(z), hw = 172 + 22 * Math.sin(z * 0.0037 + 1.3);
  if (Math.abs(u) < 320) e = Math.max(e, Math.min(hw - Math.abs(u), z + 1460, 1160 - z) + fbm(x * 0.01, z * 0.01, 2) * 12); // Solara Beach
  for (const k of KEYS) { const d = Math.hypot(x - k.x, z - k.z); if (d < k.r + 80) e = Math.max(e, k.r - d + fbm(x * 0.02, z * 0.02, 2) * 14); }
  e = Math.max(e, STAR.r - Math.hypot(x - STAR.x, z - STAR.z));
  return e;
}
function islandE(x, z) { return landSD(x, z) / 1000; }
const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));
function rawHeight(x, z) {
  const e = islandE(x, z);
  if (e < 0) return Math.max(-34, 1.2 + e * 160);
  let land = 1.2 + sstep(0, 0.06, e) * 2.2 + Math.max(0, e - 0.06) * 24 + fbm(x * 0.0032, z * 0.0032, 4) * 24 * sstep(0.08, 0.35, e);
  land += 230 * gauss(x, z, MOUNT.x, MOUNT.z, 260) * (0.85 + 0.3 * fbm(x * 0.012, z * 0.012, 3));
  land += 110 * gauss(x, z, -1480, -560, 210) + 85 * gauss(x, z, -720, -1360, 190) + 70 * gauss(x, z, HEIGHTS.x, HEIGHTS.z + 30, 210) + 38 * gauss(x, z, -980, -320, 230);
  const sw = 1 - sstep(SWAMP.r * 0.5, SWAMP.r, Math.hypot(x - SWAMP.x, z - SWAMP.z)); // Sumpf: knapp über dem Wasser, mit Tümpeln
  if (sw > 0) { let s = 0.85 + fbm(x * 0.018 + 9, z * 0.018, 3) * 2.8; if (s < 0.15) s = s * 4 - 0.45; land = lerp(land, s, sw); }
  for (const L of LAKES) { const d = Math.hypot(x - L.x, z - L.z) / L.r; if (d < 1.7) land = lerp(land, Math.min(land, -L.d * (1 - d * d)), 1 - sstep(1.0, 1.7, d)); }
  return land;
}
const PEAK_H = rawHeight(MOUNT.x, MOUNT.z);
const FLAT = [
  { type: 'circle', x: DOWNTOWN.x, z: DOWNTOWN.z, r0: 330, r1: 450, h: 5 },
  { type: 'circle', x: UPTOWN.x, z: UPTOWN.z, r0: 190, r1: 300, h: null },
  { type: 'circle', x: OLDTOWN.x, z: OLDTOWN.z, r0: 260, r1: 370, h: null },
  { type: 'circle', x: MIDTOWN.x, z: MIDTOWN.z, r0: 240, r1: 360, h: null },
  { type: 'circle', x: PORT.x, z: PORT.z + 40, r0: 220, r1: 300, h: 3, sea: true },
  { type: 'circle', x: INDUS.x, z: INDUS.z, r0: 170, r1: 260, h: null },
  { type: 'circle', x: SUBURB.x, z: SUBURB.z, r0: 210, r1: 330, h: null, soft: 0.65 },
  { type: 'circle', x: SUBURB2.x, z: SUBURB2.z, r0: 230, r1: 340, h: null, soft: 0.65 },
  { type: 'rect', x: BASE.x, z: BASE.z, hx: BASE.hx, hz: BASE.hz, b: 80, h: BASE.h },
  { type: 'circle', x: MOUNT.x, z: MOUNT.z, r0: 32, r1: 70, h: PEAK_H - 3 },
  { type: 'circle', x: VILLAGE.x, z: VILLAGE.z, r0: 110, r1: 190, h: null },
  { type: 'circle', x: VILLAGE2.x, z: VILLAGE2.z, r0: 90, r1: 170, h: null },
];
function baseHeight(x, z) {
  let h = rawHeight(x, z), e = null;
  for (const f of FLAT) {
    let w; if (f.type === 'circle') { const d = Math.hypot(x - f.x, z - f.z); w = 1 - sstep(f.r0, f.r1, d); }
    else { const dx = Math.max(0, Math.abs(x - f.x) - f.hx), dz = Math.max(0, Math.abs(z - f.z) - f.hz); w = 1 - sstep(0, f.b, Math.hypot(dx, dz)); }
    if (w <= 0) continue; if (f.h === null) { f.h = Math.max(4, rawHeight(f.x, f.z)); } if (!f.sea) { if (e === null) e = islandE(x, z); if (e < 0) w *= sstep(-0.03, 0, e); }
    h = lerp(h, f.h, w * (f.soft || 1));
  }
  return h;
}
const HGT = new Float32Array(GN * GN);
for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) HGT[j * GN + i] = baseHeight(-WS + i * CELL, -WS + j * CELL);
function terrainHeight(x, z) {
  const fx = (x + WS) / CELL, fz = (z + WS) / CELL; if (fx < 0 || fz < 0 || fx >= GN - 1 || fz >= GN - 1) return -30;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * GN + i;
  return lerp(lerp(HGT[k], HGT[k + 1], u), lerp(HGT[k + GN], HGT[k + GN + 1], u), v);
}

// ---------- KOLLISION (gedrehte Boxen in einem Raster) ----------
const World = {
  obbs: [], grid: new Map(), CELL: 32, stamp: 1, platforms: [], lampAnchors: [], neonAnchors: [], palmU: null,
  key(ix, iz) { return (ix + 500) * 2000 + (iz + 500); }, rgrid: new Map(), rstamp: 1, anim: [], lod: [],
  // Detailstufen: je nach Kameradistanz Objekt zeigen, durch Ersatz tauschen oder ausblenden
  updateLOD(cam) { for (const L of this.lod) { const d = Math.hypot(L.x - cam.x, L.z - cam.z), near = d < L.far; L.obj.visible = near; if (L.alt) L.alt.visible = !near && d < (L.altFar || 900); } },
  addRoof(cx, cz, hx, hz, yaw, top) { const c = Math.cos(yaw), s = Math.sin(yaw), ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz; const r = { cx, cz, hx, hz, c, s, top, st: 0 };
    for (let ix = Math.floor((cx - ex) / this.CELL); ix <= Math.floor((cx + ex) / this.CELL); ix++) for (let iz = Math.floor((cz - ez) / this.CELL); iz <= Math.floor((cz + ez) / this.CELL); iz++) { const k = this.key(ix, iz); let a = this.rgrid.get(k); if (!a) { a = []; this.rgrid.set(k, a); } a.push(r); } },
  addOBB(cx, cz, hx, hz, yaw, top, y0 = -50, tag = null) {
    const c = Math.cos(yaw), s = Math.sin(yaw), ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
    const b = { cx, cz, hx, hz, c, s, yaw, top, y0, tag, st: 0, minX: cx - ex, maxX: cx + ex, minZ: cz - ez, maxZ: cz + ez };
    this.obbs.push(b);
    for (let ix = Math.floor(b.minX / this.CELL); ix <= Math.floor(b.maxX / this.CELL); ix++) for (let iz = Math.floor(b.minZ / this.CELL); iz <= Math.floor(b.maxZ / this.CELL); iz++) {
      const k = this.key(ix, iz); let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(b); }
    return b;
  },
  query(x0, z0, x1, z1, out) {
    out.length = 0; this.stamp++;
    for (let ix = Math.floor(x0 / this.CELL); ix <= Math.floor(x1 / this.CELL); ix++) for (let iz = Math.floor(z0 / this.CELL); iz <= Math.floor(z1 / this.CELL); iz++) {
      const a = this.grid.get(this.key(ix, iz)); if (!a) continue; for (const b of a) if (b.st !== this.stamp) { b.st = this.stamp; out.push(b); } }
    return out;
  },
};
const _qb = [], _rb = [];
function groundHeight(x, z, y = 1e9) {
  let h = terrainHeight(x, z);
  for (const p of World.platforms) { const dx = x - p.cx, dz = z - p.cz, lx = dx * p.c - dz * p.s, lz = dx * p.s + dz * p.c; if (Math.abs(lx) <= p.hx && Math.abs(lz) <= p.hz && p.top > h && y >= p.top - 0.8) h = p.top; }
  if (typeof Ramps !== 'undefined') for (const r of Ramps.list) { const dx = x - r.x, dz = z - r.z, lz = dx * r.s + dz * r.c, lx = dx * r.c - dz * r.s; if (lz > -r.L && lz < 0.2 && Math.abs(lx) < r.W / 2) { const ry = r.y0 + clamp((lz + r.L) / r.L, 0, 1) * r.H; if (ry > h && y >= ry - 1.2) h = ry; } }
  if (y < 1e8) { const a = World.rgrid.get(World.key(Math.floor(x / World.CELL), Math.floor(z / World.CELL))); if (a) for (const r of a) { if (r.top <= h || y < r.top - 0.8 || y > r.top + 4) continue; const dx = x - r.cx, dz = z - r.cz; if (Math.abs(dx * r.c - dz * r.s) <= r.hx && Math.abs(dx * r.s + dz * r.c) <= r.hz) h = r.top; } }
  return h;
}
function collideCircle(p, r, y = 0, height = 1.8) {
  let hit = null; const list = World.query(p.x - r, p.z - r, p.x + r, p.z + r, _qb);
  for (const b of list) {
    if (y > b.top - 0.25 || y + height < b.y0) continue;
    const dx = p.x - b.cx, dz = p.z - b.cz; let lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
    const qx = clamp(lx, -b.hx, b.hx), qz = clamp(lz, -b.hz, b.hz); let ex = lx - qx, ez = lz - qz; const d2 = ex * ex + ez * ez;
    if (d2 >= r * r) continue; let px, pz;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; px = ex / d * push; pz = ez / d * push; ex /= d; ez /= d; }
    else { const L = [b.hx + lx, b.hx - lx, b.hz + lz, b.hz - lz], m = Math.min(...L), i = L.indexOf(m); ex = i === 0 ? -1 : i === 1 ? 1 : 0; ez = i === 2 ? -1 : i === 3 ? 1 : 0; px = ex * (m + r); pz = ez * (m + r); }
    p.x += px * b.c + pz * b.s; p.z += -px * b.s + pz * b.c;
    const nx = ex * b.c + ez * b.s, nz = -ex * b.s + ez * b.c; if (!hit) hit = { nx: 0, nz: 0 }; hit.nx += nx; hit.nz += nz;
  }
  if (hit) { const l = Math.hypot(hit.nx, hit.nz) || 1; hit.nx /= l; hit.nz /= l; }
  return hit;
}
function rayBox(o, d, x0, y0, z0, x1, y1, z1, maxT) {
  let tmin = 0, tmax = maxT;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? d.x : a === 1 ? d.y : d.z, mn = a === 0 ? x0 : a === 1 ? y0 : z0, mx = a === 0 ? x1 : a === 1 ? y1 : z1;
    if (Math.abs(da) < 1e-9) { if (oa < mn || oa > mx) return null; }
    else { let t1 = (mn - oa) / da, t2 = (mx - oa) / da; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return null; }
  }
  return tmin;
}
const _lo = V3(), _ld = V3();
function rayOBB(o, d, b, maxT) {
  const dx = o.x - b.cx, dz = o.z - b.cz; _lo.set(dx * b.c - dz * b.s, o.y, dx * b.s + dz * b.c); _ld.set(d.x * b.c - d.z * b.s, d.y, d.x * b.s + d.z * b.c);
  return rayBox(_lo, _ld, -b.hx, b.y0, -b.hz, b.hx, b.top, b.hz, maxT);
}
function raycastWorld(o, d, maxT, terrain = true, skipProps = false) {
  const ex = o.x + d.x * maxT, ez = o.z + d.z * maxT; let best = maxT;
  const list = World.query(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez), _rb);
  for (const b of list) { if (b.top < b.y0 || (skipProps && b.tag === 'prop')) continue; const t = rayOBB(o, d, b, best); if (t !== null && t < best) best = t; }
  if (terrain) { // Gelände abtasten
    const step = 2.5; let prev = 0;
    for (let t = step; t <= best + step; t += step) { const tt = Math.min(t, best); const x = o.x + d.x * tt, z = o.z + d.z * tt, y = o.y + d.y * tt;
      if (y < groundHeight(x, z, y + 0.3)) { let a = prev, b2 = tt; for (let k = 0; k < 6; k++) { const m = (a + b2) / 2; if (o.y + d.y * m < groundHeight(o.x + d.x * m, o.z + d.z * m, o.y + d.y * m + 0.3)) b2 = m; else a = m; } best = Math.min(best, b2); break; }
      prev = tt; if (tt >= best) break; }
  }
  return best;
}
function hasLOS(a, b) { tmpV4.subVectors(b, a); const dist = tmpV4.length(); if (dist < 0.01) return true; tmpV4.multiplyScalar(1 / dist); return raycastWorld(a, tmpV4, dist) >= dist - 0.5; }

// ---------- STRASSENNETZ (Knoten + geschwungene Kanten) ----------
const Roads = {
  nodes: [], edges: [], hash: new Map(), HC: 32,
  addNode(x, z, o = {}) { const n = { id: this.nodes.length, x, z, y: 0, edges: [], r: 0, ...o }; this.nodes.push(n); return n; },
  addEdge(a, b, type = 'street', bend = 0) {
    if (!a || !b || a === b || a.edges.some(e => this.edges[e].a === b.id || this.edges[e].b === b.id)) return null;
    const e = { id: this.edges.length, a: a.id, b: b.id, type, hw: type === 'highway' ? 8 : type === 'service' ? 4.5 : 6.5, bend, pts: [], len: 0 };
    this.edges.push(e); a.edges.push(e.id); b.edges.push(e.id); return e;
  },
  sampleAll() {
    for (const n of this.nodes) { let s = 0, c = 0; for (let k = 0; k < 6; k++) { s += terrainHeight(n.x + Math.cos(k) * 8, n.z + Math.sin(k) * 8); c++; } n.y = Math.max(n.edges.some(i => this.edges[i].bridge) ? 2.4 : 1.6, s / c); }
    this.nh = new Map(); for (const n of this.nodes) { const k = Math.floor(n.x / 64) * 4096 + Math.floor(n.z / 64); let a = this.nh.get(k); if (!a) this.nh.set(k, a = []); a.push(n); }
    for (const n of this.nodes) n.r = Math.max(...n.edges.map(i => this.edges[i].hw)) + (n.edges.length >= 3 ? 2.0 : 1.0);
    for (const e of this.edges) {
      const A = this.nodes[e.a], B = this.nodes[e.b], dx = B.x - A.x, dz = B.z - A.z, L0 = Math.hypot(dx, dz);
      const mid = V3((A.x + B.x) / 2 - dz / L0 * e.bend, 0, (A.z + B.z) / 2 + dx / L0 * e.bend);
      const curve = new THREE.QuadraticBezierCurve3(V3(A.x, 0, A.z), mid, V3(B.x, 0, B.z));
      const L = curve.getLength(), n = Math.max(2, Math.ceil(L / 4)); const pts = curve.getSpacedPoints(n);
      const raw = pts.map(p => terrainHeight(p.x, p.z)), win = e.type === 'highway' ? 10 : 7, ys = [];
      for (let k = 0; k <= n; k++) { let s = 0, c = 0; for (let q = Math.max(0, k - win); q <= Math.min(n, k + win); q++) { s += raw[q]; c++; } ys.push(s / c); }
      const d0 = A.y - ys[0], d1 = B.y - ys[n];
      e.pts = pts.map((p, k) => { const t = k / n; const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n, k + 1)]; const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1; return { x: p.x, z: p.z, y: Math.max(e.bridge ? 2.4 : 1.4, ys[k] + lerp(d0, d1, t)), tx: tx / tl, tz: tz / tl, s: t * L }; });
      e.len = L;
      e.pts.forEach((p, k) => { const key = Math.floor(p.x / this.HC) * 4096 + Math.floor(p.z / this.HC); let a = this.hash.get(key); if (!a) { a = []; this.hash.set(key, a); } a.push(e.id, k); });
    }
  },
  nearest(x, z, maxD = 60, filter = null) {
    let best = null, bd = maxD * maxD; const r = Math.ceil(maxD / this.HC);
    const cx = Math.floor(x / this.HC), cz = Math.floor(z / this.HC);
    for (let i = cx - r; i <= cx + r; i++) for (let j = cz - r; j <= cz + r; j++) { const a = this.hash.get(i * 4096 + j); if (!a) continue;
      for (let q = 0; q < a.length; q += 2) { const e = this.edges[a[q]]; if (filter && !filter(e)) continue; const p = e.pts[a[q + 1]], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = { e, k: a[q + 1], p, d: Math.sqrt(d) }; } } }
    if (best) { const p = best.p; best.lat = (x - p.x) * (-p.tz) + (z - p.z) * p.tx; }
    return best;
  },
  // Punkt auf Fahrspur: dir=+1 (a→b) oder -1, s = Strecke in Fahrtrichtung, off = Abstand rechts der Mittellinie
  lanePoint(e, dir, s, off, out) {
    const L = e.len, ss = clamp(dir > 0 ? s : L - s, 0, L), f = ss / L * (e.pts.length - 1), k = Math.min(e.pts.length - 2, Math.floor(f)), t = f - k, p = e.pts[k], q = e.pts[k + 1];
    let tx = lerp(p.tx, q.tx, t), tz = lerp(p.tz, q.tz, t); if (dir < 0) { tx = -tx; tz = -tz; }
    out.set(lerp(p.x, q.x, t) - tz * off, lerp(p.y, q.y, t), lerp(p.z, q.z, t) + tx * off); out.tx = tx; out.tz = tz; return out;
  },
  other(e, nodeId) { return e.a === nodeId ? e.b : e.a; },
  // Dijkstra über Knoten
  path(fromN, toN) {
    const N = this.nodes.length, g = this._g && this._g.length === N ? this._g : (this._g = new Float32Array(N)), prev = this._p && this._p.length === N ? this._p : (this._p = new Int32Array(N)), mark = this._m && this._m.length === N ? this._m : (this._m = new Uint32Array(N));
    const stamp = (this._st = (this._st || 0) + 2), T = this.nodes[toN], h = (i) => Math.hypot(this.nodes[i].x - T.x, this.nodes[i].z - T.z);
    const heap = [], push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    g[fromN] = 0; prev[fromN] = -1; mark[fromN] = stamp; push(fromN, h(fromN)); let found = false;
    while (heap.length) { const [f, u] = pop(); if (mark[u] === stamp + 1) continue; mark[u] = stamp + 1; if (u === toN) { found = true; break; }
      for (const ei of this.nodes[u].edges) { const e = this.edges[ei], v = this.other(e, u); if (mark[v] === stamp + 1) continue; const nd = g[u] + e.len; if (mark[v] !== stamp || nd < g[v]) { mark[v] = stamp; g[v] = nd; prev[v] = u; push(v, nd + h(v)); } } }
    if (!found) return null; const out = []; let c = toN; while (c >= 0) { out.unshift(c); if (c === fromN) break; c = prev[c]; } return out[0] === fromN ? out : null;
  },
  nodesNear(x, z, r, out = []) { out.length = 0; const c0 = Math.floor((x - r) / 64), c1 = Math.floor((x + r) / 64), d0 = Math.floor((z - r) / 64), d1 = Math.floor((z + r) / 64); for (let i = c0; i <= c1; i++) for (let j = d0; j <= d1; j++) { const a = this.nh.get(i * 4096 + j); if (a) for (const n of a) out.push(n); } return out; },
  nearestNode(x, z) { let b = null, bd = 1e18; for (const n of this.nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; },
  edgeBetween(a, b) { for (const ei of this.nodes[a].edges) { const e = this.edges[ei]; if (this.other(e, a) === b) return e; } return null; },
};
function coastRadius(th, eTarget) { for (let r = 2150; r > 100; r -= 4) { if (islandE(Math.cos(th) * r, Math.sin(th) * r) >= eTarget) return r; } return 200; }
// Punkt in Polygon ([x, z]-Paare)
function pip(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const xi = P[i][0], zi = P[i][1], xj = P[j][0], zj = P[j][1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function nearestOf(list, x, z) { let b = null, bd = 1e18; for (const n of list) { if (!n) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; }
const TAU = Math.PI * 2;

// ---------- BEZIRKE (für Zonen & Bebauung) ----------
const DISTS = [];
function zoneRect(k, cx, cz, rot, hu, hv) { DISTS.push({ k, cx, cz, c: Math.cos(rot), s: Math.sin(rot), hu, hv, rot }); }
function zoneCirc(k, cx, cz, r) { DISTS.push({ k, cx, cz, r }); }
function distAt(x, z, m = 0) { for (const D of DISTS) { const dx = x - D.cx, dz = z - D.cz; if (D.r) { if (dx * dx + dz * dz < (D.r + m) ** 2) return D; } else { const lu = dx * D.c + dz * D.s, lv = -dx * D.s + dz * D.c; if (Math.abs(lu) < D.hu + m && Math.abs(lv) < D.hv + m) return D; } } return null; }
const inBase = (x, z, m = 0) => Math.abs(x - BASE.x) < BASE.hx + m && Math.abs(z - BASE.z) < BASE.hz + m;
const inLake = (x, z, m = 0) => LAKES.some(L => Math.hypot(x - L.x, z - L.z) < L.r * 1.25 + m);
// Stadtgebiet zwischen den Vierteln (durchgehende Bebauung)
const inUrban = (x, z) => ((x - 150) / 660) ** 2 + ((z - 80) / 1090) ** 2 < 1 && mainSD(x, z) > 70 && !inLake(x, z, 20);
const onStrip = (x, z) => Math.abs(x - beachCX(z)) < 230 && z > -1490 && z < 1190;

// ---------- PLANARER STRASSEN-BAUKASTEN ----------
// Strecken werden eingefügt; schneiden sie bestehende Strecken, entstehen dort automatisch Kreuzungen.
const Net = {
  nodes: [], segs: [], hash: new Map(), HC: 60,
  node(x, z, o, snap = 9) {
    const cx = Math.floor(x / this.HC), cz = Math.floor(z / this.HC); let best = null, bd = snap * snap;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) { const a = this.hash.get(i * 4096 + j); if (!a) continue; for (const n of a) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } } }
    if (best) { if (o) Object.assign(best, o); return best; }
    const n = Object.assign({ i: this.nodes.length, x, z, segs: [] }, o || {}); this.nodes.push(n); const k = cx * 4096 + cz; let a = this.hash.get(k); if (!a) this.hash.set(k, a = []); a.push(n); return n;
  },
  geom(s) { const A = s.a, B = s.b, dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1, mx = (A.x + B.x) / 2 - dz / L * s.bend, mz = (A.z + B.z) / 2 + dx / L * s.bend, n = s.bend ? 6 : 1; s.poly = [];
    for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; s.poly.push([u * u * A.x + 2 * u * t * mx + t * t * B.x, u * u * A.z + 2 * u * t * mz + t * t * B.z]); }
    s.x0 = Math.min(...s.poly.map(p => p[0])) - 1; s.x1 = Math.max(...s.poly.map(p => p[0])) + 1; s.z0 = Math.min(...s.poly.map(p => p[1])) - 1; s.z1 = Math.max(...s.poly.map(p => p[1])) + 1; },
  addSeg(a, b, type, bend, f) { if (a === b || a.segs.some(s => s.a === b || s.b === b)) return null;
    const s = { a, b, type, bend, f: f || null, alive: true }; this.geom(s); this.segs.push(s); a.segs.push(s); b.segs.push(s); return s; },
  kill(s) { s.alive = false; s.a.segs = s.a.segs.filter(q => q !== s); s.b.segs = s.b.segs.filter(q => q !== s); },
  split(s, N) { this.kill(s); this.addSeg(s.a, N, s.type, 0, s.f); this.addSeg(N, s.b, s.type, 0, s.f); },
  // erster Schnittpunkt der Strecke P→B mit dem Bestand (Parameter t, Punkt, Strecke)
  firstHit(P, B, bend, skipD) {
    const dx = B.x - P.x, dz = B.z - P.z, L = Math.hypot(dx, dz) || 1, mx = (P.x + B.x) / 2 - dz / L * bend, mz = (P.z + B.z) / 2 + dx / L * bend, n = bend ? 6 : 1, poly = [];
    for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; poly.push([u * u * P.x + 2 * u * t * mx + t * t * B.x, u * u * P.z + 2 * u * t * mz + t * t * B.z]); }
    const x0 = Math.min(...poly.map(p => p[0])), x1 = Math.max(...poly.map(p => p[0])), z0 = Math.min(...poly.map(p => p[1])), z1 = Math.max(...poly.map(p => p[1]));
    let best = null;
    for (const s of this.segs) { if (!s.alive || s.x1 < x0 || s.x0 > x1 || s.z1 < z0 || s.z0 > z1) continue;
      for (let i = 0; i < n; i++) { const ax = poly[i][0], az = poly[i][1], bx = poly[i + 1][0], bz = poly[i + 1][1];
        for (let j = 0; j < s.poly.length - 1; j++) { const cx = s.poly[j][0], cz = s.poly[j][1], ex = s.poly[j + 1][0], ez = s.poly[j + 1][1];
          const den = (bx - ax) * (ez - cz) - (bz - az) * (ex - cx); if (Math.abs(den) < 1e-9) continue;
          const t = ((cx - ax) * (ez - cz) - (cz - az) * (ex - cx)) / den, u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den; if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const tt = (i + t) / n, X = ax + (bx - ax) * t, Z = az + (bz - az) * t; if (Math.hypot(X - P.x, Z - P.z) < skipD || Math.hypot(X - B.x, Z - B.z) < 10) continue;
          if (!best || tt < best.t) best = { t: tt, x: X, z: Z, s }; } } }
    return best;
  },
  link(A, B, type = 'street', bend = 0, f = null) {
    if (!A || !B || A === B) return; let prev = A, b = bend;
    for (let guard = 0; guard < 60; guard++) { const h = this.firstHit(prev, B, b, 16); if (!h) break; const s = h.s;
      let N = Math.hypot(h.x - s.a.x, h.z - s.a.z) < 16 ? s.a : Math.hypot(h.x - s.b.x, h.z - s.b.z) < 16 ? s.b : null;
      if (!N) { N = this.node(h.x, h.z, null, 4); this.split(s, N); }
      if (N === prev) break; if (N === B) { prev = B; break; } this.addSeg(prev, N, type, 0, f); prev = N; b = 0; }
    if (prev !== B) this.addSeg(prev, B, type, prev === A ? bend : 0, f);
  },
  // Knoten auf der nächsten Straße (teilt sie bei Bedarf)
  attach(x, z, maxD = 200, filter = null) { let best = null, bd = maxD;
    for (const s of this.segs) { if (!s.alive || (filter && !filter(s)) || s.x1 < x - maxD || s.x0 > x + maxD || s.z1 < z - maxD || s.z0 > z + maxD) continue;
      for (let j = 0; j < s.poly.length - 1; j++) { const ax = s.poly[j][0], az = s.poly[j][1], bx = s.poly[j + 1][0], bz = s.poly[j + 1][1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1), px = ax + vx * t, pz = az + vz * t, d = Math.hypot(px - x, pz - z);
        if (d < bd) { bd = d; best = { s, x: px, z: pz }; } } }
    if (!best) return null; const s = best.s;
    if (Math.hypot(best.x - s.a.x, best.z - s.a.z) < 22) return s.a; if (Math.hypot(best.x - s.b.x, best.z - s.b.z) < 22) return s.b;
    const N = this.node(best.x, best.z, null, 4); this.split(s, N); return N; },
  nearestNode(x, z, maxD = 1e9, filter = null) { let b = null, bd = maxD * maxD; for (const n of this.nodes) { if (!n.segs.length || (filter && !filter(n))) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; },
  // Strecke über Wasser in Land- und Dammstücke teilen
  causeway(A, B) { const L = Math.hypot(B.x - A.x, B.z - A.z), n = Math.ceil(L / 8); let prev = A, wet = false;
    for (let k = 1; k <= n; k++) { const t = k / n, x = lerp(A.x, B.x, t), z = lerp(A.z, B.z, t), w = islandE(x, z) < 0.004;
      if (w !== wet) { const tb = clamp((wet ? t + 12 / L : t - 12 / L), 0, 1), N = this.node(lerp(A.x, B.x, tb), lerp(A.z, B.z, tb), null, 6); if (N !== prev) { this.link(prev, N, 'street', 0, wet ? { bridge: true } : null); prev = N; } wet = w; } }
    this.link(prev, B, 'street', 0, wet ? { bridge: true } : null); },
  // Flächen (Baublöcke) des planaren Netzes: Halbkanten-Umlauf, jeweils nächste Kante im Uhrzeigersinn
  faces() {
    const out = new Map(), vis = new Map();
    for (const s of this.segs) { if (!s.alive) continue; for (const fwd of [true, false]) { const P = s.poly, p0 = fwd ? P[0] : P[P.length - 1], p1 = fwd ? P[1] : P[P.length - 2], u = fwd ? s.a : s.b;
      let a = out.get(u); if (!a) out.set(u, a = []); a.push({ s, fwd, ang: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) }); } }
    for (const a of out.values()) a.sort((p, q) => p.ang - q.ang);
    const faces = [];
    for (const s of this.segs) { if (!s.alive) continue; for (const fwd of [true, false]) { const bit = fwd ? 1 : 2; if ((vis.get(s) || 0) & bit) continue;
      const loop = []; let cs = s, cf = fwd;
      for (let g = 0; g < 600; g++) { vis.set(cs, (vis.get(cs) || 0) | (cf ? 1 : 2)); loop.push([cs, cf]); const v = cf ? cs.b : cs.a, list = out.get(v), i = list.findIndex(o => o.s === cs && o.fwd === !cf), nx = list[(i - 1 + list.length) % list.length];
        cs = nx.s; cf = nx.fwd; if (cs === s && cf === fwd) break; }
      const pts = []; for (const [q, f] of loop) { const P = f ? q.poly : [...q.poly].reverse(); for (let k = 0; k < P.length - 1; k++) pts.push(P[k]); }
      let A = 0, cx = 0, cz = 0; for (let k = 0; k < pts.length; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[(k + 1) % pts.length], cr = x0 * z1 - x1 * z0; A += cr; cx += (x0 + x1) * cr; cz += (z0 + z1) * cr; }
      A /= 2; faces.push({ loop, pts, area: A, cx: A ? cx / (6 * A) : 0, cz: A ? cz / (6 * A) : 0 }); } }
    let pos = 0; for (const f of faces) if (f.area > 0) pos++; const sg = pos * 2 >= faces.length ? 1 : -1;
    return faces.filter(f => f.area * sg > 1);
  },
  // große Blöcke organisch zerteilen: Schnitt quer zur Längsachse, leicht schräg und versetzt
  subdivide(target, keep = []) {
    for (let it = 0; it < 10; it++) { let cuts = 0;
      for (const f of this.faces()) { if (f.loop.some(([s]) => !s.alive)) continue; const P = f.pts, A = Math.abs(f.area); if (A < 1500 || A > 3.5e6) continue;
        if (keep.some(k => pip(k.x, k.z, P))) continue; const T = target(f); if (!T) continue;
        let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P) { const dx = x - f.cx, dz = z - f.cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
        const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(th), uz = Math.sin(th); let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (const [x, z] of P) { const du = (x - f.cx) * ux + (z - f.cz) * uz, dv = -(x - f.cx) * uz + (z - f.cz) * ux; u0 = Math.min(u0, du); u1 = Math.max(u1, du); v0 = Math.min(v0, dv); v1 = Math.max(v1, dv); }
        if (Math.max(u1 - u0, v1 - v0) < T.max * 1.25) continue;
        const long = u1 - u0 >= v1 - v0;
        for (let tr = 0; tr < 5; tr++) { const t = (long ? (u0 + u1) / 2 : (v0 + v1) / 2) + sr(-0.22, 0.22) * (long ? u1 - u0 : v1 - v0);
        const ox = f.cx + (long ? ux * t : -uz * t), oz = f.cz + (long ? uz * t : ux * t), a = th + (long ? Math.PI / 2 : 0) + sr(-T.ang, T.ang) * (tr ? 1.6 : 1), dx = Math.cos(a), dz = Math.sin(a);
        let lm = -1e9, lp = 1e9; for (let k = 0; k < P.length; k++) { const [ax, az] = P[k], [bx, bz] = P[(k + 1) % P.length], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
          const lam = ((ax - ox) * ez - (az - oz) * ex) / den, mu = ((ax - ox) * dz - (az - oz) * dx) / den; if (mu < 0 || mu > 1) continue; if (lam < 0) lm = Math.max(lm, lam); else lp = Math.min(lp, lam); }
        if (lm < -1e8 || lp > 1e8 || lp - lm < 30 || lp - lm > 900) continue;
        const p1 = [ox + dx * lm, oz + dz * lm], p2 = [ox + dx * lp, oz + dz * lp]; let ok = true;
        for (let q = 1; q < 24 && ok; q++) { const x = lerp(p1[0], p2[0], q / 24), z = lerp(p1[1], p2[1], q / 24); if (islandE(x, z) < 0.012 || inLake(x, z, 8) || inBase(x, z, 20)) ok = false; } if (!ok) continue;
        const n1 = this.attach(p1[0], p1[1], 5), n2 = this.attach(p2[0], p2[1], 5); if (!n1 || !n2 || n1 === n2) continue;
        this.link(n1, n2, 'street', sr(-1, 1) * T.bend, T.f); cuts++; break; } }
      if (!cuts) break; }
  },
  finalize() { const map = new Map();
    const rn = (n) => { let r = map.get(n); if (!r) { const o = {}; for (const k of ['ring', 'collins', 'ocean', 'culdesac', 'mountain', 'gate']) if (n[k]) o[k] = n[k]; r = Roads.addNode(n.x, n.z, o); map.set(n, r); } return r; };
    for (const s of this.segs) if (s.alive) { const e = Roads.addEdge(rn(s.a), rn(s.b), s.type, s.bend); if (e && s.f) Object.assign(e, s.f); s.e = e; }
    this.map = map; },
};
// Bogen zwischen zwei Knoten auf einem Kreis um C (nach außen gewölbt)
function arcLink(a, b, C, r, n, type = 'street', f = null) { const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, mx = (a.x + b.x) / 2 - C.x, mz = (a.z + b.z) / 2 - C.z, sg = Math.sign(-dz / L * mx + dx / L * mz) || 1;
  Net.link(a, b, type, 2 * r * (1 - Math.cos(Math.PI / n)) * sg * 0.9, f); }
const cum = (arr) => { const out = [0]; for (const w of arr) out.push(out[out.length - 1] + w); const h = out[out.length - 1] / 2; return out.map(v => v - h); };
// Raster mit variablen Abständen, leichtem Verzug und optional fehlenden Kanten
function gridNet(C, rot, us, vs, o = {}) {
  const c = Math.cos(rot), s = Math.sin(rot), g = [], seed = o.seed || 1;
  for (let i = 0; i < us.length; i++) { g.push([]); for (let j = 0; j < vs.length; j++) {
    const lx = us[i] + fbm(i * 1.7 + seed, j * 1.3, 2) * (o.warp || 0), lz = vs[j] + fbm(i * 1.1, j * 1.9 + seed, 2) * (o.warp || 0); let x = C.x + lx * c - lz * s, z = C.z + lx * s + lz * c;
    for (let k = 0; k < 40 && islandE(x, z) < (o.minE ?? 0.05); k++) { x += (C.x - x) * 0.05; z += (C.z - z) * 0.05; }
    g[i].push(Net.node(x, z)); } }
  const skip = o.skip || (() => false), T = o.type || 'street';
  for (let i = 0; i < us.length; i++) for (let j = 0; j < vs.length; j++) {
    if (i < us.length - 1 && !skip(i, j, 'u')) Net.link(g[i][j], g[i + 1][j], T, sr(-1, 1) * (o.bend || 0), (o.fu && o.fu(i, j)) || o.f || null);
    if (j < vs.length - 1 && !skip(i, j, 'v')) Net.link(g[i][j], g[i][j + 1], T, sr(-1, 1) * (o.bend || 0), (o.fv && o.fv(i, j)) || o.f || null); }
  return g;
}
const border = (g) => { const out = []; for (let i = 0; i < g.length; i++) for (let j = 0; j < g[0].length; j++) if (i === 0 || j === 0 || i === g.length - 1 || j === g[0].length - 1) out.push(g[i][j]); return out; };
// Verbindung zum nächsten passenden Knoten, wenn der Weg frei ist (kein Wasser, kein fremder Bezirk)
function pathOK(a, b, allowDist = null) { const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(L / 20); let hmax = -1e9, hmin = 1e9;
  for (let k = 1; k < n; k++) { const t = k / n, x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t); if (islandE(x, z) < 0.012 || inLake(x, z, 10) || inBase(x, z, 25)) return false;
    const D = distAt(x, z, -25); if (D && D !== allowDist && !(Math.hypot(x - a.x, z - a.z) < 60 || Math.hypot(x - b.x, z - b.z) < 60)) return false; const h = rawHeight(x, z); hmax = Math.max(hmax, h); hmin = Math.min(hmin, h); }
  return (hmax - hmin) / Math.max(L, 1) < 0.22; }

function buildRoadNetwork() {
  // 1) Downtown: unregelmäßiges Raster, Diagonal-Boulevard, Park-Superblock, Bayfront folgt der Küste
  const dtU = cum([84, 98, 74, 106, 88]), dtV = cum([92, 78, 108, 86, 100, 82]);
  const dt = gridNet(DOWNTOWN, 0.1, dtU, dtV, { warp: 6, seed: 3.3, fu: (i, j) => (j % 3 === 0 ? null : { hw: 5.4 }), fv: (i, j) => (i === 2 || i === 5 ? null : { hw: 5.8 }), skip: (i, j, d) => (d === 'u' && j === 2 && (i === 0 || i === 1)) || (d === 'v' && i === 1 && (j === 1 || j === 2)) || (d === 'v' && i === 4 && j === 4) });
  for (let k = 0; k < 5; k++) Net.link(dt[k][6 - k], dt[k + 1][5 - k], 'street', 0);
  { const p = dt[1][2]; LOC.cbdPark = V3(p.x, 0, p.z); }
  zoneRect('downtown', DOWNTOWN.x, DOWNTOWN.z, 0.1, 265, 315);
  // 2) Edgewater (Uptown): gedrehtes Raster
  const up = gridNet(UPTOWN, 0.32, cum([90, 95, 85]), cum([92, 100, 88]), { warp: 10, bend: 6, seed: 4.4, fu: (i, j) => (j === 1 ? null : { hw: 5.2 }) });
  zoneRect('uptown', UPTOWN.x, UPTOWN.z, 0.32, 170, 175);
  // 3) Little Havana (Midtown): schmale, lange Blöcke
  const mid = gridNet(MIDTOWN, -0.06, cum([56, 58, 54, 57, 55, 56]), cum([118, 122, 115]), { warp: 3, seed: 5.1, fv: (i, j) => (i === 3 ? null : { hw: 4.6 }), fu: (i, j) => (j === 1 || j === 2 ? null : { hw: 5.0 }) });
  zoneRect('midtown', MIDTOWN.x, MIDTOWN.z, -0.06, 198, 207);
  // 4) Altstadt: Kreisverkehr, Radialstraßen, zwei Ringe
  const O = OLDTOWN, round = [], inner = [], ring2 = [], exits = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.26; round.push(Net.node(O.x + Math.cos(a) * 26, O.z + Math.sin(a) * 26)); }
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + 0.28, r = 115 + sr(-6, 6); inner.push(Net.node(O.x + Math.cos(a) * r, O.z + Math.sin(a) * r)); }
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + 0.33, r = 200 + sr(-8, 8); ring2.push(Net.node(O.x + Math.cos(a) * r, O.z + Math.sin(a) * r)); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.42, r = 272; exits.push(Net.node(O.x + Math.cos(a) * r, O.z + Math.sin(a) * r)); }
  for (let k = 0; k < 6; k++) arcLink(round[k], round[(k + 1) % 6], O, 26, 6);
  for (let k = 0; k < 6; k++) Net.link(round[k], inner[2 * k], 'street', sr(-3, 3));
  for (let k = 0; k < 12; k++) { arcLink(inner[k], inner[(k + 1) % 12], O, 115, 12, 'street', { hw: 4.6 }); Net.link(inner[k], ring2[k], 'street', sr(-4, 4), k % 2 ? { hw: 4.2 } : null); arcLink(ring2[k], ring2[(k + 1) % 12], O, 200, 12, 'street', { hw: 5.0 }); }
  for (let k = 0; k < 6; k++) Net.link(ring2[2 * k], exits[k], 'street', sr(-6, 6));
  LOC.oldPlaza = V3(O.x, 0, O.z); zoneCirc('oldtown', O.x, O.z, 285);
  // 5) Hafen & Industrie
  const pt = gridNet(PORT, 0.02, cum([110, 115, 105]), cum([105, 100]), { warp: 4, seed: 5.5, minE: 0.02 });
  zoneRect('port', PORT.x, PORT.z, 0.02, 205, 165);
  const ind = gridNet(INDUS, 0.15, cum([120, 118]), cum([115, 125]), { warp: 6, seed: 6.6 });
  zoneRect('industrial', INDUS.x, INDUS.z, 0.15, 155, 155);
  // 6) Palm Heights: verzogenes Raster mit fehlenden Kanten & Sackgassen
  const sb = gridNet(SUBURB, -0.35, cum([78, 82, 76, 80, 78]), cum([80, 76, 82, 78, 80]), { warp: 24, bend: 16, seed: 9.1, skip: (i, j, d) => i > 0 && j > 0 && i < 4 && j < 4 && hash2(i * 3 + j, d === 'u' ? 11 : 23) < 0.16 });
  for (const [i, j, ox, oz] of [[0, 0, -50, -20], [5, 5, 55, 30], [0, 5, -45, 40], [5, 0, 40, -50], [2, 0, -10, -55], [0, 3, -55, 5]]) { const n = sb[i][j], c = Net.node(n.x + ox, n.z + oz, { culdesac: true }); Net.link(n, c, 'street', 10); }
  zoneCirc('suburb', SUBURB.x, SUBURB.z, 255);
  // 7) Kendall: Schleifenstraßen mit Sackgassen
  const K = SUBURB2, outer = [], inn = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + 0.2, r = 225 + sr(-14, 14); outer.push(Net.node(K.x + Math.cos(a) * r, K.z + Math.sin(a) * r)); }
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.5, r = 105 + sr(-8, 8); inn.push(Net.node(K.x + Math.cos(a) * r, K.z + Math.sin(a) * r)); }
  for (let k = 0; k < 10; k++) arcLink(outer[k], outer[(k + 1) % 10], K, 225, 10);
  for (let k = 0; k < 7; k++) arcLink(inn[k], inn[(k + 1) % 7], K, 105, 7);
  for (const j of [0, 2, 4, 5]) Net.link(inn[j], nearestOf(outer, K.x + (inn[j].x - K.x) * 2.1, K.z + (inn[j].z - K.z) * 2.1), 'street', sr(-8, 8));
  for (let k = 1; k < 10; k += 2) { const n = outer[k], d = Math.hypot(n.x - K.x, n.z - K.z); Net.link(n, Net.node(n.x + (K.x - n.x) / d * 58, n.z + (K.z - n.z) / d * 58, { culdesac: true }), 'street', 6); }
  for (const j of [1, 3, 6]) { const n = inn[j], d = Math.hypot(n.x - K.x, n.z - K.z); Net.link(n, Net.node(n.x + (n.x - K.x) / d * 50, n.z + (n.z - K.z) / d * 50, { culdesac: true }), 'street', 5); }
  zoneCirc('suburb', K.x, K.z, 262);
  // 8) Coral Heights: Serpentinen am Villenhügel
  const H = HEIGHTS, arcs = [];
  for (const [r, a0, a1, n] of [[95, -0.3, 3.4, 6], [180, -0.25, 3.35, 9], [262, -0.15, 3.25, 11]]) { const arr = []; for (let k = 0; k < n; k++) { const a = lerp(a0, a1, k / (n - 1)); arr.push(Net.node(H.x + Math.cos(a) * r, H.z + Math.sin(a) * r)); }
    for (let k = 0; k < n - 1; k++) arcLink(arr[k], arr[k + 1], H, r, (n - 1) * TAU / (a1 - a0) / 2 * 2); arcs.push(arr); }
  Net.link(arcs[0][0], arcs[1][0], 'street', 8); Net.link(arcs[1][arcs[1].length - 1], arcs[2][arcs[2].length - 1], 'street', -8); Net.link(arcs[0][5], arcs[1][8], 'street', 6); Net.link(arcs[1][4], arcs[2][5], 'street', 0);
  zoneCirc('heights', H.x, H.z, 300);
  // 9) Dörfer
  const vg = gridNet(VILLAGE, -0.15, cum([62, 60, 64]), cum([60, 62]), { warp: 9, bend: 8, seed: 7.7 }); zoneCirc('village', VILLAGE.x, VILLAGE.z, 150);
  const vg2 = gridNet(VILLAGE2, 0.4, cum([58, 56]), cum([58, 60]), { warp: 10, bend: 8, seed: 8.8 }); zoneCirc('village', VILLAGE2.x, VILLAGE2.z, 125);
  // 10) Solara Beach: Ocean Drive, Collins Avenue, Alton Road + Querstraßen
  const ocean = [], collins = [], alton = []; let z = -1330, k = 0;
  while (z < 1075) { const cx = beachCX(z); collins.push(Net.node(cx + 22, z, { collins: true })); ocean.push(Net.node(cx + 108, z, { ocean: true })); if (k % 2 === 0) alton.push(Net.node(cx - 92, z)); z += sr(96, 118); k++; }
  for (let i = 0; i < collins.length - 1; i++) { Net.link(collins[i], collins[i + 1], 'street', sr(-3, 3)); Net.link(ocean[i], ocean[i + 1], 'street', sr(-4, 4)); }
  for (let i = 0; i < alton.length - 1; i++) Net.link(alton[i], alton[i + 1], 'street', sr(-5, 5));
  for (let i = 0; i < collins.length; i++) { if (i % 5 !== 3 || i === 0 || i === collins.length - 1) Net.link(ocean[i], collins[i], 'street', 0); if (i % 2 === 0) Net.link(collins[i], alton[i / 2], 'street', 0); }
  if (collins.length % 2 === 0) Net.link(collins[collins.length - 1], alton[alton.length - 1], 'street', 4);
  // 11) Highways: I-95 (Nord-Süd) und Dolphin Expressway (Ost-West)
  const hw1 = [[252, -930], [262, -430], [258, 100], [240, 600], [228, 905], [240, 1215]].map(([x, z]) => Net.node(x, z));
  for (let i = 0; i < hw1.length - 1; i++) Net.link(hw1[i], hw1[i + 1], 'highway', sr(-10, 10));
  const gate = Net.node(BASE.x + BASE.hx + 22, BASE.z + 60, { gate: true });
  const hw2 = [gate, ...[[-1060, 250], [-800, 20], [-450, -15], [-150, -5], [258, 100]].map(([x, z]) => Net.node(x, z))];
  for (let i = 0; i < hw2.length - 1; i++) Net.link(hw2[i], hw2[i + 1], 'highway', i === 0 ? 0 : sr(-14, 14));
  Net.link(hw1[0], nearestOf(arcs[2], hw1[0].x, hw1[0].z), 'street', 10);
  // 12) Küstenstraße rund ums Festland (unterbrochen in den Stadtbezirken)
  const RC = { x: -480, z: -30 }, rp = [];
  for (let k = 0; k < 60; k++) { const th = k / 60 * TAU, cs = Math.cos(th), sn = Math.sin(th); let r = 2350; for (; r > 200; r -= 6) if (mainSD(RC.x + cs * r, RC.z + sn * r) > 0) break;
    const x = RC.x + cs * (r - 118), z = RC.z + sn * (r - 118), D = distAt(x, z, 30); rp.push({ x, z, ok: !(D && D.k !== 'suburb' && D.k !== 'village') && !inBase(x, z, 60) && !inLake(x, z, 30) }); }
  const ring = []; let start = rp.findIndex(p => !p.ok); if (start < 0) start = 0;
  let prev = null;
  for (let q = 1; q <= rp.length; q++) { const p = rp[(start + q) % rp.length];
    if (!p.ok) { if (prev) { const t = Net.nearestNode(prev.x, prev.z, 330, n => n !== prev && !n.ring); if (t) Net.link(prev, t, 'street', 0); } prev = null; continue; }
    const n = Net.node(p.x, p.z, { ring: true }); ring.push(n);
    if (prev) Net.link(prev, n, 'highway', sr(-12, 12)); else { const t = Net.nearestNode(p.x, p.z, 330, m => m !== n && !m.ring); if (t) Net.link(t, n, 'street', 0); }
    prev = n; }
  // 13) Dämme über die Bucht + Star Island + Keys
  const shoreE = (x0, z0) => { let x = x0; while (islandE(x, z0) > 0.01 && x < 1300) x += 6; return Net.node(x - 12, z0); };
  { const z0 = -1060, A = shoreE(380, z0), B = nearestOf(alton, beachCX(z0) - 92, z0); Net.link(Net.attach(A.x - 60, A.z, 260) || A, A, 'street', 0); Net.causeway(A, B); }
  { const a = dt[5][3], S = Net.node(STAR.x, lerp(a.z, a.z + 10, 0.5) + 8), B = nearestOf(alton, beachCX(a.z) - 92, a.z); Net.causeway(a, S); Net.causeway(S, B);
    const sr4 = []; for (let q = 0; q < 6; q++) { const t = q / 6 * TAU - Math.PI / 2; sr4.push(Net.node(STAR.x + Math.cos(t) * 40, STAR.z + Math.sin(t) * 40)); } for (let q = 0; q < 6; q++) arcLink(sr4[q], sr4[(q + 1) % 6], STAR, 40, 6);
    Net.causeway(S, sr4[0]); }
  { const z0 = 600, A = shoreE(520, z0), B = nearestOf(alton, beachCX(z0) - 92, z0); Net.link(Net.attach(A.x - 80, A.z, 260) || A, A, 'street', 0); Net.causeway(A, B); }
  { let p = collins[collins.length - 1]; for (const Kk of KEYS) { const n = Net.node(Kk.x, Kk.z); Net.causeway(p, n); p = n; }
    const lt = Net.node(KEYS[2].x + 10, KEYS[2].z + 58, { culdesac: true }); Net.link(p, lt, 'service', 6); LOC.lighthouse = V3(KEYS[2].x + 22, 0, KEYS[2].z + 74); }
  // 14) Bergstraße (Serpentine) auf Mount Leona
  const spiral = []; const a0 = Math.atan2(SUBURB.z - MOUNT.z, SUBURB.x - MOUNT.x);
  for (let q = 0; q <= 10; q++) { const a = a0 + q * 0.85, r = lerp(330, 44, q / 10); spiral.push(Net.node(MOUNT.x + Math.cos(a) * r, MOUNT.z + Math.sin(a) * r, { mountain: true })); }
  for (let q = 0; q < spiral.length - 1; q++) Net.link(spiral[q], spiral[q + 1], 'street', 22);
  LOC.summit = V3(MOUNT.x, 0, MOUNT.z);
  // 15) Landstraßen: lockeres Netz aus Wegpunkten, verbunden mit Dörfern und Bezirken
  const rural = [];
  for (let gx = -1850; gx <= 950; gx += 300) for (let gz = -1700; gz <= 1700; gz += 300) { const x = gx + sr(-100, 100), z = gz + sr(-100, 100);
    if (mainSD(x, z) < 110 || distAt(x, z, 70) || inUrban(x, z) || inBase(x, z, 90) || inLake(x, z, 40) || rawHeight(x, z) > 120 || Math.hypot(x - MOUNT.x, z - MOUNT.z) < 300 || Math.hypot(x - SWAMP.x, z - SWAMP.z) < SWAMP.r * 0.55) continue;
    rural.push(Net.node(x, z)); }
  const done = new Set();
  for (const a of rural) { const nb = rural.filter(b => b !== a).map(b => [b, Math.hypot(b.x - a.x, b.z - a.z)]).filter(([, d]) => d < 460).sort((p, q) => p[1] - q[1]).slice(0, 2);
    for (const [b] of nb) { const key = Math.min(a.i, b.i) + '_' + Math.max(a.i, b.i); if (done.has(key)) continue; done.add(key); if (pathOK(a, b)) Net.link(a, b, 'street', sr(-48, 48)); } }
  // Anschlüsse: Bezirksränder, Dörfer, Basis, Berg, Ring → nächster Landweg
  const exitsOf = [border(sb), border(vg), border(vg2), outer, exits, border(mid), border(ind), border(up), arcs[2], [spiral[0]], [gate], ring.filter((_, q) => q % 3 === 0), [hw2[2], hw2[3]], border(pt)];
  for (const list of exitsOf) { let made = 0; const D0 = list[0] ? distAt(list[0].x, list[0].z, 40) : null;
    const cand = []; for (const n of list) for (const r of rural) { const d = Math.hypot(r.x - n.x, r.z - n.z); if (d < 420 && d > 25) cand.push([n, r, d]); }
    cand.sort((p, q) => p[2] - q[2]);
    for (const [n, r] of cand) { if (made >= 3) break; if (n.segs.some(s => s.a === r || s.b === r)) continue; if (pathOK(n, r, D0)) { Net.link(n, r, 'street', sr(-18, 18)); made++; } } }
  // direkte Verbindungen zwischen Nachbarbezirken
  const tie = (A, B, n = 2) => { const c = []; for (const a of A) for (const b of B) c.push([a, b, Math.hypot(a.x - b.x, a.z - b.z)]); c.sort((p, q) => p[2] - q[2]); let m = 0, used = new Set();
    for (const [a, b, d] of c) { if (m >= n || d > 420) break; if (used.has(a) || used.has(b)) continue; used.add(a); used.add(b); Net.link(a, b, 'street', sr(-10, 10)); m++; } };
  tie(border(dt), hw1, 3); tie(border(mid), hw1, 2); tie(border(up), hw1, 2); tie(border(up), border(dt), 2); tie(exits, hw1, 2); tie(exits, border(mid), 2); tie(border(mid), border(sb), 2); tie(border(ind), border(pt), 2); tie(border(ind), hw1, 2); tie(border(pt), hw1, 2);
  tie(outer, border(ind), 2); tie(outer, border(sb), 1); tie(border(mid), border(ind), 1); tie(arcs[2], border(up), 1); tie(border(dt), border(pt), 1); tie(exits, arcs[2], 1);
  Net.link(hw2[hw2.length - 1], dt[0][5], 'street', 0);
  // Sumpf: Schotterweg auf dem Damm
  { const sw = Net.node(SWAMP.x + 40, SWAMP.z - 30), t = Net.nearestNode(sw.x, sw.z, 700, n => n !== sw); if (t) Net.link(t, sw, 'service', 30, { dirt: true }); LOC.swamp = V3(sw.x, 0, sw.z); }
  // 16) Große Blöcke organisch in kleinere teilen (schmale Nebenstraßen, schräge Schnitte, T-Kreuzungen)
  const zoneNet = (x, z) => { const D = distAt(x, z); return D ? D.k : inUrban(x, z) ? 'urban' : 'none'; };
  const SUB = { downtown: { max: 135, ang: 0.1, bend: 0, f: { hw: 5.2 } }, uptown: { max: 85, ang: 0.28, bend: 4, f: { hw: 4.8 } }, oldtown: { max: 82, ang: 0.35, bend: 5, f: { hw: 3.8 } }, urban: { max: 100, ang: 0.33, bend: 7, f: { hw: 4.8 } },
    village: { max: 75, ang: 0.3, bend: 5, f: { hw: 4.0 } }, port: { max: 175, ang: 0.06, bend: 0, f: { hw: 6.0 } }, industrial: { max: 150, ang: 0.1, bend: 0, f: { hw: 6.0 } } };
  Net.subdivide((f) => { const P = f.pts; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cnt = {}; let n = 0; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const x = lerp(x0, x1, (i + 0.5) / 6), z = lerp(z0, z1, (j + 0.5) / 6); if (!pip(x, z, P)) continue; n++; const k = zoneNet(x, z); cnt[k] = (cnt[k] || 0) + 1; }
    if (!n) return null; if ((cnt.urban || 0) / n >= 0.3) return SUB.urban; let best = null, bc = 0; for (const k in cnt) if (cnt[k] > bc) { bc = cnt[k]; best = k; } return SUB[best] || null; },
    [LOC.cbdPark, { x: DOWNTOWN.x + 30, z: DOWNTOWN.z - 300 }]);
  Net.finalize();
  const R = (n) => Net.map.get(n) || Roads.nearestNode(n.x, n.z), R2 = (g) => g.map(row => row.map(R));
  Roads.groups = { ring: ring.map(R), dt: R2(dt), sb: R2(sb), pt: R2(pt), spiral: spiral.map(R), collins: collins.map(R), ocean: ocean.map(R), alton: alton.map(R), up: R2(up), mid: R2(mid), ind: R2(ind), vg: R2(vg), vg2: R2(vg2), old: [...round, ...inner, ...ring2, ...exits].map(R), kendall: outer.map(R), heights: arcs.flat().map(R), hw1: hw1.map(R), hw2: hw2.map(R) };
  LOC.baseGate = V3(gate.x, 0, gate.z);
  Roads.sampleAll();
  // Baublöcke (Flächen zwischen Straßen) mit echten Straßenverläufen
  Roads.blocks = Net.faces().filter(f => f.loop.every(([s]) => s.e)).map(f => { const loop = f.loop.map(([s, fwd]) => [s.e, fwd]), pts = [];
    for (const [e, fwd] of loop) { const P = fwd ? e.pts : [...e.pts].reverse(); for (let k = 0; k < P.length - 1; k++) pts.push([P[k].x, P[k].z]); } return { loop, pts, area: Math.abs(f.area), cx: f.cx, cz: f.cz }; });
}

// Gelände unter Straßen einebnen (Höhenprofil der Straße übernehmen)
function carveRoads() {
  const best = new Float32Array(GN * GN).fill(1e9), tgt = new Float32Array(GN * GN), hwA = new Float32Array(GN * GN);
  const visit = (x, z, y, hw, R) => { const i0 = Math.max(0, Math.floor((x - R + WS) / CELL)), i1 = Math.min(GN - 1, Math.ceil((x + R + WS) / CELL)), j0 = Math.max(0, Math.floor((z - R + WS) / CELL)), j1 = Math.min(GN - 1, Math.ceil((z + R + WS) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const vx = -WS + i * CELL, vz = -WS + j * CELL, d = Math.hypot(vx - x, vz - z), k = j * GN + i; if (d < best[k]) { best[k] = d; tgt[k] = y; hwA[k] = hw; } } };
  for (const e of Roads.edges) for (const p of e.pts) visit(p.x, p.z, p.y, e.hw + 3.5, e.hw + 16);
  for (const n of Roads.nodes) visit(n.x, n.z, n.y, n.r + 3, n.r + 16);
  for (let k = 0; k < GN * GN; k++) { if (best[k] > 1e8) continue; const hw = hwA[k], d = best[k], w = d <= hw ? 1 : 1 - sstep(hw, hw + 12, d); HGT[k] = lerp(HGT[k], tgt[k] - 0.12, w); }
}

