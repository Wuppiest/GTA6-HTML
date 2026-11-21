// =====================================================================
//  KOMFORT & KLEINE DETAILS
//  Waffen-/Emote-Rad, Ego-Perspektive, Blinker/Warnblinker/Licht/Tempomat,
//  Ein-/Aussteige-Animationen, Leerlauf-Gesten, Fotomodus, Karten-Symbole,
//  Lagerfeuer, Glühwürmchen, Sternschnuppen, Delfine, Kondensstreifen, Dampf …
// =====================================================================
{ const i = CONTROLS.findIndex(c => c[0] === 'TAB'); if (i >= 0) CONTROLS[i] = ['Z', 'Kai ⇄ Elena'];
  const j = CONTROLS.findIndex(c => c[0].startsWith('1 – 4')); if (j >= 0) CONTROLS[j] = ['TAB halten / 1 – 4 / Mausrad', 'Waffenrad (Zeitlupe) / Waffe wechseln'];
  CONTROLS.push(['V', 'Ego-Perspektive an/aus'], ['Q / X (im Auto)', 'Blinker links / rechts'], ['B (im Auto)', 'Warnblinker'], ['L (im Auto)', 'Licht: Auto → An → Fernlicht → Aus'], ['J (im Auto)', 'Tempomat'],
    ['B halten (zu Fuß)', 'Emote-Rad: Winken, Tanzen, Jubeln …'], ['O', 'Fotomodus (freie Kamera, Filter)']); }

const Feat = { fp: false, fy: 0, fpp: 0, fpIdle: 0, idleT: 0, idleAct: false, tickT: 0, prevSpd: 0, smokeT: 0, bfT: 0 };

// ---------- RADIALMENÜ (Waffen & Emotes) ----------
const EMOTES = [['wave', '👋', 'Winken'], ['hello', '🙋', 'Hallo'], ['dance', '💃', 'Tanzen'], ['cheer', '🙌', 'Jubeln'], ['clap', '👏', 'Klatschen'], ['point', '👉', 'Zeigen'], ['shrug', '🤷', 'Achselzucken'],
  ['facepalm', '🤦', 'Facepalm'], ['think', '🤔', 'Nachdenken'], ['stretch', '🙆', 'Strecken'], ['sitGround', '🧘', 'Hinsetzen'], ['pushup', '💪', 'Liegestütze'], ['salute', '🫡', 'Salutieren'], ['bow', '🙇', 'Verbeugen'], ['smoke', '🚬', 'Rauchen']];
