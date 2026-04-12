'use strict';
/**
 * nexus-cables-guest.js — Optional iframe layer for hosted cables.gl / MFX patches (real WebGL in embed).
 *
 * WHO THIS IS FOR: operators who want the actual Asura patch (https://mfx.drastic.net/view/asura/) or other
 * allowlisted cables.gl exports composited under NEXUS (screen blend, like #c-three).
 * SECURITY: Only https: URLs whose hostname is in ALLOWED_HOSTS may be loaded — no raw user text without validation.
 * BLAST RADIUS: extra GPU + network in iframe; keep off on low-end / iOS unless needed.
 */
(function () {
  var DEFAULT_PATCH = 'https://mfx.drastic.net/view/asura/';
  /** Hostnames permitted for iframe src (add only vetted hosts). */
  var ALLOWED_HOSTS = {
    'mfx.drastic.net': true,
    'www.mfx.drastic.net': true,
    'cables.gl': true,
    'sandbox.cables.gl': true
  };

  var LS_ENABLE = 'nexus.cables.guest';
  var LS_URL = 'nexus.cables.guest.url';
  var LS_OPACITY = 'nexus.cables.guest.opacity';

  var enabled = false;
  var currentUrl = '';
  var opacity01 = 0.48;

  /**
   * @param {string} raw
   * @returns {string|null} canonical href or null
   */
  function isAllowedHttpsUrl(raw) {
    if (raw == null || typeof raw !== 'string') return null;
    var s = raw.trim();
    if (!s) return null;
    try {
      var u = new URL(s);
      if (u.protocol !== 'https:') return null;
      if (!ALLOWED_HOSTS[u.hostname]) return null;
      if (u.hash && u.hash.length > 800) return null;
      return u.href;
    } catch (e) {
      return null;
    }
  }

  function persistGet(k) {
    try {
      if (NX.Persist && NX.Persist.getItem) return NX.Persist.getItem(k);
    } catch (e0) { /* ignore */ }
    return null;
  }

  function persistSet(k, v) {
    try {
      if (NX.Persist && NX.Persist.setItem) NX.Persist.setItem(k, v);
    } catch (e1) { /* ignore */ }
  }

  function queryParams() {
    try {
      return new URLSearchParams(window.location.search || '');
    } catch (e) {
      return new URLSearchParams();
    }
  }

  /**
   * Session + URL + localStorage merge for “should the guest iframe be on at boot?”.
   * @returns {{ want: boolean, url: string|null, forceOff: boolean }}
   */
  function readBootIntent() {
    var p = queryParams();
    var rawC = p.get('cables');
    var c = (rawC || '').trim().toLowerCase();
    var basics = (NX.BootstrapQuery && typeof NX.BootstrapQuery.parseCablesGuestQueryBasics === 'function')
      ? NX.BootstrapQuery.parseCablesGuestQueryBasics(p)
      : null;
    var forceOff = basics ? basics.forceOff : (c === '0' || c === 'off' || c === 'false');
    var forceOn = basics ? basics.forceOn : (c === '1' || c === 'on' || c === 'true' || c === 'asura');
    var explicitUrl = basics ? basics.explicitUrl : (p.get('cablesUrl') || p.get('cables_patch'));
    var resolved = null;
    var fromExplicitParam = false;
    if (explicitUrl) {
      try {
        resolved = isAllowedHttpsUrl(decodeURIComponent(explicitUrl.trim()));
      } catch (eD) {
        resolved = isAllowedHttpsUrl(explicitUrl.trim());
      }
      if (resolved) fromExplicitParam = true;
    }
    if (!resolved && rawC && (rawC.indexOf('https:') === 0 || rawC.indexOf('https%3A') === 0 || rawC.indexOf('https%3a') === 0)) {
      try {
        resolved = isAllowedHttpsUrl(decodeURIComponent(rawC.trim()));
      } catch (eU) {
        resolved = isAllowedHttpsUrl(rawC.trim());
      }
    }
    if (!resolved) {
      var stored = persistGet(LS_URL);
      if (stored) resolved = isAllowedHttpsUrl(stored);
    }
    if (!resolved) resolved = DEFAULT_PATCH;

    var lsOn = persistGet(LS_ENABLE) === '1';
    var want = false;
    if (forceOff) want = false;
    else if (forceOn) want = true;
    else if (rawC) {
      var decC = rawC.trim();
      try {
        if (decC.indexOf('%') >= 0) decC = decodeURIComponent(decC);
      } catch (eDec) { /* keep decC */ }
      var absC = isAllowedHttpsUrl(decC);
      if (absC) {
        want = true;
        resolved = absC;
      }
    }
    if (!want && lsOn) want = true;
    if (!forceOff && fromExplicitParam && resolved) want = true;

    return { want: want, url: resolved, forceOff: forceOff };
  }

  function readOpacityFromStorage() {
    var o = persistGet(LS_OPACITY);
    if (o == null || o === '') return 0.48;
    var n = parseInt(String(o), 10);
    if (isNaN(n)) return 0.48;
    return Math.max(0, Math.min(1, n / 100));
  }

  function applyDom() {
    var wrap = document.getElementById('nx-cables-guest-wrap');
    var frame = document.getElementById('nx-cables-guest-frame');
    if (!wrap || !frame) return;
    if (!enabled || !currentUrl) {
      wrap.classList.remove('nx-cables-guest-on');
      wrap.setAttribute('aria-hidden', 'true');
      try {
        frame.removeAttribute('data-nx-src');
        frame.removeAttribute('src');
        frame.setAttribute('src', 'about:blank');
      } catch (eB) { /* ignore */ }
      wrap.style.opacity = '0';
      return;
    }
    wrap.classList.add('nx-cables-guest-on');
    wrap.setAttribute('aria-hidden', 'false');
    wrap.style.opacity = String(Math.max(0, Math.min(1, opacity01)));
    if (frame.getAttribute('data-nx-src') !== currentUrl) {
      frame.setAttribute('data-nx-src', currentUrl);
      frame.setAttribute('loading', 'eager');
      frame.setAttribute('src', currentUrl);
    } else {
      wrap.style.opacity = String(Math.max(0, Math.min(1, opacity01)));
    }
  }

  /**
   * @param {boolean} on
   * @param {{ url?: string|null, skipPersist?: boolean }} [opts]
   */
  function setEnabled(on, opts) {
    opts = opts || {};
    enabled = !!on;
    if (enabled) {
      var u = opts.url != null ? isAllowedHttpsUrl(String(opts.url)) : null;
      if (!u) u = isAllowedHttpsUrl(currentUrl) || isAllowedHttpsUrl(DEFAULT_PATCH) || DEFAULT_PATCH;
      currentUrl = u;
      if (!opts.skipPersist) {
        persistSet(LS_ENABLE, '1');
        persistSet(LS_URL, currentUrl);
      }
    } else {
      if (!opts.skipPersist) persistSet(LS_ENABLE, '0');
    }
    applyDom();
    syncUiChrome();
  }

  function setOpacity01(v) {
    opacity01 = Math.max(0, Math.min(1, typeof v === 'number' ? v : parseFloat(v) || 0));
    persistSet(LS_OPACITY, String(Math.round(opacity01 * 100)));
    applyDom();
    syncUiChrome();
  }

  /**
   * @param {string} raw
   * @returns {boolean}
   */
  function setPatchUrl(raw) {
    var u = isAllowedHttpsUrl(raw);
    if (!u) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS Cables guest: URL not allowlisted (https + host check):', raw);
      return false;
    }
    currentUrl = u;
    persistSet(LS_URL, currentUrl);
    var frame = document.getElementById('nx-cables-guest-frame');
    if (frame) frame.removeAttribute('data-nx-src');
    if (enabled) applyDom();
    syncUiChrome();
    return true;
  }

  function syncUiChrome() {
    var cb = document.getElementById('nx-cables-guest-on');
    var op = document.getElementById('nx-cables-guest-opacity');
    var urlEl = document.getElementById('nx-cables-guest-url');
    if (cb) cb.checked = enabled;
    if (op) op.value = String(Math.round(opacity01 * 100));
    if (urlEl) urlEl.value = currentUrl || DEFAULT_PATCH;
  }

  /** Call after NX.ui.init so controls exist. */
  function initAfterBoot() {
    var intent = readBootIntent();
    opacity01 = readOpacityFromStorage();
    if (intent.forceOff) {
      enabled = false;
      persistSet(LS_ENABLE, '0');
      currentUrl = intent.url || DEFAULT_PATCH;
      applyDom();
      syncUiChrome();
      return;
    }
    if (intent.want) {
      currentUrl = intent.url || DEFAULT_PATCH;
      enabled = true;
      applyDom();
      if (typeof console !== 'undefined' && console.info) {
        console.info('[NEXUS] cables.gl guest iframe on —', currentUrl);
      }
    } else {
      currentUrl = intent.url || isAllowedHttpsUrl(persistGet(LS_URL)) || DEFAULT_PATCH;
      enabled = false;
      applyDom();
    }
    syncUiChrome();
  }

  function getState() {
    return {
      enabled: enabled,
      opacity: opacity01,
      url: currentUrl || DEFAULT_PATCH,
      defaultPatch: DEFAULT_PATCH
    };
  }

  window.NX = window.NX || {};
  NX.CablesGuest = {
    DEFAULT_PATCH: DEFAULT_PATCH,
    ALLOWED_HOSTS: ALLOWED_HOSTS,
    isAllowedHttpsUrl: isAllowedHttpsUrl,
    initAfterBoot: initAfterBoot,
    setEnabled: setEnabled,
    setOpacity01: setOpacity01,
    setPatchUrl: setPatchUrl,
    getState: getState,
    isEnabled: function () { return enabled; }
  };
})();
