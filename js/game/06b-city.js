// =====================================================================
//  STADT & LAND: weitere Gebäudetypen, Bebauungsregeln je Viertel,
//  Hinterhof-Bebauung, Parks und Landschaft (Farmen, Felder, Golfplatz …)
// =====================================================================
const corners4 = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
PAL.old = ['#e8b04a', '#d8603a', '#4a8ab0', '#f0d8a0', '#c84a5a', '#5aa07a', '#f4e8d0', '#e88a6a', '#8a6ab0', '#f8c8a0', '#6ab0c0', '#f0c050'];
// Punkt an der Ostküste der Strandinsel (e = wie weit landeinwärts, in km Abstand)
function beachAt(z, e = 0) { let x = beachCX(z) + 40; while (islandE(x, z) > e && x < 1750) x += 2; return V3(x, 0, z); }
function shoreEast(x0, z0, e = 0) { let x = x0; while (islandE(x, z0) > e && x < 1750) x += 3; return V3(x, 0, z0); }
// Überlappung zweier gedrehter Rechtecke (Trennachsen-Test)
function obbHit(x, z, hx, hz, yaw, b, gap) {
  const c = Math.cos(yaw), s = Math.sin(yaw), A = [[c, -s], [s, c]], B = [[b.c, -b.s], [b.s, b.c]], dx = b.cx - x, dz = b.cz - z;
  for (const n of [A[0], A[1], B[0], B[1]]) { const dist = Math.abs(dx * n[0] + dz * n[1]), ra = hx * Math.abs(A[0][0] * n[0] + A[0][1] * n[1]) + hz * Math.abs(A[1][0] * n[0] + A[1][1] * n[1]), rb = b.hx * Math.abs(B[0][0] * n[0] + B[0][1] * n[1]) + b.hz * Math.abs(B[1][0] * n[0] + B[1][1] * n[1]);
    if (dist > ra + rb + gap) return false; }
  return true;
}
const PARKS = []; var FARM_TRACTORS = 0;
// Vegetations-Detailstufen: kleine Kacheln mit vollen Modellen, große Kacheln mit Ersatzmodellen
const VegLOD = { S: 120, B: 800, nearR: 125, shadowR: 95, cells: new Map(), list: [],
  cell(k) { let c = this.cells.get(k); if (!c) { const cx = Math.floor(k / 1000), cz = k % 1000; c = { x: -WS + (cx + 0.5) * this.S, z: -WS + (cz + 0.5) * this.S, near: [], far: [], on: false }; this.cells.set(k, c); this.list.push(c); } return c; },
  update(cam) { for (const c of this.list) { const d = Math.hypot(c.x - cam.x, c.z - cam.z), on = d < this.nearR, sh = d < this.shadowR; if (sh !== c.sh) { c.sh = sh; for (const m of c.near) m.castShadow = sh && m.userData.cast; } if (on === c.on) continue; c.on = on; for (const m of c.near) m.visible = on;
    for (const f of c.far) { const a = f.mesh.instanceMatrix; if (on) a.array.fill(0, f.start * 16, (f.start + f.count) * 16); else a.array.set(f.orig, f.start * 16); a.addUpdateRange(f.start * 16, f.count * 16); a.needsUpdate = true; } } } };
const inPark = (x, z) => PARKS.some(p => { const dx = x - p.x, dz = z - p.z, lx = dx * p.c - dz * p.s, lz = dx * p.s + dz * p.c; return Math.abs(lx) < p.hx && Math.abs(lz) < p.hz; });

// ---------- WEITERE GEBÄUDETYPEN (lokal: Breite x, Tiefe z, Front = +z) ----------
function towerH(L, base, amp, fall) { const dist = Math.hypot(L.x - DOWNTOWN.x, L.z - DOWNTOWN.z); return base + amp * Math.exp(-dist / fall) * sr(0.55, 1.2); }
function lobbyBase(F, w, d, h, c) { PB(F, 0, -2, 0, w + 1, h + 2, d + 1, c, { mat: 'concrete' }); facade(F, w + 1, d + 1, 0.5, 1, h, { sp: 4.2, ww: 3.6, wh: h - 1.6, sill: false, door: 0, style: 2 });
  PB(F, 0, h - 0.5, d / 2 + 2.2, w * 0.6, 0.3, 4, '#d8dce0', { mat: 'metal' }); PG(F, 0, h - 0.55, d / 2 + 4.1, w * 0.58, 0.06, 0.06, '#fff2d8'); }
