
// =====================================================================
//  VICE LEGACY – Solara Island (Three.js + Web Audio) · Kern: Konfiguration, Hilfen, Eingabe
// =====================================================================
const $ = (id) => document.getElementById(id);
// THREE und ADD (Zusatzmodule) stellt js/boot.js global bereit.

// ---------- KONFIGURATION ----------
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const IS_MOBILE = IS_TOUCH && Math.min(screen.width, screen.height) < 1100;
const CFG = {
  WORLD: 2000, GRID: 641, WATER_Y: 0, GRAVITY: 9.81, DAY_LENGTH: 900, START_TIME: 17.3,
  QUALITY: {
    low:    { label: 'Niedrig', pr: 0.8, shadows: false, shadowSize: 1024, reflect: 0,    post: false, msaa: 0, peds: 10, traffic: 8,  particles: 700,  rain: 700,  lights: 2, far: 900,  trees: 0.35, terrainStep: 2, detail: 0 },
    medium: { label: 'Mittel',  pr: 1.0, shadows: true,  shadowSize: 1024, reflect: 512,  post: true,  msaa: 0, peds: 22, traffic: 16, particles: 1400, rain: 1600, lights: 4, far: 1400, trees: 0.7,  terrainStep: 1, detail: 1 },
    high:   { label: 'Hoch',    pr: Math.min(devicePixelRatio || 1, 1.5), shadows: true, shadowSize: 2048, reflect: 768, post: true, msaa: 4, peds: 30, traffic: 22, particles: 2200, rain: 2600, lights: 6, far: 2000, trees: 1, terrainStep: 1, detail: 2 },
    ultra:  { label: 'Ultra',   pr: Math.min(devicePixelRatio || 1, 2), shadows: true, shadowSize: 4096, reflect: 1024, post: true, msaa: 4, peds: 32, traffic: 26, particles: 3000, rain: 3200, lights: 8, far: 2400, trees: 1, terrainStep: 1, detail: 2 },
  },
  WEATHER: [
    { id: 'clear', name: 'Klar', rain: 0, fog: 0, dark: 0, wet: 0, wind: 0.6, turb: 2 },
    { id: 'cloudy', name: 'Bewölkt', rain: 0, fog: 0.25, dark: 0.3, wet: 0, wind: 1.0, turb: 9 },
    { id: 'rain', name: 'Tropenregen', rain: 0.6, fog: 0.45, dark: 0.5, wet: 1, wind: 1.3, turb: 14 },
    { id: 'fog', name: 'Nebel', rain: 0, fog: 0.9, dark: 0.25, wet: 0.2, wind: 0.3, turb: 10 },
    { id: 'storm', name: 'Sturm', rain: 1, fog: 0.6, dark: 0.7, wet: 1, wind: 2.6, turb: 18, lightning: true },
  ],
  // Fahrzeugdatenbank: Autos mit Motor-/Getriebe-/Reifenmodell, Luft- & Wasserfahrzeuge
  VEHICLES: {
    sedan:  { cls: 'car', name: 'Aurora Sedan', mass: 1380, torque: 260, rpmPeak: 4200, redline: 6300, gears: [3.5, 2.1, 1.4, 1.05, 0.85], final: 3.9, rw: 0.32, cd: 0.32, area: 2.2, brake: 11000, mu: 1.0, wb: 2.7, hp: 100, colors: ['#9aa3ad', '#2b4f7a', '#e2e2da', '#5e7b4b', '#7d1f2b', '#2a2a2e', '#c9b27c'] },
    compact: { cls: 'car', name: 'Pico Hatch', mass: 1180, torque: 210, rpmPeak: 4500, redline: 6500, gears: [3.6, 2.1, 1.4, 1.05, 0.86], final: 4.0, rw: 0.31, cd: 0.31, area: 2.05, brake: 10000, mu: 1.0, wb: 2.45, hp: 90, colors: ['#c0392b', '#f4f4f4', '#2b4f7a', '#ffcc00', '#5e7b4b', '#20d0a0'] },
    taxi:   { cls: 'car', name: 'Solara Cab', mass: 1400, torque: 260, rpmPeak: 4200, redline: 6300, gears: [3.5, 2.1, 1.4, 1.05, 0.85], final: 3.9, rw: 0.32, cd: 0.33, area: 2.2, brake: 11000, mu: 1.0, wb: 2.75, hp: 100, colors: ['#ffc21a'] },
    sport:  { cls: 'car', name: 'Cometa GT', mass: 1450, torque: 560, rpmPeak: 5600, redline: 7900, gears: [3.2, 2.2, 1.65, 1.3, 1.05, 0.86], final: 3.8, rw: 0.34, cd: 0.31, area: 2.0, brake: 16000, mu: 1.15, wb: 2.65, hp: 90, downforce: 0.9, colors: ['#d81e2a', '#ffcc00', '#1e90ff', '#ff5fb0', '#f4f4f4', '#20d0a0', '#151515'] },
    muscle: { cls: 'car', name: 'Stallion V8', mass: 1650, torque: 620, rpmPeak: 4200, redline: 6300, gears: [2.9, 1.9, 1.35, 1.0, 0.8], final: 3.6, rw: 0.34, cd: 0.38, area: 2.3, brake: 12500, mu: 0.95, wb: 2.85, hp: 120, colors: ['#ff6a00', '#1a1a1a', '#5a0f8a', '#0a7d4b', '#b01020', '#e8e8e8'] },
    suv:    { cls: 'car', name: 'Ranger XL', mass: 2100, torque: 480, rpmPeak: 3800, redline: 5900, gears: [3.6, 2.2, 1.5, 1.1, 0.85, 0.7], final: 4.1, rw: 0.4, cd: 0.42, area: 3.0, brake: 15000, mu: 0.95, wb: 2.9, hp: 160, colors: ['#222222', '#e6e6e6', '#3a4a5a', '#7a2a2a', '#4a5a3a'] },
    police: { cls: 'car', name: 'Interceptor', mass: 1700, torque: 470, rpmPeak: 4800, redline: 6800, gears: [3.2, 2.1, 1.5, 1.15, 0.92, 0.76], final: 3.9, rw: 0.34, cd: 0.33, area: 2.3, brake: 15000, mu: 1.05, wb: 2.85, hp: 150, colors: ['#111318'], police: true },
    bike:   { cls: 'car', bike: true, name: 'Viper 600', mass: 290, torque: 105, rpmPeak: 9500, redline: 12500, gears: [2.8, 2.0, 1.6, 1.33, 1.15, 1.0], final: 4.7, rw: 0.31, cd: 0.6, area: 0.7, brake: 4200, mu: 1.1, wb: 1.42, hp: 60, colors: ['#e2e2e2', '#d81e2a', '#14a3c7', '#ffb000', '#151515'] },
    speedboat: { cls: 'boat', name: 'Riva Sprint', mass: 1800, thrust: 26000, drag: 1.6, lat: 2.6, turn: 0.9, len: 7.5, wid: 2.5, hp: 120, colors: ['#ffffff', '#0d3b66', '#c1121f'] },
    yacht:     { cls: 'boat', name: 'Solara Majesty', mass: 26000, thrust: 160000, drag: 1.1, lat: 1.8, turn: 0.35, len: 18, wid: 5.2, hp: 400, colors: ['#ffffff'] },
    fishing:   { cls: 'boat', name: 'Pelican Trawler', mass: 9000, thrust: 52000, drag: 1.5, lat: 2.2, turn: 0.45, len: 11, wid: 3.6, hp: 220, colors: ['#2a6f97', '#b23a48', '#3a5a40'] },
    jetski:    { cls: 'boat', name: 'Wave Jet', mass: 380, thrust: 7600, drag: 2.0, lat: 2.4, turn: 1.6, len: 3.0, wid: 1.2, hp: 60, colors: ['#ff2d95', '#22e4ff', '#ffe23a'] },
    jet:    { cls: 'plane', name: 'F-40 Talon', mass: 12000, thrust: 120000, burner: 1.45, wing: 38, cl: 4.6, cd0: 0.025, vStall: 58, vMax: 175, accel: 0.09, rates: [0.75, 0.35, 1.9], len: 15, wid: 10, hp: 180, gearH: 1.7, colors: ['#7a8590'], guns: true },
    plane:  { cls: 'plane', name: 'Skylark 200', mass: 1150, thrust: 5200, burner: 1, wing: 16, cl: 5.0, cd0: 0.035, vStall: 27, vMax: 64, accel: 0.13, rates: [0.65, 0.4, 1.25], len: 8.5, wid: 11, hp: 90, gearH: 1.25, colors: ['#f2f2f2', '#c1121f', '#ffcc00'], prop: true },
    heli:   { cls: 'heli', name: 'Mako MH-6', mass: 2400, len: 12, wid: 2.2, hp: 140, colors: ['#4b5320', '#1d2b4a', '#ffffff'], military: true },
    biplane:  { cls: 'plane', name: 'Barnstormer', mass: 820, thrust: 4200, burner: 1, vStall: 21, vMax: 56, accel: 0.16, rates: [1.0, 0.6, 2.4], len: 7.4, wid: 9.2, hp: 80, gearH: 1.3, colors: ['#c1121f', '#ffcc00', '#1e6fd0', '#2a7a3a'], prop: true },
    seaplane: { cls: 'plane', name: 'Kestrel Float', mass: 1400, thrust: 5600, burner: 1, vStall: 26, vMax: 60, accel: 0.12, rates: [0.6, 0.38, 1.1], len: 9.2, wid: 11.6, hp: 100, gearH: 2.2, colors: ['#f2f2f2', '#ff7a1a', '#1fb5a8'], prop: true, floats: true },
    cargo:    { cls: 'plane', name: 'Atlas C-12', mass: 16000, thrust: 90000, burner: 1, vStall: 38, vMax: 92, accel: 0.07, rates: [0.42, 0.26, 0.85], len: 20, wid: 24, hp: 320, gearH: 2.0, colors: ['#8a929a', '#4b5320', '#f2f2f2'], prop: true },
    bizjet:   { cls: 'plane', name: 'Lumen 650', mass: 9000, thrust: 60000, burner: 1, vStall: 44, vMax: 150, accel: 0.1, rates: [0.6, 0.3, 1.4], len: 17, wid: 15.5, hp: 160, gearH: 1.6, colors: ['#f4f4f4', '#141a2e', '#c9a43a'] },
    airliner: { cls: 'plane', name: 'Solara Air 380', mass: 70000, thrust: 300000, burner: 1, vStall: 60, vMax: 135, accel: 0.05, rates: [0.34, 0.2, 0.6], len: 38, wid: 35, hp: 400, gearH: 2.5, colors: ['#f4f4f4'] },
    newsheli: { cls: 'heli', name: 'Skyline 407', mass: 1900, len: 11, wid: 2, hp: 120, colors: ['#f4f4f4', '#1e6fd0', '#c1121f', '#141414', '#ffcc00'], tilt: 1.05, yawR: 1.1 },
    polmav:   { cls: 'heli', name: 'Polizei-Skyline', mass: 2000, len: 11, wid: 2, hp: 160, colors: ['#1d2b4a'], police: true, tilt: 1.05, yawR: 1.1 },
    cargoheli: { cls: 'heli', name: 'Titan CH-50', mass: 11000, len: 18, wid: 3, hp: 320, colors: ['#4b5320', '#5a5f66'], military: true, tilt: 0.7, yawR: 0.65, lift: 0.75 },
    attackheli: { cls: 'heli', name: 'Hornet AH-9', mass: 5200, len: 14.5, wid: 4.6, hp: 260, colors: ['#3a4a2a', '#2a2d32'], military: true, guns: true, tilt: 1.2, yawR: 1.25, lift: 1.15 },
    blimp:    { cls: 'heli', name: 'Solara Blimp', mass: 6000, len: 42, wid: 11, hp: 260, colors: ['#e8eaee', '#1d2b4a', '#ffcc00'], blimp: true, prop: true },
    airboat:  { cls: 'boat', name: 'Gator Airboat', mass: 700, thrust: 9500, drag: 1.8, lat: 1.6, turn: 1.3, len: 5, wid: 2.4, hp: 80, colors: ['#4b5320', '#3a5a7a', '#8a6a3a'], vmax: 24, draft: 0.15, amph: true },
    sailboat: { cls: 'boat', name: 'Breeze 30', mass: 4200, thrust: 14000, drag: 1.4, lat: 3.2, turn: 0.6, len: 9, wid: 2.9, hp: 140, colors: ['#f4f4f4', '#1d2b4a', '#2a6f97'], vmax: 10, draft: 1.6 },
    policeboat: { cls: 'boat', name: 'Coast Patrol', mass: 2200, thrust: 34000, drag: 1.6, lat: 2.6, turn: 0.95, len: 8, wid: 2.7, hp: 180, colors: ['#1d2b4a'], vmax: 30, draft: 0.6, police: true },
    tug:      { cls: 'boat', name: 'Harbor Tug', mass: 18000, thrust: 120000, drag: 1.2, lat: 2.4, turn: 0.6, len: 12, wid: 4.8, hp: 420, colors: ['#c0392b', '#1d2b4a', '#2a6f97'], vmax: 10, draft: 1.8 },
    catamaran: { cls: 'boat', name: 'Twin Reef', mass: 9000, thrust: 60000, drag: 1.3, lat: 2.8, turn: 0.55, len: 12, wid: 6.4, hp: 240, colors: ['#ffffff'], vmax: 17, draft: 1.0 },
    dinghy:   { cls: 'boat', name: 'Zodiac RIB', mass: 320, thrust: 5200, drag: 2.0, lat: 2.6, turn: 1.4, len: 4, wid: 1.9, hp: 50, colors: ['#ff7a1a', '#3a3d42', '#d81e2a'], vmax: 18, draft: 0.3 },
  },
  WEAPONS: [
    { id: 'fists', name: 'Fäuste', dmg: 18, rate: 0.45, melee: true },
    { id: 'pistol', name: 'Pistole', dmg: 30, rate: 0.26, clip: 12, reserve: 96, spread: 0.012, range: 140, pellets: 1, auto: false, reload: 1.2, recoil: 0.015 },
    { id: 'smg', name: 'MP', dmg: 17, rate: 0.075, clip: 32, reserve: 256, spread: 0.035, range: 110, pellets: 1, auto: true, reload: 1.6, recoil: 0.008 },
    { id: 'shotgun', name: 'Schrotflinte', dmg: 15, rate: 0.85, clip: 6, reserve: 48, spread: 0.085, range: 45, pellets: 8, auto: false, reload: 2.0, recoil: 0.05 },
    { id: 'rifle', name: 'Sturmgewehr', dmg: 32, rate: 0.115, clip: 30, reserve: 180, spread: 0.018, range: 220, pellets: 1, auto: true, reload: 1.9, recoil: 0.012 },
  ],
  CHARACTERS: [
    { id: "kai", name: "Kai", color: "#1fb5a8", skin: "#b97a50", shirt: "#1fb5a8", pants: "#2b3a55", hair: "#16110d", shoes: "#f0f0f0", hairStyle: "short", beard: true },
    { id: 'elena', name: 'Elena', color: '#ff2d95', skin: '#e3ac84', shirt: '#e0337a', pants: '#f4f1ea', hair: '#3a1f12', shoes: '#ffffff', hairStyle: 'ponytail', female: true, shorts: true },
  ],
  CRIMES: { shots: 0.5, assault: 0.6, kill: 1.0, kill_cop: 1.6, carjack: 1.0, steal_police: 2.0, hit_ped: 1.0, hit_police: 0.6, explosion: 1.0, shoot_cop: 1.2, steal_military: 3.0 },
};
const Settings = (() => { const d = { autoRes: true, quality: 'medium', sound: true, volume: 0.7, sens: 1.2, invertY: false, touch: IS_TOUCH };
  try { return Object.assign(d, JSON.parse(localStorage.getItem('vl4_settings') || '{}')); } catch (e) { return d; } })();
