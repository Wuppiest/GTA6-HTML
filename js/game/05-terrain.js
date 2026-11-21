
// =====================================================================
//  WELT: Gelände (Höhenfeld), organisches Straßennetz, Bebauung, Kollision
// =====================================================================
const WS = CFG.WORLD, GN = CFG.GRID, CELL = 2 * WS / (GN - 1);
const DOWNTOWN = { x: 230, z: 80 }, SUBURB = { x: -330, z: 320 }, PORT = { x: 540, z: 660 }, MOUNT = { x: -350, z: -450 }, BASE = { x: -760, z: 0, hx: 125, hz: 430, h: 9 };
const HEIGHTS = { x: 430, z: -420 }, VILLAGE = { x: -120, z: 650 };
const LOC = {}; const PARKED = []; const PICKUP_SPOTS = [];
function islandE(x, z) { return 1 - Math.hypot(x / 1080, z / 1000) + fbm(x * 0.0022 + 5.3, z * 0.0022 - 2.1, 3) * 0.14; }
function rawHeight(x, z) {
  const e = islandE(x, z);
  let land = 1.2 + sstep(0, 0.06, e) * 2.2 + Math.max(0, e - 0.06) * 28 + fbm(x * 0.0035, z * 0.0035, 4) * 22 * sstep(0.08, 0.3, e);
  land += 178 * Math.exp(-((x - MOUNT.x) ** 2 + (z - MOUNT.z) ** 2) / (2 * 190 * 190)) * (0.85 + 0.3 * fbm(x * 0.012, z * 0.012, 3));
  land += 48 * Math.exp(-((x + 80) ** 2 + (z + 760) ** 2) / (2 * 150 * 150));
  return e >= 0 ? land : Math.max(-30, 1.2 + e * 160);
}
const PEAK_H = rawHeight(MOUNT.x, MOUNT.z);
const FLAT = [
  { type: 'circle', x: DOWNTOWN.x, z: DOWNTOWN.z, r0: 360, r1: 470, h: 5 },
  { type: 'circle', x: PORT.x, z: PORT.z + 40, r0: 175, r1: 235, h: 3, sea: true },
  { type: 'rect', x: BASE.x, z: BASE.z, hx: BASE.hx, hz: BASE.hz, b: 80, h: BASE.h },
  { type: 'circle', x: MOUNT.x, z: MOUNT.z, r0: 32, r1: 70, h: PEAK_H - 3 },
  { type: 'circle', x: VILLAGE.x, z: VILLAGE.z, r0: 90, r1: 170, h: null },
];
function baseHeight(x, z) {
  let h = rawHeight(x, z), e = null;
  for (const f of FLAT) {
    let w; if (f.type === 'circle') { const d = Math.hypot(x - f.x, z - f.z); w = 1 - sstep(f.r0, f.r1, d); }
    else { const dx = Math.max(0, Math.abs(x - f.x) - f.hx), dz = Math.max(0, Math.abs(z - f.z) - f.hz); w = 1 - sstep(0, f.b, Math.hypot(dx, dz)); }
    if (w <= 0) continue; if (f.h === null) { f.h = rawHeight(f.x, f.z); } if (!f.sea) { if (e === null) e = islandE(x, z); if (e < 0) w *= sstep(-0.03, 0, e); }
    h = lerp(h, f.h, w);
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
  updateLOD(cam) { for (const L of this.lod) { const d = Math.hypot(L.x - cam.x, L.z - cam.z), near = d < L.far; L.obj.visible = near; if (L.alt) L.alt.visible = !near && d < 900; } },
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
    for (const n of this.nodes) { let s = 0, c = 0; for (let k = 0; k < 6; k++) { s += terrainHeight(n.x + Math.cos(k) * 8, n.z + Math.sin(k) * 8); c++; } n.y = Math.max(1.6, s / c); }
    for (const n of this.nodes) n.r = Math.max(...n.edges.map(i => this.edges[i].hw)) + (n.edges.length >= 3 ? 2.0 : 1.0);
    for (const e of this.edges) {
      const A = this.nodes[e.a], B = this.nodes[e.b], dx = B.x - A.x, dz = B.z - A.z, L0 = Math.hypot(dx, dz);
      const mid = V3((A.x + B.x) / 2 - dz / L0 * e.bend, 0, (A.z + B.z) / 2 + dx / L0 * e.bend);
      const curve = new THREE.QuadraticBezierCurve3(V3(A.x, 0, A.z), mid, V3(B.x, 0, B.z));
      const L = curve.getLength(), n = Math.max(2, Math.ceil(L / 4)); const pts = curve.getSpacedPoints(n);
      const raw = pts.map(p => terrainHeight(p.x, p.z)), win = e.type === 'highway' ? 10 : 7, ys = [];
      for (let k = 0; k <= n; k++) { let s = 0, c = 0; for (let q = Math.max(0, k - win); q <= Math.min(n, k + win); q++) { s += raw[q]; c++; } ys.push(s / c); }
      const d0 = A.y - ys[0], d1 = B.y - ys[n];
      e.pts = pts.map((p, k) => { const t = k / n; const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n, k + 1)]; const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1; return { x: p.x, z: p.z, y: Math.max(1.4, ys[k] + lerp(d0, d1, t)), tx: tx / tl, tz: tz / tl, s: t * L }; });
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
    const N = this.nodes.length, dist = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N); dist[fromN] = 0;
    for (let it = 0; it < N; it++) { let u = -1, bd = 1e9; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; } if (u < 0 || u === toN) break; done[u] = 1;
      for (const ei of this.nodes[u].edges) { const e = this.edges[ei], v = this.other(e, u), nd = bd + e.len; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; } } }
    const out = []; let c = toN; while (c >= 0) { out.unshift(c); if (c === fromN) break; c = prev[c]; } return out[0] === fromN ? out : null;
  },
  nearestNode(x, z) { let b = null, bd = 1e18; for (const n of this.nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; },
  edgeBetween(a, b) { for (const ei of this.nodes[a].edges) { const e = this.edges[ei]; if (this.other(e, a) === b) return e; } return null; },
};
function coastRadius(th, eTarget) { for (let r = 1300; r > 100; r -= 4) { if (islandE(Math.cos(th) * r, Math.sin(th) * r) >= eTarget) return r; } return 200; }
function warpedGrid(cx, cz, rot, sp, ni, nj, warp, bend, seed) {
  const g = []; const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < ni; i++) { g.push([]); for (let j = 0; j < nj; j++) {
    const lx = (i - (ni - 1) / 2) * sp + fbm(i * 1.7 + seed, j * 1.3, 2) * warp, lz = (j - (nj - 1) / 2) * sp + fbm(i * 1.1, j * 1.9 + seed, 2) * warp;
    g[i].push(Roads.addNode(cx + lx * c - lz * s, cz + lx * s + lz * c)); } }
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    if (i < ni - 1) Roads.addEdge(g[i][j], g[i + 1][j], 'street', sr(-1, 1) * bend);
    if (j < nj - 1) Roads.addEdge(g[i][j], g[i][j + 1], 'street', sr(-1, 1) * bend);
  }
  return g;
}
function nearestOf(list, x, z) { let b = null, bd = 1e18; for (const n of list) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; }

