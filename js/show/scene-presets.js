'use strict';
/**
 * Named show bundles: scene index, postChain, visual mode, optional WGSL chain (localStorage).
 */
(function () {
  var STORAGE = 'nexus.show.scenePresets.v1';

  function readAll() {
    try {
      var j = localStorage.getItem(STORAGE);
      var o = j ? JSON.parse(j) : {};
      return o && typeof o === 'object' ? o : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(o) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(o));
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
      wgpuChain: NX.WgslGraph && NX.WgslGraph.getChain ? NX.WgslGraph.getChain() : null
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
