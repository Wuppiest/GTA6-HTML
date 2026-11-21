// =====================================================================
//  LAND & NATUR: Flugplatz, Campingplatz, Steinbruch, Sägewerk, Mine,
//  Seilbahn, Feuerwachturm, Motocross, Aussichtspunkte, Heliport
//  (kein weiterer Stadtteil – Leben für die leeren Hügel im Nordwesten)
// =====================================================================
const BLIPS = [];      // [Symbol, Farbe, x, z, Name] – Karte & Minikarte
const MAP_PAINT = [];  // Zusatz-Zeichnungen für das Kartenbild (Pisten, Pfade)
const CAMPFIRES = [];  // Lagerfeuer (Flammen + Rauch in Kameranähe)
const blip = (ic, col, x, z, name) => BLIPS.push([ic, col, x, z, name]);

// freie, flache Fläche suchen (keine Straße, kein Gebäude, kein Wasser); Front zeigt zur nächsten Straße
function natureSpot(cx, cz, rMax, hw, hd, o = {}) {
  for (let r = 0; r <= rMax; r += 15) { const n = Math.max(1, Math.round(r / 10));
    for (let k = 0; k < n; k++) { const a = k / n * TAU + r * 0.37, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const rd = Roads.nearest(x, z, 260, e => e.type !== 'highway'), yaw = o.yaw ?? (rd ? Math.atan2(rd.p.x - x, rd.p.z - z) : 0), c = Math.cos(yaw), s = Math.sin(yaw);
      if (o.road && (!rd || rd.d > o.road)) continue; let mn = 1e9, mx = -1e9, ok = true; const st = Math.max(4, Math.min(hw, hd) / 3);
      for (let u = -hw; u <= hw + 0.1 && ok; u += st) for (let v = -hd; v <= hd + 0.1 && ok; v += st) { const px = x + u * c + v * s, pz = z - u * s + v * c, h = terrainHeight(px, pz);
        if (h < (o.minH ?? 1.5) || inLake(px, pz, 6)) { ok = false; break; } const q = Roads.nearest(px, pz, 30); if (q && q.d < q.e.hw + 4) { ok = false; break; }
        if (World.query(px - 2, pz - 2, px + 2, pz + 2, _qb).length) { ok = false; break; } mn = Math.min(mn, h); mx = Math.max(mx, h); }
      if (!ok || mx - mn > (o.slope ?? 8)) continue;
      return { x, z, y: o.top ? mx : (mn + mx) / 2, lo: mn, hi: mx, yaw, road: rd };
    } }
  return null;
}
// Gelände ebnen + Fläche für Bäume/Bauten sperren
function claim(p, hw, hd, y = p.y, fall = 10) { flattenRect(p.x, p.z, hw, hd, p.yaw, y, 2, fall); World.addOBB(p.x, p.z, hw + 2, hd + 2, p.yaw, -100, -50, 'reserve'); }
// Schotterweg vom Platz zur nächsten Straße (folgt dem Gelände, nur Optik)
function trail(x0, z0, x1, z1, w = 3.4, col = '#8a7458') {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 5)), yaw = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t); if (Roads.nearest(x, z, 12)) continue; const y = terrainHeight(x, z), y2 = terrainHeight(x + Math.sin(yaw) * 2.6, z + Math.cos(yaw) * 2.6);
    part(FR(x, y, z, yaw), G.box(), 0, -0.25, 0, w, 0.32, L / n + 0.4, col, { rx: -Math.atan2(y2 - y, 2.6) }); }
  MAP_PAINT.push((g, T, s) => { g.strokeStyle = 'rgba(150,120,85,.9)'; g.lineWidth = w * s; g.beginPath(); g.moveTo(T(x0), T(z0)); g.lineTo(T(x1), T(z1)); g.stroke(); });
}
const toRoad = (p, F, lz) => { if (!p.road) return; const a = LP(F, 0, 0, lz); trail(a.x, a.z, p.road.p.x, p.road.p.z); };
const rectPaint = (p, hw, hd, col) => MAP_PAINT.push((g, T, s) => { g.save(); g.translate(T(p.x), T(p.z)); g.rotate(-p.yaw); g.fillStyle = col; g.fillRect(-hw * s, -hd * s, hw * 2 * s, hd * 2 * s); g.restore(); });
function tent(F, x, z, ry, c) { const M = FRL(F, x, 0, z, ry); part(M, G.gable(), 0, 0, 0, 2.6, 1.5, 2.8, c, { ry: Math.PI / 2 }); PB(M, 0, 0, 1.42, 0.9, 1.0, 0.02, '#2a2420'); }
function campfire(F, x, z) { const p = LP(F, x, 0, z); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; PS(F, x + Math.cos(a) * 0.7, 0.05, z + Math.sin(a) * 0.7, 0.22, '#7a7a76'); }
  for (let k = 0; k < 3; k++) part(F, G.cyl(6), x, 0.15, z, 0.18, 1.3, 0.18, '#5a3a20', { rx: Math.PI / 2, ry: k * 1.05 }); PG(F, x, 0.08, z, 0.6, 0.12, 0.6, '#ff8a2a');
  for (const [dx, dz, ry] of [[1.9, 0, 0], [-1.9, 0, 0], [0, 1.9, Math.PI / 2]]) part(F, G.cyl(6), x + dx, 0.2, z + dz, 0.4, 1.6, 0.4, '#6a4a2a', { rz: Math.PI / 2, ry });
  CAMPFIRES.push(V3(p.x, terrainHeight(p.x, p.z) + 0.2, p.z)); World.lampAnchors.push(V3(p.x, terrainHeight(p.x, p.z) + 1.2, p.z)); }
