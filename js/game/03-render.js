
// =====================================================================
//  RENDERER, POST-PROCESSING, MATERIALIEN, UMGEBUNG (Himmel, Ozean, Licht)
//  Stil: detailreiches Low-Poly mit flacher Schattierung & Vertex-Farben
// =====================================================================
// Flache Schattierung absichern: Splitter-Dreiecke liefern cross(dFdx,dFdy) ≈ 0 → NaN → Bloom verschmiert schwarze Flecken
try { THREE.ShaderChunk.normal_fragment_begin = THREE.ShaderChunk.normal_fragment_begin.replace('vec3 normal = normalize( cross( fdx, fdy ) );', 'vec3 fnC = cross( fdx, fdy ); vec3 normal = dot( fnC, fnC ) > 1e-30 ? normalize( fnC ) : vec3( 0.0, 0.0, 1.0 );'); } catch (e) { console.warn('ShaderChunk', e); }
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: !Q().post, powerPreference: 'high-performance', stencil: false }); }
catch (e) { window.__fatal('WebGL-Renderer konnte nicht erstellt werden', e && e.message); throw e; }
renderer.setPixelRatio(Q().pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = Q().shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('gameRoot').appendChild(renderer.domElement); renderer.domElement.tabIndex = 0;
renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); window.__diag('WebGL-Kontext verloren – bitte Seite neu laden.'); });
In.attach(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.15, 5000); camera.layers.enable(1);
camera.position.set(0, 200, 400);
const L1 = (o) => { o.layers.set(1); return o; };

const Post = {
  composer: null, bloom: null,
  init() {
    if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); this.composer = null; this.bloom = null; }
    const q = Q(); if (!q.post || !ADD.EffectComposer || !ADD.RenderPass || !ADD.OutputPass) return;
    const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: q.msaa });
    const c = this.composer = new ADD.EffectComposer(renderer, rt); c.setPixelRatio(pr); c.setSize(w, h);
    c.addPass(new ADD.RenderPass(scene, camera));
    if (ADD.ShaderPass) c.addPass(new ADD.ShaderPass({ uniforms: { tDiffuse: { value: null } }, // ungültige Werte entfernen, bevor Bloom sie verteilt
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(60.0)), c.a); }' }));
    if (ADD.UnrealBloomPass) { this.bloom = new ADD.UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.3, 0.45, 0.92); c.addPass(this.bloom); }
    c.addPass(new ADD.OutputPass());
    if (ADD.ShaderPass) c.addPass(new ADD.ShaderPass({ // Farbkorrektur: etwas Sättigung, warme Lichter, Vignette
      uniforms: { tDiffuse: { value: null }, sat: { value: 1.15 }, vig: { value: 0.28 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float sat; uniform float vig; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299,0.587,0.114)); c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - 0.5) * 1.05 + 0.5; c.rgb *= vec3(1.02, 1.0, 0.97); float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - vig * smoothstep(0.38, 0.85, d); gl_FragColor = c; }',
    }));
  },
  resize() { if (this.composer) this.composer.setSize(innerWidth, innerHeight); },
  render() { if (this.composer) this.composer.render(); else renderer.render(scene, camera); },
};

