
// =====================================================================
//  NPCs, FAHNDUNG, SPIELER & KAMPF, PICKUPS
// =====================================================================
function walkHeight(x, z, y) { const h = groundHeight(x, z, y + 0.6); const r = Roads.nearest(x, z, 14); if (r && r.e.type !== 'highway' && r.d > r.e.hw && r.d < r.e.hw + 3.3 && Math.abs(r.p.y - h) < 0.6) return Math.max(h, r.p.y + 0.2); return h; }
class NPC {
  constructor(kind) { this.kind = kind; this.h = new Humanoid(randomLook(kind)); this.pos = V3(); this.vel = V3(); }
  reset(x, z, opts = {}) {
    if (this.used) this.h.setLook(randomLook(this.kind)); this.used = true;
    this.pos.set(x, walkHeight(x, z, 50), z); this.vel.set(0, 0, 0); this.yaw = rand(-Math.PI, Math.PI); this.alive = true; this.state = 'walk';
    this.health = this.kind === 'cop' ? 70 : this.kind === 'gang' ? 60 : 40; this.deadT = 0; this.stateT = 0; this.speed = 0; this.shootT = rand(0.5, 1.5); this.losT = 0; this.los = false; this.leaveT = 0;
    this.alerted = false; this.missionTarget = !!opts.missionTarget; this.stuckT = 0; this.sideT = 0; this.sideDir = 1; this.punchT = 0; this.air = false;
    this.h.group.visible = true; this.h.setWeapon(this.kind === 'civ' ? null : CFG.WEAPONS[this.kind === 'gang' && Math.random() < 0.4 ? 2 : 1]);
    if (opts.walk) { this.walk = opts.walk; this.walkSpeed = rand(1.1, 1.6); } else if (this.kind === 'civ') this.snapToSidewalk(); else this.state = this.kind === 'gang' ? 'guard' : 'chase';
  }
  snapToSidewalk() { const r = Roads.nearest(this.pos.x, this.pos.z, 60, (e) => e.type !== 'highway'); if (!r) { this.state = 'wander'; return; } const dir = Math.random() < 0.5 ? 1 : -1;
    this.walk = { e: r.e, dir, s: dir > 0 ? r.p.s : r.e.len - r.p.s, side: r.lat >= 0 ? 1 : -1 }; this.walkSpeed = rand(1.1, 1.6); this.state = 'walk'; }
  damage(amount, dir, byPlayer, head = false) {
    if (!this.alive) return; if (Admin.oneHit && byPlayer) amount = 999;
    this.health -= amount * (head ? 2.5 : 1);
    if (this.health <= 0) { this.kill(dir ? tmpV2.copy(dir).multiplyScalar(3).setY(1.5) : null, byPlayer); return; }
    if (this.kind === 'civ') { this.panic(tmpV2.copy(this.pos).sub(dir || tmpV3.set(1, 0, 0)), Math.random() < 0.3); if (byPlayer) Wanted.crime('assault', this.pos); }
    else { this.alerted = true; if (this.kind === 'cop' && byPlayer) Wanted.crime('shoot_cop', this.pos); }
  }
  kill(fly, byPlayer) {
    if (!this.alive) return; this.alive = false; this.state = 'dead'; this.deadT = 0; this.h.setWeapon(null);
    if (fly) { this.vel.copy(fly); this.air = true; } else this.vel.set(0, 0, 0);
    if (byPlayer) { if (this.kind === 'civ') Wanted.crime('kill', this.pos); else if (this.kind === 'cop') Wanted.crime('kill_cop', this.pos); }
    if (this.kind === 'civ' && Math.random() < 0.6) Pickups.add('cash', this.pos.x + rand(-0.5, 0.5), this.pos.z + rand(-0.5, 0.5), { value: randi(10, 120), temp: 40 });
    if (this.kind !== 'civ' && Math.random() < 0.5) Pickups.add('ammo', this.pos.x, this.pos.z, { temp: 40 });
    bus.emit('npcKilled', this); NPCS.panicAround(this.pos, 18, this.pos);
  }
  panic(src, cower = false) {
    if (!this.alive || this.kind !== 'civ') return;
    if (this.state === 'flee' || this.state === 'cower') { this.stateT = Math.max(this.stateT, 5); return; }
    this.state = cower ? 'cower' : 'flee'; this.stateT = cower ? rand(3, 6) : rand(8, 14);
    this.fleeYaw = Math.atan2(this.pos.x - src.x, this.pos.z - src.z) + rand(-0.5, 0.5);
  }
}
class NPCSystem {
  constructor() { this.list = []; this.pool = { civ: [], cop: [], gang: [] }; this.spawnT = 0; }
  spawn(kind, x, z, opts) { let n = this.pool[kind].pop(); if (!n) n = new NPC(kind); n.reset(x, z, opts); this.list.push(n); return n; }
  remove(n) { const i = this.list.indexOf(n); if (i >= 0) this.list.splice(i, 1); n.h.group.visible = false; n.alive = false; this.pool[n.kind].push(n); }
  count(kind) { let c = 0; for (const n of this.list) if (n.kind === kind && n.alive) c++; return c; }
  panicAround(pos, r, src) { for (const n of this.list) if (n.kind === 'civ' && n.alive && n.pos.distanceTo(pos) < r) n.panic(src || pos, Math.random() < 0.25); }
  sidewalkSpawn(focus) {
    const cand = Roads.edges.filter(e => e.type !== 'highway' && Math.hypot(e.pts[e.pts.length >> 1].x - focus.x, e.pts[e.pts.length >> 1].z - focus.z) < 150 + e.len / 2);
    for (let t = 0; t < 10 && cand.length; t++) { const e = pick(cand), dir = Math.random() < 0.5 ? 1 : -1, side = Math.random() < 0.5 ? 1 : -1, s = rand(5, e.len - 5);
      const p = Roads.lanePoint(e, dir, s, side * (e.hw + 1.6), V3()); const d = Math.hypot(p.x - focus.x, p.z - focus.z); if (d < 40 || d > 140) continue;
      return this.spawn('civ', p.x, p.z, { walk: { e, dir, s, side } }); }
  }
  update(dt, focus) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.3; const pv = Player.vehicle, high = pv && pv.air && pv.pos.y - terrainHeight(pv.pos.x, pv.pos.z) > 100;
      if (this.count('civ') < Math.round(Q().peds * Admin.pedMul) && !high) this.sidewalkSpawn(focus);
      let dead = 0; for (const n of [...this.list]) { const d = Math.hypot(n.pos.x - focus.x, n.pos.z - focus.z);
        if (!n.alive) { dead++; if (n.deadT > 30 || d > 160 || dead > 14) this.remove(n); continue; }
        if (n.kind === 'civ' && d > 170) this.remove(n);
        else if (n.kind === 'cop' && (d > 200 || (Wanted.level === 0 && n.leaveT > 12))) this.remove(n);
        else if (n.kind === 'gang' && !n.missionTarget && d > 250) this.remove(n); }
    }
    for (const n of this.list) {
      if (!n.alive) { this.updateDead(n, dt); continue; }
      n.stateT -= dt; n.punchT = Math.max(0, n.punchT - dt);
      if (n.kind === 'civ') this.updateCiv(n, dt); else if (n.kind === 'cop') this.updateCop(n, dt); else this.updateGang(n, dt);
      this.vehicleContact(n);
      const gh = walkHeight(n.pos.x, n.pos.z, n.pos.y), swim = terrainHeight(n.pos.x, n.pos.z) < -1.1 && gh < -1.1;
      if (n.air) { n.vel.y -= CFG.GRAVITY * dt; n.pos.y += n.vel.y * dt; if (n.pos.y <= gh) { n.pos.y = gh; n.air = false; n.vel.y = 0; } }
      else n.pos.y = damp(n.pos.y, swim ? CFG.WATER_Y - 0.3 : gh, 14, dt);
      const hg = n.h.group; hg.position.copy(n.pos); hg.rotation.y = n.yaw;
      const far = camera.position.distanceToSquared(n.pos) > 85 * 85; hg.visible = !far;
      if (!far) n.h.animate(dt, { speed: n.speed, aim: n.state === 'shoot' || n.state === 'combat', cower: n.state === 'cower', punch: n.punchT, swim, air: n.air, handsUp: n.state === 'arrest' || n.state === 'surrender', phone: n.phone && n.state === 'idle' && !n.act, act: n.waveT > 0 ? 'wave' : n.state === 'idle' ? n.act : n.state === 'cheer' ? 'cheer' : null });
    }
  }
  updateDead(n, dt) {
    n.deadT += dt;
    if (n.air || n.vel.lengthSq() > 0.01) { n.vel.y -= CFG.GRAVITY * dt; n.pos.addScaledVector(n.vel, dt); const gh = groundHeight(n.pos.x, n.pos.z, n.pos.y + 0.5); if (n.pos.y <= gh) { n.pos.y = gh; n.vel.multiplyScalar(0.5); n.vel.y = 0; if (n.vel.lengthSq() < 0.5) { n.vel.set(0, 0, 0); n.air = false; } } collideCircle(n.pos, 0.3, n.pos.y, 1); }
    n.h.group.position.copy(n.pos); n.h.animate(dt, { dead: true });
  }
  updateCiv(n, dt) {
    if (n.state === 'walk' && n.walk) {
      const w = n.walk; n.speed = n.walkSpeed; w.s += n.speed * dt;
      if (w.s > w.e.len) { const endN = w.dir > 0 ? w.e.b : w.e.a, node = Roads.nodes[endN]; let opts = node.edges.map(i => Roads.edges[i]).filter(e => e.type !== 'highway' && e !== w.e); if (!opts.length) opts = [w.e];
        const e = pick(opts); w.e = e; w.dir = e.a === endN ? 1 : -1; w.s = node.r * 0.5; if (Math.random() < 0.3) w.side = -w.side; }
      const p = Roads.lanePoint(w.e, w.dir, w.s + 1.5, w.side * (w.e.hw + 1.6), tmpV5);
      n.yaw = turnToward(n.yaw, Math.atan2(p.x - n.pos.x, p.z - n.pos.z), dt * 6); const d = Math.hypot(p.x - n.pos.x, p.z - n.pos.z);
      if (d > 0.05) { n.pos.x += (p.x - n.pos.x) / d * Math.min(d, n.speed * dt * (d > 3 ? 2 : 1.2)); n.pos.z += (p.z - n.pos.z) / d * Math.min(d, n.speed * dt * (d > 3 ? 2 : 1.2)); }
      for (const v of VS.list) { const sp = v.hspeed; if (sp < 7 || v.sinking || v.air) continue; const rx = n.pos.x - v.pos.x, rz = n.pos.z - v.pos.z; if (rx * rx + rz * rz > 500) continue;
        const s = Math.sin(v.yaw), c = Math.cos(v.yaw), al = rx * s + rz * c, lat = -rx * c + rz * s;
        if (al > 0 && al < sp * 1.0 && Math.abs(lat) < 2.6 && Math.random() < 0.7) { n.state = 'dodge'; n.stateT = 0.45; const sg = lat >= 0 ? 1 : -1; n.vel.set(-c * sg * 7, 3, s * sg * 7); n.air = true; break; } }
      if (GS.playing && Player.aimTarget === n) n.panic(Player.active.pos, true);
      if (Math.random() < dt * 0.025) { n.state = 'idle'; n.stateT = rand(4, 10); n.phone = Math.random() < 0.55; n.act = n.phone ? null : pick(['smoke', 'watch', 'stretch', 'think', 'shrug', null]); }
    } else if (n.state === 'idle') { n.speed = 0; if (n.stateT <= 0) { n.state = 'walk'; n.phone = false; n.act = null; } if (GS.playing && Player.aimTarget === n) { if (n.kind === 'civ' && Math.random() < 0.6) { n.state = 'surrender'; n.stateT = rand(3, 6); } else n.panic(Player.active.pos, true); } }
    else if (n.state === 'surrender') { n.speed = 0; n.yaw = turnToward(n.yaw, Math.atan2(Player.active.pos.x - n.pos.x, Player.active.pos.z - n.pos.z), dt * 4); if (n.stateT <= 0 || Player.aimTarget !== n && n.stateT < 1.5) n.panic(Player.active.pos, false); }
    else if (n.state === 'cheer') { n.speed = 0; if (n.stateT <= 0) n.state = 'walk'; }
    else if (n.state === 'dodge') { n.pos.x += n.vel.x * dt; n.pos.z += n.vel.z * dt; n.speed = 0; if (n.stateT <= 0) n.panic(Player.active.pos, false); }
    else if (n.state === 'cower') { n.speed = 0; if (n.stateT <= 0) { n.state = 'flee'; n.stateT = rand(5, 9); } }
    else if (n.state === 'flee') { n.speed = 5.2; n.yaw = turnToward(n.yaw, n.fleeYaw, dt * 6); n.pos.x += Math.sin(n.yaw) * n.speed * dt; n.pos.z += Math.cos(n.yaw) * n.speed * dt;
      if (collideCircle(n.pos, 0.35, n.pos.y)) n.fleeYaw += rand(0.6, 1.6) * (Math.random() < 0.5 ? 1 : -1); if (n.stateT <= 0) { n.snapToSidewalk(); } }
    else { n.speed = 1.3; n.pos.x += Math.sin(n.yaw) * n.speed * dt; n.pos.z += Math.cos(n.yaw) * n.speed * dt; if (collideCircle(n.pos, 0.35, n.pos.y)) n.yaw += rand(1, 2.5); if (Math.random() < dt * 0.2) n.snapToSidewalk(); }
  }
  moveToward(n, tx, tz, speed, dt) {
    const want = Math.atan2(tx - n.pos.x, tz - n.pos.z) + (n.sideT > 0 ? n.sideDir * 1.2 : 0);
    n.yaw = turnToward(n.yaw, want, dt * 7); const ox = n.pos.x, oz = n.pos.z;
    n.pos.x += Math.sin(n.yaw) * speed * dt; n.pos.z += Math.cos(n.yaw) * speed * dt; n.speed = speed;
    if (collideCircle(n.pos, 0.35, n.pos.y)) { n.stuckT += dt; if (n.stuckT > 0.4) { n.sideT = 1.2; n.sideDir = Math.random() < 0.5 ? 1 : -1; n.stuckT = 0; } }
    n.sideT -= dt; if (Math.hypot(n.pos.x - ox, n.pos.z - oz) > speed * dt * 0.5) n.stuckT = Math.max(0, n.stuckT - dt);
  }
  updateCop(n, dt) {
    const P = Player.active, tgt = Player.targetPos(), d = Math.hypot(tgt.x - n.pos.x, tgt.z - n.pos.z);
    if (Wanted.level === 0 || !GS.alive) { n.leaveT += dt; n.state = 'idle'; n.speed = 0; return; }
    n.losT -= dt; if (n.losT <= 0) { n.losT = rand(0.3, 0.5); n.los = d < 120 && hasLOS(tmpV2.set(n.pos.x, n.pos.y + 1.6, n.pos.z), tmpV3.set(tgt.x, tgt.y + 1.1, tgt.z)); if (n.los && d < 90) Wanted.spot(); }
    const face = Math.atan2(tgt.x - n.pos.x, tgt.z - n.pos.z);
    if (Wanted.level <= 1 && !P.vehicle) { n.h.setWeapon(null);
      if (d > 1.3) { this.moveToward(n, tgt.x, tgt.z, d > 6 ? 5.4 : 2.5, dt); n.state = 'chase'; } else { n.speed = 0; n.yaw = turnToward(n.yaw, face, dt * 8); n.state = 'arrest'; }
      if (d < 1.9) Wanted.arrestPressure(dt); return; }
    n.h.setWeapon(CFG.WEAPONS[1]);
    if (d > 26 || !n.los) { this.moveToward(n, tgt.x, tgt.z, 5.6, dt); n.state = 'chase'; }
    else { n.state = 'shoot'; n.yaw = turnToward(n.yaw, face, dt * 8); n.speed = 0;
      if (d < 6) { n.pos.x -= Math.sin(face) * 2 * dt; n.pos.z -= Math.cos(face) * 2 * dt; n.speed = 2; collideCircle(n.pos, 0.35, n.pos.y); }
      n.shootT -= dt; if (n.shootT <= 0 && n.los) { n.shootT = rand(0.6, 1.2); this.enemyShoot(n.h.muzzle(V3()), 6, 0.33, n); } }
    if (d < 1.9 && Wanted.level <= 2 && (!P.vehicle || P.vehicle.hspeed < 1)) Wanted.arrestPressure(dt);
  }
  updateGang(n, dt) {
    const tgt = Player.targetPos(), d = Math.hypot(tgt.x - n.pos.x, tgt.z - n.pos.z);
    if (!n.alerted) { n.speed = 0; n.state = 'guard'; n.yaw += Math.sin(GameTime * 0.5 + n.pos.x) * dt * 0.5; if (d < 34) { n.alerted = true; for (const o of this.list) if (o.kind === 'gang' && o.pos.distanceTo(n.pos) < 40) o.alerted = true; } return; }
    if (!GS.alive) { n.speed = 0; return; }
    n.losT -= dt; if (n.losT <= 0) { n.losT = rand(0.3, 0.5); n.los = hasLOS(tmpV2.set(n.pos.x, n.pos.y + 1.6, n.pos.z), tmpV3.set(tgt.x, tgt.y + 1.1, tgt.z)); }
    const face = Math.atan2(tgt.x - n.pos.x, tgt.z - n.pos.z);
    if (d > 22 || !n.los) { this.moveToward(n, tgt.x, tgt.z, 5.0, dt); n.state = 'chase'; }
    else { n.state = 'combat'; n.yaw = turnToward(n.yaw, face, dt * 8); n.strafe = n.strafe || 1; if (Math.random() < dt * 0.5) n.strafe *= -1;
      n.pos.x += Math.cos(face) * n.strafe * 1.6 * dt; n.pos.z -= Math.sin(face) * n.strafe * 1.6 * dt; n.speed = 1.6; collideCircle(n.pos, 0.35, n.pos.y);
      n.shootT -= dt; if (n.shootT <= 0) { n.shootT = rand(0.5, 1.1); this.enemyShoot(n.h.muzzle(V3()), 5, 0.3, n); } }
  }
  enemyShoot(origin, dmg, baseHit, shooter = null) {
    const P = Player.active, tgt = Player.targetPos(); const aim = V3(tgt.x, tgt.y + (P.vehicle ? 0.9 : P.crouch ? 0.8 : 1.2), tgt.z);
    origin = origin.clone(); const dist = origin.distanceTo(aim);
    let hitP = baseHit * clamp(1.3 - dist / 55, 0.2, 1.2);
    if (P.crouch && P.inCover) hitP *= 0.3; else if (P.crouch) hitP *= 0.7;
    if (P.vehicle) hitP *= clamp(1 - P.vehicle.speed / 45, 0.25, 1); else if (P.sprinting) hitP *= 0.6;
    const hit = Math.random() < hitP, end = aim.clone(); if (!hit) end.add(tmpV4.set(rand(-1.5, 1.5), rand(-0.6, 1.2), rand(-1.5, 1.5)));
    const dir = V3().subVectors(end, origin).normalize(), wall = raycastWorld(origin, dir, dist + 2), blocked = wall < dist - 0.6;
    const endP = blocked ? origin.clone().addScaledVector(dir, wall) : end;
    FX.tracers.add(origin, endP, col('#ffd27a')); FX.muzzle(origin, dir, false);
    Audio.shot(shooter && shooter.kind === 'gang' ? 'smg' : 'pistol', camera.position.distanceTo(origin), this.pan(origin));
    if (blocked) { FX.sparks(endP, 4, 3); return; }
    if (hit && GS.playing) {
      if (P.vehicle && !P.vehicle.isBike && P.vehicle.type !== 'jetski') { P.vehicle.damage(dmg * 0.8); if (Math.random() < 0.3) P.damage(dmg * 0.6, origin); FX.sparks(endP, 4, 3); }
      else P.damage(dmg, origin);
    } else FX.dust(endP, 1);
  }
  pan(p) { const r = tmpV4.set(Math.cos(Cam.yaw), 0, -Math.sin(Cam.yaw)); const d = tmpV1.subVectors(p, camera.position); const l = d.length() || 1; return clamp((d.x * r.x + d.z * r.z) / l, -1, 1) * 0.8; }
  vehicleContact(n) {
    for (const v of VS.list) {
      if (v.sinking || v.policeHeli) continue; const rx = n.pos.x - v.pos.x, rz = n.pos.z - v.pos.z; if (rx * rx + rz * rz > (v.halfL + 1) ** 2) continue;
      if (n.pos.y > v.pos.y + v.height || n.pos.y + 1.8 < v.pos.y) continue;
      const [lx, lz] = v.localOf(n.pos.x, n.pos.z), hx = v.halfW + 0.35, hz = v.halfL + 0.35; if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
      const sp = v.hspeed;
      if (sp > 5.5 && !v.dead) { const byP = v === Player.vehicle; n.kill(tmpV2.set(v.vel.x * 0.8 + rand(-1, 1), 4 + sp * 0.12, v.vel.z * 0.8 + rand(-1, 1)), false); FX.hit(tmpV3.copy(n.pos).setY(n.pos.y + 1)); Audio.impact(10, v.camDist());
        if (byP) { Wanted.crime(n.kind === 'cop' ? 'kill_cop' : 'hit_ped', n.pos); Cam.shake = 0.3; } v.vel.multiplyScalar(0.94); return; }
      const px = hx - Math.abs(lx), pz = hz - Math.abs(lz), c = Math.cos(v.yaw), s = Math.sin(v.yaw); let ox = 0, oz = 0; if (px < pz) ox = Math.sign(lx) * px; else oz = Math.sign(lz) * pz;
      n.pos.x += ox * c + oz * s; n.pos.z += -ox * s + oz * c;
    }
  }
}

