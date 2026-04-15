'use strict';
/**
 * SceneManager — visual stack (shader / Aurora / hybrid / GPU particle layer modes), crossfade, queued switches.
 * GPU particles render on #c-particles (dedicated WebGL) so CSS opacity on #c / #c-bc never hides them.
 */
(function () {
  var S = NX.S;
  var queue = [];
  var fade = { active: false, t: 0, dur: 0.8, from: 'hybrid', to: 'hybrid' };

  function isParticleHeroMode(mode) {
    return mode === 'hybrid_particles' || mode === 'shader_particles' ||
      mode === 'butterchurn_particles' || mode === 'particles_showcase';
  }

  function syncGpuParticlesLayerOpacity(mode, cPx) {
    if (!cPx) return;
    var op = typeof S.hybridParticlesOpacity === 'number' ? Math.max(0, Math.min(1, S.hybridParticlesOpacity)) : 1;
    var wantParticles = isParticleHeroMode(mode) ||
      (S.nexusGpuParticlesEnabled !== false && S.nexusMixParticlesEnabled !== false);
    cPx.style.opacity = wantParticles ? String(op) : '0';
    document.body.classList.toggle('nexus-particles-stack', wantParticles && op > 0.02);
  }

  function syncDOM() {
    var bc = document.getElementById('c-bc');
    var c = document.getElementById('c');
    var cPx = document.getElementById('c-particles');
    if (!bc || !c) return;
    var mode = S.visualMode || 'hybrid';

    if (fade.active) {
      var k = Math.min(1, fade.t / Math.max(0.001, fade.dur));
      k = k * k * (3 - 2 * k);
      if (fade.from === 'shader' && fade.to === 'butterchurn') {
        bc.style.opacity = String(k);
        c.style.opacity = String(1 - k * 0.02);
      } else if (fade.from === 'butterchurn' && fade.to === 'shader') {
        bc.style.opacity = String(1 - k);
        c.style.opacity = '1';
      } else {
        bc.style.opacity = mode === 'shader' ? '0' : (mode === 'hybrid' ? '1' : '1');
        c.style.opacity = '1';
      }
      syncGpuParticlesLayerOpacity(mode, cPx);
      return;
    }

    if (mode === 'shader') {
      bc.style.opacity = '0';
      c.style.opacity = '1';
      c.classList.remove('nexus-hybrid');
    } else if (mode === 'butterchurn') {
      bc.style.opacity = '1';
      c.style.opacity = '0';
      c.classList.remove('nexus-hybrid');
    } else if (mode === 'shader_particles') {
      bc.style.opacity = '0';
      var oSh1 = typeof S.hybridShaderOpacity === 'number' ? Math.max(0.18, Math.min(1, S.hybridShaderOpacity)) : 1;
      c.style.opacity = String(oSh1);
      c.classList.remove('nexus-hybrid');
    } else if (mode === 'butterchurn_particles') {
      var oBc2 = typeof S.hybridBcOpacity === 'number' ? Math.max(0.12, Math.min(1, S.hybridBcOpacity)) : 1;
      bc.style.opacity = String(oBc2);
      c.style.opacity = '0';
      c.classList.remove('nexus-hybrid');
    } else if (mode === 'particles_showcase') {
      var oBc3 = typeof S.hybridBcOpacity === 'number' ? Math.max(0.12, Math.min(1, S.hybridBcOpacity)) : 0.94;
      var oSh3 = typeof S.hybridShaderOpacity === 'number' ? Math.max(0.06, Math.min(1, S.hybridShaderOpacity)) : 0.12;
      bc.style.opacity = String(oBc3);
      c.style.opacity = String(oSh3);
      c.classList.add('nexus-hybrid');
    } else {
      var oBc = typeof S.hybridBcOpacity === 'number' ? Math.max(0.12, Math.min(1, S.hybridBcOpacity)) : 1;
      var oSh = typeof S.hybridShaderOpacity === 'number' ? Math.max(0.18, Math.min(1, S.hybridShaderOpacity)) : 1;
      bc.style.opacity = String(oBc);
      c.style.opacity = String(oSh);
      c.classList.add('nexus-hybrid');
    }

    syncGpuParticlesLayerOpacity(mode, cPx);
  }

  function setMode(mode, opts) {
    opts = opts || {};
    var prev = S.visualMode || 'hybrid';
    if (mode === prev && !opts.force) { syncDOM(); return; }

    var newStack = isParticleHeroMode(mode) || isParticleHeroMode(prev);
    var useFade = opts.crossfade !== false && !opts.force && prev !== mode && !newStack &&
      (prev === 'butterchurn' || mode === 'butterchurn' || prev === 'hybrid' || mode === 'hybrid');
    if (useFade) {
      fade.active = true; fade.t = 0; fade.dur = opts.fadeSec != null ? opts.fadeSec : 0.85;
      fade.from = prev; fade.to = mode;
    }
    S.visualMode = mode;

    document.body.classList.toggle('nexus-mode-bc', mode === 'butterchurn' || mode === 'butterchurn_particles');
    document.body.classList.toggle('nexus-mode-hybrid',
      mode === 'hybrid' || mode === 'hybrid_particles' || mode === 'particles_showcase');

    var bcFamily = mode === 'butterchurn' || mode === 'hybrid' || mode === 'hybrid_particles' ||
      mode === 'butterchurn_particles' || mode === 'particles_showcase';
    if (bcFamily) {
      function pickSeedBcKey(ks) {
        var pin = typeof window !== 'undefined' && window.NXBcShowcase && window.NXBcShowcase.defaultButterchurnKey;
        if (pin && NX.PresetLibrary.getPreset(pin)) return pin;
        var rnd = typeof NX.randomUnit === 'function' ? NX.randomUnit : Math.random;
        return ks[Math.floor(rnd() * ks.length)];
      }
      function seedFirstPreset() {
        setTimeout(function () {
          if (S.bcLastPresetKey || !NX.PresetLibrary || !NX.VisualEngineManager || !NX.VisualEngineManager.isReady()) return;
          var ks = NX.PresetLibrary.getKeys();
          if (!ks || !ks.length) return;
          var k = pickSeedBcKey(ks);
          var pr = NX.PresetLibrary.getPreset(k);
          if (pr) NX.VisualEngineManager.loadPreset(pr, 2.4, k, { fromConductor: true });
        }, 120);
        setTimeout(function () {
          if (S.bcLastPresetKey || !NX.PresetLibrary || !NX.VisualEngineManager || !NX.VisualEngineManager.isReady()) return;
          var ks = NX.PresetLibrary.getKeys();
          if (!ks || !ks.length) return;
          var k = pickSeedBcKey(ks);
          var pr = NX.PresetLibrary.getPreset(k);
          if (pr) NX.VisualEngineManager.loadPreset(pr, 2.2, k, { fromConductor: true });
        }, 900);
      }
      function primeBC() {
        if (!NX.VisualEngineManager || !NX.VisualEngineManager.ensureAudioForBC()) return;
        NX.VisualEngineManager.initVisualizer();
        NX.VisualEngineManager.connectAudio();
        seedFirstPreset();
      }
      if (NX.audio && NX.audio.primeForButterchurn) {
        NX.audio.primeForButterchurn().then(primeBC).catch(function (err) {
          console.warn('Aurora Field audio graph:', err && err.message);
        });
      }
    }

    if ((mode === 'shader' || mode === 'shader_particles') && NX.VisualEngineManager) {
      NX.VisualEngineManager.disconnectAudio();
    }

    if (mode === 'particles_showcase') {
      S.hybridBcOpacity = 0.94;
      S.hybridShaderOpacity = 0.12;
      S.hybridParticlesOpacity = 1;
      if (NX.particles && typeof NX.particles.applyPreset === 'function') {
        try { NX.particles.applyPreset('FluidShowcase', true); } catch (eFs) { /* ignore */ }
      }
    }

    syncDOM();
    if (NX.ui && typeof NX.ui.syncControls === 'function') {
      try { NX.ui.syncControls(); } catch (eUi) { /* ignore */ }
    }
  }

  function tickFade(dt) {
    if (!fade.active) return;
    fade.t += dt;
    if (fade.t >= fade.dur) { fade.active = false; fade.t = 0; }
    syncDOM();
  }

  function enqueue(item) {
    queue.push(item);
  }

  function tickQueue() {
    if (queue.length === 0 || S.morphing) return;
    var item = queue.shift();
    if (item.type === 'bc' && item.preset && NX.PresetLibrary.getPreset(item.preset)) {
      NX.VisualEngineManager.loadPreset(NX.PresetLibrary.getPreset(item.preset), item.blend != null ? item.blend : 2, item.preset);
    } else if (item.type === 'shader' && typeof item.index === 'number') {
      NX.goNext(item.index);
    }
  }

  function shouldRenderShader() {
    var m = S.visualMode || 'hybrid';
    return m === 'shader' || m === 'shader_particles' || m === 'hybrid' || m === 'hybrid_particles' || m === 'particles_showcase';
  }

  function shouldRenderButterchurn() {
    var m = S.visualMode || 'hybrid';
    return m === 'butterchurn' || m === 'butterchurn_particles' || m === 'hybrid' || m === 'hybrid_particles' || m === 'particles_showcase';
  }

  function shouldRenderGpuParticles() {
    var m = S.visualMode || 'hybrid';
    if (S.nexusMixParticlesEnabled === false) return false;
    var op = typeof S.hybridParticlesOpacity === 'number' ? S.hybridParticlesOpacity : 1;
    if (op < 0.002) return false;
    if (isParticleHeroMode(m)) return true;
    return S.nexusGpuParticlesEnabled !== false;
  }

  function isParticleStackForced() {
    return isParticleHeroMode(S.visualMode || 'hybrid');
  }

  NX.SceneManager = {
    setMode: setMode,
    tickFade: tickFade,
    enqueue: enqueue,
    tickQueue: tickQueue,
    shouldRenderShader: shouldRenderShader,
    shouldRenderButterchurn: shouldRenderButterchurn,
    shouldRenderGpuParticles: shouldRenderGpuParticles,
    isParticleStackForced: isParticleStackForced,
    syncDOM: syncDOM,
    getQueueLength: function () { return queue.length; }
  };
})();
