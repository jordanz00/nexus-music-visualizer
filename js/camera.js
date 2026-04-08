'use strict';
/*  camera.js — Cinematic camera system with multiple motion modes.
    Used by scenes via NX.camera.get(mode, t, audio) → {ro, ta, roll}    */

(function () {
  var S = NX.S;

  var modes = {
    orbit: function (t, az, el, dist, mx) {
      az += t * 0.2 + mx[0] * 3.14159;
      el = Math.max(-1.35, Math.min(1.35, el + mx[1] * 0.9));
      var ro = [
        dist * Math.cos(el) * Math.cos(az),
        dist * Math.sin(el),
        dist * Math.cos(el) * Math.sin(az)
      ];
      return { ro: ro, ta: [0, 0, 0], roll: Math.sin(t * 0.06) * 0.02 };
    },

    dolly: function (t, az, el, dist, mx) {
      var bv = typeof S.beatVisual === 'number' ? S.beatVisual : S.beat * 0.55;
      var d = dist + S.sBass * 0.6 + bv * 0.22;
      az += t * 0.15 + mx[0] * 2.5;
      el = Math.max(-1.2, Math.min(1.2, 0.3 + mx[1] * 0.7));
      var ro = [d * Math.cos(el) * Math.cos(az), d * Math.sin(el), d * Math.cos(el) * Math.sin(az)];
      return { ro: ro, ta: [0, 0, 0], roll: 0 };
    },

    crane: function (t, az, el, dist, mx) {
      var sweep = Math.sin(t * 0.12) * 1.5;
      az += t * 0.1 + mx[0] * 2.0;
      var ro = [dist * Math.cos(az), sweep + mx[1] * 0.5, dist * Math.sin(az)];
      return { ro: ro, ta: [0, sweep * 0.3, 0], roll: Math.sin(t * 0.04) * 0.015 };
    },

    handheld: function (t, az, el, dist, mx) {
      var wobX = Math.sin(t * 2.7) * 0.015 + Math.sin(t * 4.3) * 0.008;
      var wobY = Math.sin(t * 3.1) * 0.012 + Math.cos(t * 5.1) * 0.006;
      az += t * 0.18 + mx[0] * 3.0;
      el = Math.max(-1.3, Math.min(1.3, 0.2 + mx[1] * 0.8));
      var ro = [
        dist * Math.cos(el) * Math.cos(az) + wobX,
        dist * Math.sin(el) + wobY,
        dist * Math.cos(el) * Math.sin(az)
      ];
      return { ro: ro, ta: [wobX * 2, wobY * 2, 0], roll: wobX * 0.5 };
    },

    snap: function (t, az, el, dist, mx) {
      var snapAz = az + t * 0.2 + mx[0] * 3.14;
      var bv2 = typeof S.beatVisual === 'number' ? S.beatVisual : S.beat * 0.55;
      if (bv2 > 0.62) snapAz += (Math.random() - 0.5) * S.sFlux * 0.85;
      el = Math.max(-1.3, Math.min(1.3, 0.3 + mx[1] * 0.8));
      var ro = [dist * Math.cos(el) * Math.cos(snapAz), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(snapAz)];
      return { ro: ro, ta: [0, 0, 0], roll: bv2 * 0.022 * (Math.random() > 0.5 ? 1 : -1) };
    }
  };

  /**
   * Get camera for a given mode.
   * @param {string} mode  - orbit|dolly|crane|handheld|snap
   * @param {number} t     - scene time
   * @param {Object} opts  - { az, el, dist } defaults
   * @returns {{ro:number[], ta:number[], roll:number}}
   */
  function get(mode, t, opts) {
    opts = opts || {};
    var fn = modes[mode] || modes.orbit;
    return fn(t, opts.az || 0, opts.el || 0.3, opts.dist || 3.2, S.mouseSmooth);
  }

  NX.camera = { get: get, modes: Object.keys(modes) };
})();
