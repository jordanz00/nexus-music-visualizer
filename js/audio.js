'use strict';
/*  audio.js — Microphone → analyser → band levels, spectral flux, beat/BPM,
    Butterchurn gate. No synthetic audio: meters and AU texture follow the mic only. */

(function () {
  var S = NX.S, P = NX.P, gl = NX.gl, abuf = NX.abuf, atex = NX.atex;

  /** RMS of time-domain analyser buffer (0–1). */
  function rmsWave8(w) {
    if (!w || !w.length) return 0;
    var acc = 0;
    for (var i = 0; i < w.length; i++) {
      var v = (w[i] - 128) / 128;
      acc += v * v;
    }
    return Math.sqrt(acc / w.length);
  }

  /** Sub-bass average 0–1 — used as noise floor for subtraction. */
  function noiseFloor01(freqArr, i1) {
    if (i1 < 1) return 0;
    var sum = 0;
    for (var i = 0; i < i1; i++) sum += freqArr[i];
    var nf = sum / (i1 * 255);
    return Math.min(0.22, Math.max(0, nf));
  }

  /**
   * Map normalized band energy (0–1) to display level after floor + input gain.
   * Gain slider (P.GAIN) is the primary control for meter sensitivity.
   */
  function levelFromRaw(raw, nf, gain) {
    var den = Math.max(0.07, 1 - nf);
    var x = (raw - nf * 0.92) / den;
    if (x < 0) x = 0;
    return Math.min(1, x * gain * 2.35);
  }

  function dampAudioState(k) {
    S.sBass += (0 - S.sBass) * k;
    S.sLowMid += (0 - S.sLowMid) * k;
    S.sMid += (0 - S.sMid) * k;
    S.sHigh += (0 - S.sHigh) * k;
    S.sVol += (0 - S.sVol) * k;
    S.sFlux += (0 - S.sFlux) * k;
    S.sCent += (0.35 - S.sCent) * 0.14;
    S.prevMbRaw = 0;
  }

  function silenceAudioTexture() {
    for (var i = 0; i < 256; i++) abuf[i] = 0;
    for (var i = 0; i < 256; i++) abuf[256 + i] = 128;
  }

  /** 0–1: scales shader speed / warp / post so idle = calm, loud = full motion. */
  function syncVisualDrive() {
    var cur = typeof S._visualDrive === 'number' ? S._visualDrive : 0;
    var tgt = 0;
    if (S.analyser && S.micOn) {
      tgt = Math.min(1,
        (S.micEnergy || 0) * 1.02 +
        (S.sVol || 0) * 1.12 +
        (S.sBass || 0) * 0.42 +
        (S.sFlux || 0) * 0.22
      );
      if (tgt < 0.05) tgt = 0;
    }
    var r = tgt > cur ? 0.26 : 0.072;
    S._visualDrive = cur + (tgt - cur) * r;
  }

  /**
   * Minimal Web Audio graph for Butterchurn (no mic). No input → silence.
   */
  async function ensureButterchurnAudioGraph() {
    if (S.audioCtx && S.gainNode && S.analyser) {
      if (S.audioCtx.state === 'suspended') { try { await S.audioCtx.resume(); } catch (e) { } }
      return;
    }
    S.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100, latencyHint: 'interactive' });
    if (S.audioCtx.state === 'suspended') { try { await S.audioCtx.resume(); } catch (e) { } }
    S.gainNode = S.audioCtx.createGain();
    S.gainNode.gain.value = P.GAIN;
    S.bcGateNode = S.audioCtx.createGain();
    S.bcGateNode.gain.value = 0;
    S.analyser = S.audioCtx.createAnalyser();
    S.analyser.fftSize = 2048;
    S.analyser.smoothingTimeConstant = P.SMTH / 100;
    S.analyser.minDecibels = -90;
    S.analyser.maxDecibels = -22;
    S.bufLen = S.analyser.frequencyBinCount;
    S.waveArr = new Uint8Array(S.bufLen);
    S.freqArr = new Uint8Array(S.bufLen);
    S.prevFreqFlux = new Uint8Array(S.bufLen);
    S.gainNode.connect(S.analyser);
    S.gainNode.connect(S.bcGateNode);
    S.micOn = false;
    S._bcGateOpen = 0;
    S.micEnergy = 0;
    if (NX.VisualEngineManager && NX.VisualEngineManager.isReady()) NX.VisualEngineManager.connectAudio();
  }

  async function resumeAudioContext() {
    if (S.audioCtx && S.audioCtx.state === 'suspended') {
      try { await S.audioCtx.resume(); } catch (e) { }
    }
  }

  async function primeForButterchurn() {
    if (S.audioCtx && S.gainNode && S.analyser) {
      await resumeAudioContext();
      return;
    }
    try {
      await startMic(S.curDev || '');
    } catch (e) { /* denied / unavailable */ }
    if (S.audioCtx && S.gainNode && S.analyser) {
      await resumeAudioContext();
      return;
    }
    await ensureButterchurnAudioGraph();
  }

  async function startMic(devId) {
    try {
      if (S.micStream) S.micStream.getTracks().forEach(function (t) { t.stop(); });
      if (S.audioCtx) { try { await S.audioCtx.close(); } catch (e) { } }
      S.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100, latencyHint: 'interactive' });
      if (S.audioCtx.state === 'suspended') await S.audioCtx.resume();
      var c = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
      if (devId && devId !== '') c.audio.deviceId = { exact: devId };
      S.micStream = await navigator.mediaDevices.getUserMedia(c);
      var src = S.audioCtx.createMediaStreamSource(S.micStream);
      S.gainNode = S.audioCtx.createGain();
      S.gainNode.gain.value = P.GAIN;
      S.bcGateNode = S.audioCtx.createGain();
      S.bcGateNode.gain.value = 0;
      S.analyser = S.audioCtx.createAnalyser();
      S.analyser.fftSize = 2048;
      S.analyser.smoothingTimeConstant = P.SMTH / 100;
      S.analyser.minDecibels = -90;
      S.analyser.maxDecibels = -22;
      S.bufLen = S.analyser.frequencyBinCount;
      S.waveArr = new Uint8Array(S.bufLen);
      S.freqArr = new Uint8Array(S.bufLen);
      S.prevFreqFlux = new Uint8Array(S.bufLen);
      src.connect(S.gainNode);
      S.gainNode.connect(S.analyser);
      S.gainNode.connect(S.bcGateNode);
      S.micOn = true;
      S.curDev = devId || '';
      S._bcGateOpen = 0;
      var db = document.getElementById('db');
      if (db) db.classList.add('h');
      await enumDevices();
      if (NX.VisualEngineManager && NX.VisualEngineManager.isReady()) NX.VisualEngineManager.connectAudio();
    } catch (e) {
      console.warn('Mic failed:', e.message);
    }
  }

  async function stopMic() {
    if (S.micStream) { S.micStream.getTracks().forEach(function (t) { t.stop(); }); S.micStream = null; }
    if (S.audioCtx) { try { await S.audioCtx.close(); } catch (e) { } S.audioCtx = null; }
    S.analyser = null; S.gainNode = null; S.bcGateNode = null; S.micOn = false; S.prevFreqFlux = null;
    S._bcGateOpen = 0; S.micEnergy = 0;
    if (NX.VisualEngineManager) NX.VisualEngineManager.disconnectAudio();
    var db = document.getElementById('db');
    if (db) db.classList.remove('h');
  }

  function toggleMic() { if (S.micOn) stopMic(); else startMic(S.curDev); }

  async function enumDevices() {
    try {
      var d = await navigator.mediaDevices.enumerateDevices();
      var s = document.getElementById('devsel');
      if (!s) return;
      s.innerHTML = '<option value="">Default Microphone</option>';
      d.filter(function (x) { return x.kind === 'audioinput'; }).forEach(function (x, i) {
        var o = document.createElement('option');
        o.value = x.deviceId;
        o.textContent = x.label || ('Microphone ' + (i + 1));
        if (x.deviceId === S.curDev) o.selected = true;
        s.appendChild(o);
      });
    } catch (e) { }
  }

  function tick() {
    var nowA = performance.now();
    var adt = Math.min(0.055, S._lastAudT ? ((nowA - S._lastAudT) / 1000) : 0.016);
    S._lastAudT = nowA;

    if (!S.analyser) {
      dampAudioState(0.35);
      S.micEnergy = 0;
      S._bcGateOpen = 0;
      silenceAudioTexture();
      S.beat = Math.max(0, S.beat - adt * 2.65);
      if (S.explode > 0) S.explode = Math.max(0, S.explode - adt * 2.2);
      var bv0 = typeof S.beatVisual === 'number' ? S.beatVisual : 0;
      var tau0 = 0.42;
      var alpha0 = 1 - Math.exp(-Math.min(adt * 2.5, 0.35) / tau0);
      S.beatVisual = bv0 + (Math.min(0.92, S.beat * 0.52 + S.sBass * 0.1) - bv0) * alpha0;
      S.prevBass = S.sBass;
      syncVisualDrive();
      gl.bindTexture(gl.TEXTURE_2D, atex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, abuf);
      return;
    }

    S.analyser.smoothingTimeConstant = P.SMTH / 100;
    S.analyser.getByteFrequencyData(S.freqArr);
    S.analyser.getByteTimeDomainData(S.waveArr);
    if (!S.prevFreqFlux || S.prevFreqFlux.length !== S.bufLen) S.prevFreqFlux = new Uint8Array(S.bufLen);

    var i1 = Math.floor(S.bufLen * 0.02), i2 = Math.floor(S.bufLen * 0.08), i2b = Math.floor(S.bufLen * 0.14);
    var i3 = Math.floor(S.bufLen * 0.32), i4 = Math.floor(S.bufLen * 0.72);
    var iLm1 = Math.floor((i2 + i3) * 0.5);

    if (!S.micOn) {
      for (var sync = 2; sync < S.bufLen; sync++) S.prevFreqFlux[sync] = S.freqArr[sync];
      dampAudioState(0.34);
      S.micEnergy = 0;
      S._bcGateOpen = 0;
      if (S.bcGateNode) S.bcGateNode.gain.value = 0;
      silenceAudioTexture();
    } else {
      var fluxRaw = 0;
      for (var fi = 2; fi < S.bufLen; fi++) {
        var d = S.freqArr[fi] - S.prevFreqFlux[fi];
        if (d > 0) fluxRaw += d;
        S.prevFreqFlux[fi] = S.freqArr[fi];
      }
      S.sFlux += (Math.min(1, fluxRaw / (S.bufLen * 0.42)) - S.sFlux) * 0.52;

      var bv = 0, bv2 = 0, lmv = 0, mv = 0, hv = 0, vv = 0;
      for (var i = i1; i < i2; i++) bv += S.freqArr[i];
      for (var i = i2; i < i2b; i++) bv2 += S.freqArr[i];
      for (var i = i2b; i < iLm1; i++) lmv += S.freqArr[i];
      for (var i = i2; i < i3; i++) mv += S.freqArr[i];
      for (var i = i3; i < i4; i++) hv += S.freqArr[i];
      for (var i = 0; i < i4; i++) vv += S.freqArr[i];

      var cNum = 0, cDen = 1;
      for (var ci = i2; ci < i4; ci++) { cNum += S.freqArr[ci] * ci; cDen += S.freqArr[ci]; }
      S.sCent += (((cNum / Math.max(1, cDen)) / S.bufLen) - S.sCent) * 0.28;

      var nf = noiseFloor01(S.freqArr, i1);
      var g = P.GAIN;

      var rawBass = bv / ((i2 - i1) * 255);
      var rawBass2 = bv2 / ((i2b - i2) * 255 || 1);
      var mb = Math.max(levelFromRaw(rawBass, nf, g), levelFromRaw(rawBass2, nf, g * 0.72));
      var mm = levelFromRaw(mv / ((i3 - i2) * 255), nf, g * 0.95);
      var mlm = levelFromRaw(lmv / (Math.max(1, (iLm1 - i2b)) * 255), nf, g * 0.92);
      var mh = levelFromRaw(hv / ((i4 - i3) * 255), nf, g * 0.9);
      var mv2 = levelFromRaw(vv / (i4 * 255), nf, g * 0.88);

      var rmsW = rmsWave8(S.waveArr);
      if (rmsW < 0.0035) {
        var squash = rmsW / 0.0035;
        mb *= squash; mm *= squash; mlm *= squash; mh *= squash; mv2 *= squash;
      }

      var atk = mb - S.prevMbRaw;
      S.prevMbRaw = mb;
      if (atk > 0.14 && mb > 0.12) S.beat = Math.max(S.beat, 0.92);
      if (atk > 0.22 && mb > 0.22) S.beat = Math.max(S.beat, 1.12);

      var att = 0.52, rel = 0.3;
      S.sBass += (mb - S.sBass) * (mb > S.sBass ? att : rel);
      S.sLowMid += (mlm - S.sLowMid) * (mlm > S.sLowMid ? 0.48 : 0.28);
      S.sMid += (mm - S.sMid) * (mm > S.sMid ? 0.48 : 0.28);
      S.sHigh += (mh - S.sHigh) * (mh > S.sHigh ? 0.46 : 0.26);
      S.sVol += (mv2 - S.sVol) * (mv2 > S.sVol ? 0.46 : 0.26);

      S.micEnergy = Math.min(1, mb * 0.5 + mm * 0.24 + mh * 0.11 + mv2 * 0.36);
      var rFloor = 0.0055, rSpan = 0.07;
      var linG = (rmsW - rFloor) / rSpan;
      if (linG < 0) linG = 0; else if (linG > 1) linG = 1;
      var tgtGate = Math.pow(linG, 0.72);
      var go = typeof S._bcGateOpen === 'number' ? S._bcGateOpen : 0;
      if (tgtGate > go) go += (tgtGate - go) * 0.42;
      else go += (tgtGate - go) * 0.065;
      S._bcGateOpen = go;
      if (S.bcGateNode) S.bcGateNode.gain.value = go;

      var step = Math.floor(S.bufLen / 256);
      var bvA = typeof S.beatVisual === 'number' ? S.beatVisual : S.beat * 0.5;
      for (var j = 0; j < 256; j++) {
        var fq = S.freqArr[j * step] || 0;
        var adj = Math.max(0, fq - nf * 255);
        abuf[j] = Math.min(255, Math.floor(adj * (1 + S.sBass * 0.28 + bvA * 0.08)));
      }
      for (var j = 0; j < 256; j++) abuf[256 + j] = S.waveArr[j * step] || 128;
    }

    gl.bindTexture(gl.TEXTURE_2D, atex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, abuf);

    if (S.micOn && S.sBass > 0.38 && S.prevBass < 0.26) {
      var now = performance.now(), gap = now - S.lastBeat;
      if (gap > 180 && gap < 2800) {
        S.bpmList.push(60000 / gap);
        if (S.bpmList.length > 8) S.bpmList.shift();
        var sum = 0;
        for (var bi = 0; bi < S.bpmList.length; bi++) sum += S.bpmList[bi];
        S.bpm = Math.round(sum / S.bpmList.length);
      }
      S.lastBeat = now;
      S.beat = Math.max(S.beat, 1.18);
    }
    S.prevBass = S.sBass;
    if (S.beat > 0) S.beat = Math.max(0, S.beat - adt * 2.65);
    if (S.explode > 0) S.explode = Math.max(0, S.explode - adt * 2.2);

    var bvTarget = Math.min(0.92, S.beat * 0.52 + S.sBass * 0.1);
    var tau = bvTarget > (S.beatVisual || 0) ? 0.09 : 0.42;
    var alpha = 1 - Math.exp(-Math.min(adt * 2.5, 0.35) / tau);
    S.beatVisual = (S.beatVisual || 0) + (bvTarget - (S.beatVisual || 0)) * alpha;
    syncVisualDrive();
  }

  NX.audio = {
    tick: tick,
    startMic: startMic,
    stopMic: stopMic,
    toggleMic: toggleMic,
    enumDevices: enumDevices,
    ensureButterchurnAudioGraph: ensureButterchurnAudioGraph,
    resumeAudioContext: resumeAudioContext,
    primeForButterchurn: primeForButterchurn
  };
})();