// ---------- FAHNDUNGSSYSTEM ----------
const Wanted = {
  heat: 0, level: 0, evadeT: 0, seen: false, seenT: 0, arrestT: 0, lastSeen: V3(), flash: false,
  crime(type, pos) {
    if (!GS.playing || Admin.noWanted) return; if (Missions.ignoreCrime(type, pos)) return;
    let add = CFG.CRIMES[type] || 0.5;
    if (type === 'shots') { const wit = NPCS.list.some(n => n.alive && n.kind !== 'gang' && n.pos.distanceTo(pos) < 55) || VS.list.some(v => v.ai && v.pos.distanceTo(pos) < 50); if (!wit) return; if (this.level >= 1) add = 0.04; }
    const before = this.level; this.heat = Math.min(5, this.heat + add); this.set(Math.max(this.level, Math.ceil(this.heat - 0.001)));
    if (this.level > before) this.seen = true; this.evadeT = 0; this.lastSeen.copy(pos);
  },
  set(l) { if (Admin.noWanted) l = 0; l = clamp(l, 0, 5); const before = this.level; this.level = l; this.heat = Math.max(Math.min(this.heat, l), l - 0.5); if (l === 0) this.heat = 0;
    if (l > before) { UI.notify(`★ Fahndungslevel ${l}`); Audio.click(520); VS.copT = 0; this.evadeT = 0; this.seen = true; this.seenT = 2; } },
  spot() { this.seenT = 0.8; this.evadeT = 0; this.lastSeen.copy(Player.targetPos()); },
  arrestPressure(dt) { this.arrestT += dt * 2; },
  clear(silent) { const had = this.level > 0; this.heat = 0; this.level = 0; this.evadeT = 0; this.arrestT = 0; if (had && !silent) { UI.notify('✔ Fahndung abgeschüttelt'); Audio.jingle(true); } },
  update(dt) {
    this.arrestT = Math.max(0, this.arrestT - dt); if (Admin.noWanted && this.level) this.clear(true);
    if (this.level === 0) { this.flash = false; return; }
    const P = Player.active, tp = Player.targetPos();
    if (VS.list.some(v => v.ai && v.ai.mode === 'police' && v.pos.distanceTo(tp) < 25) || NPCS.list.some(n => n.alive && n.kind === 'cop' && n.pos.distanceTo(tp) < 15)) this.seenT = 0.8;
    this.seenT -= dt; this.seen = this.seenT > 0; this.flash = !this.seen;
    if (!this.seen) { this.evadeT += dt * (P.crouch ? 1.4 : 1) * (Math.hypot(tp.x - this.lastSeen.x, tp.z - this.lastSeen.z) > 80 ? 1.6 : 1); if (this.evadeT > 6 + this.level * 3.5) this.clear(); }
    if (P.vehicle && !P.vehicle.air && this.level <= 2 && P.vehicle.hspeed < 1 && VS.list.some(v => v.ai && v.ai.mode === 'police' && v.pos.distanceTo(P.vehicle.pos) < 7)) this.arrestT += dt * 1.4;
    if (this.arrestT > 3.2 && GS.playing && !Admin.god) Game.busted();
  },
};

