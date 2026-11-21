
// =====================================================================
//  MISSIONEN, KAMERA, UI/HUD, KARTE, ADMIN, SPIELSCHLEIFE
// =====================================================================
let GameTime = 0;
class Marker {
  constructor(color, label, radius = 2.2, ring = false) {
    this.radius = radius; this.group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    if (ring) { this.cyl = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.6, 10, 40), mat); this.cyl.material.opacity = 0.75; this.group.add(this.cyl); }
    else { this.cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 2.4, 32, 1, true), mat); this.cyl.position.y = 1.2; this.group.add(this.cyl);
      const r = new THREE.Mesh(new THREE.RingGeometry(radius * 0.82, radius, 40), mat.clone()); r.material.opacity = 0.85; r.rotation.x = -Math.PI / 2; r.position.y = 0.1; this.group.add(r); }
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 300, 10, 1, true), mat.clone()); this.beam.material.opacity = 0.12; this.beam.position.y = ring ? -150 : 150; this.group.add(this.beam);
    if (label) { const tex = canvasTex(128, 128, (g) => { g.fillStyle = color; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 54px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 64, 68); }, { repeat: false });
      this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true })); this.sprite.scale.set(1.8, 1.8, 1); this.sprite.position.y = 3.8; this.group.add(this.sprite); }
    this.ring = ring; L1(this.group); this.group.traverse(o => o.layers.set(1)); scene.add(this.group); this.pos = this.group.position;
  }
  set(x, z, y = null) { this.group.position.set(x, y ?? Math.max(walkHeight(x, z, 500), CFG.WATER_Y), z); return this; }
  show(v) { this.group.visible = v; return this; }
  update(t) { if (this.ring) { this.cyl.rotation.y += 0.01; this.group.lookAt(camera.position.x, this.group.position.y, camera.position.z); } else this.cyl.material.opacity = 0.22 + 0.12 * Math.sin(t * 4); if (this.sprite) this.sprite.position.y = 3.8 + Math.sin(t * 2) * 0.2; }
}
const Missions = {
  defs: [
    { id: 1, title: 'Hotwire & Getaway', desc: 'Stiehl den goldenen Cometa GT in Palm Heights, schüttle die Polizei ab und liefere ihn im Chop Shop am Hafen ab.', reward: 5000, color: '#ffb03a', start: () => LOC.m1lot },
    { id: 2, title: 'Neon Drop', desc: 'Kurierfahrt gegen die Uhr: Paket am Neon Plaza abholen und über Downtown, Küste, Hafen und Vorstadt liefern.', reward: 3000, color: '#ff2d95', start: () => LOC.plaza },
    { id: 3, title: 'Turf Takedown', desc: 'Schalte die Cuervos-Crew im Container-Terminal aus, sichere das Paket und bring es zu Kais Safehouse.', reward: 6000, color: '#22e4ff', start: () => V3(LOC.chop.x + 6, 0, LOC.chop.z) },
    { id: 4, title: 'Sky Runner', desc: 'Schnapp dir den Helikopter auf der Air Base und fliege durch alle Ringe über der Insel. Lande danach sicher.', reward: 7000, color: '#9dff3a', start: () => V3(LOC.base.x + 10, 0, LOC.base.z + 160) },
    { id: 5, title: 'Hafen-Deal', desc: 'Elena hat einen Kontakt auf einer Yacht vor der Küste. Hol das Paket mit dem Speedboot, hänge die Küstenwache ab und bring es zum Safehouse.', reward: 9000, color: '#4aa3ff', start: () => Missions.nearRoad(LOC.marina) },
    { id: 6, title: 'Zielfahrzeug', desc: 'Ein Verräter flieht mit einem schwarzen Stallion durch die Stadt. Jag ihn und zerstöre den Wagen, bevor er entkommt.', reward: 11000, color: '#ff6a3a', start: () => V3(LOC.chop.x - 8, 0, LOC.chop.z) },
    { id: 7, title: 'Der große Coup', desc: 'Das Finale: Überfall auf einen gepanzerten Geldtransporter in Downtown. Schnapp dir die Beute, entkomme mit 4 Sternen und flieh zur Marina.', reward: 25000, color: '#d4af37', start: () => V3(LOC.safehouse.x + 6, 0, LOC.safehouse.z) },
  ],
  active: null, step: 0, d: {}, waypoint: null, userWP: null, objective: '', timer: null, done: new Set(),
  init() {
    this.startMarkers = this.defs.map(d => { const p = d.start(); return new Marker(d.color, 'M' + d.id, 1.8).set(p.x, p.z); });
    this.wpMarker = new Marker('#ffd23a', null, 3.4).show(false); this.ringMarker = new Marker('#9dff3a', null, 13, true).show(false);
    this.pkgMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), std({ color: 0x8a5a2a, emissive: 0xff8a00, emissiveIntensity: 0.4 })); this.pkgMesh.visible = false; scene.add(this.pkgMesh);
  },
  nearStart() { if (this.active) return null; const p = Player.targetPos(); for (let i = 0; i < this.defs.length; i++) { const m = this.startMarkers[i].pos; if (Math.hypot(p.x - m.x, p.z - m.z) < 2.8) return this.defs[i]; } return null; },
  interact() { const d = this.nearStart(); if (d && !Player.vehicle) { this.start(d.id); return true; } return false; },
  ignoreCrime(type, pos) { return this.active && this.active.id === 3 && this.step <= 1 && ['shots', 'assault'].includes(type) && pos.distanceTo(LOC.portYard) < 100; },
  start(id) {
    if (this.active) this.cleanup(); const def = this.defs[id - 1]; this.active = def; this.step = 0; this.d = {}; this.timer = null; this.waypoint = null;
    this.startMarkers.forEach(m => m.show(false)); if (GS.playing) GS.set(STATES.MISSION_ACTIVE);
    UI.bigText(def.title, `Mission ${id} · Belohnung $${def.reward.toLocaleString('de-DE')}`, 'title', 3); Audio.jingle(true);
    if (id === 1) this.d.car = VS.spawn('sport', LOC.m1car.x, LOC.m1car.z, LOC.m1car.yaw || 0, { color: '#d4af37', mission: true });
    if (id === 3) { const c = Player.active; c.armor = 100; c.weapons.forEach((s, i) => { const w = CFG.WEAPONS[i]; if (w.reserve) s.reserve = Math.max(s.reserve, w.reserve); }); UI.notify('Ausrüstung erhalten: Schutzweste & Munition'); }
    if (id === 2) { const G = Roads.groups; const near = (p) => { const n = Roads.nearestNode(p.x, p.z); return V3(n.x, n.y, n.z); };
      this.d.cps = [V3(G.dt[4][0].x, 0, G.dt[4][0].z), near(LOC.beach), V3(G.pt[1][1].x, 0, G.pt[1][1].z), V3(G.sb[2][2].x, 0, G.sb[2][2].z), LOC.safehouse.clone()]; }
    if (id === 4) { const hp = LOC.helipads[2]; this.d.heli = VS.spawn('heli', hp.x, hp.z, -Math.PI / 2, { color: '#ffffff', mission: true });
      const r = (p, h) => V3(p.x, terrainHeight(p.x, p.z) + h, p.z); this.d.rings = [r(V3(BASE.x + 150, 0, BASE.z - 250), 60), r(LOC.summit, 45), r(V3(DOWNTOWN.x, 0, DOWNTOWN.z), 150), r(LOC.lighthouse, 55), r(LOC.marina, 30), r(LOC.quay, 60), r(LOC.safehouse, 40)]; }
  },
  setWP(v, r = 3) { this.waypoint = v; this.wpRadius = r; },
  nearRoad(p) { const r = Roads.nearest(p.x, p.z, 250, e => e.type !== 'highway'); if (!r) return V3(p.x, 0, p.z); const sd = r.lat >= 0 ? 1 : -1; return V3(r.p.x - r.p.tz * (r.e.hw + 2) * sd, 0, r.p.z + r.p.tx * (r.e.hw + 2) * sd); },
  say(who, text) { UI.notify(`<b style="color:${who === 'Kai' ? '#1fb5a8' : who === 'Elena' ? '#ff2d95' : '#ffd23a'}">${who}:</b> „${text}“`, 5.5); },
  // Fahrzeug mit Verkehrs-KI auf einer Straße erzeugen (Fluchtwagen, Geldtransporter)
  roadCar(type, near, dmin, dmax, color) { for (let t = 0; t < 50; t++) { const a = Math.random() * Math.PI * 2, d = rand(dmin, dmax), r = Roads.nearest(near.x + Math.cos(a) * d, near.z + Math.sin(a) * d, 80, e => e.type !== 'service'); if (!r) continue;
      const dir = Math.random() < 0.5 ? 1 : -1, p = Roads.lanePoint(r.e, dir, dir > 0 ? r.p.s : r.e.len - r.p.s, VS.laneOff(r.e), V3()); const v = VS.spawn(type, p.x, p.z, Math.atan2(p.tx, p.tz), { color, mission: true });
      VS.makeAI(v, 'traffic', r.e, dir, dir > 0 ? r.p.s : r.e.len - r.p.s); v.setOccupant(DriverPool.get(randomLook('gang'))); v.occupant._pool = true; return v; } return null; },
  m5(dt, P, pos) {
    const d = this.d;
    if (this.step === 0) { if (!d.boat) { const b = LOC.boats[2] || LOC.boats[0]; d.boat = VS.spawn('speedboat', b.x, b.z, Math.atan2(Math.cos(-0.3), Math.sin(-0.3)), { color: '#0d3b66', mission: true });
        const th = 0.25, r = coastRadius(th, 0) + 320; d.meet = V3(Math.cos(th) * r, 0, Math.sin(th) * r); d.yacht = VS.spawn('yacht', d.meet.x, d.meet.z, 1.2, { color: '#ffffff', mission: true }); this.say('Elena', 'Mein Kontakt wartet auf der weißen Yacht. Nimm das blaue Speedboot an der Marina.'); }
      if (d.boat.dead || d.boat.sinking) return 'fail:Das Speedboot wurde zerstört.';
      this.objective = 'Steig in das <b>Speedboot</b> an der Marina.'; this.setWP(d.boat.pos, 4); if (P.vehicle === d.boat) this.step = 1; return; }
    if (this.step === 1) { if (d.boat.dead || d.boat.sinking) return 'fail:Das Speedboot wurde zerstört.'; this.objective = 'Fahre zur <b>Yacht</b> vor der Küste.'; this.setWP(d.meet, 20);
      if (pos.distanceTo(d.yacht.pos) < 26 && (!P.vehicle || P.vehicle.hspeed < 5)) { this.step = 2; this.pkgMesh.visible = false; Wanted.set(Math.max(Wanted.level, 2)); Audio.pickup && Audio.pickup(); this.say('Kontakt', 'Hier ist die Ware. Und jetzt verschwinde – die Küstenwache war schneller als gedacht!'); }
      return; }
    if (this.step === 2) { this.objective = 'Hänge die <b>Küstenwache</b> ab.'; this.setWP(null); if (Wanted.level === 0) { this.step = 3; this.say('Elena', 'Sauber! Bring das Paket zu Kai ins Safehouse.'); } return; }
    if (Wanted.level > 0) { this.objective = 'Zuerst die <b>Polizei</b> abhängen!'; this.setWP(null); return; }
    this.objective = 'Bring das Paket zu <b>Kais Safehouse</b>.'; this.setWP(LOC.safehouse, 5); if (Math.hypot(pos.x - LOC.safehouse.x, pos.z - LOC.safehouse.z) < 6) return 'done';
  },
  m6(dt, P, pos) {
    const d = this.d;
    if (this.step === 0) { d.car = this.roadCar('muscle', pos, 220, 380, '#111111'); if (!d.car) return 'fail:Kein Zielfahrzeug gefunden.'; d.car.health = d.car.spec.hp * 1.6; this.timer = 200; this.step = 1; this.say('Kai', 'Da ist er – schwarzer Stallion. Lass ihn nicht entkommen!'); return; }
    const t = d.car; if (this.step === 1) { this.timer -= dt; if (this.timer <= 0) return 'fail:Das Zielfahrzeug ist entkommen.'; if (t.removed) return 'fail:Das Zielfahrzeug ist entkommen.';
      if (t.ai) { t.ai.panic = 99; t.ai.cruise = 22; } this.objective = 'Zerstöre den <b>schwarzen Stallion</b>.'; this.setWP(t.pos, 6);
      if (pos.distanceTo(t.pos) > 950) return 'fail:Das Zielfahrzeug ist entkommen.';
      if (t.dead || t.health <= 0) { this.step = 2; this.timer = null; Wanted.set(Math.max(Wanted.level, 2)); this.say('Kai', 'Erledigt. Jetzt nichts wie weg hier!'); } return; }
    this.objective = 'Hänge die <b>Polizei</b> ab.'; this.setWP(null); if (Wanted.level === 0) return 'done';
  },
  m7(dt, P, pos) {
    const d = this.d;
    if (this.step === 0) { const c = V3(DOWNTOWN.x, 0, DOWNTOWN.z); d.car = this.roadCar('suv', c, 60, 200, '#e8e8e8'); if (!d.car) return 'fail:Kein Geldtransporter gefunden.'; d.car.health = d.car.spec.hp * 3; d.car.armored = true; this.step = 1;
      this.say('Elena', 'Der weiße Geldtransporter fährt gerade durch Downtown. Stopp ihn – egal wie.'); return; }
    if (this.step === 1) { const t = d.car; if (t.removed) return 'fail:Der Transporter ist entkommen.'; this.objective = 'Stoppe den <b>Geldtransporter</b> (zerstören).'; this.setWP(t.pos, 6);
      if (t.dead || t.health <= 0) { this.step = 2; d.cash = t.pos.clone(); this.pkgMesh.visible = true; this.pkgMesh.position.set(d.cash.x + 3, groundHeight(d.cash.x + 3, d.cash.z, 50) + 0.4, d.cash.z); this.say('Kai', 'Die Taschen sind rausgeflogen – schnapp sie dir!'); } return; }
    if (this.step === 2) { const c = this.pkgMesh.position; this.pkgMesh.rotation.y += dt * 2; this.objective = 'Schnapp dir die <b>Beute</b>.'; this.setWP(c, 3);
      if (Math.hypot(pos.x - c.x, pos.z - c.z) < 3) { this.pkgMesh.visible = false; this.step = 3; Wanted.set(4); Audio.pickup && Audio.pickup(); this.say('Elena', 'Vier Sterne! Halt durch, ich warte an der Marina.'); } return; }
    if (this.step === 3) { this.objective = 'Entkomme der <b>Polizei</b> (4 Sterne).'; this.setWP(null); if (Wanted.level === 0) this.step = 4; return; }
    if (Wanted.level > 0) { this.objective = 'Zuerst die <b>Polizei</b> abhängen!'; this.setWP(null); return; }
    this.objective = 'Flieh zur <b>Marina</b>.'; this.setWP(LOC.marina, 10); if (Math.hypot(pos.x - LOC.marina.x, pos.z - LOC.marina.z) < 14) { this.say('Elena', 'Wir haben es geschafft, Kai. Solara gehört uns.'); return 'done'; }
  },
  update(dt) {
    for (const m of this.startMarkers) m.update(GameTime); this.wpMarker.update(GameTime); this.ringMarker.update(GameTime);
    const pos = Player.targetPos();
    if (!this.active) {
      this.objective = ''; this.timer = null; this.startMarkers.forEach(m => m.show(true)); this.ringMarker.show(false);
      if (this.userWP && Math.hypot(pos.x - this.userWP.x, pos.z - this.userWP.z) < 12) { this.userWP = null; UI.notify('Wegpunkt erreicht'); }
      this.waypoint = this.userWP; this.wpMarker.show(!!this.userWP); if (this.userWP) this.wpMarker.set(this.userWP.x, this.userWP.z);
      const d = this.nearStart(); if (d) UI.help(`<b>${d.title}</b><br>${d.desc}<br>Drücke <kbd>E</kbd>, um die Mission zu starten.`, 0.3);
      return;
    }
    const P = Player.active, m = this.active; const res = this['m' + m.id](dt, P, pos);
    if (res === 'done') this.complete(); else if (typeof res === 'string' && res.startsWith('fail:')) this.fail(res.slice(5));
    if (this.active && this.waypoint && !this.d.ringMode) { this.wpMarker.show(true); this.wpMarker.set(this.waypoint.x, this.waypoint.z); } else this.wpMarker.show(false);
  },
  m1(dt, P, pos) {
    const car = this.d.car; if (!car || car.dead || car.sinking || car.removed) return 'fail:Der Cometa GT wurde zerstört.'; const inCar = P.vehicle === car;
    if (this.step === 0) { this.objective = 'Stiehl den <b>goldenen Cometa GT</b> auf dem Parkplatz in Palm Heights.'; this.setWP(car.pos); if (inCar) { this.step = 1; Wanted.set(Math.max(Wanted.level, 2)); UI.notify('🚨 Alarmanlage! Die Polizei ist unterwegs.'); } return; }
    if (!inCar) { this.objective = 'Steig wieder in den <b>Cometa GT</b>.'; this.setWP(car.pos); return; }
    if (this.step === 1) { this.objective = 'Hänge die <b>Polizei</b> ab.'; this.setWP(null); if (Wanted.level === 0) this.step = 2; return; }
    if (Wanted.level > 0) { this.objective = 'Zuerst die <b>Polizei</b> abhängen!'; this.setWP(null); return; }
    this.objective = 'Liefere den Wagen im <b>Chop Shop</b> am Hafen ab.'; this.setWP(LOC.chop, 5);
    if (Math.hypot(car.pos.x - LOC.chop.x, car.pos.z - LOC.chop.z) < 7 && car.hspeed < 4) { Player.exitVehicle(true); car.mission = false; return 'done'; }
  },
  m2(dt, P, pos) {
    const CPS = this.d.cps;
    if (this.step === 0) { this.objective = 'Hol das <b>Paket</b> am Neon Plaza ab.'; this.setWP(LOC.plaza); if (Math.hypot(pos.x - LOC.plaza.x, pos.z - LOC.plaza.z) < 4) { this.step = 1; this.timer = 110; UI.notify('📦 Paket erhalten! Schnapp dir ein Fahrzeug – die Zeit läuft.'); Audio.pickup(); } return; }
    this.timer -= dt; if (this.timer <= 0) return 'fail:Die Zeit ist abgelaufen.';
    const i = this.step - 1, cp = CPS[i], last = i === CPS.length - 1;
    this.objective = last ? 'Übergib das Paket an <b>Kais Safehouse</b>.' : `Fahre durch <b>Checkpoint ${i + 1}/${CPS.length - 1}</b>.`; this.setWP(cp, 9);
    if (Math.hypot(pos.x - cp.x, pos.z - cp.z) < 10) { if (last) { this.d.bonus = Math.floor(this.timer) * 40; return 'done'; } this.step++; this.timer += 25; Audio.click(990); UI.notify(`✔ Checkpoint ${i + 1} · +25 s`); }
  },
  m3(dt, P, pos) {
    const Y = LOC.portYard;
    if (this.step === 0) { this.objective = 'Fahr zum <b>Container-Terminal</b> im Hafen.'; this.setWP(Y, 6);
      if (Math.hypot(pos.x - Y.x, pos.z - Y.z) < 60) { this.step = 1; this.d.gang = [];
        for (const [ox, oz] of [[-6, -8], [6, -9], [9, 4], [-7, 8], [2, 10], [11, -2], [-11, 0]]) { const n = NPCS.spawn('gang', Y.x + ox, Y.z + oz, { missionTarget: true }); n.yaw = rand(-3, 3); this.d.gang.push(n); }
        this.pkgMesh.position.set(Y.x, terrainHeight(Y.x, Y.z) + 0.3, Y.z); this.pkgMesh.visible = true; UI.notify('Die Cuervos-Crew bewacht das Paket!'); } return; }
    if (this.step === 1) { const alive = this.d.gang.filter(n => n.alive && n.kind === 'gang' && NPCS.list.includes(n)).length, killed = this.d.gang.length - alive;
      this.objective = `Schalte die <b>Cuervos-Crew</b> aus <i>(${killed}/${this.d.gang.length})</i>.`; this.setWP(null); if (alive === 0) { this.step = 2; UI.notify('Crew ausgeschaltet – hol dir das Paket!'); } return; }
    if (this.step === 2) { this.objective = 'Sichere das <b>Paket</b>.'; this.setWP(Y, 2.5); this.pkgMesh.rotation.y += dt; if (Math.hypot(pos.x - Y.x, pos.z - Y.z) < (P.vehicle ? 3.5 : 2.2)) { this.step = 3; this.pkgMesh.visible = false; Audio.pickup(); UI.notify('📦 Paket gesichert!'); } return; }
    this.objective = 'Bring das Paket zu <b>Kais Safehouse</b>.' + (Wanted.level > 0 ? ' <i>(Polizei vorher abhängen)</i>' : ''); this.setWP(LOC.safehouse, 4);
    if (Math.hypot(pos.x - LOC.safehouse.x, pos.z - LOC.safehouse.z) < 6 && Wanted.level === 0) return 'done';
  },
  m4(dt, P, pos) {
    const heli = this.d.heli; if (!heli || heli.dead || heli.sinking) return 'fail:Der Helikopter wurde zerstört.';
    if (P.vehicle !== heli) { this.objective = this.step === 0 ? 'Steig in den <b>Helikopter</b> auf der Air Base.' : 'Steig wieder in den <b>Helikopter</b>.'; this.setWP(heli.pos, 4); this.ringMarker.show(false); this.d.ringMode = false; return; }
    if (this.step === 0) { this.step = 1; this.timer = 240; UI.notify('Flieg durch alle Ringe! (Shift = steigen)'); }
    this.timer -= dt; if (this.timer <= 0) return 'fail:Zu langsam!';
    const R = this.d.rings, i = this.step - 1;
    if (i < R.length) { const r = R[i]; this.d.ringMode = true; this.objective = `Fliege durch <b>Ring ${i + 1}/${R.length}</b>.`; this.setWP(r, 14); this.ringMarker.show(true); this.ringMarker.group.position.copy(r);
      if (pos.distanceTo(r) < 15) { this.step++; Audio.click(1200); UI.notify(`✔ Ring ${i + 1}`); } return; }
    this.ringMarker.show(false); this.d.ringMode = false; const hp = LOC.helipads[1]; this.objective = 'Lande auf dem <b>Helipad</b> der Air Base.'; this.setWP(hp, 8);
    if (Math.hypot(pos.x - hp.x, pos.z - hp.z) < 12 && heli.onGround) { this.d.bonus = Math.floor(this.timer) * 20; return 'done'; }
  },
  cleanup() {
    const d = this.d; for (const k of ['car', 'heli', 'boat', 'yacht']) if (d[k] && !d[k].removed) d[k].mission = false;
    if (d.gang) for (const n of d.gang) if (NPCS.list.includes(n) && n.kind === 'gang') { n.missionTarget = false; if (n.alive) NPCS.remove(n); }
    this.pkgMesh.visible = false; this.ringMarker.show(false); this.active = null; this.d = {}; this.timer = null; this.waypoint = null; this.objective = '';
    if (GS.state === STATES.MISSION_ACTIVE) GS.set(STATES.PLAYING);
  },
  complete() { setTimeout(() => Save.save(true), 100); const m = this.active, reward = m.reward + (this.d.bonus || 0); GS.addMoney(reward); this.done.add(m.id); UI.bigText('MISSION ERFOLGREICH', `${m.title} · +$${reward.toLocaleString('de-DE')}`, 'passed', 4); Audio.jingle(true); this.cleanup(); UI.buildMissionList(); },
  fail(reason, silent = false) { if (!this.active) return; const m = this.active; this.cleanup(); if (silent) UI.notify(`✖ ${m.title} fehlgeschlagen`); else { UI.bigText('MISSION FEHLGESCHLAGEN', reason, 'failed', 3.5); Audio.jingle(false); } },
};

