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

  function rebuildPool() {
    if (!NX.PresetLibrary || !NX.PresetLibrary.getKeys) {
      keyPool = [];
      return;
    }
    var all = NX.PresetLibrary.getKeys();
    if (pool === 'all' || !NX.PresetLibrary.byCategory || !NX.PresetLibrary.byCategory[pool]) {
      keyPool = all.slice();
    } else {
      keyPool = (NX.PresetLibrary.byCategory[pool] || []).slice();
    }
    if (!keyPool.length) keyPool = all.slice();
  }

  function beatLengthSec() {
    var bpm = S.bpm || 0;
    if (bpm < 72 || bpm > 190) bpm = 124;
    return 60 / bpm;
  }

  function pickNextKey() {
    if (!keyPool.length) rebuildPool();
    if (!keyPool.length) return '';
    var k = '';
    var guard = 0;
    while (guard < 40) {
      k = keyPool[Math.floor(Math.random() * keyPool.length)];
      guard++;
      if (k !== lastKey || keyPool.length < 2) break;
    }
    return k;
  }

  function blendSeconds() {
    var snap = NX.AudioEngine && NX.AudioEngine.getSnapshot ? NX.AudioEngine.getSnapshot() : {};
    var en = Math.min(1, snap.bcDrive != null ? snap.bcDrive : (snap.energy != null ? snap.energy : 0));
    var bv = Math.min(1, snap.beatVisual != null ? snap.beatVisual : S.beatVisual || 0);
    /* Longer blends when calm; still ≥1.5s for pro crossfades */
    var base = 2.35 + en * 1.43 + bv * 0.45;
    return Math.max(1.5, Math.min(4.5, base));
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
    var mode = S.visualMode || 'shader';
    if (mode !== 'butterchurn' && mode !== 'hybrid') return;
    if (!NX.VisualEngineManager || !NX.VisualEngineManager.isReady()) return;

    var snap = NX.AudioEngine && NX.AudioEngine.getSnapshot ? NX.AudioEngine.getSnapshot() : {};
    var en = Math.min(1, snap.bcDrive != null ? snap.bcDrive : (snap.energy != null ? snap.energy : 0));
    /* Slightly faster rotation when room is loud; floor keeps concerts readable */
    var beat = beatLengthSec();
    var period = beat * beatsInterval;
    period *= 1.05 - en * 0.28;
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
    getBeatsInterval: function () { return beatsInterval; }
  };
})();