function picnic(F, x, z, ry) { const M = FRL(F, x, 0, z, ry); PB(M, 0, 0.72, 0, 1.8, 0.07, 0.8, '#8a6a44'); for (const s of [-0.65, 0.65]) PB(M, 0, 0.42, s, 1.8, 0.05, 0.28, '#8a6a44'); for (const s of [-0.7, 0.7]) PB(M, s, 0, 0, 0.08, 0.72, 0.9, '#6a5034'); }
function logPile(F, x, z, ry, n = 4) { const M = FRL(F, x, 0, z, ry); for (let r = 0; r < n; r++) for (let i = 0; i < n - r; i++) { const xx = (i - (n - r - 1) / 2) * 0.62; part(M, G.cyl(7), xx, 0.31 + r * 0.54, -3, 0.6, 6, 0.6, r % 2 ? '#8a6038' : '#7a5230', { rx: Math.PI / 2 }); PC(M, xx, 0.01 + r * 0.54, 3.01, 0.26, 0.02, '#d8b480', { rx: Math.PI / 2 }); } }
function lattice(x, y, z, h, w, col = '#c8ccd0') { for (let k = 0; k < Math.ceil(h / 6); k++) { const y0 = y + k * 6, y1 = Math.min(y + h, y0 + 6), r0 = lerp(w, w * 0.35, (y0 - y) / h), r1 = lerp(w, w * 0.35, (y1 - y) / h);
  for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) seg(x + a * r0, y0, z + b * r0, x + a * r1, y1, z + b * r1, 0.22, 0.22, col); seg(x + r0, y0, z + r0, x - r1, y1, z + r1, 0.1, 0.1, col); seg(x - r0, y0, z - r0, x + r1, y1, z - r1, 0.1, 0.1, col); } }

// ---------- FLUGPLATZ (zivil – Flugzeuge & Helis ohne Fahndung) ----------
function buildAirfield() {
  let p = null; for (const [x, z] of [[-490, -510], [-490, -480], [-460, -510]]) { p = natureSpot(x, z, 30, 50, 270, { slope: 16, yaw: 0 }); if (p) break; }
  if (!p) p = natureSpot(-500, -700, 600, 40, 250, { slope: 18, yaw: 0 }); if (!p) return;
  const y = Math.round(p.y), F = FR(p.x, y, p.z, 0); claim(p, 52, 272, y, 14); p.y = y;
  PB(F, -12, -1, 0, 28, 1.12, 520, '#4a4c50', { mat: 'asphalt' }); for (let z = -240; z <= 240; z += 26) PB(F, -12, 0.13, z, 0.6, 0.02, 12, '#f0f0f0');
  for (const e of [-1, 1]) { for (let k = -4; k <= 4; k++) PB(F, -12 + k * 2.6, 0.13, e * 252, 1.4, 0.02, 14, '#f0f0f0'); for (let k = -6; k <= 6; k++) PG(F, -12 + k * 2.2, 0.14, e * 262, 0.35, 0.15, 0.35, e > 0 ? '#3aff6a' : '#ff3a3a'); }
  for (let z = -250; z <= 250; z += 25) for (const s of [-1, 1]) PG(F, -12 + s * 14.6, 0.14, z, 0.25, 0.2, 0.25, '#ffe9a0');
  Signs.quad(F, -12, 0.15, -232, 8, 6, 0, Signs.cell('18', '#4a4c50', '#ffffff'));
  PB(F, 22, -1, 0, 44, 1.1, 190, '#6e7074', { mat: 'concrete' }); PB(F, 6, -1, 110, 18, 1.1, 30, '#5e6064'); for (let z = -80; z <= 80; z += 4) PB(F, 2, 0.12, z, 0.25, 0.02, 2, '#ffd23a');
  // Hangars, Büro mit Tower, Tank, Windsack
  for (const hz of [-60, -10]) { const H = FRL(F, 38, 0, hz, -Math.PI / 2); part(H, G.hcyl(12), 0, 0, -12, 26, 12, 24, '#a8aeb0'); PB(H, 0, 0, -12, 26, 0.1, 24, '#8a8c90'); PB(H, 0, 0, 0.2, 26.4, 12.4, 0.4, '#8a9096', { keep: true }); PB(H, 0, 0, 0.42, 20, 9, 0.05, '#3a3d42');
    const q = LP(H, 0, 0, -12); World.addOBB(q.x, q.z, 12.5, 13, -Math.PI / 2, y + 13); BLD.push({ x: q.x, z: q.z, w: 24, d: 26, yaw: -Math.PI / 2, h: 12 }); }
  { const B = FRL(F, 36, 0, 45, -Math.PI / 2); PB(B, 0, 0, 0, 16, 4.2, 10, '#f2efe6'); PW(B, 0, 2.1, 5.03, 12, 2, 0, 0xfff0c8); PB(B, 0, 4.2, 0, 16.6, 0.4, 10.6, '#2a6f97'); PB(B, 5, 4.6, -1, 4, 4, 4, '#f2efe6'); part(B, G.box(), 5, 8.6, -1, 4.6, 2.2, 4.6, '#3d5a73', { mat: 'win', emis: 0x9fd0ff }); PB(B, 5, 10.8, -1, 5, 0.4, 5, '#2a6f97');
    Signs.quad(B, -2, 4.9, 5.35, 10, 1.4, 0, Signs.cell('SOLARA AIRFIELD', '#2a6f97', '#ffffff')); const q = LP(B, 0, 0, 0); World.addOBB(q.x, q.z, 8, 5, -Math.PI / 2, y + 11); BLD.push({ x: q.x, z: q.z, w: 16, d: 10, yaw: -Math.PI / 2, h: 11 }); World.lampAnchors.push(LP(B, 0, 3.6, 6)); }
  PC(F, 40, 0, 75, 3, 5, '#e8e8e4', { seg: 12, mat: 'metal' }); { const q = LP(F, 40, 0, 75); World.addOBB(q.x, q.z, 3, 3, 0, y + 5); }
  PC(F, 2, 0, -100, 0.08, 6, '#c8ccd2'); { const ws = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 1.2), new THREE.MeshLambertMaterial({ color: 0xff6a1a, side: THREE.DoubleSide })); const q = LP(F, 2, 5.8, -100); ws.position.copy(q); scene.add(ws);
    World.anim.push((dt) => { const w = Env.w.wind; ws.rotation.y = 0.9 + Math.sin(GameTime * 0.3) * 0.2; ws.rotation.x = 0.9 * (1 - Math.min(1, w + 0.25)) + Math.sin(GameTime * 3) * 0.05; }); }
  // Helipad + Zeppelin-Mast
  PC(F, 22, -1, 120, 9, 1.16, '#5a5e64', { seg: 20 }); PC(F, 22, 0.17, 120, 8, 0.02, '#ffd23a', { seg: 20 }); PB(F, 20, 0.19, 120, 1, 0.02, 6, '#fff'); PB(F, 24, 0.19, 120, 1, 0.02, 6, '#fff'); PB(F, 22, 0.19, 120, 3, 0.02, 1, '#fff');
  lattice(LP(F, 40, 0, 160).x, y, LP(F, 40, 0, 160).z, 14, 1.6, '#d23a2a');
  const P = (t, lx, lz, yaw, col) => { const q = LP(F, lx, 0, lz); PARKED.push([t, q.x, q.z, yaw, col]); };
  P('plane', 14, -70, -Math.PI / 2, '#f2f2f2'); P('biplane', 14, -45, -Math.PI / 2, '#c1121f'); P('seaplane', 14, -22, -Math.PI / 2); P('bizjet', 22, 5, -Math.PI / 2, '#f4f4f4'); P('plane', 14, 35, -Math.PI / 2, '#ffcc00'); P('newsheli', 22, 120, -Math.PI / 2, '#1e6fd0'); P('blimp', 40, 182, Math.PI, '#e8eaee');
  toRoad(p, F, 0); LOC.airfield = LP(F, -12, 0, -200); LOC.airfield.yaw = 0; LOC.airfieldPad = LP(F, 22, 0, 120); blip('✈', '#2a6f97', p.x, p.z, 'Flugplatz');
  MAP_PAINT.push((g, T, s) => { g.fillStyle = '#6e7074'; g.fillRect(T(p.x + 0), T(p.z - 95), 44 * s, 190 * s); g.fillStyle = '#3a3c40'; g.fillRect(T(p.x - 26), T(p.z - 260), 28 * s, 520 * s); });
}

