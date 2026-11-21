// =====================================================================
//  AKTIVITÄTEN: Speichern, Handy, Shops (Autohaus, Tuning, Waffen, Kleidung, Immobilien),
//  Jobs (Taxi, Pizza), Zeitrennen, Stuntsprünge, Sammelobjekte, Umgebungsleben
// =====================================================================

// ---------- MENÜ-OVERLAY (Shops & Handy, touch-tauglich) ----------
const Menu = {
  el: null, open: false, items: [], onClose: null, place: null,
  init() { this.el = document.createElement('div'); this.el.id = 'actMenu'; this.el.className = 'hidden'; document.body.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation()); this.el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true }); },
  show(title, sub, items, onClose, place = null) {
    this.items = items; this.onClose = onClose; this.place = place; this.open = true; In.unlock();
    const money = `<div class="am-money">$${GS.money.toLocaleString('de-DE')}</div>`;
    this.el.innerHTML = `<div class="am-box"><div class="am-head"><div><h2>${title}</h2><small>${sub || ''}</small></div>${money}</div><div class="am-list">` +
      items.map((it, i) => it.sep ? `<div class="am-sep">${it.sep}</div>` : `<button class="am-item${it.disabled ? ' off' : ''}${it.on ? ' on' : ''}" data-i="${i}"><span>${it.label}${it.desc ? `<small>${it.desc}</small>` : ''}</span><b>${it.price != null ? (it.price ? '$' + it.price.toLocaleString('de-DE') : 'gratis') : (it.right || '')}</b></button>`).join('') +
      `</div><button class="am-close">Schließen (Esc)</button></div>`;
    this.el.classList.remove('hidden');
    this.el.querySelectorAll('.am-item').forEach(b => b.onclick = () => { const it = this.items[+b.dataset.i]; if (!it || it.disabled) { Audio.empty && Audio.empty(); return; }
      if (it.price && GS.money < it.price) { UI.notify('✖ Nicht genug Geld'); Audio.empty && Audio.empty(); return; } if (it.price) GS.addMoney(-it.price); Audio.click(880); const keep = it.action && it.action(); Save.dirty = true; if (keep !== 'keep') this.refresh && this.refresh(); });
    this.el.querySelector('.am-close').onclick = () => this.close();
  },
  close() { if (!this.open) return; this.open = false; this.el.classList.add('hidden'); const f = this.onClose; this.onClose = null; this.refresh = null; f && f(); if (GS.playing) In.lock(); },
};

// ---------- SPEICHERSTAND ----------
const Save = {
  KEY: 'vl4_save', dirty: false, t: 60,
  collect() { return { v: 1, money: GS.money, done: [...Missions.done], time: Env.time, idx: Player.idx, garage: Act.garage.map(g => ({ type: g.type, color: g.color, upg: g.upg || {} })), props: Act.props, collected: [...Act.collected], stunts: [...Act.stunts], best: Act.best, stats: Act.stats,
    chars: Player.chars.map(c => ({ health: c.health, armor: c.armor, weapons: c.weapons.map(w => ({ clip: w.clip, reserve: w.reserve })), look: c.lookOverride || null })) }; },
  save(silent = false) { try { localStorage.setItem(this.KEY, JSON.stringify(this.collect())); this.dirty = false; if (!silent) UI.notify('💾 Spiel gespeichert'); } catch (e) { if (!silent) UI.notify('✖ Speichern nicht möglich'); } },
  has() { try { return !!localStorage.getItem(this.KEY); } catch (e) { return false; } },
  load() { let d; try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { d = null; } if (!d) return false;
    GS.money = d.money ?? GS.money; (d.done || []).forEach(id => Missions.done.add(id)); if (d.time != null) Env.time = d.time;
    Act.garage = d.garage || []; Act.props = d.props || []; Act.collected = new Set(d.collected || []); Act.stunts = new Set(d.stunts || []); Act.best = d.best || {}; Act.stats = Object.assign(Act.stats, d.stats || {});
    (d.chars || []).forEach((cd, i) => { const c = Player.chars[i]; if (!c) return; c.health = cd.health ?? 100; c.armor = cd.armor ?? 0; (cd.weapons || []).forEach((w, k) => { if (c.weapons[k]) Object.assign(c.weapons[k], w); });
      if (cd.look) { c.lookOverride = cd.look; c.h.setLook(Object.assign({}, c.def, cd.look)); } });
    Act.refreshCollectibles(); UI.buildMissionList && UI.buildMissionList(); return true; },
  reset() { try { localStorage.removeItem(this.KEY); } catch (e) { /* privat */ } },
  update(dt) { this.t -= dt; if (this.t <= 0) { this.t = 60; if (GS.playing && !Missions.active) this.save(true); } },
};