// ---------- KAMERA ----------
const Cam = {
  yaw: Math.PI, pitch: 0.28, curDist: 5, pivot: V3(), shake: 0, recoil: 0, idleT: 0, snap: true, sw: null, dir: V3(), _d: V3(), oy: 0, op: 0,
  update(dt) {
    if (this.sw) { this.updateSwitch(dt); return; }
    const c = Player.active, sens = 0.0022 * Settings.sens * (Settings.touch ? 0.9 : 1);
    if (In.mdx || In.mdy) { this.yaw -= In.mdx * sens; this.pitch += In.mdy * sens * (Settings.invertY ? -1 : 1); this.idleT = 0; } else this.idleT += dt;
    if (this.recoil) { this.pitch -= this.recoil; this.yaw += rand(-0.5, 0.5) * this.recoil; this.recoil = 0; }
    this.pitch = clamp(this.pitch, -0.6, 1.3);
    const v = c.vehicle;
    if (v && v.air) { // Verfolgerkamera für Luftfahrzeuge
      v.axes(); if (In.mdx || In.mdy) { this.oy -= In.mdx * sens; this.op += In.mdy * sens; } else if (this.idleT > 1.2) { this.oy = damp(this.oy, 0, 2, dt); this.op = damp(this.op, 0, 2, dt); }
      const dist = v.cls === 'heli' ? 15 : v.halfL * 1.6 + 9, back = tmpV3.copy(v.fwd).multiplyScalar(-1);
      if (v.cls === 'heli' || v.onGround) { back.y = 0; back.normalize(); }
      back.applyAxisAngle(tmpV4.set(0, 1, 0), this.oy); const want = this._d.copy(v.pos).addScaledVector(back, dist * Math.cos(this.op)).add(tmpV4.set(0, 4 + dist * Math.sin(this.op + 0.15), 0));
      if (v.cls === 'plane' && !v.onGround) want.addScaledVector(v.up, 2);
      if (this.snap) { camera.position.copy(want); this.snap = false; } else camera.position.lerp(want, 1 - Math.exp(-dt * (v.cls === 'plane' ? 6 : 4)));
      const gmin = Math.max(terrainHeight(camera.position.x, camera.position.z), CFG.WATER_Y) + 1; if (camera.position.y < gmin) camera.position.y = gmin;
      this.pivot.copy(v.pos).addScaledVector(v.fwd, 8).add(tmpV4.set(0, 2, 0)); if (v.cls === 'plane' && !v.onGround) camera.up.lerp(v.up, 0.08).normalize(); else camera.up.set(0, 1, 0);
      this.applyShake(dt); camera.lookAt(this.pivot); this.yaw = Math.atan2(-back.x, -back.z) + Math.PI; this.setFov(damp(camera.fov, 62 + Math.min(20, v.speed * 0.08) + (v.boosting ? 8 : 0), 4, dt)); return;
    }
    camera.up.set(0, 1, 0); this.oy = this.op = 0;
    let tgt, h, dist, fov = 65, side = 0, k = 14;
    if (v) {
      tgt = v.pos; h = v.isBike ? 1.6 : v.boat ? v.height * 0.6 + 1.2 : 1.1 + v.height * 0.55; dist = v.boat ? v.halfL * 1.5 + 5 : v.isBike ? 5.5 : v.halfL * 1.5 + 3.8; k = 12;
      fov = 65 + Math.min(20, v.hspeed * 0.3) + (v.boosting ? 9 : 0);
      if (this.idleT > 1.2 && v.hspeed > 4 && !c.aiming) { const behind = v.vF < -1 ? v.yaw : v.yaw + Math.PI; this.yaw += wrapAngle(behind - this.yaw) * Math.min(1, dt * 2.4); this.pitch = damp(this.pitch, 0.2, 2, dt); }
      if (c.aiming) { dist *= 0.8; fov -= 8; side = 0.7; }
    } else { tgt = c.pos; h = c.swim ? 0.6 : c.crouch ? 1.15 : 1.6; dist = c.chute ? 8 : c.aiming ? 2.4 : 4.4; side = c.aiming ? 0.7 : 0.38; fov = c.aiming ? 50 : (c.sprinting ? 71 : 65); if (Admin.noclip) { dist = 6; side = 0; } }
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw), want = this._d.set(tgt.x + rx * side, tgt.y + h, tgt.z + rz * side);
    if (this.snap) { this.pivot.copy(want); this.curDist = dist; this.snap = false; }
    else { this.pivot.x = damp(this.pivot.x, want.x, k * 1.6, dt); this.pivot.z = damp(this.pivot.z, want.z, k * 1.6, dt); this.pivot.y = damp(this.pivot.y, want.y, k, dt); }
    const cp = Math.cos(this.pitch); this.dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const t = Admin.noclip ? dist + 1 : raycastWorld(this.pivot, this.dir, dist + 0.3, true, true), wd = Math.max(0.5, Math.min(dist, t - 0.3));
    this.curDist = wd < this.curDist ? wd : damp(this.curDist, wd, 4, dt);
    camera.position.copy(this.pivot).addScaledVector(this.dir, this.curDist);
    const gmin = Math.max(terrainHeight(camera.position.x, camera.position.z), CFG.WATER_Y) + 0.3; if (camera.position.y < gmin && !Admin.noclip) camera.position.y = gmin;
    this.applyShake(dt); camera.lookAt(this.pivot); this.setFov(damp(camera.fov, fov, 6, dt));
  },
  applyShake(dt) { if (this.shake > 0) { const s = this.shake * 0.35; camera.position.x += rand(-s, s); camera.position.y += rand(-s, s); camera.position.z += rand(-s, s); this.shake = Math.max(0, this.shake - dt * 2.5); } },
  setFov(f) { if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); } },
  startSwitch() {
    if (GS.switching || this.sw) return; if (Wanted.level > 0) { UI.notify('✖ Wechsel nicht möglich – du wirst gesucht!'); Audio.empty(); return; }
    const toIdx = 1 - Player.idx; Audio.setHorn(false); this.sw = { t: 0, from: camera.position.clone(), look: this.pivot.clone(), toIdx, swapped: false }; GS.switching = true; Audio.whoosh(); UI.switchOverlay(toIdx);
  },
  updateSwitch(dt) {
    const s = this.sw; s.t += dt; const T1 = 0.8, T2 = 1.8, T3 = 2.6, H = 260; camera.up.set(0, 1, 0);
    const to = Player.chars[s.toIdx], tp = to.vehicle ? to.vehicle.pos : to.pos, tyaw = (to.vehicle ? to.vehicle.yaw : to.yaw) + Math.PI;
    const A = tmpV1.set(s.look.x, H, s.look.z + 20), B = tmpV2.set(tp.x, H, tp.z + 20), look = tmpV3; let k;
    if (s.t < T1) { k = smooth(s.t / T1); camera.position.lerpVectors(s.from, A, k); look.set(s.look.x, lerp(s.look.y, 0, k), s.look.z); }
    else if (s.t < T2) { k = smooth((s.t - T1) / (T2 - T1)); camera.position.lerpVectors(A, B, k); look.set(camera.position.x, 0, camera.position.z - 20); if (!s.swapped && k > 0.5) { s.swapped = true; Player.idx = s.toIdx; UI.flash(); UI.notify(`Du spielst jetzt ${Player.active.def.name}.`); } }
    else if (s.t < T3) { k = smooth((s.t - T2) / (T3 - T2)); const end = tmpV4.set(tp.x + Math.sin(tyaw) * 5, tp.y + 2.3, tp.z + Math.cos(tyaw) * 5); camera.position.lerpVectors(B, end, k); look.set(tp.x, lerp(0, tp.y + 1.5, k), lerp(tp.z - 20 * (1 - k), tp.z, k)); }
    else { this.yaw = tyaw; this.pitch = 0.25; this.snap = true; this.sw = null; GS.switching = false; UI.switchOverlay(-1); return; }
    camera.lookAt(look); this.setFov(65);
  },
};