// ---------- CAMPINGPLATZ ----------
function buildCampground() {
  const p = natureSpot(-1330, -1430, 420, 34, 26, { slope: 7, road: 160 }) || natureSpot(-1600, -800, 400, 30, 24, { slope: 8 }); if (!p) return;
  const F = FR(p.x, p.y, p.z, p.yaw); claim(p, 34, 26); PB(F, 0, -0.9, 0, 64, 1, 48, '#7a8a52');
  const cols = ['#e8642a', '#2a8ad8', '#3aa04a', '#d8c02a', '#c23a6a', '#5a6a7a'];
  for (let i = 0; i < 8; i++) { const lx = -24 + (i % 4) * 14 + sr(-2, 2), lz = (i < 4 ? -12 : 4) + sr(-2, 2); tent(F, lx, lz, sr(-0.6, 0.6), cols[i % cols.length]); }
  for (const [lx, lz] of [[-8, -3], [16, 13]]) { campfire(F, lx, lz); picnic(F, lx + 4, lz - 3, 0.3); }
  for (const [lx, lz] of [[-26, 16], [24, -16]]) picnic(F, lx, lz, 0);
  { const B = FRL(F, 26, 0, 12, 0); PB(B, 0, 0, 0, 6, 3, 4, '#8a6a44'); part(B, G.gable(), 0, 3, 0, 6.6, 1.6, 4.6, '#5a4030'); PB(B, 0, 0, 2.02, 1, 2.1, 0.05, '#3a2a1a'); const q = LP(B, 0, 0, 0); World.addOBB(q.x, q.z, 3, 2, p.yaw, p.y + 4.6); BLD.push({ x: q.x, z: q.z, w: 6, d: 4, yaw: p.yaw, h: 4 }); }
  { const S = FRL(F, 0, 0, 25, 0); PB(S, -3, 0, 0, 0.3, 3, 0.3, '#6a4a2a'); PB(S, 3, 0, 0, 0.3, 3, 0.3, '#6a4a2a'); Signs.quad(S, 0, 2.2, 0.2, 6, 1, 0, Signs.cell('PINE LAKE CAMP', '#3a5a2a', '#ffe8a0')); }
  for (let i = 0; i < 9; i++) PG(F, -20 + i * 5, 2.6 + Math.sin(i) * 0.2, -2, 0.18, 0.18, 0.18, ['#ffcf6a', '#ff7a6a', '#7ad0ff'][i % 3]);
  for (let i = 0; i < 9; i++) PC(F, -21 + i * 5, 0, -2, 0.06, 2.6, '#5a4030');
  for (const [lx, lz, t, c] of [[-30, 22, 'van', '#f2efe6'], [-18, 22, 'pickup', '#7a2a2a'], [30, -22, 'suv', '#3a4a5a']]) { const q = LP(F, lx, 0, lz); PARKED.push([t, q.x, q.z, p.yaw + Math.PI / 2, c]); }
  toRoad(p, F, 26); LOC.camp = V3(p.x, p.y, p.z); blip('⛺', '#3aa04a', p.x, p.z, 'Campingplatz'); rectPaint(p, 34, 26, 'rgba(110,140,80,.9)');
}