// ---------- STUNT-RAMPEN (Weltbau ruft das auf) ----------
const Ramps = { list: [] };
// Anlauf- und Landezone einer Rampe frei halten (keine Bäume)
function nearRamp(x, z) { for (const r of Ramps.list) { const dx = x - r.x, dz = z - r.z, lz = dx * r.s + dz * r.c, lx = dx * r.c - dz * r.s; if (lz > -50 && lz < 100 && Math.abs(lx) < 8) return true; } return false; }
function buildStunts() {
  const edges = Roads.edges.filter(e => e.type === 'highway' && e.len > 140); let made = 0;
  for (let i = 0; i < edges.length && made < 7; i++) {
    const e = edges[(i * 5) % edges.length], P = e.pts, k = P.length >> 1, p = P[k], q = P[Math.min(P.length - 1, k + 8)]; if (!q || Math.abs(p.tx * q.tx + p.tz * q.tz) < 0.97) continue;
    for (const side of [1, -1]) { const off = (e.hw + 7) * side, x = p.x - p.tz * off, z = p.z + p.tx * off, y = terrainHeight(x, z);
      if (y < 1.5 || Math.abs(y - p.y) > 1.6 || Ramps.list.some(r => Math.hypot(r.x - x, r.z - z) < 350)) continue; let ok = true;
      for (let d = -45; d < 95 && ok; d += 5) { const xx = x + p.tx * d, zz = z + p.tz * d, hh = terrainHeight(xx, zz); if (hh < 0.5 || Math.abs(hh - y) > 4 || World.query(xx - 4, zz - 4, xx + 4, zz + 4, _qb).some(b => obbHit(xx, zz, 3.5, 3.5, 0, b, 0))) ok = false; }
      if (!ok) continue; const yaw = Math.atan2(p.tx, p.tz), F = FR(x, y, z, yaw), L = 11, H = 2.8, W = 4.6, ang = Math.atan2(H, L);
      part(F, G.box(), 0, -0.25, -L / 2, W, 0.3, Math.hypot(L, H), '#ffffff', { rx: -ang, mat: 'planks', keep: true });
      for (const sx of [-1, 1]) { PB(F, sx * (W / 2 - 0.1), -0.5, -L * 0.55, 0.2, H * 0.55 + 0.5, 0.2, '#6a6e74', { mat: 'metal', keep: true }); PB(F, sx * (W / 2 - 0.1), -0.5, -0.4, 0.2, H + 0.4, 0.2, '#6a6e74', { mat: 'metal', keep: true }); }
      for (let s = 0; s < 6; s++) PB(F, -W / 2 + 0.4 + s * 0.76, H - 0.02, -0.2, 0.38, 0.05, 0.25, s % 2 ? '#111' : '#ffcc00', { keep: true });
      const c = Math.cos(yaw), s2 = Math.sin(yaw); Ramps.list.push({ x, z, yaw, c, s: s2, y0: y, L, H, W, endX: x, endZ: z, id: made }); made++; break; }
  }
}

