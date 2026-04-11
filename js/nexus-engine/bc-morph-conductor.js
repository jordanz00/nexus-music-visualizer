'use strict';
/**
 * BcMorphConductor — concert-style Butterchurn preset morphing: BPM-aware cadence,
 * audio-reactive blend (1.5–4.5s), weighted random (optional category pool), no immediate repeats.
 */
(function () {
  var S = NX.S;
  var enabled = false;
  /** @type {'all'|'ambient'|'heavy'|'psychedelic'|'glitch'|'other'} */
  var pool = 'all';
  /** Beats between morphs (4 = one bar @ 4/4) */
  var beatsInterval = 32;
  var countdown = 0;
  var lastKey = '';
  var keyPool = [];
  /** When non-empty, morph / gig picks intersect this allowlist (validated keys). */
  var gigKeys = [];
  var gigPoolActive = false;
  var GIG_STORAGE = 'nx_bc_gig_pool';

  function loadGigPoolFromStorage() {
    if (gigPoolActive) return;
    try {
      var raw = localStorage.getItem(GIG_STORAGE);
      if (!raw) return;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return;
      gigKeys = normalizeGigKeys(arr);
      gigPoolActive = gigKeys.length > 0;
    } catch (e) {
      gigKeys = [];
      gigPoolActive = false;
    }
  }

  function normalizeGigKeys(arr) {
    if (!NX.PresetLibrary || !NX.PresetLibrary.getKeys) return [];
    var valid = {};
    NX.PresetLibrary.getKeys().forEach(function (k) { valid[k] = 1; });
    var out = [];
    arr.forEach(function (k) {
      if (typeof k === 'string' && valid[k] && out.indexOf(k) < 0) out.push(k);
    });
    return out;
  }

  function applyGigPoolFromArray(arr) {
    gigKeys = normalizeGigKeys(arr || []);
    gigPoolActive = gigKeys.length > 0;
    try {
      if (gigPoolActive) localStorage.setItem(GIG_STORAGE, JSON.stringify(gigKeys));
      else localStorage.removeItem(GIG_STORAGE);
    } catch (e2) { /* ignore */ }
    rebuildPool();
  }

  function clearGigPool() {
    gigKeys = [];
    gigPoolActive = false;
    try { localStorage.removeItem(GIG_STORAGE); } catch (e3) { /* ignore */ }
    rebuildPool();
  }

  function rebuildPool() {
    if (!NX.PresetLibrary || !NX.PresetLibrary.getKeys) {
      keyPool = [];
      return;
    }
    loadGigPoolFromStorage();
    var all = NX.PresetLibrary.getKeys();
    var base = all.slice();
    if (pool !== 'all' && NX.PresetLibrary.byCategory && NX.PresetLibrary.byCategory[pool]) {
      base = (NX.PresetLibrary.byCategory[pool] || []).slice();
    }
    if (!base.length) base = all.slice();
    if (gigPoolActive && gigKeys.length) {
      var allow = {};
      gigKeys.forEach(function (k) { allow[k] = 1; });
      var inter = base.filter(function (k) { return allow[k]; });
      keyPool = inter.length ? inter : base.slice();
    } else {
      keyPool = base.slice();
    }
    if (!keyPool.length) keyPool = all.slice();
  }

  function beatLengthSec() {
    var bpm = S.bpm || 0;
    if (bpm < 72 || bpm > 190) bpm = 124;
    return 60 / bpm;
  }

  function conductorMotionMul() {
    var m = typeof S.bcConductorMotion === 'number' ? S.bcConductorMotion : 1;
    return Math.max(0.65, Math.min(1.35, m));
  }

  function pickNextKey() {
    if (!keyPool.length) rebuildPool();
    if (!keyPool.length) return '';
    var k = '';
    var guard = 0;
    var rnd = typeof NX.randomUnit === 'function' ? NX.randomUnit : Math.random;
    while (guard < 40) {
      k = keyPool[Math.floor(rnd() * keyPool.length)];
      guard++;
      if (k !== lastKey || keyPool.length < 2) break;
    }
    return k;
  }

  function blendSeconds() {
    var snap = NX.AudioEngine && NX.AudioEngine.getSnapshot ? NX.AudioEngine.getSnapshot() : {};
    var en = Math.min(1, snap.bcDrive != null ? snap.bcDrive : (snap.energy != null ? snap.energy : 0));
    var bv = Math.min(1, snap.beatVisual != null ? snap.beatVisual : S.beatVisual || 0);
    var base = 2.35 + en * 1.48 + bv * 0.58;
    var dur = Math.max(1.45, Math.min(4.55, base));
    var m = conductorMotionMul();
    return dur / (0.82 + m * 0.22);
  }

  function morphNow() {
    if (!NX.VisualEngineManager || !NX.VisualEngineManager.isReady()) return;
    var k = pickNextKey();
    if (!k) return;
    var preset = NX.PresetLibrary.getPreset(k);
    if (!preset) return;
    lastKey = k;
    NX.VisualEngineManager.loadPreset(preset, blendSeconds(), k, { fromConductor: true });
  }

  /**
   * @param {number} dt
   */
  function tick(dt) {
    if (!enabled) return;
    var mode = S.visualMode || 'hybrid';
    if (mode !== 'butterchurn' && mode !== 'hybrid') return;
    if (!NX.VisualEngineManager || !NX.VisualEngineManager.isReady()) return;

    var snap = NX.AudioEngine && NX.AudioEngine.getSnapshot ? NX.AudioEngine.getSnapshot() : {};
    var en = Math.min(1, snap.bcDrive != null ? snap.bcDrive : (snap.energy != null ? snap.energy : 0));
    var bv = Math.min(1, snap.beatVisual != null ? snap.beatVisual : S.beatVisual || 0);
    var beat = beatLengthSec();
    var period = beat * beatsInterval;
    period *= 1.05 - en * 0.28;
    period *= 1.02 - bv * 0.12;
    var m = conductorMotionMul();
    period *= 1.12 - m * 0.12;
    period = Math.max(beat * 8, Math.min(beat * 96, period));

    countdown -= dt;
    if (countdown <= 0) {
      morphNow();
      countdown = period;
    }
  }

  function setEnabled(on) {
    enabled = !!on;
    if (enabled) {
      rebuildPool();
      /* Brief delay before first morph so audio / viz can settle */
      countdown = Math.max(2.2, beatLengthSec() * 6);
    }
  }

  function setPool(p) {
    pool = p || 'all';
    rebuildPool();
  }

  function setBeatsInterval(n) {
    beatsInterval = Math.max(8, Math.min(128, Math.round(n || 32)));
  }

  function notifyManualPresetLoad(key) {
    if (key) lastKey = key;
    if (enabled) countdown = Math.max(countdown, beatLengthSec() * (beatsInterval * 0.35));
  }

  NX.BcMorphConductor = {
    tick: tick,
    setEnabled: setEnabled,
    setPool: setPool,
    setBeatsInterval: setBeatsInterval,
    rebuildPool: rebuildPool,
    notifyManualPresetLoad: notifyManualPresetLoad,
    isEnabled: function () { return enabled; },
    getPool: function () { return pool; },
    getBeatsInterval: function () { return beatsInterval; },
    applyGigPoolFromArray: applyGigPoolFromArray,
    clearGigPool: clearGigPool,
    getGigPoolKeys: function () { return gigKeys.slice(); },
    isGigPoolActive: function () { return gigPoolActive && gigKeys.length > 0; }
  };
})();
