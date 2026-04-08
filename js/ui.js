'use strict';
/*  ui.js — Resolume-style scene pads, control sliders, audio meters,
    preset selector, MIDI status, present mode, recording — all wired
    to the NX namespace for live visual engine control.                 */

(function () {
  var S = NX.S, P = NX.P;

  /* ---- Build scene pad grid ---------------------------------------- */
  function buildPads() {
    var grid = document.getElementById('scene-grid');
    if (!grid) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    NX.scenes.forEach(function (sc, i) {
      var pad = document.createElement('div');
      pad.className = 'scene-pad' + (i === S.curS ? ' active' : '');
      pad.style.setProperty('--pad-color', sc.c || '#00e5ff');
      pad.dataset.idx = i;
      var idx = document.createElement('span');
      idx.className = 'sp-idx'; idx.textContent = i + 1;
      var name = document.createElement('span');
      name.className = 'sp-name'; name.textContent = sc.n;
      pad.appendChild(idx); pad.appendChild(name);
      pad.addEventListener('click', function () { NX.goNext(i); });
      grid.appendChild(pad);
    });
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

  /* ---- Sync slider values from P to DOM ---------------------------- */
  function syncControls() {
    var map = { rspd: P.SPD, rrct: P.RCT, rwrp: P.WRP, rgain: P.GAIN * 100, rsmth: P.SMTH };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.value = map[id]; var v = el.closest('.ctrl-slider'); if (v) { var vd = v.querySelector('.val'); if (vd) vd.textContent = Math.round(map[id]); } }
    });
    var rmorph = document.getElementById('rmorph');
    if (rmorph) rmorph.value = Math.round(S.morphDurationSec * 10);
    setPalette(P.PAL);
  }

  function setPalette(idx) {
    P.PAL = idx;
    document.querySelectorAll('.pal-sw').forEach(function (s) { s.classList.toggle('on', +s.dataset.p === idx); });
  }

  /* ---- HUD tick (called from engine loop) -------------------------- */
  function tickHud(st) {
    if (++st.hudTick % 6 !== 0) return;

    var bp = Math.round(st.sBass * 100), mp = Math.round(st.sMid * 100), hp = Math.round(st.sHigh * 100);
    var fb = Math.round(st.sFlux * 100), vb = Math.round(st.sVol * 100);
    setMeter('m-bass', bp); setMeter('m-mid', mp); setMeter('m-high', hp);
    setMeter('m-flux', fb); setMeter('m-vol', vb);

    var bpmEl = document.getElementById('bpm-val');
    if (bpmEl) bpmEl.textContent = st.bpm || '--';

    if (st.autoMorph) {
      var rem = Math.max(0, Math.round(st.presInterval - st.presTimer));
      var nxt = document.getElementById('auto-timer');
      if (nxt && st.hudTick % 30 < 6) nxt.textContent = rem + 's';
    }

    if (st.showFpsOverlay && st.hudTick % 8 < 6) {
      var fe = document.getElementById('fps-badge');
      if (fe) fe.textContent = 'FPS ' + Math.round(st._emaFps) + ' · ' + Math.round(NX.getRenderScale() * 100) + '% · ' + st.FW + '×' + st.FH;
    }

    pulsePads();
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

  function startRecording() {
    if (S.recording) return;
    try {
      var stream = NX.C.captureStream(30);
      mediaRec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
      recChunks = [];
      mediaRec.ondataavailable = function (e) { if (e.data.size > 0) recChunks.push(e.data); };
      mediaRec.onstop = function () {
        var blob = new Blob(recChunks, { type: 'video/webm' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'NEXUS_' + Date.now() + '.webm';
        a.click(); URL.revokeObjectURL(a.href);
        S.recording = false;
        var b = document.getElementById('recbtn'); if (b) b.classList.remove('on');
      };
      mediaRec.start(1000);
      S.recording = true;
      var b = document.getElementById('recbtn'); if (b) b.classList.add('on');
    } catch (e) { console.warn('Recording failed:', e.message); }
  }
  function stopRecording() { if (mediaRec && S.recording) mediaRec.stop(); }
  function toggleRecording() { S.recording ? stopRecording() : startRecording(); }

  /* ---- Present mode ------------------------------------------------ */
  function togglePresent() {
    S.presentMode = !S.presentMode;
    document.body.classList.toggle('nexus-present', S.presentMode);
    var b = document.getElementById('presentbtn');
    if (b) { b.textContent = S.presentMode ? 'EXIT' : 'PRESENT'; b.classList.toggle('on', S.presentMode); }
  }

  /* ---- Wire events ------------------------------------------------- */
  function wireEvents() {
    /* Splash start */
    var startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', async function () {
      try { await NX.audio.startMic(); } catch (e) { }
      var sp = document.getElementById('splash');
      sp.classList.add('out');
      setTimeout(function () { sp.style.display = 'none'; }, 900);
      document.getElementById('panel').classList.remove('hide');
    });

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
    wireSlider('rsmth', function (e) { P.SMTH = +e.target.value; if (S.analyser) S.analyser.smoothingTimeConstant = P.SMTH / 100; });
    wireSlider('rmorph', function (e) { S.morphDurationSec = Math.max(0.55, Math.min(4.2, e.target.value * 0.1)); });

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
    if (rndBtn) rndBtn.addEventListener('click', NX.goRandom);

    var xBtn = document.getElementById('xbtn');
    if (xBtn) xBtn.addEventListener('click', function () { S.explode = 1.5; S.beat = 1.0; });

    var nextBtn = document.getElementById('nextbtn');
    if (nextBtn) nextBtn.addEventListener('click', function () { NX.goNext(); });

    var prevBtn = document.getElementById('prevbtn');
    if (prevBtn) prevBtn.addEventListener('click', NX.goPrev);

    var micBtn = document.getElementById('micbtn');
    if (micBtn) micBtn.addEventListener('click', NX.audio.toggleMic);

    var recBtn = document.getElementById('recbtn');
    if (recBtn) recBtn.addEventListener('click', toggleRecording);

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
      if (S.adaptiveGpu && qsel && qsel.value !== 'balanced') { qsel.value = 'balanced'; NX.setQualityPreset('balanced'); }
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
        S.uiHide = !S.uiHide;
        document.getElementById('panel').classList.toggle('hide', S.uiHide);
      }
      else if (e.key === 'p' || e.key === 'P') togglePresent();
      else if (e.code === 'Backquote') { S.showFpsOverlay = !S.showFpsOverlay; document.getElementById('fps-badge').classList.toggle('on', S.showFpsOverlay); }
      else if (e.key === 'a' || e.key === 'A') { if (autoBtn) autoBtn.click(); }
      else if (e.key === 'm' || e.key === 'M') NX.audio.toggleMic();
      else if (e.key === 'x' || e.key === 'X') { S.explode = 1.5; S.beat = 1.0; }
      var n = parseInt(e.key);
      if (!isNaN(n) && n >= 1 && n <= 9) NX.goNext(n - 1);
      if (e.key === '0') NX.goNext(9);
    });

    /* OBS mode via URL param */
    if (location.search.indexOf('obs=1') !== -1) {
      setTimeout(function () {
        var sp = document.getElementById('splash'); if (sp) { sp.classList.add('out'); sp.style.display = 'none'; }
        togglePresent();
      }, 200);
    }
  }

  /* ---- Init -------------------------------------------------------- */
  function init() {
    buildPads();
    buildPresets();
    wireEvents();
    syncControls();
    setActiveScene(S.curS);
  }

  NX.ui = {
    init: init, showName: showName, setActiveScene: setActiveScene, tickHud: tickHud,
    syncControls: syncControls, setPalette: setPalette, buildPads: buildPads, buildPresets: buildPresets,
    setMidiStatus: setMidiStatus, flashControl: flashControl,
    togglePresent: togglePresent, toggleRecording: toggleRecording
  };
})();
