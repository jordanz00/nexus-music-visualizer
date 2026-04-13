'use strict';
/**
 * Named show bundles: scene index, postChain, visual mode, WGSL chain, I/O batch (god ray, trails, …),
 * post Asura strength — localStorage.
 */
(function () {
  var STORAGE = 'nexus.show.scenePresets.v1';

  function readAll() {
    try {
      var j = NX.Persist.getItem(STORAGE);
      var o = j ? JSON.parse(j) : {};
      return o && typeof o === 'object' ? o : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(o) {
    try {
      NX.Persist.setItem(STORAGE, JSON.stringify(o));
    } catch (e2) { /* quota */ }
  }

  /**
   * @param {string} name
   * @param {{sceneIndex?:number,postChain?:object,visualMode?:string,wgpuChain?:object[]}} bundle
   */
  function save(name) {
    name = (name || '').trim();
    if (!name) return false;
    var S = window.NX && NX.S;
    var bundle = {
      sceneIndex: S ? S.curS : 0,
      postChain: S && S.postChain ? JSON.parse(JSON.stringify(S.postChain)) : null,
      visualMode: S ? (S.visualMode || 'hybrid') : 'hybrid',
      wgpuChain: NX.WgslGraph && NX.WgslGraph.getChain ? NX.WgslGraph.getChain() : null,
      fxBatch2: S ? {
        godRayMix: typeof S.nexusGodRayMix === 'number' ? S.nexusGodRayMix : 0.32,
        postTrails: typeof S.nexusPostTrails === 'number' ? S.nexusPostTrails : 0,
        postFxAsura: typeof S.postFxAsura === 'number' ? S.postFxAsura : 0,
        gpuParticles: !!S.nexusGpuParticlesEnabled,
        bpmTimeline: !!S.nexusBpmTimelineEnabled,
        bpmPhraseBeats: Math.max(1, Math.min(128, (S.nexusBpmPhraseBeats | 0) || 16)),
        bpmTimelineMode: (S.nexusBpmTimelineMode === 'pulse' || S.nexusBpmTimelineMode === 'clock')
          ? S.nexusBpmTimelineMode
          : 'clock'
      } : null
    };
    var all = readAll();
    all[name] = bundle;
    writeAll(all);
    return true;
  }

  function listNames() {
    return Object.keys(readAll()).sort();
  }

  function apply(name) {
    var all = readAll();
    var b = all[name];
    if (!b) return false;
    var S = window.NX && NX.S;
    if (S && b.postChain && typeof b.postChain === 'object') {
      S.postChain.bloom = b.postChain.bloom !== false;
      S.postChain.streak = b.postChain.streak !== false;
      S.postChain.grade = b.postChain.grade !== false;
      S.postChain.trails = b.postChain.trails !== false;
      if (typeof b.postChain.kaleido === 'boolean') S.postChain.kaleido = b.postChain.kaleido;
      if (typeof b.postChain.glitch === 'boolean') S.postChain.glitch = b.postChain.glitch;
      if (typeof b.postChain.godray === 'boolean') S.postChain.godray = b.postChain.godray;
    }
    if (S && b.fxBatch2 && typeof b.fxBatch2 === 'object') {
      var f2 = b.fxBatch2;
      if (typeof f2.godRayMix === 'number' && !isNaN(f2.godRayMix)) {
        S.nexusGodRayMix = Math.max(0, Math.min(1, f2.godRayMix));
      }
      if (typeof f2.postTrails === 'number' && !isNaN(f2.postTrails)) {
        S.nexusPostTrails = Math.max(0, Math.min(1, f2.postTrails));
      }
      if (typeof f2.gpuParticles === 'boolean') S.nexusGpuParticlesEnabled = f2.gpuParticles;
      if (typeof f2.bpmTimeline === 'boolean') S.nexusBpmTimelineEnabled = f2.bpmTimeline;
      if (typeof f2.bpmPhraseBeats === 'number' && !isNaN(f2.bpmPhraseBeats)) {
        S.nexusBpmPhraseBeats = Math.max(1, Math.min(128, f2.bpmPhraseBeats | 0));
      }
      if (f2.bpmTimelineMode === 'pulse' || f2.bpmTimelineMode === 'clock') {
        S.nexusBpmTimelineMode = f2.bpmTimelineMode;
      }
      if (typeof f2.postFxAsura === 'number' && !isNaN(f2.postFxAsura)) {
        S.postFxAsura = Math.max(0, Math.min(1, f2.postFxAsura));
      }
    }
    if (S && ((b.postChain && typeof b.postChain === 'object') || (b.fxBatch2 && typeof b.fxBatch2 === 'object'))) {
      if (NX.FxChain && NX.FxChain.syncCheckboxes) NX.FxChain.syncCheckboxes();
      if (NX.FxChain && NX.FxChain.applyFromUI) NX.FxChain.applyFromUI();
    }
    if (b.visualMode && NX.SceneManager && NX.SceneManager.setMode) {
      NX.SceneManager.setMode(b.visualMode, { crossfade: false, force: true });
      if (NX.SceneManager.syncDOM) NX.SceneManager.syncDOM();
    }
    if (b.wgpuChain && NX.WgslGraph && NX.WgslGraph.setChain) {
      NX.WgslGraph.setChain(b.wgpuChain);
    }
    if (typeof b.sceneIndex === 'number' && NX.goNext) {
      NX.goNext(b.sceneIndex | 0);
    }
    if (NX.ui && NX.ui.syncControls) {
      try {
        NX.ui.syncControls();
      } catch (eSync) { /* ignore */ }
    }
    return true;
  }

  function remove(name) {
    var all = readAll();
    delete all[name];
    writeAll(all);
  }

  window.NX = window.NX || {};
  NX.ScenePresets = {
    save: save,
    listNames: listNames,
    apply: apply,
    remove: remove
  };
})();
