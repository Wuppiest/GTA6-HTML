// ---------- 6. PROZEDURALE AUDIO-ENGINE (Web Audio API) ----------
const RADIO = [
  null,
  { name: 'Neon Wave FM 88.4', bpm: 104, style: 'synth',  chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] },
  { name: 'Palm Beat 98.1',    bpm: 96,  style: 'dembow', chords: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]] },
];
class AudioEngine {
  constructor() { this.ctx = null; this.station = 0; this.ready = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.applyVolume();
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(this.master);
      this.music = c.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
      const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.initEngine(); this.initAmbient(); this.initSiren(); this.initHorn();
      this.radio = { next: 0, step: 0 }; this.ready = true;
    } catch (e) { console.warn('Audio deaktiviert', e); this.ctx = null; }
  }
  applyVolume() { if (this.master) this.master.gain.value = Settings.sound ? Settings.volume : 0; }
  noiseSrc(loop) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = !!loop; return s; }
  out(pan) { // optionaler Stereo-Panner
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(this.sfx); return p; }
    return this.sfx;
  }
  initEngine() {
    const c = this.ctx, e = this.eng = {};
    e.o1 = c.createOscillator(); e.o1.type = 'sawtooth'; e.o2 = c.createOscillator(); e.o2.type = 'square';
    e.f = c.createBiquadFilter(); e.f.type = 'lowpass'; e.f.frequency.value = 500; e.f.Q.value = 2;
    e.g = c.createGain(); e.g.gain.value = 0;
    e.o1.connect(e.f); e.o2.connect(e.f); e.f.connect(e.g); e.g.connect(this.sfx); e.o1.start(); e.o2.start();
    e.n = this.noiseSrc(true); e.nf = c.createBiquadFilter(); e.nf.type = 'bandpass'; e.nf.frequency.value = 900; e.ng = c.createGain(); e.ng.gain.value = 0;
    e.n.connect(e.nf); e.nf.connect(e.ng); e.ng.connect(this.sfx); e.n.start();
  }
  updateEngine(active, rpm, throttle, kind) {
    if (!this.ready) return; const t = this.ctx.currentTime, e = this.eng;
    const base = kind === 'bike' ? 62 : kind === 'boat' ? 40 : kind === 'sport' ? 50 : kind === 'muscle' ? 34 : 42;
    const f = base + rpm * base * 3.0;
    e.o1.frequency.setTargetAtTime(f, t, 0.05); e.o2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
    e.f.frequency.setTargetAtTime(260 + rpm * 1500 + throttle * 700, t, 0.06);
    e.g.gain.setTargetAtTime(active ? 0.045 + throttle * 0.06 : 0, t, 0.08);
    e.ng.gain.setTargetAtTime(active && kind === 'boat' ? 0.06 + rpm * 0.1 : 0, t, 0.1);
  }
  initAmbient() {
    const c = this.ctx; this.amb = {};
    const mk = (type, freq, q) => { const s = this.noiseSrc(true); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfx); s.start(0, Math.random() * 1.5); return { f, g }; };
    this.amb.wind = mk('lowpass', 380); this.amb.waves = mk('lowpass', 650); this.amb.rain = mk('highpass', 2600); this.amb.city = mk('bandpass', 180, 0.7);
  }
  updateAmbient(time, o) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this.amb.wind.g.gain.setTargetAtTime(0.015 + o.wind * 0.03, t, 0.5);
    this.amb.waves.g.gain.setTargetAtTime(o.waves * (0.05 + 0.04 * Math.sin(time * 0.7)), t, 0.3);
    this.amb.rain.g.gain.setTargetAtTime(o.rain * 0.09, t, 0.5);
    this.amb.city.g.gain.setTargetAtTime(o.city * 0.04, t, 0.5);
  }
  initSiren() {
    const c = this.ctx; this.siren = { o: c.createOscillator(), f: c.createBiquadFilter(), g: c.createGain() };
    const s = this.siren; s.o.type = 'sawtooth'; s.f.type = 'lowpass'; s.f.frequency.value = 2200; s.g.gain.value = 0;
    s.o.connect(s.f); s.f.connect(s.g); s.g.connect(this.sfx); s.o.start();
  }
  updateSiren(vol, time) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    const ph = (time * 0.55) % 1; const wail = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    this.siren.o.frequency.setTargetAtTime(620 + wail * 520, t, 0.03);
    this.siren.g.gain.setTargetAtTime(vol * 0.05, t, 0.1);
  }
  initHorn() {
    const c = this.ctx; this.horn = { g: c.createGain() }; this.horn.g.gain.value = 0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.connect(this.horn.g); this.horn.g.connect(this.sfx);
    for (const fr of [370, 466]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(); }
  }
  setHorn(on) { if (this.ready) this.horn.g.gain.setTargetAtTime(on ? 0.06 : 0, this.ctx.currentTime, 0.02); }
  // --- One-Shots ---
  burst(t0, { freq = 1000, type = 'bandpass', q = 1, gain = 0.5, decay = 0.2, pan = 0, attack = 0.002 }) {
    const c = this.ctx, s = this.noiseSrc(false), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    s.connect(f); f.connect(g); g.connect(this.out(pan)); s.start(t0, Math.random() * 1.5); s.stop(t0 + decay + 0.05);
    return f;
  }
  tone(t0, { f0 = 440, f1 = null, type = 'sine', gain = 0.3, decay = 0.2, pan = 0, dest = null, attack = 0.003 }) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + decay);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    o.connect(g); g.connect(dest || this.out(pan)); o.start(t0); o.stop(t0 + decay + 0.05);
  }
  att(dist) { return 1 / (1 + dist * 0.045); }
  shot(kind, dist = 0, pan = 0) {
    if (!this.ready) return; const a = this.att(dist); if (a < 0.04) return; const t = this.ctx.currentTime;
    const p = { pistol: [1600, 0.6, 0.16], smg: [2100, 0.45, 0.1], shotgun: [900, 0.9, 0.35], rifle: [1300, 0.7, 0.2] }[kind] || [1500, 0.5, 0.15];
    this.burst(t, { freq: p[0], q: 0.8, gain: p[1] * a, decay: p[2], pan });
    this.tone(t, { f0: 160, f1: 40, gain: 0.5 * a * p[1], decay: 0.12 + p[2] * 0.4, pan });
  }
  explosion(dist = 0, pan = 0) {
    if (!this.ready) return; const a = Math.min(1, this.att(dist) * 1.6), t = this.ctx.currentTime;
    const f = this.burst(t, { freq: 1200, type: 'lowpass', q: 0.5, gain: 1.0 * a, decay: 1.6, pan, attack: 0.01 });
    f.frequency.exponentialRampToValueAtTime(120, t + 1.2);
    this.tone(t, { f0: 90, f1: 25, gain: 0.9 * a, decay: 1.1, pan });
  }
  impact(strength, dist = 0) { if (!this.ready) return; const a = this.att(dist); this.burst(this.ctx.currentTime, { freq: 420, type: 'lowpass', gain: Math.min(0.7, strength * 0.035) * a, decay: 0.25 }); }
  punch() { if (!this.ready) return; const t = this.ctx.currentTime; this.burst(t, { freq: 300, type: 'lowpass', gain: 0.5, decay: 0.12 }); this.tone(t, { f0: 120, f1: 60, gain: 0.3, decay: 0.1 }); }
  click(f = 880) { if (!this.ready) return; this.tone(this.ctx.currentTime, { f0: f, gain: 0.12, decay: 0.06, type: 'triangle' }); }
  reload() { if (!this.ready) return; const t = this.ctx.currentTime; this.burst(t, { freq: 3000, gain: 0.25, decay: 0.05 }); this.burst(t + 0.35, { freq: 2500, gain: 0.3, decay: 0.06 }); }
  empty() { this.click(1800); }
  door() { if (!this.ready) return; this.burst(this.ctx.currentTime, { freq: 600, type: 'lowpass', gain: 0.35, decay: 0.15 }); }
  pickup() { if (!this.ready) return; const t = this.ctx.currentTime; [660, 880, 1320].forEach((f, i) => this.tone(t + i * 0.06, { f0: f, gain: 0.15, decay: 0.12, type: 'triangle' })); }
  whoosh() { if (!this.ready) return; const t = this.ctx.currentTime; const f = this.burst(t, { freq: 300, type: 'bandpass', q: 2, gain: 0.35, decay: 1.2, attack: 0.4 }); f.frequency.exponentialRampToValueAtTime(3000, t + 1.0); }
  jingle(ok) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    const notes = ok ? [60, 64, 67, 72, 76] : [67, 63, 60, 55];
    notes.forEach((n, i) => this.tone(t + i * 0.13, { f0: 440 * Math.pow(2, (n - 69) / 12), gain: 0.18, decay: ok ? 0.5 : 0.4, type: ok ? 'square' : 'sawtooth' }));
  }
  wasted() { if (!this.ready) return; const t = this.ctx.currentTime; this.tone(t, { f0: 110, f1: 55, gain: 0.4, decay: 2.5, type: 'sawtooth' }); this.tone(t, { f0: 164, f1: 82, gain: 0.25, decay: 2.5, type: 'sawtooth' }); }
  thunder(delay = 0) { if (!this.ready) return; const t = this.ctx.currentTime + delay; const f = this.burst(t, { freq: 400, type: 'lowpass', gain: 0.9, decay: 3.0, attack: 0.05 }); f.frequency.exponentialRampToValueAtTime(60, t + 2.5); }
  // --- Radio: kleiner Step-Sequencer ---
  setStation(s) { this.station = s; if (this.ready) { this.radio.next = this.ctx.currentTime + 0.05; this.radio.step = 0; } }
  updateRadio(inVehicle) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(inVehicle && this.station ? 0.5 : 0, t, 0.3);
    if (!this.station || !inVehicle) return;
    const st = RADIO[this.station], spb = 60 / st.bpm / 4;
    if (this.radio.next < t - 0.3) this.radio.next = t + 0.02;
    while (this.radio.next < t + 0.15) { this.step(st, this.radio.step, this.radio.next, spb); this.radio.next += spb; this.radio.step = (this.radio.step + 1) % 64; }
  }
  note(m, t, d, type, gain, cutoff) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12); f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f); f.connect(g); g.connect(this.music); o.start(t); o.stop(t + d + 0.05);
  }
  drum(kind, t) {
    if (kind === 'kick') this.tone(t, { f0: 150, f1: 42, gain: 0.8, decay: 0.28, dest: this.music });
    else if (kind === 'snare') { const c = this.ctx, s = this.noiseSrc(false), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + 0.2); }
    else { const c = this.ctx, s = this.noiseSrc(false), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + 0.06); }
  }
  step(st, step, t, spb) {
    const bar = Math.floor(step / 16), s = step % 16, ch = st.chords[bar];
    if (st.style === 'synth') {
      if (s % 4 === 0) this.drum('kick', t);
      if (s === 4 || s === 12) this.drum('snare', t);
      if (s % 2 === 1) this.drum('hat', t);
      if (s % 2 === 0) this.note(ch[0] - 24 + (s % 4 === 2 ? 12 : 0), t, spb * 1.8, 'sawtooth', 0.16, 700);
      this.note(ch[s % 3] + 12 + ((s >> 2) % 2) * 12, t, spb * 0.9, 'square', 0.045, 2400);
      if (s === 0) for (const n of ch) this.note(n, t, spb * 15, 'sawtooth', 0.035, 1200);
    } else {
      if (s === 0 || s === 8) this.drum('kick', t);
      if ([3, 6, 11, 14].includes(s)) this.drum('snare', t);
      if (s % 2 === 0) this.drum('hat', t);
      if ([0, 6, 8, 14].includes(s)) this.note(ch[0] - 24, t, spb * 2.5, 'triangle', 0.3, 500);
      const mel = [0, 2, 1, 2, 0, 1, 2, 1];
      if (s % 2 === 0 && ((step * 7) % 5) !== 0) this.note(ch[mel[(s / 2 + bar) % 8]] + 12, t, spb * 1.5, 'triangle', 0.09, 3000);
    }
  }
}
const Audio = new AudioEngine();
// Fluggeräusche: Jet-Turbine, Rotor-Schlag (LFO), Propeller
AudioEngine.prototype.updateAir = function (kind, thr, boost) {
  if (!this.ready) return; const c = this.ctx, t = c.currentTime;
  if (!this.airV) {
    const A = this.airV = {}; const ns = (type, f, q) => { const s = this.noiseSrc(true), fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; s.connect(fl); s.start(0, Math.random()); return fl; };
    A.jet = c.createGain(); A.jet.gain.value = 0; ns('bandpass', 1700, 0.7).connect(A.jet); A.jet.connect(this.sfx);
    A.rum = c.createGain(); A.rum.gain.value = 0; ns('lowpass', 150).connect(A.rum); A.rum.connect(this.sfx);
    A.heli = c.createGain(); A.heli.gain.value = 0; A.chop = c.createGain(); A.chop.gain.value = 0.5; ns('lowpass', 380).connect(A.chop); A.chop.connect(A.heli); A.heli.connect(this.sfx);
    A.lfo = c.createOscillator(); A.lfo.frequency.value = 10; const la = c.createGain(); la.gain.value = 0.5; A.lfo.connect(la); la.connect(A.chop.gain); A.lfo.start();
    A.prop = c.createGain(); A.prop.gain.value = 0; A.po = c.createOscillator(); A.po.type = 'sawtooth'; const pf = c.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 700; A.po.connect(pf); pf.connect(A.prop); A.prop.connect(this.sfx); A.po.start();
  }
  const A = this.airV;
  A.jet.gain.setTargetAtTime(kind === 'jet' ? 0.03 + thr * 0.07 + (boost ? 0.06 : 0) : 0, t, 0.15);
  A.rum.gain.setTargetAtTime(kind === 'jet' ? 0.1 + thr * 0.2 + (boost ? 0.2 : 0) : 0, t, 0.15);
  A.heli.gain.setTargetAtTime(kind === 'heli' ? 0.12 * thr + 0.02 : 0, t, 0.2); A.lfo.frequency.setTargetAtTime(4 + thr * 9, t, 0.3);
  A.prop.gain.setTargetAtTime(kind === 'prop' ? 0.03 + thr * 0.05 : 0, t, 0.15); A.po.frequency.setTargetAtTime(55 + thr * 85, t, 0.1);
};
