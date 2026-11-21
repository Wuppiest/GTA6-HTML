
// =====================================================================
//  FAHRZEUGE: Physik (Auto/Motorrad, Boot, Flugzeug, Helikopter) + KI
// =====================================================================
const NOINPUT = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false, pitch: 0, roll: 0, yaw: 0, up: 0, down: 0 };
const PARKINPUT = { ...NOINPUT, handbrake: true, brake: 1, park: true };
const BOAT_VMAX = { speedboat: 31, yacht: 15, fishing: 11, jetski: 23 };
function waveH(x, z, t) { const a = 0.1 + Env.w.wind * 0.12; return a * (Math.sin(x * 0.045 + t * 1.1) + Math.sin(z * 0.06 + t * 0.85) * 0.7 + Math.sin((x + z) * 0.11 + t * 1.7) * 0.25); }
// Pool für KI-Fahrer
const DriverPool = { free: [], get(look) { const h = this.free.pop() || new Humanoid(look); h.setLook(look); h.group.visible = true; return h; }, put(h) { if (h.group.parent) h.group.parent.remove(h.group); scene.add(h.group); h.group.visible = false; this.free.push(h); } };
let _vid = 1;
class Vehicle {
  constructor(type, x, z, yaw, opts = {}) {
    this.id = _vid++; this.type = type; this.spec = CFG.VEHICLES[type]; this.cls = this.spec.cls; this.isBike = !!this.spec.bike; this.boat = this.cls === 'boat'; this.air = this.cls === 'plane' || this.cls === 'heli';
    this.isPolice = !!this.spec.police; this.military = this.air && this.type !== 'plane' || type === 'jet';
    this.color = opts.color || pick(this.spec.colors); this.m = buildVehicleModel(type, this.color); this.group = this.m.group; this.body = this.m.body;
    this.halfL = this.m.len / 2; this.halfW = this.m.wid / 2; this.height = this.m.height;
    this.pos = V3(x, 0, z); this.yaw = yaw; this.q = new THREE.Quaternion().setFromEuler(tmpE.set(0, yaw, 0, 'YXZ'));
    this.pos.y = this.boat ? CFG.WATER_Y : groundHeight(x, z, 50) + (this.air && this.cls === 'plane' ? this.m.gearH - 0 : 0);
    if (this.cls === 'heli' || this.cls === 'plane') this.pos.y = groundHeight(x, z, 50) + 0.02;
    this.vel = V3(); this.w = V3(); this.yawRate = 0; this.steer = 0; this.gear = 1; this.rpm = 900; this.shiftT = 0; this.accLong = 0; this.spin = false; this.pitch = 0; this.roll = 0; this.airborne = false; this.vy = 0;
    this.thr = 0; this.rotorSpin = 0; this.onGround = true; this.vF = 0; this.vL = 0;
    this.health = this.spec.hp; this.dead = false; this.burnT = 0; this.sinking = false; this.deadT = 0; this.flipped = false; this.nitro = 1; this.boosting = false; this.braking = false;
    this.driver = null; this.ai = null; this.input = PARKINPUT; this.sirenOn = false; this.occupant = null; this.missileT = 0; this.gunT = 0;
    this.persistent = !!opts.persistent; this.mission = !!opts.mission; this.spawnPoint = opts.spawnPoint || null; this.lastPlayerHit = -99; this.smokeT = 0; this.skidT = 0;
    scene.add(this.group); this.updateVisual(0);
  }
  get speed() { return this.vel.length(); }
  get hspeed() { return Math.hypot(this.vel.x, this.vel.z); }
  localOf(x, z) { const dx = x - this.pos.x, dz = z - this.pos.z, c = Math.cos(this.yaw), s = Math.sin(this.yaw); return [dx * c - dz * s, dx * s + dz * c]; }
  rayHit(o, d, maxT) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw), ox = o.x - this.pos.x, oz = o.z - this.pos.z;
    tmpV2.set(ox * c - oz * s, o.y - this.pos.y, ox * s + oz * c); tmpV3.set(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
    return rayBox(tmpV2, tmpV3, -this.halfW, this.boat ? -1 : 0, -this.halfL, this.halfW, this.height, this.halfL, maxT);
  }
  setOccupant(h, pose) {
    if (this.occupant && this.occupant !== h) { const o = this.occupant; this.body.remove(o.group); scene.add(o.group); if (o._pool) DriverPool.put(o); }
    this.occupant = h; if (!h) return; this.body.add(h.group); h.group.position.copy(this.m.seat); h.group.rotation.set(0, 0, 0); h.group.visible = true; h.pose = pose || this.m.pose;
  }
  camDist() { return camera.position.distanceTo(this.pos); }
  update(dt, inp) {
    if (this.sinking) { this.pos.y -= dt * 0.8; this.vel.multiplyScalar(0.96); this.pos.addScaledVector(this.vel, dt); this.deadT += dt; if (Math.random() < 0.2) FX.splash(this.pos, 1); return; }
    if (this.dead || this.health <= 0) inp = this.cls === 'car' || this.boat ? PARKINPUT : NOINPUT;
    if (this.cls === 'car') this.updateCar(dt, inp); else if (this.boat) this.updateBoat(dt, inp); else if (this.cls === 'plane') this.updatePlane(dt, inp); else this.updateHeli(dt, inp);
  }
  // --- Auto: Motor, Getriebe, Reifen (Einspurmodell), Gewichtsverlagerung ---
  updateCar(dt, inp) {
    const S = this.spec, m = S.mass + (this.driver ? 80 : 0), g = CFG.GRAVITY, Lw = S.wb, a = Lw * 0.47, b = Lw * 0.53, hcg = this.isBike ? 0.6 : 0.5, Iz = m * Lw * Lw * 0.28;
    const up = this.upg || {}, mu = S.mu * 1.12 * (1 + (up.susp || 0) * 0.06) * (1 - Env.wet * 0.2) * (this.offroad ? 0.8 : 1), rw = S.rw;
    this.steer = damp(this.steer, inp.steer, 7, dt); this.braking = false; this.boosting = false; this.spin = false;
    if (this.flipped) { inp = PARKINPUT; }
    const boost = inp.boost && inp.throttle > 0 && (this.nitro > 0.03 || Admin.infNitro) && !this.flipped;
    if (boost) { if (!Admin.infNitro) this.nitro = Math.max(0, this.nitro - dt * 0.22); this.boosting = true; } else this.nitro = Math.min(1, this.nitro + dt * 0.05);
    const SUB = 4, h = dt / SUB;
    for (let k = 0; k < SUB; k++) {
      const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw), rx = -cs, rz = sn;
      let vLong = this.vel.x * sn + this.vel.z * cs, vLat = this.vel.x * rx + this.vel.z * rz, r = this.yawRate; const sp = Math.abs(vLong);
      if (this.airborne) { this.vel.x *= 1 - 0.02 * h; this.vel.z *= 1 - 0.02 * h; this.yaw += r * h * 0.5; continue; }
      // Getriebe & Motor
      if (this.gear > 0 && inp.brake > 0 && vLong < 0.6 && !inp.throttle && !inp.park) this.gear = -1;
      if (inp.park && this.gear < 0) this.gear = 1;
      if (this.gear < 0 && inp.throttle > 0 && vLong > -0.6) this.gear = 1;
      const ratio = this.gear < 0 ? 3.3 : S.gears[this.gear - 1];
      const wheelRpm = sp / rw * 60 / (2 * Math.PI) * ratio * S.final; this.rpm = Math.max(900, Math.min(S.redline * 1.02, wheelRpm));
      if (this.gear > 0 && this.shiftT <= 0) { if (this.rpm > S.redline * 0.93 && this.gear < S.gears.length) { this.gear++; this.shiftT = 0.22; } else if (this.rpm < S.rpmPeak * 0.5 && this.gear > 1) { this.gear--; this.shiftT = 0.15; } }
      this.shiftT -= h;
      const x = this.rpm / S.rpmPeak, curve = clamp(1 - (x - 1) * (x - 1) * 0.45, 0.35, 1) * (this.rpm >= S.redline ? 0.1 : 1);
      const Nr0 = m * g * a / Lw + m * this.accLong * hcg / Lw, Nf0 = m * g * b / Lw - m * this.accLong * hcg / Lw, Nf = Math.max(0.15 * m * g, Nf0), Nr = Math.max(0.15 * m * g, Nr0);
      let drive = 0, brakeF = 0;
      const pedal = this.gear < 0 ? inp.brake : inp.throttle;
      if (this.shiftT <= 0 && pedal > 0) drive = pedal * S.torque * (1 + (up.engine || 0) * 0.17) * curve * ratio * S.final * 0.86 / rw * (boost ? 1.55 : 1) * (this.gear < 0 ? -0.6 : 1) * (this.health < S.hp * 0.25 ? 0.6 : 1);
      if (this.gear > 0 && inp.brake > 0 && vLong > 0.3) { brakeF = -S.brake * (1 + (up.brakes || 0) * 0.22) * inp.brake; this.braking = true; }
      if (this.gear < 0 && inp.throttle > 0 && vLong < -0.3) { brakeF = S.brake * inp.throttle; this.braking = true; }
      if (inp.handbrake) { brakeF += -Math.sign(vLong) * Math.min(S.brake * 0.5, sp * m * 6); if (sp > 2) this.braking = true; }
      const maxDrive = mu * (this.isBike ? Nr * 1.1 : Nr) * 1.05; if (Math.abs(drive) > maxDrive) { drive = Math.sign(drive) * maxDrive; if (sp < 25) this.spin = true; }
      const drag = -0.5 * 1.2 * S.cd * S.area * vLong * Math.abs(vLong), roll = sp > 0.05 ? -0.015 * m * g * Math.sign(vLong) : 0, slope = -m * g * Math.sin(this.pitch);
      let FL = drive + brakeF + drag + roll + slope; if (Math.abs(brakeF) > 0 && Math.abs(vLong) < 0.4 && !drive) { FL = 0; vLong *= 0.5; }
      // Querkräfte (Schräglaufwinkel)
      const dmax = (this.isBike ? 0.5 : 0.6) / (1 + sp / (this.ai ? 13 : 8.5)); const d = this.steer * dmax, cd = Math.cos(d), sd = Math.sin(d); // KI: mehr Lenkwinkel für Verfolgungen
      const vLatF = vLat - r * a, vLatR = vLat + r * b, wl = vLong * cd - vLatF * sd, wlat = vLong * sd + vLatF * cd;
      const df = S.downforce ? 1 + sp * 0.006 : 1, Cf = 15 * Nf * df, Cr = 21 * Nr * df; // hecklastig → stabil, leichtes Untersteuern
      let Ff = clamp(-Cf * Math.atan2(wlat, Math.abs(wl) + 0.6), -mu * Nf, mu * Nf);
      const rearCap = Math.sqrt(Math.max(0, (mu * Nr * df * 1.12) ** 2 - drive * drive * 0.12)) * (inp.handbrake ? 0.55 : 1) * (this.spin ? 0.85 : 1);
      let Fr = clamp(-Cr * Math.atan2(vLatR, sp + 0.6), -rearCap, rearCap);
      const FfLong = Ff * sd, FfLat = Ff * cd, FLat = FfLat + Fr, FLong = FL + FfLong;
      this.accLong = FLong / m;
      this.vel.x += (sn * FLong + rx * FLat) / m * h; this.vel.z += (cs * FLong + rz * FLat) / m * h;
      r += (-a * FfLat + b * Fr) / Iz * h;
      // Stabilitätskontrolle: Gierrate Richtung Lenkwunsch ziehen, Querrutschen dämpfen (nicht bei Handbremse)
      if (!inp.handbrake && sp > 3) { const rMax = mu * g * 0.92 / sp, target = clamp(vLong * Math.tan(d) / Lw, -rMax, rMax), esc = this.isBike ? 5 : 3.2; r += (target - r) * (1 - Math.exp(-esc * h));
        const vl = this.vel.x * rx + this.vel.z * rz, kill = 1 - Math.exp(-(this.isBike ? 2.5 : 1.6) * h); this.vel.x -= rx * vl * kill; this.vel.z -= rz * vl * kill; }
      if (sp < 3.5) { const kin = vLong * Math.tan(d) / Lw, t = sp / 3.5; r = lerp(kin, r, t); const vl = this.vel.x * rx + this.vel.z * rz; this.vel.x -= rx * vl * (1 - t) * 0.5; this.vel.z -= rz * vl * (1 - t) * 0.5; }
      this.yawRate = r; this.yaw += r * h;
    }
    this.vF = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw); this.vL = this.vel.x * -Math.cos(this.yaw) + this.vel.z * Math.sin(this.yaw);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // Boden: Nick- & Wankwinkel aus vier Kontaktpunkten
    const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw), hl = this.isBike ? 0.7 : this.halfL * 0.62, hw = this.isBike ? 0.05 : this.halfW * 0.8, yq = this.pos.y + 1.0;
    const hF = groundHeight(this.pos.x + sn * hl, this.pos.z + cs * hl, yq), hB = groundHeight(this.pos.x - sn * hl, this.pos.z - cs * hl, yq);
    const hLft = groundHeight(this.pos.x + cs * hw, this.pos.z - sn * hw, yq), hRgt = groundHeight(this.pos.x - cs * hw, this.pos.z + sn * hw, yq);
    const gy = Math.max((hF + hB) / 2, (hLft + hRgt) / 2 - 0.1); this.wheelH = [hF, hB, hLft, hRgt];
    const r0 = Roads.nearest(this.pos.x, this.pos.z, 14); this.offroad = !r0 || r0.d > r0.e.hw + 1;
    if (this.airborne) { this.vy -= CFG.GRAVITY * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= gy) { const imp = -this.vy; this.pos.y = gy; this.airborne = false; this.vy = 0; if (imp > 7) { this.damage(imp * 1.2, false); Audio.impact(imp, this.camDist()); FX.dust(this.pos, 8); if (this === Player.vehicle) Cam.shake = Math.min(1, imp * 0.05); } if (imp > 14 && !this.isBike && Math.abs(this.roll) > 0.5) this.flipped = true; } }
    else { if (gy < this.pos.y - 0.45) this.airborne = true; else { this.vy = clamp((gy - this.pos.y) / Math.max(dt, 1e-3), -15, 25); this.pos.y = gy; } }
    const tp = Math.atan2(hF - hB, hl * 2), tr = Math.atan2(hLft - hRgt, hw * 2 || 1);
    if (!this.airborne) { this.pitch = damp(this.pitch, tp, 14, dt); this.roll = damp(this.roll, this.isBike ? 0 : tr, 12, dt); } else this.pitch = damp(this.pitch, -Math.atan2(-this.vy, Math.max(5, Math.abs(this.vF))) * 0.4, 3, dt);
    if (terrainHeight(this.pos.x, this.pos.z) < -1.2 && this.pos.y < 0.4) this.sink();
    this.collideWorld();
  }
  collideWorld() {
    if (this.sinking) return;
    const r = this.halfW + 0.05, off = Math.max(0, this.halfL - r), sn = Math.sin(this.yaw), cs = Math.cos(this.yaw); let hit = null;
    for (const k of [-1, 0, 1]) { if (k === 0 && off < r) continue; const cx = this.pos.x + sn * off * k, cz = this.pos.z + cs * off * k; tmpV2.set(cx, 0, cz);
      const h = collideCircle(tmpV2, r, this.pos.y + 0.2, Math.min(2, this.height)); if (h) { this.pos.x += tmpV2.x - cx; this.pos.z += tmpV2.z - cz; hit = h; } }
    if (hit) { const vn = this.vel.x * hit.nx + this.vel.z * hit.nz;
      if (vn < 0) { this.vel.x -= hit.nx * vn * 1.3; this.vel.z -= hit.nz * vn * 1.3; const imp = -vn; this.yawRate *= 0.6;
        if (imp > 3) { this.damage(imp * (imp > 14 ? 1.5 : 0.7), this === Player.vehicle); tmpV2.set(this.pos.x - hit.nx * r, this.pos.y + 0.6, this.pos.z - hit.nz * r); FX.sparks(tmpV2, Math.min(20, Math.floor(imp)), 5); Audio.impact(imp, this.camDist()); if (this === Player.vehicle) Cam.shake = Math.min(1, imp * 0.04); }
        if (this.air && imp > 12) this.explode(this === Player.vehicle); } }
  }
  // --- Boot: Schub, Wasserwiderstand, Kielführung, Wellen ---
  updateBoat(dt, inp) {
    const S = this.spec, vmax = BOAT_VMAX[this.type] || 20, m = S.mass, sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
    let vF = this.vel.x * sn + this.vel.z * cs, vL = -this.vel.x * cs + this.vel.z * sn;
    const thrust = (inp.throttle - inp.brake * 0.5) * S.thrust * (inp.boost ? 1.3 : 1); this.boosting = !!inp.boost && inp.throttle > 0;
    const k = S.thrust / m / (vmax * vmax); vF += (thrust / m - k * vF * Math.abs(vF) * (vF < 0 ? 3 : 1)) * dt; vL *= Math.exp(-S.lat * dt);
    this.steer = damp(this.steer, inp.steer, 4, dt); const yr = this.steer * S.turn * clamp(vF / 4, -0.8, 1.3) * (1 - 0.35 * Math.abs(vF) / vmax); this.yawRate = damp(this.yawRate, yr, 3, dt); this.yaw += this.yawRate * dt;
    const s2 = Math.sin(this.yaw), c2 = Math.cos(this.yaw); this.vel.set(s2 * vF - c2 * vL, 0, c2 * vF + s2 * vL); this.vF = vF; this.vL = vL;
    const ox = this.pos.x, oz = this.pos.z; this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const draft = this.type === 'yacht' ? 2.2 : this.type === 'fishing' ? 1.6 : 0.5, th = terrainHeight(this.pos.x, this.pos.z);
    if (th > -draft) { this.pos.x = ox; this.pos.z = oz; this.vel.multiplyScalar(-0.25); if (Math.abs(vF) > 6) { this.damage(Math.abs(vF) * 0.6); Audio.impact(8, this.camDist()); } }
    const B = WS - 30; this.pos.x = clamp(this.pos.x, -B, B); this.pos.z = clamp(this.pos.z, -B, B);
    const t = GameTime, w0 = waveH(this.pos.x, this.pos.z, t), wF = waveH(this.pos.x + s2 * this.halfL, this.pos.z + c2 * this.halfL, t), wB = waveH(this.pos.x - s2 * this.halfL, this.pos.z - c2 * this.halfL, t);
    const plane = clamp(Math.abs(vF) / vmax, 0, 1);
    this.pos.y = damp(this.pos.y, CFG.WATER_Y + w0 + plane * 0.25 * (this.type === 'yacht' ? 0.3 : 1), 6, dt);
    this.pitch = damp(this.pitch, Math.atan2(wF - wB, this.halfL * 2) + plane * 0.1 * (this.type === 'yacht' ? 0.3 : 1), 4, dt);
    this.roll = damp(this.roll, -this.yawRate * Math.abs(vF) * 0.02 + Math.sin(t * 1.3 + this.id) * 0.03 * (1 + Env.w.wind), 3, dt);
    if (Math.abs(vF) > 4 && Math.random() < 0.7) { FX.splash(tmpV2.set(this.pos.x - s2 * this.halfL, 0, this.pos.z - c2 * this.halfL), 2); if (Math.random() < 0.5) FX.splash(tmpV2.set(this.pos.x + s2 * this.halfL * 0.6 + c2 * this.halfW, 0, this.pos.z + c2 * this.halfL * 0.6 - s2 * this.halfW), 1); }
    this.collideWorld();
  }
  axes() { this.fwd = (this.fwd || V3()).set(0, 0, 1).applyQuaternion(this.q); this.up = (this.up || V3()).set(0, 1, 0).applyQuaternion(this.q); this.right = (this.right || V3()).set(-1, 0, 0).applyQuaternion(this.q); }
  // --- Flugzeug (GTA-artig): Geschwindigkeit folgt der Nase, Querneigung lenkt (koordinierte Kurve), Auftrieb ~ Tempo² ---
  updatePlane(dt, inp) {
    const S = this.spec, g = CFG.GRAVITY, vMax = S.vMax || 80, burn = this.boosting ? (S.burner || 1) : 1;
    this.thr = clamp(this.thr + (inp.up - inp.down) * dt * 0.55, 0, 1); this.boosting = inp.boost && this.thr > 0.85 && S.burner > 1 && !this.onGround;
    this.axes(); if (this.spd === undefined) this.spd = this.vel.dot(this.fwd); if (this.sinkV === undefined) this.sinkV = 0;
    // Tempo: Schub gegen Widerstand, Steigflug bremst, Sturzflug beschleunigt
    const target = this.thr * vMax * burn * (this.health < S.hp * 0.3 ? 0.6 : 1), accel = S.accel || 0.25;
    this.spd += ((target - this.spd) * accel - g * this.fwd.y * 0.75) * dt;
    if (this.onGround && (this.thr < 0.05 || inp.brake > 0)) this.spd = Math.max(0, this.spd - (inp.brake > 0 ? 9 : 2.5) * dt);
    this.spd = clamp(this.spd, this.onGround ? -3 : 0, vMax * 1.6);
    const auth = clamp((this.spd - S.vStall * 0.35) / (S.vStall * 0.9), 0, 1), [pr, yr, rr] = S.rates, lift = clamp(this.spd / S.vStall, 0, 1.25);
    this.stall = !this.onGround && this.spd < S.vStall * 0.85;
    if (!this.onGround) {
      // Steuerung: Nicken, Rollen, Seitenruder; ohne Eingabe richtet sich das Flugzeug langsam gerade
      const bank = Math.atan2(-this.right.y, this.up.y); let wp = inp.pitch * pr * auth, wr = inp.roll * rr * Math.max(auth, 0.25), wy = inp.yaw * yr * auth;
      if (!inp.roll) wr -= bank * 0.9 * auth; if (this.stall) wp += (1 - lift) * 1.1; // Nase fällt bei Strömungsabriss
      this.w.x = damp(this.w.x, wp, 5, dt); this.w.z = damp(this.w.z, wr, 6, dt); this.w.y = damp(this.w.y, wy, 4, dt);
      tmpQ.setFromAxisAngle(tmpV1.set(1, 0, 0), this.w.x * dt); this.q.multiply(tmpQ); tmpQ.setFromAxisAngle(tmpV1.set(0, 0, 1), this.w.z * dt); this.q.multiply(tmpQ); tmpQ.setFromAxisAngle(tmpV1.set(0, 1, 0), this.w.y * dt); this.q.multiply(tmpQ);
      // Koordinierte Kurve: Querneigung dreht um die Hochachse der Welt
      const turn = g * Math.tan(clamp(bank, -1.3, 1.3)) / Math.max(18, this.spd) * Math.min(1, lift);
      tmpQ.setFromAxisAngle(tmpV1.set(0, 1, 0), -turn * dt); this.q.premultiply(tmpQ); this.q.normalize(); this.axes();
      // Absinken, wenn der Auftrieb nicht reicht
      const need = g * (1 - Math.min(1, lift * lift) * Math.max(0.3, Math.abs(this.up.y)));
      this.sinkV = damp(this.sinkV, need > 0.05 ? this.sinkV + need * dt * 6 : 0, 1.2, dt); this.sinkV = clamp(this.sinkV, 0, 45);
    } else {
      // Rollen am Boden: Bugrad lenkt, Nase nur bei Abhebetempo anheben
      const steer = (inp.yaw - inp.roll) * 0.6 * clamp(Math.abs(this.spd) / 6, 0.3, 1) * (this.spd < 0 ? -1 : 1), yawH = Math.atan2(this.fwd.x, this.fwd.z) + steer * dt;
      let noseUp = Math.asin(clamp(this.fwd.y, -1, 1)); if (this.spd > S.vStall * 0.95 && inp.pitch < -0.2) noseUp = Math.min(0.3, noseUp + 0.5 * dt); else noseUp = damp(noseUp, 0, 4, dt);
      this.q.setFromEuler(tmpE.set(-noseUp, yawH, 0, 'YXZ')); this.axes(); this.w.set(0, 0, 0); this.sinkV = 0;
    }
    this.vel.copy(this.fwd).multiplyScalar(this.spd); this.vel.y -= this.sinkV;
    this.pos.addScaledVector(this.vel, dt);
    // Boden-/Fahrwerkskontakt: sanfte Landung möglich, harte Aufschläge zerstören
    const gh = groundHeight(this.pos.x, this.pos.z, this.pos.y + 1);
    if (this.pos.y <= gh + 0.02) { const vy = -this.vel.y; this.pos.y = gh + 0.02;
      if (!this.onGround) { const bank = Math.abs(Math.atan2(-this.right.y, this.up.y));
        if (vy > 9 || bank > 0.5 || this.fwd.y < -0.3 || terrainHeight(this.pos.x, this.pos.z) < -0.5) { this.explode(this === Player.vehicle); return; }
        if (vy > 4) { this.damage(vy * 3, false); if (this === Player.vehicle) Cam.shake = 0.5; } this.onGround = true; }
      this.onGround = true;
      if (this.fwd.y > 0.12 && this.spd > S.vStall) { this.onGround = false; this.pos.y = gh + 0.3; } // abheben
    } else if (this.onGround && this.pos.y > gh + 0.5) this.onGround = false;
    if (this.m.prop) this.m.prop.rotation.z += dt * (8 + this.thr * 60);
    if (this.m.burner) this.m.burner.material.opacity = this.boosting ? 0.7 + Math.random() * 0.3 : this.thr > 0.6 ? (this.thr - 0.6) * 0.6 : 0;
    if (this.m.gear) this.m.gear.visible = this.onGround || this.pos.y - gh < 40;
    this.yaw = Math.atan2(this.fwd.x, this.fwd.z); this.vF = this.spd; this.aoa = 0;
    this.airCollide();
  }
  // --- Helikopter: Rotor, Höhe halten, Neigung bestimmt Bewegung ---
  updateHeli(dt, inp) {
    const m = this.spec.mass, g = CFG.GRAVITY;
    this.rotorSpin = this.driver ? Math.min(1, this.rotorSpin + dt * 0.45) : Math.max(0, this.rotorSpin - dt * 0.2);
    const coll = (inp.up - inp.down);
    this.pitch = damp(this.pitch, inp.pitch * 0.5, 2.5, dt); this.roll = damp(this.roll, inp.roll * 0.45, 2.5, dt);
    this.yawRate = damp(this.yawRate, inp.yaw * 1.3, 3, dt); this.yaw += this.yawRate * dt;
    this.q.setFromEuler(tmpE.set(this.pitch, this.yaw, this.roll, 'YXZ')); this.axes();
    const lift = this.rotorSpin < 0.95 ? m * g * this.rotorSpin * 0.9 * (coll > 0 ? 1.1 : 0.9) : m * (g + coll * 7 - this.vel.y * 1.4) / Math.max(0.55, this.up.y);
    const F = tmpV4.copy(this.up).multiplyScalar(Math.max(0, lift) * (this.health < this.spec.hp * 0.3 ? 0.85 : 1)); F.y -= m * g;
    F.x -= this.vel.x * m * 0.1; F.z -= this.vel.z * m * 0.1; F.y -= this.vel.y * m * 0.2;
    this.vel.addScaledVector(F, dt / m); this.pos.addScaledVector(this.vel, dt);
    const gh = groundHeight(this.pos.x, this.pos.z, this.pos.y + 1);
    if (this.pos.y <= gh + 0.02) { const imp = -this.vel.y; this.pos.y = gh + 0.02; if (!this.onGround && (imp > 8 || this.up.y < 0.7 || terrainHeight(this.pos.x, this.pos.z) < -0.5)) { this.explode(this === Player.vehicle); return; } this.onGround = true; this.vel.y = Math.max(0, this.vel.y); this.vel.x *= 0.9; this.vel.z *= 0.9; }
    else this.onGround = false;
    if (this.m.rotor) this.m.rotor.rotation.y += dt * this.rotorSpin * 28; if (this.m.tailRotor) this.m.tailRotor.rotation.x += dt * this.rotorSpin * 40;
    this.vF = this.vel.dot(this.fwd); this.airCollide();
    if (this.rotorSpin > 0.5 && this.pos.y - gh < 10 && Math.random() < 0.4) FX.dust(tmpV2.set(this.pos.x + rand(-5, 5), gh, this.pos.z + rand(-5, 5)), 1);
  }
  airCollide() {
    const r = this.cls === 'heli' ? 4.5 : Math.min(5, this.halfW * 0.7); tmpV2.set(this.pos.x, 0, this.pos.z);
    const h = collideCircle(tmpV2, r, this.pos.y + 0.5, 2.5);
    if (h) { const sp = this.speed; if (sp > (this.cls === 'heli' ? 7 : 15)) { this.explode(this === Player.vehicle); return; } this.pos.x = tmpV2.x; this.pos.z = tmpV2.z; this.vel.multiplyScalar(0.3); }
  }
  flip() { if (!this.boat && !this.air) this.flipped = true; }
  resetUpright() { this.flipped = false; this.airborne = false; this.vel.set(0, 0, 0); this.yawRate = 0; this.pos.y = groundHeight(this.pos.x, this.pos.z) + 0.1; this.pitch = this.roll = 0;
    if (this.air) { this.q.setFromEuler(tmpE.set(0, this.yaw, 0, 'YXZ')); this.w.set(0, 0, 0); } }
  repair() { this.health = this.spec.hp; this.burnT = 0; if (this.dead) return; }
  damage(a, byPlayer = false) {
    if (this.dead || this.sinking) return; if (this === Player.vehicle && Admin.god) return; this.health -= a * (1 - ((this.upg && this.upg.armor) || 0) * 0.2); if (byPlayer) this.lastPlayerHit = GameTime;
    if (this.health <= 0 && this.burnT <= 0) { this.health = 0; this.burnT = 4; if (this.ai) this.ai.panic = 10; }
    if (byPlayer && this.ai && this.ai.mode === 'traffic') this.ai.panic = Math.max(this.ai.panic, 6);
  }
  explode(byPlayer = false) {
    if (this.dead) return; this.dead = true; this.health = 0; this.burnT = 0; this.deadT = 0; this.sirenOn = false;
    this.group.traverse(o => { if (o.isMesh && o.material !== MAT.tire && o.material !== HUMAN_MAT) o.material = MAT.burnt; });
    if (!this.air && !this.boat) { this.vy = 6; this.airborne = true; } this.vel.multiplyScalar(0.3);
    if (this.air && !this.onGround) { this.vel.y = Math.min(this.vel.y, -5); }
    doExplosion(tmpV1.copy(this.pos).setY(this.pos.y + 1), byPlayer, this);
    if (this.driver === Player.active) { if (!Admin.god) { const c = Player.active; Player.exitVehicle(true); c.damage(500); } else Player.exitVehicle(true); }
    else if (this.driver instanceof Character) { const c = this.driver; this.driver = null; c.vehicle = null; this.setOccupant(null); c.pos.copy(this.pos); scene.add(c.h.group); }
    if (this.ai) { this.ai = null; this.setOccupant(null); this.driver = null; }
  }
  sink() {
    this.sinking = true; this.deadT = 0; this.sirenOn = false; FX.splash(this.pos, 16); Audio.impact(12, this.camDist());
    if (this.driver === Player.active) { Player.exitVehicle(true); UI.notify('Fahrzeug versenkt!'); }
    else if (this.driver instanceof Character) { const c = this.driver; c.vehicle = null; this.driver = null; this.setOccupant(null); c.pos.copy(this.pos); scene.add(c.h.group); }
    if (this.ai) { this.ai = null; this.driver = null; this.setOccupant(null); }
  }
  updateVisual(dt) {
    const g = this.group; g.position.copy(this.pos);
    if (this.air) g.quaternion.copy(this.q);
    else { g.rotation.order = 'YXZ'; g.rotation.set(-this.pitch, this.yaw, this.roll); if (this.boat) g.rotation.z = this.roll; }
    if (this.cls === 'car') {
      // Federung & Karosserie-Neigung (Wanken/Nicken aus Beschleunigungen)
      const lean = this.isBike ? clamp(-this.yawRate * Math.abs(this.vF) * 0.05, -0.75, 0.75) : clamp(this.yawRate * Math.abs(this.vF) * 0.004, -0.07, 0.07);
      this.bodyRoll = damp(this.bodyRoll || 0, lean, 6, dt); this.bodyPitch = damp(this.bodyPitch || 0, this.isBike ? 0 : clamp(this.accLong * 0.006, -0.05, 0.05), 6, dt);
      if (this.isBike) { g.rotation.z = this.bodyRoll; } else { this.body.rotation.z = this.bodyRoll; this.body.rotation.x = this.bodyPitch; }
      if (this.flipped) { this.flipT = Math.min(1, (this.flipT || 0) + dt * 2.5); g.rotation.z = Math.PI * smooth(this.flipT); g.position.y += this.height * smooth(this.flipT); }
      for (const w of this.m.wheels) { w.spin.rotation.x += this.vF / w.rest * dt; if (w.front) w.piv.rotation.y = this.steer * 0.5;
        if (this.wheelH && !this.isBike) { const hi = w.z > 0 ? (w.x > 0 ? (this.wheelH[0] + this.wheelH[2]) / 2 : (this.wheelH[0] + this.wheelH[3]) / 2) : (w.x > 0 ? (this.wheelH[1] + this.wheelH[2]) / 2 : (this.wheelH[1] + this.wheelH[3]) / 2); w.piv.position.y = w.rest + clamp(hi - this.pos.y, -0.12, 0.15) * 0.5; } }
    }
    this.m.tailMat.emissiveIntensity = this.dead ? 0 : this.braking ? 4 : 0.5 + Env.night * 1.2;
    if (this.m.blinkers) { const on = !this.dead && Math.floor(GameTime * 3) % 2 === 0; for (const b of this.m.blinkers.L) b.visible = on && this.blink === -1; for (const b of this.m.blinkers.R) b.visible = on && this.blink === 1; }
    if (this.m.bar) { const on = this.sirenOn && !this.dead, ph = Math.floor(GameTime * 7) % 2; this.m.bar[0].emissiveIntensity = on ? (ph ? 9 : 0.3) : 0.2; this.m.bar[1].emissiveIntensity = on ? (ph ? 0.3 : 9) : 0.2; }
    if (this.occupant) this.occupant.animate(dt, { sit: true, bike: this.occupant.pose === 'bike', speed: 0 });
    if (dt > 0 && !this.sinking) {
      this.smokeT -= dt;
      if (!this.dead && this.health < this.spec.hp * 0.35 && this.smokeT <= 0) { this.smokeT = this.health <= 0 ? 0.05 : 0.18; tmpV2.copy(this.pos).addScaledVector(tmpV3.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), this.halfL * 0.6); tmpV2.y += 1; FX.smoke(tmpV2, 1, this.health > this.spec.hp * 0.15, 0.9); if (this.health <= 0) FX.fire(tmpV2, 2); }
      if (this.dead && this.deadT < 18 && this.smokeT <= 0) { this.smokeT = 0.15; FX.smoke(tmpV2.set(this.pos.x, this.pos.y + 1.2, this.pos.z), 1, false, 1.4); if (this.deadT < 7) FX.fire(tmpV2, 1, 1.2); }
      if (this.cls === 'car' && !this.airborne && !this.dead && ((this.hspeed > 6 && (Math.abs(this.vL) > 4 || (this.input.handbrake && this.hspeed > 8))) || this.spin)) {
        this.skidT -= dt; if (this.skidT <= 0) { this.skidT = 0.03; const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw), wz = this.isBike ? 0.7 : this.halfL * 0.6, wx = this.isBike ? 0 : this.halfW * 0.8;
          for (const sx of this.isBike ? [0] : [-1, 1]) { const x = this.pos.x - sn * wz - cs * wx * sx, z = this.pos.z - cs * wz + sn * wx * sx; FX.skids.add(x, groundHeight(x, z, this.pos.y + 1), z, Math.atan2(this.vel.x, this.vel.z), Math.min(1.6, this.hspeed * 0.03 + 0.3)); if (Math.random() < 0.4) FX.smoke(tmpV2.set(x, this.pos.y + 0.3, z), 1, true, 0.8); } } }
      if (this.air && this.boosting) FX.fire(tmpV2.copy(this.pos).addScaledVector(this.fwd, -this.halfL - 1).setY(this.pos.y + 1.7), 1, 0.6);
    }
  }
  remove() { if (this.occupant) this.setOccupant(null); scene.remove(this.group); this.removed = true; }
}