// ---------- AKTIVITÄTEN-ZENTRALE ----------
const SHOP_DEF = {
  dealer: { name: 'Solara Motors', icon: '🚗', color: '#4aa3ff' }, customs: { name: 'Solara Customs', icon: '🔧', color: '#ffb03a' },
  guns: { name: 'Solara Arms', icon: '🔫', color: '#ff4a4a' }, clothes: { name: 'Ocean Threads', icon: '👕', color: '#ff2d95' },
  realty: { name: 'Palm Realty', icon: '🏠', color: '#5fd35f' }, pizza: { name: 'Pizza Piazza', icon: '🍕', color: '#ff7a1a' },
};
const DEALER = [['compact', 'Pico Hatch', 6500], ['sedan', 'Aurora Sedan', 9500], ['taxi', 'Solara Cab', 11000], ['suv', 'Ranger XL', 18000], ['muscle', 'Stallion V8', 26000], ['sport', 'Cometa GT', 48000], ['bike', 'Viper 600', 7500], ['speedboat', 'Riva Sprint', 32000], ['plane', 'Skylark 200', 85000], ['heli', 'Mako MH-6', 140000]];
const PAINTS = [['Kirschrot', '#b8141e'], ['Mitternacht', '#141a2e'], ['Perlweiß', '#f2f2ee'], ['Vice Pink', '#ff3d9a'], ['Ozeanblau', '#1e6fd0'], ['Limette', '#7ad12a'], ['Gold', '#c9a43a'], ['Graphit', '#3a3d42'], ['Orange', '#ff7a1a'], ['Türkis', '#1fb5a8']];
const PROPS = [{ id: 'marina', name: 'Marina Loft', price: 45000, income: 600, at: () => LOC.marina }, { id: 'penthouse', name: 'Downtown Penthouse', price: 120000, income: 1500, at: () => LOC.plaza }, { id: 'villa', name: 'Coral Heights Villa', price: 220000, income: 2600, at: () => V3(HEIGHTS.x, 0, HEIGHTS.z) }];
const Act = {
  garage: [], props: [], collected: new Set(), stunts: new Set(), best: {}, stats: { taxi: 0, pizza: 0, earned: 0 }, places: [], job: null, trial: null, objective: '', lastDay: -1,
  init() {
    Menu.init();
    // Orte: Shops an Straßenrändern (LOC vom Weltbau), Marker mit Symbol
    for (const [k, def] of Object.entries(SHOP_DEF)) { const p = LOC[k]; if (!p) continue; const m = new Marker(def.color, def.icon, 1.6).set(p.x, p.z); this.places.push({ k, def, p, m }); }
    for (const pr of PROPS) { const p = pr.at(); if (!p) continue; const q = this.nearRoadEdge(p); const m = new Marker('#5fd35f', '🏠', 1.4).set(q.x, q.z); this.places.push({ k: 'prop', prop: pr, def: { name: pr.name, color: '#5fd35f' }, p: q, m }); }
    this.buildTrials(); this.buildCollectibles(); this.initAmbient();
    this.trialMarkers = this.trials.map((t, i) => new Marker('#b45cff', '⏱', 1.8).set(t.start.x, t.start.z));
    this.ring = new Marker('#ffd23a', null, 9, true).show(false); this.cpMarker = new Marker('#ffd23a', null, 3.2).show(false);
  },
  nearRoadEdge(p) { const r = Roads.nearest(p.x, p.z, 200, e => e.type !== 'highway'); if (!r) return V3(p.x, 0, p.z); const side = r.lat >= 0 ? 1 : -1; return V3(r.p.x - r.p.tz * (r.e.hw + 2) * side, r.p.y, r.p.z + r.p.tx * (r.e.hw + 2) * side); },
  nearPlace(r = 2.6) { const p = Player.targetPos(); for (const pl of this.places) if (Math.hypot(p.x - pl.p.x, p.z - pl.p.z) < r + (Player.vehicle ? 3 : 0)) return pl; return null; },
  // E / F an einem Ort
  interact() { if (Menu.open) { Menu.close(); return true; } const pl = this.nearPlace(); if (pl && !Player.vehicle) { this.openPlace(pl); return true; }
    const t = this.nearTrial(); if (t && Player.vehicle) { this.startTrial(t); return true; } return false; },
  openPlace(pl) { const fn = { dealer: 'menuDealer', customs: 'menuCustoms', guns: 'menuGuns', clothes: 'menuClothes', realty: 'menuRealty', pizza: 'menuPizza', prop: 'menuProp' }[pl.k]; if (fn) this[fn](pl); },
  // ---------- SHOPS ----------
  menuDealer(pl) { const r = () => Menu.show('🚗 Solara Motors', 'Gekaufte Fahrzeuge landen in deiner Garage und können per Handy geliefert werden.', DEALER.map(([t, n, price]) => ({ label: n, desc: CFG.VEHICLES[t].cls === 'car' ? 'Auto' : CFG.VEHICLES[t].cls === 'boat' ? 'Boot (Lieferung an die Marina)' : 'Luftfahrzeug (Lieferung zur Air Base)', price, disabled: this.garage.some(g => g.type === t), right: this.garage.some(g => g.type === t) ? 'im Besitz' : '',
    action: () => { this.garage.push({ type: t, color: CFG.VEHICLES[t].colors[0], upg: {} }); UI.notify(`🔑 ${n} gekauft – per Handy (<kbd>U</kbd>) lieferbar`); this.deliver(this.garage.length - 1); Save.save(true); } })), null, pl); Menu.refresh = r; r(); },
  menuCustoms(pl) { const v = Player.vehicle;
    const r = () => { const v = Player.vehicle; if (!v || v.cls !== 'car' || v.dead) { Menu.show('🔧 Solara Customs', 'Fahr mit einem Auto oder Motorrad in die Werkstatt.', [], null, pl); return; }
      const u = v.upg || (v.upg = {}), own = this.garage.find(g => g === v.owned), stage = (k, max, prices, label) => ({ label: `${label} ${u[k] ? 'Stufe ' + u[k] : 'Serie'}`, desc: u[k] >= max ? 'Maximal' : `→ Stufe ${(u[k] || 0) + 1}`, price: u[k] >= max ? null : prices[u[k] || 0], disabled: u[k] >= max, action: () => { u[k] = (u[k] || 0) + 1; if (own) own.upg = u; UI.notify(`🔧 ${label} verbessert`); } });
      const items = [{ sep: 'Service' }, { label: 'Reparieren', desc: `Zustand ${Math.round(v.health / v.spec.hp * 100)} %`, price: v.health >= v.spec.hp ? null : 300, disabled: v.health >= v.spec.hp, action: () => { v.repair(); } }];
      if (Wanted.level > 0) items.push({ label: 'Neu lackieren & Fahndung löschen', desc: 'Wie neu – die Polizei verliert deine Spur', price: 1000, action: () => { Wanted.clear(true); this.paint(v, pick(PAINTS)[1]); UI.notify('🚓 Fahndung gelöscht'); } });
      items.push({ sep: 'Lackierung' }, ...PAINTS.map(([n, c]) => ({ label: n, price: 400, on: v.color === c, action: () => this.paint(v, c, own) })));
      items.push({ sep: 'Leistung' }, stage('engine', 3, [3500, 8000, 15000], 'Motor'), stage('brakes', 2, [2500, 6000], 'Bremsen'), stage('susp', 2, [3000, 7000], 'Sportfahrwerk'), stage('armor', 3, [4000, 9000, 16000], 'Panzerung'),
        { label: 'Nitro auffüllen', price: v.nitro >= 0.99 ? null : 800, disabled: v.nitro >= 0.99, action: () => { v.nitro = 1; } });
      Menu.show('🔧 Solara Customs', `${v.spec.name} · Tuning`, items, null, pl); };
    Menu.refresh = r; r(); },
  paint(v, c, own) { v.color = c; if (v.m && v.m.paint && v.m.paint.material) v.m.paint.material = carMat.paint(c); if (own) own.color = c; },
  menuGuns(pl) { const c = Player.active; const r = () => { const c = Player.active; const items = [{ sep: 'Munition' }];
      CFG.WEAPONS.forEach((w, i) => { if (!w.reserve) return; const s = c.weapons[i], full = s.reserve >= w.reserve * 2; items.push({ label: `${w.name}-Munition`, desc: `${s.reserve} / ${w.reserve * 2}`, price: full ? null : Math.round(w.clip * 9 + 40), disabled: full, action: () => { s.reserve = Math.min(w.reserve * 2, s.reserve + w.clip * 3); } }); });
      items.push({ sep: 'Ausrüstung' }, { label: 'Schutzweste', desc: `Panzerung ${Math.round(c.armor)} %`, price: c.armor >= 100 ? null : 650, disabled: c.armor >= 100, action: () => { c.armor = 100; } }, { label: 'Erste-Hilfe-Set', desc: `Gesundheit ${Math.round(c.health)} %`, price: c.health >= 100 ? null : 250, disabled: c.health >= 100, action: () => { c.health = 100; } });
      Menu.show('🔫 Solara Arms', 'Waffen, Munition & Schutzwesten', items, null, pl); }; Menu.refresh = r; r(); },
  menuClothes(pl) { const r = () => { const c = Player.active, base = Object.assign({}, c.def, c.lookOverride || {}), set = (k, v) => { c.lookOverride = Object.assign({}, c.lookOverride || {}, { [k]: v }); c.h.setLook(Object.assign({}, c.def, c.lookOverride)); };
      const shirts = [['Weiß', '#f2f2ee'], ['Schwarz', '#1a1a1c'], ['Türkis', '#1fb5a8'], ['Pink', '#e0337a'], ['Hawaii-Rot', '#c0392b'], ['Himmelblau', '#5aa0e0'], ['Olive', '#6a7a3a'], ['Gelb', '#f0c030']];
      const pants = [['Jeans', '#2b3a55'], ['Schwarz', '#1a1a1c'], ['Beige', '#c8b48a'], ['Weiß', '#f0eee6'], ['Grau', '#6a6a6a']];
      const items = [{ sep: 'Oberteil' }, ...shirts.map(([n, col]) => ({ label: n, price: 120, on: base.shirt === col, action: () => set('shirt', col) })),
        { label: base.longSleeve ? 'Kurze Ärmel' : 'Lange Ärmel', price: 60, action: () => set('longSleeve', !base.longSleeve) },
        { sep: 'Hose' }, ...pants.map(([n, col]) => ({ label: n, price: 140, on: base.pants === col, action: () => set('pants', col) })), { label: base.shorts ? 'Lange Hose' : 'Shorts', price: 80, action: () => set('shorts', !base.shorts) },
        { sep: 'Accessoires' }, { label: base.glasses ? 'Sonnenbrille abnehmen' : 'Sonnenbrille', price: 90, action: () => set('glasses', !base.glasses) }, { label: base.hairStyle === 'cap' ? 'Kappe abnehmen' : 'Basecap', price: 70, action: () => set('hairStyle', base.hairStyle === 'cap' ? (c.def.hairStyle || 'short') : 'cap') },
        { label: 'Schuhe: Weiß', price: 110, action: () => set('shoes', '#f0f0f0') }, { label: 'Schuhe: Schwarz', price: 110, action: () => set('shoes', '#141414') }];
      Menu.show('👕 Ocean Threads', `Outfit für ${c.def.name}`, items, null, pl); }; Menu.refresh = r; r(); },
  menuRealty(pl) { const r = () => Menu.show('🏠 Palm Realty', 'Immobilien bringen jeden Spieltag Einnahmen und dienen als Speicherort.', PROPS.map(p => ({ label: p.name, desc: `+$${p.income.toLocaleString('de-DE')} pro Tag`, price: this.props.includes(p.id) ? null : p.price, disabled: this.props.includes(p.id), right: this.props.includes(p.id) ? 'gekauft' : '',
    action: () => { this.props.push(p.id); UI.bigText('IMMOBILIE GEKAUFT', p.name, 'passed', 3); Save.save(true); } })), null, pl); Menu.refresh = r; r(); },
  menuProp(pl) { const own = this.props.includes(pl.prop.id); Menu.show('🏠 ' + pl.prop.name, own ? 'Dein Zuhause' : 'Zu kaufen bei Palm Realty', own ? [{ label: 'Spiel speichern', price: null, right: '💾', action: () => { Save.save(); } }, { label: 'Ausruhen (6 Stunden)', price: null, right: '🛏', action: () => { Env.time = (Env.time + 6) % 24; Player.active.health = 100; UI.notify('😴 Ausgeruht'); } }] : [], null, pl); },
  menuPizza(pl) { Menu.show('🍕 Pizza Piazza', 'Liefere heiße Pizzen an hungrige Kunden – je schneller, desto mehr Trinkgeld.', [{ label: this.job ? 'Job beenden' : 'Lieferjob starten', price: null, right: '▶', action: () => { Menu.close(); this.job ? this.endJob() : this.startPizza(); return 'keep'; } }], null, pl); },
  // ---------- GARAGE & LIEFERUNG ----------
  deliver(i) { const g = this.garage[i]; if (!g) return; const S = CFG.VEHICLES[g.type], P = Player.targetPos(); let x, z, yaw = 0;
    if (S.cls === 'boat') { const b = LOC.boats[0]; x = b.x; z = b.z; } else if (S.cls === 'plane' || S.cls === 'heli') { const h = S.cls === 'heli' ? LOC.helipads[0] : LOC.runway; x = h.x; z = h.z; yaw = LOC.runway.yaw || 0; }
    else { const r = Roads.nearest(P.x, P.z, 120, e => e.type !== 'service'); if (r) { x = r.p.x + r.p.tx * 6 - r.p.tz * (r.e.hw * 0.5); z = r.p.z + r.p.tz * 6 + r.p.tx * (r.e.hw * 0.5); yaw = Math.atan2(r.p.tx, r.p.tz); } else { x = P.x + 5; z = P.z; } }
    if (g.inst && !g.inst.removed && !g.inst.dead) { VS.remove(g.inst); }
    const v = VS.spawn(g.type, x, z, yaw, { color: g.color, persistent: true }); v.upg = g.upg || (g.upg = {}); v.owned = g; g.inst = v; if (g.color !== v.color) this.paint(v, g.color);
    UI.notify(`🚚 ${S.name} wurde geliefert`); Missions.userWP = V3(x, 0, z); },
  // ---------- HANDY ----------
  phone() { if (Menu.open) { Menu.close(); return; } const items = [{ sep: 'Garage' }];
    if (!this.garage.length) items.push({ label: 'Noch keine Fahrzeuge', desc: 'Kaufe welche bei Solara Motors', disabled: true });
    this.garage.forEach((g, i) => items.push({ label: CFG.VEHICLES[g.type].name, desc: 'Liefern lassen', right: '🚚', action: () => { this.deliver(i); Menu.close(); return 'keep'; } }));
    const v = Player.vehicle; items.push({ sep: 'Jobs' }, { label: this.job ? 'Aktuellen Job beenden' : (v && v.type === 'taxi' ? 'Taxi-Schicht starten' : 'Taxi-Schicht (nur im Taxi)'), disabled: !this.job && !(v && v.type === 'taxi'), right: '🚕', action: () => { Menu.close(); this.job ? this.endJob() : this.startTaxi(); return 'keep'; } },
      { label: 'Pizza-Lieferjob', desc: 'Start bei Pizza Piazza', right: '🍕', action: () => { Missions.userWP = LOC.pizza ? LOC.pizza.clone() : null; Menu.close(); UI.notify('📍 Pizza Piazza markiert'); return 'keep'; } });
    items.push({ sep: 'Orte' }, ...this.places.filter(p => p.k !== 'prop').map(p => ({ label: `${p.def.icon} ${p.def.name}`, right: '📍', action: () => { Missions.userWP = p.p.clone(); Menu.close(); UI.notify(`📍 ${p.def.name} markiert`); return 'keep'; } })));
    items.push({ sep: 'Spiel' }, { label: 'Spiel speichern', right: '💾', action: () => { Save.save(); } }, { label: 'Statistik', desc: `Taxi-Fahrten ${this.stats.taxi} · Pizzen ${this.stats.pizza} · Muscheln ${this.collected.size}/${this.shells.length} · Stunts ${this.stunts.size}/${Ramps.list.length}`, disabled: true });
    Menu.show('📱 Handy', `${Player.active.def.name} · ${Env.clockStr()}`, items); },
  // ---------- JOBS ----------
  startTaxi() { const v = Player.vehicle; if (!v || v.type !== 'taxi') { UI.notify('Du brauchst ein Taxi'); return; } this.job = { kind: 'taxi', stage: 0, v }; this.nextFare(); UI.bigText('TAXI-SCHICHT', 'Fahrgäste abholen und sicher ans Ziel bringen', 'title', 2.5); },
  nextFare() { const j = this.job, P = Player.targetPos(); for (let t = 0; t < 40; t++) { const a = Math.random() * Math.PI * 2, d = rand(120, 320), r = Roads.nearest(P.x + Math.cos(a) * d, P.z + Math.sin(a) * d, 60, e => e.type === 'street'); if (!r) continue; const q = this.curbPoint(r);
      j.pick = q; j.stage = 0; j.npc = j.npc || new Humanoid(randomLook('civ')); j.npc.setLook(randomLook('civ')); j.npc.group.visible = true; j.npc.group.position.copy(q); this.cpMarker.show(true).set(q.x, q.z); Missions.userWP = q.clone(); return; } },
  curbPoint(r) { const side = r.lat >= 0 ? 1 : -1; return V3(r.p.x - r.p.tz * (r.e.hw + 1.6) * side, r.p.y + 0.2, r.p.z + r.p.tx * (r.e.hw + 1.6) * side); },
  startPizza() { let v = Player.vehicle; if (!v) { const p = LOC.pizza || Player.targetPos(); v = VS.spawn('bike', p.x + 3, p.z, 0, { color: '#ff7a1a' }); UI.notify('🛵 Dein Liefer-Motorrad steht bereit'); }
    const houses = BLD.filter(b => b.h && b.h < 8 && Math.hypot(b.x - Player.targetPos().x, b.z - Player.targetPos().z) < 600); const drops = [];
    for (let i = 0; i < 4 && houses.length; i++) { const b = houses.splice(Math.floor(Math.random() * houses.length), 1)[0], r = Roads.nearest(b.x, b.z, 60, e => e.type !== 'highway'); if (r) drops.push(this.curbPoint(r)); }
    if (!drops.length) { UI.notify('Keine Kunden gefunden'); return; } this.job = { kind: 'pizza', drops, i: 0, t: 75, tips: 0 }; UI.bigText('PIZZA-LIEFERUNG', `${drops.length} Bestellungen · schnell liefern!`, 'title', 2.5); },
  endJob(msg) { const j = this.job; if (!j) return; if (j.npc) j.npc.group.visible = false; this.cpMarker.show(false); Missions.userWP = null; this.job = null; this.objective = ''; UI.notify(msg || '✔ Job beendet'); },
  updateJob(dt) {
    const j = this.job, P = Player.active, pos = Player.targetPos(), v = Player.vehicle;
    if (j.kind === 'taxi') {
      if (!v || v !== j.v || v.dead) { this.endJob('✖ Taxi-Schicht beendet'); return; }
      if (j.stage === 0) { this.objective = 'Hol den <b>Fahrgast</b> ab (anhalten neben ihm).'; j.npc.animate(dt, { speed: 0 }); j.npc.group.lookAt(v.pos.x, j.npc.group.position.y, v.pos.z);
        if (Math.hypot(pos.x - j.pick.x, pos.z - j.pick.z) < 7 && v.hspeed < 1.5) { j.npc.group.visible = false; j.stage = 1; Audio.click(700);
          const r = (() => { for (let t = 0; t < 60; t++) { const a = Math.random() * Math.PI * 2, d = rand(280, 750), rr = Roads.nearest(pos.x + Math.cos(a) * d, pos.z + Math.sin(a) * d, 70, e => e.type === 'street'); if (rr && terrainHeight(rr.p.x, rr.p.z) > 1) return rr; } return null; })();
          if (!r) { this.endJob(); return; } j.drop = this.curbPoint(r); j.dist = Math.hypot(j.drop.x - pos.x, j.drop.z - pos.z); j.t = 12 + j.dist / 9; this.cpMarker.set(j.drop.x, j.drop.z); Missions.userWP = j.drop.clone();
          UI.notify(`🧍 „${pick(['Zum Hafen, bitte – und zwar zügig!', 'Bring mich hier hin, ich bin spät dran.', 'Schön ruhig fahren, okay?', 'Haben Sie Klimaanlage? Egal, fahr los!', 'Ich zahle extra, wenn Sie schnell sind.'])}“`); } }
      else { j.t -= dt; this.objective = `Bring den Fahrgast ans <b>Ziel</b> · Bonus-Zeit ${Math.max(0, Math.ceil(j.t))} s`;
        if (Math.hypot(pos.x - j.drop.x, pos.z - j.drop.z) < 8 && v.hspeed < 2) { const fare = Math.round(15 + j.dist * 0.45 + (j.t > 0 ? j.t * 4 : 0) - (v.health < v.spec.hp * 0.6 ? 20 : 0));
          GS.addMoney(fare); this.stats.taxi++; this.stats.earned += fare; Audio.pickup && Audio.pickup(); UI.notify(`🚕 Fahrpreis +$${fare}${j.t > 0 ? ' (inkl. Trinkgeld)' : ''}`); j.npc.group.visible = true; j.npc.group.position.copy(j.drop); this.nextFare(); } }
    } else if (j.kind === 'pizza') {
      j.t -= dt; const d = j.drops[j.i]; this.objective = `Liefere Pizza <b>${j.i + 1}/${j.drops.length}</b> · Trinkgeld-Zeit ${Math.max(0, Math.ceil(j.t))} s`; this.cpMarker.show(true).set(d.x, d.z); Missions.userWP = d.clone();
      if (Math.hypot(pos.x - d.x, pos.z - d.z) < 5 && (!v || v.hspeed < 3)) { const tip = Math.max(0, Math.round(j.t * 3)), pay = 40 + tip; GS.addMoney(pay); j.tips += tip; this.stats.pizza++; this.stats.earned += pay; Audio.click(990); UI.notify(`🍕 Geliefert! +$${pay}`); j.i++; j.t = 60;
        if (j.i >= j.drops.length) { GS.addMoney(150); UI.bigText('LIEFERUNG KOMPLETT', `Bonus +$150 · Trinkgeld gesamt $${j.tips}`, 'passed', 3); this.endJob(' '); } }
    }
  },
  // ---------- ZEITRENNEN ----------
  buildTrials() {
    const G = Roads.groups, routes = [['Ocean-Drive-Sprint', G.ocean[1], G.ocean[G.ocean.length - 2]], ['City-Rush', G.dt[0][0], G.pt[2][2]], ['Mount Leona Hillclimb', G.spiral[0], G.spiral[10]], ['I-95 Highway-Run', G.hw1[0], G.hw1[G.hw1.length - 1]]]; this.trials = [];
    for (const [name, a, b] of routes) { if (!a || !b) continue; const path = Roads.path(a.id, b.id); if (!path) continue; const cps = []; let last = null, len = 0;
      for (const id of path) { const n = Roads.nodes[id]; if (last) len += Math.hypot(n.x - last.x, n.z - last.z); if (!last || Math.hypot(n.x - last.x, n.z - last.z) > 70 || id === path[path.length - 1]) { cps.push(V3(n.x, n.y, n.z)); last = n; } }
      if (cps.length < 3) continue; const gold = Math.round(len / 33), start = cps.shift(); this.trials.push({ name, start, cps, gold, silver: Math.round(gold * 1.2), id: this.trials.length }); }
  },
  nearTrial() { const p = Player.targetPos(); if (this.trial || Missions.active) return null; return this.trials.find(t => Math.hypot(p.x - t.start.x, p.z - t.start.z) < 8) || null; },
  startTrial(t) { this.trial = { t, i: 0, time: 0 }; this.trialMarkers.forEach(m => m.show(false)); UI.bigText(t.name, `Gold: ${t.gold} s · Silber: ${t.silver} s`, 'title', 2.5); Audio.jingle(true); },
  updateTrial(dt) { const T = this.trial, t = T.t, pos = Player.targetPos(), v = Player.vehicle; if (!v || v.dead) { this.endTrial(false); return; }
    T.time += dt; const cp = t.cps[T.i], last = T.i === t.cps.length - 1; this.ring.show(true); this.ring.set(cp.x, cp.z, cp.y + 4); Missions.userWP = cp.clone();
    this.objective = `${t.name}: Checkpoint <b>${T.i + 1}/${t.cps.length}</b> · ⏱ ${T.time.toFixed(1)} s (Gold ${t.gold} s)`;
    if (Math.hypot(pos.x - cp.x, pos.z - cp.z) < 11) { Audio.click(990); T.i++; if (last) this.endTrial(true); } },
  endTrial(ok) { const T = this.trial; if (!T) return; this.trial = null; this.ring.show(false); this.trialMarkers.forEach(m => m.show(true)); Missions.userWP = null; this.objective = '';
    if (!ok) { UI.notify('✖ Zeitrennen abgebrochen'); return; } const t = T.t, time = +T.time.toFixed(1), prev = this.best[t.id], medal = time <= t.gold ? 'GOLD' : time <= t.silver ? 'SILBER' : 'BRONZE', pay = { GOLD: 2500, SILBER: 1200, BRONZE: 500 }[medal];
    if (!prev || time < prev) this.best[t.id] = time; GS.addMoney(pay); UI.bigText(`${medal} · ${time} s`, `${t.name} · +$${pay}${prev ? ` · Bestzeit ${Math.min(prev, time)} s` : ''}`, 'passed', 3.5); Save.save(true); },
  // ---------- STUNTSPRÜNGE ----------
  updateStunt(dt) { const v = Player.vehicle; if (!v || v.cls !== 'car') { this.jump = null; return; }
    if (!this.jump && v.airborne) { const r = Ramps.list.find(r => Math.hypot(v.pos.x - r.x, v.pos.z - r.z) < 9); if (r) { this.jump = { r, x: v.pos.x, z: v.pos.z, t: 0 }; GS.timeScale = 0.55; } }
    if (this.jump) { this.jump.t += dt; if (!v.airborne || this.jump.t > 8) { const J = this.jump, d = Math.hypot(v.pos.x - J.x, v.pos.z - J.z); GS.timeScale = 1; this.jump = null;
        if (v.dead || v.flipped) { UI.notify('✖ Stuntsprung missglückt'); return; } if (d < 22) { UI.notify(`Sprung zu kurz (${Math.round(d)} m)`); return; }
        const first = !this.stunts.has(J.r.id); this.stunts.add(J.r.id); const pay = first ? 1000 : 150; GS.addMoney(pay); UI.bigText('STUNTSPRUNG!', `${Math.round(d)} m · +$${pay} · ${this.stunts.size}/${Ramps.list.length} geschafft`, 'passed', 3); Save.save(true); } } },
  // ---------- SAMMELOBJEKTE: 30 goldene Muscheln ----------
  buildCollectibles() {
    const pts = [], add = (x, z, y = null) => pts.push(V3(x, y ?? groundHeight(x, z, 500) + 0.8, z));
    for (let th = -0.6; th < 0.9; th += 0.17) { const p = coastAt(th, 0.03); add(p.x, p.z); }
    add(LOC.summit.x + 3, LOC.summit.z + 3); add(LOC.lighthouse.x + 4, LOC.lighthouse.z); if (LOC.pier) add(LOC.pier.x + 140, LOC.pier.z, 3.3); if (LOC.golf) add(LOC.golf.x, LOC.golf.z); if (LOC.swamp) add(LOC.swamp.x + 20, LOC.swamp.z); add(STAR.x, STAR.z); add(KEYS[1].x, KEYS[1].z);
    add(LOC.portYard.x + 12, LOC.portYard.z + 8); add(LOC.base.x + 60, LOC.base.z - 180); add(VILLAGE.x + 10, VILLAGE.z - 5); add(HEIGHTS.x - 20, HEIGHTS.z + 15); add(SUBURB.x - 60, SUBURB.z - 40);
    const roofs = BLD.filter(b => b.h && b.h > 10 && b.h < 45).sort((a, b) => (a.x * 13 + a.z * 7) % 97 - (b.x * 13 + b.z * 7) % 97).slice(0, 6); for (const b of roofs) add(b.x, b.z, groundHeight(b.x, b.z, 500) + 1);
    for (let k = 0; pts.length < 30 && k < 200; k++) { const x = sr(-1850, 1500), z = sr(-1700, 1700), h = terrainHeight(x, z); if (h > 3 && h < 140) add(x, z); }
    this.shells = pts.slice(0, 30);
    const g = new THREE.IcosahedronGeometry(0.42, 1), m = new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffa000, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.25 });
    this.shellMesh = new THREE.InstancedMesh(g, m, this.shells.length); this.shellMesh.frustumCulled = false; scene.add(this.shellMesh); this.refreshCollectibles();
  },
  refreshCollectibles() { if (!this.shellMesh) return; const z = new THREE.Matrix4().makeScale(0, 0, 0); this.shells.forEach((p, i) => { if (this.collected.has(i)) this.shellMesh.setMatrixAt(i, z); else { tmpM.makeTranslation(p.x, p.y, p.z); this.shellMesh.setMatrixAt(i, tmpM); } }); this.shellMesh.instanceMatrix.needsUpdate = true; },
  updateCollect(dt) { const p = Player.targetPos(); this.shellMesh.rotation.y = 0; const s = 1 + Math.sin(GameTime * 3) * 0.12;
    this.shells.forEach((q, i) => { if (this.collected.has(i)) return; if (Math.abs(p.x - q.x) < 2.2 && Math.abs(p.z - q.z) < 2.2 && Math.abs(p.y + 0.8 - q.y) < 3) { this.collected.add(i); this.refreshCollectibles(); const n = this.collected.size;
        GS.addMoney(250); Audio.pickup && Audio.pickup(); UI.notify(`🐚 Goldene Muschel ${n}/${this.shells.length} · +$250`); if (n % 10 === 0) { GS.addMoney(5000); UI.bigText(`${n} MUSCHELN!`, 'Sammlerbonus +$5.000', 'passed', 3); } Save.save(true); } });
    if (this.shellMesh) { const m = this.shellMesh.instanceMatrix; void m; } },
  // ---------- UMGEBUNGSLEBEN: Möwen, Flugverkehr, Schiffe ----------
  initAmbient() {
    const bird = new THREE.BufferGeometry(); bird.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.9, 0.15, -0.1, 0, 0, -0.25, 0, 0, 0.25, 0, 0, -0.25, 0.9, 0.15, -0.1], 3)); bird.computeVertexNormals();
    this.birds = []; this.birdMesh = new THREE.InstancedMesh(bird, new THREE.MeshLambertMaterial({ color: 0xf4f4f0, side: THREE.DoubleSide }), 26); this.birdMesh.frustumCulled = false; scene.add(this.birdMesh);
    for (let i = 0; i < 26; i++) { const th = sr(-0.6, 0.9), c = coastAt(th, 0.0); this.birds.push({ cx: c.x, cz: c.z, r: sr(15, 45), h: sr(12, 30), sp: sr(0.25, 0.5) * (srand() < 0.5 ? 1 : -1), ph: sr(0, 6), fl: sr(5, 8) }); }
    this.airliner = null; this.airT = 20; this.ship = null; this.shipT = 5;
  },
  updateAmbient(dt) {
    const t = GameTime; this.birds.forEach((b, i) => { const a = t * b.sp + b.ph, x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r, y = b.h + Math.sin(t * 0.7 + b.ph) * 3;
      tmpQ.setFromEuler(tmpE.set(0, a + (b.sp > 0 ? Math.PI : 0), Math.sin(t * b.fl + b.ph) * 0.5)); tmpM.compose(tmpV1.set(x, y, z), tmpQ, tmpV2.set(1.2, 1.2 + Math.sin(t * b.fl + b.ph) * 0.6, 1.2)); this.birdMesh.setMatrixAt(i, tmpM); });
    this.birdMesh.instanceMatrix.needsUpdate = true;
    // Linienflugzeug zieht hoch über die Insel (mit Positionslichtern)
    this.airT -= dt; if (!this.airliner && this.airT <= 0) { const m = buildVehicleModel('jet', '#f4f4f4'); m.group.scale.setScalar(2.6); scene.add(m.group); const a = Math.random() * Math.PI * 2; this.airliner = { g: m.group, p: V3(Math.cos(a) * 3000, rand(420, 560), Math.sin(a) * 3000), d: V3(-Math.cos(a), 0, -Math.sin(a)) }; }
    if (this.airliner) { const A = this.airliner; A.p.addScaledVector(A.d, 120 * dt); A.g.position.copy(A.p); A.g.rotation.y = Math.atan2(A.d.x, A.d.z); if (A.p.length() > 3200) { scene.remove(A.g); this.airliner = null; this.airT = rand(40, 90); } }
    // Frachter / Yacht kreuzt vor der Küste
    this.shipT -= dt; if (!this.ship && this.shipT <= 0) { const big = Math.random() < 0.5, m = buildVehicleModel(big ? 'yacht' : 'fishing', big ? '#ffffff' : '#2a6f97'); if (big) m.group.scale.setScalar(2.2); scene.add(m.group); const dir = Math.random() < 0.5 ? 1 : -1; this.ship = { g: m.group, x: rand(1730, 1850), z: -1700 * dir, sp: rand(5, 9) * dir, life: 0 }; }
    if (this.ship) { const S = this.ship; S.z += S.sp * dt; S.life += dt; S.g.position.set(S.x, 0, S.z); S.g.rotation.y = S.sp > 0 ? 0 : Math.PI; if (Math.abs(S.z) > 1800 && S.life > 20) { scene.remove(S.g); this.ship = null; this.shipT = rand(30, 80); } }
  },
  // ---------- HAUPT-UPDATE ----------
  update(dt) {
    for (const pl of this.places) pl.m.update(GameTime); for (const m of this.trialMarkers) m.update(GameTime); this.ring.update(GameTime); this.cpMarker.update(GameTime);
    this.objective = '';
    if (Menu.open && Menu.place) { const p = Player.targetPos(); if (Math.hypot(p.x - Menu.place.p.x, p.z - Menu.place.p.z) > 7) Menu.close(); }
    if (this.job) this.updateJob(dt); if (this.trial) this.updateTrial(dt); this.updateStunt(dt); this.updateCollect(dt); this.updateAmbient(dt);
    if (!Menu.open && !Missions.active && !this.job && !this.trial) { const pl = this.nearPlace(); if (pl) UI.help(pl.k === 'customs' && !Player.vehicle ? `<b>${pl.def.name}</b><br>Fahr mit einem Fahrzeug hinein und drücke <kbd>E</kbd>.` : `<b>${pl.def.icon || ''} ${pl.def.name}</b><br>Drücke <kbd>E</kbd>${Settings.touch ? ' (EIN/AUS)' : ''} zum Betreten.`, 0.3);
      const t = this.nearTrial(); if (t) UI.help(`<b>⏱ ${t.name}</b><br>${Player.vehicle ? 'Drücke <kbd>E</kbd> für den Start.' : 'Du brauchst ein Fahrzeug.'} Gold: ${t.gold} s${this.best[t.id] ? ` · Bestzeit ${this.best[t.id]} s` : ''}`, 0.3); }
    // Werkstatt: mit Fahrzeug hineinfahren und anhalten öffnet das Menü
    const pv = Player.vehicle; if (pv && !Menu.open) { const pl = this.nearPlace(4); if (pl && pl.k === 'customs' && pv.hspeed < 1.5) { this.custT = (this.custT || 0) + dt; if (this.custT > 0.8) { this.custT = 0; this.openPlace(pl); } } else this.custT = 0; }
    // Immobilien-Einkommen pro Spieltag
    const day = Math.floor((GameTime + Env.time * CFG.DAY_LENGTH / 24) / CFG.DAY_LENGTH); if (this.lastDay < 0) this.lastDay = day; if (day > this.lastDay) { this.lastDay = day; const inc = PROPS.filter(p => this.props.includes(p.id)).reduce((a, p) => a + p.income, 0); if (inc) { GS.addMoney(inc); UI.notify(`🏠 Mieteinnahmen +$${inc.toLocaleString('de-DE')}`); } }
    Save.update(dt);
  },
};
