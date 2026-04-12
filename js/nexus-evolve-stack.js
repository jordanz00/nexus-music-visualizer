'use strict';
/**
 * nexus-evolve-stack.js — Visual genome, surprise heuristics, emotional arc, narrative timer, track fingerprint hook.
 * Kept lightweight for static hosting; heavy GPU paths stay in dedicated modules.
 */
(function () {
  if (!window.NX) return;

  var genes = new Float32Array(64);
  var g = 0;
  for (; g < 64; g++) genes[g] = Math.random();

  var _lastMut = 0;
  var _boredAcc = 0;
  var _lastBeatV = 0;
  var emo = { val: 0.5, aro: 0.5 };
  var nar = { on: true, t0: null, lenMs: 3600000 };
  var _fpLogged = '';

  function tick(dt, now) {
    var S = NX.S;
    if (!S) return;
    now = now || performance.now();
    if (!nar.t0 && S.micOn) nar.t0 = now;
    if (_lastMut === 0) _lastMut = now;
    if (now - _lastMut > 90000) {
      var i = (Math.random() * 64) | 0;
      genes[i] = Math.max(0, Math.min(1, genes[i] + (Math.random() - 0.5) * 0.1));
      _lastMut = now;
    }
    var bv = typeof S.beatVisual === 'number' ? S.beatVisual : 0;
    if (bv > 0.9 && _lastBeatV <= 0.9) {
      for (var k = 0; k < 8; k++) {
        var j = (Math.random() * 64) | 0;
        genes[j] = Math.max(0, Math.min(1, genes[j] + (Math.random() - 0.5) * 0.28));
      }
    }
    _lastBeatV = bv;
    S.visualGenomeHex = genomeToHex();
    S.visualGeneDrive = genes[0] * 0.5 + genes[1] * 0.25;

    var flux = typeof S.sFlux === 'number' ? S.sFlux : 0;
    _boredAcc += dt * (0.02 - flux * 0.015);
    if (_boredAcc > 2.4 && S.micOn && !S.nexusVizPerformance) {
      S.explode = Math.max(S.explode || 0, 0.35);
      S.hueShift = (S.hueShift || 0) + (Math.random() - 0.5) * 0.08;
      _boredAcc = 0;
    }
    if (flux > 0.08) _boredAcc *= 0.88;

    var rms = typeof S.micEnergy === 'number' ? S.micEnergy : 0;
    var flat = typeof S.proChromaFlatness === 'number' ? S.proChromaFlatness : 0.5;
    emo.aro += (rms * 0.65 + (1 - flat) * 0.2 - emo.aro) * 0.04;
    emo.val += ((1 - flat) * 0.55 - emo.val) * 0.03;
    S.emotionalArousal = emo.aro;
    S.emotionalValence = emo.val;

    if (nar.on && nar.t0) {
      var p = Math.min(1, (now - nar.t0) / Math.max(60000, nar.lenMs));
      S.narrativeProgress01 = p;
      S.narrativeAct = p < 0.15 ? 0 : p < 0.35 ? 1 : p < 0.6 ? 2 : p < 0.8 ? 3 : 4;
    }

    var fp = S.proFingerprintShort || '';
    if (fp && fp.length >= 4 && fp !== _fpLogged && S.micOn) {
      _fpLogged = fp;
      try {
        if (NX.Persist && NX.Persist.setItem) {
          NX.Persist.setItem('nx_track_fp_last', fp);
        }
      } catch (e0) { /* ignore */ }
    }
  }

  function genomeToHex() {
    var s = '';
    for (var i = 0; i < 64; i++) {
      s += ('0' + Math.round(genes[i] * 255).toString(16)).slice(-2);
    }
    return s;
  }

  function importGenomeHex(hex) {
    if (!hex || hex.length < 128) return false;
    for (var i = 0; i < 64; i++) {
      var v = parseInt(hex.substr(i * 2, 2), 16);
      if (isNaN(v)) return false;
      genes[i] = v / 255;
    }
    return true;
  }

  NX.EvolveStack = {
    tick: tick,
    genes: genes,
    genomeToHex: genomeToHex,
    importGenomeHex: importGenomeHex,
    setNarrativeEnabled: function (on) { nar.on = !!on; },
    setNarrativeLengthMs: function (ms) { nar.lenMs = Math.max(120000, ms | 0); }
  };
})();
