'use strict';
/*  ui.js — Resolume-style scene pads, control sliders, audio meters,
    preset selector, MIDI status, present mode, recording — all wired
    to the NX namespace for live visual engine control.                 */

(function () {
  var S = NX.S, P = NX.P;

  function sceneMatchesFilter(sc, q) {
    if (!q) return true;
    q = String(q).toLowerCase().trim();
    if (!q) return true;
    return (sc.n && String(sc.n).toLowerCase().indexOf(q) >= 0);
  }

  /* ---- Build scene pad grid ---------------------------------------- */
  function buildPads() {
    var grid = document.getElementById('scene-grid');
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    var compactEl = document.getElementById('pad-compact');
    var compact = compactEl && compactEl.checked;
    var searchEl = document.getElementById('scene-grid-search');
    var q = searchEl ? searchEl.value : '';
    var listModeEl = document.getElementById('scene-list-mode');
    var listMode = listModeEl && listModeEl.value === 'list';
    grid.classList.toggle('grid-4x4', compact && !listMode);
    grid.classList.toggle('scene-grid-list', listMode);
    NX.scenes.forEach(function (sc, i) {
      if (!sceneMatchesFilter(sc, q)) return;
      var pad = document.createElement('div');
      pad.className = 'scene-pad' + (i === S.curS ? ' active' : '');
      if (compact && !listMode && i >= 16) pad.classList.add('pad-hidden');
      pad.style.setProperty('--pad-color', sc.c || 'var(--accent-color,#00ffd5)');
      pad.dataset.idx = i;
      var idx = document.createElement('span');
      idx.className = 'sp-idx'; idx.textContent = i + 1;
      var name = document.createElement('span');
      name.className = 'sp-name'; name.textContent = sc.n;
      pad.appendChild(idx); pad.appendChild(name);
      pad.addEventListener('click', function () {
        var target = i;
        /* Defer to next frame on iOS — avoids GL work during the same tick as WebKit hit-testing / compositor. */
        if (S._iosCoarsePointer) {
          requestAnimationFrame(function () {
            try { NX.goNext(target); } catch (ePad) { if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS: scene pad', ePad); }
          });
        } else {
          try { NX.goNext(target); } catch (ePad2) { if (typeof console !== 'undefined' && console.warn) console.warn('NEXUS: scene pad', ePad2); }
        }
      });
      grid.appendChild(pad);
    });
  }

  function setAppBanner(msg, kind) {
    var el = document.getElementById('nx-app-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('nx-banner-warn', 'nx-banner-err');
    if (kind === 'warn') el.classList.add('nx-banner-warn');
    if (kind === 'err') el.classList.add('nx-banner-err');
  }

  function exportDebugBundle() {
    var bundle = {
      t: new Date().toISOString(),
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      scenes: NX.scenes ? NX.scenes.length : 0,
      sessionSeed: NX.SessionSeed && NX.SessionSeed.getSeed ? NX.SessionSeed.getSeed() : null,
      webgpu: !!(typeof navigator !== 'undefined' && navigator.gpu),
      wgslReady: NX.WgslGraph && NX.WgslGraph.isReady ? NX.WgslGraph.isReady() : false,
      visualMode: S.visualMode,
      curScene: S.curS,
      bcConductorMotion: S.bcConductorMotion,
      soak: !!window.__NX_SOAK__,
      midiKeys: NX.midi && NX.midi.getMappingList ? NX.midi.getMappingList().length : 0
    };
    var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'NEXUS_debug_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof console !== 'undefined' && console.info) console.info('[NEXUS] debug_bundle_exported', bundle);
  }

  function refreshSeedHud() {
    var el = document.getElementById('nx-seed-display');
    if (!el || !NX.SessionSeed || !NX.SessionSeed.getSeed) return;
    el.textContent = String(NX.SessionSeed.getSeed() >>> 0);
  }

  function setActiveScene(idx) {
    var pads = document.querySelectorAll('.scene-pad');
    pads.forEach(function (p) { p.classList.remove('active'); });
    if (pads[idx]) pads[idx].classList.add('active');
    var vpn = document.getElementById('scene-name');
    if (vpn && NX.scenes[idx]) vpn.textContent = NX.scenes[idx].n;
  }

  /* ---- Pulse pads on beat ------------------------------------------ */
  var _lastBeatPulse = 0;
  function pulsePads() {
    if (S.beat < 0.7 || performance.now() - _lastBeatPulse < 180) return;
    _lastBeatPulse = performance.now();
    var active = document.querySelector('.scene-pad.active');
    if (active) { active.classList.remove('beat-pulse'); void active.offsetWidth; active.classList.add('beat-pulse'); }
  }

  /* ---- Build preset dropdown --------------------------------------- */
  function buildPresets() {
    var sel = document.getElementById('preset-sel');
    if (!sel || !NX.presets) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var def = document.createElement('option');
    def.value = ''; def.textContent = '— Preset —'; sel.appendChild(def);
    NX.presets.list().forEach(function (name) {
      var o = document.createElement('option');
      o.value = name; o.textContent = name; sel.appendChild(o);
    });
  }

  function buildShowcaseSelect() {
    var sel = document.getElementById('bc-showcase-sel');
    if (!sel || !NX.PresetLibrary) return;
    while (sel.childNodes.length > 1) sel.removeChild(sel.lastChild);
    var list = NX.PresetLibrary.getShowcase();
    list.forEach(function (item, i) {
      var o = document.createElement('option');
      o.value = item.key;
      o.textContent = (i + 1) + '. ' + item.label;
      sel.appendChild(o);
    });
  }

  var _proList = [];
  function buildProSelect() {
    var sel = document.getElementById('bc-pro-sel');
    if (!sel || !NX.PresetLibrary || !window.NXProPresets) return;
    while (sel.childNodes.length > 1) sel.removeChild(sel.lastChild);
    var full = NXProPresets.build(NX.PresetLibrary.getShowcase());
    var gf = document.getElementById('pro-genre-filter');
    var g = gf ? gf.value : 'all';
    _proList = NXProPresets.filterByGenre(full, g);
    _proList.forEach(function (item, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = (i + 1) + '. [' + item.genre + '] ' + item.label;
      sel.appendChild(o);
    });
  }

  function buildButterchurnPresets() {
    var sel = document.getElementById('bc-preset-sel');
    if (!sel || !NX.PresetLibrary) return;
    while (sel.childNodes.length > 1) sel.removeChild(sel.lastChild);
    var n = NX.PresetLibrary.getKeys().length;
    if (!n) {
      var nb = window.NexusBrand && window.NexusBrand.spectrumProductName ? window.NexusBrand.spectrumProductName : 'Aurora Field';
      console.warn('No ' + nb + ' presets loaded — add vendor butterchurn preset bundles (see README).');
      return;
    }
    ['ambient', 'heavy', 'psychedelic', 'glitch', 'other'].forEach(function (cat) {
      var ks = NX.PresetLibrary.byCategory[cat];
      if (!ks || !ks.length) return;
      var og = document.createElement('optgroup');
      og.label = cat;
      ks.forEach(function (name) {
        var o = document.createElement('option');
        o.value = name;
        o.textContent = name.length > 44 ? name.slice(0, 42) + '…' : name;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
  }

  /* ---- Sync slider values from P to DOM ---------------------------- */
  function syncControls() {
    var trimV = typeof P.TRIM === 'number' ? P.TRIM : 100;
    var map = { rspd: P.SPD, rrct: P.RCT, rwrp: P.WRP, rgain: P.GAIN * 100, rsmth: P.SMTH, rtrim: trimV };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.value = map[id]; var v = el.closest('.ctrl-slider'); if (v) { var vd = v.querySelector('.val'); if (vd) vd.textContent = Math.round(map[id]); } }
    });
    var rp = document.getElementById('nx-react-profile');
    if (rp && (S.reactivityProfile === 'punchy' || S.reactivityProfile === 'balanced' || S.reactivityProfile === 'smooth')) {
      rp.value = S.reactivityProfile;
    }
    document.querySelectorAll('.nx-react-pill').forEach(function (b) {
      b.classList.toggle('nx-react-pill-on', b.getAttribute('data-profile') === S.reactivityProfile);
    });
    var rmorph = document.getElementById('rmorph');
    if (rmorph) rmorph.value = Math.round(S.morphDurationSec * 10);
    var rh = document.getElementById('r-hue');
    if (rh) {
      rh.value = String(Math.round((S.hueShift || 0) * 200));
      var row = rh.closest('.ctrl-slider');
      if (row) { var vd = row.querySelector('.val'); if (vd) vd.textContent = rh.value; }
    }
    setPalette(P.PAL);
    var nxBloom = document.getElementById('nx-bloom');
    if (nxBloom) nxBloom.checked = !!S.nexusPostBloom;
    var nxTr = document.getElementById('nx-trails');
    if (nxTr) nxTr.value = String(Math.round((S.nexusPostTrails == null ? 0 : S.nexusPostTrails) * 100));
    var nxMode = document.getElementById('nx-visual-mode');
    if (nxMode) nxMode.value = S.visualMode || 'hybrid';
    var nk = document.getElementById('nx-kaleido');
    if (nk) nk.value = String(Math.round((S.postFxKaleido == null ? 0 : S.postFxKaleido) * 100));
    var ng = document.getElementById('nx-glitch');
    if (ng) ng.value = String(Math.round((S.postFxGlitch == null ? 0 : S.postFxGlitch) * 100));
    var na = document.getElementById('nx-asura');
    if (na) na.value = String(Math.round((S.postFxAsura == null ? 0 : S.postFxAsura) * 100));
    var nsm = document.getElementById('nx-show-macro');
    if (nsm) {
      var vm = S.visualMacro || '';
      nsm.value = vm === 'club' ? 'club' : (vm === 'ambient' ? 'ambient_show' : (vm === 'psychedelic' ? 'psychedelic' : (vm === 'asura_mfx' ? 'asura_mfx' : '')));
    }
    var vpb = document.getElementById('vizperfbtn');
    if (vpb) vpb.classList.toggle('on', !!S.nexusVizPerformance);
    var nxCond = document.getElementById('nx-conductor-motion');
    if (nxCond) {
      var cm = typeof S.bcConductorMotion === 'number' ? S.bcConductorMotion : 1;
      cm = Math.max(0.65, Math.min(1.35, cm));
      nxCond.value = String(Math.round(cm * 100));
    }
    var hBc = document.getElementById('nx-hybrid-bc-opacity');
    if (hBc) hBc.value = String(Math.round((typeof S.hybridBcOpacity === 'number' ? S.hybridBcOpacity : 1) * 100));
    var hSh = document.getElementById('nx-hybrid-shader-opacity');
    if (hSh) hSh.value = String(Math.round((typeof S.hybridShaderOpacity === 'number' ? S.hybridShaderOpacity : 1) * 100));
    var mixPart = document.getElementById('nx-mix-particles');
    if (mixPart) mixPart.checked = S.nexusMixParticlesEnabled !== false;
    var mixProc = document.getElementById('nx-mix-proc-ambient');
    if (mixProc) mixProc.checked = S.nexusProcParticlesEnabled === true;
  }

  function setPalette(idx) {
    P.PAL = idx;
    document.querySelectorAll('.pal-sw').forEach(function (s) { s.classList.toggle('on', +s.dataset.p === idx); });
  }

  /* ---- HUD tick (called from engine loop) -------------------------- */
  function tickHud(st) {
    if (++st.hudTick % 6 !== 0) return;

    var bp = Math.round(st.sBass * 100), lmp = Math.round((st.sLowMid || 0) * 100), mp = Math.round(st.sMid * 100), hp = Math.round(st.sHigh * 100);
    var fb = Math.round(st.sFlux * 100), vb = Math.round(st.sVol * 100);
    setMeter('m-bass', bp); setMeter('m-lowmid', lmp); setMeter('m-mid', mp); setMeter('m-high', hp);
    setMeter('m-flux', fb); setMeter('m-vol', vb);

    var bpmEl = document.getElementById('bpm-val');
    if (bpmEl) bpmEl.textContent = st.bpm || '--';

    var tcEl = document.getElementById('show-timecode');
    if (tcEl && NX.ShowClock && NX.ShowClock.getDisplayString) tcEl.textContent = NX.ShowClock.getDisplayString();

    var bpmHint = document.getElementById('nx-cue-bpm-hint');
    if (bpmHint && st.hudTick % 54 === 0 && NX.CueEngine && NX.CueEngine.getBpmConfidenceHint) {
      var bh = NX.CueEngine.getBpmConfidenceHint();
      bpmHint.textContent = 'BPM confidence ' + Math.round(bh.bpmConfidence * 100) + '% — ' +
        (bh.suggestQuantize ? 'Beat-divided cues should align.' : bh.note);
    }

    var bcHud = document.getElementById('bc-preset-hud');
    if (bcHud) {
      var vm = st.visualMode || 'hybrid';
      if ((vm === 'butterchurn' || vm === 'hybrid') && st.bcLastPresetKey) {
        var nm = st.bcLastPresetKey;
        bcHud.textContent = nm.length > 36 ? nm.slice(0, 34) + '…' : nm;
        bcHud.style.display = '';
      } else {
        bcHud.textContent = '';
        bcHud.style.display = 'none';
      }
    }

    var gdisp = document.getElementById('nx-genome-disp');
    if (gdisp && st.visualGenomeHex) gdisp.textContent = String(st.visualGenomeHex).slice(0, 20) + '…';
    var mdisp = document.getElementById('nx-structure-mood-disp');
    if (mdisp && NX.StructureMood && typeof NX.StructureMood.getState === 'function') {
      mdisp.textContent = NX.StructureMood.getState();
    }

    if (st.autoMorph) {
      var tgt = NX.getAutoMorphIntervalSec ? NX.getAutoMorphIntervalSec() : st.presInterval;
      var rem = Math.max(0, Math.round(tgt - st.presTimer));
      var nxt = document.getElementById('auto-timer');
      if (nxt && st.hudTick % 30 < 6) nxt.textContent = rem + 's';
    }

    if (st.showFpsOverlay && st.hudTick % 8 < 6) {
      var fe = document.getElementById('fps-badge');
      if (fe) fe.textContent = 'FPS ' + Math.round(st._emaFps) + ' · ' + Math.round(NX.getRenderScale() * 100) + '% · ' + st.FW + '×' + st.FH;
    }

    var pk = document.getElementById('live-peak-fill');
    if (pk) {
      var pkv = Math.min(100, Math.round(100 * Math.max(st.sBass || 0, st.sMid || 0, st.sHigh || 0, st.sVol || 0, (st.sTransient || 0) * 0.85)));
      pk.style.width = pkv + '%';
    }

    pulsePads();
  }

  function syncLiveMicUI() {
    var on = !!S.micOn;
    var big = document.getElementById('live-mic-big');
    if (big) {
      big.textContent = on ? 'Microphone on' : 'Microphone off — tap to enable';
      big.classList.toggle('live-mic-on', on);
    }
    var st = document.getElementById('live-mic-status');
    if (st) {
      st.textContent = on ? 'Listening — sing, clap, or play music near the mic.' : 'Mic off — tap the button above or MIC in the top bar.';
    }
    var micTop = document.getElementById('micbtn');
    if (micTop) micTop.classList.toggle('on', on);
  }

  function setMeter(id, pct) {
    var el = document.getElementById(id);
    if (el) el.style.height = Math.min(100, pct) + '%';
  }

  /* ---- Show scene name overlay ------------------------------------- */
  var _nameTimer;
  function showName(idx) {
    var el = document.getElementById('scene-name');
    if (!el || !NX.scenes[idx]) return;
    el.textContent = NX.scenes[idx].n;
    el.style.opacity = '1';
    clearTimeout(_nameTimer);
    _nameTimer = setTimeout(function () { el.style.opacity = '0'; }, 2800);
    setActiveScene(idx);
  }

  /* ---- MIDI status display ----------------------------------------- */
  function setMidiStatus(status) {
    var el = document.getElementById('midi-status');
    if (!el) return;
    el.className = ''; el.textContent = 'MIDI: ' + status;
    if (status === 'connected' || status === 'mapped') el.classList.add('connected');
    else if (status.indexOf('learning') === 0) el.classList.add('learning');
  }
  function flashControl(name) { /* brief highlight on mapped control */ }

  /* ---- Recording --------------------------------------------------- */
  var mediaRec = null, recChunks = [];

  function createMediaRecorder(stream, br) {
    var types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      if (typeof MediaRecorder === 'undefined') break;
      if (MediaRecorder.isTypeSupported && !MediaRecorder.isTypeSupported(t)) continue;
      try {
        return new MediaRecorder(stream, { mimeType: t, videoBitsPerSecond: br });
      } catch (e) { /* try next codec */ }
    }
    return new MediaRecorder(stream, { videoBitsPerSecond: br });
  }

  function startRecording() {
    if (S.recording) return;
    try {
      var profEl = document.getElementById('rec-profile');
      var fpsEl = document.getElementById('rec-fps');
      var prof = profEl ? profEl.value : 'native';
      var fps = fpsEl ? Math.max(24, Math.min(60, parseInt(fpsEl.value, 10) || 60)) : 60;
      var fpsScale = Math.max(0.72, Math.min(1.15, fps / 60));
      var stream;
      var br = 10000000;
      if (prof === '1080') {
        S.recCompositeDims = { w: 1920, h: 1080, fps: fps };
        stream = document.getElementById('c-rec').captureStream(fps);
        br = Math.round(15000000 * fpsScale);
      } else if (prof === 'stream') {
        S.recCompositeDims = { w: 1920, h: 1080, fps: fps };
        stream = document.getElementById('c-rec').captureStream(fps);
        br = Math.round(24000000 * fpsScale);
      } else       if (prof === '4k') {
        S.recCompositeDims = { w: 3840, h: 2160, fps: fps };
        stream = document.getElementById('c-rec').captureStream(fps);
        br = Math.round(36000000 * fpsScale);
        S._recPrevPerfLock = !!S.nexusPerfLock;
        S._recHadPerfAssist = true;
        if (!S.nexusPerfLock) {
          S.nexusPerfLock = true;
          if (NX.resize) NX.resize();
          var nxPerf4k = document.getElementById('nx-perf');
          if (nxPerf4k) nxPerf4k.checked = true;
          var pb4k = document.getElementById('perfbtn');
          if (pb4k) pb4k.classList.add('on');
          document.body.classList.add('nexus-perf-top');
        }
      } else {
        S.recCompositeDims = null;
        stream = NX.C.captureStream(fps);
        br = Math.round(12500000 * fpsScale);
      }
      mediaRec = createMediaRecorder(stream, br);
      recChunks = [];
      mediaRec.ondataavailable = function (e) { if (e.data.size > 0) recChunks.push(e.data); };
      mediaRec.onstop = function () {
        S.recCompositeDims = null;
        if (S._recHadPerfAssist) {
          S.nexusPerfLock = S._recPrevPerfLock;
          S._recHadPerfAssist = false;
          if (NX.resize) NX.resize();
          var nxPerfEl = document.getElementById('nx-perf');
          if (nxPerfEl) nxPerfEl.checked = !!S.nexusPerfLock;
          var perfTop = document.getElementById('perfbtn');
          if (perfTop) perfTop.classList.toggle('on', !!S.nexusPerfLock);
          document.body.classList.toggle('nexus-perf-top', !!S.nexusPerfLock);
        }
        var blob = new Blob(recChunks, { type: 'video/webm' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'NEXUS_Pro_' + Date.now() + '.webm';
        a.click(); URL.revokeObjectURL(a.href);
        S.recording = false;
        S._recT0 = 0;
        document.body.classList.remove('nexus-recording');
        var b = document.getElementById('recbtn'); if (b) b.classList.remove('on');
      };
      /* ~500 ms chunks: steadier memory vs 1s blobs; aligns better with live frame cadence */
      mediaRec.start(500);
      S.recording = true;
      if (prof === '1080' || prof === 'stream' || prof === '4k') {
        S._recT0 = performance.now();
      } else {
        S._recT0 = 0;
      }
      document.body.classList.add('nexus-recording');
      var b = document.getElementById('recbtn'); if (b) b.classList.add('on');
    } catch (e) { console.warn('Recording failed:', e.message); S.recCompositeDims = null; document.body.classList.remove('nexus-recording'); }
  }
  function stopRecording() { if (mediaRec && S.recording) mediaRec.stop(); }
  function toggleRecording() { S.recording ? stopRecording() : startRecording(); }

  /* ---- Present mode ------------------------------------------------ */
  var _midiGridBuilt = false;

  function refreshMidiMapPanel() {
    var ul = document.getElementById('midi-map-list');
    if (!ul || !NX.midi || !NX.midi.getMappingList) return;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    NX.midi.getMappingList().forEach(function (row) {
      var li = document.createElement('li');
      var c = document.createElement('code');
      c.textContent = row.midiKey;
      li.appendChild(c);
      li.appendChild(document.createTextNode(' \u2192 ' + row.type + ' '));
      var st = document.createElement('strong');
      st.textContent = String(row.param);
      li.appendChild(st);
      ul.appendChild(li);
    });
  }

  function buildMidiLearnGrid() {
    var wrap = document.getElementById('midi-map-learn-btns');
    if (!wrap || !NX.midi) return;
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    NX.midi.getParamCatalog().forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.addEventListener('click', function () {
        wrap.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        NX.midi.startLearn(name);
        setMidiStatus('learning: ' + name);
      });
      wrap.appendChild(b);
    });
    var lab = document.createElement('div');
    lab.className = 'midi-scene-lab';
    lab.textContent = 'Pads → scene index';
    wrap.appendChild(lab);
    for (var i = 0; i < Math.min(16, NX.scenes.length); i++) {
      (function (idx) {
        var b2 = document.createElement('button');
        b2.type = 'button';
        b2.textContent = 'S' + (idx + 1);
        b2.addEventListener('click', function () {
          wrap.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
          b2.classList.add('active');
          NX.midi.startLearn(idx);
          setMidiStatus('learning: scene ' + (idx + 1));
        });
        wrap.appendChild(b2);
      })(i);
    }
  }

  /** Toggle bottom control panel visibility (touch FAB, inline button, or H). Keeps S.uiHide in sync. */
  function togglePanelVisibility() {
    S.uiHide = !S.uiHide;
    var p = document.getElementById('panel');
    if (p) p.classList.toggle('hide', S.uiHide);
    document.body.classList.toggle('nexus-panel-hidden', S.uiHide);
    updatePanelFab();
  }

  /** Sync floating panel FAB label and aria state (skipped while splash keeps FAB hidden). */
  function updatePanelFab() {
    var fab = document.getElementById('panel-fab');
    if (!fab || fab.hidden) return;
    var expanded = !S.uiHide;
    fab.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    var label = expanded ? 'Hide controls' : 'Show controls';
    fab.textContent = label;
    fab.setAttribute('aria-label', label);
  }

  function openMidiMapPanel() {
    var p = document.getElementById('midi-map-panel');
    if (!p) return;
    if (!_midiGridBuilt) { buildMidiLearnGrid(); _midiGridBuilt = true; }
    if (NX.midi && NX.midi.refreshProfileSelect) NX.midi.refreshProfileSelect();
    refreshMidiMapPanel();
    p.classList.add('open');
    p.setAttribute('aria-hidden', 'false');
  }

  function closeMidiMapPanel() {
    var p = document.getElementById('midi-map-panel');
    if (!p) return;
    p.classList.remove('open');
    p.setAttribute('aria-hidden', 'true');
  }

  function togglePresent() {
    S.presentMode = !S.presentMode;
    document.body.classList.toggle('nexus-present', S.presentMode);
    var b = document.getElementById('presentbtn');
    if (b) {
      b.textContent = S.presentMode ? 'Exit' : 'Present';
      b.classList.toggle('on', S.presentMode);
      b.setAttribute('aria-pressed', S.presentMode ? 'true' : 'false');
      b.setAttribute('aria-label', S.presentMode ? 'Exit present mode (keyboard P)' : 'Present mode: hide chrome (keyboard P)');
    }
    updatePanelFab();
  }

  /* ---- Wire events ------------------------------------------------- */
  function wireEvents() {
    /* Splash start — tap Launch or anywhere on splash (one gesture unlocks audio context). */
    var startBtn = document.getElementById('start-btn');
    var splashEl = document.getElementById('splash');
    var _splashLaunchDone = false;
    async function doLaunchFromSplash() {
      if (!window.__NX_BOOT_INTERACTIVE__) return;
      if (_splashLaunchDone) return;
      _splashLaunchDone = true;
      try { await NX.audio.startMic(); } catch (e) { }
      if (!S.audioCtx && NX.audio.ensureButterchurnAudioGraph) {
        try { await NX.audio.ensureButterchurnAudioGraph(); } catch (e2) { }
      } else if (NX.audio.resumeAudioContext) {
        try { await NX.audio.resumeAudioContext(); } catch (e3) { }
      }
      var sp = document.getElementById('splash');
      function revealApp() {
        if (sp) sp.classList.add('out');
        var p = document.getElementById('panel');
        if (p) p.classList.toggle('hide', !!S.uiHide);
        var fab = document.getElementById('panel-fab');
        if (fab) fab.hidden = false;
        if (window.NXShell && NXShell.setTab) NXShell.setTab('live');
        syncLiveMicUI();
        updatePanelFab();
        var autob = document.getElementById('autobtn');
        if (autob) autob.classList.toggle('on', S.autoMorph);
        var autoT = document.getElementById('auto-timer');
        if (autoT) autoT.textContent = S.autoMorph ? '-' : 'OFF';
      }
      if (NX.ModernVisualStack && NX.ModernVisualStack.wrapUiTransition) {
        NX.ModernVisualStack.wrapUiTransition(revealApp);
      } else {
        revealApp();
      }
      setTimeout(function () { if (sp) sp.style.display = 'none'; }, 900);
      setTimeout(function () {
        if (NX.Onboard && NX.Onboard.maybeOffer) NX.Onboard.maybeOffer();
      }, 1200);
    }
    if (startBtn) {
      startBtn.addEventListener('click', function (e) { e.stopPropagation(); doLaunchFromSplash(); });
    }
    if (splashEl) {
      splashEl.addEventListener('click', function () { doLaunchFromSplash(); });
    }

    /* Sliders */
    function wireSlider(id, fn) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function (e) {
        fn(e); var v = el.closest('.ctrl-slider');
        if (v) { var vd = v.querySelector('.val'); if (vd) vd.textContent = Math.round(+e.target.value); }
      });
    }
    wireSlider('rspd', function (e) { P.SPD = +e.target.value; });
    wireSlider('rrct', function (e) { P.RCT = +e.target.value; });
    wireSlider('rwrp', function (e) { P.WRP = +e.target.value; });
    wireSlider('rgain', function (e) { P.GAIN = e.target.value / 100; if (S.gainNode) S.gainNode.gain.value = P.GAIN; });
    wireSlider('rtrim', function (e) { P.TRIM = +e.target.value; });
    wireSlider('rsmth', function (e) { P.SMTH = +e.target.value; if (S.analyser) S.analyser.smoothingTimeConstant = P.SMTH / 100; });
    wireSlider('rmorph', function (e) { S.morphDurationSec = Math.max(0.55, Math.min(4.2, e.target.value * 0.1)); });
    wireSlider('r-hue', function (e) {
      S.hueShift = Math.max(-0.5, Math.min(0.5, parseInt(e.target.value, 10) / 200));
    });

    /* Palette */
    document.querySelectorAll('.pal-sw').forEach(function (sw) {
      sw.addEventListener('click', function () { setPalette(+this.dataset.p); });
    });

    /* Top bar buttons */
    var fullBtn = document.getElementById('fullbtn');
    if (fullBtn) fullBtn.addEventListener('click', function () {
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(function () { });
    });

    var presentBtn = document.getElementById('presentbtn');
    if (presentBtn) presentBtn.addEventListener('click', togglePresent);

    var autoBtn = document.getElementById('autobtn');
    if (autoBtn) autoBtn.addEventListener('click', function () {
      S.autoMorph = !S.autoMorph; this.classList.toggle('on', S.autoMorph);
      var t = document.getElementById('auto-timer'); if (t) t.textContent = S.autoMorph ? '-' : 'OFF';
    });

    var rndBtn = document.getElementById('rndbtn');
    if (rndBtn) rndBtn.addEventListener('click', function () {
      if (S._iosCoarsePointer) requestAnimationFrame(function () { try { NX.goRandom(); } catch (eR) { /* ignore */ } });
      else try { NX.goRandom(); } catch (eR2) { /* ignore */ }
    });

    var panelFab = document.getElementById('panel-fab');
    if (panelFab) panelFab.addEventListener('click', function () { togglePanelVisibility(); });
    var panelHideInline = document.getElementById('panel-hide-inline');
    if (panelHideInline) panelHideInline.addEventListener('click', function () { togglePanelVisibility(); });

    var xBtn = document.getElementById('xbtn');
    if (xBtn) xBtn.addEventListener('click', function () { S.explode = 0.95; S.beat = 0.72; });

    var nextBtn = document.getElementById('nextbtn');
    if (nextBtn) nextBtn.addEventListener('click', function () {
      if (S._iosCoarsePointer) requestAnimationFrame(function () { try { NX.goNext(); } catch (eN) { /* ignore */ } });
      else try { NX.goNext(); } catch (eN2) { /* ignore */ }
    });

    var prevBtn = document.getElementById('prevbtn');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      if (S._iosCoarsePointer) requestAnimationFrame(function () { try { NX.goPrev(); } catch (eP) { /* ignore */ } });
      else try { NX.goPrev(); } catch (eP2) { /* ignore */ }
    });

    function toggleMicUi() {
      NX.audio.toggleMic();
      setTimeout(syncLiveMicUI, 80);
    }
    var micBtn = document.getElementById('micbtn');
    if (micBtn) micBtn.addEventListener('click', toggleMicUi);
    var liveMic = document.getElementById('live-mic-big');
    if (liveMic) liveMic.addEventListener('click', toggleMicUi);

    document.querySelectorAll('.nx-react-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = btn.getAttribute('data-profile');
        if (p && NX.audio.applyReactivityProfile) NX.audio.applyReactivityProfile(p);
      });
    });
    var reactSel = document.getElementById('nx-react-profile');
    if (reactSel) reactSel.addEventListener('change', function () {
      if (NX.audio.applyReactivityProfile) NX.audio.applyReactivityProfile(this.value);
    });

    var recBtn = document.getElementById('recbtn');
    if (recBtn) recBtn.addEventListener('click', toggleRecording);

    var recAmb = document.getElementById('rec-ambient-bg');
    if (recAmb) {
      try {
        recAmb.checked = (NX.Persist && NX.Persist.getItem && NX.Persist.getItem('nexus.rec.ambientUnderlay')) === '1';
      } catch (eAmb) { recAmb.checked = false; }
      S.recAmbientUnderlay = !!recAmb.checked;
      recAmb.addEventListener('change', function () {
        S.recAmbientUnderlay = !!recAmb.checked;
        try {
          if (NX.Persist && NX.Persist.setItem) NX.Persist.setItem('nexus.rec.ambientUnderlay', S.recAmbientUnderlay ? '1' : '0');
        } catch (eAmb2) { /* ignore */ }
      });
    }

    /* Quality preset */
    var qsel = document.getElementById('qsel');
    if (qsel) qsel.addEventListener('change', function () {
      NX.setQualityPreset(this.value);
      S.adaptiveGpu = false;
      var ab = document.getElementById('adaptbtn'); if (ab) ab.classList.remove('on');
    });

    var adaptBtn = document.getElementById('adaptbtn');
    if (adaptBtn) adaptBtn.addEventListener('click', function () {
      S.adaptiveGpu = !S.adaptiveGpu; this.classList.toggle('on', S.adaptiveGpu);
      /* AUTO Q adjusts renderScale for balanced / perf / ultra without forcing a preset change. */
    });

    /* Input panel (mic device selector) */
    var inputBtn = document.getElementById('inputbtn');
    if (inputBtn) inputBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      var ip = document.getElementById('ipanel'); ip.classList.toggle('open');
      if (ip.classList.contains('open')) await NX.audio.enumDevices();
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#ipanel') && !e.target.closest('#inputbtn')) {
        var ip = document.getElementById('ipanel'); if (ip) ip.classList.remove('open');
      }
    });
    var devsel = document.getElementById('devsel');
    if (devsel) devsel.addEventListener('change', function () {
      S.curDev = this.value; if (S.micOn) NX.audio.startMic(this.value);
    });

    /* Presets */
    var presetSel = document.getElementById('preset-sel');
    if (presetSel) presetSel.addEventListener('change', function () {
      if (this.value) NX.presets.load(this.value);
    });
    var savePresetBtn = document.getElementById('save-preset');
    if (savePresetBtn) savePresetBtn.addEventListener('click', function () {
      var name = prompt('Preset name:');
      if (name) { NX.presets.save(name); buildPresets(); }
    });

    /* MIDI learn */
    var midiLearnBtn = document.getElementById('midi-learn');
    if (midiLearnBtn) midiLearnBtn.addEventListener('click', function () {
      if (NX.midi) NX.midi.startLearn('speed');
    });

    /* Keyboard */
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === ' ') { NX.goNext(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') NX.goPrev();
      else if (e.key === 'r' || e.key === 'R') NX.goRandom();
      else if (e.key === 'f' || e.key === 'F') { if (fullBtn) fullBtn.click(); }
      else if (e.key === 'h' || e.key === 'H') {
        togglePanelVisibility();
      }
      else if (e.key === 'p' || e.key === 'P') togglePresent();
      else if (e.code === 'Backquote') { S.showFpsOverlay = !S.showFpsOverlay; document.getElementById('fps-badge').classList.toggle('on', S.showFpsOverlay); }
      else if (e.key === 'a' || e.key === 'A') { if (autoBtn) autoBtn.click(); }
      else if (e.key === 'm' || e.key === 'M') { NX.audio.toggleMic(); setTimeout(syncLiveMicUI, 80); }
      else if (e.key === 'x' || e.key === 'X') { S.explode = 0.95; S.beat = 0.72; }
      var n = parseInt(e.key);
      if (!isNaN(n) && n >= 1 && n <= 9) NX.goNext(n - 1);
      if (e.key === '0') NX.goNext(9);
    });

    /* AI Director button */
    var dirBtn = document.getElementById('directorbtn');
    if (dirBtn) dirBtn.addEventListener('click', function () {
      if (NX.autoDirector) {
        var on = NX.autoDirector.toggle();
        this.classList.toggle('on', on);
        S.autoMorph = !on;
        var ab = document.getElementById('autobtn');
        if (ab) ab.classList.toggle('on', S.autoMorph);
      }
    });

    /* Nexus Engine — visual stack + Aurora Field (Butterchurn-backed) */
    var nxMode = document.getElementById('nx-visual-mode');
    if (nxMode) {
      nxMode.value = S.visualMode || 'hybrid';
      nxMode.addEventListener('change', function () {
        if (NX.SceneManager) NX.SceneManager.setMode(this.value, { crossfade: true });
      });
    }
    var bcShow = document.getElementById('bc-showcase-sel');
    if (bcShow) bcShow.addEventListener('change', function () {
      if (!this.value || !NX.PresetLibrary || !NX.VisualEngineManager) return;
      var p = NX.PresetLibrary.getPreset(this.value);
      var bb = document.getElementById('bc-blend');
      var bt = bb ? (parseInt(bb.value, 10) || 20) * 0.1 : 2;
      bt = Math.max(1, Math.min(3, bt));
      if (p) NX.VisualEngineManager.loadPreset(p, bt, this.value);
      var bps = document.getElementById('bc-pro-sel');
      if (bps) bps.selectedIndex = 0;
    });

    var bcPro = document.getElementById('bc-pro-sel');
    if (bcPro) bcPro.addEventListener('change', function () {
      var idx = parseInt(this.value, 10);
      if (isNaN(idx) || !_proList[idx] || !window.NXProPresets) return;
      NXProPresets.apply(_proList[idx], { loadBc: true, goScene: true });
      var bcs = document.getElementById('bc-showcase-sel');
      if (bcs) bcs.selectedIndex = 0;
    });

    var proGenre = document.getElementById('pro-genre-filter');
    if (proGenre) proGenre.addEventListener('change', function () { buildProSelect(); });

    var nxStyle = document.getElementById('nx-visual-style');
    if (nxStyle) nxStyle.addEventListener('change', function () {
      if (!this.value || !window.NXProPresets) return;
      NXProPresets.applyVisualStyle(this.value);
    });

    var bcSel = document.getElementById('bc-preset-sel');
    if (bcSel) bcSel.addEventListener('change', function () {
      if (!this.value || !NX.PresetLibrary || !NX.VisualEngineManager) return;
      var p = NX.PresetLibrary.getPreset(this.value);
      var bb = document.getElementById('bc-blend');
      var bt = bb ? (parseInt(bb.value, 10) || 20) * 0.1 : 2;
      if (p) NX.VisualEngineManager.loadPreset(p, bt, this.value);
      var bps2 = document.getElementById('bc-pro-sel');
      if (bps2) bps2.selectedIndex = 0;
    });
    var bcRnd = document.getElementById('bc-random');
    if (bcRnd) bcRnd.addEventListener('click', function () {
      var keys = NX.PresetLibrary && NX.PresetLibrary.getKeys();
      if (NX.BcMorphConductor && NX.BcMorphConductor.isGigPoolActive && NX.BcMorphConductor.isGigPoolActive()) {
        var gk = NX.BcMorphConductor.getGigPoolKeys();
        if (gk && gk.length) keys = gk;
      }
      if (!keys || !keys.length) return;
      var rnd = typeof NX.randomUnit === 'function' ? NX.randomUnit : Math.random;
      var rk = keys[Math.floor(rnd() * keys.length)];
      var p = NX.PresetLibrary.getPreset(rk);
      var bb = document.getElementById('bc-blend');
      var bt = bb ? (parseInt(bb.value, 10) || 20) * 0.1 : 2;
      if (p) NX.VisualEngineManager.loadPreset(p, bt, rk);
    });

    var bcAutoMorph = document.getElementById('bc-auto-morph');
    var bcMorphBeats = document.getElementById('bc-morph-beats');
    var bcMorphPool = document.getElementById('bc-morph-pool');
    if (bcAutoMorph && NX.BcMorphConductor) {
      bcAutoMorph.addEventListener('change', function () {
        NX.BcMorphConductor.setEnabled(this.checked);
      });
    }
    if (bcMorphBeats && NX.BcMorphConductor) {
      bcMorphBeats.addEventListener('change', function () {
        NX.BcMorphConductor.setBeatsInterval(parseInt(this.value, 10) || 32);
      });
    }
    if (bcMorphPool && NX.BcMorphConductor) {
      bcMorphPool.addEventListener('change', function () {
        NX.BcMorphConductor.setPool(this.value);
      });
    }
    var nxConductorMotion = document.getElementById('nx-conductor-motion');
    if (nxConductorMotion) {
      nxConductorMotion.addEventListener('input', function () {
        var v = (parseInt(this.value, 10) || 100) / 100;
        S.bcConductorMotion = Math.max(0.65, Math.min(1.35, v));
      });
    }
    var nxHybBc = document.getElementById('nx-hybrid-bc-opacity');
    if (nxHybBc) {
      nxHybBc.addEventListener('input', function () {
        S.hybridBcOpacity = Math.max(0.12, Math.min(1, (parseInt(this.value, 10) || 100) / 100));
        if (NX.SceneManager && NX.SceneManager.syncDOM) NX.SceneManager.syncDOM();
      });
    }
    var nxHybSh = document.getElementById('nx-hybrid-shader-opacity');
    if (nxHybSh) {
      nxHybSh.addEventListener('input', function () {
        S.hybridShaderOpacity = Math.max(0.18, Math.min(1, (parseInt(this.value, 10) || 100) / 100));
        if (NX.SceneManager && NX.SceneManager.syncDOM) NX.SceneManager.syncDOM();
      });
    }
    var gigTa = document.getElementById('nx-bc-gig-pool-json');
    var gigApply = document.getElementById('nx-bc-gig-pool-apply');
    var gigClear = document.getElementById('nx-bc-gig-pool-clear');
    if (gigApply && NX.BcMorphConductor && NX.BcMorphConductor.applyGigPoolFromArray) {
      gigApply.addEventListener('click', function () {
        if (!gigTa) return;
        try {
          var arr = JSON.parse(gigTa.value || '[]');
          if (!Array.isArray(arr)) throw new Error('not array');
          NX.BcMorphConductor.applyGigPoolFromArray(arr);
        } catch (e) {
          if (typeof console !== 'undefined' && console.warn) console.warn('Gig pool JSON:', e && e.message);
          alert('Paste a JSON array of preset key strings, e.g. ["Flexi - …", "Geiss - …"]');
        }
      });
    }
    if (gigClear && NX.BcMorphConductor && NX.BcMorphConductor.clearGigPool) {
      gigClear.addEventListener('click', function () {
        NX.BcMorphConductor.clearGigPool();
        if (gigTa) gigTa.value = '';
      });
    }
    var nxBloom = document.getElementById('nx-bloom');
    if (nxBloom) {
      nxBloom.checked = !!S.nexusPostBloom;
      nxBloom.addEventListener('change', function () { S.nexusPostBloom = this.checked; });
    }
    var nxTr = document.getElementById('nx-trails');
    if (nxTr) {
      nxTr.value = Math.round((S.nexusPostTrails || 0) * 100);
      nxTr.addEventListener('input', function () { S.nexusPostTrails = parseInt(this.value, 10) / 100; });
    }
    var nxPerf = document.getElementById('nx-perf');
    if (nxPerf) {
      nxPerf.checked = !!S.nexusPerfLock;
      nxPerf.addEventListener('change', function () {
        S.nexusPerfLock = this.checked;
        if (this.checked && NX.setQualityPreset) NX.setQualityPreset('perf');
        document.body.classList.toggle('nexus-perf-top', this.checked);
        var pb = document.getElementById('perfbtn');
        if (pb) pb.classList.toggle('on', this.checked);
        NX.resize();
      });
    }

    var perfBtn = document.getElementById('perfbtn');
    if (perfBtn) perfBtn.addEventListener('click', function () {
      S.nexusPerfLock = !S.nexusPerfLock;
      if (nxPerf) nxPerf.checked = S.nexusPerfLock;
      if (S.nexusPerfLock && NX.setQualityPreset) NX.setQualityPreset('perf');
      document.body.classList.toggle('nexus-perf-top', S.nexusPerfLock);
      this.classList.toggle('on', S.nexusPerfLock);
      NX.resize();
    });

    var vizPerfBtn = document.getElementById('vizperfbtn');
    if (vizPerfBtn) vizPerfBtn.addEventListener('click', function () {
      var on = !S.nexusVizPerformance;
      if (NX.setVizPerformanceMode) NX.setVizPerformanceMode(on);
      this.classList.toggle('on', on);
      syncControls();
    });

    var nxKal = document.getElementById('nx-kaleido');
    if (nxKal) nxKal.addEventListener('input', function () { S.postFxKaleido = parseInt(this.value, 10) / 100; });
    var nxGli = document.getElementById('nx-glitch');
    if (nxGli) nxGli.addEventListener('input', function () { S.postFxGlitch = parseInt(this.value, 10) / 100; });
    var nxAsu = document.getElementById('nx-asura');
    if (nxAsu) nxAsu.addEventListener('input', function () { S.postFxAsura = parseInt(this.value, 10) / 100; });
    var nxShow = document.getElementById('nx-show-macro');
    if (nxShow) nxShow.addEventListener('change', function () {
      if (!this.value) { S.visualMacro = ''; syncControls(); return; }
      if (window.NXProPresets && NXProPresets.applyShowMacro) NXProPresets.applyShowMacro(this.value);
    });

    var padComp = document.getElementById('pad-compact');
    if (padComp) padComp.addEventListener('change', function () { buildPads(); setActiveScene(S.curS); });
    var sceneList = document.getElementById('scene-list-mode');
    if (sceneList) sceneList.addEventListener('change', function () { buildPads(); setActiveScene(S.curS); });
    var sceneSearch = document.getElementById('scene-grid-search');
    if (sceneSearch) sceneSearch.addEventListener('input', function () { buildPads(); setActiveScene(S.curS); });

    var seedReroll = document.getElementById('nx-seed-reroll');
    if (seedReroll && NX.SessionSeed && NX.SessionSeed.reroll) {
      seedReroll.addEventListener('click', function () {
        NX.SessionSeed.reroll();
        refreshSeedHud();
        syncControls();
      });
    }
    var seedCopy = document.getElementById('nx-seed-copy');
    if (seedCopy && NX.SessionSeed && NX.SessionSeed.copyShareUrl) {
      seedCopy.addEventListener('click', function () {
        var u = NX.SessionSeed.copyShareUrl();
        if (!u) return;
        var btn = seedCopy;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(u).then(function () {
            var t0 = btn.textContent;
            btn.textContent = 'Copied';
            setTimeout(function () { btn.textContent = t0 || 'Copy link'; }, 1600);
          }).catch(function () { window.prompt('Copy URL:', u); });
        } else {
          window.prompt('Copy URL:', u);
        }
      });
    }
    var dbgExport = document.getElementById('nx-debug-export');
    if (dbgExport) dbgExport.addEventListener('click', exportDebugBundle);

    if (NX.Showfile && NX.Showfile.wire) NX.Showfile.wire();
    if (NX.RecBrand && NX.RecBrand.wire) NX.RecBrand.wire();

    var onboardReset = document.getElementById('nx-onboard-reset');
    if (onboardReset && NX.Onboard) {
      onboardReset.addEventListener('click', function () {
        NX.Onboard.resetTour();
        setAppBanner('Tour reset — use Launch again to see the guide.');
      });
    }
    var hwRecal = document.getElementById('nx-hw-recalibrate');
    if (hwRecal && NX.HwCalibrate && typeof NX.HwCalibrate.forceRecalibrate === 'function') {
      hwRecal.addEventListener('click', function () {
        setAppBanner('Re-calibrating GPU…');
        NX.HwCalibrate.forceRecalibrate(function () {
          setAppBanner('Hardware tier updated. Reload if visuals look wrong.');
        });
      });
    }

    var midiProf = document.getElementById('nx-midi-profile-sel');
    if (midiProf && NX.midi && NX.midi.setActiveProfile) {
      midiProf.addEventListener('change', function () {
        NX.midi.setActiveProfile(this.value);
        refreshMidiMapPanel();
      });
    }
    var midiPanic = document.getElementById('nx-midi-panic');
    if (midiPanic && NX.midi && NX.midi.panic) {
      midiPanic.addEventListener('click', function () {
        NX.midi.panic();
        refreshMidiMapPanel();
      });
    }

    var mmapBtn = document.getElementById('midimapbtn');
    var mmapClose = document.getElementById('midi-map-close');
    if (mmapBtn) mmapBtn.addEventListener('click', function () {
      var p = document.getElementById('midi-map-panel');
      if (p && p.classList.contains('open')) closeMidiMapPanel();
      else openMidiMapPanel();
    });
    if (mmapClose) mmapClose.addEventListener('click', closeMidiMapPanel);

    /* Demo sequence selector */
    var demoSel = document.getElementById('demosel');
    if (demoSel) demoSel.addEventListener('change', function () {
      if (this.value && NX.demo) NX.demo.play(this.value);
      this.value = '';
    });

    /* Pro unlock — More tab (text-only status; codes in README / license) */
    var unlockBtn = document.getElementById('nx-pro-unlock-btn');
    var unlockInput = document.getElementById('nx-pro-unlock-input');
    var unlockMsg = document.getElementById('nx-pro-unlock-msg');
    function setUnlockMsg(text, ok) {
      if (!unlockMsg) return;
      unlockMsg.textContent = text || '';
      unlockMsg.className = 'nx-pro-unlock-msg' + (ok ? ' nx-pro-unlock-ok' : (text ? ' nx-pro-unlock-bad' : ''));
    }
    function applyProUnlock() {
      if (!unlockInput || !NX.watermark || typeof NX.watermark.unlock !== 'function') return;
      var code = String(unlockInput.value || '').trim();
      if (!code) { setUnlockMsg('Enter a code.', false); return; }
      if (NX.watermark.unlock(code)) {
        setUnlockMsg('Pro unlocked — watermark off.', true);
        unlockInput.value = '';
        if (NX.watermark.tick) NX.watermark.tick();
      } else {
        setUnlockMsg('Code not recognized.', false);
      }
    }
    if (unlockBtn) unlockBtn.addEventListener('click', applyProUnlock);
    if (unlockInput) {
      unlockInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); applyProUnlock(); }
      });
    }

    /* OBS mode via URL param */
    if (location.search.indexOf('obs=1') !== -1) {
      setTimeout(function () {
        var sp = document.getElementById('splash'); if (sp) { sp.classList.add('out'); sp.style.display = 'none'; }
        togglePresent();
      }, 200);
    }

    /* Demo sequence via URL param */
    if (NX.demo) NX.demo.checkURL();

    try {
      var ps = new URLSearchParams(window.location.search);
      if (ps.get('director') === '1' && NX.autoDirector) {
        NX.autoDirector.enable();
        var dbtn = document.getElementById('directorbtn');
        if (dbtn) dbtn.classList.add('on');
        S.autoMorph = false;
        var autob = document.getElementById('autobtn');
        if (autob) autob.classList.remove('on');
      }
    } catch (eDir) { /* ignore */ }
  }

  /* ---- Init -------------------------------------------------------- */
  function init() {
    if (NX.audio.applyReactivityProfile) NX.audio.applyReactivityProfile(S.reactivityProfile || 'balanced');
    buildPads();
    buildPresets();
    buildButterchurnPresets();
    if (NX.BcMorphConductor && NX.BcMorphConductor.rebuildPool) NX.BcMorphConductor.rebuildPool();
    (function syncGigPoolTa() {
      var ta = document.getElementById('nx-bc-gig-pool-json');
      if (!ta || !NX.BcMorphConductor || !NX.BcMorphConductor.getGigPoolKeys) return;
      if (NX.BcMorphConductor.isGigPoolActive && NX.BcMorphConductor.isGigPoolActive()) {
        try { ta.value = JSON.stringify(NX.BcMorphConductor.getGigPoolKeys()); } catch (e0) { ta.value = ''; }
      }
    })();
    buildShowcaseSelect();
    buildProSelect();
    wireEvents();
    if (NX.HomageBridge && NX.HomageBridge.init) NX.HomageBridge.init();
    if (NX.HomageDOM && NX.HomageDOM.init) NX.HomageDOM.init();
    if (window.NXShell && NXShell.init) NXShell.init();
    syncControls();
    setActiveScene(S.curS);
    syncLiveMicUI();
    updatePanelFab();
    refreshSeedHud();
    if (NX.SessionSeed) NX.SessionSeed._onChange = refreshSeedHud;
    if (NX.midi && NX.midi.refreshProfileSelect) NX.midi.refreshProfileSelect();
    if (window.NexusRelease && NexusRelease.initUi) NexusRelease.initUi();
    if (NX.ClipPad && NX.ClipPad.mount) NX.ClipPad.mount();
    var gcopy = document.getElementById('nx-genome-copy');
    if (gcopy && NX.EvolveStack && NX.EvolveStack.genomeToHex) {
      gcopy.addEventListener('click', function () {
        var h = NX.EvolveStack.genomeToHex();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(h).catch(function () { window.prompt('Genome', h); });
        } else {
          window.prompt('Genome', h);
        }
      });
    }
  }

  NX.ui = {
    init: init, showName: showName, setActiveScene: setActiveScene, tickHud: tickHud,
    syncControls: syncControls, setPalette: setPalette, syncLiveMicUI: syncLiveMicUI, buildPads: buildPads, buildPresets: buildPresets, buildButterchurnPresets: buildButterchurnPresets, buildShowcaseSelect: buildShowcaseSelect, buildProSelect: buildProSelect,
    setMidiStatus: setMidiStatus, flashControl: flashControl,
    togglePresent: togglePresent, toggleRecording: toggleRecording,
    togglePanelVisibility: togglePanelVisibility, updatePanelFab: updatePanelFab,
    refreshMidiMapPanel: refreshMidiMapPanel, openMidiMapPanel: openMidiMapPanel, closeMidiMapPanel: closeMidiMapPanel,
    setAppBanner: setAppBanner, exportDebugBundle: exportDebugBundle, refreshSeedHud: refreshSeedHud
  };
})();
