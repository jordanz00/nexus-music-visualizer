'use strict';
/**
 * SceneManager — visual mode (shader / butterchurn / hybrid), crossfade, queued switches.
 */
(function () {
  var S = NX.S;
  var queue = [];
  var fade = { active: false, t: 0, dur: 0.8, from: 'shader', to: 'shader' };

  function syncDOM() {
    var bc = document.getElementById('c-bc');
    var c = document.getElementById('c');
    if (!bc || !c) return;
    var mode = S.visualMode || 'shader';
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
    } else {
      if (mode === 'shader') { bc.style.opacity = '0'; c.style.opacity = '1'; c.classList.remove('nexus-hybrid'); }
      else if (mode === 'butterchurn') { bc.style.opacity = '1'; c.style.opacity = '0'; c.classList.remove('nexus-hybrid'); }
      else { bc.style.opacity = '1'; c.style.opacity = '1'; c.classList.add('nexus-hybrid'); }
    }
  }

  function setMode(mode, opts) {
    opts = opts || {};
    var prev = S.visualMode || 'shader';
    if (mode === prev && !opts.force) { syncDOM(); return; }
    var useFade = opts.crossfade !== false && !opts.force && prev !== mode &&
      (prev === 'butterchurn' || mode === 'butterchurn' || prev === 'hybrid' || mode === 'hybrid');
    if (useFade) {
      fade.active = true; fade.t = 0; fade.dur = opts.fadeSec != null ? opts.fadeSec : 0.85;
      fade.from = prev; fade.to = mode;
    }
    S.visualMode = mode;
    document.body.classList.toggle('nexus-mode-bc', mode === 'butterchurn');
    document.body.classList.toggle('nexus-mode-hybrid', mode === 'hybrid');
    if (mode === 'butterchurn' || mode === 'hybrid') {
      function pickSeedBcKey(ks) {
        var pin = typeof window !== 'undefined' && window.NXBcShowcase && window.NXBcShowcase.defaultButterchurnKey;
        if (pin && NX.PresetLibrary.getPreset(pin)) return pin;
        return ks[Math.floor(Math.random() * ks.length)];
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
    if (mode === 'shader' && NX.VisualEngineManager) {
      NX.VisualEngineManager.disconnectAudio();
    }
    syncDOM();
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
    var m = S.visualMode || 'shader';
    return m === 'shader' || m === 'hybrid';
  }

  function shouldRenderButterchurn() {
    var m = S.visualMode || 'shader';
    return m === 'butterchurn' || m === 'hybrid';
  }

  NX.SceneManager = {
    setMode: setMode,
    tickFade: tickFade,
    enqueue: enqueue,
    tickQueue: tickQueue,
    shouldRenderShader: shouldRenderShader,
    shouldRenderButterchurn: shouldRenderButterchurn,
    syncDOM: syncDOM,
    getQueueLength: function () { return queue.length; }
  };
})();