// ---------- STEINBRUCH (Terrassen ins Gelände gegraben) ----------
function buildQuarry() {
  const p = natureSpot(-930, -1280, 420, 55, 55, { slope: 26, minH: 12 }); if (!p) return;
  const top = Math.round(p.hi), F = FR(p.x, top, p.z, p.yaw); World.addOBB(p.x, p.z, 64, 64, p.yaw, -100, -50, 'reserve');
  for (let k = 0; k < 4; k++) flattenRect(p.x, p.z, 52 - k * 11, 52 - k * 11, p.yaw, top - 2 - k * 6, 0, k ? 5 : 10);
  // Terrassen: Schotterböden + Steinwände, damit die Grube als Steinbruch erkennbar ist
  for (let k = 0; k < 4; k++) { const ro = 52 - k * 11, ri = k < 3 ? 52 - (k + 1) * 11 : 0, yk = -2 - k * 6, w = ro - ri, col = ['#9e9280', '#948876', '#8a7e6c', '#807462'][k];
    if (ri > 0) { for (const [lx, lz, sw, sd] of [[0, (ro + ri) / 2, ro * 2, w], [0, -(ro + ri) / 2, ro * 2, w], [(ro + ri) / 2, 0, w, ri * 2], [-(ro + ri) / 2, 0, w, ri * 2]]) PB(F, lx, yk - 0.5, lz, sw, 0.62, sd, col);
      for (const [lx, lz, sw, sd] of [[0, ri, ri * 2, 0.8], [0, -ri, ri * 2, 0.8], [ri, 0, 0.8, ri * 2], [-ri, 0, 0.8, ri * 2]]) PB(F, lx, yk - 6.2, lz, sw, 6.3, sd, '#7a7064'); }
    else PB(F, 0, yk - 0.5, 0, ro * 2, 0.62, ro * 2, col); }
  const yb = top - 20;
  for (const [lx, lz, r] of [[-12, -10, 2.4], [-6, -14, 1.8], [10, 8, 2.8], [14, -4, 2]]) PS(F, lx, -20 + r * 0.4, lz, r, '#a8a296', { sy: 0.6, seg: 7 });
  // Bagger
  const exc = (lx, ly, lz, ry) => { const M = FRL(F, lx, ly, lz, ry); for (const s of [-1, 1]) PB(M, s * 1.3, 0, 0, 0.8, 0.9, 4.2, '#2a2c30'); PB(M, 0, 0.9, -0.3, 2.8, 1.2, 3.2, '#f0b020'); PB(M, 0.75, 2.1, 0.5, 1.1, 1.4, 1.2, '#f0b020'); part(M, G.box(), 0.75, 2.4, 1.12, 0.9, 0.8, 0.05, '#3d5a73', { mat: 'win' });
    part(M, G.box(), -0.3, 2.2, 2.2, 0.4, 0.4, 4.2, '#e8a818', { rx: -0.6 }); part(M, G.box(), -0.3, 3.4, 4.6, 0.35, 0.35, 3.2, '#e8a818', { rx: 0.9 }); PB(M, -0.3, 1.0, 5.6, 1.2, 0.8, 0.8, '#4a4c50'); const q = LP(M, 0, 0, 0); World.addOBB(q.x, q.z, 1.8, 2.6, p.yaw + ry, q.y + 3.4); };
  exc(-6, -20, 4, 0.6); exc(16, -14, -14, -2.2);
  // Muldenkipper
  { const M = FRL(F, 8, -20, -6, 1.1); PB(M, 0, 0.7, 0, 3.2, 0.5, 7, '#f0b020'); part(M, G.box(), 0, 1.2, -1.2, 3.2, 1.8, 4.4, '#e8a818', { rx: 0.05 }); PB(M, 0, 1.2, 2.6, 2.6, 1.8, 1.8, '#f0b020'); part(M, G.box(), 0, 2.4, 3.52, 2.2, 0.7, 0.05, '#3d5a73', { mat: 'win' });
    for (const [x, z] of [[-1.5, 2.2], [1.5, 2.2], [-1.5, -2], [1.5, -2]]) PC(M, x, 0.85, z, 0.85, 0.7, '#1b1b1d', { rz: Math.PI / 2 }); const q = LP(M, 0, 0, 0); World.addOBB(q.x, q.z, 1.7, 3.6, p.yaw + 1.1, q.y + 3.2); }
  // Förderband, Brecher, Büro-Container, Schild
  { const a = LP(F, 4, -20, 12), b = LP(F, 4, 1.5, 62); seg(a.x, a.y + 1.5, a.z, b.x, b.y + 6, b.z, 1.2, 0.3, '#3a3d42'); for (let t = 0.15; t < 1; t += 0.2) { const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t), yy = lerp(a.y + 1.5, b.y + 6, t); seg(x, terrainHeight(x, z) - 0.5, z, x, yy, z, 0.25, 0.25, '#6a6e74'); } }
  { const B = FRL(F, -20, 0, 62, 0); PB(B, 0, 0, 0, 7, 6, 7, '#c8a018'); part(B, G.frus(0.4, 0.4), 0, 6, 0, 6, 3, 6, '#9a8a6a'); const q = LP(B, 0, 0, 0); World.addOBB(q.x, q.z, 3.5, 3.5, p.yaw, top + 9); BLD.push({ x: q.x, z: q.z, w: 7, d: 7, yaw: p.yaw, h: 9 }); }
  { const C = FRL(F, 22, 0, 62, 0); container(C, 0, 0, 0, Math.PI / 2, '#f2efe6'); Signs.quad(C, 0, 2.9, 1.3, 6, 1, 0, Signs.cell('SOLARA STONE CO.', '#5a5048', '#ffd23a')); }
  { const q = LP(F, 30, 0, 72); PARKED.push(['flatbed', q.x, q.z, p.yaw, '#f0b020'], ['pickup', LP(F, 36, 0, 72).x, LP(F, 36, 0, 72).z, p.yaw, '#e8e8e8']); }
  toRoad(p, F, 66); blip('⛏', '#a8822a', p.x, p.z, 'Steinbruch');
  MAP_PAINT.push((g, T, s) => { for (let k = 0; k < 4; k++) { const r = 52 - k * 11; g.save(); g.translate(T(p.x), T(p.z)); g.rotate(-p.yaw); g.fillStyle = `rgb(${170 - k * 14},${160 - k * 14},${140 - k * 14})`; g.fillRect(-r * s, -r * s, r * 2 * s, r * 2 * s); g.restore(); } });
}