if (!CFG.QUALITY[Settings.quality]) Settings.quality = 'medium';
function saveSettings() { try { localStorage.setItem('vl4_settings', JSON.stringify(Settings)); } catch (e) { /* privat */ } }
const Q = () => CFG.QUALITY[Settings.quality];
// Admin-/Debug-Schalter
const Admin = { god: false, infAmmo: false, noWanted: false, noclip: false, oneHit: false, infNitro: false, freezeTime: false, showFps: false, timeScale: 1, trafficMul: 1, pedMul: 1, open: false };

// ---------- HILFSFUNKTIONEN ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapAngle = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const turnToward = (a, b, step) => { const d = wrapAngle(b - a); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; };
const smooth = (t) => t * t * (3 - 2 * t);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const srand = mulberry32(777001);
const sr = (a, b) => a + srand() * (b - a);
const spick = (arr) => arr[Math.floor(srand() * arr.length)];
// Wert-Rauschen + fBm (deterministisch) für Gelände
function hash2(x, z) { let h = x * 374761393 + z * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1); return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1; }
function fbm(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; f *= 2.03; a *= 0.5; } return s; }
const _colCache = new Map();
const col = (hex) => { let c = _colCache.get(hex); if (!c) { c = new THREE.Color(hex); _colCache.set(hex, c); } return c; };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tmpV1 = V3(), tmpV2 = V3(), tmpV3 = V3(), tmpV4 = V3(), tmpV5 = V3();
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpM = new THREE.Matrix4(), tmpCol = new THREE.Color();

