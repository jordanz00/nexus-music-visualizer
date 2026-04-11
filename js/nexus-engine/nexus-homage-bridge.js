'use strict';
/**
 * nexus-homage-bridge.js — Scene-driven hybrid profiles + HM uniform drivers + YNI tap cycle.
 *
 * WHO THIS IS FOR: performers using homage scenes (MITD / AWAY / YNI / MAZE / CYBR / T00).
 * WHAT IT DOES: On scene change, applies HybridLayers.hybridProfile; ticks HM.y/z for breath/phase;
 *   tap #c cycles YNI HM.x when current scene name starts with YNI.
 * HOW IT CONNECTS: engine goNext / morph completion calls applyForScene; engine loop calls tick;
 *   ui.init calls init(). HM is uploaded in engine setCommonUniforms (see scenes.js HEAD).
 */
(function () {
  var NX = window.NX || (window.NX = {});

  function sceneNameAt(idx) {
    return (NX.scenes && NX.scenes[idx] && NX.scenes[idx].n) ? String(NX.scenes[idx].n) : '';
  }

  function ensureHM(S) {
    if (!S.homageHM || !Array.isArray(S.homageHM) || S.homageHM.length < 4) {
      S.homageHM = [0, 0, 0, 0];
    }
  }

  function hybridKeyForName(n) {
    if (n.indexOf('MITD') === 0) return 'mitd';
    if (n.indexOf('YNI') === 0) return 'mitd';
    if (n.indexOf('CYBR') === 0) return 'mitd';
    if (n.indexOf('T00') === 0) return 'mitd';
    if (n.indexOf('AWAY') === 0) return 'ambient';
    if (n.indexOf('MAZE') === 0) return 'full';
    return 'full';
  }

  /**
   * Apply hybrid stack + visual mode for scene index (resets HM except where tick repopulates).
   * @param {number} idx
   */
  function applyForScene(idx) {
    var S = NX.S;
    if (!S || !NX.scenes) return;
    ensureHM(S);
    var n = sceneNameAt(idx);
    S.homageHM[0] = S.homageHM[1] = S.homageHM[2] = S.homageHM[3] = 0;
    var key = hybridKeyForName(n);
    if (!NX.HybridLayers || !NX.HybridLayers.hybridProfile) return;
    var h = NX.HybridLayers.hybridProfile(key);
    S.hybridBcOpacity = h.hybridBcOpacity;
    S.hybridShaderOpacity = h.hybridShaderOpacity;
    if (NX.SceneManager && typeof NX.SceneManager.setMode === 'function') {
      NX.SceneManager.setMode(h.visualMode, { crossfade: true, fadeSec: 0.55 });
    }
    if (NX.SceneManager && NX.SceneManager.syncDOM) NX.SceneManager.syncDOM();
  }

  /**
   * @param {number} dt
   */
  function tick(dt) {
    var S = NX.S;
    if (!S || !NX.scenes) return;
    ensureHM(S);
    var n = sceneNameAt(S.curS);
    if (n.indexOf('MITD BREATH') === 0) {
      var r = typeof S.workletRms === 'number' ? S.workletRms : (typeof S.sVol === 'number' ? S.sVol : 0);
      S.homageHM[1] = Math.max(0, Math.min(1, r));
    } else if (n.indexOf('MITD DISTANT') === 0) {
      var ph = typeof S.beatPhase === 'number' ? S.beatPhase : 0;
      S.homageHM[2] = Math.max(0, Math.min(1, ph));
    }
  }

  function onCanvasClick() {
    var S = NX.S;
    if (!S || !NX.scenes) return;
    var n = sceneNameAt(S.curS);
    if (n.indexOf('YNI') !== 0) return;
    ensureHM(S);
    S.homageHM[0] = (Math.floor(S.homageHM[0]) + 1) % 3;
  }

  function init() {
    var c = document.getElementById('c');
    if (!c || c._nxHomageBound) return;
    c._nxHomageBound = true;
    c.addEventListener('click', onCanvasClick, false);
  }

  NX.HomageBridge = {
    applyForScene: applyForScene,
    tick: tick,
    init: init,
    sceneNameAt: sceneNameAt
  };
})();