const WICON = { fists: '👊', pistol: '🔫', smg: '⚡', shotgun: '💥', rifle: '🎯' };
const Radial = {
  el: null, open: false, kind: null, sel: -1, items: [], ax: 0, ay: 0, tap: false,
  build() {
    const st = document.createElement('style'); st.textContent = `
#radial{position:fixed;left:50%;top:50%;width:440px;height:440px;margin:-220px 0 0 -220px;border-radius:50%;background:radial-gradient(circle,rgba(10,14,22,.55) 0 30%,rgba(10,14,22,.82) 31% 70%,rgba(10,14,22,0) 71%);z-index:60;pointer-events:none;display:none;font-family:Arial,sans-serif}
#radial.show{display:block} #radial.tap{pointer-events:auto}
#radial .ri{position:absolute;width:92px;height:72px;margin:-36px 0 0 -46px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#dfe6f0;font-size:11px;text-align:center;transition:transform .08s,background .08s;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.12)}
#radial .ri b{font-size:28px;line-height:32px} #radial .ri.on{background:rgba(255,210,58,.9);color:#111;transform:scale(1.14);border-color:#fff}
#radial .rc{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#fff;text-align:center;font-weight:bold;font-size:16px;text-shadow:0 2px 4px #000;width:150px}
#radial .rc small{display:block;font-weight:normal;font-size:12px;opacity:.8;margin-top:4px}
body.photo #hud,body.photo #touch,body.photo #notify{display:none!important}
#photoHint{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);color:#fff;background:rgba(0,0,0,.55);padding:8px 14px;border-radius:10px;font:13px Arial;z-index:61;display:none}
body.photo #photoHint{display:block}`; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'radial'; document.body.appendChild(this.el);
    const ph = document.createElement('div'); ph.id = 'photoHint'; ph.innerHTML = '📷 <b>Fotomodus</b> · WASD + Maus bewegen · Shift schnell · Q/E runter/hoch · Mausrad Zoom · F Filter · O beenden'; document.body.appendChild(ph);
  },
  show(kind, tap = false) {
    if (!this.el) this.build(); const c = Player.active; this.kind = kind; this.open = true; this.tap = tap; this.ax = this.ay = 0;
    if (kind === 'weapon') { this.items = CFG.WEAPONS.map((w, i) => ({ i, ic: WICON[w.id] || '•', name: w.name, sub: w.melee ? '' : `${c.weapons[i].clip} / ${c.weapons[i].reserve}` })); this.sel = c.cur; }
    else { this.items = EMOTES.map(([k, ic, name], i) => ({ i, k, ic, name, sub: '' })); this.sel = -1; }
    const n = this.items.length, R = kind === 'weapon' ? 150 : 165;
    this.el.innerHTML = this.items.map((it, i) => { const a = -Math.PI / 2 + i / n * Math.PI * 2; return `<div class="ri" data-i="${i}" style="left:${220 + Math.cos(a) * R}px;top:${220 + Math.sin(a) * R}px"><b>${it.ic}</b>${it.name}${it.sub ? '<br>' + it.sub : ''}</div>`; }).join('') + '<div class="rc" id="rcText"></div>';
    for (const d of this.el.querySelectorAll('.ri')) { const pick = (e) => { e.preventDefault(); e.stopPropagation(); this.sel = +d.dataset.i; this.close(true); }; d.addEventListener('click', pick); d.addEventListener('touchend', pick, { passive: false }); }
    this.el.className = 'show' + (tap ? ' tap' : ''); this.paint(); if (GS.timeScale === 1) { GS.timeScale = 0.3; this.slow = true; } Audio.click(520);
  },
  paint() { this.el.querySelectorAll('.ri').forEach((d, i) => d.classList.toggle('on', i === this.sel)); const it = this.items[this.sel]; const t = $('rcText'); if (t) t.innerHTML = it ? `${it.name}${it.sub ? '<small>' + it.sub + '</small>' : ''}` : (this.kind === 'weapon' ? 'Waffe wählen' : 'Geste wählen<small>Maus bewegen</small>'); },
  update() { if (!this.open || this.tap) return; this.ax += In.mdx; this.ay += In.mdy; In.mdx = In.mdy = 0; const L = Math.hypot(this.ax, this.ay); if (L > 140) { this.ax *= 140 / L; this.ay *= 140 / L; }
    if (L > 28) { const n = this.items.length, a = Math.atan2(this.ay, this.ax) + Math.PI / 2, s = ((Math.round(a / (Math.PI * 2) * n) % n) + n) % n; if (s !== this.sel) { this.sel = s; this.paint(); Audio.click(980); } } },
  close(apply = true) { if (!this.open) return; this.open = false; this.el.className = ''; if (this.slow) { GS.timeScale = 1; this.slow = false; } if (!apply || this.sel < 0) return; const c = Player.active;
    if (this.kind === 'weapon') { if (!c.vehicle || !CFG.WEAPONS[this.sel].melee) Player.selectWeapon(this.sel); } else if (!c.vehicle) { c.act = this.items[this.sel].k; c.actT = 0; Feat.onEmote(c.act); } },
  toggle(kind) { if (this.open) { this.close(true); return; } if (!GS.playing || (kind === 'emote' && Player.active.vehicle)) return; this.show(kind, true); },
};