function bGlassTower(F, w, d, L) {
  const H = clamp(towerH(L, 55, 190, 190), 42, 240), fac = spick(['facGlass', 'fac17', 'facGlass', 'facGrid', 'fac13', 'fac17']), tint = spick(['#ffffff', '#eaf2ff', '#eefff6', '#fff4e6', '#f0f0f0']), lobby = 6.5;
  lobbyBase(F, w, d, lobby, spick(['#8f8a82', '#6a6e74', '#b8b0a4']));
  const r = Math.min(w, d) * 0.24, shape = sri(0, 2);
  if (shape === 0) { PB(F, 0, lobby, 0, w - 2 * r, H - lobby, d, tint, { mat: fac }); PB(F, 0, lobby, 0, w, H - lobby, d - 2 * r, tint, { mat: fac }); for (const [sx, sz] of corners4) PC(F, sx * (w / 2 - r), lobby, sz * (d / 2 - r), r, H - lobby, tint, { seg: 10, mat: fac }); }
  else if (shape === 1) { PB(F, 0, lobby, 0, w, H - lobby, d, tint, { mat: fac }); for (const sx of [-1, 1]) PB(F, sx * (w / 2 + 0.3), lobby, 0, 0.6, H - lobby + 5, d * 0.5, '#d8dce0', { mat: 'metal', keep: true });
    for (let y = lobby + sr(16, 24); y < H - 8; y += sr(18, 30)) PB(F, 0, y, 0, w + 0.25, 1.1, d + 0.25, '#4a4e54', { mat: 'metal' }); }
  else { const H2 = H * sr(0.55, 0.7); PB(F, 0, lobby, 0, w, H2 - lobby, d, tint, { mat: fac }); PB(F, -w * 0.15, H2, -d * 0.1, w * 0.7, H - H2, d * 0.7, tint, { mat: fac }); PB(F, 0, H2, 0, w + 0.4, 1, d + 0.4, '#4a4e54', { mat: 'metal' }); }
  const crown = sri(0, 3);
  if (crown === 0) { PB(F, -w * (shape === 2 ? 0.15 : 0), H, 0, w * 0.45, 7, d * 0.45, tint, { mat: fac }); PC(F, 0, H + 7, 0, 0.35, 28, '#d0d4d8', { seg: 6, mat: 'metal', keep: true }); PG(F, 0, H + 35, 0, 0.6, 0.6, 0.6, '#ff2020', { keep: true }); }
  else if (crown === 1 && shape !== 2) part(F, G.pyr(), 0, H, 0, w * 0.95, sr(10, 22), d * 0.95, tint, { mat: fac });
  else if (crown === 2 && shape !== 2) { PB(F, 0, H, 0, w + 0.4, 1.2, d + 0.4, '#3a3e44', { mat: 'metal' }); PC(F, 0, H + 1.2, 0, Math.min(w, d) * 0.33, 0.15, '#55585e', { seg: 20 }); for (const [x, z, ww, dd] of [[-1.3, 0, 0.4, 3.4], [1.3, 0, 0.4, 3.4], [0, 0, 2.2, 0.4]]) PB(F, x, H + 1.36, z, ww, 0.02, dd, '#f0f0f0', { keep: true }); }
  else { PB(F, 0, H, 0, w * (shape === 2 ? 0.7 : 1) + 0.2, 3, d * (shape === 2 ? 0.7 : 1) + 0.2, '#2a2e34', { mat: 'metal' }); PG(F, 0, H + 3, 0, w * (shape === 2 ? 0.7 : 1) + 0.25, 0.25, d * (shape === 2 ? 0.7 : 1) + 0.25, spick(PAL.neon)); }
  if (srand() < 0.5) signF(F, spick(['SOLARA BANK', 'VICE TOWER', 'NEXUS', 'OCEANIC', 'AURORA', 'PALMCORP', 'HELIX', 'MERIDIAN', 'BAYVIEW', 'LEONIDA TRUST', 'KAITO', 'ZENITH']), spick(PAL.neon), 0, Math.min(H * 0.6, H - 10), d / 2 + 0.5, Math.min(22, w * 0.8), 4);
  return { top: H + (crown === 1 ? 10 : 1), flat: crown === 2 && shape !== 2 };
}
function bSteppedTower(F, w, d, L) { // Art-déco-Stufenturm
  const H = clamp(towerH(L, 48, 140, 210), 38, 175), fac = spick(['fac13', 'fac15', 'fac12', 'fac17']), stone = spick(['#e8dcc8', '#d8ccb8', '#f0e6d4', '#c8bca8']);
  PB(F, 0, -2, 0, w + 0.6, 8, d + 0.6, stone, { mat: 'concrete' }); facade(F, w + 0.6, d + 0.6, 0.4, 1, 5.6, { sp: 3.6, ww: 2.8, wh: 4, sill: false, door: 0, style: 2 });
  let y = 6, cw = w, cd = d; const tiers = [0.55, 0.78, 0.92, 1];
  for (let t = 0; t < 4 && cw > 6; t++) { const top = H * tiers[t]; PB(F, 0, y, 0, cw, top - y, cd, '#ffffff', { mat: fac }); for (const [sx, sz] of corners4) PB(F, sx * cw / 2, y, sz * cd / 2, 0.8, top - y, 0.8, stone, { mat: 'concrete', keep: true });
    PB(F, 0, top, 0, cw + 0.6, 1.2, cd + 0.6, stone, { mat: 'concrete' }); y = top + 1.2; cw *= 0.76; cd *= 0.76; }
  for (let i = -2; i <= 2; i++) PB(F, i * w / 6, 6, d / 2 + 0.2, 0.5, H * 0.55 - 6, 0.5, stone, { mat: 'concrete', keep: true });
  PC(F, 0, y, 0, 0.6, 16, '#d8d0c0', { seg: 8, mat: 'metal', keep: true }); part(F, G.cone(8), 0, y + 16, 0, 1.4, 6, 1.4, '#d4af37', { mat: 'metal', keep: true });
  PG(F, 0, H * 0.55 + 1.3, d / 2 + 0.35, w * 0.9, 0.12, 0.12, spick(['#ffd9a0', '#22e4ff', '#ff2d95']), { keep: true });
  return { top: H, flat: false };
}
function bOffice(F, w, d, L, o = {}) {
  const floors = o.floors || sri(5, 12), fh = 3.6, H = 5 + floors * fh, c = spick(['#e8e4dc', '#d8d4cc', '#c8ccd0', '#f0ece4', '#b8b4ac', '#dcd0c0']), band = spick(['#5a6068', '#3a4048', '#7a8088', '#2a4a5a']);
  PB(F, 0, -2, 0, w + 0.4, 2.3, d + 0.4, '#8a857c', { mat: 'concrete' }); PB(F, 0, 0.3, 0, w, H, d, c, { mat: 'concrete' });
  facade(F, w, d, 0.3, 1, 5, { sp: 3.8, ww: 3.1, wh: 3.6, sill: false, door: 0, style: 2 });
  facade(F, w, d, 5.3, floors, fh, { sp: 2.7, ww: 2.3, wh: 2.2, sill: false, style: 1 });
  for (let f = 0; f <= floors; f += 1) PB(F, 0, 5 + f * fh - 0.2, 0, w + 0.2, 0.35, d + 0.2, band, { mat: 'metal' });
  PB(F, 0, 0.3 + H, 0, w + 0.3, 1, d + 0.3, band, { mat: 'metal' }); roofStuff(F, w, d, 1.3 + H, 3);
  if (srand() < 0.55) Signs.quad(F, 0, 4.2, d / 2 + 0.25, Math.min(w * 0.6, 12), 1, 0, Signs.cell(spick(['SOLARA MEDIA', 'GULF INSURANCE', 'LAW OFFICES', 'CORAL BANK', 'TECHNO SUR', 'LEONIDA STATE', 'BAY CAPITAL']), '#1a2a3a', '#fff', 2));
  return { top: 1.3 + H, flat: true };
}
function bParking(F, w, d, L) { // Parkhaus mit offenen Decks
  const lv = sri(3, 6), fh = 3.1, c = '#b8b4ac';
  for (let i = 0; i <= lv; i++) { PB(F, 0, i ? i * fh - 0.35 : -1.5, 0, w, i ? 0.35 : 1.8, d, c, { mat: 'concrete' });
    if (i) { for (const sz of [-1, 1]) PB(F, 0, i * fh, sz * (d / 2 - 0.15), w, 1.0, 0.3, '#d8d4cc', { mat: 'concrete', keep: true }); for (const sx of [-1, 1]) PB(F, sx * (w / 2 - 0.15), i * fh, 0, 0.3, 1.0, d, '#d8d4cc', { mat: 'concrete', keep: true });
      PG(F, 0, i * fh - 0.42, 0, w * 0.8, 0.05, 0.12, '#eaf2ff'); if (srand() < 0.7) propCar(FRL(F, 0, i * fh, 0), sr(-w / 2 + 3, w / 2 - 3), sr(-d / 2 + 3, d / 2 - 3), Math.PI / 2 * sri(0, 1), spick(PAL.car)); } }
  const nx = Math.max(1, Math.round(w / 8)); for (let k = 0; k <= nx; k++) { const x = -w / 2 + 0.4 + k * (w - 0.8) / nx; for (const z of [-d / 2 + 0.4, 0, d / 2 - 0.4]) PB(F, x, 0, z, 0.6, lv * fh, 0.6, c, { mat: 'concrete', keep: true }); }
  Signs.quad(F, -w / 2 + 4, fh * 0.55, d / 2 + 0.06, 5, 1.2, 0, Signs.cell('P  PARKING', '#1f4fa0', '#fff'));
  return { top: lv * fh, flat: true };
}
// schmales Stadthaus (Little Havana, Altstadt, Dörfer): bunte Fassade, Laden, Balkone
function bTownRow(F, w, d, L, o = {}) {
  const floors = o.floors || sri(2, 4), fh = 3.2, H = 4 + (floors - 1) * fh, wall = o.wall || spick(o.old ? PAL.old : PAL.pastel), trim = spick(['#ffffff', '#f4ecdc', '#e8dcc8']), det = Q().detail;
  WIN_STYLE = o.old ? 0 : srand() < 0.5 ? 0 : 3;
  PB(F, 0, -2, 0, w, 2.3, d, '#a8a296', { mat: 'concrete' }); PB(F, 0, 0.3, 0, w - 0.1, H, d, wall, { mat: 'plaster' });
  const shop = o.shop ?? srand() < 0.6;
  if (shop) { const sh = spick(SHOPS); PW(F, 0, 2.0, d / 2 + 0.06, w - 2.2, 2.6, 0, 0xffe2b0, 2); awning(F, 0, 3.5, d / 2, w - 0.8, sh[1] === '#fff' ? sh[2] : sh[1]); Signs.quad(F, 0, 3.85, d / 2 + 0.09, (w - 1.5) * 0.85, 0.65, 0, Signs.cell(sh[0], sh[1], sh[2])); }
  else { PB(F, -w * 0.25, 0.3, d / 2 + 0.03, 1.1, 2.3, 0.1, spick(['#5a3a20', '#2a4a6a', '#7a2a2a'])); facade(F, w, d, 0.3, 1, 3.8, { only: [0], door: -w * 0.25, sp: 2.6, ww: 1.1, wh: 1.7, shutters: o.old ? spick(PAL.accent) : null }); }
  if (floors > 1) facade(F, w, d, 4.2, floors - 1, fh, { only: [0, Math.PI], sp: 2.6, ww: 1.1, wh: 1.7, shutters: srand() < 0.5 ? spick(['#2a6a4a', '#1f4fa0', '#a03a2a', '#d8a030', '#ffffff']) : null, lintel: srand() < 0.5 ? trim : null });
  if (det > 0 && floors > 1 && srand() < 0.7) for (let f = 1; f < floors; f++) { const y = 4 + (f - 1) * fh; PB(F, 0, y, d / 2 + 0.55, w * 0.7, 0.14, 1.1, trim, { mat: 'concrete' }); railing(F, -w * 0.35, d / 2 + 1.08, w * 0.35, d / 2 + 1.08, y + 0.14, 0.9, spick(['#1a1a1a', '#f0f0f0', '#2a4a3a']), 0.25); }
  PB(F, 0, 0.3 + H, 0, w + 0.1, 0.5, d + 0.1, trim, { mat: 'concrete' });
  const tiled = o.old && srand() < 0.6;
  if (tiled) part(F, G.gable(), 0, 0.8 + H, 0, d + 0.4, sr(1.8, 2.8), w + 0.2, '#ffffff', { mat: 'roof', ry: Math.PI / 2 });
  else { flatRoof(F, w, d, 0.8 + H, 0.2); PB(F, 0, 0.8 + H, d / 2 - 0.15, w + 0.1, 0.8, 0.3, wall, { mat: 'plaster' }); if (srand() < 0.3) acUnit(F, w * 0.2, 0.8 + H, -d * 0.2); }
  return { top: 0.8 + H + (tiled ? 2 : 0), flat: !tiled };
}
function bVilla(F, w, d, L) { // moderne Villa mit Auskragung, Glasfront, Pool
  const det = Q().detail, wall = spick(['#f8f8f4', '#f0ece4', '#e8e4dc', '#fdf8ee']), acc = spick(['#3a3e44', '#8a6a4a', '#c8a070', '#2a4a5a']), h1 = 3.6, h2 = 3.4;
  WIN_STYLE = 1;
  PB(F, 0, -1.5, 0, w + 0.6, 1.9, d + 0.6, '#d8d0c4', { mat: 'concrete' }); PB(F, -w * 0.1, 0.4, 0, w * 0.8, h1, d, wall, { mat: 'plaster' });
  PW(F, -w * 0.1, 0.4 + h1 / 2, d / 2 + 0.05, w * 0.7, h1 - 0.6, 0, 0xffe8c0, 1);
  const ox = w * 0.1, oz = -d * 0.1; PB(F, ox, 0.4 + h1, oz, w * 0.85, h2, d * 0.75, wall, { mat: 'plaster' }); PW(F, ox, 0.4 + h1 + h2 / 2, oz + d * 0.375 + 0.05, w * 0.6, h2 - 0.9, 0, litCol() || 0xffe0b0, 1);
  PB(F, ox, 0.4 + h1 + h2, oz, w * 0.92, 0.32, d * 0.82, acc, { mat: 'concrete' }); PB(F, -w * 0.48, 0.4, d / 2 - 0.3, 1.2, h1 + h2, 0.6, acc, { mat: 'planks' });
  railing(F, -w * 0.5, d / 2 - 0.1, w * 0.35, d / 2 - 0.1, 0.4 + h1, 1, '#c8d0d8', 1.2);
  const back = LP(F, 0, 0, -d / 2 - 4.5), fr = LP(F, 0, 0, d / 2 + 5.5);
  if (det > 0 && rectFree(back.x, back.z, L.yaw || 0, w / 2, 3.8, 0.8)) { PB(F, 0, 0, -d / 2 - 4.5, w, 0.4, 7, '#f0ece4', { mat: 'plaza' }); part(F, G.box(), 0, 0.36, -d / 2 - 4.5, w * 0.7, 0.06, 4.6, '#ffffff', { mat: 'pool' }); for (const sx of [-w * 0.42, w * 0.42]) PB(F, sx, 0.4, -d / 2 - 3, 0.8, 0.3, 1.9, '#ffffff'); }
  for (const sx of [-1, 1]) { const q = LP(F, sx * (w / 2 + 2), 0, -d / 2 - 2); TREES.push({ t: 'palm', x: q.x, z: q.z, s: sr(0.9, 1.2) }); }
  if (rectFree(fr.x, fr.z, L.yaw || 0, w / 2 + 1, 0.6, 1.2)) { PB(F, -2.2, 0, d / 2 + 5.5, w, 1.4, 0.35, wall, { mat: 'plaster' }); PB(F, w / 2 - 1.2, 0, d / 2 + 5.5, 3.6, 1.6, 0.12, '#2a2c30', { mat: 'metal' }); { const q = LP(F, -2.2, 0, d / 2 + 5.5); World.addOBB(q.x, q.z, w / 2, 0.2, L.yaw || 0, L.y + 1.4, L.y - 1, 'prop'); }
    if (srand() < 0.35 && det > 0) propCar(F, w / 2 - 1.5, d / 2 + 2.6, Math.PI / 2, spick(PAL.car)); }
  return { top: 0.4 + h1 + h2 + 0.32, flat: true };
}
function bStripMall(F, w, d, L) { // eingeschossige Ladenzeile mit Parkplatz davor
  const dd = Math.min(d * 0.45, 16), z0 = -d / 2 + dd / 2, n = Math.max(3, Math.round(w / 8)), c = spick(['#f0e6d4', '#e8d8c0', '#f4f0e8', '#dcd4c4']), acc = spick(PAL.accent);
  PB(F, 0, -1.5, z0, w, 1.8, dd, '#a8a296', { mat: 'concrete' }); PB(F, 0, 0.3, z0, w, 5, dd, c, { mat: 'plaster' }); PB(F, 0, 5.3, z0 + dd / 2 - 0.3, w + 0.4, 1.4, 0.6, acc, { mat: 'plaster' });
  PB(F, 0, 3.6, z0 + dd / 2 + 1.5, w, 0.25, 3, '#e8e4dc', { mat: 'concrete' }); for (let k = 0; k <= n; k++) PB(F, -w / 2 + 0.3 + k * (w - 0.6) / n, 0.3, z0 + dd / 2 + 2.8, 0.3, 3.3, 0.3, '#e8e4dc', { mat: 'concrete' });
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n, sh = spick(SHOPS); PW(F, x, 2, z0 + dd / 2 + 0.06, w / n - 1.6, 2.6, 0, 0xfff0c8, 2); Signs.quad(F, x, 5.9, z0 + dd / 2 + 0.05, w / n * 0.8, 0.8, 0, Signs.cell(sh[0], sh[1], sh[2])); }
  const pd = d - dd - 3, pz = z0 + dd / 2 + 3 + pd / 2; PB(F, 0, -0.9, pz, w, 1.02, pd, '#3a3b40', { mat: 'road' }); parkLines(F, -w / 2 + 3, w / 2 - 3, pz - pd / 4, 5); parkLines(F, -w / 2 + 3, w / 2 - 3, pz + pd / 4, 5);
  for (let k = 0; k < 5; k++) if (srand() < 0.6) propCar(F, -w / 2 + 4 + k * (w - 8) / 4, pz + (k % 2 ? -1 : 1) * pd / 4, 0, spick(PAL.car));
  PB(F, w / 2 - 2, 0, d / 2 - 1, 0.6, 7, 0.6, '#8a8e94', { mat: 'metal', keep: true }); Signs.quad(F, w / 2 - 2, 6.4, d / 2 - 0.65, 3.4, 1.6, 0, Signs.cell(spick(['PALM PLAZA', 'SUN CENTER', 'CORAL MALL', 'BAYSIDE SHOPS', 'LA ESQUINA']), acc, '#fff'));
  return { top: 6.7, flat: true, depthUsed: dd };
}
function bFactory(F, w, d, L) {
  const H = sr(8, 12), c = spick(PAL.ind), n = Math.max(2, Math.round(w / 9)), det = Q().detail;
  PB(F, 0, -1.5, 0, w + 0.4, 1.8, d + 0.4, '#8a8a84', { mat: 'concrete' }); PB(F, 0, 0.3, 0, w, H, d, c, { mat: srand() < 0.4 ? 'brick' : 'steel' });
  for (let i = 0; i < n; i++) part(F, G.gable(), -w / 2 + (i + 0.5) * w / n, 0.3 + H, 0, w / n, 3, d, '#9aa0a8', { mat: 'steel' });
  const ch = sri(1, 3); for (let k = 0; k < ch; k++) { const x = -w / 2 + 3 + k * 4.5, h = H + sr(10, 24); { const q0 = LP(F, x, 0, -d / 2 - 2.5); if (!offRoad(q0.x, q0.z, 2)) continue; } PC(F, x, 0.3, -d / 2 - 2.5, 1.2, h, spick(['#a8a090', '#8a3a2a', '#c8c0b0']), { seg: 10, mat: 'brick', keep: true }); PC(F, x, h, -d / 2 - 2.5, 1.35, 1, '#3a3a3a', { seg: 10, keep: true }); const q = LP(F, x, 0, -d / 2 - 2.5); World.addOBB(q.x, q.z, 1.3, 1.3, 0, q.y + h); }
  for (let k = 0; k < 2; k++) { { const q0 = LP(F, w / 2 + 4, 0, -d / 4 + k * 7); if (!offRoad(q0.x, q0.z, 3.2)) continue; } PC(F, w / 2 + 4, 0.3, -d / 4 + k * 7, 2.8, 7, '#d8d8d0', { seg: 12, mat: 'metal' }); const q = LP(F, w / 2 + 4, 0, -d / 4 + k * 7); World.addOBB(q.x, q.z, 2.8, 2.8, 0, q.y + 7.3); }
  if (det > 0 && offRoad(LP(F, w / 2 + 3, 0, 0).x, LP(F, w / 2 + 3, 0, 0).z, 1)) { PB(F, w / 2 + 1.5, 5.5, 0, 3.2, 0.5, 0.5, '#8a8e94', { mat: 'metal' }); PB(F, w / 2 + 1.5, 5.5, 3.5, 3.2, 0.5, 0.5, '#8a8e94', { mat: 'metal' }); }
  facade(F, w, d, 0.3, 1, H, { only: [0], sp: 6, ww: 4, wh: 1.4, style: 1, sill: false }); PB(F, 0, 0.3, d / 2 + 0.1, 5, 5, 0.12, '#e0e0dc', { mat: 'steel' });
  Signs.quad(F, 0, H - 1.6, d / 2 + 0.12, Math.min(w * 0.6, 16), 1.4, 0, Signs.cell(spick(['SOLARA STEEL', 'CEMENTOS', 'GULF PLASTICS', 'SUNPOWER', 'BREWERY', 'RECYCLING', 'RUST FLATS']), '#1a2a3a', '#ffd23a', 2));
  return { top: 0.3 + H + 3, flat: false };
}
function bTrailer(F, w, d, L) { // Wohnwagen (Trailer Park)
  const c = spick(['#f4f0e8', '#e8eef4', '#f8e8d0', '#dff0e4', '#f0dce4']), len = Math.min(w, 13), wid = 4.2;
  PB(F, 0, 0, 0, len, 0.6, wid, '#6a6a6a'); PB(F, 0, 0.6, 0, len, 2.8, wid, c, { mat: 'steel' }); PB(F, 0, 3.4, 0, len + 0.2, 0.15, wid + 0.2, '#c8c8c8', { mat: 'metal' });
  PB(F, 0, 1.0, wid / 2 + 0.01, len - 1, 0.3, 0.05, spick(PAL.accent)); for (const x of [-len * 0.3, len * 0.1, len * 0.35]) PW(F, x, 2.1, wid / 2 + 0.03, 1.4, 1.0, 0, litCol(), 3);
  PB(F, -len * 0.15, 0, wid / 2 + 1.2, 2.4, 0.5, 2, '#9a7a5a', { mat: 'planks' }); PB(F, -len * 0.15, 0.6, wid / 2 + 0.03, 0.9, 2.0, 0.08, '#8a5a3a');
  if (srand() < 0.5) PB(F, len * 0.2, 2.6, wid / 2 + 1.5, 5, 0.1, 3, spick(['#3a8a5a', '#c0392b', '#2a6a9a']), { rx: 0.15 }); acUnit(F, len / 2 + 0.6, 0, 0, Math.PI / 2);
  return { top: 3.6, flat: true, obbW: len, obbD: wid };
}
function bCabin(F, w, d, L) { // Holzhütte (Berge, Land)
  const W = Math.min(w, 9), D = Math.min(d, 7);
  PB(F, 0, -1, 0, W + 0.4, 1.4, D + 0.4, '#8a8278', { mat: 'concrete' }); PB(F, 0, 0.4, 0, W, 3, D, '#ffffff', { mat: 'planks' }); part(F, G.gable(), 0, 3.4, 0, W + 1, 2.4, D + 1, '#ffffff', { mat: 'slate' });
  PB(F, 0, 0.4, D / 2 + 1.2, W, 0.25, 2.4, '#ffffff', { mat: 'planks' }); railing(F, -W / 2, D / 2 + 2.35, W / 2, D / 2 + 2.35, 0.65, 0.9, '#7a5a3a', 1.2);
  PB(F, 0, 0.65, D / 2 + 0.03, 1.1, 2.1, 0.08, '#5a3a20'); for (const x of [-W * 0.3, W * 0.3]) PW(F, x, 2.0, D / 2 + 0.04, 1.2, 1.1, 0, litCol(), 0);
  PB(F, W / 2 - 1.2, 3, -1, 0.9, 3.4, 0.9, '#8a7a6a', { mat: 'brick' });
  return { top: 5.8, flat: false, obbW: W, obbD: D };
}
function bStilt(F, w, d, L) { // Stelzenhaus (Keys, Sumpf)
  const W = Math.min(w, 10), D = Math.min(d, 8), c = spick(['#bfe6f2', '#f8eab0', '#ffd8e4', '#d4f0e8', '#ffffff']);
  for (const [sx, sz] of corners4) PB(F, sx * (W / 2 - 0.3), -2, sz * (D / 2 - 0.3), 0.35, 4.7, 0.35, '#7a5a3a'); for (const sx of [-1, 1]) PB(F, 0, -2, sx * (D / 2 - 0.3), 0.35, 4.7, 0.35, '#7a5a3a');
  PB(F, 0, 2.6, 0, W + 2, 0.3, D + 2, '#a8805a', { mat: 'planks' }); PB(F, 0, 2.9, 0, W, 3, D, c, { mat: 'planks' }); part(F, G.pyr(), 0, 5.9, 0, W + 1.2, 2, D + 1.2, '#e8e2d8', { mat: 'roof' });
  railing(F, -W / 2 - 1, D / 2 + 1, W / 2 + 1, D / 2 + 1, 2.9, 1, '#f0f0f0', 1.2); part(F, G.box(), W / 2 - 1, 1.2, D / 2 + 2.3, 1.1, 0.2, 3.6, '#a8805a', { rx: 0.72, mat: 'planks' });
  PB(F, -W * 0.2, 2.9, D / 2 + 0.03, 1, 2.1, 0.08, '#5a7a9a'); for (const x of [W * 0.15, W * 0.35]) PW(F, x, 4.4, D / 2 + 0.04, 1.2, 1.1, 0, litCol(), 3);
  return { top: 7.9, flat: false, obbW: W + 2, obbD: D + 2 };
}