// ---------- UI ----------
const CONTROLS = [
  ['W A S D / Pfeile', 'Bewegen / Fahren & Lenken'], ['Maus', 'Kamera (Klick fängt die Maus)'], ['Leertaste', 'Springen / Handbremse'], ['Shift', 'Sprinten / Nitro / Schub+ / Steigen'],
  ['F oder E', 'Ein-/Aussteigen, Mission starten'], ['Rechtsklick', 'Zielen (Jet: Rakete)'], ['Linksklick', 'Schießen (Jet: Bordkanone)'], ['Q / E', 'Nahkampf / Flug: Seitenruder bzw. seitwärts'],
  ['R', 'Nachladen / Radio / Aufrichten'], ['1 – 4 / Mausrad', 'Waffe wechseln'], ['C / Strg', 'Ducken / Schub− / Sinken'], ['TAB', 'Kai ⇄ Elena'],
  ['E', 'Shops, Missionen, Zeitrennen'], ['U', 'Handy (Garage, Jobs, Speichern)'], ['H', 'Hupe / Sirene'], ['M', 'Missionen'], ['K', 'Große Karte (Wegpunkt/Teleport)'], ['F2 oder ^', 'Admin-Menü'], ['T / G', 'Tageszeit / Wetter'], ['N', 'Ton an/aus'], ['ESC / P', 'Pause'],
];
const UI = {
  last: {}, helpT: 0, bigT: 0, hurtT: 0, hitT: 0, lockT: 0, fpsT: 0, frames: 0,
  init() {
    this.mm = $('minimap').getContext('2d'); this.cmp = $('compass').getContext('2d');
    $('charBox').innerHTML = CFG.CHARACTERS.map((c, i) => `<span class="charChip" id="chip${i}" style="background:${c.color}55">${c.name}</span>`).join('');
    const ctl = CONTROLS.map(([k, a]) => `<div><span>${k}</span><span>${a}</span></div>`).join('') + (IS_TOUCH ? '<div><span>Touch</span><span>Linker Stick bewegt, rechte Seite wischen = Kamera</span></div>' : '');
    $('controlsMenu').innerHTML = ctl; $('controlsPause').innerHTML = ctl;
    this.buildOptions($('optsMenu')); this.buildOptions($('optsPause')); this.buildMissionList();
    $('btnPlay').onclick = () => Game.start(); $('btnResume').onclick = () => Game.resume();
    $('btnFull').onclick = () => { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => { })).call(el); };
    $('btnTime').onclick = () => { Env.nextTime(); Audio.click(); }; $('btnWeather').onclick = () => { Env.nextWeather(); Audio.click(); };
    $('btnMissions').onclick = () => Game.openMissions(); $('btnMainMenu').onclick = () => Game.mainMenu(); $('btnMap').onclick = () => { Game.resume(); BigMap.open(); }; $('btnAdmin').onclick = () => { Game.resume(); AdminUI.toggle(true); };
    $('btnCloseMissions').onclick = () => Game.resume(); $('btnAbort').onclick = () => { if (Missions.active) Missions.fail('Abgebrochen.', true); Game.resume(); };
    $('muteBtn').onclick = () => Game.toggleSound();
    $('switchOverlay').innerHTML = CFG.CHARACTERS.map((c, i) => `<div class="swCard" id="sw${i}"><div class="dot" style="background:${c.color}"></div>${c.name}</div>`).join('');
  },
  buildOptions(el) {
    el.innerHTML = `<label>Grafik <select data-o="quality">${Object.entries(CFG.QUALITY).map(([k, q]) => `<option value="${k}">${q.label}</option>`).join('')}</select></label>
      <label>Sound <button data-o="sound"></button></label><label>Lautstärke <input type="range" min="0" max="1" step="0.05" data-o="volume"></label>
      <label>Kamera-Empfindl. <input type="range" min="0.4" max="3" step="0.1" data-o="sens"></label><label>Y invertieren <input type="checkbox" data-o="invertY"></label>
      <label>Touch-Steuerung <input type="checkbox" data-o="touch"></label>`;
    el.querySelector('[data-o=quality]').onchange = (e) => { Settings.quality = e.target.value; saveSettings(); Game.applyQuality(); this.syncOptions(); };
    el.querySelector('[data-o=sound]').onclick = () => Game.toggleSound();
    el.querySelector('[data-o=volume]').oninput = (e) => { Settings.volume = +e.target.value; saveSettings(); Audio.applyVolume(); };
    el.querySelector('[data-o=sens]').oninput = (e) => { Settings.sens = +e.target.value; saveSettings(); };
    el.querySelector('[data-o=invertY]').onchange = (e) => { Settings.invertY = e.target.checked; saveSettings(); };
    el.querySelector('[data-o=touch]').onchange = (e) => { Settings.touch = e.target.checked; saveSettings(); $('touch').classList.toggle('on', Settings.touch && GS.state !== STATES.MENU); };
    this.syncOptions();
  },
  syncOptions() { for (const el of document.querySelectorAll('[data-o]')) { const k = el.dataset.o; if (k === 'sound') el.textContent = Settings.sound ? 'AN' : 'AUS'; else if (el.type === 'checkbox') el.checked = !!Settings[k]; else el.value = Settings[k]; } $('muteBtn').textContent = Settings.sound ? '🔊' : '🔇'; },
  buildMissionList() {
    $('missionList').innerHTML = Missions.defs.map(d => `<div class="missionItem" data-m="${d.id}"><div class="num">${d.id}</div><div><h4>${d.title} ${Missions.done.has(d.id) ? '✔' : ''}</h4><p>${d.desc}</p></div><div class="rew">$${d.reward.toLocaleString('de-DE')}</div></div>`).join('');
    for (const el of document.querySelectorAll('.missionItem')) el.onclick = () => { Missions.start(+el.dataset.m); Game.resume(); };
  },
  set(id, val, prop = 'textContent') { if (this.last[id] !== val) { this.last[id] = val; $(id)[prop] = val; } },
  notify(text, dur = 3.5) { const d = document.createElement('div'); d.className = 'note'; d.innerHTML = text; const box = $('notify'); box.appendChild(d); while (box.children.length > 5) box.firstChild.remove(); setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, dur * 1000); },
  help(html, dur = 4) { if (this.last.help !== html) { $('helpBox').innerHTML = html; this.last.help = html; } $('helpBox').classList.add('show'); this.helpT = dur; },
  bigText(title, sub, cls, dur) { const b = $('bigText'); b.className = 'show ' + cls; b.querySelector('h1').textContent = title; b.querySelector('p').textContent = sub || ''; this.bigT = dur; },
  hurt() { this.hurtT = 0.4; }, hitmark() { this.hitT = 0.15; },
  flash() { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.8; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); },
  switchOverlay(idx) { $('switchOverlay').classList.toggle('show', idx >= 0); CFG.CHARACTERS.forEach((c, i) => $('sw' + i).classList.toggle('sel', i === idx)); },
  update(dt) {
    const c = Player.active, s = c.weapons[c.cur], w = c.weapon, lvl = Wanted.level;
    if (this.last.stars !== lvl) { this.last.stars = lvl; [...$('stars').children].forEach((e, i) => e.className = i < lvl ? 'on' : ''); }
    const fl = Wanted.flash && lvl > 0; if (this.last.flash !== fl) { this.last.flash = fl; $('stars').classList.toggle('flash', fl); }
    this.set('money', '$' + GS.money.toLocaleString('de-DE')); this.set('weaponName', w.name); this.set('ammo', w.melee ? '' : (Admin.infAmmo ? `${s.clip} / ∞` : `${s.clip} / ${s.reserve}`)); this.set('reloadTag', c.reloadT > 0 ? 'NACHLADEN' : '');
    $('hpFill').style.width = Math.max(0, c.health) + '%'; $('armorFill').style.width = Math.max(0, c.armor) + '%';
    CFG.CHARACTERS.forEach((_, i) => { const a = i === Player.idx; if (this.last['chip' + i] !== a) { this.last['chip' + i] = a; $('chip' + i).classList.toggle('active', a); } });
    const v = c.vehicle, air = v && v.air; $('speedo').classList.toggle('hidden', !v || air); $('flightHud').classList.toggle('hidden', !air); $('horizon').style.display = air && v.cls === 'plane' ? 'block' : 'none';
    if (v && !air) { this.set('vehName', v.spec.name + (v.cls === 'car' && !v.isBike ? ` · ${v.gear < 0 ? 'R' : v.gear}. Gang` : '')); this.set('speedVal', String(Math.round(v.hspeed * 3.6))); $('vehHp').style.width = (v.health / v.spec.hp * 100) + '%'; $('nitroFill').style.width = (v.nitro * 100) + '%'; this.set('radioName', Audio.station ? '📻 ' + RADIO[Audio.station].name : ''); }
    if (air) { const agl = v.pos.y - Math.max(0, terrainHeight(v.pos.x, v.pos.z)); this.set('fhName', v.spec.name); this.set('fhSpeed', String(Math.round(v.speed * 3.6))); this.set('fhAlt', String(Math.round(agl))); this.set('fhVs', v.vel.y.toFixed(1));
      this.set('fhThr', v.cls === 'heli' ? String(Math.round(v.rotorSpin * 100)) : String(Math.round(v.thr * 100))); this.set('fhWarn', v.stall && !v.onGround ? 'STALL!' : agl < 40 && v.vel.y < -8 ? 'PULL UP!' : v.boosting ? 'NACHBRENNER' : '');
      $('fhHp').style.width = (v.health / v.spec.hp * 100) + '%'; if (v.cls === 'plane') { const roll = Math.atan2(v.right.y, v.up.y); $('horizon').style.transform = `rotate(${-roll}rad) translateY(${clamp(Math.asin(clamp(v.fwd.y, -1, 1)) * 300, -150, 150)}px)`; } }
    this.set('clock', Env.clockStr()); this.set('weatherName', Env.weather.name); const tp = Player.targetPos(); this.set('zoneName', zoneLabel(tp.x, tp.z));
    this.set('objective', Missions.objective || Act.objective, 'innerHTML');
    if (Missions.timer != null) { const t = Math.max(0, Missions.timer); this.set('timerBox', `⏱ ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`); $('timerBox').classList.toggle('low', t < 10); } else this.set('timerBox', '');
    const aimingNow = c.aiming && !c.weapon.melee, ah = Player.aimHit, onT = aimingNow && ah && ((ah.npc && ah.npc.alive) || (ah.vehicle && !ah.vehicle.dead));
    const cls = (aimingNow || (v && v.spec.guns) ? '' : 'small') + (onT ? ' target' : ''); if (this.last.ch !== cls) { this.last.ch = cls; $('crosshair').className = cls; }
    $('crosshair').style.display = (c.swim || GS.switching || (air && !v.spec.guns)) ? 'none' : '';
    this.hitT -= dt; $('hitmarker').style.opacity = this.hitT > 0 ? 1 : 0;
    this.hurtT -= dt; $('vignette').style.opacity = this.hurtT > 0 ? 0.8 : (c.health < 25 ? 0.35 + Math.sin(GameTime * 6) * 0.15 : 0);
    this.helpT -= dt; if (this.helpT <= 0) $('helpBox').classList.remove('show');
    if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) $('bigText').classList.remove('show'); }
    const pe = $('policeEdge'); if (lvl > 0 && Wanted.seen) { const red = Math.floor(GameTime * 4) % 2; pe.style.boxShadow = `inset 0 0 80px 10px ${red ? 'rgba(255,0,40,.35)' : 'rgba(0,80,255,.35)'}`; pe.style.opacity = 1; } else pe.style.opacity = 0;
    if (GS.playing && !In.locked && !In.dragging && !Settings.touch && !Admin.open) this.lockT += dt; else this.lockT = 0; $('lockHint').classList.toggle('hidden', this.lockT < 1.2);
    this.frames++; this.fpsT += dt; if (this.fpsT > 0.5) { $('fps').style.display = Admin.showFps ? 'block' : 'none'; if (Admin.showFps) $("fps").textContent = `${Math.round(this.frames / this.fpsT)} FPS · Auflösung ${Math.round(Perf.scale * 100)}% · Draw-Calls ${renderer.info.render.calls} · Fz ${VS.list.length} · NPC ${NPCS.list.length}`; this.frames = 0; this.fpsT = 0; }
    this.waypointIndicator(); this.drawMinimap(); this.drawCompass();
  },
  waypointIndicator() {
    const wp = Missions.waypoint, el = $('waypointInd'); if (!wp || !GS.alive) { el.classList.add('hidden'); return; }
    const p = tmpV1.set(wp.x, (wp.y || Math.max(terrainHeight(wp.x, wp.z), 0)) + 2.5, wp.z); const dist = Math.round(p.distanceTo(Player.targetPos()));
    p.project(camera); let x = p.x, y = p.y; if (p.z > 1) { x = -x; y = -1; } const W = innerWidth, H = innerHeight; const sx = clamp((x + 1) / 2 * W, 40, W - 40), sy = clamp((1 - y) / 2 * H, 60, H - 60);
    el.classList.remove('hidden'); el.style.left = sx + 'px'; el.style.top = sy + 'px'; el.querySelector('span').textContent = dist + ' m';
  },
  drawMinimap() {
    const g = this.mm, S = 420, R = S / 2, c = Player.active, p = Player.targetPos(), v = c.vehicle;
    const zoom = v ? (v.air ? lerp(1.2, 0.35, clamp((p.y - terrainHeight(p.x, p.z)) / 400, 0, 1)) : lerp(2.2, 1.0, clamp(v.hspeed / 50, 0, 1))) : 3.0;
    const cs = Math.cos(Cam.yaw), sn = Math.sin(Cam.yaw);
    g.save(); g.clearRect(0, 0, S, S); g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip(); g.fillStyle = '#1b4a72'; g.fillRect(0, 0, S, S);
    g.translate(R, R); g.rotate(Cam.yaw); const k = zoom / MAP.s; g.scale(k, k); g.translate(-(p.x + MAP.range) * MAP.s, -(p.z + MAP.range) * MAP.s); g.drawImage(MAP.canvas, 0, 0); g.restore();
    const to = (x, z, cl = true) => { const dx = (x - p.x) * zoom, dy = (z - p.z) * zoom; let rx = dx * cs - dy * sn, ry = dx * sn + dy * cs; const l = Math.hypot(rx, ry); if (cl && l > R - 14) { rx *= (R - 14) / l; ry *= (R - 14) / l; } return [R + rx, R + ry, l]; };
    const dot = (x, z, color, r = 6, cl = false) => { const [sx, sy, l] = to(x, z, cl); if (!cl && l > R) return; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fillStyle = color; g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke(); };
    const icon = (x, z, color, txt, cl = false) => { const [sx, sy, l] = to(x, z, cl); if (!cl && l > R) return; g.beginPath(); g.arc(sx, sy, 11, 0, Math.PI * 2); g.fillStyle = color; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, sy + 1); };
    for (const [L, col2, t] of [[LOC.hospital, '#d22', '+'], [LOC.police, '#2a5bd8', '★'], [LOC.safehouse, '#1fb5a8', 'K'], [LOC.base, '#6a7a4a', '✈'], [LOC.marina, '#2a8ad8', '⚓']]) if (L) icon(L.x, L.z, col2, t);
    if (!Missions.active) Missions.defs.forEach((d, i) => { const m = Missions.startMarkers[i].pos; icon(m.x, m.z, d.color, String(d.id), true); });
    for (const o of VS.list) { if (o.ai && o.ai.mode === 'police' && Wanted.level > 0 || o.policeHeli) dot(o.pos.x, o.pos.z, Math.floor(GameTime * 5) % 2 ? '#ff2040' : '#2a6aff', 7, true); else if (o.air && !o.driver && !o.dead) dot(o.pos.x, o.pos.z, '#cfd8e0', 4.5); }
    for (const n of NPCS.list) { if (!n.alive) continue; if (n.kind === 'cop' && Wanted.level > 0) dot(n.pos.x, n.pos.z, '#4a8aff', 4.5); else if (n.kind === 'gang' && n.missionTarget) dot(n.pos.x, n.pos.z, '#ff2a2a', 6, true); }
    if (Missions.active && Missions.d.car && Player.vehicle !== Missions.d.car) dot(Missions.d.car.pos.x, Missions.d.car.pos.z, '#ffd23a', 7, true);
    const other = Player.chars[1 - Player.idx], op = other.vehicle ? other.vehicle.pos : other.pos; dot(op.x, op.z, other.def.color, 6.5, true);
    if (Missions.waypoint) { const [sx, sy] = to(Missions.waypoint.x, Missions.waypoint.z, true); g.save(); g.translate(sx, sy); g.rotate(Math.PI / 4); g.fillStyle = '#ffd23a'; g.fillRect(-8, -8, 16, 16); g.lineWidth = 2.5; g.strokeStyle = '#000'; g.strokeRect(-8, -8, 16, 16); g.restore(); }
    { const nx = sn, ny = -cs; g.fillStyle = '#fff'; g.font = 'bold 18px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', R + nx * (R - 16), R + ny * (R - 16)); }
    const yawP = v ? v.yaw : c.yaw, fx = Math.sin(yawP), fz = Math.cos(yawP), ang = Math.atan2(fx * sn + fz * cs, fx * cs - fz * sn);
    g.save(); g.translate(R, R); g.rotate(ang + Math.PI / 2); g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 11); g.lineTo(0, 5); g.lineTo(-10, 11); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#000'; g.stroke(); g.restore();
    if (Wanted.level > 0) { g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = Math.floor(GameTime * 4) % 2 ? 'rgba(255,30,60,.8)' : 'rgba(40,90,255,.8)'; g.stroke(); }
  },
  drawCompass() {
    const g = this.cmp, W = 380, H = 28, bearing = -Cam.yaw, F = 1.25; g.clearRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const L = [['N', 0], ['NO', Math.PI / 4], ['O', Math.PI / 2], ['SO', Math.PI * 0.75], ['S', Math.PI], ['SW', -Math.PI * 0.75], ['W', -Math.PI / 2], ['NW', -Math.PI / 4]]; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [t, a] of L) { const rel = wrapAngle(a - bearing); if (Math.abs(rel) > F) continue; const x = W / 2 + rel / F * (W / 2 - 14); g.globalAlpha = 1 - Math.abs(rel) / F * 0.7; g.fillStyle = t === 'N' ? '#ff4b6e' : '#fff'; g.font = t.length === 1 ? 'bold 16px Arial' : '12px Arial'; g.fillText(t, x, H / 2); }
    g.globalAlpha = 1;
    if (Missions.waypoint) { const p = Player.targetPos(), a = Math.atan2(Missions.waypoint.x - p.x, -(Missions.waypoint.z - p.z)), rel = wrapAngle(a - bearing), x = W / 2 + clamp(rel / F, -1, 1) * (W / 2 - 14); g.save(); g.translate(x, 6); g.rotate(Math.PI / 4); g.fillStyle = '#ffd23a'; g.fillRect(-4, -4, 8, 8); g.restore(); }
    g.fillStyle = '#ffb03a'; g.fillRect(W / 2 - 1, 0, 2, 5);
  },
};
function zoneLabel(x, z) {
  const zn = zoneAt(x, z); if (terrainHeight(x, z) < -0.5) return 'Golf von Solara';
  return { downtown: 'Downtown Solara', strip: 'Ocean Drive', port: 'Port Solara', suburb: 'Palm Heights', heights: 'Coral Heights', village: 'San Lorenzo', mountain: 'Mount Leona', base: 'Solara Air Base', rural: islandE(x, z) < 0.1 ? 'Küste' : 'Hinterland' }[zn] || '';
}

