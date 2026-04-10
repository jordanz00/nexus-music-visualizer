'use strict';
/*  engine.js — WebGL context, FBO pipeline, uniform cache, render loop.
    Establishes the NX namespace used by every other module.             */

window.NX = window.NX || {};

(function () {
  var C = document.getElementById('c');
  var gl = null;
  if (C) {
    /* Try high-performance first; fall back for drivers that reject options or return null. */
    gl = C.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
      || C.getContext('experimental-webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
      || C.getContext('webgl', { antialias: false, alpha: false })
      || C.getContext('experimental-webgl', { antialias: false, alpha: false });
  }
  if (!gl) {
    document.documentElement.classList.add('nx-fatal-no-webgl');
    var splashEl = document.getElementById('splash');
    if (splashEl) splashEl.style.display = 'none';
    var fatalEl = document.getElementById('nx-fatal');
    if (fatalEl) {
      fatalEl.hidden = false;
      fatalEl.setAttribute('aria-hidden', 'false');
    }
    NX._fatalNoWebGL = true;
    NX.scenes = [];
    NX.sceneProgs = [];
    NX.postProgs = {};
    return;
  }
  gl.getExtension('OES_texture_float');

  /* ---- shared state ------------------------------------------------ */
  var S = {
    W: 0, H: 0, FW: 0, FH: 0, GT: 0, frame: 0, hudTick: 0,
    mouseRaw: [0, 0], mouseSmooth: [0, 0],
    sBass: 0, sLowMid: 0, sMid: 0, sHigh: 0, sSub: 0, sVol: 0, sFlux: 0, sCent: 0.35,
    prevBass: 0, prevMbRaw: 0, bpmList: [], lastBeat: 0, bpm: 0, beat: 0,
    /** Smoothed beat 0–1 for shaders/post — reduces harsh strobing vs raw `beat`. */
    beatVisual: 0,
    explode: 0,
    _lastAudT: 0, prevFreqFlux: null,
    micOn: false, analyser: null, waveArr: null, freqArr: null, bufLen: 0,
    audioCtx: null, micStream: null, gainNode: null,
    /** Gain node Butterchurn taps (after P.GAIN); gated by RMS so silence stays calm */
    bcGateNode: null,
    /** 0–1 smoothed open amount for BC audio feed. */
    _bcGateOpen: 0,
    /** 0–1 energy from real FFT (mic); BC intensity / morph. */
    micEnergy: 0,
    /** 0–1 crest / transient follower (time-domain vs slow RMS). */
    sTransient: 0,
    /** Slow RMS for transient detection (internal). */
    _rmsSlow: 0,
    /** 0–1 visual Aurora drive — not gated like raw BC audio tap. */
    _visualBcDrive: 0,
    /** punchy | balanced | smooth — mic reactivity preset. */
    reactivityProfile: 'punchy',
    /** 0–1 smoothed: how much motion/post follows live input (calm when silent / no mic). */
    _visualDrive: 0,
    curDev: '',
    _emaFps: 60, _adaptiveTick: 0,
    /** Hysteresis for AUTO Q renderScale steps (consecutive slow/fast windows). */
    _adaptiveLowStreak: 0, _adaptiveHighStreak: 0,
    curS: 0, nxtS: 1, morphing: false, morphBlend: 0,
    autoMorph: true, presTimer: 0, presInterval: 14, _morphFrame: 0,
    morphDurationSec: 1.4, showFpsOverlay: false, presentMode: false,
    adaptiveGpu: false, uiHide: false, recording: false,
    /* Default shader: hybrid stack used mix-blend screen + dark rays → “no WebGL” for many scenes. Enable hybrid in UI when desired. */
    visualMode: 'shader',
    nexusPerfLock: false,
    nexusPostBloom: true,
    /** Effect chain bypass flags (Show tab); consumed by post.js */
    postChain: { bloom: true, streak: true, grade: true, trails: true, kaleido: true, glitch: true },
    nexusPostTrails: 0,
    postBloomMul: 1,
    hueShift: 0,
    bcIntensity: 1,
    bcSpeed: 1,
    /** When set, main loop composites layers into #c-rec for export resolution */
    recCompositeDims: null,
    /** Last Butterchurn preset filename/key (for HUD + morph conductor) */
    bcLastPresetKey: '',
    /** True on iPhone/iPad: coarser pointer smoothing + GPU-friendly caps */
    _iosCoarsePointer: false,
    /** 0–1 beat phase (BPM clock); set in audio.js when mic + stable BPM */
    beatPhase: 0,
    /** 0–1 confidence in BPM estimate */
    bpmConfidence: 0,
    /** Monotonic count of bass-transient “beats” (for quantized cues). */
    _beatPulseCount: 0,
    /** club | ambient | psychedelic | '' — biases random scene picks */
    visualMacro: '',
    /** One-shot live-FPS mode: caps trails/bloom + perf lock (see setVizPerformanceMode) */
    nexusVizPerformance: false,
    /** Kaleido / glitch post strengths 0–1 */
    postFxKaleido: 0,
    postFxGlitch: 0,
    /** During recording: optional assist (restore nexusPerfLock on stop) */
    _recHadPerfAssist: false,
    _recPrevPerfLock: false,
    /** Composite REC only (#c-rec): draw cheap gradient under layers (default off; UI + localStorage) */
    recAmbientUnderlay: false,
    /** Show tab: WebGPU WGSL chain samples #c into #nx-wgpu */
    wgpuGraphEnabled: false
  };
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    S.morphDurationSec = Math.min(S.morphDurationSec, 0.85);
    S.presInterval = Math.max(S.presInterval, 38);
  }

  var P = { SPD: 5, RCT: 7, WRP: 5, PAL: 0, GAIN: 1.0, SMTH: 58, TRIM: 100 };

  /* ---- canvas / resize --------------------------------------------- */
  var rawW = 0, rawH = 0, maxDpr = 2, renderScale = 0.78, pendingRenderScale = null;

  (function nexusIOSProfile() {
    var ua = navigator.userAgent || '';
    var iOS = /iP(ad|hone|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    S._iosCoarsePointer = !!iOS;
    if (iOS) {
      maxDpr = Math.min(maxDpr, 1.75);
      renderScale = Math.min(renderScale, 0.66);
      document.documentElement.classList.add('nexus-ios');
    }
  })();

  function resize() {
    var capDpr = S.nexusPerfLock ? Math.min(maxDpr, 1) : maxDpr;
    var dpr = Math.min(window.devicePixelRatio || 1, capDpr);
    /* Some WebKit passes report 0×0 briefly; without a floor, FBOs never build → black forever. */
    var iw = typeof innerWidth === 'number' ? innerWidth : 0;
    var ih = typeof innerHeight === 'number' ? innerHeight : 0;
    var docEl = document.documentElement;
    var cwDoc = docEl && docEl.clientWidth ? docEl.clientWidth : 0;
    var chDoc = docEl && docEl.clientHeight ? docEl.clientHeight : 0;
    /* Avoid screen.width/height fallback — can be huge and create incomplete FBOs on some GPUs. */
    S.W = Math.max(1, iw > 2 ? iw : (cwDoc > 2 ? cwDoc : 800));
    S.H = Math.max(1, ih > 2 ? ih : (chDoc > 2 ? chDoc : 600));
    var rw0 = Math.floor(S.W * dpr), rh0 = Math.floor(S.H * dpr);
    var maxTex = 8192;
    try {
      var mt = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (typeof mt === 'number' && mt > 0) maxTex = mt;
    } catch (eMt) { /* ignore */ }
    if (rw0 > maxTex || rh0 > maxTex) {
      var scale = Math.min(maxTex / rw0, maxTex / rh0, 1);
      rw0 = Math.max(1, Math.floor(rw0 * scale));
      rh0 = Math.max(1, Math.floor(rh0 * scale));
    }
    C.width = rw0; C.height = rh0;
    C.style.width = S.W + 'px'; C.style.height = S.H + 'px';
    rawW = C.width; rawH = C.height;
    if (pendingRenderScale != null) { renderScale = pendingRenderScale; pendingRenderScale = null; }
    var effScale = S.nexusPerfLock ? Math.min(renderScale, 0.56) : renderScale;
    S.FW = Math.max(1, Math.floor(rawW * effScale));
    S.FH = Math.max(1, Math.floor(rawH * effScale));
    /* Default framebuffer is full canvas; scene passes use their own FBO viewports. */
    gl.viewport(0, 0, Math.max(1, rawW | 0), Math.max(1, rawH | 0));
    rebuildFBOs();
    if (NX.VisualEngineManager && NX.VisualEngineManager.resize) NX.VisualEngineManager.resize();
    if (NX.WgslGraph && NX.WgslGraph.resize) NX.WgslGraph.resize();
  }
  addEventListener('resize', resize);
  window.addEventListener('load', function () { resize(); });
  window.addEventListener('orientationchange', function () { setTimeout(resize, 300); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize);
  }

  function applyRenderScaleOnly(next) {
    next = Math.max(0.42, Math.min(1, next));
    if (Math.abs(next - renderScale) < 0.02) return;
    renderScale = next; rebuildFBOs();
  }
  function setQualityPreset(mode) {
    var cap = S._iosCoarsePointer ? 1.75 : 2;
    if (mode === 'perf') { maxDpr = 1.25; pendingRenderScale = 0.52; }
    else if (mode === 'ultra') { maxDpr = cap; pendingRenderScale = S._iosCoarsePointer ? 0.74 : 1; }
    else { maxDpr = cap; pendingRenderScale = S._iosCoarsePointer ? 0.66 : 0.78; }
    resize();
  }
  function getRenderScale() { return renderScale; }

  /* ---- GL utilities ------------------------------------------------ */
  function mkSh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('Shader error:', gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function mkProg(vs, fs) {
    var v = mkSh(gl.VERTEX_SHADER, vs), f = mkSh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('Link:', gl.getProgramInfoLog(p)); return null; }
    gl.deleteShader(v); gl.deleteShader(f); return p;
  }
  var qbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  function mkRT(w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t: t, f: f };
  }

  /* ---- FBOs -------------------------------------------------------- */
  var fbA = [null, null], fbB = [null, null], fbBloom = null, fbBloomBlur = null, fbMorph = null;
  var pingA = 0, pingB = 0;

  function rebuildFBOs() {
    if (!rawW || !rawH) return;
    var effScale = S.nexusPerfLock ? Math.min(renderScale, 0.56) : renderScale;
    S.FW = Math.max(1, Math.floor(rawW * effScale));
    S.FH = Math.max(1, Math.floor(rawH * effScale));
    var hw = Math.max(1, Math.floor(S.FW / 2)), hh = Math.max(1, Math.floor(S.FH / 2));
    for (var i = 0; i < 2; i++) {
      if (fbA[i]) { gl.deleteTexture(fbA[i].t); gl.deleteFramebuffer(fbA[i].f); }
      if (fbB[i]) { gl.deleteTexture(fbB[i].t); gl.deleteFramebuffer(fbB[i].f); }
      fbA[i] = mkRT(S.FW, S.FH);
      fbB[i] = mkRT(hw, hh);
    }
    [fbBloom, fbBloomBlur, fbMorph].forEach(function (r) { if (r) { gl.deleteTexture(r.t); gl.deleteFramebuffer(r.f); } });
    fbBloom = mkRT(hw, hh); fbBloomBlur = mkRT(hw, hh); fbMorph = mkRT(S.FW, S.FH);
    pingA = 0; pingB = 0;
  }

  /* ---- Audio texture (512×1) --------------------------------------- */
  var atex = gl.createTexture(), abuf = new Uint8Array(512);
  (function () {
    for (var i = 0; i < 256; i++) abuf[256 + i] = 128;
    gl.bindTexture(gl.TEXTURE_2D, atex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 512, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, abuf);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  })();

  /* ---- Uniform / attrib cache -------------------------------------- */
  var _uCache = {}, _aCache = {}, _pIds = new WeakMap(), _pId = 0;
  function _pid(prog) { if (!_pIds.has(prog)) _pIds.set(prog, _pId++); return _pIds.get(prog); }
  function u(prog, name) {
    var id = _pid(prog);
    if (!_uCache[id]) _uCache[id] = {};
    if (!(name in _uCache[id])) _uCache[id][name] = gl.getUniformLocation(prog, name);
    return _uCache[id][name];
  }

  function bindQuad(prog) {
    gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
    var id = _pid(prog);
    if (!_aCache[id]) _aCache[id] = gl.getAttribLocation(prog, 'pos');
    var l = _aCache[id];
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
  }

  function shapeDrive(x, gain) {
    x = Math.max(0, Math.min(1, x));
    return Math.min(2.05, Math.pow(x, 0.68) * gain);
  }

  function setCommonUniforms(prog) {
    var vd = typeof S._visualDrive === 'number' ? S._visualDrive : 0;
    if (vd < 0) vd = 0;
    if (vd > 1) vd = 1;
    var audW = 0.12 + 0.88 * vd;
    var tSlow = 0.36 + 0.64 * vd;
    gl.uniform2f(u(prog, 'R'), S.FW, S.FH);
    var bv = typeof S.beatVisual === 'number' ? S.beatVisual : 0;
    var tr = typeof S.sTransient === 'number' ? S.sTransient : 0;
    var wig = (S.sBass * 0.078 + bv * 0.028 + S.sFlux * 0.032 + tr * 0.065) * (0.18 + 0.82 * vd);
    gl.uniform1f(u(prog, 'T'), S.GT * tSlow * (1 + wig));
    var Bd = shapeDrive(S.sBass, 1.84) * audW + bv * 0.28 * audW;
    gl.uniform1f(u(prog, 'B'), Bd);
    gl.uniform1f(u(prog, 'M'), shapeDrive(S.sMid, 1.72) * audW);
    gl.uniform1f(u(prog, 'H'), shapeDrive(S.sHigh, 1.78) * audW);
    gl.uniform1f(u(prog, 'V'), shapeDrive(S.sVol, 1.55) * audW);
    gl.uniform1f(u(prog, 'BT'), Math.min(1.22, (bv * 1.02 + S.sBass * 0.06) * audW));
    gl.uniform1f(u(prog, 'EX'), S.explode);
    gl.uniform1f(u(prog, 'SP'), (P.SPD / 5) * (0.34 + 0.66 * vd));
    gl.uniform1f(u(prog, 'WP'), (P.WRP / 5) * (0.4 + 0.6 * vd));
    gl.uniform1f(u(prog, 'PAL'), P.PAL);
    gl.uniform1f(u(prog, 'FL'), Math.min(1.35, (S.sFlux * 1.12 + bv * 0.16 + tr * 0.48) * audW));
    gl.uniform1f(u(prog, 'SC'), S.sCent);
    var bpm = typeof S.bpm === 'number' ? S.bpm : 0;
    gl.uniform1f(u(prog, 'BP'), Math.min(1, Math.max(0, bpm / 175)));
    gl.uniform1f(u(prog, 'PH'), typeof S.beatPhase === 'number' ? S.beatPhase : 0);
    gl.uniform1f(u(prog, 'BC'), typeof S.bpmConfidence === 'number' ? S.bpmConfidence : 0);
    var ld = 1;
    if (S.nexusVizPerformance) ld *= 0.62;
    else if (S.nexusPerfLock) ld *= 0.74;
    else if (S._emaFps < 34) ld *= 0.76;
    else if (S._emaFps < 46) ld *= 0.88;
    var scCur = NX.scenes && NX.scenes[S.curS];
    if (scCur && scCur.cost === 'high') {
      if (S._emaFps < 40) ld *= 0.9;
      if (S._emaFps < 30) ld *= 0.88;
    } else if (scCur && scCur.cost === 'med' && S._emaFps < 28) {
      ld *= 0.92;
    }
    gl.uniform1f(u(prog, 'LD'), Math.max(0.38, Math.min(1, ld)));
  }

  /* ---- Vertex shader (shared) -------------------------------------- */
  var VS = 'attribute vec2 pos;varying vec2 uv;void main(){uv=pos*.5+.5;gl_Position=vec4(pos,0,1);}';

  /* ---- Passthrough blit (when bloom/grade post chain missing or errors) */
  var BLIT_FALLBACK_FS = 'precision mediump float;varying vec2 uv;uniform sampler2D tex;void main(){gl_FragColor=texture2D(tex,uv);}';
  var blitFallbackProg = null;
  function blitTextureToCanvas(tex) {
    if (!tex) return;
    if (!blitFallbackProg) blitFallbackProg = mkProg(VS, BLIT_FALLBACK_FS);
    if (!blitFallbackProg) return;
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, Math.max(1, C.width | 0), Math.max(1, C.height | 0));
    gl.useProgram(blitFallbackProg);
    bindQuad(blitFallbackProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u(blitFallbackProg, 'tex'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---- Pre-warm uniform cache after programs are compiled ---------- */
  function prewarmCache(sceneProgs, postProgs) {
    var sn = ['R', 'T', 'B', 'M', 'H', 'V', 'BT', 'EX', 'SP', 'WP', 'PAL', 'FL', 'SC', 'MX', 'PV', 'AU', 'BP', 'PH', 'BC', 'LD'];
    sceneProgs.forEach(function (prog) { if (!prog) return; sn.forEach(function (n) { u(prog, n); }); });
    postProgs.forEach(function (prog) {
      if (!prog) return;
      ['tex', 'bloom', 'streak', 'thresh', 'dir', 'BT', 'T', 'B', 'M', 'H', 'FL', 'R', 'A', 'B2', 'mix2', 'BM', 'HS', 'KA', 'GL'].forEach(function (n) { u(prog, n); });
    });
  }

  /** Seconds between auto scene advances; scales with mic energy (slower when silent + mic off). */
  function getAutoMorphIntervalSec() {
    var base = S.presInterval;
    var me = typeof S.micEnergy === 'number' ? S.micEnergy : 0;
    if (!S.micOn && me < 0.02) return base * 1.48;
    if (S.micOn && me > 0.07) return base * 0.9;
    return base;
  }

  function tickAdaptiveFps(dt) {
    if (!S.adaptiveGpu) return;
    if (S.recording || S.presentMode) return;
    S._adaptiveTick += dt;
    if (S._adaptiveTick < 0.75) return;
    S._adaptiveTick = 0;
    var q = document.getElementById('qsel');
    var mode = q && q.value ? q.value : 'balanced';
    var downTh = 26;
    var upTh = 52;
    var stepDn = 0.06;
    var stepUp = 0.04;
    var minScale = 0.48;
    var maxScale = 0.92;
    if (mode === 'perf') {
      downTh = 28;
      upTh = 50;
      stepDn = 0.055;
      stepUp = 0.045;
      minScale = 0.44;
      maxScale = 0.82;
    } else if (mode === 'ultra') {
      downTh = 22;
      upTh = 54;
      stepDn = 0.04;
      stepUp = 0.03;
      minScale = 0.52;
      maxScale = 0.98;
    }
    if (S._emaFps < downTh) {
      S._adaptiveLowStreak++;
      S._adaptiveHighStreak = 0;
    } else if (S._emaFps > upTh) {
      S._adaptiveHighStreak++;
      S._adaptiveLowStreak = 0;
    } else {
      S._adaptiveLowStreak = Math.max(0, S._adaptiveLowStreak - 1);
      S._adaptiveHighStreak = Math.max(0, S._adaptiveHighStreak - 1);
    }
    if (S._adaptiveLowStreak >= 2 && renderScale > minScale) {
      applyRenderScaleOnly(renderScale - stepDn);
      S._adaptiveLowStreak = 0;
    } else if (S._adaptiveHighStreak >= 3 && renderScale < maxScale) {
      applyRenderScaleOnly(renderScale + stepUp);
      S._adaptiveHighStreak = 0;
    }
  }

  /* ---- Render one scene into FBO ----------------------------------- */
  /** If the active scene failed to compile, use the first successful program so the loop still composites. */
  function resolveSceneIndex() {
    var progs = NX.sceneProgs;
    if (!progs || !progs.length) return -1;
    var idx = S.curS | 0;
    if (idx >= 0 && idx < progs.length && progs[idx]) return idx;
    for (var i = 0; i < progs.length; i++) {
      if (progs[i]) {
        if (i !== idx) console.warn('NEXUS: no program for scene', idx, '— using scene', i);
        S.curS = i;
        return i;
      }
    }
    return -1;
  }

  function renderScene(idx, targetFBO, prevTex, w, h) {
    var prog = NX.sceneProgs[idx]; if (!prog) return;
    var rw = w || S.FW, rh = h || S.FH;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
    gl.viewport(0, 0, rw, rh);
    gl.useProgram(prog); bindQuad(prog);
    setCommonUniforms(prog);
    var mxL = u(prog, 'MX'); if (mxL) gl.uniform2f(mxL, S.mouseSmooth[0], S.mouseSmooth[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(u(prog, 'PV'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atex);
    gl.uniform1i(u(prog, 'AU'), 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---- Scene manager ----------------------------------------------- */
  function showName(idx) {
    if (!NX.scenes || !NX.scenes[idx]) return;
    if (NX.ui && NX.ui.showName) { NX.ui.showName(idx); return; }
    var n = document.getElementById('pname'), ni = document.getElementById('pidx');
    if (!n) return;
    n.textContent = NX.scenes[idx].n;
    ni.textContent = (idx + 1) + ' / ' + NX.scenes.length;
    var vpn = document.getElementById('vpn'); if (vpn) vpn.textContent = NX.scenes[idx].n;
    n.style.opacity = '1'; ni.style.opacity = '0.7';
    clearTimeout(n._t); n._t = setTimeout(function () { n.style.opacity = '0'; ni.style.opacity = '0'; }, 3000);
  }

  function goNext(idx) {
    if (S.morphing) return;
    var len = NX.scenes.length;
    S.nxtS = (idx !== undefined) ? ((idx + len) % len) : ((S.curS + 1) % len);
    if (S.nxtS === S.curS) S.nxtS = (S.curS + 1) % len;
    S.morphing = true; S.morphBlend = 0; S.presTimer = 0; S._morphFrame = 0;
    S._activeMorphDur = S.morphDurationSec;
    var scA = NX.scenes[S.curS], scB = NX.scenes[S.nxtS];
    if (scA && scB && scA.cost === 'high' && scB.cost === 'high') S._activeMorphDur *= 1.35;
    [fbB[0].f, fbB[1].f].forEach(function (f) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    });
    pingB = 0; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    showName(S.nxtS);
    if (NX.ui && NX.ui.setActiveScene) NX.ui.setActiveScene(S.nxtS);
  }
  function goPrev() { goNext((S.curS - 1 + NX.scenes.length) % NX.scenes.length); }
  function sceneTagWeight(i, driveHot, energy) {
    var sc = NX.scenes[i];
    if (!sc || !sc.tags) return 1;
    var w = 1;
    var macro = S.visualMacro || '';
    if (macro === 'club') {
      if (sc.tags.indexOf('intense') >= 0) w += 0.95;
      if (sc.tags.indexOf('tunnel') >= 0) w += 0.45;
      if (driveHot && sc.rx > 0) w += sc.rx * 0.5;
    } else if (macro === 'ambient') {
      if (sc.tags.indexOf('calm') >= 0) w += 1.15;
      w += sc.cost === 'high' ? -0.35 : 0.15;
    } else if (macro === 'psychedelic') {
      if (sc.tags.indexOf('fractal') >= 0) w += 1.1;
      if (sc.tags.indexOf('sacred') >= 0) w += 0.65;
      if (sc.tags.indexOf('tunnel') >= 0) w += 0.35;
    }
    if (S.nexusVizPerformance && sc.cost === 'high') w *= 0.35;
    else if (S.nexusVizPerformance && sc.cost === 'low') w *= 1.25;
    if (energy > 0.35 && sc.tags.indexOf('intense') >= 0) w += 0.4;
    if (energy < 0.18 && sc.tags.indexOf('calm') >= 0) w += 0.55;
    var rx = typeof sc.rx === 'number' ? sc.rx : 0;
    w += driveHot && rx > 0 ? rx * 0.85 : 0;
    return Math.max(0.08, w);
  }

  function goRandom() {
    var n = NX.scenes.length;
    if (n < 2) return;
    var driveHot = S.micOn && (typeof S._visualDrive === 'number' ? S._visualDrive : 0) > 0.42;
    var energy = S.sBass * 0.45 + S.sMid * 0.28 + S.sFlux * 0.22;
    var weights = [];
    var tw = 0;
    for (var i = 0; i < n; i++) {
      var w = sceneTagWeight(i, driveHot, energy);
      weights.push(w);
      tw += w;
    }
    var r = S.curS;
    for (var attempt = 0; attempt < 24 && r === S.curS; attempt++) {
      var pick = Math.random() * tw;
      var acc = 0;
      for (var j = 0; j < n; j++) {
        acc += weights[j];
        if (pick < acc) { r = j; break; }
      }
    }
    if (r === S.curS) r = (S.curS + 1) % n;
    goNext(r);
  }

  /* ---- Main loop --------------------------------------------------- */
  var _lastTime = performance.now();

  function loop(now) {
    requestAnimationFrame(loop);
    if (!now) now = performance.now();
    var dt = Math.min((now - _lastTime) / 1000, 0.05);
    if (dt <= 0 || dt > 0.05) dt = 0.016;
    _lastTime = now;

    S.GT += dt * 5 * (P.SPD / 5); S.frame++;
    var instFps = 1 / Math.max(dt, 0.001);
    S._emaFps += 0.15 * (instFps - S._emaFps);
    tickAdaptiveFps(dt);
    if (NX.audio && NX.audio.tick) NX.audio.tick();
    var mxAlpha = S._iosCoarsePointer ? 0.11 : 0.05;
    S.mouseSmooth[0] += (S.mouseRaw[0] - S.mouseSmooth[0]) * mxAlpha;
    S.mouseSmooth[1] += (S.mouseRaw[1] - S.mouseSmooth[1]) * mxAlpha;
    /* FBOs are created in resize(); recover even when innerWidth is 0 (iframe / devtools) — resize() uses clientWidth fallbacks. */
    if (!fbA[0] || !fbB[0]) {
      try { resize(); } catch (eFb) { /* ignore */ }
      if (!fbA[0] || !fbB[0]) return;
    }

    /* Other modules share no GL state with us, but reset common pitfalls so fullscreen passes always draw. */
    try {
      gl.disable(gl.DEPTH_TEST);
      if (typeof gl.STENCIL_TEST === 'number') gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.colorMask(true, true, true, true);
    } catch (eGlState) { /* rare: invalid enum on minimal GL */ }

    if (NX.ui && NX.ui.tickHud) NX.ui.tickHud(S);
    if (NX.demo && NX.demo.tick) NX.demo.tick();
    if (NX.autoDirector && NX.autoDirector.tick) NX.autoDirector.tick(dt);
    if (NX.watermark && NX.watermark.tick) NX.watermark.tick();
    if (window.NexusEngine && NexusEngine.update) NexusEngine.update(dt);

    if (S.autoMorph) {
      S.presTimer += dt;
      if (S.presTimer >= getAutoMorphIntervalSec() && !S.morphing) goNext();
    }
    if (S.morphing) {
      var spdBoost = Math.max(0.35, P.SPD / 5);
      var mdur = typeof S._activeMorphDur === 'number' ? S._activeMorphDur : S.morphDurationSec;
      S.morphBlend += dt / (mdur / spdBoost);
      S._morphFrame++;
      if (S.morphBlend >= 1) { S.morphBlend = 1; S.morphing = false; S.curS = S.nxtS; S._activeMorphDur = null; }
    }

    var hw = Math.max(1, Math.floor(S.FW / 2)), hh = Math.max(1, Math.floor(S.FH / 2));

    var drawShader = !NX.SceneManager || NX.SceneManager.shouldRenderShader();
    if (drawShader) {
      var sceneIdx = resolveSceneIndex();
      if (sceneIdx >= 0) {
        renderScene(sceneIdx, fbA[1 - pingA].f, fbA[pingA].t);
        pingA = 1 - pingA;
      }
    }
    var curOut = fbA[pingA] ? fbA[pingA].t : null;
    var finalTex = curOut;

    if (drawShader && S.morphing && NX.postProgs.blend) {
      if (S._morphFrame % 2 === 1) { renderScene(S.nxtS, fbB[1 - pingB].f, fbB[pingB].t, hw, hh); pingB = 1 - pingB; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbMorph.f); gl.viewport(0, 0, S.FW, S.FH);
      gl.useProgram(NX.postProgs.blend); bindQuad(NX.postProgs.blend);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, curOut); gl.uniform1i(u(NX.postProgs.blend, 'A'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbB[pingB].t); gl.uniform1i(u(NX.postProgs.blend, 'B2'), 1);
      gl.uniform1f(u(NX.postProgs.blend, 'mix2'), S.morphBlend);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      finalTex = fbMorph.t;
    }

    var postReady = !!(drawShader && finalTex && NX.post && NX.post.render && NX.postProgs && NX.postProgs.out && NX.postProgs.copy);
    if (postReady) {
      try {
        NX.post.render(finalTex, fbBloom, fbBloomBlur, hw, hh);
      } catch (ePost) {
        console.warn('NEXUS post.render failed — blitting scene FBO', ePost);
        blitTextureToCanvas(finalTex);
      }
    } else if (drawShader && finalTex) {
      /* Missing or partial post compile: still show raw scene texture. */
      blitTextureToCanvas(finalTex);
    } else if (!drawShader) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, C.width, C.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    if (window.NexusEngine && NexusEngine.renderButterchurnLayer) NexusEngine.renderButterchurnLayer();

    if (NX.WgslGraph && NX.WgslGraph.renderFrame) {
      try {
        NX.WgslGraph.renderFrame();
      } catch (eW) {
        /* iOS / partial WebGPU: never let WGSL compositor kill the main rAF loop */
        if (NX.WgslGraph.setEnabled) NX.WgslGraph.setEnabled(false);
      }
    }

    if (S.recording && S.recCompositeDims) {
      var rc = document.getElementById('c-rec');
      if (rc) {
        var x2d = rc.getContext('2d');
        var d = S.recCompositeDims;
        if (rc.width !== d.w || rc.height !== d.h) { rc.width = d.w; rc.height = d.h; }
        if (S.recAmbientUnderlay) {
          var gx = x2d.createLinearGradient(0, 0, d.w * 0.72, d.h * 0.92);
          gx.addColorStop(0, '#060618');
          gx.addColorStop(0.42, '#10122a');
          gx.addColorStop(1, '#020208');
          x2d.fillStyle = gx;
        } else {
          x2d.fillStyle = '#000';
        }
        x2d.fillRect(0, 0, d.w, d.h);
        var vm = S.visualMode || 'shader';
        if (vm !== 'shader') {
          var cbc = document.getElementById('c-bc');
          if (cbc) try { x2d.drawImage(cbc, 0, 0, d.w, d.h); } catch (eR) { }
        }
        if (NX.ClipLayers && NX.ClipLayers.drawForRecording) {
          NX.ClipLayers.drawForRecording(x2d, d.w, d.h, true);
        }
        var wgpuOn = S.wgpuGraphEnabled && NX.WgslGraph && NX.WgslGraph.isReady && NX.WgslGraph.isReady();
        var wgc = document.getElementById('nx-wgpu');
        var mainLayer = C;
        if (wgpuOn && wgc) mainLayer = wgc;
        try { x2d.drawImage(mainLayer, 0, 0, d.w, d.h); } catch (eR2) { }
        if (NX.ClipLayers && NX.ClipLayers.drawForRecording) {
          NX.ClipLayers.drawForRecording(x2d, d.w, d.h, false);
        }
      }
    }
  }

  /* ---- Pointer / touch → MX (canvas bounds; no document touchmove — keeps panel scroll on iOS) */
  function pointerToNorm(clientX, clientY, el) {
    var rect = el.getBoundingClientRect();
    var rw = rect.width;
    var rh = rect.height;
    if (rw < 4 || rh < 4) return;
    var nx = (clientX - rect.left) / rw * 2 - 1;
    var ny = -((clientY - rect.top) / rh * 2 - 1);
    S.mouseRaw[0] = nx < -1 ? -1 : (nx > 1 ? 1 : nx);
    S.mouseRaw[1] = ny < -1 ? -1 : (ny > 1 ? 1 : ny);
  }

  document.addEventListener('mousemove', function (e) {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    pointerToNorm(e.clientX, e.clientY, C);
  }, { passive: true });

  if (window.PointerEvent) {
    C.addEventListener('pointerdown', function (e) {
      pointerToNorm(e.clientX, e.clientY, C);
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        try { C.setPointerCapture(e.pointerId); } catch (err) { }
      }
    }, { passive: true });
    C.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse') return;
      pointerToNorm(e.clientX, e.clientY, C);
    }, { passive: true });
    C.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        try { C.releasePointerCapture(e.pointerId); } catch (err2) { }
      }
    }, { passive: true });
    C.addEventListener('pointercancel', function (e) {
      try { C.releasePointerCapture(e.pointerId); } catch (err3) { }
    }, { passive: true });
  } else {
    function legacyCanvasTouch(ev) {
      if (!ev.touches || ev.touches.length !== 1) return;
      var t = ev.touches[0];
      pointerToNorm(t.clientX, t.clientY, C);
      if (ev.type === 'touchmove') ev.preventDefault();
    }
    C.addEventListener('touchstart', legacyCanvasTouch, { passive: true });
    C.addEventListener('touchmove', legacyCanvasTouch, { passive: false });
  }

  /* ---- Public API -------------------------------------------------- */
  NX.gl = gl;
  NX.C = C;
  NX.S = S;
  NX.P = P;
  NX.VS = VS;
  NX.abuf = abuf;
  NX.atex = atex;
  NX.sceneProgs = [];
  NX.postProgs = {};
  NX.scenes = [];
  NX.mkProg = mkProg;
  NX.mkRT = mkRT;
  NX.u = u;
  NX.bindQuad = bindQuad;
  NX.shapeDrive = shapeDrive;
  NX.setCommonUniforms = setCommonUniforms;
  NX.prewarmCache = prewarmCache;
  NX.resize = resize;
  NX.setQualityPreset = setQualityPreset;
  NX.getRenderScale = getRenderScale;
  NX.applyRenderScaleOnly = applyRenderScaleOnly;
  NX.goNext = goNext;
  NX.goPrev = goPrev;
  NX.goRandom = goRandom;
  NX.showName = showName;
  NX.loop = loop;
  NX.getAutoMorphIntervalSec = getAutoMorphIntervalSec;

  var _vizPerfOwnedLock = false;
  /**
   * Live “visual performance” preset: favors stable FPS (does not change quality dropdown).
   * @param {boolean} on
   */
  function setVizPerformanceMode(on) {
    if (on) {
      S.nexusVizPerformance = true;
      if (!S.nexusPerfLock) {
        S.nexusPerfLock = true;
        _vizPerfOwnedLock = true;
      }
      if (S.nexusPostTrails > 0.06) S.nexusPostTrails = 0.06;
      if (S.postBloomMul > 1) S.postBloomMul = Math.min(S.postBloomMul, 0.98);
      resize();
    } else {
      S.nexusVizPerformance = false;
      if (_vizPerfOwnedLock) {
        S.nexusPerfLock = false;
        _vizPerfOwnedLock = false;
      }
      resize();
    }
  }

  NX.setVizPerformanceMode = setVizPerformanceMode;

  /* First paint: window "resize" does not always fire on load; without this, fbA stays null → black canvas. */
  try {
    resize();
  } catch (eInit) {
    console.warn('NEXUS: initial resize failed', eInit);
  }
  requestAnimationFrame(function () {
    try { resize(); } catch (eRaf) { }
  });
})();
