'use strict';
/**
 * nexus-ship-defaults.js — Cold-start visual polish when no explicit ?seed= is in the URL.
 * Runs once from inline bootstrap after applySessionSceneStart().
 */
(function () {
  if (!window.NX || !NX.S) return;

  var KEYWORDS = ['hyperspace', 'laser', 'nebula', 'vortex', 'plasma', 'galaxy', 'tunnel', 'chrome'];

  function showcaseSceneIndex() {
    var scenes = NX.scenes;
    if (!scenes || !scenes.length) return -1;
    for (var k = 0; k < KEYWORDS.length; k++) {
      var key = KEYWORDS[k];
      for (var i = 0; i < scenes.length; i++) {
        var n = String(scenes[i] && scenes[i].n ? scenes[i].n : '').toLowerCase();
        if (n.indexOf(key) >= 0) return i;
      }
    }
    return -1;
  }

  function applyColdStartVisuals() {
    if (NX.BootstrapQuery && NX.BootstrapQuery.hasExplicitSeedInUrl()) return;
    var scenes = NX.scenes;
    if (!scenes || !scenes.length) return;
    var ix = showcaseSceneIndex();
    if (ix < 0) return;
    var S = NX.S;
    var len = scenes.length;
    S.curS = ix;
    S.nxtS = (ix + 1) % len;
    S.nexusPostBloom = true;
    if (typeof S.nexusPostTrails !== 'number' || S.nexusPostTrails < 0.2) S.nexusPostTrails = 0.22;
    else if (S.nexusPostTrails < 0.35) S.nexusPostTrails = Math.min(0.42, S.nexusPostTrails + 0.08);
    if (typeof S.bcSpeed === 'number' && S.bcSpeed < 0.72) S.bcSpeed = 0.72;
    if (typeof S.bcConductorMotion === 'number' && S.bcConductorMotion < 0.95) S.bcConductorMotion = 0.95;
    if (NX.showName) NX.showName(ix);
  }

  NX.ShipDefaults = { applyColdStartVisuals: applyColdStartVisuals };
})();
