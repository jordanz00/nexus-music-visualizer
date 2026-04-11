'use strict';
/**
 * nexus-bootstrap-query.js — Safe URL/query helpers for demo and seed flags.
 * WHO: boot + demo-director; WHAT: allowlist demo names, detect explicit ?seed=; WHY: avoid typos driving demo sequences.
 */
(function () {
  if (!window.NX) window.NX = {};
  var ALLOWED_DEMOS = { drop: 1, festival: 1, genres: 1, ai: 1, resolume: 1 };

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

  NX.BootstrapQuery = {
    normalizeDemo: normalizeDemo,
    hasExplicitSeedInUrl: hasExplicitSeedInUrl,
    allowedDemos: function () { return Object.keys(ALLOWED_DEMOS); }
  };
})();
