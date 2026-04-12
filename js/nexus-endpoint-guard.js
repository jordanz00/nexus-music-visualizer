'use strict';
/**
 * nexus-endpoint-guard.js — Allowlist for Pro features (Comfy, WebRTC signaling, NDI relay).
 * Loopback-only by default to reduce SSRF risk from imported showfiles or stored URLs.
 */
(function () {
  /**
   * @param {string} raw
   * @returns {boolean}
   */
  function isLoopbackHost(hostname) {
    if (!hostname) return false;
    var h = String(hostname).toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  }

  /**
   * @param {string} raw
   * @returns {boolean}
   */
  function isAllowedProHttpUrl(raw) {
    if (raw == null || typeof raw !== 'string') return false;
    var s = raw.trim();
    if (!s || /^javascript:/i.test(s) || /^data:/i.test(s) || /^file:/i.test(s)) return false;
    var u;
    try {
      u = new URL(s, typeof location !== 'undefined' ? location.href : 'http://localhost/');
    } catch (e) {
      return false;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (!isLoopbackHost(u.hostname)) return false;
    return true;
  }

  /**
   * WebSocket signaling (ws / wss) — loopback only unless same-origin.
   * @param {string} raw
   * @returns {boolean}
   */
  function isAllowedProWsUrl(raw) {
    if (raw == null || typeof raw !== 'string') return false;
    var s = raw.trim();
    if (!s || /^javascript:/i.test(s)) return false;
    var u;
    try {
      u = new URL(s, typeof location !== 'undefined' ? location.href : 'http://localhost/');
    } catch (e2) {
      return false;
    }
    if (u.protocol !== 'ws:' && u.protocol !== 'wss:') return false;
    if (isLoopbackHost(u.hostname)) return true;
    try {
      if (typeof location !== 'undefined' && u.origin === location.origin) return true;
    } catch (e3) { /* ignore */ }
    return false;
  }

  window.NX = window.NX || {};
  NX.NexusEndpointGuard = {
    isLoopbackHost: isLoopbackHost,
    isAllowedProHttpUrl: isAllowedProHttpUrl,
    isAllowedProWsUrl: isAllowedProWsUrl
  };
})();