// ---------- EVENTBUS & STATEMANAGER ----------
class EventBus { constructor() { this.h = {}; } on(e, f) { (this.h[e] || (this.h[e] = [])).push(f); } emit(e, d) { const l = this.h[e]; if (l) for (const f of l) f(d); } }
const bus = new EventBus();
const STATES = { MENU: 'MENU', PLAYING: 'PLAYING', PAUSED: 'PAUSED', MISSION_ACTIVE: 'MISSION_ACTIVE', WASTED: 'WASTED', BUSTED: 'BUSTED' };
class StateManager {
  constructor() { this.state = STATES.MENU; this.prev = null; this.money = 2500; this.timeScale = 1; this.switching = false; this.started = false; }
  set(s) { if (s === this.state) return; this.prev = this.state; this.state = s; bus.emit('state', s); }
  get playing() { return this.state === STATES.PLAYING || this.state === STATES.MISSION_ACTIVE; }
  get alive() { return this.playing || this.state === STATES.WASTED || this.state === STATES.BUSTED; }
  addMoney(n) { this.money = Math.max(0, Math.round(this.money + n)); }
}
const GS = new StateManager();

// ---------- INPUT (Tastatur, Maus, Touch) ----------
class Input {
  constructor() {
    this.down = new Set(); this.pressed = new Set(); this.mdx = 0; this.mdy = 0; this.lmb = false; this.rmb = false; this.lmbPressed = false;
    this.wheel = 0; this.locked = false; this.dragging = false; this.el = null; this.lockFailed = false;
    this.stick = { x: 0, y: 0, active: false }; this.touchAim = false; this.touchFire = false;
    addEventListener('keydown', (e) => {
      const k = this.norm(e.code);
      if (GS.state !== STATES.MENU && !e.target.closest?.('input,select')) { if (['Tab', 'Space', 'F2', 'Backquote', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(k)) e.preventDefault(); }
      if (!this.down.has(k)) this.pressed.add(k); this.down.add(k);
    });
    addEventListener('keyup', (e) => this.down.delete(this.norm(e.code)));
    addEventListener('blur', () => { this.down.clear(); this.lmb = this.rmb = false; this.dragging = false; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.lmb = false; if (e.button === 2) this.rmb = false; if (!this.lmb && !this.rmb) this.dragging = false; });
    addEventListener('mousemove', (e) => { if (this.locked || this.dragging) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; } });
    document.addEventListener('pointerlockchange', () => { this.locked = !!this.el && document.pointerLockElement === this.el; if (this.locked) this.lockFailed = false; bus.emit('lock', this.locked); });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }
  attach(el) {
    this.el = el;
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.lmb = true; this.lmbPressed = true; } if (e.button === 2) this.rmb = true; this.dragging = true;
      if (GS.playing && !this.locked && !Settings.touch) this.lock();
    });
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  initTouch() {
    const tz = $('touch'); tz.classList.toggle('on', !!Settings.touch && GS.state !== STATES.MENU);
    const sz = $('stickZone'), base = $('stickBase'), knob = $('stickKnob'); let sid = null, ox = 0, oy = 0;
    sz.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; sid = t.identifier; ox = t.clientX; oy = t.clientY; base.style.display = 'block'; base.style.left = ox + 'px'; base.style.top = (oy - sz.getBoundingClientRect().top) + 'px'; this.stick.active = true; Audio.init(); }, { passive: false });
    const mv = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { let dx = (t.clientX - ox) / 60, dy = (t.clientY - oy) / 60; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.stick.x = dx; this.stick.y = dy; knob.style.transform = `translate(${dx * 45}px,${dy * 45}px)`; } };
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; this.stick.x = this.stick.y = 0; this.stick.active = false; base.style.display = 'none'; knob.style.transform = ''; } };
    sz.addEventListener('touchmove', (e) => { e.preventDefault(); mv(e); }, { passive: false }); sz.addEventListener('touchend', end); sz.addEventListener('touchcancel', end);
    const lz = $('lookZone'); const look = new Map();
    lz.addEventListener('touchstart', (e) => { e.preventDefault(); for (const t of e.changedTouches) look.set(t.identifier, [t.clientX, t.clientY]); Audio.init(); }, { passive: false });
    lz.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) { const p = look.get(t.identifier); if (!p) continue; this.mdx += (t.clientX - p[0]) * 1.6; this.mdy += (t.clientY - p[1]) * 1.6; p[0] = t.clientX; p[1] = t.clientY; } }, { passive: false });
    const lend = (e) => { for (const t of e.changedTouches) look.delete(t.identifier); }; lz.addEventListener('touchend', lend); lz.addEventListener('touchcancel', lend);
    for (const b of document.querySelectorAll('.tbtn')) {
      const k = b.dataset.t;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); Audio.init(); b.classList.add('on');
        if (k === 'fire') { this.lmb = true; this.lmbPressed = true; } else if (k === 'aim') { this.touchAim = !this.touchAim; this.rmb = this.touchAim; b.classList.toggle('on', this.touchAim); }
        else if (k === 'wheel' || k === 'emote') { if (typeof Radial !== 'undefined') Radial.toggle(k === 'wheel' ? 'weapon' : 'emote'); else this.wheel += 1; } else { const code = k === 'KeyE2' ? 'KeyE' : k; this.pressed.add(code); this.down.add(code); } }, { passive: false });
      const up = (e) => { e.preventDefault(); if (k !== 'aim') b.classList.remove('on'); if (k === 'fire') this.lmb = false; else if (k !== 'aim' && k !== 'wheel' && k !== 'emote') this.down.delete(k === 'KeyE2' ? 'KeyE' : k); };
      b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    }
  }
  norm(c) { const map = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD', ControlLeft: 'KeyC', ControlRight: 'KeyC', ShiftRight: 'ShiftLeft', Numpad1: 'Digit1', Numpad2: 'Digit2', Numpad3: 'Digit3', Numpad4: 'Digit4', Backquote: 'F2', IntlBackslash: 'F2' }; return map[c] || c; }
  is(k) { return this.down.has(k); }
  hit(k) { return this.pressed.has(k); }
  // analoge Achsen: Tastatur + Touch-Stick
  get ax() { return clamp((this.is('KeyD') ? 1 : 0) - (this.is('KeyA') ? 1 : 0) + this.stick.x, -1, 1); }
  get ay() { return clamp((this.is('KeyW') ? 1 : 0) - (this.is('KeyS') ? 1 : 0) - this.stick.y, -1, 1); }
  endFrame() { this.pressed.clear(); this.mdx = 0; this.mdy = 0; this.lmbPressed = false; this.wheel = 0; }
  lock() { if (!this.el || Settings.touch) return; try { const p = this.el.requestPointerLock(); if (p && p.catch) p.catch(() => { this.lockFailed = true; }); } catch (e) { this.lockFailed = true; } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
const In = new Input();