// ---------- BEBAUUNGSREGELN JE VIERTEL ----------
const ZR = {
  downtown: () => { const r = srand(), w = sr(22, 34), d = sr(22, 32), fn = r < 0.3 ? bGlassTower : r < 0.52 ? bTower : r < 0.66 ? bSteppedTower : r < 0.82 ? bOffice : r < 0.92 ? bApartment : bParking;
    return { w, d, fn, prob: 1, setback: 1, step: w + sr(2, 5), gap: 1, opts: fn === bApartment ? { floors: sri(6, 10) } : fn === bOffice ? { floors: sri(8, 14) } : undefined }; },
  uptown: () => { const r = srand(), w = sr(20, 30), d = sr(18, 26), fn = r < 0.45 ? bApartment : r < 0.65 ? bOffice : r < 0.78 ? bTower : r < 0.88 ? bGlassTower : bParking;
    return { w, d, fn, prob: 0.95, setback: 2, step: w + sr(3, 7), gap: 1.5, opts: fn === bApartment ? { floors: sri(5, 9) } : fn === bOffice ? { floors: sri(5, 9) } : undefined }; },
  midtown: () => { const r = srand(), row = r < 0.75, w = row ? sr(9, 15) : sr(18, 26), d = sr(14, 22), fn = row ? bTownRow : r < 0.9 ? bApartment : bShops;
    return { w, d, fn, prob: 0.97, setback: 0.6, step: w + 0.4, gap: 0.2, opts: fn === bTownRow ? { floors: sri(2, 4) } : fn === bApartment ? { floors: sri(3, 5) } : undefined }; },
  oldtown: () => { const w = sr(7, 11), d = sr(12, 18); return { w, d, fn: bTownRow, prob: 0.98, setback: 0.4, step: w + 0.2, gap: 0.1, opts: { old: true, floors: sri(2, 4) } }; },
  strip: (e, p) => { const u = p.x - beachCX(p.z), r = srand();
    if (u > 55) { const w = sr(22, 30), d = sr(18, 26); return { w, d, fn: r < 0.78 ? bHotel : bApartment, prob: 0.97, setback: 1.5, step: w + sr(2, 5), gap: 1 }; }
    if (u < -50) { const w = sr(14, 20), d = sr(12, 16); return { w, d, fn: r < 0.65 ? bVilla : bApartment, prob: 0.9, setback: 5, step: w + 8, gap: 2 }; }
    const w = sr(16, 26), d = sr(16, 22); return { w, d, fn: r < 0.5 ? bApartment : r < 0.75 ? bShops : r < 0.9 ? bHotel : bParking, prob: 0.95, setback: 1.5, step: w + sr(2, 4), gap: 1 }; },
  port: () => { const w = sr(28, 46), d = sr(22, 32); return { w, d, fn: srand() < 0.7 ? bWarehouse : bFactory, prob: 0.9, setback: 3, step: w + sr(6, 12), gap: 3 }; },
  industrial: () => { const w = sr(26, 44), d = sr(22, 34); return { w, d, fn: srand() < 0.55 ? bFactory : bWarehouse, prob: 0.9, setback: 4, step: w + sr(6, 14), gap: 3 }; },
  suburb: (e) => { if (e.type === 'highway') return null; if (srand() < 0.035) { const w = sr(40, 54); return { w, d: 34, fn: bStripMall, prob: 0.8, setback: 1, step: w + 10, gap: 2 }; }
    const w = sr(11, 14), d = sr(10, 12); return { w, d, fn: bHouse, prob: 0.94, setback: 5, step: w + 8, gap: 2 }; },
  heights: () => { const w = sr(15, 22), d = sr(12, 16); return { w, d, fn: bVilla, prob: 0.9, setback: 7, step: w + 12, gap: 3 }; },
  village: () => { const sh = srand() < 0.35, w = sh ? sr(14, 20) : sr(10, 13), d = sr(10, 14), fn = sh ? bShops : srand() < 0.5 ? bHouse : bTownRow; return { w, d, fn, prob: 0.92, setback: sh ? 1 : 4, step: w + 6, gap: 1.5, opts: fn === bTownRow ? { floors: 2 } : undefined }; },
  keys: () => { const w = sr(10, 14), d = sr(8, 11); return { w, d, fn: srand() < 0.6 ? bStilt : bVilla, prob: 0.6, setback: 5, step: w + 14, gap: 3 }; },
  mountain: () => ({ w: 10, d: 8, fn: bCabin, prob: 0.12, setback: 6, step: 40, gap: 4 }),
  urban: (e) => { const r = srand();
    if (e.type === 'highway') { if (r < 0.45) { const w = sr(26, 40), d = sr(20, 30); return { w, d, fn: srand() < 0.6 ? bWarehouse : bFactory, prob: 0.6, setback: 4, step: w + 14, gap: 3 }; } return null; }
    if (r < 0.3) { const w = sr(16, 24), d = sr(14, 20); return { w, d, fn: bApartment, prob: 0.9, setback: 2, step: w + sr(3, 8), gap: 1.5, opts: { floors: sri(3, 6) } }; }
    if (r < 0.5) { const w = sr(9, 14), d = sr(12, 18); return { w, d, fn: bTownRow, prob: 0.92, setback: 1, step: w + 1, gap: 0.5, opts: { floors: sri(2, 3) } }; }
    if (r < 0.62) { const w = sr(16, 26), d = sr(12, 18); return { w, d, fn: bShops, prob: 0.9, setback: 1.5, step: w + 4, gap: 1 }; }
    if (r < 0.7) { const w = sr(20, 28), d = sr(18, 24); return { w, d, fn: bOffice, prob: 0.9, setback: 2, step: w + 5, gap: 1.5, opts: { floors: sri(3, 6) } }; }
    if (r < 0.75) { const w = sr(40, 52); return { w, d: 34, fn: bStripMall, prob: 0.85, setback: 1, step: w + 8, gap: 2 }; }
    if (r < 0.78) { const w = sr(24, 32), d = sr(22, 28); return { w, d, fn: bParking, prob: 0.9, setback: 2, step: w + 6, gap: 2 }; }
    const w = sr(11, 14), d = sr(10, 12); return { w, d, fn: bHouse, prob: 0.92, setback: 4, step: w + 7, gap: 2 }; },
  rural: (e) => { if (e.type === 'highway') return null; const r = srand(), w = sr(10, 14), d = sr(10, 12); return { w, d, fn: r < 0.72 ? bHouse : r < 0.88 ? bCabin : bShops, prob: 0.34, setback: 7, step: w + 16, gap: 3 }; },
};
let LOT_GAP = 1.5;
function buildBuildings() {
  lotsAlong((e, p, zone) => {
    if (zone === 'base' || zone === 'swamp' || e.type === 'service' || e.bridge || e.dirt) return 30;
    if (BLOCK_RULES[zone]) return 15; // dichte Viertel: Blockbebauung (buildBlocks)
    const pk = (ZR[zone] || ZR.rural)(e, p); if (!pk) return 25;
    for (const side of [1, -1]) { if (srand() > pk.prob) continue;
      const extra = pk.fn === bHouse ? 6 : 0, off = e.hw + 3.4 + pk.setback + pk.d / 2; LOT_GAP = pk.gap ?? 1.5;
      const L = lotAt(e, p, side, off, pk.w + extra, pk.d, 2.5); LOT_GAP = 1.5; if (!L) continue;
      if (zone === 'strip' && L.x - beachCX(L.z) > 92) continue; if (inPark(L.x, L.z)) continue;
      if (extra) { L.w -= extra; const c = Math.cos(L.yaw), s = Math.sin(L.yaw); L.x -= c * 2.4; L.z += s * 2.4; }
      placeBuilding(L, pk.fn, pk.opts); }
    return pk.step;
  });
}
// Hinterhof-/Innenbebauung: füllt Blockinneres in dichten Vierteln
const INFILL = {
  downtown: { step: 30, pick: () => { const r = srand(); return r < 0.55 ? [sr(18, 26), sr(18, 26), srand() < 0.5 ? bTower : bGlassTower] : r < 0.8 ? [sr(20, 28), sr(20, 28), bOffice, { floors: sri(6, 12) }] : [sr(24, 32), sr(22, 30), bParking]; } },
  uptown: { step: 32, pick: () => [sr(18, 26), sr(16, 22), srand() < 0.7 ? bApartment : bOffice, { floors: sri(4, 8), shops: false }] },
  midtown: { step: 22, pick: () => [sr(10, 14), sr(10, 14), bTownRow, { floors: sri(2, 3), shop: false }] },
  oldtown: { step: 18, pick: () => [sr(7, 10), sr(8, 12), bTownRow, { old: true, floors: sri(2, 3), shop: false }] },
  strip: { step: 28, pick: () => [sr(16, 22), sr(14, 20), srand() < 0.6 ? bApartment : bHotel, { floors: sri(3, 6), shops: false }] },
  port: { step: 44, pick: () => [sr(26, 40), sr(20, 28), bWarehouse] },
  industrial: { step: 44, pick: () => [sr(26, 40), sr(20, 30), srand() < 0.5 ? bFactory : bWarehouse] },
  village: { step: 26, pick: () => [sr(9, 12), sr(9, 11), bHouse] },
  suburb: { step: 30, pick: () => [sr(11, 13), sr(10, 12), bHouse] },
  urban: { step: 30, pick: () => { const r = srand(); return r < 0.45 ? [sr(14, 20), sr(12, 18), bApartment, { floors: sri(3, 5), shops: false }] : r < 0.75 ? [sr(9, 13), sr(10, 14), bTownRow, { floors: sri(2, 3), shop: false }] : [sr(10, 12), sr(9, 11), bHouse]; } },
};
function buildInfill() {
  for (const D of DISTS) { const I = INFILL[D.k]; if (!I || BLOCK_RULES[D.k]) continue; const R = D.r || Math.max(D.hu, D.hv);
    for (let gx = -R; gx <= R; gx += I.step) for (let gz = -R; gz <= R; gz += I.step) {
      const x = D.cx + gx + sr(-5, 5), z = D.cz + gz + sr(-5, 5); if ((D.k === 'urban' ? zoneAt(x, z) !== 'urban' : distAt(x, z) !== D) || inPark(x, z)) continue;
      const r = Roads.nearest(x, z, 160); if (!r || r.d < r.e.hw + 12) continue;
      const [w, d, fn, opts] = I.pick(), sd = r.lat >= 0 ? 1 : -1, yaw = Math.atan2(r.p.tz * sd, -r.p.tx * sd);
      LOT_GAP = D.k === 'oldtown' || D.k === 'midtown' ? 0.4 : 1.5; const L = lotFree(x, z, w, d, yaw, 3); LOT_GAP = 1.5;
      if (L) placeBuilding(L, fn, opts); } }
}