// ---------- SPIELER-CHARAKTERE ----------
class Character {
  constructor(def, spawn) {
    this.def = def; this.h = new Humanoid(def, true); this.pos = V3(spawn.x, 0, spawn.z); this.pos.y = walkHeight(this.pos.x, this.pos.z, 50); this.vel = V3(); this.yaw = spawn.yaw || 0;
    this.health = 100; this.armor = def.id === 'kai' ? 25 : 50; this.weapons = CFG.WEAPONS.map(w => ({ clip: w.clip || 0, reserve: w.reserve ? Math.floor(w.reserve * 0.5) : 0 }));
    this.cur = 1; this.vehicle = null; this.onGround = true; this.crouch = false; this.swim = false; this.reloadT = 0; this.fireT = 0; this.lastShotT = 99; this.lastDmgT = 99;
    this.punchT = 0; this.aiming = false; this.sprinting = false; this.downT = 0; this.inCover = false; this.aimPitch = 0; this.chute = false;
    this.h.setWeapon(CFG.WEAPONS[this.cur]);
  }
  get weapon() { return CFG.WEAPONS[this.cur]; }
  damage(a) {
    if (!GS.playing || a <= 0 || this !== Player.active || Admin.god) return; this.lastDmgT = 0;
    if (this.armor > 0) { const ab = Math.min(this.armor, a * 0.7); this.armor -= ab; a -= ab; }
    this.health -= a; UI.hurt(); if (this.health <= 0) { this.health = 0; Game.wasted(); }
  }
}
const CHUTE = (() => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), std({ color: 0xff2d95, side: THREE.DoubleSide, roughness: 0.8 })); c.scale.set(1.3, 0.6, 1); c.position.y = 5; g.add(c); g.visible = false; return g; })();
const Player = {
  chars: [], idx: 0, aimTarget: null, aimHit: null,
  init() { this.chars = CFG.CHARACTERS.map((d, i) => new Character(d, i === 0 ? LOC.kai : LOC.elena)); scene.add(CHUTE); },
  get active() { return this.chars[this.idx]; },
  get vehicle() { return this.active.vehicle; },
  targetPos() { const c = this.active; return c.vehicle ? c.vehicle.pos : c.pos; },
  targetVel() { const c = this.active; return c.vehicle ? tmpV4.copy(c.vehicle.vel) : tmpV4.set(c.vel.x, 0, c.vel.z); },
  update(dt) {
    const c = this.active;
    for (const ch of this.chars) { if (ch.vehicle) { ch.pos.copy(ch.vehicle.pos); continue; } if (ch !== c || !GS.playing || GS.switching) this.idle(ch, dt); }
    if (!GS.playing || GS.switching) return;
    c.lastShotT += dt; c.lastDmgT += dt; c.fireT -= dt; c.punchT = Math.max(0, c.punchT - dt);
    if (c.lastDmgT > 6 && c.health < 50) c.health = Math.min(50, c.health + dt * 2.5);
    if (Admin.open) { if (!c.vehicle) this.idle(c, dt); return; }
    const eHit = In.hit('KeyE'), fHit = In.hit('KeyF'); if (In.hit('KeyU')) Act.phone();
    if (fHit || (eHit && !(c.vehicle && c.vehicle.air))) { if ((eHit || !c.vehicle) && Act.interact()) { /* Ort/Rennen */ } else if (c.vehicle) this.exitVehicle(); else if (!Missions.interact()) this.tryEnter(c); }
    for (let k = 1; k <= 4; k++) if (In.hit('Digit' + k)) this.selectWeapon(k);
    if (In.wheel) this.selectWeapon((c.cur + In.wheel + CFG.WEAPONS.length) % CFG.WEAPONS.length);
    if (c.vehicle) this.updateDriving(c, dt); else this.updateOnFoot(c, dt);
    this.updateCombat(c, dt);
  },
  idle(ch, dt) { ch.h.group.position.copy(ch.pos); ch.h.group.rotation.y = ch.yaw; ch.h.animate(dt, { speed: 0, swim: ch.swim }); },
  selectWeapon(k) { const c = this.active; if (c.cur === k) return; c.cur = k; c.reloadT = 0; c.h.setWeapon(CFG.WEAPONS[k]); Audio.click(660); },
  tryEnter(c) {
    let best = null, bd = 1e9;
    for (const v of VS.list) { if (v.dead || v.sinking || v.driver instanceof Character || v.policeHeli) continue; const reach = v.air ? v.halfL * 0.5 + 3 : v.boat ? v.halfL * 0.6 + 3 : 3.2;
      const d = Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z) - v.halfL * 0.45; if (d < reach && d < bd && Math.abs(v.pos.y - c.pos.y) < 4) { bd = d; best = v; } }
    if (!best) return false;
    if (best.ai) { const kind = best.isPolice ? 'cop' : 'civ', s = Math.sin(best.yaw), co = Math.cos(best.yaw);
      const n = NPCS.spawn(kind, best.pos.x + co * 2.2, best.pos.z - s * 2.2); if (kind === 'civ') n.panic(c.pos, false); else Wanted.set(Math.max(Wanted.level, 2));
      Wanted.crime(best.isPolice ? 'steal_police' : 'carjack', best.pos); best.ai = null; best.aiInput = null; UI.notify('Fahrzeug gekapert!'); }
    else if (best.isPolice) Wanted.crime('steal_police', best.pos);
    else if (best.military && Math.abs(best.pos.x - BASE.x) < BASE.hx + 30 && Math.abs(best.pos.z - BASE.z) < BASE.hz + 30) { Wanted.crime('steal_military', best.pos); UI.notify('🚨 Militärfahrzeug gestohlen!'); }
    c.vehicle = best; best.driver = c; best.setOccupant(c.h, best.m.pose); best.input = NOINPUT; c.crouch = false; c.swim = false; c.reloadT = 0; c.chute = false; CHUTE.visible = false;
    Audio.door(); UI.notify(`${best.air ? '✈' : best.boat ? '⛵' : '🚗'} ${best.spec.name}`); bus.emit('enterVehicle', best);
    if (best.cls === 'plane') UI.help('<b>Flugzeug</b>: <kbd>Shift</kbd>/<kbd>C</kbd> Schub · <kbd>W</kbd>/<kbd>S</kbd> Nase runter/hoch · <kbd>A</kbd>/<kbd>D</kbd> Rollen · <kbd>Q</kbd>/<kbd>E</kbd> Seitenruder · <kbd>Leertaste</kbd> Nachbrenner/Bremse' + (best.spec.guns ? ' · <kbd>LMB</kbd> Bordkanone · <kbd>RMB</kbd> Rakete' : ''), 9);
    else if (best.cls === 'heli') UI.help('<b>Helikopter</b>: <kbd>Shift</kbd> steigen · <kbd>C</kbd> sinken · <kbd>W</kbd>/<kbd>S</kbd> neigen · <kbd>A</kbd>/<kbd>D</kbd> drehen · <kbd>Q</kbd>/<kbd>E</kbd> seitwärts', 8);
    else if (best.isPolice) UI.help('Polizeiwagen: <kbd>H</kbd> schaltet die Sirene.', 4);
    return true;
  },
  exitVehicle(forced = false) {
    const c = this.active, v = c.vehicle; if (!v) return;
    const s = Math.sin(v.yaw), co = Math.cos(v.yaw), sp = v.speed; const side = v.air ? v.halfW * 0.5 + 1.5 : v.halfW + 0.9;
    let placed = false;
    for (const sd of [1, -1]) { tmpV2.set(v.pos.x + co * sd * side, 0, v.pos.z - s * sd * side); const ok = !collideCircle(tmpV2.clone(), 0.4, v.pos.y, 1.8); if (ok || sd === -1) { c.pos.set(tmpV2.x, v.pos.y, tmpV2.z); placed = true; break; } }
    if (!placed) c.pos.copy(v.pos);
    v.setOccupant(null); scene.add(c.h.group); c.h.group.visible = true;
    const agl = v.pos.y - groundHeight(v.pos.x, v.pos.z, v.pos.y);
    if (v.air && agl > 12) { c.pos.copy(v.pos).add(tmpV3.set(0, -2, 0)); c.vel.copy(v.vel).multiplyScalar(0.5); c.onGround = false; c.chute = true; UI.notify('🪂 Fallschirm geöffnet'); }
    else { if (v.boat || forced) c.pos.y = Math.max(groundHeight(c.pos.x, c.pos.z, v.pos.y + 1), CFG.WATER_Y - 0.3); c.vel.set(v.vel.x * 0.4, 0, v.vel.z * 0.4); if (sp > 9 && !forced && !v.air) { c.damage(6 + sp * 0.4); c.downT = 0.9; UI.notify('Abgesprungen!'); } }
    c.yaw = v.yaw; v.driver = null; v.input = sp > 2 && !v.air ? NOINPUT : PARKINPUT; if (v.isPolice && !v.ai) v.sirenOn = false;
    c.vehicle = null; Audio.door(); Audio.setHorn(false); bus.emit('exitVehicle', v);
  },
  updateDriving(c, dt) {
    const v = c.vehicle, inp = v.playerInput || (v.playerInput = { ...NOINPUT }); const ax = In.ax, ay = In.ay;
    Object.assign(inp, NOINPUT);
    if (v.cls === 'car' || v.boat) { inp.throttle = Math.max(0, ay); inp.brake = Math.max(0, -ay); inp.steer = -ax; inp.handbrake = In.is('Space'); inp.boost = In.is('ShiftLeft'); }
    else if (v.cls === 'plane') { inp.pitch = ay; inp.roll = ax; inp.yaw = (In.is('KeyQ') ? 1 : 0) - (In.is('KeyE') ? 1 : 0); inp.up = In.is('ShiftLeft') ? 1 : 0; inp.down = In.is('KeyC') ? 1 : 0; inp.boost = In.is('Space'); inp.handbrake = In.is('Space'); }
    else { inp.pitch = ay; inp.yaw = -ax; inp.roll = (In.is('KeyE') ? 1 : 0) - (In.is('KeyQ') ? 1 : 0); inp.up = In.is('ShiftLeft') || In.is('Space') ? 1 : 0; inp.down = In.is('KeyC') ? 1 : 0; }
    v.input = inp;
    if (In.hit('KeyR') && !v.air) { if (v.flipped || (v.hspeed < 1 && Math.abs(v.roll) > 0.6)) { v.resetUpright(); UI.notify('Fahrzeug zurückgesetzt'); } else { const st = (Audio.station + 1) % RADIO.length; Audio.setStation(st); UI.notify(st ? `📻 ${RADIO[st].name}` : '📻 Radio aus'); } }
    if (In.hit('KeyR') && v.air) { const st = (Audio.station + 1) % RADIO.length; Audio.setStation(st); UI.notify(st ? `📻 ${RADIO[st].name}` : '📻 Radio aus'); }
    if (v.isPolice) { if (In.hit('KeyH')) { v.sirenOn = !v.sirenOn; UI.notify(v.sirenOn ? '🚨 Sirene an' : 'Sirene aus'); } Audio.setHorn(false); } else Audio.setHorn(In.is('KeyH') && !v.air);
    if (In.is('KeyH') && !v.isPolice) NPCS.panicAround(v.pos, 6, v.pos);
    if (v.flipped) UI.help('Fahrzeug liegt auf dem Dach – <kbd>R</kbd> zum Zurücksetzen', 0.5);
    c.aiming = In.rmb && !c.weapon.melee && !v.air; c.crouch = false; c.pos.copy(v.pos);
    // Bordwaffen des Jets
    if (v.spec.guns && !v.dead) { v.gunT -= dt; v.missileT -= dt;
      if (In.lmb && v.gunT <= 0) { v.gunT = 0.06; v.axes(); const o = V3().copy(v.pos).addScaledVector(v.up, 1.6).addScaledVector(v.fwd, 8); const d = v.fwd.clone().add(tmpV3.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.01)).normalize();
        const h = raycastScene(o, d, 600, c); FX.tracers.add(o, h.point, col('#ffcf6a')); applyHit(h, 35, d, true); if (h.type === 'vehicle' && Math.random() < 0.2) h.vehicle.damage(40, true); Audio.shot('rifle', 0, 0); bus.emit('gunshot', { pos: o, byPlayer: true }); }
      if ((In.rmb || In.hit('KeyX')) && v.missileT <= 0) { v.missileT = 1.2; Missiles.fire(v); } }
  },
  updateOnFoot(c, dt) {
    if (Cable.ride) { c.h.group.position.copy(c.pos); c.h.group.rotation.y = Cable.yaw; c.h.animate(dt, { speed: 0 }); return; }
    const fx = -Math.sin(Cam.yaw), fz = -Math.cos(Cam.yaw), rx = Math.cos(Cam.yaw), rz = -Math.sin(Cam.yaw), ax = In.ax, ay = In.ay;
    let mx = fx * ay + rx * ax, mz = fz * ay + rz * ax; const ml = Math.min(1, Math.hypot(mx, mz)); if (ml > 0.01) { const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
    if (Admin.noclip) { const sp = In.is('ShiftLeft') ? 60 : 18, up = (In.is('Space') ? 1 : 0) - (In.is('KeyC') ? 1 : 0); camera.getWorldDirection(tmpV3);
      c.pos.x += (tmpV3.x * ay + rx * ax) * sp * dt; c.pos.z += (tmpV3.z * ay + rz * ax) * sp * dt; c.pos.y += (tmpV3.y * ay + up) * sp * dt; c.vel.set(0, 0, 0); c.onGround = false;
      c.h.group.position.copy(c.pos); c.h.group.rotation.y = Cam.yaw + Math.PI; c.h.animate(dt, { speed: 0, air: true }); return; }
    if (In.hit('KeyC') && !c.swim) c.crouch = !c.crouch;
    c.aiming = In.rmb && !c.swim && c.downT <= 0 && !c.chute;
    c.sprinting = In.is('ShiftLeft') && ml > 0.1 && !c.aiming && !c.crouch;
    let spd = c.swim ? (c.sprinting ? 3.6 : 2.4) : c.crouch ? 1.9 : c.aiming ? 2.9 : c.sprinting ? 7.6 : 4.3; spd *= Math.max(ml, 0);
    if (c.chute) spd = 9;
    if (c.downT > 0) { c.downT -= dt; spd = 0; }
    const acc = c.onGround || c.swim ? 14 : c.chute ? 1.5 : 2.5;
    c.vel.x = damp(c.vel.x, mx * spd, acc, dt); c.vel.z = damp(c.vel.z, mz * spd, acc, dt);
    if (c.aiming || c.lastShotT < 0.8 || c.punchT > 0) c.yaw = turnToward(c.yaw, Cam.yaw + Math.PI, 18 * dt); else if (ml > 0.1) c.yaw = turnToward(c.yaw, Math.atan2(mx, mz), 10 * dt);
    if (In.hit('Space')) { if (c.crouch) c.crouch = false; else if (c.onGround && !c.swim) { c.vel.y = 5.6; c.onGround = false; } }
    if (!c.swim) c.vel.y -= CFG.GRAVITY * dt * 1.5; if (c.chute) c.vel.y = Math.max(c.vel.y, -5);
    c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt; c.pos.y += c.vel.y * dt;
    collideCircle(c.pos, 0.38, c.pos.y, c.crouch ? 1.1 : 1.8);
    for (const v of VS.list) {
      if (v.sinking || v.policeHeli) continue; const ddx = c.pos.x - v.pos.x, ddz = c.pos.z - v.pos.z; if (ddx * ddx + ddz * ddz > (v.halfL + 1) ** 2) continue; if (c.pos.y > v.pos.y + v.height - 0.2 || c.pos.y + 1.8 < v.pos.y) continue;
      const [lx, lz] = v.localOf(c.pos.x, c.pos.z), hx = (v.air ? v.halfW * 0.25 : v.halfW) + 0.38, hz = v.halfL * (v.air ? 0.8 : 1) + 0.38; if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
      if (v.hspeed > 6 && !v.dead) { c.damage(v.hspeed * 1.6); c.vel.set(v.vel.x * 0.7, 4, v.vel.z * 0.7); c.onGround = false; c.downT = 1.2; Audio.impact(10, 0); Cam.shake = 0.5; if (v.ai && v.ai.mode === 'traffic') v.ai.panic = 5; }
      const px = hx - Math.abs(lx), pz = hz - Math.abs(lz), co = Math.cos(v.yaw), s = Math.sin(v.yaw); let ox = 0, oz = 0; if (px < pz) ox = Math.sign(lx) * px; else oz = Math.sign(lz) * pz;
      c.pos.x += ox * co + oz * s; c.pos.z += -ox * s + oz * co;
    }
    const th = terrainHeight(c.pos.x, c.pos.z), gh = walkHeight(c.pos.x, c.pos.z, c.pos.y);
    if (th < -1.15 && gh < -1.15) { if (!c.swim) FX.splash(c.pos, 10); c.swim = true; c.crouch = false; c.chute = false; c.pos.y = damp(c.pos.y, CFG.WATER_Y - 0.3, 6, dt); c.vel.y = 0; c.onGround = true; }
    else { c.swim = false;
      if (c.pos.y <= gh || (c.onGround && c.pos.y - gh < 0.5 && c.vel.y <= 0)) { if (c.vel.y < -14 && !c.chute) c.damage((-c.vel.y - 14) * 7); c.pos.y = gh; c.vel.y = 0; c.onGround = true; if (c.chute) { c.chute = false; UI.notify('Gelandet'); } }
      else c.onGround = false; }
    const L = WS - 10; c.pos.x = clamp(c.pos.x, -L, L); c.pos.z = clamp(c.pos.z, -L, L);
    c.inCover = false; if (c.crouch) c.inCover = World.query(c.pos.x - 1.3, c.pos.z - 1.3, c.pos.x + 1.3, c.pos.z + 1.3, _qb).some(b => b.top > c.pos.y + 1);
    CHUTE.visible = c.chute; if (c.chute) { CHUTE.position.copy(c.pos); CHUTE.rotation.y = c.yaw; }
    const sp = Math.hypot(c.vel.x, c.vel.z); c.h.group.position.copy(c.pos); c.h.group.rotation.y = c.yaw;
    c.h.animate(dt, { speed: c.chute ? 0 : sp, aim: (c.aiming || c.lastShotT < 0.6) && !c.weapon.melee, aimPitch: c.aimPitch, crouch: c.crouch, swim: c.swim, air: !c.onGround && !c.swim && !c.chute, punch: c.punchT, handsUp: c.chute, act: c.act });
    if (c.swim) c.h.gun.visible = false; else c.h.setWeapon(c.weapon);
  },
  updateCombat(c, dt) {
    const w = c.weapon, s = c.weapons[c.cur];
    camera.getWorldDirection(this.camDir || (this.camDir = V3()));
    const o = this.aimO || (this.aimO = V3()); o.copy(camera.position).addScaledVector(this.camDir, camera.position.distanceTo(Cam.pivot) + 0.3);
    this.aimHit = raycastScene(o, this.camDir, 260, c);
    this.aimTarget = (c.aiming && this.aimHit.npc && this.aimHit.npc.alive) ? this.aimHit.npc : null;
    c.aimPitch = Math.asin(clamp(-this.camDir.y, -1, 1)) * 0.9;
    if (c.reloadT > 0) { c.reloadT -= dt; if (c.reloadT <= 0) { const take = Math.min(w.clip - s.clip, s.reserve); s.clip += take; if (!Admin.infAmmo) s.reserve -= take; } }
    if (c.swim || c.downT > 0 || c.chute || (c.vehicle && c.vehicle.air)) return;
    if (In.hit('KeyQ') && !c.vehicle) { this.punch(c); return; }
    if (In.hit('KeyR') && !c.vehicle && !w.melee && s.clip < w.clip && s.reserve > 0 && c.reloadT <= 0) { c.reloadT = w.reload; Audio.reload(); }
    const trigger = w.auto ? In.lmb : In.lmbPressed; if (!trigger || c.fireT > 0) return;
    if (w.melee) { if (!c.vehicle) this.punch(c); return; }
    if (c.reloadT > 0) return;
    if (s.clip <= 0) { if (s.reserve > 0) { c.reloadT = w.reload; Audio.reload(); } else { Audio.empty(); c.fireT = 0.3; UI.notify('Keine Munition!'); } return; }
    this.shoot(c, w, s);
  },
  punch(c) {
    c.punchT = 0.3; c.fireT = 0.45; c.lastShotT = 0; Audio.punch(); const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    for (const n of NPCS.list) { if (!n.alive) continue; const dx = n.pos.x - c.pos.x, dz = n.pos.z - c.pos.z, d = Math.hypot(dx, dz); if (d < 1.8 && (dx * fx + dz * fz) / (d || 1) > 0.4) { n.damage(CFG.WEAPONS[0].dmg, tmpV3.set(fx, 0, fz), true); n.pos.x += fx * 0.6; n.pos.z += fz * 0.6; if (n.kind === 'cop') Wanted.crime('assault', n.pos); FX.hit(tmpV2.copy(n.pos).setY(n.pos.y + 1.4)); UI.hitmark(); break; } }
  },
  shoot(c, w, s) {
    if (!Admin.infAmmo) s.clip--; c.fireT = w.rate; c.lastShotT = 0;
    const aimPoint = tmpV3.copy(this.aimHit.point);
    const muzzle = c.vehicle ? V3(c.vehicle.pos.x, c.vehicle.pos.y + 1.4, c.vehicle.pos.z) : c.h.muzzle(V3());
    const spreadMul = (c.aiming ? 0.55 : 1) * (c.crouch ? 0.7 : 1) * (Math.hypot(c.vel.x, c.vel.z) > 3 ? 1.5 : 1) * (c.vehicle ? 1.6 : 1);
    const baseDir = V3().subVectors(aimPoint, muzzle).normalize(); let hitAny = false;
    for (let p = 0; p < w.pellets; p++) {
      const d = V3(baseDir.x + rand(-1, 1) * w.spread * spreadMul, baseDir.y + rand(-1, 1) * w.spread * spreadMul, baseDir.z + rand(-1, 1) * w.spread * spreadMul).normalize();
      const h = raycastScene(muzzle, d, w.range, c); FX.tracers.add(muzzle, h.point, col('#ffe9a0')); if (applyHit(h, w.dmg, d, true)) hitAny = true;
    }
    if (hitAny) UI.hitmark();
    FX.muzzle(muzzle, baseDir, true); FX.casing(muzzle, tmpV2.set(Math.cos(c.yaw), 0, -Math.sin(c.yaw)));
    Audio.shot(w.id, 0, 0); Cam.recoil += w.recoil * (c.aiming ? 0.6 : 1); Cam.shake = Math.max(Cam.shake, w.id === 'shotgun' ? 0.25 : 0.06);
    bus.emit('gunshot', { pos: muzzle, byPlayer: true });
  },
  respawn(where) {
    const c = this.active; if (c.vehicle) { const v = c.vehicle; v.driver = null; v.setOccupant(null); scene.add(c.h.group); c.vehicle = null; }
    c.pos.set(where.x, walkHeight(where.x, where.z, 50), where.z); c.yaw = where.yaw || 0; c.vel.set(0, 0, 0); c.health = 100; c.crouch = false; c.swim = false; c.downT = 0; c.chute = false; CHUTE.visible = false; c.h.group.visible = true;
    Cam.yaw = c.yaw + Math.PI; Cam.snap = true;
  },
  teleport(x, z, y = null) {
    const c = this.active; const gh = y ?? Math.max(groundHeight(x, z, 500), terrainHeight(x, z));
    if (c.vehicle) { const v = c.vehicle; v.pos.set(x, v.boat ? 0 : v.air ? gh + (v.onGround ? 0.05 : 0) : gh + 0.1, z); v.vel.set(0, 0, 0); if (!v.boat && terrainHeight(x, z) < -1 && !v.air) { this.exitVehicle(true); c.pos.set(x, 0, z); } }
    else { c.pos.set(x, gh + 0.1, z); c.vel.set(0, 0, 0); }
    Cam.snap = true; UI.notify('⚡ Teleportiert');
  },
};
// Raketen des Jets (zielsuchend)
const Missiles = {
  list: [],
  fire(v) {
    v.axes(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 8), MAT.chrome); m.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(m); scene.add(g);
    const pos = v.pos.clone().addScaledVector(v.up, 1.2).addScaledVector(v.fwd, 4).addScaledVector(v.right, (this.list.length % 2 ? 1 : -1) * 3.5);
    let target = null, best = 0.9; for (const o of VS.list) { if (o === v || o.dead) continue; const d = tmpV2.subVectors(o.pos, pos); const L = d.length(); if (L > 900) continue; const dot = d.normalize().dot(v.fwd); if (dot > best) { best = dot; target = o; } }
    this.list.push({ g, pos, vel: v.vel.clone().addScaledVector(v.fwd, 40), target, t: 0 }); Audio.whoosh(); if (target) UI.notify('🎯 Ziel erfasst');
  },
  update(dt) {
    for (const r of [...this.list]) {
      r.t += dt; const sp = Math.min(260, r.vel.length() + dt * 120);
      if (r.target && !r.target.dead) { const want = tmpV2.subVectors(r.target.pos, r.pos).normalize().multiplyScalar(sp); r.vel.lerp(want, 1 - Math.exp(-dt * 3)); } else r.vel.setLength(sp);
      r.pos.addScaledVector(r.vel, dt); r.g.position.copy(r.pos); r.g.lookAt(tmpV3.copy(r.pos).add(r.vel));
      FX.smoke(r.pos, 1, true, 0.6); FX.fire(r.pos, 1, 0.3);
      let boom = r.t > 8 || r.pos.y < groundHeight(r.pos.x, r.pos.z, r.pos.y);
      for (const o of VS.list) if (!o.dead && o.pos.distanceTo(r.pos) < Math.max(3, o.halfL * 0.6) && r.t > 0.3) { boom = true; o.explode(true); }
      if (!boom && World.query(r.pos.x - 1, r.pos.z - 1, r.pos.x + 1, r.pos.z + 1, _qb).some(b => r.pos.y < b.top && r.pos.y > b.y0)) boom = true;
      if (boom) { doExplosion(r.pos.clone(), true, null); scene.remove(r.g); this.list.splice(this.list.indexOf(r), 1); }
    }
  },
};
function raycastScene(o, d, maxT, ignoreChar) {
  const res = { t: raycastWorld(o, d, maxT), type: 'world', npc: null, vehicle: null, head: false, point: V3() };
  if (res.t >= maxT) res.type = null;
  if (d.y < -1e-4 && o.y > CFG.WATER_Y) { const tw = (o.y - CFG.WATER_Y) / -d.y; if (tw < res.t && terrainHeight(o.x + d.x * tw, o.z + d.z * tw) < CFG.WATER_Y) { res.t = tw; res.type = 'water'; } }
  const sph = (cx, cy, cz, r) => { const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz, b = ox * d.x + oy * d.y + oz * d.z, c2 = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c2; if (disc < 0) return null; const t = -b - Math.sqrt(disc); return t > 0 ? t : null; };
  for (const n of NPCS.list) {
    if (!n.alive || !n.h.group.visible) continue; const crouch = n.state === 'cower';
    const tb = sph(n.pos.x, n.pos.y + (crouch ? 0.7 : 1.1), n.pos.z, 0.42), th = sph(n.pos.x, n.pos.y + (crouch ? 1.25 : 1.68), n.pos.z, 0.16);
    if (th !== null && th < res.t) { res.t = th; res.type = 'npc'; res.npc = n; res.head = true; }
    if (tb !== null && tb < res.t) { res.t = tb; res.type = 'npc'; res.npc = n; res.head = false; }
  }
  const ign = ignoreChar && ignoreChar.vehicle;
  for (const v of VS.list) { if (v === ign || v.sinking) continue; const dx = v.pos.x - o.x, dz = v.pos.z - o.z; if (dx * dx + dz * dz > (maxT + 20) ** 2) continue; const t = v.rayHit(o, d, res.t); if (t !== null && t < res.t) { res.t = t; res.type = 'vehicle'; res.vehicle = v; res.npc = null; } }
  res.point.copy(o).addScaledVector(d, res.t); return res;
}
function applyHit(h, dmg, dir, byPlayer) {
  if (h.type === 'npc') { h.npc.damage(dmg, dir, byPlayer, h.head); FX.hit(h.point); if (byPlayer && h.npc.kind !== 'civ') h.npc.alerted = true; return true; }
  if (h.type === 'vehicle') { const v = h.vehicle; v.damage(dmg * 0.55, byPlayer); FX.sparks(h.point, 5, 4); if (v.isPolice && v.ai && byPlayer) Wanted.crime('shoot_cop', v.pos); if (v.policeHeli && byPlayer) { v.health -= dmg * 0.4; if (v.health <= 0) { v.explode(true); } } return true; }
  if (h.type === 'world') { FX.sparks(h.point, 4, 3); FX.dust(h.point, 1); }
  if (h.type === 'water') FX.splash(h.point, 4);
  return false;
}
function doExplosion(pos0, byPlayer, source) {
  const pos = pos0.clone(); FX.boom(pos); const cd = camera.position.distanceTo(pos); Audio.explosion(cd, NPCS.pan(pos)); Cam.shake = Math.max(Cam.shake, clamp(1.2 - cd / 60, 0, 1));
  for (const n of NPCS.list) { if (!n.alive) continue; const d = n.pos.distanceTo(pos); if (d < 7) n.kill(tmpV2.set(n.pos.x - pos.x, 0, n.pos.z - pos.z).normalize().multiplyScalar(8).setY(6), byPlayer); else if (d < 12) n.damage(30, null, byPlayer); }
  for (const v of VS.list) { if (v === source || v.dead) continue; const d = v.pos.distanceTo(pos); if (d < 10) { v.damage((10 - d) * 14, byPlayer); if (!v.air) { const k = (10 - d) * 1.2; v.vel.x += (v.pos.x - pos.x) / (d || 1) * k; v.vel.z += (v.pos.z - pos.z) / (d || 1) * k; } } }
  const P = Player.active, pd = Player.targetPos().distanceTo(pos); if (pd < 10 && P.vehicle !== source) P.damage((10 - pd) * 9);
  NPCS.panicAround(pos, 45, pos); VS.panicAround(pos, 45); if (byPlayer) Wanted.crime('explosion', pos);
}