// ---------- GROSSE KARTE ----------
const BigMap = {
  tp: false, open() { if (!GS.playing) return; Admin.open = false; $('admin').classList.add('hidden'); $('bigMap').classList.remove('hidden'); this.isOpen = true; In.unlock(); this.draw(); },
  close() { $('bigMap').classList.add('hidden'); this.isOpen = false; if (GS.playing) In.lock(); },
  init() {
    const cv = $('bigMapCanvas'); cv.addEventListener('pointerdown', (e) => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 2 * WS - WS, z = (e.clientY - r.top) / r.height * 2 * WS - WS;
      if (e.shiftKey || this.tp) { Player.teleport(x, z); this.close(); } else { Missions.userWP = V3(x, terrainHeight(x, z), z); UI.notify('📍 Wegpunkt gesetzt'); this.draw(); } });
    $('mapClose').onclick = () => this.close(); $('mapTp').onclick = () => { this.tp = !this.tp; $('mapTp').textContent = 'Teleport-Modus: ' + (this.tp ? 'AN' : 'AUS'); };
  },
  draw() {
    const cv = $('bigMapCanvas'), g = cv.getContext('2d'), S = cv.width, k = S / (2 * WS), T = (v) => (v + WS) * k; g.drawImage(MAP.canvas, 0, 0, S, S);
    g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.85)';
    for (const [t, x, z] of [['DOWNTOWN', DOWNTOWN.x, DOWNTOWN.z], ['PALM HEIGHTS', SUBURB.x, SUBURB.z], ['PORT SOLARA', PORT.x, PORT.z], ['MOUNT LEONA', MOUNT.x, MOUNT.z - 60], ['AIR BASE', BASE.x, BASE.z - 460], ['MARINA', LOC.marina.x - 60, LOC.marina.z], ['CORAL HEIGHTS', HEIGHTS.x, HEIGHTS.z], ['SAN LORENZO', VILLAGE.x, VILLAGE.z]]) g.fillText(t, T(x), T(z));
    Missions.defs.forEach((d, i) => { const m = Missions.startMarkers[i].pos; g.beginPath(); g.arc(T(m.x), T(m.z), 12, 0, 7); g.fillStyle = d.color; g.fill(); g.fillStyle = '#fff'; g.font = 'bold 14px Arial'; g.fillText(d.id, T(m.x), T(m.z) + 5); });
    const p = Player.targetPos(); g.beginPath(); g.arc(T(p.x), T(p.z), 10, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#000'; g.stroke();
    if (Missions.waypoint) { g.fillStyle = '#ffd23a'; g.fillRect(T(Missions.waypoint.x) - 8, T(Missions.waypoint.z) - 8, 16, 16); }
  },
};

