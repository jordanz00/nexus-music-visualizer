'use strict';
/*  engine.js — WebGL context, FBO pipeline, uniform cache, render loop.
    Establishes the NX namespace used by every other module.             */

window.NX = window.NX || {};

(function () {
  var C = document.getElementById('c');
  var gl = C.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
    || C.getContext('experimental-webgl', { antialias: false, alpha: false });
  if (!gl) { alert('WebGL required — use Chrome, Edge, or Safari.'); throw 0; }
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
    audioCtx: null, micStream: null, gainNode: null, curDev: '',
    _emaFps: 60, _adaptiveTick: 0,
    curS: 0, nxtS: 1, morphing: false, morphBlend: 0,
    autoMorph: true, presTimer: 0, presInterval: 20, _morphFrame: 0,
    morphDurationSec: 1.4, showFpsOverlay: false, presentMode: false,
    adaptiveGpu: false, uiHide: false, recording: false,
    /* Nexus Engine — hybrid Butterchurn + shader */
    visualMode: 'shader',
    nexusPerfLock: false,
    nexusPostBloom: true,
    nexusPostTrails: 0,
    postBloomMul: 1,
    hueShift: 0,
    bcIntensity: 1,
    bcSpeed: 1,
    /** When set, main loop composites layers into #c-rec for export resolution */
    recCompositeDims: null,
    /** Last Butterchurn preset filename/key (for HUD + morph conductor) */
    bcLastPresetKey: ''
  };
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    S.morphDurationSec = Math.min(S.morphDurationSec, 0.85);
    S.presInterval = Math.max(S.presInterval, 38);
  }

  var P = { SPD: 5, RCT: 7, WRP: 5, PAL: 0, GAIN: 1.0, SMTH: 58 };

  /* ---- canvas / resize --------------------------------------------- */
  var rawW = 0, rawH = 0, maxDpr = 2, renderScale = 0.78, pendingRenderScale = null;

  function resize() {
    var capDpr = S.nexusPerfLock ? Math.min(maxDpr, 1) : maxDpr;
    var dpr = Math.min(window.devicePixelRatio || 1, capDpr);
    S.W = innerWidth; S.H = innerHeight;
    C.width = Math.floor(S.W * dpr); C.height = Math.floor(S.H * dpr);
    C.style.width = S.W + 'px'; C.style.height = S.H + 'px';
    rawW = C.width; rawH = C.height;
    if (pendingRenderScale != null) { renderScale = pendingRenderScale; pendingRenderScale = null; }
    var effScale = S.nexusPerfLock ? Math.min(renderScale, 0.56) : renderScale;
    S.FW = Math.max(1, Math.floor(rawW * effScale));
    S.FH = Math.max(1, Math.floor(rawH * effScale));
    gl.viewport(0, 0, S.FW, S.FH);
    rebuildFBOs();
    if (NX.VisualEngineManager && NX.VisualEngineManager.resize) NX.VisualEngineManager.resize();
  }
  addEventListener('resize', resize);

  function applyRenderScaleOnly(next) {
    next = Math.max(0.42, Math.min(1, next));
    if (Math.abs(next - renderScale) < 0.02) return;
    renderScale = next; rebuildFBOs();
  }
  function setQualityPreset(mode) {
    if (mode === 'perf') { maxDpr = 1.25; pendingRenderScale = 0.52; }
    else if (mode === 'ultra') { maxDpr = 2; pendingRenderScale = 1; }
    else { maxDpr = 2; pendingRenderScale = 0.78; }
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
    gl.uniform2f(u(prog, 'R'), S.FW, S.FH);
    var bv = typeof S.beatVisual === 'number' ? S.beatVisual : 0;
    gl.uniform1f(u(prog, 'T'), S.GT * (1 + S.sBass * 0.078 + bv * 0.028 + S.sFlux * 0.032));
    var Bd = shapeDrive(S.sBass, 1.84) + bv * 0.28;
    gl.uniform1f(u(prog, 'B'), Bd);
    gl.uniform1f(u(prog, 'M'), shapeDrive(S.sMid, 1.72));
    gl.uniform1f(u(prog, 'H'), shapeDrive(S.sHigh, 1.78));
    gl.uniform1f(u(prog, 'V'), shapeDrive(S.sVol, 1.55));
    gl.uniform1f(u(prog, 'BT'), Math.min(1.22, bv * 1.02 + S.sBass * 0.06));
    gl.uniform1f(u(prog, 'EX'), S.explode);
    gl.uniform1f(u(prog, 'SP'), P.SPD / 5); gl.uniform1f(u(prog, 'WP'), P.WRP / 5);
    gl.uniform1f(u(prog, 'PAL'), P.PAL);
    gl.uniform1f(u(prog, 'FL'), Math.min(1.22, S.sFlux * 1.08 + bv * 0.16));
    gl.uniform1f(u(prog, 'SC'), S.sCent);
  }

  /* ---- Vertex shader (shared) -------------------------------------- */
  var VS = 'attribute vec2 pos;varying vec2 uv;void main(){uv=pos*.5+.5;gl_Position=vec4(pos,0,1);}';

  /* ---- Pre-warm uniform cache after programs are compiled ---------- */
  function prewarmCache(sceneProgs, postProgs) {
    var sn = ['R', 'T', 'B', 'M', 'H', 'V', 'BT', 'EX', 'SP', 'WP', 'PAL', 'FL', 'SC', 'MX', 'PV', 'AU'];
    sceneProgs.forEach(function (prog) { if (!prog) return; sn.forEach(function (n) { u(prog, n); }); });
    postProgs.forEach(function (prog) {
      if (!prog) return;
      ['tex', 'bloom', 'thresh', 'dir', 'BT', 'T', 'B', 'M', 'H', 'FL', 'R', 'A', 'B2', 'mix2'].forEach(function (n) { u(prog, n); });
    });
  }

  function tickAdaptiveFps(dt) {
    if (!S.adaptiveGpu) return;
    S._adaptiveTick += dt;
    if (S._adaptiveTick < 0.75) return;
    S._adaptiveTick = 0;
    var q = document.getElementById('qsel');
    if (q && q.value !== 'balanced') return;
    if (S._emaFps < 26 && renderScale > 0.48) applyRenderScaleOnly(renderScale - 0.06);
    else if (S._emaFps > 52 && renderScale < 0.92) applyRenderScaleOnly(renderScale + 0.04);
  }

  /* ---- Render one scene into FBO ----------------------------------- */
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
    [fbB[0].f, fbB[1].f].forEach(function (f) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    });
    pingB = 0; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    showName(S.nxtS);
    if (NX.ui && NX.ui.setActiveScene) NX.ui.setActiveScene(S.nxtS);
  }
  function goPrev() { goNext((S.curS - 1 + NX.scenes.length) % NX.scenes.length); }
  function goRandom() {
    var r = Math.floor(Math.random() * NX.scenes.length);
    while (r === S.curS) r = Math.floor(Math.random() * NX.scenes.length);
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
    S.mouseSmooth[0] += (S.mouseRaw[0] - S.mouseSmooth[0]) * 0.05;
    S.mouseSmooth[1] += (S.mouseRaw[1] - S.mouseSmooth[1]) * 0.05;
    if (!fbA[0] || !fbB[0]) return;

    if (NX.ui && NX.ui.tickHud) NX.ui.tickHud(S);
    if (NX.demo && NX.demo.tick) NX.demo.tick();
    if (NX.autoDirector && NX.autoDirector.tick) NX.autoDirector.tick(dt);
    if (NX.watermark && NX.watermark.tick) NX.watermark.tick();
    if (window.NexusEngine && NexusEngine.update) NexusEngine.update(dt);

    if (S.autoMorph) {
      S.presTimer += dt;
      if (S.presTimer >= S.presInterval && !S.morphing) goNext();
    }
    if (S.morphing) {
      var spdBoost = Math.max(0.35, P.SPD / 5);
      S.morphBlend += dt / (S.morphDurationSec / spdBoost);
      S._morphFrame++;
      if (S.morphBlend >= 1) { S.morphBlend = 1; S.morphing = false; S.curS = S.nxtS; }
    }

    var hw = Math.max(1, Math.floor(S.FW / 2)), hh = Math.max(1, Math.floor(S.FH / 2));

    var drawShader = !NX.SceneManager || NX.SceneManager.shouldRenderShader();
    if (drawShader) {
      renderScene(S.curS, fbA[1 - pingA].f, fbA[pingA].t);
      pingA = 1 - pingA;
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

    if (drawShader && NX.post && NX.post.render) {
      NX.post.render(finalTex, fbBloom, fbBloomBlur, hw, hh);
    } else if (!drawShader) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, C.width, C.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    if (window.NexusEngine && NexusEngine.renderButterchurnLayer) NexusEngine.renderButterchurnLayer();

    if (S.recording && S.recCompositeDims) {
      var rc = document.getElementById('c-rec');
      if (rc) {
        var x2d = rc.getContext('2d');
        var d = S.recCompositeDims;
        if (rc.width !== d.w || rc.height !== d.h) { rc.width = d.w; rc.height = d.h; }
        x2d.fillStyle = '#000';
        x2d.fillRect(0, 0, d.w, d.h);
        var vm = S.visualMode || 'shader';
        if (vm !== 'shader') {
          var cbc = document.getElementById('c-bc');
          if (cbc) try { x2d.drawImage(cbc, 0, 0, d.w, d.h); } catch (eR) { }
        }
        try { x2d.drawImage(C, 0, 0, d.w, d.h); } catch (eR2) { }
      }
    }
  }

  /* ---- Mouse / touch ----------------------------------------------- */
  document.addEventListener('mousemove', function (e) { S.mouseRaw[0] = e.clientX / innerWidth * 2 - 1; S.mouseRaw[1] = -(e.clientY / innerHeight * 2 - 1); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); var t = e.touches[0]; S.mouseRaw[0] = t.clientX / innerWidth * 2 - 1; S.mouseRaw[1] = -(t.clientY / innerHeight * 2 - 1); }, { passive: false });

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
})();
