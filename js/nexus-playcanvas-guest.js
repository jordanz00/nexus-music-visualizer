'use strict';
/**
 * nexus-playcanvas-guest.js — Optional PlayCanvas Engine layer on #c-playcanvas (third WebGL context).
 *
 * WHO THIS IS FOR: operators enabling MIT PlayCanvas alongside native WebGL / optional Three guest.
 * WHAT IT DOES: URL `?playcanvas=1` or localStorage `nexus.playcanvas.guest=1` loads vendor/playcanvas.min.js
 *   and runs a minimal scene (camera + directional light + box) driven by NX.S band / beat uniforms.
 * BLAST RADIUS: ~2.1 MB engine + extra GPU; keep off on low-end / iOS unless testing. Pauses render when MAZE Three scene is active (same policy as Three guest).
 */
(function () {
  var enabled = false;
  var app = null;
  var boxEntity = null;
  /** Cached PlayCanvas namespace (same as window.pc after load). */
  var pcNs = null;

  function wantsPlaycanvasFromEnv() {
    try {
      if (new URLSearchParams(location.search).get('playcanvas') === '1') return true;
    } catch (e0) { /* ignore */ }
    try {
      if (NX.Persist && NX.Persist.getItem('nexus.playcanvas.guest') === '1') return true;
    } catch (e1) { /* ignore */ }
    return false;
  }

  function mazeActive() {
    return !!(NX.MazeThree && typeof NX.MazeThree.isActive === 'function' && NX.MazeThree.isActive());
  }

  function syncCanvasSize() {
    var main = document.getElementById('c');
    var cv = document.getElementById('c-playcanvas');
    if (!main || !cv || !app) return;
    if (cv.width !== main.width || cv.height !== main.height) {
      cv.width = main.width;
      cv.height = main.height;
    }
    try {
      if (!pcNs) return;
      app.setCanvasFillMode(pcNs.FILLMODE_NONE);
      app.setCanvasResolution(pcNs.RESOLUTION_FIXED, cv.width, cv.height);
    } catch (eS) { /* ignore */ }
  }

  function showLayer(on) {
    var cv = document.getElementById('c-playcanvas');
    if (!cv) return;
    cv.style.opacity = on ? '0.4' : '0';
    cv.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function stop() {
    enabled = false;
    showLayer(false);
    if (app) {
      try {
        app.destroy();
      } catch (eD) { /* ignore */ }
    }
    app = null;
    boxEntity = null;
  }

  /**
   * Build PlayCanvas Application after global `pc` is available.
   * @returns {boolean}
   */
  function bootstrapFromUrl() {
    if (!wantsPlaycanvasFromEnv()) return false;
    var pcRef = typeof window !== 'undefined' ? window.pc : null;
    if (!pcRef || !pcRef.Application) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS PlayCanvas guest: pc missing');
      return false;
    }
    var cv = document.getElementById('c-playcanvas');
    if (!cv) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS PlayCanvas guest: #c-playcanvas missing');
      return false;
    }
    stop();
    pcNs = pcRef;
    enabled = true;
    try {
      app = new pcRef.Application(cv);
    } catch (eA) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS PlayCanvas guest init:', eA);
      stop();
      return false;
    }

    app.setCanvasFillMode(pcRef.FILLMODE_NONE);
    app.scene.ambientLight = new pcRef.Color(0.12, 0.14, 0.2);

    var camera = new pcRef.Entity('nx-pc-cam');
    camera.addComponent('camera', {
      clearColor: new pcRef.Color(0, 0, 0, 0),
      clearColorBuffer: true
    });
    camera.setPosition(0, 0, 3.2);
    app.root.addChild(camera);

    var light = new pcRef.Entity('nx-pc-light');
    light.addComponent('light', {
      type: 'directional',
      color: new pcRef.Color(1, 0.92, 0.85),
      intensity: 1.15
    });
    light.setLocalEulerAngles(48, 32, 0);
    app.root.addChild(light);

    boxEntity = new pcRef.Entity('nx-pc-box');
    boxEntity.addComponent('render', { type: 'box' });
    app.root.addChild(boxEntity);

    var eulerDeg = { x: 0, y: 0, z: 0 };
    app.on('update', function (dt) {
      if (!enabled || !app || !boxEntity) return;
      var mz = mazeActive();
      app.autoRender = !mz;
      if (mz) {
        showLayer(false);
        return;
      }
      showLayer(true);
      syncCanvasSize();
      var S = window.NX && NX.S;
      var bass = S && typeof S.sBass === 'number' ? S.sBass : 0;
      var mid = S && typeof S.sMid === 'number' ? S.sMid : 0;
      var bv = S && typeof S.beatVisual === 'number' ? S.beatVisual : 0;
      var ph = S && typeof S.beatPhase === 'number' ? S.beatPhase : 0;
      eulerDeg.x += (38 + bass * 120) * dt;
      eulerDeg.y += (44 + mid * 95) * dt;
      eulerDeg.z += (22 + bv * 70) * dt;
      boxEntity.setLocalEulerAngles(eulerDeg.x, eulerDeg.y, eulerDeg.z);
      var s = 0.85 + bass * 0.45 + bv * 0.2 + Math.sin(ph * Math.PI * 2) * 0.04;
      boxEntity.setLocalScale(s, s, s);
    });

    syncCanvasSize();
    app.start();
    if (typeof console !== 'undefined' && console.info) {
      console.info('[NEXUS] PlayCanvas guest on — third WebGL context (~2.1 MB). Remove ?playcanvas=1 or localStorage nexus.playcanvas.guest to disable.');
    }
    return true;
  }

  window.NX = window.NX || {};
  NX.PlaycanvasGuest = {
    wantsPlaycanvasFromEnv: wantsPlaycanvasFromEnv,
    bootstrapFromUrl: bootstrapFromUrl,
    stop: stop,
    isEnabled: function () { return enabled; }
  };
})();