// ---------- EIN-/AUSSTEIGEN MIT ANIMATION ----------
function doorLocal(v) { const s = v.m.seat, side = v.isBike ? 1 : s.x >= 0 ? 1 : -1; return V3(side * (v.isBike ? 0.75 : v.halfW + 0.55), v.boat ? s.y : 0, v.isBike ? s.z : s.z); }
function doorWorld(v) { const L = doorLocal(v), c = Math.cos(v.yaw), s = Math.sin(v.yaw); return V3(v.pos.x + L.x * c + L.z * s, v.pos.y, v.pos.z - L.x * s + L.z * c); }
const EnterAnim = { pend: null };
const _tryEnter = Player.tryEnter.bind(Player), _exitVehicle = Player.exitVehicle.bind(Player), _updOnFoot = Player.updateOnFoot.bind(Player), _updDriving = Player.updateDriving.bind(Player), _pUpdate = Player.update.bind(Player);
Player.tryEnter = function (c) {
  if (c.vehicle) return false; c.act = null; let best = null, bd = 1e9;
  for (const v of VS.list) { if (v.dead || v.sinking || v.driver instanceof Character || v.policeHeli || v.amb) continue; const reach = v.air ? v.halfL * 0.5 + 3 : v.boat ? v.halfL * 0.6 + 3 : 3.2;
    const d = Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z) - v.halfL * 0.45; if (d < reach && d < bd && Math.abs(v.pos.y - c.pos.y) < 4) { bd = d; best = v; } }
  if (best && best.cls === 'car' && !EnterAnim.pend && GS.playing) { const d = doorWorld(best); if (Math.hypot(d.x - c.pos.x, d.z - c.pos.z) > 0.9) { EnterAnim.pend = { v: best, t: 0, p0: best.pos.clone() }; return true; } }
  const keep = VS.list; if (best) VS.list = [best]; let ok; try { ok = _tryEnter(c); } finally { VS.list = keep; } if (ok && c.vehicle) { const v = c.vehicle, from = doorLocal(v); if (v.cls === 'car' || v.boat || (v.air && v.onGround)) v.occAnim = { t: 0, dur: v.isBike ? 0.45 : v.cls === 'car' ? 0.85 : 0.6, from, sit: false, act: 'climb' }; Feat.fpIdle = 0; }
  return ok;
};
Player.exitVehicle = function (forced = false) {
  const c = this.active, v = c.vehicle; if (!v) return;
  if (forced || v.occAnim || v.speed > 2.5 || (v.air && !v.onGround) || !GS.playing) { if (v.occAnim && !v.occAnim.exit) v.occAnim = null; if (forced || !v.occAnim) { v.occAnim = null; _exitVehicle(forced); } return; }
  v.occAnim = { t: 0, dur: v.isBike ? 0.4 : 0.6, from: v.m.seat.clone(), to: doorLocal(v), exit: true, sit: true, act: null };
};
function stepOccAnim(c, v, dt) {
  const A = v.occAnim, o = v.occupant; A.t += dt; const k = Math.min(1, A.t / A.dur);
  if (o) { if (A.exit) { o.group.position.lerpVectors(A.from, A.to, smooth(clamp((k - 0.2) / 0.8, 0, 1))); A.sit = k < 0.35; A.act = k < 0.35 ? null : 'climb'; }
    else { o.group.position.lerpVectors(A.from, v.m.seat, smooth(clamp((k - 0.15) / 0.85, 0, 1))); A.sit = k > 0.55; A.act = k > 0.55 ? null : 'climb'; } }
  v.input = v.air ? NOINPUT : PARKINPUT;
  if (k >= 1) { v.occAnim = null; if (o) o.group.position.copy(v.m.seat); if (A.exit) _exitVehicle(false); }
}
Player.updateDriving = function (c, dt) {
  const v = c.vehicle; EnterAnim.pend = null; if (v.occAnim) { stepOccAnim(c, v, dt); return; }
  _updDriving(c, dt); if (c.vehicle !== v) return; Feat.driving(c, v, dt);
};
Player.updateOnFoot = function (c, dt) {
  const P = EnterAnim.pend;
  if (P) { const v = P.v, d = doorWorld(v), dx = d.x - c.pos.x, dz = d.z - c.pos.z, L = Math.hypot(dx, dz); P.t += dt;
    if (c.vehicle || v.dead || v.removed || P.t > 2.2 || v.pos.distanceTo(P.p0) > 4 || In.ax || In.ay || c.swim) { EnterAnim.pend = null; }
    else if (L < 0.45) { EnterAnim.pend = null; c.yaw = v.yaw; const keep = VS.list; VS.list = [v]; try { Player.tryEnter(c); } finally { VS.list = keep; } return; }
    else { const sp = Math.min(4.6, L / dt); c.yaw = turnToward(c.yaw, Math.atan2(dx, dz), dt * 14); c.pos.x += dx / L * sp * dt; c.pos.z += dz / L * sp * dt; c.pos.y = walkHeight(c.pos.x, c.pos.z, c.pos.y + 1);
      collideCircle(c.pos, 0.3, c.pos.y, 1.8); c.h.group.position.copy(c.pos); c.h.group.rotation.y = c.yaw; c.h.animate(dt, { speed: 4.2 }); return; } }
  if (c.act && (In.ax || In.ay || In.lmb || In.rmb || In.hit('Space') || c.swim || !c.onGround)) { c.act = null; Feat.idleAct = false; }
  _updOnFoot(c, dt); Feat.onFoot(c, dt);
};
Player.update = function (dt) {
  if (Photo.on) { if (In.hit('KeyO')) Photo.toggle(); else { if (In.hit('KeyF')) { Photo.filter = (Photo.filter + 1) % Photo.FILTERS.length; renderer.domElement.style.filter = Photo.FILTERS[Photo.filter]; } if (In.wheel) Photo.fov = clamp(Photo.fov + In.wheel * 3, 15, 100); } return; }
  const c = this.active;
  if (GS.playing && !GS.switching && !Admin.open && !Menu.open) {
    if (!Radial.open && In.hit('Tab')) Radial.show('weapon'); else if (Radial.open && Radial.kind === 'weapon' && !Radial.tap && !In.is('Tab')) Radial.close(true);
    if (!c.vehicle && !Radial.open && In.hit('KeyB')) Radial.show('emote'); else if (Radial.open && Radial.kind === 'emote' && !Radial.tap && !In.is('KeyB')) Radial.close(true);
    Radial.update(); if (Radial.open) { In.lmb = false; In.lmbPressed = false; }
    if (In.hit('KeyV')) { Feat.fp = !Feat.fp; UI.notify(Feat.fp ? '👁 Ego-Perspektive' : '🎥 Verfolgerkamera'); }
    if (In.hit('KeyO')) Photo.toggle();
  } else if (Radial.open) Radial.close(false);
  _pUpdate(dt);
};

