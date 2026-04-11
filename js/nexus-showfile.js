'use strict';
/**
 * nexus-showfile.js — Export / import show snapshot JSON (v1).
 */
(function () {
  if (!window.NX || !NX.S) return;

  function collect() {
    var S = NX.S;
    var out = {
      nxShowfile: 1,
      version: (window.NexusRelease && NexusRelease.version) || '1.1.0',
      exportedAt: new Date().toISOString(),
      sessionSeed: (S.sessionSeed >>> 0) || 0,
      visualMode: String(S.visualMode || 'hybrid'),
      showClockMode: 'internal',
      postChain: S.postChain ? JSON.parse(JSON.stringify(S.postChain)) : {},
      curS: typeof S.curS === 'number' ? S.curS : 0,
      presetLabel: ''
    };
    try {
      var sm = document.getElementById('nx-show-mode');
      if (sm) out.showClockMode = String(sm.value || 'internal');
    } catch (e0) { /* ignore */ }
    try {
      var ps = document.getElementById('preset-sel');
      if (ps && ps.options && ps.selectedIndex >= 0) {
        out.presetLabel = String(ps.options[ps.selectedIndex].textContent || '');
      }
    } catch (e1) { /* ignore */ }
    return out;
  }

  function downloadJson(obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'NEXUS_showfile_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportShowfile() {
    downloadJson(collect());
  }

  function applyParsed(data) {
    if (!data || data.nxShowfile !== 1) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS showfile: invalid root');
      return false;
    }
    var S = NX.S;
    var scenes = NX.scenes;
    if (typeof data.sessionSeed === 'number' && NX.SessionSeed && NX.SessionSeed.setSeed) {
      NX.SessionSeed.setSeed(data.sessionSeed >>> 0);
    }
    if (data.visualMode && NX.SceneManager && NX.SceneManager.setMode) {
      var vm = String(data.visualMode);
      if (vm === 'shader' || vm === 'butterchurn' || vm === 'hybrid') {
        S.visualMode = vm;
        NX.SceneManager.setMode(vm, { crossfade: false, force: true });
        NX.SceneManager.syncDOM();
      }
    }
    if (data.postChain && typeof data.postChain === 'object') {
      var keys = ['bloom', 'streak', 'grade', 'trails', 'kaleido', 'glitch'];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (typeof data.postChain[k] === 'boolean') S.postChain[k] = data.postChain[k];
      }
    }
    if (typeof data.curS === 'number' && scenes.length) {
      var ci = Math.max(0, Math.min((data.curS | 0), scenes.length - 1));
      S.curS = ci;
      S.nxtS = (ci + 1) % scenes.length;
      S.morphing = false;
      S.morphBlend = 0;
      if (NX.showName) NX.showName(ci);
      if (NX.ui && NX.ui.setActiveScene) NX.ui.setActiveScene(ci);
    }
    try {
      var sm = document.getElementById('nx-show-mode');
      if (sm && data.showClockMode) sm.value = String(data.showClockMode);
    } catch (e2) { /* ignore */ }
    if (NX.ui && NX.ui.syncControls) NX.ui.syncControls();
    return true;
  }

  function importFromFile(file, done) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(String(r.result || '{}'));
        applyParsed(data);
        if (done) done(true);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS showfile import', e);
        if (done) done(false);
      }
    };
    r.onerror = function () { if (done) done(false); };
    r.readAsText(file, 'utf-8');
  }

  function wire() {
    var ex = document.getElementById('nx-showfile-export');
    var im = document.getElementById('nx-showfile-import');
    var fi = document.getElementById('nx-showfile-file');
    if (ex) ex.addEventListener('click', exportShowfile);
    if (im && fi) {
      im.addEventListener('click', function () { fi.click(); });
      fi.addEventListener('change', function () {
        var f = fi.files && fi.files[0];
        fi.value = '';
        if (!f) return;
        importFromFile(f, null);
      });
    }
  }

  NX.Showfile = { exportShowfile: exportShowfile, applyParsed: applyParsed, importFromFile: importFromFile, wire: wire };
})();