// ---------- PARKS ----------
function makePark(cx, cz, yaw, hx, hz, o = {}) {
  for (let k = 0; k < 5 && !rectFree(cx, cz, yaw, hx, hz, 1.5); k++) { hx *= 0.8; hz *= 0.8; } if (hx < 8 || hz < 8 || !rectFree(cx, cz, yaw, hx, hz, 1.5)) return;
  PARKS.push({ x: cx, z: cz, c: Math.cos(yaw), s: Math.sin(yaw), hx, hz }); World.addOBB(cx, cz, hx, hz, yaw, -100, -50, 'reserve');
  const y = terrainHeight(cx, cz), F = FR(cx, y, cz, yaw);
  // Wege: Rundweg + Diagonalen
  for (const [w, d, x, z] of [[hx * 2 - 6, 3, 0, hz - 6], [hx * 2 - 6, 3, 0, -hz + 6], [3, hz * 2 - 6, hx - 6, 0], [3, hz * 2 - 6, -hx + 6, 0], [3, hz * 2 - 10, 0, 0], [hx * 2 - 10, 3, 0, 0]]) PB(F, x, -0.85, z, w, 1.0, d, '#d8ccb4', { mat: 'plaza', keep: true });
  // Brunnen / Teich
  PC(F, 0, 0.0, 0, 7, 0.6, '#e8e4dc', { seg: 24, mat: 'concrete' }); part(F, G.cyl(24), 0, 0.5, 0, 12.6, 0.12, 12.6, '#3fc8e8', { mat: 'pool' }); PC(F, 0, 0.1, 0, 0.6, 3.2, '#ffffff', { seg: 10 }); PC(F, 0, 3.2, 0, 1.6, 0.25, '#ffffff', { seg: 12 });
  World.addOBB(cx, cz, 6, 6, yaw, y + 0.8);
  if (o.pond) { const px = -hx * 0.45, pz = hz * 0.4; part(F, G.cyl(28), px, -0.3, pz, hx * 0.55, 0.42, hz * 0.45, '#2a8aa8', { mat: 'pool' }); }
  // Bäume, Bänke, Laternen
  for (let k = 0; k < (o.trees || 40); k++) { const lx = sr(-hx + 5, hx - 5), lz = sr(-hz + 5, hz - 5); if (Math.abs(lx) < 10 && Math.abs(lz) < 10) continue; if (Math.abs(lx) < 3 || Math.abs(lz) < 3) continue; const q = LP(F, lx, 0, lz); TREES.push({ t: srand() < 0.35 ? 'palm' : 'tree', x: q.x, z: q.z, s: sr(0.9, 1.3) }); }
  for (let k = -2; k <= 2; k++) { bench(F, k * hx * 0.35, hz - 8.5, Math.PI); bench(F, k * hx * 0.35, -hz + 8.5, 0); if (k % 2 === 0) { const q = LP(F, k * hx * 0.35 + 3, 0, hz - 8.5); lampPost(q.x, y, q.z, 0); } }
  if (o.name) Signs.quad(F, 0, 1.2, hz - 1.6, 6, 0.9, 0, Signs.cell(o.name, '#1a4a2a', '#f0e8c0'));
}
function buildParks() {
  // Bayfront-/Zentralpark im Superblock von Downtown
  if (LOC.cbdPark) { const c = Math.cos(0.1), s = Math.sin(0.1), lu = -134 - (-141), lv = -88 - (-103), p = LOC.cbdPark; makePark(p.x + lu * c - lv * s, p.z + lu * s + lv * c, -0.1, 76, 78, { pond: true, trees: 70, name: 'SOLARA PARK' }); }
  // Plaza im Kreisverkehr der Altstadt
  { const O = LOC.oldPlaza, y = terrainHeight(O.x, O.z), F = FR(O.x, y, O.z, 0); PC(F, 0, -0.8, 0, 15, 1.0, '#e6d6bc', { seg: 24, mat: 'plaza' }); PC(F, 0, 0.0, 0, 4.4, 0.7, '#f4f0e8', { seg: 18 }); part(F, G.cyl(18), 0, 0.6, 0, 8, 0.12, 8, '#3fc8e8', { mat: 'pool' }); PC(F, 0, 0, 0, 0.5, 4.5, '#e8e0d0', { seg: 10 }); PS(F, 0, 5.2, 0, 0.9, '#c8b890');
    for (let a = 0; a < 6; a++) TREES.push({ t: 'palm', x: O.x + Math.cos(a) * 11, z: O.z + Math.sin(a) * 11, s: 0.9 }); World.addOBB(O.x, O.z, 4.5, 4.5, 0, y + 5); }
  // Parks in den Vorstädten (Spielplatz, Bäume)
  for (const P of [SUBURB2, SUBURB]) { const r = Roads.nearest(P.x, P.z, 200); const off = r && r.d < 40 ? 45 : 0; makePark(P.x + off, P.z, 0.2, 30, 26, { trees: 22, name: P === SUBURB2 ? 'KENDALL PARK' : 'PALM PARK' }); }
  // Dominopark in Little Havana
  { const g = Roads.groups.mid, a = g[2][1], b = g[3][2]; if (a && b) makePark((a.x + b.x) / 2, (a.z + b.z) / 2, 0.06, 14, 42, { trees: 14, name: 'PARQUE MAXIMO' }); }
}