// ---------- FAHRZEUG-KOMFORT ----------
Feat.driving = function (c, v, dt) {
  const inp = v.input;
  if (v.cls === 'car' && !v.dead) {
    if (In.hit('KeyQ')) { v.blink = v.blink === -1 ? 0 : -1; v.blinkYaw = v.yaw; Audio.click(1400); }
    if (In.hit('KeyX')) { v.blink = v.blink === 1 ? 0 : 1; v.blinkYaw = v.yaw; Audio.click(1400); }
    if (In.hit('KeyB')) { v.blink = v.blink === 2 ? 0 : 2; Audio.click(1200); UI.notify(v.blink === 2 ? '⚠ Warnblinker an' : 'Warnblinker aus', 1.5); }
    if ((v.blink === 1 || v.blink === -1) && Math.abs(wrapAngle(v.yaw - (v.blinkYaw ?? v.yaw))) > 0.9 && Math.abs(v.steer) < 0.12) v.blink = 0;
    if (v.blink) { const ph = Math.floor(GameTime * 3) % 2; if (ph !== this.tickPh) { this.tickPh = ph; Audio.click(ph ? 1500 : 1100); } }
    if (In.hit('KeyL')) { v.lightMode = ((v.lightMode || 0) + 1) % 4; UI.notify('💡 Licht: ' + ['Automatik', 'An', 'Fernlicht', 'Aus'][v.lightMode], 1.6); Audio.click(800); }
    if (In.hit('KeyJ')) { v.cruise = v.cruise ? 0 : Math.max(v.vF, 5); UI.notify(v.cruise ? `🛞 Tempomat ${Math.round(v.cruise * 3.6)} km/h` : 'Tempomat aus', 1.6); }
    if (v.cruise) { if (inp.brake > 0 || inp.handbrake) { v.cruise = 0; UI.notify('Tempomat aus', 1.2); } else if (inp.throttle < 0.05) inp.throttle = clamp((v.cruise - v.vF) * 0.35 + 0.15, 0, 1); }
    // Fehlzündungen bei Sportwagen & Motorrädern, Abgaswolken im Stand
    const sport = /sport|muscle|bike|sportsedan/.test(v.type); this.bfT -= dt;
    if (sport && this.lastThr > 0.6 && inp.throttle < 0.1 && v.rpm > v.spec.redline * 0.62 && this.bfT <= 0) { this.bfT = 0.35; for (let k = 0; k < 2; k++) { const p = tmpV2.set(v.pos.x - Math.sin(v.yaw) * (v.halfL + 0.2), v.pos.y + 0.45, v.pos.z - Math.cos(v.yaw) * (v.halfL + 0.2)); FX.fire(p, 2, 0.25); } Audio.impact(4, 0); }
    this.lastThr = inp.throttle; this.smokeT -= dt;
    if (v.hspeed < 2 && this.smokeT <= 0) { this.smokeT = 0.5; FX.smoke(tmpV2.set(v.pos.x - Math.sin(v.yaw) * (v.halfL + 0.1), v.pos.y + 0.35, v.pos.z - Math.cos(v.yaw) * (v.halfL + 0.1)), 1, true, 0.4); }
    // Sturz vom Motorrad bei hartem Aufprall
    const sp = v.hspeed; if (v.isBike && this.prevSpd > 13 && this.prevSpd - sp > 8 && !Admin.god) { const pv = this.prevSpd, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); Player.exitVehicle(true); c.pos.y += 1.2; c.vel.set(fx * pv * 0.55, 6, fz * pv * 0.55); c.onGround = false; c.downT = 2.2; c.damage(8 + pv * 0.8);
      UI.notify('💥 Vom Motorrad geschleudert!'); Cam.shake = 0.8; this.prevSpd = 0; return; }
    this.prevSpd = sp;
  } else this.prevSpd = 0;
};

