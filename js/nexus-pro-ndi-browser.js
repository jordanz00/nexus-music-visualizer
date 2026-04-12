'use strict';
/**
 * nexus-pro-ndi-browser.js — JPEG frame pump to local tools/nexus-ndi-bridge.mjs (NDI toolchain hook).
 */
(function () {
  var _ws = null;
  var _interval = 0;
  var _quality = 0.82;

  function stopPump() {
    if (_interval) {
      clearInterval(_interval);
      _interval = 0;
    }
  }

  function guard() {
    return NX.NexusEndpointGuard || { isAllowedProWsUrl: function () { return false; } };
  }

  function disconnect() {
    stopPump();
    try {
      if (_ws) _ws.close();
    } catch (e) { /* ignore */ }
    _ws = null;
  }

  /**
   * @param {string} wsUrl
   * @returns {Promise<void>}
   */
  function connect(wsUrl) {
    disconnect();
    var g = guard();
    if (!g.isAllowedProWsUrl(wsUrl)) return Promise.reject(new Error('blocked-ws-url'));
    return new Promise(function (resolve, reject) {
      _ws = new WebSocket(wsUrl);
      _ws.binaryType = 'arraybuffer';
      _ws.onopen = function () { resolve(); };
      _ws.onerror = function () { reject(new Error('ws')); };
    });
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} fps
   */
  function startPump(canvas, fps) {
    if (!_ws || _ws.readyState !== 1 || !canvas) return;
    stopPump();
    var ms = Math.max(50, Math.floor(1000 / Math.max(1, fps | 0)));
    _interval = setInterval(function () {
      if (!_ws || _ws.readyState !== 1) return;
      canvas.toBlob(function (blob) {
        if (!blob || !_ws || _ws.readyState !== 1) return;
        blob.arrayBuffer().then(function (buf) {
          try {
            _ws.send(buf);
          } catch (e) { /* ignore */ }
        }).catch(function () { });
      }, 'image/jpeg', _quality);
    }, ms);
  }

  window.NX = window.NX || {};
  NX.NdiBridge = {
    connect: connect,
    disconnect: disconnect,
    startPump: startPump,
    stopPump: stopPump,
    setJpegQuality: function (q) {
      _quality = Math.max(0.35, Math.min(0.95, +q || 0.82));
    },
    isConnected: function () { return !!(_ws && _ws.readyState === 1); }
  };
})();