// ---------- SÄGEWERK ----------
function buildLumber() {
  const p = natureSpot(-1250, -640, 420, 32, 24, { slope: 7, road: 140 }); if (!p) return;
  const F = FR(p.x, p.y, p.z, p.yaw); claim(p, 32, 24); PB(F, 0, -0.9, 0, 62, 1, 46, '#7a6a52');
  { const H = FRL(F, -10, 0, -6, 0); for (const x of [-9, -3, 3, 9]) for (const z of [-6, 6]) PB(H, x, 0, z, 0.4, 6, 0.4, '#6a4a2a'); part(H, G.gable(), 0, 6, 0, 20, 2.6, 14, '#7a3a2a'); PB(H, 0, 0, 0, 12, 1.1, 1.6, '#5a5e64'); PC(H, 0, 1.1, 0, 0.9, 0.08, '#c8ccd2', { rz: Math.PI / 2 });
    PS(H, 6, 0, 3, 2.4, '#d8b07a', { sy: 0.6 }); const q = LP(H, 0, 0, 0); World.addOBB(q.x, q.z, 10, 7, p.yaw, p.y + 8.6, p.y + 5.8); BLD.push({ x: q.x, z: q.z, w: 20, d: 14, yaw: p.yaw, h: 8 }); }
  for (const [lx, lz] of [[12, -12], [20, -12], [12, -2], [20, -2]]) logPile(F, lx, lz, Math.PI / 2, 4);
  for (const [lx, lz] of [[-22, 10], [-16, 10]]) { for (let r = 0; r < 6; r++) PB(F, lx, r * 0.32, lz, 3, 0.28, 5, r % 2 ? '#d8b480' : '#c8a470'); const q = LP(F, lx, 0, lz); World.addOBB(q.x, q.z, 1.5, 2.5, p.yaw, p.y + 2); }
  { const q = LP(F, 16, 0, 12), M = FRL(F, 16, 0, 12, 0); PARKED.push(['flatbed', q.x, q.z, p.yaw + Math.PI / 2, '#2a5a3a']); void M; }
  { const S = FRL(F, 0, 0, 23, 0); PB(S, -3, 0, 0, 0.3, 3, 0.3, '#6a4a2a'); PB(S, 3, 0, 0, 0.3, 3, 0.3, '#6a4a2a'); Signs.quad(S, 0, 2.2, 0.2, 6, 1, 0, Signs.cell('PINE RIDGE LUMBER', '#6a3a1a', '#ffe0a0')); }
  toRoad(p, F, 24); blip('🪵', '#8a5a2a', p.x, p.z, 'Sägewerk'); rectPaint(p, 32, 24, 'rgba(140,115,85,.9)');
}

// ---------- ALTE MINE ----------
function buildMine() {
  const p = natureSpot(-1380, -1120, 380, 9, 9, { slope: 18, minH: 25 }); if (!p) return;
  // Hang: Richtung zum höheren Gelände = Stolleneingang
  let best = 0, by = -1e9; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, h = terrainHeight(p.x + Math.sin(a) * 18, p.z + Math.cos(a) * 18); if (h > by) { by = h; best = a; } }
  const F = FR(p.x, p.y, p.z, best); flattenRect(p.x, p.z, 7, 9, best, p.y, 1, 6); World.addOBB(p.x, p.z, 10, 14, best, -100, -50, 'reserve');
  PB(F, 0, 0, 8.5, 4.6, 4.4, 5, '#0c0c0e'); for (const s of [-1, 1]) PB(F, s * 2.4, 0, 6, 0.45, 4.2, 0.45, '#5a3e24'); PB(F, 0, 4.0, 6, 5.6, 0.5, 0.55, '#5a3e24'); Signs.quad(F, 0, 4.7, 5.7, 3.6, 0.8, 0, Signs.cell('LUCKY STRIKE MINE', '#3a2a1a', '#ffcf6a'));
  for (let z = 6; z > -22; z -= 1.2) PB(F, 0, 0.02, z, 1.8, 0.1, 0.22, '#5a4030'); for (const s of [-0.6, 0.6]) PB(F, s, 0.12, -8, 0.08, 0.1, 28, '#6a6e74', { mat: 'metal' });
  for (const z of [-4, -10]) { const M = FRL(F, 0, 0.2, z, 0); PB(M, 0, 0.3, 0, 1.4, 0.9, 1.9, '#6a4a30'); PB(M, 0, 1.2, 0, 1.3, 0.3, 1.8, '#4a4a48'); const q = LP(M, 0, 0, 0); World.addOBB(q.x, q.z, 0.75, 1, best, p.y + 1.6); }
  { const S = FRL(F, 5, 0, -6, 0.3); PB(S, 0, 0, 0, 4, 3, 3.4, '#6a5a44'); part(S, G.gable(), 0, 3, 0, 4.4, 1.2, 3.8, '#4a3a2a'); const q = LP(S, 0, 0, 0); World.addOBB(q.x, q.z, 2, 1.7, best + 0.3, p.y + 4.2); BLD.push({ x: q.x, z: q.z, w: 4, d: 3.4, yaw: best, h: 4 }); }
  PB(F, -4, 0, -2, 0.12, 1.6, 0.12, '#5a4030'); Signs.quad(F, -4, 1.4, -1.9, 1.6, 0.6, 0, Signs.cell('DANGER', '#c0392b', '#fff')); PICKUP_SPOTS.push(['cash', LP(F, 0, 0, 3).x, LP(F, 0, 0, 3).z]);
  toRoad(p, F, -20); blip('⛏', '#6a4a30', p.x, p.z, 'Alte Mine');
}

