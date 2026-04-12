'use strict';
/**
 * nexus-audio-procedural-bus.js — NX.S audio → preset / shader drivers (docs + smoothing helpers).
 *
 * WHO THIS IS FOR: shader authors, HomageBridge, HomageDOM, future deck JSON.
 * WHAT IT DOES: describeUniforms(); smoothing alphas; mapToPresetParams() for a versioned float3 drive;
 *   reducedMotionPostCaps() to clamp glitch/kaleido when a11y motion is reduced.
 * HOW IT CONNECTS: engine uploads B,M,H,V,BT,FL,SC,BP,PH,BC,WM,WC,HM in setCommonUniforms (engine.js).
 *
 * Smoothing tiers (exponential toward target each frame, dt in seconds):
 *   — fast: 1 - exp(-dt * 22)  (~UI meters)
 *   — mid:  1 - exp(-dt * 12) (~palette / hue)
 *   — slow: 1 - exp(-dt * 5)  (~RMS breath, MITD HM.y)
 * BPM hard-quantize: only when BC >= 0.45; else pass through continuous phase.
 *
 * Research (browser viz Track 2): OSS stacks often stop at FFT → uniforms; “musical” feel
 * usually adds onset / phase / BPM on top. For GPU-side audio *processing* as a pattern,
 * see three.js example https://threejs.org/examples/webgpu_compute_audio.html (not vendored here).
 */
(function () {
  var NX = window.NX || (window.NX = {});

  function expSmoothAlpha(dt, rate) {
    var d = typeof dt === 'number' && dt > 0 ? dt : 0.016;
    var r = typeof rate === 'number' && rate > 0 ? rate : 12;
    return 1 - Math.exp(-d * r);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * @param {object} S — NX.S
   * @param {number} dt
   * @returns {{ drive: number[], phase: number, gate: number, centroid: number }}
   */
  function mapToPresetParams(S, dt) {
    S = S || {};
    var bc = typeof S.bpmConfidence === 'number' ? S.bpmConfidence : 0;
    var ph = typeof S.beatPhase === 'number' ? S.beatPhase : 0;
    var bv = typeof S.beatVisual === 'number' ? S.beatVisual : 0;
    var b = typeof S.sBass === 'number' ? S.sBass : 0;
    var m = typeof S.sMid === 'number' ? S.sMid : 0;
    var h = typeof S.sHigh === 'number' ? S.sHigh : 0;
    var fl = typeof S.sFlux === 'number' ? S.sFlux : 0;
    var wm = typeof S.workletRms === 'number' ? S.workletRms : 0;
    var phaseOut = ph;
    if (bc < 0.45) {
      phaseOut = lerp(ph, bv * 0.5 + fl * 0.12, 0.35);
    }
    var gate = Math.max(0, Math.min(1, bc));
    return {
      drive: [b, m, h],
      phase: phaseOut,
      gate: gate,
      centroid: typeof S.sCent === 'number' ? S.sCent : 0,
      flux: fl,
      rms: wm,
      crest: typeof S.workletCrest === 'number' ? S.workletCrest : (typeof S.sTransient === 'number' ? S.sTransient : 0)
    };
  }

  /**
   * Caps for post FX when prefers-reduced-motion (never full-screen strobe).
   * @param {object} S — NX.S (mutates postFx* when above cap)
   */
  function reducedMotionPostCaps(S) {
    if (!S) return;
    var rm = false;
    try {
      rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (eR) { /* ignore */ }
    if (!rm) return;
    if (typeof S.postFxGlitch === 'number') S.postFxGlitch = Math.min(S.postFxGlitch, 0.12);
    if (typeof S.postFxKaleido === 'number') S.postFxKaleido = Math.min(S.postFxKaleido, 0.18);
    if (typeof S.postFxAsura === 'number') S.postFxAsura = Math.min(S.postFxAsura, 0.32);
  }

  NX.ProceduralAudioBus = {
    describeUniforms: function () {
      return {
        bands: { B: 'bass drive', M: 'mid', H: 'high', V: 'volume', BT: 'beat/transient mix', FL: 'flux', SC: 'spectral centroid proxy' },
        timing: { BP: 'bpm / 175 clamp', PH: 'beat phase 0–1', BC: 'bpm confidence 0–1' },
        worklet: { WM: 'RMS 0–1', WC: 'crest 0–1' },
        homageHM: { x: 'YNI tap state 0..2', y: 'MITD breath drive', z: 'MITD / echo phase', w: 'reserved' }
      };
    },
    expSmoothAlpha: expSmoothAlpha,
    mapToPresetParams: mapToPresetParams,
    reducedMotionPostCaps: reducedMotionPostCaps,
    /** Tier names for comments / MIDI learn export */
    smoothingTiers: { fast: 22, mid: 12, slow: 5 }
  };
})();
