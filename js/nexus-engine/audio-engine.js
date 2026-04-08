'use strict';
/**
 * AudioEngine — single read surface for Butterchurn, shaders, and auto-director.
 * Wraps NX.S populated by js/audio.js (no duplicate analysis).
 */
(function () {
  var S = NX.S;

  function getSnapshot() {
    return {
      bass: S.sBass,
      mid: S.sMid,
      high: S.sHigh,
      sub: S.sSub,
      vol: S.sVol,
      flux: S.sFlux,
      centroid: S.sCent,
      beat: S.beat,
      bpm: S.bpm,
      energy: Math.min(1, S.sBass * 0.45 + S.sMid * 0.3 + S.sHigh * 0.15 + S.sFlux * 0.25),
      micOn: !!S.micOn
    };
  }

  NX.AudioEngine = {
    getSnapshot: getSnapshot
  };
})();