// ---------- ADMIN-MENÜ ----------
const AdminUI = {
  toggle(force) { const open = force ?? !Admin.open; if (open && !GS.playing) return; Admin.open = open; $('admin').classList.toggle('hidden', !open); if (open) { In.unlock(); this.build(); } else if (GS.playing) In.lock(); },
  spawnVeh(type) {
    const c = Player.active, S = CFG.VEHICLES[type]; if (c.vehicle) Player.exitVehicle(true);
    const yaw = Cam.yaw + Math.PI, fx = Math.sin(yaw), fz = Math.cos(yaw); let x = c.pos.x + fx * 8, z = c.pos.z + fz * 8, spYaw = null;
    if (S.cls === 'boat') { let found = null; for (let r = 10; r < 1500 && !found; r += 15) for (let a = 0; a < 16; a++) { const px = c.pos.x + Math.cos(a / 16 * 6.283) * r, pz = c.pos.z + Math.sin(a / 16 * 6.283) * r; if (terrainHeight(px, pz) < -4 && terrainHeight(px + 15, pz) < -3 && terrainHeight(px - 15, pz) < -3 && terrainHeight(px, pz + 15) < -3 && terrainHeight(px, pz - 15) < -3) { found = [px, pz]; break; } } if (!found) { UI.notify('Kein Wasser in der Nähe'); return; } [x, z] = found;
      let bh = 1e9; for (let a = 0; a < 16; a++) { const ya = a / 16 * Math.PI * 2, h = terrainHeight(x + Math.sin(ya) * 60, z + Math.cos(ya) * 60); if (h < bh) { bh = h; spYaw = ya; } } }
    const v = VS.spawn(type, x, z, spYaw ?? yaw);
    if (S.cls === 'plane') { v.pos.set(c.pos.x, Math.max(terrainHeight(c.pos.x, c.pos.z), 0) + 220, c.pos.z); v.q.setFromEuler(tmpE.set(0, yaw, 0, 'YXZ')); v.axes(); v.vel.copy(v.fwd).multiplyScalar(S.vStall * 1.6); v.thr = 0.8; v.onGround = false; }
    if (S.cls === 'heli' && World.query(x - 6, z - 6, x + 6, z + 6, _qb).length) { v.pos.y += 30; v.rotorSpin = 1; v.onGround = false; }
    if (S.cls === 'heli' && v.pos.y > 25) v.rotorSpin = 1;
    c.pos.set(v.pos.x, v.pos.y, v.pos.z); Player.tryEnter(c); if (c.vehicle !== v) { c.vehicle = v; v.driver = c; v.setOccupant(c.h, v.m.pose); } Cam.snap = true; this.toggle(false);
  },
  build() {
    const el = $('admin'), P = Player.active; const tg = (key, label) => `<button data-tg="${key}" class="${Admin[key] ? 'on' : ''}">${label}</button>`;
    const locs = [['Downtown', DOWNTOWN.x, DOWNTOWN.z], ['Strand', LOC.beach.x - 30, LOC.beach.z], ['Marina', LOC.marina.x - 25, LOC.marina.z], ['Hafen', LOC.portYard.x, LOC.portYard.z - 30], ['Air Base', LOC.base.x, LOC.base.z], ['Rollbahn', LOC.runway.x, LOC.runway.z], ['Gipfel', LOC.summit.x + 8, LOC.summit.z + 8], ['Leuchtturm', LOC.lighthouse.x - 12, LOC.lighthouse.z], ['Safehouse', LOC.safehouse.x, LOC.safehouse.z], ['Krankenhaus', LOC.hospital.x, LOC.hospital.z], ['Polizei', LOC.police.x, LOC.police.z], ['Neon Plaza', LOC.plaza.x, LOC.plaza.z]];
    el.innerHTML = `<h2>🛠 ADMIN <button class="close" data-a="close">✕</button></h2>
      <h3>Spieler</h3><div class="grid">${tg('god', 'Godmode')}${tg('infAmmo', 'Unendl. Munition')}${tg('noclip', 'Noclip / Fliegen')}${tg('oneHit', 'One-Hit-Kill')}${tg('noWanted', 'Nie gesucht')}<button data-a="heal">Heilen + Weste</button><button data-a="money">+$100.000</button><button data-a="ammo">Munition voll</button><button data-a="switch">Figur wechseln</button></div>
      <h3>Fahndung</h3><div class="grid">${[0, 1, 2, 3, 4, 5].map(i => `<button data-w="${i}">${i} ★</button>`).join('')}</div>
      <h3>Teleport</h3><div class="grid">${locs.map((l, i) => `<button data-tp="${i}">${l[0]}</button>`).join('')}<button data-a="tpwp">→ Wegpunkt</button><button data-a="map">🗺 Karte (Klick-Teleport)</button></div>
      <h3>Fahrzeug spawnen</h3><div class="grid">${Object.entries(CFG.VEHICLES).map(([k, v]) => `<button data-sp="${k}">${v.name}</button>`).join('')}</div>
      <h3>Fahrzeug</h3><div class="grid"><button data-a="repair">Reparieren</button><button data-a="flip">Aufrichten</button>${tg('infNitro', 'Nitro unendlich')}<button data-a="boom">Fahrzeuge in Nähe sprengen</button><button data-a="clearv">Fahrzeuge entfernen</button></div>
      <h3>Welt</h3>
      <label class="sl"><span>Uhrzeit <b id="adTime">${Env.clockStr()}</b></span><input type="range" min="0" max="23.9" step="0.1" value="${Env.time.toFixed(1)}" data-sl="time"></label>
      <div class="grid">${tg('freezeTime', 'Zeit einfrieren')}${CFG.WEATHER.map((w, i) => `<button data-we="${i}">${w.name}</button>`).join('')}</div>
      <label class="sl"><span>Verkehr ×<b id="adTr">${Admin.trafficMul}</b></span><input type="range" min="0" max="3" step="0.25" value="${Admin.trafficMul}" data-sl="traffic"></label>
      <label class="sl"><span>Passanten ×<b id="adPd">${Admin.pedMul}</b></span><input type="range" min="0" max="3" step="0.25" value="${Admin.pedMul}" data-sl="peds"></label>
      <label class="sl"><span>Zeitlupe ×<b id="adTs">${Admin.timeScale}</b></span><input type="range" min="0.1" max="2" step="0.05" value="${Admin.timeScale}" data-sl="ts"></label>
      <div class="grid"><button data-a="civ">Passant spawnen</button><button data-a="cop">Polizist spawnen</button><button data-a="gang">Gangster spawnen</button><button data-a="explode">Explosion vor mir</button><button data-a="clearn">NPCs entfernen</button></div>
      <h3>Missionen</h3><div class="grid">${Missions.defs.map(d => `<button data-m="${d.id}">M${d.id}: ${d.title}</button>`).join('')}<button data-a="mdone">Aktive abschließen</button><button data-a="mabort">Abbrechen</button></div>
      <h3>Grafik & Debug</h3><div class="grid">${Object.entries(CFG.QUALITY).map(([k, q]) => `<button data-q="${k}" class="${Settings.quality === k ? 'on' : ''}">${q.label}</button>`).join('')}${tg('showFps', 'FPS-Anzeige')}<button data-a="touch">Touch-Steuerung ${Settings.touch ? 'AUS' : 'AN'}</button></div>
      <p style="margin-top:10px;color:#aaa">Position: ${P.pos.x.toFixed(0)}, ${P.pos.y.toFixed(0)}, ${P.pos.z.toFixed(0)} · Taste <b>F2</b> / <b>^</b> schließt</p>`;
    el.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return; Audio.click(); const d = b.dataset, c = Player.active;
      if (d.tg) { Admin[d.tg] = !Admin[d.tg]; if (d.tg === 'noWanted' && Admin.noWanted) Wanted.clear(true); this.build(); return; }
      if (d.w) { Admin.noWanted = false; if (+d.w === 0) Wanted.clear(true); else { Wanted.heat = +d.w - 0.5; Wanted.level = 0; Wanted.set(+d.w); } this.build(); return; }
      if (d.tp) { const l = locs[+d.tp]; Player.teleport(l[1], l[2]); this.toggle(false); return; }
      if (d.sp) { this.spawnVeh(d.sp); return; }
      if (d.we) { Env.setWeather(+d.we); return; }
      if (d.m) { Missions.start(+d.m); this.toggle(false); return; }
      if (d.q) { Settings.quality = d.q; saveSettings(); Game.applyQuality(); UI.syncOptions(); this.build(); return; }
      const fwd = tmpV3.set(Math.sin(Cam.yaw + Math.PI), 0, Math.cos(Cam.yaw + Math.PI)), front = Player.targetPos().clone().addScaledVector(fwd, 10);
      switch (d.a) {
        case 'close': this.toggle(false); break;
        case 'heal': c.health = 100; c.armor = 100; break;
        case 'money': GS.addMoney(100000); break;
        case 'ammo': c.weapons.forEach((s, i) => { const w = CFG.WEAPONS[i]; if (w.reserve) { s.reserve = w.reserve * 2; s.clip = w.clip; } }); break;
        case 'switch': this.toggle(false); Wanted.clear(true); Cam.startSwitch(); break;
        case 'tpwp': if (Missions.waypoint) { Player.teleport(Missions.waypoint.x, Missions.waypoint.z); this.toggle(false); } else UI.notify('Kein Wegpunkt gesetzt'); break;
        case 'map': this.toggle(false); BigMap.tp = true; $('mapTp').textContent = 'Teleport-Modus: AN'; BigMap.open(); break;
        case 'repair': if (c.vehicle) { c.vehicle.repair(); c.vehicle.resetUpright(); } break;
        case 'flip': if (c.vehicle) c.vehicle.resetUpright(); break;
        case 'boom': for (const v of VS.list) if (v !== c.vehicle && v.pos.distanceTo(Player.targetPos()) < 60) v.explode(false); break;
        case 'clearv': for (const v of [...VS.list]) if (v !== c.vehicle && !v.persistent && !v.mission && !(v.driver instanceof Character)) VS.remove(v); break;
        case 'civ': case 'cop': case 'gang': { const n = NPCS.spawn(d.a, front.x, front.z, d.a === 'gang' ? {} : {}); if (d.a === 'gang') n.alerted = true; break; }
        case 'explode': doExplosion(front.setY(groundHeight(front.x, front.z) + 0.5), false, null); break;
        case 'clearn': for (const n of [...NPCS.list]) if (!n.missionTarget) NPCS.remove(n); break;
        case 'mdone': if (Missions.active) Missions.complete(); break;
        case 'mabort': if (Missions.active) Missions.fail('Abgebrochen', true); break;
        case 'touch': Settings.touch = !Settings.touch; saveSettings(); $('touch').classList.toggle('on', Settings.touch); this.build(); break;
      }
    };
    el.oninput = (e) => { const s = e.target.dataset.sl; if (!s) return; const v = +e.target.value;
      if (s === 'time') { Env.time = v; Env.envKey = ''; $('adTime').textContent = Env.clockStr(); } if (s === 'traffic') { Admin.trafficMul = v; $('adTr').textContent = v; } if (s === 'peds') { Admin.pedMul = v; $('adPd').textContent = v; } if (s === 'ts') { Admin.timeScale = v; $('adTs').textContent = v; } };
  },
};

