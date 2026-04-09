'use strict';
/**
 * VisualEngineManager — Butterchurn instance (modular; do not fork upstream).
 * Output is 2D-bitblt from internal WebGL2; uses #c-bc.
 */
(function () {
  var S = NX.S;
  var viz = null;
  var canvas = null;
  var connectedNode = null;
  var intensity = 1;
  var speed = 1;
  var _fpsAdjTick = 0;
  var _lastAdjFps = 0;

  function getBC() {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    var b = typeof butterchurn !== 'undefined' ? butterchurn : (g && g.butterchurn) ? g.butterchurn : null;
    if (!b) return null;
    if (typeof b.createVisualizer === 'function') return b;
    if (b.default && typeof b.default.createVisualizer === 'function') return b.default;
    return b.default || b;
  }

  function ensureAudioForBC() {
    if (S.audioCtx && S.gainNode) return true;
    return false;
  }

  function bcAudioFeedNode() {
    return S.bcGateNode || S.gainNode;
  }

  function disconnectAudio() {
    if (viz && connectedNode && viz.disconnectAudio) {
      try { viz.disconnectAudio(connectedNode); } catch (e) { }
    }
    connectedNode = null;
  }

  function connectAudio() {
    var feed = bcAudioFeedNode();
    if (!viz || !feed) return;
    disconnectAudio();
    try {
      viz.connectAudio(feed);
      connectedNode = feed;
    } catch (e) { console.warn('Aurora Field connectAudio:', e.message); }
  }

  function initVisualizer() {
    if (viz) return !!viz;
    var BC = getBC();
    canvas = document.getElementById('c-bc');
    if (!BC || !canvas || !BC.createVisualizer) {
      console.warn('Aurora Field engine not loaded (Butterchurn missing or unsupported)');
      return false;
    }
    if (!S.audioCtx) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, S.nexusPerfLock ? 1 : 2);
    var w = Math.floor((S.W || innerWidth) * dpr);
    var h = Math.floor((S.H || innerHeight) * dpr);
    try {
      viz = BC.createVisualizer(S.audioCtx, canvas, {
        width: w,
        height: h,
        pixelRatio: 1,
        textureRatio: 1
      });
      connectAudio();
      return true;
    } catch (e) {
      console.warn('Aurora Field init failed:', e.message);
      viz = null;
      return false;
    }
  }

  function resize() {
    if (!canvas) canvas = document.getElementById('c-bc');
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, S.nexusPerfLock ? 1 : 2);
    var w = Math.floor((S.W || innerWidth) * dpr);
    var h = Math.floor((S.H || innerHeight) * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = (S.W || window.innerWidth) + 'px';
    canvas.style.height = (S.H || window.innerHeight) + 'px';
    if (viz && viz.setRendererSize) viz.setRendererSize(w, h);
  }

  function render() {
    if (!viz) return;
    try {
      if (typeof viz.adjustRateToFPS === 'function' && typeof S._emaFps === 'number' && S._emaFps > 1) {
        _fpsAdjTick++;
        var fps = Math.round(S._emaFps);
        if (_fpsAdjTick % 15 === 0 || Math.abs(fps - _lastAdjFps) >= 3) {
          _lastAdjFps = fps;
          viz.adjustRateToFPS(fps);
        }
      }
      viz.render();
    } catch (e) { /* swallow frame errors */ }
  }

  /**
   * @param {object} presetObj — MilkDrop JSON
   * @param {number} blendSec — crossfade duration (Butterchurn native blend)
   * @param {string} [presetKey] — catalog name (HUD + morph conductor)
   * @param {{ fromConductor?: boolean }} [flags] — skip manual-morph reset when true
   */
  function loadPreset(presetObj, blendSec, presetKey, flags) {
    if (!viz || !presetObj) return;
    blendSec = blendSec == null ? 2 : blendSec;
    flags = flags || {};
    if (presetKey) {
      S.bcLastPresetKey = presetKey;
      if (!flags.fromConductor && NX.BcMorphConductor && NX.BcMorphConductor.notifyManualPresetLoad) {
        NX.BcMorphConductor.notifyManualPresetLoad(presetKey);
      }
    }
    var p = viz.loadPreset(presetObj, blendSec);
    if (p && typeof p.then === 'function') p.catch(function () { });
  }

  function setIntensity(v) {
    intensity = Math.max(0, Math.min(1.5, v));
    /* Preset-agnostic: mesh/detail hooks vary by Butterchurn version; store for future hooks */
    S.bcIntensity = intensity;
  }

  function setSpeed(v) {
    speed = Math.max(0.25, Math.min(2, v));
    S.bcSpeed = speed;
    /* Butterchurn 2.6 drives time from audio; speed is stored for future renderer hooks / presets */
  }

  function destroy() {
    disconnectAudio();
    viz = null;
  }

  function isReady() { return !!viz; }

  NX.VisualEngineManager = {
    initVisualizer: initVisualizer,
    resize: resize,
    render: render,
    loadPreset: loadPreset,
    setIntensity: setIntensity,
    setSpeed: setSpeed,
    connectAudio: connectAudio,
    disconnectAudio: disconnectAudio,
    destroy: destroy,
    isReady: isReady,
    ensureAudioForBC: ensureAudioForBC
  };
})();
