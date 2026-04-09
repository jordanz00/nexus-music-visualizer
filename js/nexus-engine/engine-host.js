'use strict';
/**
 * NexusEngine Pro — init / update / render orchestration (facade over NX modules).
 */
(function () {
  var S = NX.S;
  var _bcPrimeInFlight = null;

  function init() {
    if (NX.PresetLibrary) NX.PresetLibrary.loadFromGlobal();
    if (NX.BcMorphConductor && NX.BcMorphConductor.rebuildPool) NX.BcMorphConductor.rebuildPool();
    if (NX.SceneManager) {
      NX.SceneManager.setMode(S.visualMode || 'shader', { crossfade: false, force: true });
      NX.SceneManager.syncDOM();
    }
  }

  function update(dt) {
    if (NX.SceneManager) {
      NX.SceneManager.tickFade(dt);
      NX.SceneManager.tickQueue();
    }
    var snap = NX.AudioEngine ? NX.AudioEngine.getSnapshot() : {};
    if ((S.visualMode === 'butterchurn' || S.visualMode === 'hybrid') && NX.VisualEngineManager && NX.VisualEngineManager.isReady()) {
      var vd = typeof S._visualDrive === 'number' ? S._visualDrive : 0;
      if (vd < 0) vd = 0;
      if (vd > 1) vd = 1;
      var d = snap.bcDrive != null ? snap.bcDrive : 0;
      var bv = snap.beatVisual || 0;
      var g = snap.bcGate != null ? snap.bcGate : 0;
      var eMix = (d * 0.68 + bv * 0.22 * (0.35 + 0.65 * g)) * vd;
      NX.VisualEngineManager.setIntensity(0.2 + Math.min(0.88, eMix) * 0.52);
    }
    if (NX.BcMorphConductor && NX.BcMorphConductor.tick) NX.BcMorphConductor.tick(dt);
  }

  function renderButterchurnLayer() {
    if (!NX.SceneManager || !NX.SceneManager.shouldRenderButterchurn()) return;
    if (!NX.VisualEngineManager.ensureAudioForBC()) {
      if (!_bcPrimeInFlight && NX.audio && NX.audio.primeForButterchurn) {
        _bcPrimeInFlight = NX.audio.primeForButterchurn()
          .then(function () {
            if (NX.VisualEngineManager.ensureAudioForBC()) {
              NX.VisualEngineManager.initVisualizer();
              NX.VisualEngineManager.connectAudio();
            }
          })
          .finally(function () { _bcPrimeInFlight = null; });
      }
      return;
    }
    if (!NX.VisualEngineManager.isReady()) {
      if (S.visualMode === 'butterchurn' || S.visualMode === 'hybrid') {
        NX.VisualEngineManager.initVisualizer();
        NX.VisualEngineManager.connectAudio();
      }
    }
    NX.VisualEngineManager.resize();
    NX.VisualEngineManager.render();
  }

  window.NexusEngine = {
    init: init,
    update: update,
    renderButterchurnLayer: renderButterchurnLayer,
    version: '3.2.2-pro'
  };

  NX.NexusEngine = window.NexusEngine;
})();