// ---------- ASSETS: echte Texturen (KTX2, GPU-komprimiert) & 3D-Modelle (GLB) ----------
const Assets = {
  tex: {}, models: {}, ok: true,
  // Name → ambientCG-Ordner; Karten: c=Farbe, n=Normal, r=Rauheit, e=Leuchten (Fenster nachts)
  TEX: { asphalt: ['Asphalt010', 'cnr'], walk: ['PavingStones029', 'cn'], concrete: ['Concrete034', 'cn'], plaza: ['PavingStones052', 'cn'], grass: ['Grass005', 'cn'], sand: ['Ground060', 'cn'],
    dirt: ['Ground048', 'cn'], rock: ['Rock030', 'cn'], forest: ['Ground037', 'cn'], plaster: ['PaintedPlaster017', 'cn'], roofTile: ['RoofingTiles006', 'cn'], roofSlate: ['RoofingTiles003', 'cn'],
    facGrid: ['Facade006', 'cnr'], fac12: ['Facade012', 'cnre'], fac13: ['Facade013', 'cnre'], fac15: ['Facade015', 'cnre'], fac17: ['Facade017', 'cnre'], facGlass: ['Facade001', 'cnr'],
    brick: ['Bricks025', 'cn'], steel: ['CorrugatedSteel005', 'cnr'], planks: ['Planks011', 'cn'], pool: ['Tiles019', 'cnr'] },
  MODELS: ['cars/normalcar1', 'cars/normalcar2', 'cars/taxi', 'cars/cop', 'cars/sportscar', 'cars/sportscar2', 'cars/suv', 'nature/palmtree-1', 'nature/palmtree-2', 'nature/palmtree-3', 'nature/palmtree-4', 'nature/commontree-1', 'nature/commontree-2', 'nature/commontree-3', 'nature/pinetree-1', 'nature/pinetree-2', 'nature/bush-1', 'nature/bush-2', 'nature/bushberries-1', 'nature/rock-1', 'nature/rock-2', 'nature/rock-3', 'nature/rock-moss-1', 'nature/flowers', 'nature/plant-1',
    'people/superhero-male-fullbody', 'people/superhero-female-fullbody', 'people/hair-simpleparted', 'people/hair-buzzed', 'people/hair-long', 'people/hair-buns', 'people/hair-beard', 'people/hair-buzzedfemale'],
  async load(progress) {
    const MAP = { c: 'color', n: 'normal', r: 'roughness', e: 'emission' }, jobs = [];
    const ktx = new ADD.KTX2Loader().setTranscoderPath('vendor/three/addons/libs/basis/').detectSupport(renderer), gl = new ADD.GLTFLoader();
    let done = 0; const total = Object.values(this.TEX).reduce((a, t) => a + t[1].length, 0) + this.MODELS.length, tick = (what) => { done++; progress && progress(done / total, 'Lade ' + what + ' … (' + done + '/' + total + ')'); };
    for (const [key, [dir, maps]] of Object.entries(this.TEX)) { this.tex[key] = {};
      for (const m of maps) jobs.push(ktx.loadAsync('assets/textures/' + dir + '/' + MAP[m] + '.ktx2').then(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); if (m === 'c' || m === 'e') t.colorSpace = THREE.SRGBColorSpace; this.tex[key][m] = t; tick('Texturen');
      }).catch(err => { console.warn('Textur fehlt', dir, m, err); this.ok = false; tick('Texturen'); })); }
    for (const name of this.MODELS) jobs.push(gl.loadAsync('assets/models/' + name + '.glb').then(g => { this.models[name] = g; tick('Modelle'); }).catch(err => { console.warn('Modell fehlt', name, err); this.ok = false; tick('Modelle'); }));
    await Promise.all(jobs); ktx.dispose();
  },
};

// ---------- TEXTUR-HELFER ----------
function canvasTex(w, h, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
const TEX = {};
TEX.glow = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, { repeat: false });
TEX.waterN = canvasTex(4, 4, (g) => { g.fillStyle = '#8080ff'; g.fillRect(0, 0, 4, 4); }, { srgb: false });