function buildRoadNetwork() {
  // 1) Küsten-Highway als Ring
  const ring = [], K = 34;
  for (let k = 0; k < K; k++) { const th = k / K * Math.PI * 2; let r = coastRadius(th, 0.12); let x = Math.cos(th) * r, z = Math.sin(th) * r;
    if (Math.abs(z - BASE.z) < BASE.hz + 40 && x < BASE.x + BASE.hx + 30 && x > BASE.x - BASE.hx - 60) x = Math.min(x, BASE.x - BASE.hx - 45);
    ring.push(Roads.addNode(x, z, { ring: true })); }
  for (let k = 0; k < K; k++) Roads.addEdge(ring[k], ring[(k + 1) % K], 'highway', sr(-12, 12));
  // 2) Collins Avenue: Parallelstraße hinter dem Ocean Drive mit Querstraßen
  const collins = [];
  for (const k of [31, 32, 33, 0, 1, 2, 3, 4, 5]) { const n = ring[k], l = Math.hypot(n.x, n.z); collins.push(Roads.addNode(n.x - n.x / l * 82, n.z - n.z / l * 82, { collins: true })); }
  for (let i = 0; i < collins.length - 1; i++) Roads.addEdge(collins[i], collins[i + 1], 'street', sr(-5, 5));
  [31, 32, 33, 0, 1, 2, 3, 4, 5].forEach((k, i) => Roads.addEdge(collins[i], ring[k], 'street', 0));
  // 3) Downtown: gedrehtes, leicht verzogenes Raster mit Diagonalen
  const dt = warpedGrid(DOWNTOWN.x, DOWNTOWN.z, 0.25, 86, 6, 6, 10, 6, 3.3);
  Roads.addEdge(dt[0][0], dt[1][1], 'street', 5); Roads.addEdge(dt[4][4], dt[5][5], 'street', -5); Roads.addEdge(dt[4][1], dt[5][0], 'street', 4); Roads.addEdge(dt[1][4], dt[0][5], 'street', 4);
  // 4) Vorstadt Palm Heights (geschwungen, mit Sackgassen)
  const sb = warpedGrid(SUBURB.x, SUBURB.z, -0.35, 80, 5, 5, 22, 14, 9.1);
  for (const [i, j, ox, oz] of [[0, 0, -50, -20], [4, 4, 55, 30], [0, 4, -45, 40], [4, 0, 40, -50]]) { const n = sb[i][j]; Roads.addEdge(n, Roads.addNode(n.x + ox, n.z + oz, { culdesac: true }), 'street', 10); }
  // 5) Coral Heights (Hügelviertel im Norden) & Dorf San Lorenzo
  const hs = warpedGrid(HEIGHTS.x, HEIGHTS.z, 0.6, 78, 4, 3, 18, 16, 2.2);
  const vg = warpedGrid(VILLAGE.x, VILLAGE.z, -0.15, 62, 3, 3, 9, 8, 7.7);
  // 6) Hafen / Industrie
  const pt = warpedGrid(PORT.x, PORT.z - 30, 0.1, 95, 3, 3, 10, 6, 5.5);
  // 7) Verbindungen
  const coast = ring.concat(collins);
  for (const n of [dt[5][0], dt[5][2], dt[5][4], dt[3][0], dt[0][1]]) Roads.addEdge(n, nearestOf(coast, n.x + (n.x - DOWNTOWN.x), n.z + (n.z - DOWNTOWN.z)), 'street', sr(-25, 25));
  Roads.addEdge(dt[0][3], nearestOf(sb.flat(), dt[0][3].x, dt[0][3].z), 'street', 25);
  Roads.addEdge(dt[0][5], nearestOf(sb.flat(), dt[0][5].x, dt[0][5].z), 'street', -20);
  Roads.addEdge(dt[2][5], nearestOf(pt.flat(), dt[2][5].x, dt[2][5].z), 'street', 15);
  Roads.addEdge(dt[5][5], nearestOf(pt.flat(), dt[5][5].x + 40, dt[5][5].z), 'street', -15);
  Roads.addEdge(dt[2][0], nearestOf(hs.flat(), dt[2][0].x, dt[2][0].z), 'street', 20); Roads.addEdge(dt[5][1], nearestOf(hs.flat(), dt[5][1].x, dt[5][1].z), 'street', -15);
  for (const n of [hs[3][0], hs[0][0]]) Roads.addEdge(n, nearestOf(ring, n.x + (n.x - HEIGHTS.x), n.z + (n.z - HEIGHTS.z)), 'street', 10);
  for (const n of [pt[2][2], pt[0][2]]) Roads.addEdge(n, nearestOf(ring, n.x, n.z + 200), 'street', 10);
  for (const n of [sb[0][1], sb[1][4], sb[4][4]]) Roads.addEdge(n, nearestOf(ring, n.x - 150, n.z + 150), 'street', sr(-20, 20));
  Roads.addEdge(vg[0][0], nearestOf(sb.flat(), vg[0][0].x, vg[0][0].z), 'street', 15); Roads.addEdge(vg[2][2], nearestOf(ring, vg[2][2].x, vg[2][2].z + 150), 'street', -10);
  Roads.addEdge(vg[2][0], nearestOf(pt.flat(), vg[2][0].x + 200, vg[2][0].z), 'street', 20);
  // 8) Serpentine auf den Berg
  const spiral = []; const a0 = Math.atan2(SUBURB.z - MOUNT.z, SUBURB.x - MOUNT.x);
  for (let k = 0; k <= 10; k++) { const a = a0 + k * 0.85, r = lerp(330, 44, k / 10); spiral.push(Roads.addNode(MOUNT.x + Math.cos(a) * r, MOUNT.z + Math.sin(a) * r, { mountain: true })); }
  for (let k = 0; k < spiral.length - 1; k++) Roads.addEdge(spiral[k], spiral[k + 1], 'street', 22);
  Roads.addEdge(spiral[0], nearestOf(sb.flat(), spiral[0].x, spiral[0].z), 'street', 10);
  Roads.addEdge(spiral[0], nearestOf(ring, spiral[0].x - 100, spiral[0].z - 200), 'street', -15);
  LOC.summit = V3(MOUNT.x, 0, MOUNT.z);
  // 9) Militärbasis-Zufahrt
  const gate = Roads.addNode(BASE.x + BASE.hx + 22, BASE.z + 60, { gate: true });
  Roads.addEdge(gate, nearestOf(sb.flat(), gate.x, gate.z), 'street', 20); Roads.addEdge(gate, nearestOf(ring, gate.x - 50, gate.z + 300), 'street', -20); Roads.addEdge(gate, nearestOf(ring, gate.x - 50, gate.z - 300), 'street', 20);
  LOC.baseGate = V3(gate.x, 0, gate.z);
  // 10) Leuchtturm-Stichstraße
  const lth = -0.9; const lr = coastRadius(lth, 0.035); LOC.lighthouse = V3(Math.cos(lth) * lr, 0, Math.sin(lth) * lr);
  const lnode = Roads.addNode(LOC.lighthouse.x * 0.94, LOC.lighthouse.z * 0.94, { culdesac: true }); Roads.addEdge(lnode, nearestOf(ring, lnode.x, lnode.z), 'service', 8);
  Roads.groups = { ring, dt, sb, pt, spiral, collins, hs, vg };
  Roads.sampleAll();
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