// ---------- FEUERWACHTURM + RANGERSTATION ----------
function buildLookout() {
  const p = natureSpot(-820, -930, 500, 10, 10, { slope: 9, minH: 30 }); if (!p) return;
  const F = FR(p.x, p.y, p.z, p.yaw); claim(p, 10, 10); const H = 16;
  for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const q0 = LP(F, a * 3, 0, b * 3), q1 = LP(F, a * 1.8, H, b * 1.8); seg(q0.x, p.y - 0.5, q0.z, q1.x, q1.y, q1.z, 0.3, 0.3, '#6a4a2a'); }
  for (let k = 1; k < 4; k++) { const r = lerp(3, 1.8, k / 4), yy = H * k / 4; for (const [a, b, c, d] of [[1, 1, -1, 1], [1, -1, -1, -1], [1, 1, 1, -1], [-1, 1, -1, -1]]) { const q0 = LP(F, a * r, yy, b * r), q1 = LP(F, c * r, yy, d * r); seg(q0.x, q0.y, q0.z, q1.x, q1.y, q1.z, 0.14, 0.14, '#6a4a2a'); } }
  PB(F, 0, H, 0, 4.6, 0.3, 4.6, '#6a4a2a'); PB(F, 0, H + 0.3, 0, 3.6, 1.1, 3.6, '#8a6a44'); for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const M = FRL(F, 0, 0, 0, ry); part(M, G.box(), 0, H + 1.4, 1.81, 3.4, 1.2, 0.05, '#3d5a73', { mat: 'win' }); }
  part(F, G.pyr(), 0, H + 2.7, 0, 5, 1.6, 5, '#4a3a2a'); railing(F, -2.3, 2.3, 2.3, 2.3, H + 0.3, 1, '#6a4a2a'); World.addOBB(p.x, p.z, 3.2, 3.2, p.yaw, p.y + H + 4);
  { const B = FRL(F, 0, 0, 7, 0); PB(B, 0, 0, 0, 7, 3.2, 5, '#7a6248'); part(B, G.gable(), 0, 3.2, 0, 7.6, 1.6, 5.6, '#3a4a2a'); Signs.quad(B, 0, 2.6, 2.55, 4, 0.7, 0, Signs.cell('RANGER STATION', '#3a4a2a', '#ffe0a0')); const q = LP(B, 0, 0, 0); World.addOBB(q.x, q.z, 3.5, 2.5, p.yaw, p.y + 4.8); BLD.push({ x: q.x, z: q.z, w: 7, d: 5, yaw: p.yaw, h: 4.8 }); }
  { const q = LP(F, 7, 0, 8); PARKED.push(['pickup', q.x, q.z, p.yaw, '#3a5a2a']); }
  toRoad(p, F, 10); blip('🌲', '#3a6a2a', p.x, p.z, 'Feuerwachturm'); LOC.lookout = V3(p.x, p.y, p.z);
}

// ---------- MOTOCROSS-STRECKE ----------
function buildMotocross() {
  const p = natureSpot(-780, -1350, 450, 46, 30, { slope: 9 }); if (!p) return;
  const F = FR(p.x, p.y, p.z, p.yaw); claim(p, 46, 30); PB(F, 0, -0.9, 0, 92, 1, 60, '#9a7a56');
  for (const [lx, lz, ry] of [[-20, -16, Math.PI / 2], [20, 16, -Math.PI / 2], [-30, 10, Math.PI], [30, -10, 0]]) { const H = 1.8, L = 7, W = 6, q = LP(F, lx, 0, lz), yaw = p.yaw + ry, M = FR(q.x, p.y, q.z, yaw), ang = Math.atan2(H, L);
    part(M, G.box(), 0, -0.6, -L / 2, W, 0.6, Math.hypot(L, H), '#8a6a46', { rx: -ang }); PB(M, 0, -0.6, 1.5, W, H + 0.6, 3, '#8a6a46'); Ramps.list.push({ x: q.x, z: q.z, yaw, c: Math.cos(yaw), s: Math.sin(yaw), y0: p.y, L, H, W, endX: q.x, endZ: q.z, id: 100 + Ramps.list.length }); }
  for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, lx = Math.cos(a) * 40, lz = Math.sin(a) * 25; PC(F, lx, 0, lz, 0.5, 0.4, i % 2 ? '#e8e8e8' : '#d23a2a', { seg: 6 }); }
  { const S = FRL(F, 0, 0, 29, 0); PB(S, 0, 0, 0, 10, 2.2, 3, '#c8ccd0', { mat: 'metal' }); for (let r = 0; r < 3; r++) PB(S, 0, 0.5 + r * 0.6, -0.6 + r * 0.6, 10, 0.12, 0.5, '#5a5e64'); Signs.quad(S, 0, 3.2, 1.6, 8, 1.1, 0, Signs.cell('DIRT DEVILS MX', '#1d1e22', '#ff7a1a')); const q = LP(S, 0, 0, 0); World.addOBB(q.x, q.z, 5, 1.5, p.yaw, p.y + 2.4); }
  for (const [lx, c] of [[-6, '#ff7a1a'], [-3, '#2a8ad8'], [0, '#3aa04a']]) { const q = LP(F, lx, 0, 24); PARKED.push(['bike', q.x, q.z, p.yaw + Math.PI, c]); }
  toRoad(p, F, 30); blip('🏍', '#ff7a1a', p.x, p.z, 'Motocross'); rectPaint(p, 46, 30, 'rgba(160,125,85,.9)');
}