// ---------- SPIELSTEUERUNG & HAUPTSCHLEIFE ----------
const Game = {
  overT: 0, pausedFrom: null, pausedAt: 0, errors: 0,
  start() {
    Audio.init(); Audio.applyVolume(); $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); $('touch').classList.toggle('on', !!Settings.touch);
    if (!GS.started) { GS.started = true; if (Save.has() && Save.load()) setTimeout(() => UI.notify('💾 Spielstand geladen'), 3600); Cam.yaw = Player.active.yaw + Math.PI; Cam.snap = true; UI.bigText('SOLARA ISLAND', 'Kai & Elena · Vice Legacy', 'title', 3.5);
      UI.help(`Willkommen auf Solara Island!<br>${Settings.touch ? 'Linker Stick: laufen · rechts wischen: Kamera · <b>EIN/AUS</b>: Fahrzeug' : '<kbd>WASD</kbd> laufen · <kbd>F</kbd> Fahrzeug · <kbd>E</kbd> Interaktion · <kbd>U</kbd> Handy · <kbd>TAB</kbd> Figur · <kbd>K</kbd> Karte'}<br>Story-Missionen <b>M1–M7</b>, Shops, Jobs, Zeitrennen ⏱, Stuntsprünge und 30 goldene Muscheln warten. Das <b>HANDY</b> liefert deine Fahrzeuge.`, 12); Audio.setStation(1); }
    GS.set(Missions.active ? STATES.MISSION_ACTIVE : STATES.PLAYING); Cam.snap = true; In.lock(); renderer.domElement.focus();
  },
  pause() { if (!GS.playing) return; this.pausedFrom = GS.state; GS.set(STATES.PAUSED); this.pausedAt = performance.now(); $('pause').classList.remove('hidden'); UI.syncOptions(); In.unlock(); Audio.setHorn(false); },
  resume() { $('pause').classList.add('hidden'); $('missionMenu').classList.add('hidden'); if (GS.state !== STATES.PAUSED) return; GS.set(Missions.active ? STATES.MISSION_ACTIVE : STATES.PLAYING); In.lock(); },
  openMissions() { if (GS.playing) { this.pausedFrom = GS.state; GS.set(STATES.PAUSED); this.pausedAt = performance.now(); } else if (GS.state !== STATES.PAUSED) return; $('pause').classList.add('hidden'); UI.buildMissionList(); $('missionMenu').classList.remove('hidden'); In.unlock(); },
  mainMenu() { $('pause').classList.add('hidden'); $('missionMenu').classList.add('hidden'); $('hud').classList.add('hidden'); $('touch').classList.remove('on'); GS.set(STATES.MENU); $('menu').classList.remove('hidden'); UI.syncOptions(); },
  toggleSound() { Settings.sound = !Settings.sound; saveSettings(); Audio.init(); Audio.applyVolume(); UI.syncOptions(); UI.notify(Settings.sound ? '🔊 Ton an' : '🔇 Ton aus'); },
  applyQuality() {
    const q = Q(); renderer.setPixelRatio(q.pr); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = q.shadows; Env.applyQuality();
    if (Env.sun.shadow.map) { Env.sun.shadow.map.dispose(); Env.sun.shadow.map = null; } Env.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
    Post.init(); FX.applyQuality(); UI.notify(`Grafik: ${q.label}`);
  },
  wasted() { if (!GS.playing) return; GS.set(STATES.WASTED); GS.timeScale = 0.3; this.overT = 4.5; $('gameRoot').classList.add('gray'); UI.bigText('WASTED', '', 'wasted', 4.3); Audio.wasted(); Audio.setHorn(false); if (Missions.active) Missions.fail('', true); },
  busted() { if (!GS.playing) return; GS.set(STATES.BUSTED); GS.timeScale = 0.4; this.overT = 4; $('gameRoot').classList.add('gray'); const fine = Math.min(GS.money, Math.max(200, Math.round(GS.money * 0.1))); GS.addMoney(-fine); UI.bigText('BUSTED', `Kaution: -$${fine.toLocaleString('de-DE')}`, 'busted', 3.8); Audio.wasted(); Audio.setHorn(false); if (Missions.active) Missions.fail('', true); },
  respawn() {
    const wasWasted = GS.state === STATES.WASTED; $('gameRoot').classList.remove('gray'); GS.timeScale = 1;
    if (wasWasted) { const fee = Math.min(GS.money, 500); GS.addMoney(-fee); UI.notify(`🏥 Krankenhausrechnung: -$${fee}`); }
    Player.respawn(wasWasted ? LOC.hospital : LOC.police); Wanted.clear(true); for (const n of [...NPCS.list]) if (n.kind === 'cop') NPCS.remove(n); GS.set(STATES.PLAYING);
  },
  update(realDt) {
    const dt = realDt * GS.timeScale * Admin.timeScale; GameTime += dt;
    if (GS.state !== STATES.MENU) {
      if (In.hit('Escape') || In.hit('KeyP')) { if (Menu.open) Menu.close(); else if (BigMap.isOpen) BigMap.close(); else if (Admin.open) AdminUI.toggle(false); else if (GS.playing) this.pause(); else if (GS.state === STATES.PAUSED && performance.now() - this.pausedAt > 250) this.resume(); }
      if (In.hit('KeyN')) this.toggleSound();
      if (In.hit('F2')) AdminUI.toggle();
      if (In.hit('KeyK')) { if (BigMap.isOpen) BigMap.close(); else BigMap.open(); }
      if (In.hit('KeyM')) { if (GS.playing) this.openMissions(); else if (!$('missionMenu').classList.contains('hidden')) this.resume(); }
      if (GS.playing && !GS.switching && !Admin.open) { if (In.hit('Tab')) Cam.startSwitch(); if (In.hit('KeyT')) Env.nextTime(); if (In.hit('KeyG')) Env.nextWeather(); }
    }
    if (GS.state === STATES.WASTED || GS.state === STATES.BUSTED) { this.overT -= realDt; if (this.overT <= 0) this.respawn(); }
    const menu = GS.state === STATES.MENU, paused = GS.state === STATES.PAUSED || BigMap.isOpen; const focus = menu ? tmpFocus.set(DOWNTOWN.x, 5, DOWNTOWN.z) : Player.targetPos();
    if (!paused) {
      // Simulation in festen Teilschritten (max. 1/45 s): auch bei niedriger Bildrate Echtzeit & stabile Physik
      const steps = Math.min(4, Math.max(1, Math.ceil(dt * 45))), sdt = dt / steps;
      for (let k = 0; k < steps; k++) { Player.update(sdt); VS.update(sdt, focus); NPCS.update(sdt, focus); Missiles.update(sdt); if (k === 0) { In.pressed.clear(); In.lmbPressed = false; In.wheel = 0; } }
      if (GS.playing) { Wanted.update(dt); Missions.update(dt); Act.update(dt); }
      Pickups.update(dt); FX.update(dt); Env.update(dt, focus); for (const f of World.anim) f(dt); World.updateLOD(camera.position); Signals.update(dt); FX.pool.update(dt, focus, Env.night);
      if (menu) { const a = GameTime * 0.03; camera.up.set(0, 1, 0); camera.position.set(DOWNTOWN.x + Math.cos(a) * 420, 170, DOWNTOWN.z + Math.sin(a) * 420); camera.lookAt(DOWNTOWN.x, 40, DOWNTOWN.z); Cam.setFov(60); }
      else Cam.update(realDt);
    }
    const pv = Player.vehicle;
    if (pv && !pv.dead && Env.night > 0.3 && !menu && pv.cls !== 'heli') { const s = Math.sin(pv.yaw), c = Math.cos(pv.yaw); FX.head.position.set(pv.pos.x + s * pv.halfL, pv.pos.y + 0.9, pv.pos.z + c * pv.halfL); FX.head.target.position.set(pv.pos.x + s * 25, pv.pos.y - 1, pv.pos.z + c * 25); FX.head.intensity = 150 * Env.night; } else FX.head.intensity = 0;
    if (Audio.ready) {
      const live = !menu && !paused;
      if (pv && live) { if (pv.cls === 'car') { const sp = pv.rpm / pv.spec.redline; Audio.updateEngine(!pv.dead, clamp(sp, 0, 1.1), pv.input.throttle || 0, pv.isBike ? 'bike' : pv.type); } else if (pv.boat) Audio.updateEngine(!pv.dead, Math.abs(pv.vF) / 25, pv.input.throttle || 0, 'boat'); else Audio.updateEngine(false, 0, 0, 'car'); Audio.updateAir(pv.air && !pv.dead ? pv.cls === 'heli' ? 'heli' : pv.spec.prop ? 'prop' : 'jet' : null, pv.cls === 'heli' ? pv.rotorSpin : pv.thr, pv.boosting); }
      else { Audio.updateEngine(false, 0, 0, 'car'); Audio.updateAir(null, 0, false); }
      let sv = 0; if (live) for (const v of VS.list) if (v.sirenOn && !v.dead) { const d = camera.position.distanceTo(v.pos); sv = Math.max(sv, v === pv ? 0.6 : 1 / (1 + d * 0.035)); }
      Audio.updateSiren(sv, GameTime);
      const shore = clamp(1 - Math.abs(terrainHeight(focus.x, focus.z)) / 6, 0, 1); Audio.updateAmbient(GameTime, { wind: Env.w.wind * (live ? 1 : 0.5) + (pv && pv.air ? 1.5 : 0), waves: shore, rain: Env.w.rain, city: live && ['downtown', 'strip'].includes(zoneAt(focus.x, focus.z)) ? 0.8 : 0.3 });
      Audio.updateRadio(!!pv && live && !pv.air);
    }
    if (GS.state !== STATES.MENU) UI.update(realDt);
  },
};
const tmpFocus = V3();
// Leistungs-Regler: misst die Bildrate und passt die Renderauflösung automatisch an (Ziel ≥ 30 FPS)
const Perf = { acc: 0, n: 0, fps: 60, scale: 1, cool: 4, worst: 0,
  tick(dt) { this.acc += dt; this.n++; this.cool -= dt; if (this.acc < 1.5) return; this.fps = this.n / this.acc; this.acc = 0; this.n = 0;
    if (this.cool > 0 || GS.state === STATES.MENU || !Settings.autoRes) return;
    let s = this.scale; if (this.fps < 27 && s > 0.55) s -= this.fps < 18 ? 0.15 : 0.08; else if (this.fps > 52 && s < 1) s += 0.05;
    s = clamp(+s.toFixed(2), 0.55, 1); if (s !== this.scale) { this.scale = s; renderer.setPixelRatio(Q().pr * s); renderer.setSize(innerWidth, innerHeight); Post.resize(); this.cool = 3; } } };
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.max(0, (now - (frame.last || now)) / 1000), realDt = Math.min(0.1, rawDt); frame.last = now; Perf.tick(Math.min(rawDt, 0.5));
  try { Game.update(realDt); Post.render(); }
  catch (e) { Game.errors++; if (Game.errors < 6) console.error(e); window.__diag('Laufzeitfehler: ' + (e && e.message)); }
  In.endFrame();
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); Post.resize(); });
bus.on('gunshot', ({ pos, byPlayer }) => { NPCS.panicAround(pos, 40, pos); VS.panicAround(pos, 40); for (const n of NPCS.list) if (n.kind === 'gang' && n.alive && n.pos.distanceTo(pos) < 60) n.alerted = true; if (byPlayer) Wanted.crime('shots', pos); });
bus.on('lock', (locked) => { if (!locked && GS.playing && !In.lockFailed && !Admin.open && !BigMap.isOpen && !Menu.open && performance.now() - (Game.lockAt || 0) > 300) Game.pause(); if (locked) Game.lockAt = performance.now(); });