// ---------- MATERIALIEN ----------
const std = (o) => new THREE.MeshStandardMaterial(o);
const lam = (o) => new THREE.MeshLambertMaterial(o);
const NIGHT_U = { value: 0 };
// Fenster: Tagsüber dunkles Glas, nachts leuchten ausgewählte Fenster (zweite Farbattribut-Spur)
function emissiveMat() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = NIGHT_U;
    sh.vertexShader = 'attribute vec3 emis; varying vec3 vEmis;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmis = emis;');
    sh.fragmentShader = 'uniform float uNight; varying vec3 vEmis;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmis * uNight * 0.85;');
  };
  return m;
}
const MAT = {
  solid: lam({ vertexColors: true, flatShading: true }),
  shiny: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 70, specular: 0x555555 }),
  win: emissiveMat(),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  terrain: lam({ vertexColors: true, flatShading: true }),
  road: lam({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  mark: lam({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  leaves: lam({ flatShading: true }), trunk: lam({ color: 0x8a6a48, flatShading: true }), rock: lam({ color: 0x8a8378, flatShading: true }),
  // Fahrzeug-/Figurenteile
  trim: lam({ color: 0x1c1d21, flatShading: true }), glassDark: new THREE.MeshPhongMaterial({ color: 0x24384a, shininess: 120, specular: 0x9aaabb, flatShading: true, transparent: true, opacity: 0.6, depthWrite: false }),
  chrome: new THREE.MeshPhongMaterial({ color: 0xd8dde2, shininess: 140, specular: 0xffffff, flatShading: true }), tire: lam({ color: 0x1a1a1a, flatShading: true }),
  rim: new THREE.MeshPhongMaterial({ color: 0xb8bcc2, shininess: 90, specular: 0xcccccc, flatShading: true }), interior: lam({ color: 0x2a2a2e, flatShading: true }),
  headlight: new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false }), tail: new THREE.MeshBasicMaterial({ color: 0x8a0a0a, toneMapped: false }),
  gun: lam({ color: 0x1e1e22, flatShading: true }), burnt: lam({ color: 0x1a1612, flatShading: true }),
  vehVC: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 80, specular: 0x666666 }),
  vehMatte: lam({ vertexColors: true, flatShading: true }),
};
const _paint = new Map();
function paintMat(hex) { if (!_paint.has(hex)) _paint.set(hex, new THREE.MeshPhongMaterial({ color: hex, flatShading: true, shininess: 90, specular: 0x777777 })); return _paint.get(hex); }
const neonMats = [], neonCache = new Map();
function neonMat(text, color, vertical = false) {
  const key = text + color + vertical; if (neonCache.has(key)) return neonCache.get(key);
  const W = vertical ? 128 : 512, H = vertical ? 512 : 128;
  const tex = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = color;
    const draw = (t, x, y) => { for (let k = 0; k < 3; k++) { g.shadowBlur = 26 - k * 8; g.fillStyle = color; g.fillText(t, x, y); } g.shadowBlur = 0; g.globalAlpha = 0.8; g.fillStyle = '#fff'; g.fillText(t, x, y); g.globalAlpha = 1; };
    if (vertical) { const n = text.length, step = (H - 30) / n; g.font = `bold ${Math.min(80, step * 0.95)}px Impact, "Arial Black", sans-serif`; for (let i = 0; i < n; i++) draw(text[i], W / 2, 15 + step * (i + 0.5)); }
    else { let fs = 84; g.font = `bold ${fs}px Impact, "Arial Black", sans-serif`; while (g.measureText(text).width > W - 50 && fs > 20) { fs -= 4; g.font = `bold ${fs}px Impact, "Arial Black", sans-serif`; } draw(text, W / 2, H / 2 + 4); }
  }, { repeat: false });
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, toneMapped: false, fog: false });
  neonMats.push(m); neonCache.set(key, m); return m;
}