// ---------- LANDSCHAFT ----------
function farmAt(x, z, yaw, big) { // Bauernhof: Haus, Scheune, Silo, Felder, Zäune, Heuballen
  const L = lotFree(x, z, 40, 30, yaw, 6); if (!L) return false;
  placeBuilding({ ...L, w: 12, d: 10 }, bHouse);
  const F = FR(L.x, L.y, L.z, L.yaw), bx = 15; PB(F, bx, -1, 0, 12, 7.5, 16, '#a8342a'); part(F, G.gable(), bx, 6.5, 0, 12.8, 4.5, 16.8, '#5a4a40'); PB(F, bx, -0.5, 8.02, 5, 5, 0.1, '#f4f0e8'); seg(...LP(F, bx - 2.5, 0, 8.1).toArray(), ...LP(F, bx + 2.5, 5, 8.1).toArray(), 0.2, 0.2, '#f4f0e8');
  const q = LP(F, bx, 0, 0); World.addOBB(q.x, q.z, 6, 8, L.yaw, L.y + 9); BLD.push({ x: q.x, z: q.z, w: 12, d: 16, yaw: L.yaw, h: 9 });
  for (let k = 0; k < (big ? 2 : 1); k++) { PC(F, -12 - k * 6, -1, -6, 2.6, 13, '#c8ccd0', { seg: 12, mat: 'steel' }); part(F, G.hsph(12), -12 - k * 6, 12, -6, 5.4, 4, 5.4, '#9aa0a8', { mat: 'steel' }); const s2 = LP(F, -12 - k * 6, 0, -6); World.addOBB(s2.x, s2.z, 2.6, 2.6, 0, L.y + 14); }
  for (let k = 0; k < 6; k++) { const hp = LP(F, sr(-18, 20), 0, sr(10, 16)); if (!offRoad(hp.x, hp.z, 1.5)) continue; const hy = terrainHeight(hp.x, hp.z); PC(FR(hp.x, hy, hp.z, 0), 0, 0, 0, 0.75, 1.2, '#d8c070', { seg: 10, rx: Math.PI / 2 }); World.addOBB(hp.x, hp.z, 0.75, 0.6, 0, hy + 1.5, hy - 1, 'prop'); }
  const nf = big ? 4 : 3; for (let i = 0; i < nf; i++) { const a = yaw + Math.PI / 2 * i + sr(-0.2, 0.2), dd = sr(70, 95), fx = L.x + Math.cos(a) * dd, fz = L.z + Math.sin(a) * dd; if (zoneAt(fx, fz) !== 'rural' || Roads.nearest(fx, fz, 30)) continue; const fhx = sr(28, 46), fhz = sr(26, 42);
    if ([[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 0]].some(([a, b]) => terrainHeight(fx + a * fhx, fz + b * fhz) < 2.2 || inLake(fx + a * fhx, fz + b * fhz))) continue;
    FIELDS.push({ x: fx, z: fz, hx: fhx, hz: fhz, c: Math.cos(yaw), s: Math.sin(yaw), type: sri(0, 3) }); }
  if ((FARM_TRACTORS = (typeof FARM_TRACTORS === 'number' ? FARM_TRACTORS : 0) + 1) <= 7) { const tp = LP(F, bx + 1, 0, 12.5); PARKED.push(['tractor', tp.x, tp.z, L.yaw + 0.3]); }
  // Weidezaun ums Gehöft
  const hx = 34, hz = 22; for (const [x0, z0, x1, z1] of [[-hx, -hz, hx, -hz], [-hx, hz, -8, hz], [8, hz, hx, hz], [-hx, -hz, -hx, hz], [hx, -hz, hx, hz]]) { const a = LP(F, x0, 0, z0), b = LP(F, x1, 0, z1); fenceLine(a.x, a.z, b.x, b.z, 3, 1.2, '#8a6a4a', '#9a7a5a', [0.7, 1.1]); }
  return true;
}
function trailerPark(cx, cz) { const r = Roads.nearest(cx, cz, 200, e => e.type !== 'highway'); if (!r) return; const yaw = Math.atan2(r.p.tx, r.p.tz); let n = 0;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const lx = i * 18, lz = j * 12, x = cx + lx * Math.cos(yaw) + lz * Math.sin(yaw), z = cz - lx * Math.sin(yaw) + lz * Math.cos(yaw), L = lotFree(x, z, 14, 6, yaw, 4); if (L && srand() < 0.85) { placeBuilding(L, bTrailer); n++; if (srand() < 0.4) TREES.push({ t: 'palm', x: x + 7, z: z + 4, s: 0.9 }); } }
  if (n) { const y = terrainHeight(cx, cz); signF(FR(cx, y, cz, yaw), 'SUNSET TRAILERS', '#ffb03a', 0, 4, -36, 8, 1.6); } }
function golfCourse(cx, cz, R) { // Golfplatz: gemähte Bahnen, Bunker, Fahnen, Clubhaus
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + sr(-0.2, 0.2), d = R * sr(0.2, 0.75), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (Roads.nearest(x, z, 26)) continue;
    FIELDS.push({ x, z, hx: sr(16, 26), hz: sr(40, 60), c: Math.cos(a), s: Math.sin(a), type: 4 }); FIELDS.push({ x: x + sr(-14, 14), z: z + sr(-14, 14), hx: sr(4, 7), hz: sr(3, 5), c: 1, s: 0, type: 5 });
    const y = terrainHeight(x, z); PB(null, x, y - 0.5, z, 0.06, 2.8, 0.06, '#f0f0f0'); PB(null, x + 0.35, y + 1.8, z, 0.7, 0.45, 0.02, '#e02020', { keep: true }); }
  for (let k = 0; k < 60; k++) { const a = sr(0, TAU), d = R * sr(0.85, 1.05), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; TREES.push({ t: srand() < 0.5 ? 'palm' : 'tree', x, z, s: sr(0.9, 1.3) }); }
  const L = specialLot(cx, cz, 26, 18); if (L) placeBuilding(L, (F, w, d) => { const r = bVilla(F, w, d, L); signF(F, 'SOLARA COUNTRY CLUB', '#5fd35f', 0, 8.2, d / 2 - 0.5, 12, 1.8); return r; });
  LOC.golf = V3(cx, 0, cz);
}
function solarFarm(cx, cz, yaw) { const y0 = terrainHeight(cx, cz); for (let i = -5; i <= 5; i++) for (let j = -3; j <= 3; j++) { const lx = i * 9, lz = j * 7, x = cx + lx * Math.cos(yaw) + lz * Math.sin(yaw), z = cz - lx * Math.sin(yaw) + lz * Math.cos(yaw), y = terrainHeight(x, z);
    if (Math.abs(y - y0) > 4 || !rectFree(x, z, yaw, 4.5, 2, 1.5)) continue; World.addOBB(x, z, 4, 1.6, yaw, y + 1.6, y - 1, 'prop'); const F = FR(x, y, z, yaw); PB(F, 0, -0.3, 0, 0.2, 1.4, 0.2, '#8a8e94', { mat: 'metal' }); part(F, G.box(), 0, 1.0, 0, 8, 0.12, 3.4, '#1a2a4a', { rx: -0.45, mat: 'shiny' }); } }
