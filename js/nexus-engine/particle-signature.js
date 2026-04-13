'use strict';
/**
 * particle-signature.js — Deterministic hashes from scene + Aurora preset + palette
 * for GPU/CPU particle field variation (no giant strings in shaders).
 */
(function () {
  function fnv1a(str) {
    var h = 2166136261 >>> 0;
    var s = str == null ? '' : String(str);
    var i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * @param {number} curS
   * @param {string} bcLastPresetKey
   * @param {number} pal
   * @returns {{ h: number, h2: number, u_sigA: Float32Array, u_sigB: Float32Array }}
   */
  function pack(curS, bcLastPresetKey, pal) {
    var S = typeof window !== 'undefined' && window.NX && NX.S;
    var cid = S && S.bcPresetContentId != null ? String(S.bcPresetContentId) : '';
    var key = String(bcLastPresetKey || '').slice(0, 96);
    var tail = cid ? '|' + cid.slice(0, 48) : '';
    var h = fnv1a(key + tail + '|' + (curS | 0) + '|' + (pal | 0));
    var h2 = fnv1a('nxps|' + (curS | 0) + '|' + key + tail);
    return {
      h: h,
      h2: h2,
      u_sigA: new Float32Array([
        (h & 65535) / 65535,
        ((h >> 16) & 65535) / 65535,
        (h2 & 65535) / 65535,
        ((h2 >> 16) & 65535) / 65535
      ]),
      u_sigB: new Float32Array([
        (fnv1a(key + 'b') & 1023) / 1023,
        (fnv1a(key + 'c') & 1023) / 1023
      ])
    };
  }

  window.NX = window.NX || {};
  NX.ParticleSignature = {
    fnv1a: fnv1a,
    pack: pack
  };
})();