// ---------- UMGEBUNG ----------
const SKY_KF = [ // Zeit, Zenit, Horizont, Nebel, Sonne, Sonnenstärke, Hemi-Himmel, Hemi-Boden, Hemi-Stärke, Nacht
  [0, '#060a1e', '#1b1d40', '#141632', '#8090c0', 0.3, '#3a4a80', '#141018', 0.5, 1],
  [5, '#0d1434', '#3a2a58', '#2a2244', '#8090c0', 0.25, '#3a4070', '#1a1420', 0.5, 1],
  [6.4, '#3a62a8', '#ff9a6c', '#e8a088', '#ffb070', 1.4, '#a0b0d8', '#504038', 0.75, 0.4],
  [8, '#4e94e2', '#bfe0ff', '#cfe2f2', '#fff0d0', 2.6, '#cfe4ff', '#7a6a4a', 1.05, 0],
  [12.5, '#3a86e6', '#cde9ff', '#d4e8f6', '#fffaf0', 3.0, '#d8eaff', '#8a7a58', 1.15, 0],
  [16.5, '#4a88dc', '#ffe6bc', '#efdcc0', '#ffe2b0', 2.6, '#e0e4ff', '#8a6a48', 1.05, 0],
  [18.6, '#43479a', '#ff7a5a', '#f09a7a', '#ff8848', 1.9, '#d0a0c0', '#5a4048', 0.85, 0.25],
  [19.7, '#241a5a', '#c04a8a', '#7a3a7a', '#ff5a7a', 0.6, '#8060b0', '#2a2038', 0.6, 0.75],
  [21, '#090c26', '#2a2050', '#1c1a3a', '#8090c0', 0.3, '#3a4a80', '#141018', 0.5, 1],
  [24, '#060a1e', '#1b1d40', '#141632', '#8090c0', 0.3, '#3a4a80', '#141018', 0.5, 1],
];
class Environment {
  constructor() {
    this.time = CFG.START_TIME; this.wIdx = 0; this.w = { rain: 0, fog: 0, dark: 0, wet: 0, wind: 0.6, turb: 2 }; this.flash = 0; this.lightT = 5; this.night = 0;
    this.kf = SKY_KF.map(k => ({ t: k[0], top: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), fog: new THREE.Color(k[3]), sun: new THREE.Color(k[4]), sunI: k[5], hs: new THREE.Color(k[6]), hg: new THREE.Color(k[7]), hi: k[8], night: k[9] }));
    this.c = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color() };
    this.sunDir = V3(1, 0.3, 0.2).normalize();
    // Himmel: Verlauf + Sonnenscheibe + Halo + Mond
    this.skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: this.sunDir }, sunCol: { value: new THREE.Color() }, night: { value: 0 }, flash: { value: 0 } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; uniform float flash; varying vec3 vD;
        void main(){ vec3 d = normalize(vD); float h = d.y;
          vec3 c = mix(hor, top, pow(clamp(h, 0.0, 1.0), 0.45));
          c = mix(c, hor * 0.82, smoothstep(0.0, -0.25, h));
          float s = max(dot(d, sunDir), 0.0);
          float vis = smoothstep(-0.12, 0.02, sunDir.y);
          c += sunCol * (smoothstep(0.9993, 0.99965, s) * 3.0 + pow(s, 10.0) * 0.32 + pow(s, 3.0) * 0.12 * (1.0 - clamp(sunDir.y * 2.0, 0.0, 1.0))) * vis;
          float m = max(dot(d, -sunDir), 0.0); c += vec3(0.9, 0.93, 1.0) * (smoothstep(0.9994, 0.9997, m) * 1.4 + pow(m, 60.0) * 0.08) * night;
          c += vec3(0.6, 0.65, 0.9) * flash; gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })); this.sky.renderOrder = -10; this.sky.frustumCulled = false; scene.add(this.sky);
    const sp = []; for (let i = 0; i < 2200; i++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.97); sp.push(Math.cos(th) * Math.sin(ph) * 3900, Math.cos(ph) * 3900, Math.sin(th) * Math.sin(ph) * 3900); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); this.stars.frustumCulled = false; scene.add(this.stars);
    // Low-Poly-Wolken
    this.initClouds();
    // Licht
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5); this.sun.castShadow = Q().shadows;
    const sc = this.sun.shadow.camera; sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 10; sc.far = 800; sc.layers.enableAll();
    this.sun.shadow.mapSize.set(Q().shadowSize, Q().shadowSize); this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.06;
    scene.add(this.sun); scene.add(this.sun.target);
    scene.fog = new THREE.Fog(0xcfe2f2, 300, 1600);
    this.initWater(); this.initRain();
  }
  // Weiche Haufenwolken: Billboards aus weichen Wolkenballen (ein Draw Call)
  initClouds() {
    const tex = canvasTex(128, 128, (g) => { g.clearRect(0, 0, 128, 128); for (let k = 0; k < 9; k++) { const x = 64 + sr(-26, 26), y = 70 + sr(-18, 14), r = sr(22, 40), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } }, { repeat: false });
    const pos = [], cor = [], siz = [], shd = [], idx = [];
    for (let i = 0; i < 52; i++) { const cx = sr(-3000, 3000), cz = sr(-3000, 3000), cy = sr(430, 680), n = randi(7, 13), s = sr(55, 115);
      for (let k = 0; k < n; k++) { const px = cx + sr(-1.4, 1.4) * s, py = cy + sr(-0.12, 0.35) * s, pz = cz + sr(-0.9, 0.9) * s, ps = s * sr(0.75, 1.35), b = pos.length / 3;
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(px, py, pz); cor.push(u, v); siz.push(ps); shd.push((py - cy) / s); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('corner', new THREE.Float32BufferAttribute(cor, 2)); g.setAttribute('psize', new THREE.Float32BufferAttribute(siz, 1)); g.setAttribute('shade', new THREE.Float32BufferAttribute(shd, 1)); g.setIndex(idx);
    this.cloudU = { tPuff: { value: tex }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.7, 0.72, 0.78) }, uOpacity: { value: 0.9 } };
    this.cloudMat = new THREE.ShaderMaterial({ uniforms: this.cloudU, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec2 corner; attribute float psize; attribute float shade; varying vec2 vUv; varying float vSh;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xy += corner * psize; vUv = corner * 0.5 + 0.5; vSh = shade; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D tPuff; uniform vec3 uLit; uniform vec3 uShade; uniform float uOpacity; varying vec2 vUv; varying float vSh;
        void main(){ float a = texture2D(tPuff, vUv).a; if (a < 0.01) discard; vec3 c = mix(uShade, uLit, clamp(vUv.y * 0.8 + vSh * 0.4 + 0.1, 0.0, 1.0)); gl_FragColor = vec4(c, a * uOpacity); }` });
    this.clouds = new THREE.Mesh(g, this.cloudMat); this.clouds.frustumCulled = false; this.clouds.renderOrder = -1; scene.add(this.clouds);
  }
  // Stilisierter Ozean: Tiefenabhängige Farbe, Schaumkanten am Ufer, facettierte Wellen, Sonnenreflex
  initWater() {
    const D = new Uint8Array(GN * GN * 4);
    for (let k = 0; k < GN * GN; k++) { const h = HGT[k]; D[k * 4] = clamp(-h / 24, 0, 1) * 255; D[k * 4 + 3] = 255; if (h < 0.5) { const x = -WS + (k % GN) * CELL, z = -WS + Math.floor(k / GN) * CELL; D[k * 4 + 1] = Math.hypot(x - SWAMP.x, z - SWAMP.z) < SWAMP.r * 1.05 ? 255 : inLake(x, z, 30) ? 150 : 0; } }
    const dt = new THREE.DataTexture(D, GN, GN, THREE.RGBAFormat); dt.magFilter = THREE.LinearFilter; dt.minFilter = THREE.LinearFilter; dt.needsUpdate = true;
    this.waterU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uDepth: { value: null }, uDeep: { value: new THREE.Color('#0b4f78') }, uShallow: { value: new THREE.Color('#2fd0c8') }, uSky: { value: new THREE.Color() }, uSunDir: { value: this.sunDir }, uSunCol: { value: new THREE.Color() }, uAmb: { value: 1 }, uWave: { value: 0.6 }, uWS: { value: WS } }]);
    this.waterU.uDepth.value = dt;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterU, transparent: true, fog: true, depthWrite: true,
      vertexShader: `uniform float uTime; uniform float uWave; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
          float a = uWave; w.y += sin(w.x * 0.07 + uTime * 1.1) * 0.35 * a + sin(w.z * 0.09 + uTime * 0.8) * 0.3 * a + sin((w.x + w.z) * 0.16 + uTime * 1.7) * 0.12 * a;
          vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; uniform sampler2D uDepth; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uAmb; uniform float uWS; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          vec3 nC = cross(dFdx(vW), dFdy(vW)); vec3 n = dot(nC, nC) > 1e-30 ? normalize(nC) : vec3(0.0, 1.0, 0.0); if (n.y < 0.0) n = -n;
          vec2 uv = (vW.xz + uWS) / (2.0 * uWS); bool outside = uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0; vec2 dm = outside ? vec2(1.0, 0.0) : texture2D(uDepth, uv).rg; float depth = dm.r * 24.0, murky = dm.g;
          vec3 col = mix(mix(uShallow, uDeep, smoothstep(0.3, 9.0, depth)), mix(vec3(0.30, 0.36, 0.20), vec3(0.10, 0.20, 0.18), smoothstep(0.2, 3.0, depth)), murky) * uAmb;
          vec3 V = normalize(cameraPosition - vW); float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
          col = mix(col, uSky, clamp(fres * 0.75, 0.0, 0.85));
          vec3 H = normalize(V + uSunDir); col += uSunCol * pow(max(dot(n, H), 0.0), 140.0) * 1.6;
          float band = sin(depth * 9.0 - uTime * 2.2 + vW.x * 0.05) * 0.5 + 0.5;
          float foam = (1.0 - smoothstep(0.05, 0.9, depth)) * (0.55 + 0.45 * band) + (1.0 - smoothstep(0.0, 0.25, depth)) * 0.6;
          col = mix(col, vec3(0.94, 0.97, 1.0) * max(uAmb, 0.25), clamp(foam, 0.0, 1.0) * 0.85 * (1.0 - murky * 0.85));
          float alpha = mix(0.55, 0.97, smoothstep(0.0, 2.5, depth));
          gl_FragColor = vec4(col, alpha);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 220, 220).rotateX(-Math.PI / 2), mat); this.water.position.y = CFG.WATER_Y + 0.05; this.water.frustumCulled = false; scene.add(this.water);
    const far = new THREE.Mesh(new THREE.RingGeometry(1480, 9000, 48, 1).rotateX(-Math.PI / 2), mat); far.position.y = CFG.WATER_Y; far.frustumCulled = false; this.water.add(far); far.position.y = -0.05;
  }
  // Umgebungs-Reflexionen (IBL) aus dem aktuellen Himmel: Autolack, Glas, Wasserpfützen spiegeln den Himmel
  updateEnvMap() {
    this.envT = 8; this.envTime = this.time; if (Q().detail <= 0) { scene.environment = null; return; }
    if (!this.pmrem) { this.pmrem = new THREE.PMREMGenerator(renderer); this.envScene = new THREE.Scene(); this.envSky = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), this.sky.material); this.envScene.add(this.envSky);
      this.envGround = new THREE.Mesh(new THREE.CircleGeometry(40, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x555555 })); this.envGround.position.y = -3; this.envScene.add(this.envGround); }
    this.envGround.material.color.copy(this.c.hg).multiplyScalar(0.6 * (1 - this.night * 0.85));
    const old = this.envRT; this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 100); scene.environment = this.envRT.texture; if (old) old.dispose();
  }
  applyQuality() { this.sun.castShadow = Q().shadows; this.envT = 0; }
  get weather() { return CFG.WEATHER[this.wIdx]; }
  get wet() { return this.w.wet; }
  clockStr() { const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  nextTime() { this.time = (this.time + 3) % 24; UI.notify(`☀ Uhrzeit: ${this.clockStr()}`); }
  setWeather(i) { this.wIdx = i % CFG.WEATHER.length; UI.notify(`☁ Wetter: ${this.weather.name}`); if (this.weather.lightning) this.lightT = 1.5; }
  nextWeather() { this.setWeather(this.wIdx + 1); }
  initRain() {
    const N = CFG.QUALITY.ultra.rain; this.rainPos = new Float32Array(N * 6); this.drops = new Float32Array(N * 3); this.rainInit = false;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3)); g.setDrawRange(0, 0);
    this.rain = L1(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaac4dc, transparent: true, opacity: 0.4, depthWrite: false })));
    this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
  }
  updateRain(dt) {
    const n = Math.floor(Q().rain * this.w.rain); if (n < 20) { this.rain.visible = false; return; }
    this.rain.visible = true; const cp = camera.position, d = this.drops, p = this.rainPos, wind = this.w.wind * 2.5;
    if (!this.rainInit) { for (let i = 0; i < d.length / 3; i++) { d[i * 3] = cp.x + rand(-40, 40); d[i * 3 + 1] = cp.y + rand(-15, 25); d[i * 3 + 2] = cp.z + rand(-40, 40); } this.rainInit = true; }
    for (let i = 0; i < n; i++) {
      let x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2]; y -= 30 * dt; x += wind * dt;
      if (y < cp.y - 16 || Math.abs(x - cp.x) > 42 || Math.abs(z - cp.z) > 42) { x = cp.x + rand(-40, 40); y = cp.y + rand(5, 26); z = cp.z + rand(-40, 40); }
      d[i * 3] = x; d[i * 3 + 1] = y; d[i * 3 + 2] = z; const k = i * 6; p[k] = x; p[k + 1] = y; p[k + 2] = z; p[k + 3] = x - wind * 0.03; p[k + 4] = y + 0.75; p[k + 5] = z;
    }
    this.rain.geometry.setDrawRange(0, n * 2); this.rain.geometry.attributes.position.needsUpdate = true;
  }
  update(dt, focus) {
    if (!Admin.freezeTime) this.time = (this.time + dt * 24 / CFG.DAY_LENGTH) % 24;
    const W = this.weather; for (const k of ['rain', 'fog', 'dark', 'wet', 'wind', 'turb']) this.w[k] = damp(this.w[k], W[k], 0.6, dt);
    let a = this.kf[0], b = this.kf[1];
    for (let i = 0; i < this.kf.length - 1; i++) if (this.time >= this.kf[i].t && this.time < this.kf[i + 1].t) { a = this.kf[i]; b = this.kf[i + 1]; break; }
    const t = smooth(clamp((this.time - a.t) / (b.t - a.t), 0, 1)), c = this.c, dark = this.w.dark;
    for (const k of ['top', 'hor', 'fog', 'sun', 'hs', 'hg']) c[k].copy(a[k]).lerp(b[k], t);
    const baseNight = lerp(a.night, b.night, t); this.night = clamp(baseNight + dark * 0.3, 0, 1);
    const grey = tmpCol.setRGB(0.48, 0.5, 0.55).multiplyScalar(1 - baseNight * 0.85);
    c.top.lerp(grey, dark * 0.85); c.hor.lerp(grey, dark * 0.75); c.fog.lerp(grey, Math.max(dark, this.w.fog) * 0.8); c.hs.lerp(grey, dark * 0.5);
    const ang = (this.time - 6.4) / 13.2 * Math.PI; this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.3).normalize();
    this.skyU.top.value.copy(c.top); this.skyU.hor.value.copy(c.hor); this.skyU.sunCol.value.copy(c.sun).multiplyScalar(1 - dark * 0.95); this.skyU.night.value = baseNight * (1 - dark);
    const lightDir = this.sunDir.y > 0.03 ? tmpV1.copy(this.sunDir) : tmpV1.copy(this.sunDir).negate();
    this.sun.color.copy(c.sun); this.sun.intensity = lerp(a.sunI, b.sunI, t) * (1 - dark * 0.8) * clamp(Math.abs(this.sunDir.y) * 5, 0.15, 1) * (scene.environment ? 0.85 : 1);
    this.sun.position.copy(focus).addScaledVector(lightDir, 350); this.sun.target.position.copy(focus);
    this.hemi.color.copy(c.hs); this.hemi.groundColor.copy(c.hg); this.hemi.intensity = lerp(a.hi, b.hi, t) * (1 - dark * 0.3) * (scene.environment ? 0.32 : 1) + this.flash * 3;
    scene.fog.color.copy(c.fog); const far = Q().far * lerp(1, 0.18, this.w.fog) * (1 - this.w.rain * 0.4); scene.fog.far = far; scene.fog.near = far * lerp(0.2, 0.02, this.w.fog);
    // Alles hinter der Nebelwand wegschneiden (spart auf Tablets sehr viel); Himmel passt sich an
    const cf = Math.max(700, Math.min(5000, far * 1.08 + 80)); if (Math.abs(camera.far - cf) > 20) { camera.far = cf; camera.updateProjectionMatrix(); }
    const ss = Math.min(1, cf * 0.9 / 4200); this.sky.scale.setScalar(ss); this.stars.scale.setScalar(ss);
    this.sky.position.copy(camera.position); this.stars.position.copy(camera.position); this.stars.material.opacity = baseNight * (1 - this.w.fog) * (1 - dark);
    this.flash = Math.max(0, this.flash - dt * 3.5); this.skyU.flash.value = this.flash > 0.05 ? this.flash * rand(0.6, 1) : 0;
    // Wolken: driften, Farbe nach Sonnenlicht
    this.clouds.position.x = (this.clouds.position.x + dt * 3 * (0.5 + this.w.wind)) % 2000; this.clouds.position.z = camera.position.z * 0.0;
    const CU = this.cloudU; CU.uLit.value.copy(c.sun).lerp(tmpCol.setRGB(1, 1, 1), 0.6).lerp(tmpCol.setRGB(0.5, 0.52, 0.57), dark).multiplyScalar(lerp(1, 0.2, baseNight));
    CU.uShade.value.copy(c.hor).lerp(CU.uLit.value, 0.45).multiplyScalar(lerp(0.78, 0.5, dark)); CU.uOpacity.value = clamp(0.72 + this.w.turb * 0.02, 0, 0.95);
    // Ozean
    const wu = this.waterU; wu.uTime.value += dt; wu.uSky.value.copy(c.hor).lerp(c.top, 0.3); wu.uSunCol.value.copy(c.sun).multiplyScalar(this.sun.intensity / 2.5 * (this.sunDir.y > 0 ? 1 : 0.3)); wu.uSunDir.value.copy(lightDir);
    wu.uAmb.value = lerp(1, 0.13, this.night); wu.uWave.value = 0.5 + this.w.wind * 0.5;
    this.water.position.x = Math.round(camera.position.x / 15) * 15; this.water.position.z = Math.round(camera.position.z / 15) * 15;
    // Nachtwerte
    const n = this.night; NIGHT_U.value = n; if (WM.glow) WM.glow.color.setScalar(0.75 + n * 0.9); for (const m of neonMats) m.color.setScalar(0.45 + n * 1.1);
    MAT.headlight.color.setScalar(0.8 + n * 1.6); if (_carMat.head) _carMat.head.emissiveIntensity = 0.4 + n * 2.2;
    const wet = this.w.wet; for (const k of ['road', 'walk', 'concrete', 'plaza']) { const m = WM[k]; if (m && m.roughness !== undefined) { m.roughness = lerp((WM_DEF[k] || {}).rough || 0.9, 0.22, wet); m.color.setScalar(1 - wet * 0.3); } }
    this.envT = (this.envT || 0) - dt; if (this.envT <= 0 || Math.abs(this.time - (this.envTime ?? -9)) > 0.4) this.updateEnvMap();
    if (World.palmU) { World.palmU.uTime.value += dt; World.palmU.uWind.value = this.w.wind; }
    renderer.toneMappingExposure = (scene.environment ? 0.95 : 1.12) + n * 0.12;
    if (Post.bloom) { Post.bloom.strength = 0.16 + n * 0.28; Post.bloom.threshold = lerp(0.95, 0.8, n); }
    if (W.lightning) { this.lightT -= dt; if (this.lightT <= 0) { this.lightT = rand(4, 11); this.flash = 1; Audio.thunder(rand(0.3, 1.8)); } }
    this.updateRain(dt);
  }
}
