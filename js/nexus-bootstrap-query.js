'use strict';
/**
 * nexus-bootstrap-query.js — Safe URL/query helpers for demo, seed, Asura post, and cables guest flags.
 * WHO: boot + demo-director + nexus-cables-guest; WHAT: allowlist demo names, parse ?asura / ?cables*; WHY: avoid typos and centralize query parsing.
 */
(function () {
  if (!window.NX) window.NX = {};
  var ALLOWED_DEMOS = { drop: 1, festival: 1, genres: 1, ai: 1, resolume: 1, asura_show: 1 };

  /**
   * @param {string} raw
   * @returns {string} allowlisted key or '' if invalid
   */
  function normalizeDemo(raw) {
    if (raw == null) return '';
    var s = String(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!s || !ALLOWED_DEMOS[s]) return '';
    return s;
  }

  function hasExplicitSeedInUrl() {
    try {
      var u = new URL(window.location.href);
      var v = u.searchParams.get('seed');
      return v != null && String(v).length > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Parse `?asura=` for post-pass strength (see post.js uniform AZ).
   * @param {string} [href] — full URL; defaults to window.location.href
   * @returns {{ floor: boolean, value: number }|null} null if param absent/invalid
   */
  function parseAsuraPostParamFromHref(href) {
    try {
      var u = href ? new URL(href, window.location.href) : new URL(window.location.href);
      var v = u.searchParams.get('asura');
      if (v == null || String(v).trim() === '') return null;
      var t = String(v).trim();
      if (t === '1') return { floor: true, value: 0.78 };
      var n = parseFloat(t);
      if (isNaN(n)) return null;
      return { floor: false, value: Math.max(0, Math.min(1, n)) };
    } catch (e0) {
      return null;
    }
  }

  /**
   * Raw flags from `?cables=` / `?cablesUrl=` (no host validation — use NX.CablesGuest.isAllowedHttpsUrl).
   * @param {URLSearchParams} sp
   * @returns {{ rawC: string|null, explicitUrl: string|null, forceOff: boolean, forceOn: boolean }}
   */
  function parseCablesGuestQueryBasics(sp) {
    if (!sp || typeof sp.get !== 'function') {
      return { rawC: null, explicitUrl: null, forceOff: false, forceOn: false };
    }
    var rawC = sp.get('cables');
    var c = (rawC || '').trim().toLowerCase();
    return {
      rawC: rawC,
      explicitUrl: sp.get('cablesUrl') || sp.get('cables_patch'),
      forceOff: c === '0' || c === 'off' || c === 'false',
      forceOn: c === '1' || c === 'on' || c === 'true' || c === 'asura'
    };
  }

  NX.BootstrapQuery = {
    normalizeDemo: normalizeDemo,
    hasExplicitSeedInUrl: hasExplicitSeedInUrl,
    allowedDemos: function () { return Object.keys(ALLOWED_DEMOS); },
    parseAsuraPostParamFromHref: parseAsuraPostParamFromHref,
    parseCablesGuestQueryBasics: parseCablesGuestQueryBasics
  };
})();
