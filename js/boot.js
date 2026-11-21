// =====================================================================
//  VICE LEGACY – Lader: Three.js (lokal), Zusatzmodule, danach die Spielskripte
//  Die Spielskripte sind klassische Skripte und teilen sich den globalen Bereich.
// =====================================================================
const VER = '4.0.0';
const msg = (t) => { const e = document.getElementById('loadMsg'); if (e) e.textContent = t; window.__loadWatch && window.__loadWatch(); };
const bar = (f) => { const e = document.getElementById('loadFill'); if (e) e.style.width = Math.round(f * 100) + '%'; };
window.__loadMsg = msg; window.__loadBar = bar; window.__VER = VER;
try {
  if (window.__webglFail) throw new Error('WebGL nicht verfügbar: ' + window.__webglFail);
  msg('Lade Grafik-Engine …'); bar(0.02);
  const THREE = await import('three');
  const [gltf, ktx2, bgu, sku, comp, rp, bloom, outp, shp] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/KTX2Loader.js'), import('three/addons/utils/BufferGeometryUtils.js'),
    import('three/addons/utils/SkeletonUtils.js'), import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/OutputPass.js'), import('three/addons/postprocessing/ShaderPass.js')]);
  window.THREE = THREE;
  window.ADD = { GLTFLoader: gltf.GLTFLoader, KTX2Loader: ktx2.KTX2Loader, merge: bgu.mergeGeometries, cloneSkinned: sku.clone, EffectComposer: comp.EffectComposer, RenderPass: rp.RenderPass,
    UnrealBloomPass: bloom.UnrealBloomPass, OutputPass: outp.OutputPass, ShaderPass: shp.ShaderPass };
  const files = ['01-core', '02-audio', '03-render', '04-fx', '05-terrain', '06-world', '06b-city', '07-models', '08-vehicles', '09-people', '10-game', '11-activities'];
  for (let i = 0; i < files.length; i++) {
    msg('Lade Spielcode … (' + (i + 1) + '/' + files.length + ')'); bar(0.04 + i * 0.01);
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/game/' + files[i] + '.js?v=' + VER; s.async = false; s.onload = res; s.onerror = () => rej(new Error('Skript fehlt: ' + files[i])); document.head.appendChild(s); });
  }
  if (typeof window.__startGame !== 'function') throw new Error('Startfunktion fehlt');
  await window.__startGame();
} catch (e) {
  console.error(e); window.__fatal && window.__fatal('Startfehler', (e && (e.stack || e.message)) || String(e));
}