// ---------- ZU FUSS: Leerlauf-Gesten, Reaktionen der Passanten ----------
Feat.onFoot = function (c, dt) {
  const busy = In.ax || In.ay || In.lmb || In.rmb || In.mdx || In.mdy || c.aiming || !c.onGround || c.swim || c.crouch;
  if (busy || Wanted.level) { this.idleT = 0; if (this.idleAct) { c.act = null; this.idleAct = false; } }
  else { this.idleT += dt; if (!c.act && this.idleT > 12) { c.act = pick(['watch', 'stretch', 'shrug', 'think', 'watch']); this.idleAct = true; this.idleT = 12 - rand(4, 7); setTimeout(() => { if (this.idleAct) { c.act = null; this.idleAct = false; } }, 3800); } }
};
Feat.onEmote = function (a) { const c = Player.active; this.idleAct = false;
  for (const n of NPCS.list) { if (!n.alive || n.kind !== 'civ' || n.pos.distanceTo(c.pos) > 16) continue;
    if ((a === 'wave' || a === 'hello' || a === 'salute') && Math.random() < 0.75) n.waveT = rand(1.8, 3);
    else if ((a === 'dance' || a === 'cheer' || a === 'clap') && (n.state === 'walk' || n.state === 'idle') && Math.random() < 0.5) { n.state = 'cheer'; n.stateT = rand(2.5, 5); n.yaw = Math.atan2(c.pos.x - n.pos.x, c.pos.z - n.pos.z); }
    else if (a === 'point' && Math.random() < 0.3) n.waveT = 1.5; } };

// ---------- EGO-PERSPEKTIVE ----------
const _camUpdate = Cam.update.bind(Cam);
Cam.update = function (dt) {
  if (Photo.on) { Photo.update(dt); return; }
  _camUpdate(dt); const c = Player.active, v = c.vehicle, fp = Feat.fp && !this.sw && GS.playing && !Cable.ride;
  c.h.group.visible = !(fp && !v); if (v && v.occupant) v.occupant.group.visible = !(fp && !v.occAnim);
  if (!fp) return;
  const sens = 0.0022 * Settings.sens;
  if (v) { if (In.mdx || In.mdy) { Feat.fy -= In.mdx * sens; Feat.fpp = clamp(Feat.fpp + In.mdy * sens, -0.9, 0.9); Feat.fpIdle = 0; } else { Feat.fpIdle += dt; if (Feat.fpIdle > 1.6) { Feat.fy = damp(Feat.fy, 0, 3, dt); Feat.fpp = damp(Feat.fpp, 0, 3, dt); } }
    Feat.fy = clamp(Feat.fy, -2.2, 2.2); v.group.updateMatrixWorld(true); const head = tmpV2.copy(v.m.seat).add(tmpV3.set(0, v.isBike ? 1.05 : v.air ? 0.95 : 0.9, v.isBike ? -0.05 : 0.05)); v.body.localToWorld(head);
    const dir = tmpV3.set(0, 0, 1).applyEuler(tmpE.set(-Feat.fpp, Feat.fy, 0, 'YXZ')).applyQuaternion(v.group.quaternion);
    camera.position.copy(head); camera.up.set(0, 1, 0); if (v.air) camera.up.applyQuaternion(v.group.quaternion); camera.lookAt(tmpV4.copy(head).add(dir)); this.setFov(damp(camera.fov, 72 + Math.min(14, v.hspeed * 0.15), 5, dt));
  } else { const h = c.swim ? 0.45 : c.crouch ? 1.15 : 1.64, f = tmpV3.set(-this.dir.x, 0, -this.dir.z).normalize(); camera.position.set(c.pos.x + f.x * 0.18, c.pos.y + h, c.pos.z + f.z * 0.18);
    camera.up.set(0, 1, 0); camera.lookAt(tmpV4.copy(camera.position).sub(this.dir)); this.setFov(damp(camera.fov, c.aiming ? 50 : 74, 8, dt)); }
};

// ---------- FOTOMODUS ----------
const Photo = { on: false, pos: V3(), yaw: 0, pitch: 0, fov: 60, filter: 0, FILTERS: ['', 'saturate(1.5) contrast(1.1)', 'grayscale(1) contrast(1.25)', 'sepia(0.7) contrast(1.05)', 'hue-rotate(-12deg) saturate(1.3) brightness(1.05)', 'contrast(1.35) saturate(0.7)'],
  toggle() { this.on = !this.on; document.body.classList.toggle('photo', this.on); if (!Radial.el) Radial.build();
    if (this.on) { this.pos.copy(camera.position); const d = camera.getWorldDirection(tmpV2); this.yaw = Math.atan2(d.x, d.z); this.pitch = Math.asin(clamp(d.y, -1, 1)); this.fov = camera.fov; this.ts = GS.timeScale || 1; GS.timeScale = 1e-4; }
    else { GS.timeScale = this.ts || 1; renderer.domElement.style.filter = ''; Cam.snap = true; } },
  update(dt) { const sens = 0.0022 * Settings.sens; this.yaw -= In.mdx * sens; this.pitch = clamp(this.pitch - In.mdy * sens, -1.5, 1.5);
    const sp = (In.is('ShiftLeft') ? 40 : 10) * dt, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); this.pos.x += (fx * In.ay - fz * In.ax) * sp; this.pos.z += (fz * In.ay + fx * In.ax) * sp; this.pos.y += ((In.is('KeyE') ? 1 : 0) - (In.is('KeyQ') ? 1 : 0)) * sp;
    const t = Player.targetPos(); const d = this.pos.distanceTo(t); if (d > 60) this.pos.sub(t).multiplyScalar(60 / d).add(t); this.pos.y = Math.max(this.pos.y, Math.max(terrainHeight(this.pos.x, this.pos.z), CFG.WATER_Y) + 0.3);
    camera.position.copy(this.pos); camera.up.set(0, 1, 0); camera.lookAt(tmpV2.set(this.pos.x + fx * Math.cos(this.pitch), this.pos.y + Math.sin(this.pitch), this.pos.z + fz * Math.cos(this.pitch))); if (Math.abs(camera.fov - this.fov) > 0.01) { camera.fov = this.fov; camera.updateProjectionMatrix(); } },
};