// ---------- VERKEHRS- & POLIZEI-KI ----------
class VehicleSystem {
  constructor() { this.list = []; this.spawnT = 0; this.copT = 0; this.heli = null; }
  spawn(type, x, z, yaw, opts) { const v = new Vehicle(type, x, z, yaw, opts); this.list.push(v); return v; }
  remove(v) { const i = this.list.indexOf(v); if (i >= 0) this.list.splice(i, 1); v.remove(); }
  spawnParked() { for (const [type, x, z, yaw, color] of PARKED) this.spawn(type, x, z, yaw, { persistent: true, color, spawnPoint: { type, x, z, yaw, color } }); }
  laneOff(e) { return e.hw * 0.45; }
  roadSpawn(focus, minD, maxD, behind = null) {
    const cand = Roads.edges.filter(e => e.type !== 'service' && Math.hypot(e.pts[e.pts.length >> 1].x - focus.x, e.pts[e.pts.length >> 1].z - focus.z) < maxD + e.len / 2);
    for (let t = 0; t < 14 && cand.length; t++) {
      const e = pick(cand), dir = Math.random() < 0.5 ? 1 : -1, s = rand(10, Math.max(11, e.len - 10)); const p = Roads.lanePoint(e, dir, s, this.laneOff(e), V3());
      const d = Math.hypot(p.x - focus.x, p.z - focus.z); if (d < minD || d > maxD) continue;
      if (behind && t < 9 && ((p.x - focus.x) * behind.x + (p.z - focus.z) * behind.z) > 0) continue;
      if (this.list.some(v => Math.abs(v.pos.x - p.x) < 10 && Math.abs(v.pos.z - p.z) < 10)) continue;
      return { x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz), e, dir, s };
    }
    return null;
  }
  makeAI(v, mode, e, dir, s) { v.ai = { mode, e, dir, s, k: 0, next: null, cruise: e.type === 'highway' ? rand(20, 26) : rand(11, 15), panic: 0, stuckT: 0, revT: 0, honkT: 0, waitT: 0, losT: 0, los: false, path: null, pathT: 0 }; v.driver = 'ai'; }
  chooseNext(ai, nodeId) {
    const n = Roads.nodes[nodeId]; let opts = n.edges.filter(i => i !== ai.e.id).map(i => Roads.edges[i]);
    if (ai.path && ai.path.length > 1) { const idx = ai.path.indexOf(nodeId); if (idx >= 0 && idx < ai.path.length - 1) { const e = Roads.edgeBetween(nodeId, ai.path[idx + 1]); if (e) return { e, dir: e.a === nodeId ? 1 : -1 }; } }
    if (!opts.length) opts = [ai.e];
    const e = pick(opts); return { e, dir: e.a === nodeId ? 1 : -1 };
  }
  snapAI(v, ai) { const r = Roads.nearest(v.pos.x, v.pos.z, 120, (e) => e.type !== 'service'); if (!r) return; const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); ai.e = r.e; ai.dir = (r.p.tx * fx + r.p.tz * fz) >= 0 ? 1 : -1; ai.k = ai.dir > 0 ? r.k : r.e.pts.length - 1 - r.k; ai.next = null; }
  track(v, ai) { // Position auf der Kante bestimmen
    const e = ai.e, P = e.pts, n = P.length; let k0 = clamp(ai.k, 0, n - 1), best = k0, bd = 1e9;
    for (let k = Math.max(0, k0 - 4); k <= Math.min(n - 1, k0 + 8); k++) { const kk = ai.dir > 0 ? k : n - 1 - k, p = P[kk], d = (p.x - v.pos.x) ** 2 + (p.z - v.pos.z) ** 2; if (d < bd) { bd = d; best = k; } }
    ai.k = best; ai.s = best / (n - 1) * e.len; return Math.sqrt(bd);
  }
  followRoad(v, ai, dt, cruise) {
    let off = this.track(v, ai); if (off > 25) { this.snapAI(v, ai); off = this.track(v, ai); }
    const e = ai.e, endN = ai.dir > 0 ? e.b : e.a; const look = 6 + v.hspeed * 0.55;
    if (!ai.next) ai.next = this.chooseNext(ai, endN);
    const tgt = tmpV5; if (ai.s + look < e.len) Roads.lanePoint(e, ai.dir, ai.s + look, this.laneOff(e), tgt); else Roads.lanePoint(ai.next.e, ai.next.dir, Math.min(ai.next.e.len, ai.s + look - e.len + 2), this.laneOff(ai.next.e), tgt);
    if (ai.s > e.len - 2.5 || off > 40) { ai.e = ai.next.e; ai.dir = ai.next.dir; ai.k = 0; ai.next = null; if (off > 40) this.track(v, ai); }
    const diff = wrapAngle(Math.atan2(tgt.x - v.pos.x, tgt.z - v.pos.z) - v.yaw); const cop = ai.mode === 'police'; let target = cruise * (1 - Math.min(cop ? 0.5 : 0.6, Math.abs(diff) * (cop ? 0.6 : 0.9)));
    const node = Roads.nodes[endN], toEnd = e.len - ai.s;
    // Ampel: bei Rot (oder Gelb mit genug Bremsweg) vor der Haltelinie stoppen
    if (!cop && ai.panic <= 0 && Signals.has(endN) && toEnd > node.r - 0.5 && toEnd < node.r + 40) { const st = Signals.state(endN, e.id), stopAt = toEnd - node.r - 3.5;
      if (st === 'r' || (st === 'y' && stopAt > v.hspeed * 1.2)) target = Math.min(target, Math.max(0, stopAt * 0.55)); }
    // Blinker vor dem Abbiegen
    if (ai.next && toEnd < 40) { const P = e.pts, a = ai.dir > 0 ? P[P.length - 1] : P[0], ne = ai.next.e, Q = ne.pts, b = ai.next.dir > 0 ? Q[Math.min(4, Q.length - 1)] : Q[Math.max(0, Q.length - 5)];
      const t1x = a.tx * ai.dir, t1z = a.tz * ai.dir, t2x = b.x - a.x, t2z = b.z - a.z, cr = t1x * t2z - t1z * t2x, l2 = Math.hypot(t2x, t2z) || 1; v.blink = Math.abs(cr / l2) > 0.35 ? (cr > 0 ? 1 : -1) : 0; } else v.blink = 0;
    if (!cop && !Signals.has(endN) && node.edges.length >= 3 && toEnd < 30 && ai.panic <= 0) { target = Math.min(target, 9 + toEnd * 0.3);
      if (toEnd > node.r - 1 && toEnd < node.r + 9) { const busy = this.list.some(o => o !== v && o.ai && o.hspeed > 1.5 && Math.hypot(o.pos.x - node.x, o.pos.z - node.z) < node.r + 2 && o.ai.e !== e);
        if (busy && ai.waitT < 4) { target = 0; ai.waitT += dt; } } else if (toEnd > node.r + 9) ai.waitT = 0; }
    return { diff, target };
  }
  obstacleAhead(v, range) {
    const s = Math.sin(v.yaw), c = Math.cos(v.yaw); let best = range;
    const chk = (x, z, w) => { const rx = x - v.pos.x, rz = z - v.pos.z, al = rx * s + rz * c; if (al <= 0 || al > best) return; const lat = -rx * c + rz * s; if (Math.abs(lat) < w) best = al; };
    for (const o of this.list) if (o !== v && !o.sinking && !o.air) chk(o.pos.x, o.pos.z, 2.2 + o.halfW * 0.3);
    for (const n of NPCS.list) if (n.alive) chk(n.pos.x, n.pos.z, 1.7);
    const P = Player.active; if (!P.vehicle) chk(P.pos.x, P.pos.z, 1.7);
    return best < range ? best : null;
  }
  drive(v, diff, target, inp, steerK = 2.2) {
    inp.steer = clamp(diff * steerK, -1, 1); inp.boost = false; inp.handbrake = false;
    if (v.vF < target - 0.6) { inp.throttle = clamp((target - v.vF) / 5, 0.25, 1); inp.brake = 0; } else if (v.vF > target + 1) { inp.throttle = 0; inp.brake = clamp((v.vF - target) / 6, 0.25, 1); } else { inp.throttle = 0.12; inp.brake = 0; }
  }
  updateTraffic(v, dt) {
    const ai = v.ai, inp = v.aiInput || (v.aiInput = { ...NOINPUT }); ai.panic = Math.max(0, ai.panic - dt);
    let { diff, target } = this.followRoad(v, ai, dt, ai.panic > 0 ? ai.cruise * 1.5 : ai.cruise);
    const ob = this.obstacleAhead(v, 8 + v.hspeed * 1.0); if (ob !== null) { target = Math.min(target, Math.max(0, (ob - 7) * 0.9)); ai.honkT -= dt; if (ai.honkT <= 0 && v.hspeed < 1) { ai.honkT = rand(4, 8); if (v.camDist() < 40) Audio.click(380); } }
    if (ai.revT > 0) { ai.revT -= dt; Object.assign(inp, NOINPUT); inp.brake = 1; inp.steer = -Math.sign(diff); return inp; }
    if (target > 3 && Math.abs(v.vF) < 0.6 && ob === null) { ai.stuckT += dt; if (ai.stuckT > 3) { ai.revT = 1.4; ai.stuckT = 0; } } else ai.stuckT = Math.max(0, ai.stuckT - dt);
    this.drive(v, diff, target, inp); return inp;
  }
  updatePolice(v, dt) {
    const ai = v.ai, inp = v.aiInput || (v.aiInput = { ...NOINPUT });
    if (Wanted.level === 0) { v.sirenOn = false; ai.mode = 'traffic'; ai.path = null; return this.updateTraffic(v, dt); }
    v.sirenOn = true; const P = Player.active, tgt = Player.targetPos(), tv = Player.targetVel(); const d = Math.hypot(tgt.x - v.pos.x, tgt.z - v.pos.z);
    ai.losT -= dt; if (ai.losT <= 0) { ai.losT = 0.4; ai.los = d < 140 && hasLOS(tmpV2.set(v.pos.x, v.pos.y + 1.3, v.pos.z), tmpV3.set(tgt.x, tgt.y + 1.0, tgt.z)); if (ai.los) Wanted.spot(); }
    let diff, target;
    if ((d < 70 && ai.los) || d < 18) { const lead = clamp(d / 30, 0, 1); diff = wrapAngle(Math.atan2(tgt.x + tv.x * lead - v.pos.x, tgt.z + tv.z * lead - v.pos.z) - v.yaw); target = d > 40 ? 40 : clamp(d * 1.2, 6, 34); }
    else { ai.pathT -= dt; if (ai.pathT <= 0) { ai.pathT = 2.5; const endN = ai.dir > 0 ? ai.e.b : ai.e.a, goal = Roads.nearestNode(tgt.x, tgt.z); ai.path = Roads.path(endN, goal.id); ai.next = null; }
      ({ diff, target } = this.followRoad(v, ai, dt, ai.e.type === 'highway' ? 34 : 26)); }
    const slowTarget = !P.vehicle || P.vehicle.hspeed < 2.5;
    if (d < 16 && slowTarget && !(P.vehicle && P.vehicle.air)) { target = 0; if (!ai.deployed && v.hspeed < 3 && NPCS.count('cop') < 8) { ai.deployed = true; for (const sd of [1, -1]) { const s = Math.sin(v.yaw), c = Math.cos(v.yaw); NPCS.spawn('cop', v.pos.x + c * sd * 2, v.pos.z - s * sd * 2); } } }
    if (ai.revT > 0) { ai.revT -= dt; Object.assign(inp, NOINPUT); inp.brake = 1; inp.steer = -Math.sign(diff); return inp; }
    if (target > 4 && Math.abs(v.vF) < 1) { ai.stuckT += dt; if (ai.stuckT > 1.8) { ai.revT = 1.3; ai.stuckT = 0; } } else ai.stuckT = Math.max(0, ai.stuckT - dt * 0.5);
    const ob = this.obstacleAhead(v, 6 + v.hspeed * 0.5); if (ob !== null && d > 25) target = Math.min(target, Math.max(3, ob - 4));
    this.drive(v, diff, target, inp, 2.6); inp.handbrake = Math.abs(diff) > 1.2 && v.hspeed > 12;
    if (Wanted.level >= 3 && ai.los && d < 40) { ai.shootT = (ai.shootT || 1) - dt; if (ai.shootT <= 0) { ai.shootT = rand(0.8, 1.4); NPCS.enemyShoot(tmpV2.set(v.pos.x, v.pos.y + 1.5, v.pos.z), 7, 0.3); } }
    return inp;
  }
  spawnPolice(focus) {
    const back = tmpV3.set(Math.sin(Cam.yaw), 0, Math.cos(Cam.yaw)); const p = this.roadSpawn(focus, 90, 220, back); if (!p) return;
    const v = this.spawn('police', p.x, p.z, p.yaw); this.makeAI(v, 'police', p.e, p.dir, p.s); v.ai.k = Math.round(p.s / p.e.len * (p.e.pts.length - 1)); v.setOccupant(DriverPool.get({ skin: pick(SKINS), shirt: '#1d2b4a', pants: '#1a2238', hair: '#111a33', hairStyle: 'cap' })); v.occupant._pool = true;
    v.vel.set(Math.sin(p.yaw) * 14, 0, Math.cos(p.yaw) * 14); v.sirenOn = true;
  }
  // Polizeihubschrauber (kinematisch) ab 4 Sternen
  updatePoliceHeli(dt) {
    if (Wanted.level >= 4 && GS.playing && !this.heli) { const f = Player.targetPos(); const h = this.spawn('heli', f.x + 200, f.z + 200, 0, { color: '#1d2b4a' }); h.pos.y = f.y + 80; h.policeHeli = true; h.rotorSpin = 1; h.setOccupant(DriverPool.get({ skin: pick(SKINS), shirt: '#1d2b4a', pants: '#1a2238', hair: '#111', hairStyle: 'cap' })); h.occupant._pool = true; this.heli = h; UI.notify('🚁 Polizeihubschrauber im Anflug!'); }
    const h = this.heli; if (!h) return; if (h.dead || h.removed) { if (h.dead && h.deadT > 10) { this.remove(h); } if (h.removed || h.deadT > 10) this.heli = null; return; }
    if (Wanted.level < 3) { h.vel.set(0, 8, 0); h.pos.addScaledVector(h.vel, dt); if (h.camDist() > 500) { this.remove(h); this.heli = null; } return; }
    const t = Player.targetPos(), want = tmpV2.set(t.x + Math.sin(GameTime * 0.3) * 35, Math.max(t.y, terrainHeight(t.x, t.z)) + 32, t.z + Math.cos(GameTime * 0.3) * 35);
    const dv = tmpV3.subVectors(want, h.pos), dist = dv.length(); const sp = Math.min(45, dist * 0.6); dv.normalize().multiplyScalar(sp);
    h.vel.lerp(dv, 1 - Math.exp(-dt * 1.2)); h.pos.addScaledVector(h.vel, dt); h.pos.y = Math.max(h.pos.y, groundHeight(h.pos.x, h.pos.z) + 15);
    const face = Math.atan2(t.x - h.pos.x, t.z - h.pos.z); h.yaw = turnToward(h.yaw, face, dt * 1.5); h.pitch = clamp(h.vel.dot(tmpV4.set(Math.sin(h.yaw), 0, Math.cos(h.yaw))) * 0.012, -0.3, 0.3);
    h.q.setFromEuler(tmpE.set(h.pitch, h.yaw, 0, 'YXZ')); h.m.rotor.rotation.y += dt * 28; h.m.tailRotor.rotation.x += dt * 40; h.sirenOn = true;
    h.shootT = (h.shootT || 2) - dt; if (h.shootT <= 0 && dist < 90 && hasLOS(tmpV4.copy(h.pos).setY(h.pos.y - 1), tmpV5.set(t.x, t.y + 1, t.z))) { h.shootT = rand(0.25, 0.5); Wanted.spot(); NPCS.enemyShoot(tmpV4.copy(h.pos).setY(h.pos.y - 1), 6, 0.22); }
  }
  update(dt, focus) {
    for (const v of this.list) {
      if (v.policeHeli) { if (v.dead) { v.deadT += dt; v.vel.y -= 9.8 * dt; v.pos.addScaledVector(v.vel, dt); if (v.pos.y < groundHeight(v.pos.x, v.pos.z)) { v.pos.y = groundHeight(v.pos.x, v.pos.z); v.vel.set(0, 0, 0); } } v.updateVisual(dt); continue; }
      if (v.ai) v.input = v.ai.mode === 'police' ? this.updatePolice(v, dt) : this.updateTraffic(v, dt);
      else if (v.driver !== Player.active || !GS.playing || Admin.open) v.input = v.air ? NOINPUT : PARKINPUT;
      v.update(dt, v.input);
      if (!v.dead && v.health <= 0) { v.burnT -= dt; if (v.burnT <= 0) v.explode(v.lastPlayerHit > GameTime - 6); }
      if (v.dead) v.deadT += dt;
    }
    this.updatePoliceHeli(dt);
    this.collisions();
    for (const v of this.list) if (!v.policeHeli) { const far = v.camDist() > 450; v.group.visible = !far || v.air; if (!far || v.air) v.updateVisual(dt); }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.5;
      const traffic = this.list.filter(v => v.ai && v.ai.mode === 'traffic').length, want = Math.round(Q().traffic * Admin.trafficMul);
      const pv = Player.vehicle; const high = pv && pv.air && pv.pos.y - terrainHeight(pv.pos.x, pv.pos.z) > 150;
      if (traffic < want && !high) { const p = this.roadSpawn(focus, 90, 240); if (p) { const type = pickW(TRAFFIC_MIX);
        const v = this.spawn(type, p.x, p.z, p.yaw); this.makeAI(v, 'traffic', p.e, p.dir, p.s); v.ai.k = Math.round(p.s / p.e.len * (p.e.pts.length - 1)); v.setOccupant(DriverPool.get(randomLook('civ'))); v.occupant._pool = true; v.vel.set(Math.sin(p.yaw) * 10, 0, Math.cos(p.yaw) * 10); } }
      for (const v of [...this.list]) {
        const d = Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z);
        if (v === Player.vehicle || v.driver instanceof Character || v.mission || v === this.heli) continue;
        if (v.persistent) { if (((v.dead && v.deadT > 40) || (v.sinking && v.deadT > 6)) && d > 200 && v.spawnPoint) { const sp = v.spawnPoint; this.remove(v); this.spawn(sp.type, sp.x, sp.z, sp.yaw, { persistent: true, color: sp.color, spawnPoint: sp }); } continue; }
        if (d > (v.ai && v.ai.mode === 'police' ? 400 : 330) || (v.sinking && v.deadT > 6) || (v.dead && v.deadT > 45 && d > 60)) this.remove(v);
        else if (!v.ai && !v.driver && d > 250 && !v.dead) this.remove(v);
      }
      if (Wanted.level > 0 && GS.playing) { const need = [0, 1, 2, 3, 4, 6][Wanted.level], have = this.list.filter(v => v.ai && v.ai.mode === 'police' && !v.dead).length; this.copT -= 0.5; if (have < need && this.copT <= 0) { this.copT = 2.5; this.spawnPolice(focus); } }
    }
  }
  collisions() {
    const L = this.list, n = L.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const A = L[a], B = L[b]; if (A.sinking || B.sinking || A.policeHeli || B.policeHeli) continue;
      const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, R = A.halfL + B.halfL; if (dx * dx + dz * dz > R * R || Math.abs(A.pos.y - B.pos.y) > 2) continue;
      const ca = this.circles(A), cb = this.circles(B); let done = false;
      for (const p of ca) { for (const q of cb) {
        const ex = q[0] - p[0], ez = q[1] - p[1], rr = p[2] + q[2], d2 = ex * ex + ez * ez; if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = ex / d, nz = ez / d, ov = rr - d; const ma = A.spec.mass * (A.driver ? 1 : 2.5), mb = B.spec.mass * (B.driver ? 1 : 2.5), sum = ma + mb;
        A.pos.x -= nx * ov * mb / sum; A.pos.z -= nz * ov * mb / sum; B.pos.x += nx * ov * ma / sum; B.pos.z += nz * ov * ma / sum;
        const vrel = (B.vel.x - A.vel.x) * nx + (B.vel.z - A.vel.z) * nz;
        if (vrel < 0) { const j = -(1.3) * vrel / (1 / ma + 1 / mb); A.vel.x -= nx * j / ma; A.vel.z -= nz * j / ma; B.vel.x += nx * j / mb; B.vel.z += nz * j / mb;
          A.yawRate += rand(-0.5, 0.5) * j / ma * 0.1; B.yawRate += rand(-0.5, 0.5) * j / mb * 0.1; const imp = -vrel;
          if (imp > 3) { const byP = A === Player.vehicle || B === Player.vehicle; A.damage(imp * 1.6 * mb / sum, byP); B.damage(imp * 1.6 * ma / sum, byP);
            if (byP) { Cam.shake = Math.min(1, imp * 0.04); const other = A === Player.vehicle ? B : A; if (other.isPolice && other.ai && imp > 5) Wanted.crime('hit_police', other.pos); if (other.ai && other.ai.mode === 'traffic') other.ai.panic = 5; }
            tmpV2.set((p[0] + q[0]) / 2, A.pos.y + 0.6, (p[1] + q[1]) / 2); FX.sparks(tmpV2, Math.min(18, Math.floor(imp)), 5); Audio.impact(imp, camera.position.distanceTo(tmpV2)); } }
        done = true; break; } if (done) break; }
    }
  }
  circles(v) { const r = v.halfW + 0.05, off = Math.max(0, v.halfL - r), s = Math.sin(v.yaw), c = Math.cos(v.yaw); const out = [[v.pos.x + s * off, v.pos.z + c * off, r], [v.pos.x - s * off, v.pos.z - c * off, r]]; if (off > r) out.push([v.pos.x, v.pos.z, r]); return out; }
  panicAround(pos, r) { for (const v of this.list) if (v.ai && v.ai.mode === 'traffic' && v.pos.distanceTo(pos) < r) v.ai.panic = Math.max(v.ai.panic, rand(4, 8)); }
}
// Verkehrsmix: viele Modelle, realistisch gewichtet (Kleinwagen & Limousinen häufig, Lkw selten)
const TRAFFIC_MIX = [['sedan', 12], ['compact', 7], ['sedan2', 10], ['hatch', 7], ['sportsedan', 4], ['taxi', 5], ['taxi2', 4], ['suv', 7], ['suv2', 7], ['luxsuv', 4], ['pickup', 7], ['van', 6], ['boxtruck', 3], ['flatbed', 2], ['stakebed', 1.5], ['sport', 4], ['muscle', 4], ['bike', 6], ['garbage', 0.8], ['ambulance', 0.8]];
function pickW(list) { let t = 0; for (const [, w] of list) t += w; let r = Math.random() * t; for (const [k, w] of list) { if ((r -= w) <= 0) return k; } return list[0][0]; }
const SKINS = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#a8724a', '#ffdbac', '#6b4423'];
const SHIRTS = ['#ff6b8a', '#2ad0c0', '#ffd23a', '#ffffff', '#6a8cff', '#ff8a3a', '#9b59b6', '#1abc9c', '#e74c3c', '#f5f5dc', '#ff2d95', '#87ceeb', '#2ecc71', '#333333', '#6b8e23', '#8b5a2b', '#f4a460', '#b0c4de', '#ffb6c1', '#dda0dd', '#708090', '#ffefd5', '#20b2aa', '#cd5c5c', '#4682b4', '#daa520', '#2f4f4f', '#e9967a', '#f0e68c', '#191970'];
const PANTS = ['#2b3a55', '#f2f2f2', '#c2b280', '#333333', '#5a4a3a', '#1f4f7a', '#e8d8b8', '#6a6a6a', '#3b5b8a', '#22324a', '#7a8aa0', '#5a5a3a', '#1a1a1a', '#7a1a1a', '#8a6a4a', '#4a5a7a'];
const HAIRS = ['#16110d', '#3a1f12', '#8a5a2a', '#d8b060', '#555555', '#a03a1a', '#0d0d0d', '#5a3a20', '#e0c890', '#2a1a10'];
function randomLook(kind) {
  if (kind === 'cop') return { skin: pick(SKINS), shirt: '#2a3f6e', pants: '#1a2238', hair: '#111a33', shoes: '#111', sole: '#111', hairStyle: 'cap', capColor: '#141c33', longSleeve: Math.random() < 0.5, glasses: Math.random() < 0.4, belt: '#111' };
  if (kind === 'gang') return { skin: pick(SKINS), shirt: pick(['#8b0000', '#1a1a1a', '#b01818', '#2a2a2a']), pants: pick(['#1a1a1a', '#2a3550']), hair: '#111', capColor: '#b01818', shoes: '#eee', hairStyle: pick(['cap', 'buzz', 'bald']), longSleeve: Math.random() < 0.4, glasses: Math.random() < 0.3 };
  const female = Math.random() < 0.5, old = Math.random() < 0.13, r = Math.random(), dress = female && Math.random() < 0.28;
  const extra = { pattern: r < 0.55 ? 0 : r < 0.7 ? 1 : r < 0.8 ? 2 : r < 0.92 ? 3 : 4, shirt2: pick(SHIRTS), dress, beard: !female && Math.random() < 0.28, pack: Math.random() < 0.13, packColor: pick(['#2a3a5a', '#1a1a1a', '#8a2a2a', '#3a5a3a', '#c88a2a']),
    hat: Math.random() < (female ? 0.16 : 0.13) ? pick(female ? ['sunhat', 'sunhat', 'beanie'] : ['fedora', 'sunhat', 'beanie']) : null, hatColor: pick(['#d8c08a', '#f0ead8', '#1a1a1a', '#6a4a2a', '#2a3a5a', '#c03030']),
    h: female ? 0.92 + Math.random() * 0.09 : 0.95 + Math.random() * 0.11, w: 0.92 + Math.random() * 0.22 };
  return { ...extra, skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), hair: old ? pick(['#b8b8b8', '#d8d8d8', '#8a8a8a', '#eeeeee']) : pick(HAIRS), capColor: pick(SHIRTS), shoes: pick(['#222', '#eee', '#8a5a2a', '#c03030', '#2a5aa0']), sole: pick(['#e8e4dc', '#222']),
    hairStyle: female ? pick(['ponytail', 'ponytail', 'long', 'bun', 'short']) : pick(['short', 'short', 'buzz', 'cap', 'bald']), female, shorts: !dress && Math.random() < 0.35, longSleeve: Math.random() < 0.25, glasses: Math.random() < 0.3, belt: pick(['#2a2018', '#111', '#6a4a2a']) };
}