function windFarm(list) {
  for (const [wx, wz] of list) { const wy = terrainHeight(wx, wz); if (wy < 5 || Roads.nearest(wx, wz, 20)) continue; PC(FR(0, 0, 0, 0), wx, wy - 1, wz, 1.2, 46, '#f4f4f4', { seg: 10, keep: true }); PS(FR(0, 0, 0, 0), wx, wy + 45, wz, 1.6, '#f4f4f4', { sx: 1, sy: 1, sz: 2.4, keep: true });
    const rot = new THREE.Group(); rot.position.set(wx, wy + 46, wz + 2.6); const bl = []; for (let k = 0; k < 3; k++) { const b = new THREE.BoxGeometry(1.2, 18, 0.3); b.translate(0, 9, 0); b.rotateZ(k * Math.PI * 2 / 3); bl.push(nonIdx(b)); }
    rot.add(new THREE.Mesh(ADD.merge(bl), lam({ color: 0xf8f8f8, flatShading: true }))); scene.add(rot); const sp = 0.6 + hash2(wx, wz) * 0.4; World.anim.push((dt) => { rot.rotation.z += dt * sp * (0.6 + Env.w.wind * 0.5); }); World.addOBB(wx, wz, 1.3, 1.3, 0, wy + 46); }
}
function truckStop(x, z) { // Raststätte: Tankstelle, Diner, Motel an der Landstraße
  const L = specialLot(x, z, 34, 26); if (L) gasStation(L, spick([['#c8202a', 'SOLGAS'], ['#1f6fd0', 'BLUE PUMP'], ['#16a34a', 'PALM FUEL'], ['#ff8a1a', 'GULF']]));
  const M = specialLot(x + 40, z + 30, 44, 22); if (M) placeBuilding(M, bMotel);
}
function swampLife() { // Stelzenhäuser, Steg, Airboat-Anleger
  for (let k = 0; k < 18; k++) { const a = sr(0, TAU), d = SWAMP.r * sr(0.15, 0.8), x = SWAMP.x + Math.cos(a) * d, z = SWAMP.z + Math.sin(a) * d, h = terrainHeight(x, z); if (h < 0.4 || h > 2.6) continue;
    const L = lotFree(x, z, 12, 10, a, 4); if (L) placeBuilding(L, bStilt); }
  const S = LOC.swamp; if (S) { const y = terrainHeight(S.x, S.z); signF(FR(S.x, y, S.z, 0), 'EVERGLADES AIRBOAT TOURS', '#5fd35f', 0, 3.4, 4, 10, 1.6); }
}
function buildRural() {
  // Farmen in offenen Landflächen nahe Landstraßen
  let made = 0;
  for (let t = 0; t < 900 && made < 26; t++) { const x = sr(-1800, 900), z = sr(-1650, 1650); if (zoneAt(x, z) !== 'rural') continue; const h = terrainHeight(x, z); if (h < 3 || h > 55 || inLake(x, z, 40)) continue;
    const r = Roads.nearest(x, z, 150, e => e.type !== 'service' && !e.bridge); if (!r || r.d < 42) continue; if (farmAt(x, z, Math.atan2(r.p.tx, r.p.tz), srand() < 0.4)) made++; }
  // Trailerparks, Golfplatz, Solarfeld, Windpark, Raststätten, Sumpf
  trailerPark(-1180, 600); trailerPark(-760, 1180);
  golfCourse(-420, -960, 190);
  solarFarm(-1200, 470, 0.2);
  windFarm([[-1000, -330], [-930, -250], [-1070, -240], [-860, -360], [-1120, -410], [-1500, -560], [-1440, -650]]);
  truckStop(-1000, 250); truckStop(240, 1080); truckStop(-640, -820);
  swampLife();
  // Obstplantagen (Zitrus) in Reihen
  for (const [ox, oz, yaw] of [[-860, 520, 0.3], [-1250, -120, -0.2], [-150, 1350, 0.1]]) { if (zoneAt(ox, oz) !== 'rural') continue; for (let i = -6; i <= 6; i++) for (let j = -4; j <= 4; j++) { const lx = i * 7, lz = j * 8, x = ox + lx * Math.cos(yaw) + lz * Math.sin(yaw), z = oz - lx * Math.sin(yaw) + lz * Math.cos(yaw); if (Roads.nearest(x, z, 10) || inLake(x, z)) continue; TREES.push({ t: 'tree', x, z, s: 0.62 + srand() * 0.1 }); } }
  // Wasserturm & Funkmast
  for (const [x, z, name] of [[VILLAGE.x + 90, VILLAGE.z - 60, 'SAN LORENZO'], [SUBURB2.x - 260, SUBURB2.z - 120, 'KENDALL']]) { const y = terrainHeight(x, z); if (Roads.nearest(x, z, 12)) continue; const F = FR(x, y, z, 0);
    for (const [sx, sz] of corners4) seg(x + sx * 4, y, z + sz * 4, x + sx * 2.2, y + 20, z + sz * 2.2, 0.35, 0.35, '#c8ccd0'); PC(F, 0, 20, 0, 5.5, 7, '#e8ecf0', { seg: 16, mat: 'metal' }); part(F, G.cone(16), 0, 27, 0, 11.5, 2.5, 11.5, '#d8dce0', { mat: 'metal' });
    Signs.quad(F, 0, 23.5, 5.55, 7, 1.3, 0, Signs.cell(name, '#e8ecf0', '#2a5aa0', 2)); World.addOBB(x, z, 4.5, 4.5, 0, y + 30); }
}
// Tankstelle auf einem Grundstück (auch für Sonderorte)
function gasStation(L, [brand, name]) { reserve(L); const F = FR(L.x, L.y, L.z, L.yaw); paved(F, L.w, L.d);
  for (const [x, z] of [[-7, 2], [7, 2], [-7, 10], [7, 10]]) { PB(F, x, 0, z - 4, 0.5, 5.2, 0.5, '#c0c0c0', { keep: true }); const q = LP(F, x, 0, z - 4); World.addOBB(q.x, q.z, 0.3, 0.3, 0, L.y + 5); }
  PB(F, 0, 5.2, 2, 17, 0.8, 10, '#e8e8e8'); PG(F, 0, 5.25, 2, 17.2, 0.5, 10.2, brand); PG(F, 0, 5.1, 2, 16, 0.06, 9, '#eef3ff');
  for (const x of [-3, 3]) { PB(F, x, 0, 2, 1.0, 1.8, 0.6, '#9a9aa2'); PG(F, x, 1.2, 2.32, 0.6, 0.35, 0.05, '#9fe0ff'); PB(F, x, 0, 2, 1.6, 0.25, 7, '#4a4a4e'); const q = LP(F, x, 0, 2); World.addOBB(q.x, q.z, 0.6, 0.4, L.yaw, L.y + 1.8); }
  PB(F, 0, 0, -L.d / 2 + 5, 15, 4.4, 8, '#f0ece4'); PB(F, 0, 4.4, -L.d / 2 + 5, 15.4, 0.5, 8.4, brand); PW(F, -1.5, 1.8, -L.d / 2 + 9.05, 9, 2.4, 0, 0xfff1c8, 2); PB(F, 4.5, 0, -L.d / 2 + 9.05, 1.6, 2.4, 0.1, '#5a7a9a');
  Signs.quad(F, 0, 4.5, -L.d / 2 + 9.3, 8, 1.1, 0, Signs.cell(name, brand, '#fff')); const sp = LP(F, 0, 0, -L.d / 2 + 5); World.addOBB(sp.x, sp.z, 7.5, 4, L.yaw, L.y + 4.6); BLD.push({ x: sp.x, z: sp.z, w: 15, d: 8, yaw: L.yaw, h: 5 });
  PB(F, L.w / 2 - 2, 0, L.d / 2 - 2, 0.4, 7, 0.4, '#8a8a90', { keep: true }); Signs.quad(F, L.w / 2 - 2, 7, L.d / 2 - 1.7, 3.2, 1.3, 0, Signs.cell(name, brand, '#fff')); Signs.quad(F, L.w / 2 - 2, 5.4, L.d / 2 - 1.7, 3.2, 1.3, 0, Signs.cell('SUPER 3.49', '#111', '#ffd23a'));
  World.lampAnchors.push(LP(F, -4, 4.6, 2), LP(F, 4, 4.6, 2)); PICKUP_SPOTS.push(['ammo', L.front.x, L.front.z]); if (!LOC.gas) { LOC.gas = L.front.clone(); LOC.gas.yaw = L.yaw; }
}

// ---------- BAUBLÖCKE: lückenlose Randbebauung + Innenhöfe ----------
const R1 = (a) => a[Math.floor(srand() * a.length)];
const BLOCK_RULES = {
  downtown: { w: () => sr(18, 34), wmin: 12, dmin: 14, dmax: 30, walk: 3.4, set: 0.3, gap: 0.3, gap2: () => sr(0.4, 2), corner: 3,
    pick: (w, d) => { const r = srand(); if (w > 22 && d > 20) return r < 0.3 ? [bGlassTower] : r < 0.52 ? [bTower] : r < 0.64 ? [bSteppedTower] : r < 0.84 ? [bOffice, { floors: sri(8, 16) }] : [bApartment, { floors: sri(6, 12) }];
      return r < 0.45 ? [bOffice, { floors: sri(5, 10) }] : r < 0.8 ? [bApartment, { floors: sri(5, 9) }] : [bTownRow, { floors: sri(4, 6) }]; },
    inner: () => srand() < 0.35 ? ['park'] : srand() < 0.6 ? [sr(18, 26), sr(18, 26), R1([bTower, bOffice, bGlassTower]), { floors: sri(8, 14) }] : [sr(22, 30), sr(20, 28), bParking] },
  uptown: { w: () => sr(15, 28), wmin: 10, dmin: 12, dmax: 24, walk: 3.4, set: 0.8, gap: 0.5, gap2: () => sr(1, 4), corner: 3,
    pick: (w, d) => { const r = srand(); return r < 0.55 ? [bApartment, { floors: sri(5, 10) }] : r < 0.75 ? [bOffice, { floors: sri(5, 9) }] : r < 0.85 && w > 20 ? [bTower] : r < 0.92 ? [bShops] : [bTownRow, { floors: sri(3, 5) }]; },
    inner: () => srand() < 0.45 ? ['park'] : srand() < 0.6 ? ['lot'] : [sr(16, 22), sr(14, 20), bApartment, { floors: sri(4, 7), shops: false }] },
  midtown: { w: () => sr(8, 15), wmin: 6, dmin: 10, dmax: 22, walk: 3.2, set: 0.2, gap: 0.1, gap2: () => sr(0, 0.6), corner: 2.5,
    pick: (w, d) => w > 13 && srand() < 0.5 ? [bApartment, { floors: sri(3, 5) }] : srand() < 0.12 ? [bShops] : [bTownRow, { floors: sri(2, 4) }],
    inner: () => srand() < 0.5 ? ['park'] : srand() < 0.5 ? ['lot'] : [sr(9, 13), sr(9, 12), bTownRow, { floors: 2, shop: false }] },
  oldtown: { w: () => sr(6, 11), wmin: 5, dmin: 8, dmax: 16, walk: 2.6, set: 0.1, gap: 0.05, gap2: () => 0.1, corner: 2,
    pick: () => [bTownRow, { old: true, floors: sri(2, 4) }],
    inner: () => srand() < 0.55 ? ['park'] : [sr(7, 10), sr(7, 10), bTownRow, { old: true, floors: 2, shop: false }] },
  urban: { w: () => R1([sr(9, 13), sr(13, 22), sr(16, 26)]), wmin: 7, dmin: 12, dmax: 26, walk: 3.2, set: 0.6, gap: 0.6, gap2: () => sr(0.2, 2.2), corner: 2.5,
    pick: (w, d) => { const r = srand(); if (w < 12) return [bTownRow, { floors: sri(2, 3) }]; if (w > 20 && r < 0.15) return [bOffice, { floors: sri(3, 6) }];
      return r < 0.45 ? [bApartment, { floors: sri(3, 6) }] : r < 0.7 ? [bTownRow, { floors: sri(2, 4) }] : r < 0.88 ? [bShops] : [bApartment, { floors: sri(2, 4), shops: false }]; },
    inner: () => { const r = srand(); return r < 0.2 ? ['park'] : r < 0.42 ? ['lot'] : [sr(12, 20), sr(12, 18), R1([bApartment, bTownRow, bApartment, bOffice]), { floors: sri(2, 5), shops: false, shop: false }]; } },
  strip: { w: () => sr(16, 28), wmin: 10, dmin: 12, dmax: 26, walk: 3.4, set: 1.0, gap: 0.8, gap2: () => sr(1, 4), corner: 3,
    pick: (w, d, L) => { const u = L.x - beachCX(L.z), r = srand(); if (u > 50) return r < 0.78 ? [bHotel] : [bApartment, { floors: sri(4, 8) }]; if (u < -55) return w > 14 && r < 0.65 ? [bVilla] : [bApartment, { floors: sri(3, 5) }]; return r < 0.45 ? [bApartment, { floors: sri(3, 6) }] : r < 0.75 ? [bShops] : [bHotel]; },
    inner: () => srand() < 0.5 ? ['park'] : srand() < 0.5 ? ['lot'] : [sr(14, 20), sr(12, 18), bApartment, { floors: sri(3, 6), shops: false }] },
  village: { w: () => sr(8, 13), wmin: 7, dmin: 8, dmax: 13, walk: 2.6, set: 1.5, gap: 0.8, gap2: () => sr(1, 5), corner: 3,
    pick: () => srand() < 0.3 ? [bShops] : [bTownRow, { floors: sri(1, 2) }], inner: () => ['park'] },
  port: { w: () => sr(26, 48), wmin: 20, dmin: 18, dmax: 36, walk: 2.4, set: 3, gap: 4, gap2: () => sr(5, 12), corner: 4,
    pick: () => [srand() < 0.7 ? bWarehouse : bFactory], inner: () => srand() < 0.6 ? ['yard'] : [sr(26, 40), sr(20, 28), bWarehouse] },
  industrial: { w: () => sr(24, 44), wmin: 18, dmin: 18, dmax: 34, walk: 2.4, set: 4, gap: 3, gap2: () => sr(4, 12), corner: 4,
    pick: () => [srand() < 0.55 ? bFactory : bWarehouse], inner: () => srand() < 0.5 ? ['yard'] : [sr(24, 36), sr(20, 30), R1([bFactory, bWarehouse])] },
};
// Hauptachsen eines Polygons (für Ausrichtung von Parks)
function polyFrame(P, cx, cz) { let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P) { const dx = x - cx, dz = z - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(th), uz = Math.sin(th); let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const [x, z] of P) { const du = (x - cx) * ux + (z - cz) * uz, dv = -(x - cx) * uz + (z - cz) * ux; u0 = Math.min(u0, du); u1 = Math.max(u1, du); v0 = Math.min(v0, dv); v1 = Math.max(v1, dv); }
  const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2; return { th, x: cx + ux * mu - uz * mv, z: cz + uz * mu + ux * mv, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2 }; }