// ---------- START ----------
let Env, VS, NPCS;
window.__startGame = async function () {
  const t0 = performance.now();
  await Assets.load((f, t) => { window.__loadBar(0.1 + f * 0.6); window.__loadMsg(t); });
  PeopleLib.init(); window.__loadMsg('Erschaffe Solara Island …'); window.__loadBar(0.75); await new Promise(r => setTimeout(r, 20));
  buildWorld(); console.log('Welt gebaut in', Math.round(performance.now() - t0), 'ms');
  Env = new Environment(); Post.init(); FX.init();
  VS = new VehicleSystem(); NPCS = new NPCSystem();
  Player.init(); Pickups.init(); Missions.init(); Act.init(); UI.init(); BigMap.init(); In.initTouch();
  VS.spawnParked();
  for (const ch of Player.chars) { ch.h.group.position.copy(ch.pos); ch.h.group.rotation.y = ch.yaw; }
  window.__loadMsg('Bereite Shader vor …'); window.__loadBar(0.9); await new Promise(r => setTimeout(r, 20));
  Env.update(0.016, tmpFocus.set(DOWNTOWN.x, 5, DOWNTOWN.z)); renderer.compile(scene, camera);
  window.__booted = true; window.__loadBar(1);
  $('loading').style.display = 'none'; $('menu').classList.remove('hidden');
  requestAnimationFrame(frame);
  window.__game = { Post, FX, MAT, GS, Player, VS, NPCS, Wanted, Missions, Env, Cam, Game, In, Audio, World, STATES, renderer, scene, camera, Admin, AdminUI, BigMap, LOC, Roads, CFG, Missiles, Assets, Act, Save, Menu, Signals, Ramps };
};
