/**
 * app-loader.mjs — Classic script chain with boot progress + main-thread yields.
 * Post-load work (IndexedDB, scene compile) reports via __NX_BOOT_PHASE__ from nx-bootstrap.js.
 */

const NX_SCRIPTS = [
  'js/nexus-brand.js',
  'vendor/butterchurn.min.js',
  'vendor/butterchurnPresets.min.js',
  'js/engine.js',
  'js/scenes/particles-gpu.js',
  'js/nx-store.js',
  'js/nx-persist.js',
  'js/nexus-engine/session-seed.js',
  'js/nexus-bootstrap-query.js',
  'js/nexus-ship-defaults.js',
  'js/nexus-version.js',
  'js/nexus-engine/nexus-research-brief.js',
  'js/nexus-engine/procedural-visual-drive.js',
  'js/nexus-engine/particle-signature.js',
  'js/nexus-engine/procedural-particles.js',
  'js/nexus-engine/modern-visual-stack.js',
  'js/audio.js',
  'js/nexus-pro-audio-science.js',
  'js/nx-structure-mood.js',
  'js/nexus-evolve-stack.js',
  'js/nexus-pro-engines.js',
  'js/scenes.js',
  'js/scenes/cosmic.js',
  'js/scenes/energy.js',
  'js/scenes/fluid.js',
  'js/scenes/environment.js',
  'js/scenes/afterlife.js',
  'js/scenes/unique.js',
  'js/scenes/vision.js',
  'js/scenes/pro-upgrade.js',
  'js/nexus-pro-suite-scenes.js',
  'js/scenes/roadmap-scenes.js',
  'js/nexus-engine/hybrid-layer-registry.js',
  'js/nexus-engine/nexus-audio-procedural-bus.js',
  'js/scenes/preset-pack-2026.js',
  'js/scenes/homage-gl-scenes.js',
  'js/scenes/nx-spectral-mesh.js',
  'js/camera.js',
  'js/nexus-endpoint-guard.js',
  'js/nexus-film-lut.js',
  'js/post.js',
  'js/nexus-gpu-particles-stub.js',
  'js/nx-volumetric/preset-resolve.js',
  'js/nx-volumetric/volumetric-fx.js',
  'js/nx-bpm-timeline.js',
  'js/nexus-engine/audio-engine.js',
  'js/nexus-engine/bc-showcase.js',
  'js/nexus-engine/preset-library.js',
  'js/nexus-engine/bc-morph-conductor.js',
  'js/nexus-engine/pro-presets.js',
  'js/nexus-engine/visual-engine-manager.js',
  'js/nexus-engine/butterchurn-scene.js',
  'js/nexus-engine/shader-scene.js',
  'js/nexus-engine/scene-manager.js',
  'js/nexus-engine/nexus-homage-bridge.js',
  'js/nexus-engine/nexus-homage-dom-overlays.js',
  'js/nexus-engine/nexus-maze-three.js',
  'js/nexus-engine/nexus-isf-loader.js',
  'js/nexus-engine/nexus-cables-lite.js',
  'js/nexus-engine/wgsl-graph.js',
  'js/nexus-engine/ui-manager.js',
  'js/nexus-engine/midi-manager.js',
  'js/show/ltc-js-decoder.js',
  'js/show/ltc-decode-core.js',
  'js/show/ltc-wasm.js',
  'js/show/show-clock.js',
  'js/show/ola-client.js',
  'js/show/clip-layers.js',
  'js/nexus-comfy-client.js',
  'js/nexus-webrtc-multiscreen.js',
  'js/nexus-pro-ndi-browser.js',
  'js/nexus-pro-three-pro-stack.js',
  'js/show/cue-engine.js',
  'js/show/scene-presets.js',
  'js/show/fx-chain.js',
  'js/show/composition-ui.js',
  'js/show/lighting-deck.js',
  'js/show/show-workbench.js',
  'js/nexus-engine/engine-host.js',
  'js/nexus-three-guest.js',
  'js/nexus-playcanvas-guest.js',
  'js/nexus-webgpu-spike.js',
  'js/midi.js',
  'js/presets.js',
  'js/watermark.js',
  'js/auto-director.js',
  'js/demo-director.js',
  'js/nexus-onboard.js',
  'js/nexus-showfile.js',
  'js/nexus-rec-brand.js',
  'js/nexus-shell.js',
  'js/nx-clip-pad.js',
  'js/ui.js',
  'js/nx-hw-calibrate.js',
  'js/nexus-pro-workflow.js',
  'js/nx-bootstrap.js'
];

const BOOT_SCRIPT_PCT = 88;

function shortScriptLabel(rel) {
  var p = rel.replace(/^js\//, '').replace(/^vendor\//, 'v/');
  if (p.length > 42) p = p.slice(0, 40) + '…';
  return p;
}

function setBootProgress(pct01, label) {
  var bar = document.getElementById('nx-boot-bar');
  var lbl = document.getElementById('nx-boot-label');
  var track = document.querySelector('.nx-boot-track');
  var p = Math.max(0, Math.min(100, Math.round((pct01 == null ? 0 : pct01) * 100)));
  if (lbl) lbl.textContent = label || 'Loading…';
  if (bar) bar.style.width = p + '%';
  if (track) track.setAttribute('aria-valuenow', String(p));
}

window.__NX_BOOT_INTERACTIVE__ = false;

window.__NX_BOOT_PHASE__ = function (label, pct01) {
  setBootProgress(pct01, label);
};

window.__NX_BOOT_READY__ = function () {
  window.__NX_BOOT_INTERACTIVE__ = true;
  setBootProgress(1, 'Ready — tap Enter show to unlock audio');
  var btn = document.getElementById('start-btn');
  if (btn) {
    btn.disabled = false;
    btn.setAttribute('aria-disabled', 'false');
    btn.classList.remove('nx-splash-btn-wait');
  }
};

function resolveSrc(rel) {
  try {
    return new URL(rel, document.baseURI || window.location.href).href;
  } catch (e) {
    return rel;
  }
}

function yieldToPaint() {
  return new Promise(function (resolve) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        setTimeout(resolve, 0);
      });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function appendClassic(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = function () {
      yieldToPaint().then(resolve);
    };
    s.onerror = function () { reject(new Error('NEXUS failed to load: ' + src)); };
    document.head.appendChild(s);
  });
}

async function main() {
  var total = NX_SCRIPTS.length;
  for (var i = 0; i < total; i++) {
    var rel = NX_SCRIPTS[i];
    var frac = (i + 1) / total;
    setBootProgress((frac * BOOT_SCRIPT_PCT) / 100, 'Loading ' + shortScriptLabel(rel) + ' (' + (i + 1) + '/' + total + ')');
    await appendClassic(resolveSrc(rel));
  }
  setBootProgress(0.9, 'Finishing engine setup…');
}

main().catch(function (err) {
  console.error(err);
  setBootProgress(0, 'Load failed — see message below');
  var sp = document.getElementById('splash');
  if (sp) {
    var p = document.createElement('p');
    p.style.cssText = 'color:#ff8a80;font-size:12px;margin-top:12px;max-width:28em;line-height:1.4';
    p.textContent = String(err && err.message ? err.message : err);
    var card = sp.querySelector('.nx-splash-card');
    if (card) card.appendChild(p);
  }
});
