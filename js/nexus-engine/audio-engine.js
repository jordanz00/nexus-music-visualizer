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
    /* Aurora UI intensity: visual envelope (see audio.js _visualBcDrive). */
    var bcDrive = typeof S._visualBcDrive === 'number' && S.micOn
      ? Math.min(1, S._visualBcDrive)
      : Math.min(1, micE * (0.12 + 0.88 * gate));
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
      visualDrive: typeof S._visualDrive === 'number' ? S._visualDrive : 0,
      micOn: !!S.micOn,
      beatPhase: typeof S.beatPhase === 'number' ? S.beatPhase : 0,
      bpmConfidence: typeof S.bpmConfidence === 'number' ? S.bpmConfidence : 0
    };
  }

  NX.AudioEngine = {
    getSnapshot: getSnapshot
  };
})();