// freie Tiefe vom Bauflucht-Punkt ins Blockinnere (bis Blockrand oder nächste Straße)
function blockDepth(e, p, side, front, poly) { const nx = -p.tz * side, nz = p.tx * side; let d = 0;
  for (d = 2; d < 150; d += 2.5) { const x = p.x + nx * (front + d), z = p.z + nz * (front + d); if (!pip(x, z, poly)) break; const r = Roads.nearest(x, z, 16); if (r && r.e !== e && r.d < r.e.hw + 3.8) break; }
  return d - 2.5; }
function parkingLot(L) { reserve(L); const F = FR(L.x, L.y, L.z, L.yaw); PB(F, 0, -0.9, 0, L.w, 1.02, L.d, '#3a3b40', { mat: 'road' }); const rows = Math.max(1, Math.floor(L.d / 11));
  for (let r = 0; r < rows; r++) { const z = -L.d / 2 + 5.5 + r * 11; parkLines(F, -L.w / 2 + 2, L.w / 2 - 2, z, 5); for (let x = -L.w / 2 + 3; x < L.w / 2 - 2; x += 2.8) if (srand() < 0.35) propCar(F, x + 1.4, z, srand() < 0.5 ? 0 : Math.PI, spick(PAL.car)); }
  BLD.push({ x: L.x, z: L.z, w: L.w, d: L.d, yaw: L.yaw, h: 0, lot: true }); }
function storageYard(L) { reserve(L); const F = FR(L.x, L.y, L.z, L.yaw); PB(F, 0, -0.9, 0, L.w, 1.02, L.d, '#6a6a66', { mat: 'concrete' });
  for (let x = -L.w / 2 + 3; x < L.w / 2 - 3; x += 3) for (let z = -L.d / 2 + 7; z < L.d / 2 - 6; z += 13) if (srand() < 0.7) { const n = sri(1, 3); for (let s = 0; s < n; s++) container(F, x, 0.1 + s * 2.6, z, 0, spick(['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#5d6d7e'])); const q = LP(F, x, 0, z); World.addOBB(q.x, q.z, 1.25, 6.1, L.yaw, L.y + n * 2.6); }
  BLD.push({ x: L.x, z: L.z, w: L.w, d: L.d, yaw: L.yaw, h: 3 }); }
// exakter Punkt + Richtung auf einer Straße bei Strecke s
const _ea = V3(); function edgeAt(e, s) { const q = Roads.lanePoint(e, 1, s, 0, _ea); return { x: q.x, y: q.y, z: q.z, tx: q.tx, tz: q.tz }; }
function buildBlocks() {
  let parks = 0;
  for (const B of Roads.blocks || []) {
    if (B.area < 600 || B.area > 400000) continue; const zone = zoneAt(B.cx, B.cz), R = BLOCK_RULES[zone]; if (!R || inPark(B.cx, B.cz)) continue;
    // ab und zu ein kleiner Park statt Bebauung
    if ((zone === 'urban' || zone === 'uptown' || zone === 'midtown' || zone === 'oldtown') && B.area > 2500 && B.area < 22000 && srand() < 0.06 && parks < 14) { const f = polyFrame(B.pts, B.cx, B.cz), hx = f.hu - 13, hz = f.hv - 13;
      if (hx > 12 && hz > 12 && pip(f.x, f.z, B.pts)) { makePark(f.x, f.z, -f.th, hx, hz, { trees: Math.round(hx * hz / 90), name: spick(['PLAZA', 'PARQUE', 'GARDENS', 'SQUARE']) }); parks++; continue; } }
    // Randbebauung entlang jeder Blockkante
    for (const [e, fwd] of B.loop) { if (e.bridge || e.dirt || (e.type === 'highway' && zone !== 'port' && zone !== 'industrial')) continue;
      const A = Roads.nodes[e.a], Bn = Roads.nodes[e.b], P = e.pts, n = P.length, mid = P[n >> 1]; let side = 0;
      for (const sd of [1, -1]) { const o = e.hw + 6; if (pip(mid.x - mid.tz * o * sd, mid.z + mid.tx * o * sd, B.pts)) { side = sd; break; } } if (!side) continue;
      const front = e.hw + R.walk + R.set, sEnd = e.len - Bn.r - R.corner; let s = A.r + R.corner;
      while (s < sEnd - 4) { let w = Math.min(R.w(), sEnd - s); if (w < R.wmin) break;
        let p = edgeAt(e, s + w / 2); const avail = blockDepth(e, p, side, front, B.pts); if (avail < R.dmin) { s += 5; continue; }
        const d = Math.min(avail > R.dmax * 2 + 8 ? sr(R.dmin, R.dmax) : Math.max(R.dmin, avail / 2 - 0.6), avail);
        // Wand an Wand: leichte Überlappung erlaubt; sonst kleinere Varianten probieren
        LOT_GAP = -0.9; let L = null;
        for (const [fw, fd] of [[1, 1], [1, 0.72], [0.65, 1], [0.65, 0.7], [0.45, 0.6]]) { const ww = w * fw, dd = Math.max(R.dmin * 0.8, d * fd); if (ww < R.wmin * 0.8) continue; const pp = edgeAt(e, s + ww / 2);
          L = lotAt(e, pp, side, front + dd / 2, ww, dd, 1.0); if (L) { w = ww; break; } }
        LOT_GAP = 1.5;
        if (L && !inPark(L.x, L.z) && !(zone === 'strip' && L.x - beachCX(L.z) > 92)) { const [fn, opts] = R.pick(w, d, L); placeBuilding(L, fn, opts); s += w + R.gap2(); } else { s += 3; } } }
    // Blockinneres: Hinterhäuser, Parkplätze, Höfe mit Bäumen
    if (!R.inner || B.area < 2500) continue; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of B.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const st = Math.max(13, R.dmax * 0.8);
    for (let x = x0 + st / 2; x < x1; x += st) for (let z = z0 + st / 2; z < z1; z += st) { const px = x + sr(-3, 3), pz = z + sr(-3, 3); if (!pip(px, pz, B.pts)) continue;
      const r = Roads.nearest(px, pz, 200); if (!r || r.d < r.e.hw + R.walk + R.dmin + 3) continue; const sd = r.lat >= 0 ? 1 : -1, yaw = Math.atan2(r.p.tz * sd, -r.p.tx * sd), pk = R.inner();
      if (pk[0] === 'park') { if (!World.query(px - 4, pz - 4, px + 4, pz + 4, _qb).some(b => b.tag !== 'prop' && obbHit(px, pz, 2, 2, 0, b, 0.5))) { TREES.push({ t: srand() < 0.4 ? 'palm' : srand() < 0.6 ? 'tree' : 'bush', x: px, z: pz, s: sr(0.7, 1.1) }); World.addOBB(px, pz, 0.4, 0.4, 0, terrainHeight(px, pz) + 5, -50, 'prop'); } continue; }
      if (pk[0] === 'lot' || pk[0] === 'yard') { const L = lotFree(px, pz, sr(18, 30), sr(16, 24), yaw, 3); if (L) (pk[0] === 'lot' ? parkingLot : storageYard)(L); continue; }
      LOT_GAP = 1.2; const L = lotFree(px, pz, pk[0], pk[1], yaw, 3); LOT_GAP = 1.5; if (L) placeBuilding(L, pk[2], pk[3]); }
  }
}