// ---------- PICKUPS ----------
const Pickups = {
  list: [],
  init() {
    this.geo = { box: new THREE.BoxGeometry(0.6, 0.6, 0.6), bar: new THREE.BoxGeometry(0.62, 0.16, 0.16), flat: new THREE.BoxGeometry(0.6, 0.12, 0.3) };
    this.mats = { health: std({ color: 0x22aa44, emissive: 0x0a5a1a, emissiveIntensity: 1 }), armor: std({ color: 0x2a6aff, emissive: 0x0a2a8a, emissiveIntensity: 1 }), ammo: std({ color: 0x8a7a3a, emissive: 0x3a3010, emissiveIntensity: 1 }), cash: std({ color: 0x5adf5a, emissive: 0x1a6a1a, emissiveIntensity: 1 }), white: std({ color: 0xffffff, emissive: 0x888888 }) };
    for (const [t, x, z] of PICKUP_SPOTS) this.add(t, x, z, { respawn: 60 });
  },
  add(type, x, z, o = {}) {
    const g = new THREE.Group();
    if (type === 'cash') { for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(this.geo.flat, this.mats.cash); m.position.y = k * 0.13; g.add(m); } }
    else { g.add(new THREE.Mesh(this.geo.box, this.mats[type])); if (type === 'health') { const a = new THREE.Mesh(this.geo.bar, this.mats.white); a.position.z = 0.25; g.add(a); const b = a.clone(); b.rotation.z = Math.PI / 2; g.add(b); } }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: type === 'health' ? 0x44ff66 : type === 'armor' ? 0x4488ff : type === 'cash' ? 0x88ff88 : 0xffcc55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(2, 2, 1); g.add(glow);
    const y = Math.max(walkHeight(x, z, 50), CFG.WATER_Y); g.position.set(x, y + 0.8, z); L1(g); g.traverse(o2 => o2.layers.set(1)); scene.add(g);
    const p = { type, x, z, y, g, value: o.value || 0, respawn: o.respawn || 0, temp: o.temp || 0, active: true, t: 0 }; this.list.push(p); return p;
  },
  update(dt) {
    const c = Player.active, pp = Player.targetPos(), r = c.vehicle ? 2.8 : 1.4;
    for (const p of [...this.list]) {
      p.t += dt; if (!p.active) { if (p.respawn && p.t > p.respawn) { p.active = true; p.g.visible = true; } continue; }
      p.g.rotation.y += dt * 2; p.g.position.y = p.y + 0.8 + Math.sin(p.t * 3) * 0.15;
      if (p.temp && p.t > p.temp) { scene.remove(p.g); this.list.splice(this.list.indexOf(p), 1); continue; }
      if (!GS.playing) continue;
      if (Math.hypot(pp.x - p.x, pp.z - p.z) < r && Math.abs(pp.y - p.y) < 3 && this.collect(p, c)) { Audio.pickup(); if (p.respawn) { p.active = false; p.t = 0; p.g.visible = false; } else { scene.remove(p.g); this.list.splice(this.list.indexOf(p), 1); } }
    }
  },
  collect(p, c) {
    if (p.type === 'health') { if (c.health >= 100) return false; c.health = 100; UI.notify('+ Gesundheit'); }
    else if (p.type === 'armor') { if (c.armor >= 100) return false; c.armor = 100; UI.notify('+ Schutzweste'); }
    else if (p.type === 'ammo') { c.weapons.forEach((s, i) => { const w = CFG.WEAPONS[i]; if (w.reserve) s.reserve = Math.min(w.reserve * 2, s.reserve + Math.ceil(w.clip * 2)); }); UI.notify('+ Munition'); }
    else { const v = p.value || randi(100, 400); GS.addMoney(v); UI.notify(`+ $${v}`); }
    return true;
  },
};
