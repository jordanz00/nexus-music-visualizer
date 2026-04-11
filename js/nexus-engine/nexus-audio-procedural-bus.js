'use strict';
/**
 * nexus-audio-procedural-bus.js — Maps NX.S audio fields to shader / homage drivers (documentation + helpers).
 *
 * WHO THIS IS FOR: shader authors and HomageBridge-style modules.
 * WHAT IT DOES: Exposes a stable description of which engine uniforms carry audio (B,M,H,V,BT,FL,SC,BP,PH,BC,WM,WC)
 *   and how homage HM slots are used (see nexus-homage-bridge.js).
 * HOW IT CONNECTS: read-only; engine uploads values in setCommonUniforms (engine.js).
 */
(function () {
  var NX = window.NX || (window.NX = {});

  NX.ProceduralAudioBus = {
    /** @returns {object} */
    describeUniforms: function () {
      return {
        bands: { B: 'bass drive', M: 'mid', H: 'high', V: 'volume', BT: 'beat/transient mix', FL: 'flux', SC: 'spectral centroid proxy' },
        timing: { BP: 'bpm / 175 clamp', PH: 'beat phase 0–1', BC: 'bpm confidence 0–1' },
        worklet: { WM: 'RMS 0–1', WC: 'crest 0–1' },
        homageHM: { x: 'YNI tap state 0..2', y: 'MITD breath drive', z: 'MITD / echo phase', w: 'reserved' }
      };
    }
  };
})();
