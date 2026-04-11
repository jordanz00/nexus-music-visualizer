'use strict';
/**
 * Procedural visual drive — slow LFOs and soft random-walk targets for shader `PROC`
 * and post `PC`, plus optional CSS ambient deltas.
 *
 * Depends on `NX.S` from engine.js. Safe if SessionSeed is absent.
 */
(function () {
  var seed = (Date.now() ^ (Math.floor(Math.random() * 0xffffffff))) >>> 0;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6d2b79f5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var rnd = mulberry32(seed);
  var cur = { hue: 0, sat: 0.52, lift: 0.53, phase: 0 };
  var tgt = { hue: 0, sat: 0.5, lift: 0.55, phase: 0 };
  var pickTimer = 0;

  function pickTargets() {
    tgt.hue = (rnd() * 2 - 1) * 0.85;
    tgt.sat = 0.38 + rnd() * 0.42;
    tgt.lift = 0.44 + rnd() * 0.28;
    tgt.phase = rnd() * 6.28318530718;
    pickTimer = 4 + rnd() * 9;
  }

  pickTargets();

  function tick(dt) {
    var S = window.NX && NX.S;
    if (!S) return;
    if (typeof dt !== 'number' || dt <= 0) return;
    if (dt > 0.12) dt = 0.12;
    pickTimer -= dt;
    if (pickTimer <= 0) pickTargets();

    var k = 1 - Math.pow(0.92, dt * 60);
    cur.hue += (tgt.hue - cur.hue) * k * 0.35;
    cur.sat += (tgt.sat - cur.sat) * k * 0.4;
    cur.lift += (tgt.lift - cur.lift) * k * 0.4;
    cur.phase += dt * 0.11 + (tgt.phase - cur.phase) * k * 0.02;

    S.procHue = cur.hue;
    S.procSat = cur.sat;
    S.procLift = cur.lift;
    S.procPhase = Math.sin(cur.phase) * 0.5 + 0.5;
  }

  /**
   * Post-process calm vector: x = grade pump damp, y = bloom/streak damp,
   * z = glitch/kaleido damp, w = grain / micro-wobble damp.
   * @returns {number[]}
   */
  function getPostColorVec() {
    var calm = 0.22 + cur.lift * 0.28 + (1 - Math.abs(cur.hue)) * 0.08;
    calm = Math.max(0.12, Math.min(0.52, calm));
    var bloomD = 0.18 + cur.sat * 0.22;
    var fxD = 0.2 + Math.abs(cur.hue) * 0.25;
    var grainD = 0.35 + cur.sat * 0.3;
    return [calm, bloomD, fxD, grainD];
  }

  /**
   * Small additive deltas for OKLCH ambient (degrees / unitless / unitless).
   * @returns {{ dh: number, dc: number, dl: number }}
   */
  function getAmbientDeltas() {
    return {
      dh: cur.hue * 18,
      dc: (cur.sat - 0.5) * 0.06,
      dl: (cur.lift - 0.5) * 0.04
    };
  }

  function reseed() {
    seed = (Date.now() ^ (Math.floor(rnd() * 0xffffffff))) >>> 0;
    rnd = mulberry32(seed);
    pickTargets();
  }

  if (typeof NX !== 'undefined' && NX.SessionSeed && typeof NX.SessionSeed === 'object') {
    var prev = NX.SessionSeed._onChange;
    NX.SessionSeed._onChange = function () {
      if (typeof prev === 'function') prev.apply(this, arguments);
      reseed();
      if (NX.ProcParticles && typeof NX.ProcParticles.reseed === 'function') NX.ProcParticles.reseed();
    };
  }

  window.NX = window.NX || {};
  NX.ProceduralDrive = {
    tick: tick,
    getPostColorVec: getPostColorVec,
    getAmbientDeltas: getAmbientDeltas,
    reseed: reseed
  };
})();