// ---------- KARTEN-SYMBOLE ----------
const _bmDraw = BigMap.draw.bind(BigMap);
BigMap.draw = function () { _bmDraw(); const cv = $('bigMapCanvas'), g = cv.getContext('2d'), S = cv.width, k = S / (2 * WS), T = (v) => (v + WS) * k;
  const all = BLIPS.concat((Act.places || []).filter(p => p.def && p.def.icon).map(p => [p.def.icon, p.def.color, p.p.x, p.p.z, p.def.name]));
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [ic, col, x, z, name] of all) { g.beginPath(); g.arc(T(x), T(z), 15, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); g.font = '17px Arial'; g.fillStyle = '#fff'; g.fillText(ic, T(x), T(z) + 1);
    g.font = 'bold 13px Arial'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(name, T(x), T(z) + 27); g.fillText(name, T(x), T(z) + 27); }
  // Legende
  g.textAlign = 'left'; g.font = 'bold 15px Arial'; g.fillStyle = 'rgba(10,14,22,.7)'; g.fillRect(12, S - 92, 330, 80); g.fillStyle = '#fff';
  g.fillText('✈ Flugzeuge: Flugplatz (frei) · Militärbasis (Fahndung)', 22, S - 70); g.fillText('🚁 Hubschrauber: Heliport, Flugplatz, Dächer', 22, S - 48); g.fillText('⚓ Boote: Marina, Strand, Hafen, Sumpf', 22, S - 26); g.textAlign = 'center'; };