// ---------- SEILBAHN ZUM GIPFEL ----------
const Cable = { line: null, cabins: [], ride: null };
function buildCableCar() {
  const s = LOC.summit, sy = terrainHeight(s.x, s.z); let p = null;
  for (const r of [380, 480, 560, 640]) { for (let k = 0; k < 12 && !p; k++) { const a = k / 12 * TAU, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, q = natureSpot(x, z, 60, 9, 9, { slope: 9, road: 90 }); if (q && sy - q.y > 70) p = q; } if (p) break; }
  if (!p) return; claim(p, 9, 9);
  const yawL = Math.atan2(s.x - p.x, s.z - p.z), top = V3(s.x - Math.sin(yawL) * 30, sy, s.z - Math.cos(yawL) * 30), F0 = FR(p.x, p.y, p.z, yawL), F1 = FR(top.x, terrainHeight(top.x, top.z), top.z, yawL);
  flattenRect(top.x, top.z, 8, 8, yawL, Math.round(terrainHeight(top.x, top.z)), 1, 8);
  for (const [F, y] of [[F0, p.y], [F1, null]]) { PB(F, 0, 0, 0, 10, 0.4, 10, '#8a8c90'); for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) PB(F, a * 4.6, 0, b * 4.6, 0.5, 8, 0.5, '#c8ccd0', { mat: 'metal' }); PB(F, 0, 8, 0, 11, 0.6, 11, '#c0392b'); PC(F, 0, 6.2, 0, 2.6, 0.5, '#3a3d42', { seg: 14 });
    PB(F, 3.5, 0, -3, 3, 2.6, 3, '#f2efe6'); void y; }
  Signs.quad(F0, 0, 8.7, 5.55, 8, 1.2, 0, Signs.cell('MT. LEONA SEILBAHN', '#c0392b', '#ffffff'));
  const A = LP(F0, 0, 6.4, 0), B = LP(F1, 0, 6.4, 0), L = Math.hypot(B.x - A.x, B.z - A.z), N = Math.max(2, Math.round(L / 160)), pts = [A];
  for (let i = 1; i < N; i++) { const t = i / N, x = lerp(A.x, B.x, t), z = lerp(A.z, B.z, t), h = Math.max(terrainHeight(x, z), 0) + 22, lin = lerp(A.y, B.y, t); const y = Math.max(h, lin); pts.push(V3(x, y, z));
    lattice(x, terrainHeight(x, z) - 1, z, y - terrainHeight(x, z) + 1, 1.6, '#c8ccd0'); PB(FR(x, y, z, yawL), 0, 0, 0, 6, 0.5, 0.8, '#c8ccd0', { mat: 'metal' }); World.addOBB(x, z, 1.8, 1.8, 0, y); }
  pts.push(B);
  for (const off of [-2.2, 2.2]) for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], ox = Math.cos(yawL) * off, oz = -Math.sin(yawL) * off; seg(a.x + ox, a.y + 0.3, a.z + oz, b.x + ox, b.y + 0.3, b.z + oz, 0.07, 0.07, '#2a2c30'); }
  Cable.line = pts; Cable.len = pts.slice(1).reduce((s, q, i) => s + q.distanceTo(pts[i]), 0); Cable.yaw = yawL; Cable.base = LP(F0, 0, 0, -7.5); Cable.top = LP(F1, 0, 0, 7.5); Cable.t = 0;
  const cabG = new THREE.Group(); { const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 3.2), lam({ color: 0xc0392b, flatShading: true })); m.position.y = -3.4; cabG.add(m); const w = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.9, 3.26), MAT.glassDark); w.position.y = -3.0; cabG.add(w);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), MAT.trim); h.position.y = -1.1; cabG.add(h); const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 1.4), MAT.trim); cabG.add(r); }
  for (const off of [-2.2, 2.2]) { const c = cabG.clone(); scene.add(c); Cable.cabins.push({ g: c, off }); }
  blip('🚡', '#c0392b', p.x, p.z, 'Seilbahn'); LOC.cableBase = Cable.base; LOC.cableTop = Cable.top;
  MAP_PAINT.push((g, T, s) => { g.strokeStyle = '#c0392b'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(T(A.x), T(A.z)); g.lineTo(T(B.x), T(B.z)); g.stroke(); g.setLineDash([]); });
  World.anim.push((dt) => Cable.update(dt));
}
// Position auf dem Seil (0 = Talstation, 1 = Bergstation)
Cable.at = function (u, off, out) { let d = clamp(u, 0, 1) * this.len; const P = this.line; for (let i = 0; i < P.length - 1; i++) { const l = P[i].distanceTo(P[i + 1]); if (d <= l || i === P.length - 2) { out.lerpVectors(P[i], P[i + 1], Math.min(1, d / l)); break; } d -= l; }
  out.x += Math.cos(this.yaw) * off; out.z -= Math.sin(this.yaw) * off; return out; };
Cable.update = function (dt) { if (!this.line) return; this.t += dt / 45; const ph = (this.t % 2), u = ph < 1 ? smooth(ph) : smooth(2 - ph);
  this.cabins.forEach((c, i) => { const uu = i ? 1 - u : u; this.at(uu, c.off, c.g.position); c.g.rotation.y = this.yaw; c.g.rotation.z = Math.sin(GameTime * 0.8 + i) * 0.03; c.u = uu; });
  const R = this.ride; if (R) { const c = this.cabins[R.cab], ch = Player.active; ch.pos.set(c.g.position.x, c.g.position.y - 4.6, c.g.position.z); ch.vel.set(0, 0, 0); ch.onGround = true;
    if (Math.abs(c.u - R.to) < 0.002) { this.ride = null; const e = R.to > 0.5 ? this.top : this.base; ch.pos.set(e.x, terrainHeight(e.x, e.z) + 0.1, e.z); UI.notify(R.to > 0.5 ? '🏔 Gipfelstation Mt. Leona' : '🚡 Talstation'); } } };
