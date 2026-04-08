'use strict';
/**
 * NexusEngine — init / update / render orchestration (facade over NX modules).
 */
(function () {
  var S = NX.S;

  function init() {
    if (NX.PresetLibrary) NX.PresetLibrary.loadFromGlobal();
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
      NX.VisualEngineManager.setIntensity(0.55 + (snap.energy || 0) * 0.65);
    }
  }

  function renderButterchurnLayer() {
    if (!NX.SceneManager || !NX.SceneManager.shouldRenderButterchurn()) return;
    if (!NX.VisualEngineManager.ensureAudioForBC()) return;
    if (!NX.VisualEngineManager.isReady()) {
      if (S.visualMode === 'butterchurn' || S.visualMode === 'hybrid') NX.VisualEngineManager.initVisualizer();
    }
    NX.VisualEngineManager.resize();
    NX.VisualEngineManager.render();
  }

  window.NexusEngine = {
    init: init,
    update: update,
    renderButterchurnLayer: renderButterchurnLayer,
    version: '1.0.0'
  };

  NX.NexusEngine = window.NexusEngine;
})();
