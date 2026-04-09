'use strict';
/**
 * AudioEngine — single read surface for Butterchurn, shaders, and auto-director.
 * Wraps NX.S populated by js/audio.js (no duplicate analysis).
 */
(function () {
  var S = NX.S;

  function getSnapshot() {
    var micE = typeof S.micEnergy === 'number' ? S.micEnergy : 0;
    var gate = typeof S._bcGateOpen === 'number' ? S._bcGateOpen : 0;
    /* Butterchurn / morph: real mic + gate only — no demo synth (see audio.js tick). */
    var bcDrive = Math.min(1, micE * (0.12 + 0.88 * gate));
    return {
      bass: S.sBass,
      lowMid: S.sLowMid,
      mid: S.sMid,
      high: S.sHigh,
      sub: S.sSub,
      vol: S.sVol,
      flux: S.sFlux,
      centroid: S.sCent,
      beat: S.beat,
      beatVisual: typeof S.beatVisual === 'number' ? S.beatVisual : 0,
      bpm: S.bpm,
      energy: Math.min(1, S.sBass * 0.45 + S.sMid * 0.3 + S.sHigh * 0.15 + S.sFlux * 0.25),
      micEnergy: micE,
      bcGate: gate,
      bcDrive: bcDrive,
      micOn: !!S.micOn
    };
  }

  NX.AudioEngine = {
    getSnapshot: getSnapshot
  };
})();