// Einsteigen: an einer Station mit E – fährt mit der Kabine, die gerade dort steht (oder als Nächstes kommt)
Cable.interact = function () { if (!this.line || this.ride || Player.vehicle) return false; const p = Player.active.pos;
  for (const [st, u0] of [[this.base, 0], [this.top, 1]]) { if (Math.hypot(p.x - st.x, p.z - st.z) > 9) continue;
    let cab = this.cabins.findIndex(c => Math.abs(c.u - u0) < 0.03); if (cab < 0) { UI.notify('🚡 Die Kabine kommt gleich – bitte warten'); return true; }
    if (GS.money < 20) { UI.notify('Fahrt kostet $20'); return true; } GS.addMoney(-20); this.ride = { cab, to: 1 - u0 }; UI.notify('🚡 Gute Fahrt! ($20)'); return true; }
  return false; };
Cable.near = function () { if (!this.line || this.ride || Player.vehicle) return false; const p = Player.active.pos; return [this.base, this.top].some(st => Math.hypot(p.x - st.x, p.z - st.z) < 9); };

// ---------- AUSSICHTSPUNKTE, FUNKMASTEN, WALD ----------
function buildViewpoints() {
  const ed = Roads.edges.filter(e => { const m = e.pts[e.pts.length >> 1]; return Math.hypot(m.x - MOUNT.x, m.z - MOUNT.z) < 520 && m.y > 35; }); let made = 0;
  for (let i = 0; i < ed.length && made < 5; i += 3) { const e = ed[i], P = e.pts[e.pts.length >> 1]; for (const side of [1, -1]) { const off = e.hw + 6, x = P.x - P.tz * off * side, z = P.z + P.tx * off * side, y = terrainHeight(x, z);
      if (Math.abs(y - P.y) > 2.5 || World.query(x - 4, z - 4, x + 4, z + 4, _qb).length) continue; const yaw = Math.atan2(-P.tz * side, P.tx * side), F = FR(x, y, z, yaw);
      PB(F, 0, -0.6, 0, 6, 0.75, 4, '#8a7a64'); railing(F, -3, 2, 3, 2, 0.15, 1.05, '#5a4030'); PC(F, 0, 0.15, 1.2, 0.07, 1.1, '#3a3d42'); PB(F, 0, 1.2, 1.2, 0.3, 0.25, 0.45, '#2a6f97'); PB(F, -1.8, 0.15, -1, 1.6, 0.45, 0.45, '#6a4a2a');
      World.addOBB(x, z, 3, 0.2, yaw, y + 1.2); made++; break; } }
  for (const [x, z] of [[-1330, -1250], [-1050, -760], [-1520, -880]]) { const y = terrainHeight(x, z); if (y < 30 || Roads.nearest(x, z, 15)) continue; lattice(x, y - 1, z, 38, 2.2, '#d0d4d8'); PG(FR(0, 0, 0, 0), x, y + 37, z, 0.5, 0.5, 0.5, '#ff2020'); World.addOBB(x, z, 2.2, 2.2, 0, y + 38); }
}
function buildForest() { // dichter Bergwald, damit der Nordwesten nicht kahl wirkt
  const dens = Q().trees; let n = 0;
  for (let k = 0; k < 20000 * dens && n < 4200 * dens; k++) { const x = sr(-1900, -350), z = sr(-1900, -350), h = terrainHeight(x, z); if (h < 6 || h > 165) continue;
    if (Math.hypot(x - MOUNT.x, z - MOUNT.z) > 900 && fbm(x / 120, z / 120, 2) < 0.05) continue; const zone = zoneAt(x, z); if (zone !== 'rural' && zone !== 'mountain') continue;
    if (fieldAt(x, z) || inLake(x, z, 8)) continue; const r = Roads.nearest(x, z, 20); if (r && r.d < r.e.hw + 6) continue; if (World.query(x - 3, z - 3, x + 3, z + 3, _qb).length) continue;
    const q = srand(); TREES.push({ t: h > 60 ? (q < 0.8 ? 'pine' : q < 0.9 ? 'birch' : 'rock') : q < 0.45 ? 'pine' : q < 0.7 ? 'tree' : q < 0.85 ? 'birch' : 'bush', x, z, s: sr(0.85, 1.35) }); n++; }
}

// ---------- HELIPORT (Rundflüge) an der Marina ----------
function buildHeliport() {
  const m = LOC.marina; const L = specialLot(m.x - 90, m.z + 160, 30, 30); if (!L) return; reserve(L); const F = FR(L.x, L.y, L.z, L.yaw);
  paved(F, L.w, L.d, '#5a5e64'); PC(F, 0, 0.08, -2, 9, 0.06, '#ffd23a', { seg: 20 }); PC(F, 0, 0.1, -2, 8.3, 0.06, '#5a5e64', { seg: 20 }); PB(F, -2, 0.15, -2, 1, 0.02, 6, '#fff'); PB(F, 2, 0.15, -2, 1, 0.02, 6, '#fff'); PB(F, 0, 0.15, -2, 3, 0.02, 1, '#fff');
  PB(F, 10, 0, 11, 6, 3, 4, '#f2efe6'); PW(F, 10, 1.5, 13.03, 4, 1.4, 0, 0xfff0c8); Signs.quad(F, 10, 3.3, 13.1, 6, 0.9, 0, Signs.cell('HELI TOURS', '#1e6fd0', '#fff')); { const q = LP(F, 10, 0, 11); World.addOBB(q.x, q.z, 3, 2, L.yaw, L.y + 3.2); }
  const q = LP(F, 0, 0, -2); PARKED.push(['newsheli', q.x, q.z, L.yaw, '#1e6fd0']); LOC.heliport = q; blip('🚁', '#1e6fd0', q.x, q.z, 'Heliport');
}

function buildNature() {
  for (const fn of [buildAirfield, buildCableCar, buildCampground, buildQuarry, buildLumber, buildMine, buildLookout, buildMotocross, buildHeliport]) { try { fn(); } catch (e) { console.warn('Natur:', fn.name, e); } }
}
function buildNatureLate() { try { buildViewpoints(); buildForest(); } catch (e) { console.warn('Natur spät:', e); } }