// ---------- HAUSSTILE (Vorstadt, Land, Dörfer) ----------
function houseDoor(F, x, z, c) { PB(F, x, 0.3, z + 0.02, 1.1, 2.2, 0.12, c || spick(['#7a4a2a', '#2a4a6a', '#ffffff', '#a03a2a', '#3a5a3a'])); PG(F, x + 0.85, 2.0, z + 0.1, 0.16, 0.22, 0.1, '#ffd9a0'); PB(F, x, 0, z + 0.7, 1.8, 0.3, 1.2, '#d8d0c4', { mat: 'concrete' }); }
function mailbox(F, x, z) { { const q = LP(F, x, 0, z); if (!offRoad(q.x, q.z, 1.0)) return; } PB(F, x, 0, z, 0.12, 1.1, 0.12, '#666', { mat: 'metal' }); PB(F, x, 1.1, z, 0.35, 0.3, 0.55, spick(['#2a5aa0', '#ffffff', '#c0392b', '#1a1a1a']), { mat: 'metal' }); }
function hRanch(F, w, d) { // Bungalow im Ranch-Stil: lang, flaches Walmdach, Carport
  const W = w + 2.5, wall = spick(['#efe6d6', '#d9cbb3', '#e8dccc', '#cfd8d8', '#f2efe6', '#d8c8b0']), roofC = spick(['#ffffff', '#d8d8d8', '#c8b8a8']);
  PB(F, 0, -1.5, 0, W + 0.5, 1.8, d + 0.5, '#bdb3a2', { mat: 'concrete' }); PB(F, 0, 0.3, 0, W, 2.9, d, wall, { mat: srand() < 0.4 ? 'brick' : 'plaster' });
  part(F, G.pyr(), 0, 3.2, 0, W + 1.6, 1.5, d + 1.6, roofC, { mat: srand() < 0.5 ? 'slate' : 'roof' }); WIN_STYLE = 3;
  facade(F, W, d, 0.3, 1, 2.9, { sp: 3.0, ww: 1.6, wh: 1.2, door: -W * 0.25 }); houseDoor(F, -W * 0.25, d / 2, null);
  const cx = W / 2 + 1.8; for (const z of [-d / 2 + 1, d / 2 - 0.5]) PB(F, cx + 1.4, 0, z, 0.2, 2.6, 0.2, '#e8e8e8', { mat: 'metal' }); PB(F, cx, 2.6, 0, 3.4, 0.2, d + 0.6, '#d8d8d8', { mat: 'metal' });
  if (Q().detail > 0 && srand() < 0.4 && offRoad(LP(F, cx, 0, 0).x, LP(F, cx, 0, 0).z, 2)) propCar(F, cx, 0, 0, spick(PAL.car)); mailbox(F, -W / 2 + 0.6, d / 2 + 4.6);
  return { top: 4.7, flat: false, obbW: W };
}
function hMission(F, w, d) { // spanischer Stil: heller Putz, Ziegel-Satteldach, Arkaden-Veranda
  const wall = spick(['#f4e8d4', '#f0dcc0', '#ffe8d0', '#f8f0e0', '#ead2b0']), two = srand() < 0.45, h = two ? 6.2 : 3.6;
  PB(F, 0, -1.5, 0, w + 0.5, 1.8, d + 0.5, '#bdb3a2', { mat: 'concrete' }); PB(F, 0, 0.3, -0.8, w, h, d - 1.6, wall, { mat: 'plaster' });
  part(F, G.gable(), 0, 0.3 + h, -0.8, w + 0.9, 2.0, d - 0.6, '#ffffff', { mat: 'roof', ry: Math.PI / 2 });
  // Arkaden vorne: Pfeiler + dunkle Bögen
  const n = Math.max(2, Math.round(w / 3.2)); PB(F, 0, 2.7, d / 2 - 0.6, w, 0.9, 1.6, wall, { mat: 'plaster' }); part(F, G.box(), 0, 3.6, d / 2 - 0.4, w + 0.3, 0.25, 2.0, '#ffffff', { mat: 'roof', rx: 0.25 });
  for (let i = 0; i <= n; i++) PB(F, -w / 2 + 0.3 + i * (w - 0.6) / n, 0.3, d / 2 + 0.05, 0.45, 2.4, 0.45, wall, { mat: 'plaster' });
  for (let i = 0; i < n; i++) part(F, G.hcyl(10), -w / 2 + 0.3 + (i + 0.5) * (w - 0.6) / n, 2.35, d / 2 + 0.08, (w - 0.6) / n - 0.45, 0.7, 0.4, '#6a5a4a', { rx: 0, ry: 0 });
  WIN_STYLE = 0; facade(F, w, d - 1.6, 0.3, two ? 2 : 1, 3.0, { sp: 3.2, ww: 1.1, wh: 1.5, door: 0, shutters: srand() < 0.5 ? spick(['#2a5a7a', '#5a3a20', '#2a6a4a']) : null, only: [Math.PI, Math.PI / 2, -Math.PI / 2] });
  houseDoor(F, 0, d / 2 - 1.6, '#5a3a20'); PB(F, w / 2 - 1.2, 0.3 + h, -1.5, 0.9, 1.6, 0.9, wall, { mat: 'plaster' });
  for (const sx of [-1, 1]) { const q = LP(F, sx * (w / 2 + 1.6), 0, d / 2 + 2); TREES.push({ t: 'palm', x: q.x, z: q.z, s: sr(0.8, 1.05) }); }
  mailbox(F, -w / 2 + 0.6, d / 2 + 4.6); return { top: 0.3 + h + 2.0, flat: false };
}
function hModern(F, w, d) { // moderner Kubus: Flachdach, große Fenster, Holzverkleidung
  const c1 = spick(['#f4f4f2', '#e2e2e0', '#3a3c40', '#d8d4cc']), wood = '#ffffff';
  PB(F, 0, -1.5, 0, w + 0.5, 1.8, d + 0.5, '#bdb3a2', { mat: 'concrete' }); PB(F, -w * 0.15, 0.3, 0, w * 0.7, 3.2, d, c1, { mat: 'plaster' }); PB(F, w * 0.35, 0.3, -d * 0.1, w * 0.3, 3.2, d * 0.8, wood, { mat: 'planks' });
  PB(F, w * 0.08, 3.5, -d * 0.08, w * 0.75, 2.9, d * 0.8, c1, { mat: 'plaster' }); PB(F, w * 0.08, 6.4, -d * 0.08, w * 0.8, 0.25, d * 0.85, '#2a2c30', { mat: 'metal' }); PB(F, -w * 0.15, 3.5, 0, w * 0.72, 0.18, d + 0.2, '#2a2c30', { mat: 'metal' });
  WIN_STYLE = 1; PW(F, -w * 0.15, 1.8, d / 2 + 0.05, w * 0.55, 2.4, 0, litCol() || 0xffe8c0, 1); PW(F, w * 0.08, 4.9, d * 0.32 + 0.05, w * 0.6, 2.0, 0, litCol(), 1);
  houseDoor(F, w * 0.35, d / 2, '#2a2c30'); if (Q().detail > 0 && srand() < 0.5) { PB(F, 0, 0, -d / 2 - 4, w, 0.35, 5, '#e8e4dc', { mat: 'plaza' }); part(F, G.box(), 0, 0.31, -d / 2 - 4, w * 0.75, 0.06, 3.6, '#ffffff', { mat: 'pool' }); }
  mailbox(F, -w / 2 + 0.6, d / 2 + 4.6); return { top: 6.65, flat: true };
}
function hColonial(F, w, d) { // zweigeschossig, Holzfassade, Säulenveranda, Satteldach
  const c = spick(['#f4f4f0', '#dfe8f0', '#f6efd8', '#e8e0f0', '#dcefe0', '#f8e4d8']), roofC = spick(['#8a9aaa', '#5a6a7a', '#d8d0c4']);
  PB(F, 0, -1.5, 0, w + 0.5, 1.8, d + 0.5, '#bdb3a2', { mat: 'concrete' }); PB(F, 0, 0.3, -0.7, w, 6.0, d - 1.4, c, { mat: 'planks' });
  part(F, G.gable(), 0, 6.3, -0.7, w + 0.8, 2.6, d - 0.8, roofC, { mat: 'slate' }); WIN_STYLE = 0;
  facade(F, w, d - 1.4, 0.3, 2, 3.0, { sp: 2.6, ww: 1.0, wh: 1.6, door: 0, shutters: spick(['#2a3a5a', '#1a1a1a', '#3a5a3a', '#7a2a2a']) });
  PB(F, 0, 0.3, d / 2 - 0.6, w - 0.4, 0.2, 2.2, '#f0f0f0', { mat: 'planks' }); PB(F, 0, 3.0, d / 2 - 0.6, w, 0.25, 2.4, '#ffffff', { mat: 'concrete' });
  for (let i = 0; i < 4; i++) PC(F, -w / 2 + 0.6 + i * (w - 1.2) / 3, 0.5, d / 2 + 0.3, 0.14, 2.5, '#ffffff', { seg: 8, keep: true });
  houseDoor(F, 0, d / 2 - 1.4, spick(['#1a1a1a', '#7a2a2a', '#2a3a5a'])); PB(F, w / 2 - 1.0, 6.3, -1.2, 0.8, 2.6, 0.8, '#8a5a4a', { mat: 'brick' });
  mailbox(F, -w / 2 + 0.6, d / 2 + 4.6); return { top: 8.9, flat: false };
}
function hBungalow(F, w, d) { // kleines Holzhaus mit Giebelveranda
  const W = Math.min(w, 10), c = spick(PAL.house);
  PB(F, 0, -1.5, 0, W + 0.5, 1.8, d + 0.5, '#bdb3a2', { mat: 'concrete' }); PB(F, 0, 0.3, 0, W, 3.0, d, c, { mat: srand() < 0.5 ? 'planks' : 'plaster' });
  part(F, G.gable(), 0, 3.3, 0, W + 0.8, 2.2, d + 0.8, '#ffffff', { mat: srand() < 0.5 ? 'roof' : 'slate' }); part(F, G.gable(), 0, 2.8, d / 2 + 1.2, 4.2, 1.4, 2.6, c, { mat: 'plaster' });
  for (const sx of [-1.8, 1.8]) PB(F, sx, 0.3, d / 2 + 2.3, 0.2, 2.5, 0.2, '#ffffff'); PB(F, 0, 0.3, d / 2 + 1.2, 4, 0.2, 2.4, '#a8805a', { mat: 'planks' });
  WIN_STYLE = srand() < 0.5 ? 0 : 3; facade(F, W, d, 0.3, 1, 3.0, { sp: 2.8, ww: 1.1, wh: 1.3, door: 0 }); houseDoor(F, 0, d / 2, null);
  mailbox(F, -W / 2 + 0.6, d / 2 + 4.6); return { top: 5.5, flat: false, obbW: W };
}
function bHouse(F, w, d, L, o = {}) {
  if (o.wall || o.noCar || o.classic) return bHouseClassic(F, w, d, L, o);
  const zn = L && L.x !== undefined ? zoneAt(L.x, L.z) : 'suburb', r = srand();
  const style = zn === 'rural' || zn === 'mountain' ? (r < 0.35 ? 'ranch' : r < 0.6 ? 'bungalow' : r < 0.75 ? 'colonial' : 'classic')
    : zn === 'heights' ? (r < 0.5 ? 'modern' : r < 0.8 ? 'mission' : 'classic') : (r < 0.3 ? 'classic' : r < 0.47 ? 'mission' : r < 0.62 ? 'ranch' : r < 0.75 ? 'modern' : r < 0.88 ? 'colonial' : 'bungalow');
  return style === 'ranch' ? hRanch(F, w, d) : style === 'mission' ? hMission(F, w, d) : style === 'modern' ? hModern(F, w, d) : style === 'colonial' ? hColonial(F, w, d) : style === 'bungalow' ? hBungalow(F, w, d) : bHouseClassic(F, w, d, L, o);
}
