'use strict';
/*  watermark.js — Free tier watermark overlay + Pro unlock system.
    Draws a subtle "NEXUS MARK IV" watermark on the canvas for free
    users. Pro unlock via localStorage key removes it.                 */

(function () {
  var S = NX.S;
  var isPro = false;
  var STORAGE_KEY = 'nx_pro_key';
  var wCanvas = null, wCtx = null;

  function checkPro() {
    try {
      var key = localStorage.getItem(STORAGE_KEY);
      isPro = key === 'NEXUS_MK4_UNLOCKED';
    } catch (e) { isPro = false; }
    updateBadge();
    return isPro;
  }

  function unlock(code) {
    if (code === 'NEXUS_MK4_PRO' || code === 'earlyaccess2026') {
      try { localStorage.setItem(STORAGE_KEY, 'NEXUS_MK4_UNLOCKED'); } catch (e) { }
      isPro = true; updateBadge();
      return true;
    }
    return false;
  }

  function lock() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
    isPro = false; updateBadge();
  }

  function updateBadge() {
    var el = document.getElementById('pro-badge');
    if (el) {
      el.textContent = isPro ? 'PRO' : 'FREE';
      el.className = 'pro-badge ' + (isPro ? 'pro' : 'free');
    }
  }

  function createOverlay() {
    wCanvas = document.createElement('canvas');
    wCanvas.width = 400; wCanvas.height = 50;
    wCtx = wCanvas.getContext('2d');
  }

  /* Draw watermark onto the WebGL canvas via 2D overlay */
  function render() {
    if (isPro) return;
    var el = document.getElementById('watermark');
    if (!el) return;
    el.style.display = 'block';
  }

  function hide() {
    var el = document.getElementById('watermark');
    if (el) el.style.display = 'none';
  }

  function tick() {
    if (isPro) { hide(); return; }
    render();
  }

  NX.watermark = { checkPro: checkPro, unlock: unlock, lock: lock, tick: tick, isPro: function () { return isPro; } };
})();