const _drawMM = UI.drawMinimap.bind(UI);
UI.drawMinimap = function () { _drawMM(); const g = this.mm, S = 420, R = S / 2, c = Player.active, p = Player.targetPos(), v = c.vehicle;
  const zoom = v ? (v.air ? lerp(1.2, 0.35, clamp((p.y - terrainHeight(p.x, p.z)) / 400, 0, 1)) : lerp(2.2, 1.0, clamp(v.hspeed / 50, 0, 1))) : 3.0, cs = Math.cos(Cam.yaw), sn = Math.sin(Cam.yaw);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '13px Arial';
  for (const [ic, col, x, z] of BLIPS) { const dx = (x - p.x) * zoom, dy = (z - p.z) * zoom, rx = dx * cs - dy * sn, ry = dx * sn + dy * cs; if (Math.hypot(rx, ry) > R - 12) continue; g.beginPath(); g.arc(R + rx, R + ry, 11, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.fillText(ic, R + rx, R + ry + 1); } };

// ---------- UMGEBUNGSDETAILS ----------
const Ambient2 = {
  init() {
    // Glühwürmchen: Punkte mit eigener Blink-Phase (Shader), folgen der Kamera in Natur- und Sumpfgebieten
    const N = 140, pos = new Float32Array(N * 3), ph = new Float32Array(N); for (let i = 0; i < N; i++) { pos[i * 3] = rand(-35, 35); pos[i * 3 + 1] = rand(0.4, 3.5); pos[i * 3 + 2] = rand(-35, 35); ph[i] = rand(0, 6.28); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
    this.flyU = { uT: { value: 0 }, uA: { value: 0 } };
    this.flies = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.flyU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float ph; uniform float uT; varying float vA; void main(){ vec3 p = position + vec3(sin(uT*0.7+ph*3.0)*0.8, sin(uT*1.3+ph)*0.35, cos(uT*0.6+ph*2.0)*0.8); vA = pow(max(0.0, sin(uT*2.2+ph*5.0)), 3.0); vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = 90.0/ -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if (d>0.5) discard; gl_FragColor = vec4(0.75,1.0,0.35, (1.0-d*2.0)*vA*uA); }' }));
    this.flies.frustumCulled = false; this.flies.visible = false; scene.add(this.flies);
    // Sternschnuppe
    this.star = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 60), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); this.star.visible = false; scene.add(this.star); this.starT = 6;
    // Delfine (einfaches Low-Poly-Modell)
    const dg = mergeGeos([geoT(CG.sph(10), 0, 0, 0, 0, 0, 0, 0.55, 0.5, 2.3), geoT(CG.cone(6), 0, 0.35, -0.1, -0.5, 0, 0, 0.08, 0.45, 0.3), geoT(CG.box(), 0, 0, -1.25, 0, 0, 0, 0.9, 0.05, 0.3), geoT(CG.cone(6), 0, -0.02, 1.3, Math.PI / 2, 0, 0, 0.18, 0.45, 0.18)]);
    this.dolMat = lam({ color: 0x6a7c8c, flatShading: true }); this.dolphins = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(dg, this.dolMat); m.visible = false; scene.add(m); this.dolphins.push({ m, t: 9, dur: 1.4, a: V3(), b: V3() }); } this.dolT = 8;
    // Kondensstreifen
    this.trails = new Map(); this.trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false });
    // Dampf aus Gullys in der Innenstadt
    this.steam = []; for (const e of Roads.edges) { if (this.steam.length > 60) break; const m = e.pts[e.pts.length >> 1], z = zoneAt(m.x, m.z); if ((z === 'downtown' || z === 'midtown') && hash2(m.x, m.z) < 0.35) this.steam.push(V3(m.x, m.y + 0.1, m.z)); }
    this.fireT = 0; this.steamT = 0;
  },
  update(dt) {
    if (!this.flies) return; const cp = camera.position, t = GameTime, zone = zoneAt(cp.x, cp.z);
    // Glühwürmchen nachts in Natur, Sumpf, Parks
    const nat = zone === 'rural' || zone === 'swamp' || zone === 'mountain' || zone === 'suburb'; this.flyU.uT.value = t; this.flyU.uA.value = damp(this.flyU.uA.value, nat && Env.night > 0.55 && cp.y - terrainHeight(cp.x, cp.z) < 30 ? 1 : 0, 1, dt);
    this.flies.visible = this.flyU.uA.value > 0.02; if (this.flies.visible && this.flies.position.distanceTo(cp) > 25) this.flies.position.set(cp.x, Math.max(terrainHeight(cp.x, cp.z), 0), cp.z);
    // Sternschnuppen bei klarer Nacht
    this.starT -= dt; const S = this.star; if (S.visible) { S.userData.t += dt; const k = S.userData.t / 0.9; S.position.addScaledVector(S.userData.v, dt); S.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.9; if (k >= 1) S.visible = false; }
    else if (this.starT <= 0 && Env.night > 0.75 && Env.w.rain < 0.1 && Env.w.dark < 0.3) { this.starT = rand(7, 20); const a = rand(0, 6.28), v = V3(Math.cos(a + 1.6), -0.25, Math.sin(a + 1.6)).normalize().multiplyScalar(380); S.position.set(cp.x + Math.cos(a) * 900, cp.y + rand(380, 600), cp.z + Math.sin(a) * 900); S.lookAt(tmpV2.copy(S.position).add(v)); S.userData = { t: 0, v }; S.visible = true; }
    // Delfine springen vor der Küste
    this.dolT -= dt; if (this.dolT <= 0) { this.dolT = rand(8, 20); const P = Player.targetPos(); for (let tr = 0; tr < 8; tr++) { const a = rand(0, 6.28), d = rand(30, 75), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d; if (terrainHeight(x, z) > -5 || camera.position.distanceTo(tmpV2.set(x, 0, z)) > 120) continue;
        const dir = rand(0, 6.28), n = 1 + (Math.random() < 0.6 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0); for (let i = 0; i < n; i++) { const D = this.dolphins[i], ox = x + i * 3 * Math.cos(dir + 1.5), oz = z + i * 3 * Math.sin(dir + 1.5); D.a.set(ox, 0, oz); D.b.set(ox + Math.sin(dir) * 9, 0, oz + Math.cos(dir) * 9); D.t = -i * 0.35; D.dur = 1.3; D.m.visible = false; } break; } }
    for (const D of this.dolphins) { if (D.t > D.dur + 0.5) { D.m.visible = false; continue; } D.t += dt; if (D.t < 0) continue; const k = D.t / D.dur; if (k > 1) { D.m.visible = false; if (!D.splashed) { FX.splash(D.b, 8); D.splashed = true; } continue; }
      if (k < 0.05 && !D.started) { FX.splash(D.a, 6); D.started = true; } D.splashed = false; if (k > 0.5) D.started = false; D.m.visible = true; D.m.position.lerpVectors(D.a, D.b, k); D.m.position.y = CFG.WATER_Y - 0.6 + Math.sin(k * Math.PI) * 2.6; D.m.rotation.set(-Math.cos(k * Math.PI) * 0.9, Math.atan2(D.b.x - D.a.x, D.b.z - D.a.z), 0, 'YXZ'); }
    // Lagerfeuer: Flammen & Rauch nur in Kameranähe
    this.fireT -= dt; if (this.fireT <= 0) { this.fireT = 0.12; for (const f of CAMPFIRES) { const d = f.distanceTo(cp); if (d > 140) continue; FX.fire(f, 1, 0.35); if (Math.random() < 0.3) FX.smoke(tmpV2.set(f.x, f.y + 1.2, f.z), 1, true, 0.8); } }
    // Dampf aus Gullys
    this.steamT -= dt; if (this.steamT <= 0) { this.steamT = 0.3; for (const s of this.steam) if (Math.abs(s.x - cp.x) < 110 && Math.abs(s.z - cp.z) < 110) FX.smoke(s, 1, true, 0.9); }
    // Kondensstreifen hinter hochfliegenden Jets
    const jets = (VS.airL || []).filter(a => (a.v.type === 'jet' || a.v.type === 'bizjet') && !a.v.removed).map(a => a.v); if (Act.airliner) jets.push({ id: 'al', pos: Act.airliner.g.position, removed: false });
    for (const j of jets) { let T = this.trails.get(j.id); if (!T) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(90 * 3), 3)); const L = new THREE.Line(g, this.trailMat); L.frustumCulled = false; scene.add(L); T = { L, pts: [], t: 0 }; this.trails.set(j.id, T); }
      T.seen = t; T.t -= dt; if (T.t <= 0 && j.pos.y > 200) { T.t = 0.2; T.pts.unshift(j.pos.clone()); if (T.pts.length > 90) T.pts.pop(); const a = T.L.geometry.attributes.position; T.pts.forEach((p, i) => a.setXYZ(i, p.x, p.y, p.z)); for (let i = T.pts.length; i < 90; i++) { const p = T.pts[T.pts.length - 1]; a.setXYZ(i, p.x, p.y, p.z); } a.needsUpdate = true; } }
    for (const [id, T] of this.trails) if (T.seen !== t) { if (T.pts.length) { T.pts.pop(); if (!T.pts.length) T.L.visible = false; } if (T.seen < t - 30) { scene.remove(T.L); this.trails.delete(id); } }
    // Passanten winken zurück
    for (const n of NPCS.list) if (n.waveT > 0) { n.waveT -= dt; if (n.alive && n.state !== 'flee') n.yaw = turnToward(n.yaw, Math.atan2(Player.active.pos.x - n.pos.x, Player.active.pos.z - n.pos.z), dt * 5); }
    // Seilbahn-Hinweis
    if (GS.playing && Cable.near()) UI.help('🚡 <b>Mt. Leona Seilbahn</b><br>Drücke <kbd>E</kbd> für eine Fahrt ($20).', 0.3);
  },
};
const _actInteract = Act.interact.bind(Act); Act.interact = function () { if (Cable.interact()) return true; return _actInteract(); };
const _bmInit = BigMap.init.bind(BigMap);
BigMap.init = function () { _bmInit(); Radial.build(); { const vl = document.createElement('div'); vl.id = 'verLabel'; vl.textContent = 'Version ' + (window.__VER || '?'); vl.style.cssText = 'position:fixed;right:8px;bottom:4px;font:11px Arial,sans-serif;color:rgba(255,255,255,.55);z-index:70;pointer-events:none;text-shadow:0 1px 2px #000'; document.body.appendChild(vl); } Ambient2.init(); World.anim.push((dt) => Ambient2.update(dt));
  if (LOC.base) blip('✈', '#6a7a4a', LOC.base.x, LOC.base.z, 'Militärbasis'); if (LOC.marina) blip('⚓', '#2a8ad8', LOC.marina.x, LOC.marina.z, 'Marina');
  if (LOC.swamp) blip('🐊', '#4a6a2a', LOC.swamp.x, LOC.swamp.z, 'Airboat-Touren'); if (LOC.beach) blip('🏄', '#22b5d8', LOC.beach.x, LOC.beach.z, 'Jetski-Verleih'); if (LOC.quay) blip('🚢', '#5a6a7a', LOC.quay.x, LOC.quay.z, 'Hafen');
  // Touch: Waffen- & Emote-Rad, Kamera, Licht
  const tz = $('touch'); if (tz) for (const [k, txt, css] of [['emote', 'GESTE', 'right:330px;bottom:160px'], ['KeyV', 'KAMERA', 'left:330px;top:14px'], ['KeyL', 'LICHT', 'right:270px;bottom:200px']]) { const b = document.createElement('div'); b.className = 'tbtn small'; b.dataset.t = k; b.style.cssText = css; b.textContent = txt; tz.appendChild(b); } };
