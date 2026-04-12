'use strict';
/**
 * nexus-showfile.js — Export / import show snapshot JSON (v1).
 * Optional fxBatch2: god rays mix, trails, GPU particles, BPM phrase (hash export may omit if over size cap).
 */
(function () {
  if (!window.NX || !NX.S) return;

  /** @param {{ forHash?: boolean }} [opts] */
  function collect(opts) {
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
    out.fxBatch2 = {
      godRayMix: typeof S.nexusGodRayMix === 'number' ? S.nexusGodRayMix : 0.32,
      postTrails: typeof S.nexusPostTrails === 'number' ? S.nexusPostTrails : 0,
      gpuParticles: !!S.nexusGpuParticlesEnabled,
      bpmTimeline: !!S.nexusBpmTimelineEnabled,
      bpmPhraseBeats: Math.max(1, Math.min(128, (S.nexusBpmPhraseBeats | 0) || 16)),
      bpmTimelineMode: (S.nexusBpmTimelineMode === 'pulse' || S.nexusBpmTimelineMode === 'clock')
        ? S.nexusBpmTimelineMode
        : 'clock'
    };
    try {
      var sm = document.getElementById('nx-show-mode');
      if (sm) out.showClockMode = String(sm.value || 'internal');
    } catch (e0) { /* ignore */ }
    if (!opts || !opts.forHash) {
      try {
        var ps = document.getElementById('preset-sel');
        if (ps && ps.options && ps.selectedIndex >= 0) {
          out.presetLabel = String(ps.options[ps.selectedIndex].textContent || '');
        }
      } catch (e1) { /* ignore */ }
    } else {
      out.presetLabel = '';
    }
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
    try {
      var raw = JSON.stringify(data);
      if (raw.length > 240000) {
        if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS showfile: payload too large');
        return false;
      }
    } catch (eSz) { return false; }
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
      var keys = ['bloom', 'streak', 'grade', 'trails', 'kaleido', 'glitch', 'godray'];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (typeof data.postChain[k] === 'boolean') S.postChain[k] = data.postChain[k];
      }
    }
    if (data.fxBatch2 && typeof data.fxBatch2 === 'object') {
      var f2 = data.fxBatch2;
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
    if (NX.FxChain && typeof NX.FxChain.syncCheckboxes === 'function') {
      try { NX.FxChain.syncCheckboxes(); } catch (eFx) { /* ignore */ }
    }
    if (NX.FxChain && typeof NX.FxChain.updateGpuParticlesStatus === 'function') {
      try { NX.FxChain.updateGpuParticlesStatus(); } catch (eGpuU) { /* ignore */ }
    }
    try { window.NX._nxShowfileFromHash = true; } catch (eFl) { /* ignore */ }
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

  var MAX_NX_HASH = 10000;

  function b64UrlEncode(str) {
    var bin = unescape(encodeURIComponent(str));
    var b64 = typeof btoa !== 'undefined' ? btoa(bin) : '';
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64UrlDecode(b64) {
    var s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }

  function getShareUrlFromState() {
    var payload = collect();
    var json = JSON.stringify(payload);
    if (json.length > MAX_NX_HASH) {
      payload = collect({ forHash: true });
      json = JSON.stringify(payload);
    }
    if (json.length > MAX_NX_HASH) {
      try {
        var slim = JSON.parse(JSON.stringify(payload));
        delete slim.fxBatch2;
        delete slim.presetLabel;
        json = JSON.stringify(slim);
      } catch (eSlim) {
        json = '';
      }
    }
    if (json.length > MAX_NX_HASH) return '';
    try {
      var u = new URL(location.href);
      u.hash = 'nx=' + b64UrlEncode(json);
      return u.toString();
    } catch (e0) {
      return '';
    }
  }

  function consumeHashIfPresent() {
    try {
      var h = location.hash || '';
      if (!h || h.indexOf('nx=') < 0) return false;
      var enc = '';
      var inner = h.charAt(0) === '#' ? h.slice(1) : h;
      var parts = inner.split('&');
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].indexOf('nx=') === 0) enc = parts[i].slice(3);
      }
      if (!enc) return false;
      enc = enc.split('&')[0];
      var json = b64UrlDecode(enc);
      if (!json || json.length > MAX_NX_HASH) return false;
      var data = JSON.parse(json);
      if (!applyParsed(data)) return false;
      var u = new URL(location.href);
      u.hash = '';
      if (history.replaceState) history.replaceState(null, '', u.pathname + u.search);
      return true;
    } catch (eH) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS share hash', eH);
      return false;
    }
  }

  function copyShareLink() {
    var url = getShareUrlFromState();
    if (!url) {
      if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS: showfile too large for URL hash');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(function () {
        try { window.prompt('Copy link:', url); } catch (e1) { /* ignore */ }
      });
    } else {
      try { window.prompt('Copy link:', url); } catch (e2) { /* ignore */ }
    }
  }

  function wire() {
    var ex = document.getElementById('nx-showfile-export');
    var im = document.getElementById('nx-showfile-import');
    var fi = document.getElementById('nx-showfile-file');
    var sh = document.getElementById('nx-showfile-share');
    if (ex) ex.addEventListener('click', exportShowfile);
    if (sh) sh.addEventListener('click', copyShareLink);
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

  NX.Showfile = {
    exportShowfile: exportShowfile,
    applyParsed: applyParsed,
    importFromFile: importFromFile,
    collect: collect,
    getShareUrlFromState: getShareUrlFromState,
    consumeHashIfPresent: consumeHashIfPresent,
    copyShareLink: copyShareLink,
    wire: wire
  };
})();
