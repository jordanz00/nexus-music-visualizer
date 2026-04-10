'use strict';
/**
 * OlaClient — POST DMX universes to Open Lighting Architecture olad HTTP API (default :9090).
 * Browsers block cross-origin calls to olad; use tools/ola-cors-proxy.mjs and set baseUrl to :9393.
 */
(function () {
  var baseUrl = 'http://127.0.0.1:9393';
  var lastError = null;
  var lastOkAt = 0;

  function setBaseUrl(url) {
    if (url && typeof url === 'string') baseUrl = url.replace(/\/$/, '');
  }

  function getBaseUrl() {
    return baseUrl;
  }

  /**
   * @param {number} universe — OLA universe index (often 0)
   * @param {number[]|Uint8Array} channels — up to 512 bytes
   */
  function setDmx(universe, channels) {
    var len = Math.min(512, channels.length);
    var parts = [];
    for (var i = 0; i < len; i++) parts.push(Math.max(0, Math.min(255, channels[i] | 0)));
    var body = new URLSearchParams();
    body.set('u', String(universe | 0));
    body.set('d', parts.join(','));
    lastError = null;
    return fetch(baseUrl + '/set_dmx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      mode: 'cors',
      cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) throw new Error('OLA HTTP ' + res.status);
      lastOkAt = performance.now();
      return res;
    }).catch(function (err) {
      lastError = err && err.message ? err.message : String(err);
      throw err;
    });
  }

  window.NX = window.NX || {};
  NX.OlaClient = {
    setBaseUrl: setBaseUrl,
    getBaseUrl: getBaseUrl,
    setDmx: setDmx,
    getLastError: function () { return lastError; },
    getLastOkAt: function () { return lastOkAt; }
  };
})();
