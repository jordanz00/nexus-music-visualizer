'use strict';
/**
 * SessionSeed — 32-bit session identity for DNA uniforms + NX.randomUnit() (seeded PRNG).
 * Supports ?seed=123 or string; optional persistence in localStorage.
 */
(function () {
  if (!window.NX) window.NX = {};
  if (!NX.S) {
    NX.SessionSeed = {
      init: function () {},
      reroll: function () {},
      setSeed: function () {},
      getSeed: function () { return 0; },
      copyShareUrl: function () { return ''; },
      randomUnit: function () { return Math.random(); },
      applyFromStoredPreset: function () {}
    };
    NX.randomUnit = function () { return Math.random(); };
    return;
  }
  var S = NX.S;
  var STORAGE_KEY = 'nx_session_seed';
  var _rngState = 0xdeadbeef;

  function fnv1a(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function seedToDna(seed) {
    var x = seed >>> 0;
    if (!x) x = 0x9e3779b9;
    function mix() {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    }
    return [mix(), mix(), mix(), mix()];
  }

  function resetRngFromSeed(seed) {
    _rngState = (seed ^ 0x6d2b79f5) >>> 0;
    if (!_rngState) _rngState = 0xf1365e35;
  }

  function randomUnit() {
    _rngState = (_rngState + 0x6d2b79f5) >>> 0;
    var t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function applyDnaToState(dna) {
    S.dnaX = dna[0];
    S.dnaY = dna[1];
    S.dnaZ = dna[2];
    S.dnaW = dna[3];
  }

  function applySeed(seed, opts) {
    opts = opts || {};
    seed = seed >>> 0;
    S.sessionSeed = seed;
    resetRngFromSeed(seed);
    applyDnaToState(seedToDna(seed));
    if (opts.persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, String(seed));
      } catch (e) { /* ignore */ }
    }
    if (opts.skipUrl !== true && history.replaceState) {
      try {
        var u = new URL(location.href);
        u.searchParams.set('seed', String(seed));
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch (e2) { /* ignore */ }
    }
    if (typeof NX.SessionSeed._onChange === 'function') {
      try { NX.SessionSeed._onChange(seed); } catch (e3) { /* ignore */ }
    }
  }

  function parseInitialSeed() {
    try {
      var u = new URL(location.href);
      var q = u.searchParams.get('seed');
      if (q != null && q !== '') {
        if (/^\d+$/.test(q)) return parseInt(q, 10) >>> 0;
        return fnv1a(q) >>> 0;
      }
    } catch (e) { /* ignore */ }
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s && /^\d+$/.test(s)) return parseInt(s, 10) >>> 0;
    } catch (e2) { /* ignore */ }
    return ((Date.now() & 0xffff) ^ (Math.floor(Math.random() * 0xffffffff) >>> 0)) >>> 0;
  }

  function init() {
    if (!S) return;
    var seed = parseInitialSeed();
    applySeed(seed, { persist: true, skipUrl: true });
  }

  function reroll() {
    var s = ((Date.now() ^ _rngState) >>> 0) ^ (Math.floor(Math.random() * 0xffffffff) >>> 0);
    applySeed(s || 1, { persist: true, skipUrl: false });
  }

  function setSeed(n) {
    applySeed((n >>> 0) || 1, { persist: true, skipUrl: false });
  }

  function copyShareUrl() {
    try {
      var u = new URL(location.href);
      u.searchParams.set('seed', String(S.sessionSeed >>> 0));
      return u.toString();
    } catch (e) {
      return '';
    }
  }

  function applyFromStoredPreset(seed) {
    if (seed == null || seed === '') return;
    var n = typeof seed === 'number' ? seed >>> 0 : parseInt(String(seed), 10) >>> 0;
    if (!n) n = 1;
    applySeed(n, { persist: false, skipUrl: true });
  }

  NX.SessionSeed = {
    init: init,
    reroll: reroll,
    setSeed: setSeed,
    getSeed: function () { return (S.sessionSeed >>> 0); },
    copyShareUrl: copyShareUrl,
    applyFromStoredPreset: applyFromStoredPreset,
    randomUnit: randomUnit,
    _onChange: null
  };

  NX.randomUnit = function () {
    if (NX.SessionSeed && typeof NX.SessionSeed.randomUnit === 'function') {
      return NX.SessionSeed.randomUnit();
    }
    return Math.random();
  };

  init();
})();
