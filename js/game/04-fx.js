// ---------- 12. EFFEKTE: PARTIKEL, LEUCHTSPUREN, REIFENSPUREN, LICHT-POOL ----------
class Particles {
  constructor(max, additive) {
    this.max = max; this.limit = max; this.cursor = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grow = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.a0 = new Float32Array(max); this.bounce = new Uint8Array(max); this.floor = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.uniforms = { uScale: { value: 500 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 pcolor; varying vec3 vC; varying float vA; uniform float uScale; void main(){ vC = pcolor; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.2, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = vA * smoothstep(0.5, 0.15, d); gl_FragColor = vec4(vC, a); }',
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; this.points.layers.set(1); scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, o) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.limit;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = o.color; this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.size[i] = o.size || 0.3; this.life[i] = this.maxLife[i] = o.life || 1; this.grow[i] = o.grow || 0; this.grav[i] = o.gravity || 0; this.drag[i] = o.drag || 0;
    this.a0[i] = o.alpha == null ? 1 : o.alpha; this.alpha[i] = this.a0[i]; this.bounce[i] = o.bounce ? 1 : 0; if (o.bounce) this.floor[i] = groundHeight(x, z, y + 0.5) + 0.04;
  }
  update(dt) {
    const P = this.pos, V = this.vel;
    for (let i = 0; i < this.limit; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      const k = i * 3; V[k + 1] -= this.grav[i] * dt; const dr = Math.max(0, 1 - this.drag[i] * dt); V[k] *= dr; V[k + 1] *= dr; V[k + 2] *= dr;
      P[k] += V[k] * dt; P[k + 1] += V[k + 1] * dt; P[k + 2] += V[k + 2] * dt;
      if (this.bounce[i] && P[k + 1] < this.floor[i]) { P[k + 1] = this.floor[i]; V[k + 1] = Math.abs(V[k + 1]) * 0.35; V[k] *= 0.6; V[k + 2] *= 0.6; }
      this.size[i] += this.grow[i] * dt; const t = this.life[i] / this.maxLife[i]; this.alpha[i] = this.a0[i] * Math.min(1, t * 2.2);
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.pcolor.needsUpdate = true;
  }
  setLimit(n) { this.limit = Math.min(this.max, n); this.cursor %= this.limit; for (let i = this.limit; i < this.max; i++) { this.life[i] = 0; this.alpha[i] = 0; this.size[i] = 0; } }
}
class Tracers {
  constructor(n = 64) {
    this.n = n; this.cur = 0; this.pos = new Float32Array(n * 6); this.colr = new Float32Array(n * 6); this.life = new Float32Array(n); this.base = [];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.colr, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.lines.frustumCulled = false; this.lines.layers.set(1); scene.add(this.lines);
    for (let i = 0; i < n; i++) this.base.push(new THREE.Color());
  }
  add(a, b, color) {
    const i = this.cur; this.cur = (this.cur + 1) % this.n; const k = i * 6;
    this.pos[k] = a.x; this.pos[k + 1] = a.y; this.pos[k + 2] = a.z; this.pos[k + 3] = b.x; this.pos[k + 4] = b.y; this.pos[k + 5] = b.z;
    this.base[i].copy(color); this.life[i] = 0.09; this.lines.geometry.attributes.position.needsUpdate = true;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) { if (this.life[i] > 0) this.life[i] -= dt; const f = Math.max(0, this.life[i] / 0.09), c = this.base[i], k = i * 6;
      this.colr[k] = c.r * f * 0.3; this.colr[k + 1] = c.g * f * 0.3; this.colr[k + 2] = c.b * f * 0.3; this.colr[k + 3] = c.r * f; this.colr[k + 4] = c.g * f; this.colr[k + 5] = c.b * f; }
    this.lines.geometry.attributes.color.needsUpdate = true;
  }
}
class Skids {
  constructor(n = 600) {
    const g = new THREE.PlaneGeometry(0.3, 1); g.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), n);
    const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, z);
    this.mesh.frustumCulled = false; this.mesh.layers.set(1); this.n = n; this.cur = 0; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); scene.add(this.mesh);
  }
  add(x, y, z, yaw, len) {
    this.e.set(0, yaw, 0); this.q.setFromEuler(this.e); this.m.compose(tmpV3.set(x, y + 0.045, z), this.q, tmpV2.set(1, 1, len));
    this.mesh.setMatrixAt(this.cur, this.m); this.cur = (this.cur + 1) % this.n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
// Gepoolte Punktlichter: Straßenlaternen & Neon in Spielernähe (feste Anzahl → keine Shader-Neukompilierung)
class LightPool {
  constructor() { this.lights = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffc880, 0, 30, 1.6); scene.add(l); this.lights.push(l); this.lights[i].userData.target = 0; } this.t = 0; this.cand = []; }
  update(dt, focus, night) {
    this.t -= dt; const n = Q().lights;
    if (this.t <= 0) {
      this.t = 0.4; const c = this.cand; c.length = 0;
      if (night > 0.12) {
        for (const p of World.lampAnchors) { const d = (p.x - focus.x) ** 2 + (p.z - focus.z) ** 2; if (d < 3600) c.push([d, p, null]); }
        for (const a of World.neonAnchors) { const d = (a.pos.x - focus.x) ** 2 + (a.pos.z - focus.z) ** 2; if (d < 3600) c.push([d * 0.8, a.pos, a.color]); }
        c.sort((x, y) => x[0] - y[0]);
      }
      for (let i = 0; i < this.lights.length; i++) { const l = this.lights[i], e = i < n ? c[i] : null;
        if (e) { l.position.copy(e[1]); if (e[2]) { l.color.copy(e[2]); l.userData.target = 22; } else { l.color.setHex(0xffc880); l.userData.target = 30; } } else l.userData.target = 0; }
    }
    for (const l of this.lights) l.intensity = damp(l.intensity, l.userData.target * night, 6, dt);
  }
}
const FX = {
  init() {
    this.add = new Particles(2400, true); this.norm = new Particles(1600, false); this.applyQuality();
    this.tracers = new Tracers(); this.skids = new Skids();
    this.pool = new LightPool();
    this.flashLight = new THREE.PointLight(0xffb060, 0, 22, 2); scene.add(this.flashLight); this.add.points.material.toneMapped = false;
    this.expLight = new THREE.PointLight(0xff7a30, 0, 70, 1.5); scene.add(this.expLight);
    this.head = new THREE.SpotLight(0xfff2d8, 0, 70, 0.5, 0.45, 1.2); scene.add(this.head); scene.add(this.head.target);
    this.c = { spark: new THREE.Color('#ffd27a'), fire: new THREE.Color('#ff7a2a'), fire2: new THREE.Color('#ffcf4a'), smoke: new THREE.Color('#3a3a3a'), smokeL: new THREE.Color('#9a9a9a'), dust: new THREE.Color('#b8a888'), hit: new THREE.Color('#7a1010'), water: new THREE.Color('#d8f4ff'), brass: new THREE.Color('#d8b040'), muzzle: new THREE.Color('#ffe08a'), money: new THREE.Color('#7dff7d') };
  },
  applyQuality() { const n = Q().particles; this.add.setLimit(n); this.norm.setLimit(Math.floor(n * 0.7)); },
  sparks(p, n = 8, power = 6) { for (let i = 0; i < n; i++) this.add.spawn(p.x, p.y, p.z, rand(-1, 1) * power, rand(0.2, 1.4) * power, rand(-1, 1) * power, { color: this.c.spark, size: 0.09, life: rand(0.2, 0.5), gravity: 14, drag: 1, bounce: true }); },
  smoke(p, n = 1, light = false, size = 1.2) { for (let i = 0; i < n; i++) this.norm.spawn(p.x + rand(-0.3, 0.3), p.y, p.z + rand(-0.3, 0.3), rand(-0.4, 0.4), rand(0.8, 2), rand(-0.4, 0.4), { color: light ? this.c.smokeL : this.c.smoke, size: size * rand(0.7, 1.2), life: rand(1.2, 2.4), grow: 1.6, drag: 0.6, alpha: light ? 0.35 : 0.55 }); },
  fire(p, n = 2, s = 1) { for (let i = 0; i < n; i++) this.add.spawn(p.x + rand(-0.5, 0.5) * s, p.y, p.z + rand(-0.5, 0.5) * s, rand(-0.5, 0.5), rand(1.5, 3.5), rand(-0.5, 0.5), { color: Math.random() < 0.5 ? this.c.fire : this.c.fire2, size: rand(0.6, 1.2) * s, life: rand(0.3, 0.7), grow: -0.6, drag: 0.5 }); },
  dust(p, n = 4) { for (let i = 0; i < n; i++) this.norm.spawn(p.x, p.y + 0.1, p.z, rand(-1.5, 1.5), rand(0.5, 1.5), rand(-1.5, 1.5), { color: this.c.dust, size: 0.5, life: rand(0.4, 0.9), grow: 1.2, drag: 2, alpha: 0.5 }); },
  hit(p) { for (let i = 0; i < 6; i++) this.norm.spawn(p.x, p.y, p.z, rand(-1.5, 1.5), rand(-0.5, 1.5), rand(-1.5, 1.5), { color: this.c.hit, size: 0.12, life: 0.35, gravity: 9, alpha: 0.9 }); },
  splash(p, n = 6) { for (let i = 0; i < n; i++) this.add.spawn(p.x, CFG.WATER_Y + 0.05, p.z, rand(-1.5, 1.5), rand(1.5, 4), rand(-1.5, 1.5), { color: this.c.water, size: 0.25, life: rand(0.4, 0.8), gravity: 12, alpha: 0.45 }); },
  muzzle(p, dir, player) {
    for (let i = 0; i < 4; i++) this.add.spawn(p.x + dir.x * i * 0.08, p.y + dir.y * i * 0.08, p.z + dir.z * i * 0.08, dir.x * 2, dir.y * 2, dir.z * 2, { color: this.c.muzzle, size: 0.35 - i * 0.06, life: 0.05 });
    if (player) { this.flashLight.position.copy(p); this.flashLight.intensity = 25; }
  },
  casing(p, right) { this.add.spawn(p.x, p.y, p.z, right.x * 2.5 + rand(-0.5, 0.5), 2.5, right.z * 2.5 + rand(-0.5, 0.5), { color: this.c.brass, size: 0.05, life: 1.2, gravity: 14, bounce: true, alpha: 0.9 }); },
  boom(p) {
    for (let i = 0; i < 46; i++) { const a = rand(0, Math.PI * 2), s = rand(2, 9); this.add.spawn(p.x, p.y + 0.5, p.z, Math.cos(a) * s, rand(1, 8), Math.sin(a) * s, { color: Math.random() < 0.5 ? this.c.fire : this.c.fire2, size: rand(1.2, 2.6), life: rand(0.4, 0.9), grow: 1.5, drag: 2.5 }); }
    for (let i = 0; i < 28; i++) this.norm.spawn(p.x + rand(-1, 1), p.y + rand(0, 2), p.z + rand(-1, 1), rand(-2, 2), rand(1.5, 5), rand(-2, 2), { color: this.c.smoke, size: rand(2, 3.5), life: rand(1.8, 3.4), grow: 2.2, drag: 1.2, alpha: 0.7 });
    this.sparks(tmpV3.copy(p).setY(p.y + 1), 30, 12);
    this.expLight.position.set(p.x, p.y + 2, p.z); this.expLight.intensity = 400;
  },
  update(dt) {
    this.add.update(dt); this.norm.update(dt); this.tracers.update(dt);
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 400); this.expLight.intensity = Math.max(0, this.expLight.intensity - dt * 500);
    const s = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)); this.add.uniforms.uScale.value = s; this.norm.uniforms.uScale.value = s;
  },
};

