'use strict';
/*  audio.js — Microphone → analyser → band levels, spectral flux, beat/BPM,
    Butterchurn gate. Reactivity profiles (punchy / balanced / smooth).
    Visual Aurora drive (_visualBcDrive) decouples UI intensity from gated BC tap. */

(function () {
  var S = NX.S, P = NX.P, gl = NX.gl, abuf = NX.abuf, atex = NX.atex;

  /**
   * Mic reactivity tuning. vd* = visual drive blend; gate* = BC audio tap smoothing.
   */
  var REACT = {
    punchy: {
      smth: 38,
      vdUp: 0.58, vdDown: 0.14,
      gateUp: 0.58, gateDown: 0.1,
      rFloor: 0.003, rSpan: 0.095, rPow: 0.62,
      fluxAlpha: 0.62,
      bandAtk: 0.58, bandRel: 0.34,
      transientGain: 14,
      crestSmooth: 12,
      vdMic: 1.18, vdVol: 1.25, vdBass: 0.58, vdFlux: 0.42, vdTr: 0.62,
      squashThresh: 0.0022,
      silentThresh: 0.028
    },
    balanced: {
      smth: 58,
      vdUp: 0.32, vdDown: 0.09,
      gateUp: 0.42, gateDown: 0.065,
      rFloor: 0.0055, rSpan: 0.07, rPow: 0.72,
      fluxAlpha: 0.52,
      bandAtk: 0.52, bandRel: 0.3,
      transientGain: 9,
      crestSmooth: 8,
      vdMic: 1.02, vdVol: 1.12, vdBass: 0.42, vdFlux: 0.22, vdTr: 0.38,
      squashThresh: 0.0035,
      silentThresh: 0.048
    },
    smooth: {
      smth: 78,
      vdUp: 0.2, vdDown: 0.055,
      gateUp: 0.36, gateDown: 0.048,
      rFloor: 0.007, rSpan: 0.055, rPow: 0.78,
      fluxAlpha: 0.38,
      bandAtk: 0.42, bandRel: 0.22,
      transientGain: 5,
      crestSmooth: 5,
      vdMic: 0.95, vdVol: 1.05, vdBass: 0.36, vdFlux: 0.15, vdTr: 0.22,
      squashThresh: 0.0045,
      silentThresh: 0.062
    }
  };

  function prof() {
    var k = S.reactivityProfile;
    if (k === 'punchy' || k === 'balanced' || k === 'smooth') return REACT[k];
    return REACT.balanced;
  }

  /**
   * Apply profile defaults to analyser smoothing (user may override rsmth after).
   */
  function applyReactivityProfile(name) {
    if (name === 'punchy' || name === 'balanced' || name === 'smooth') {
      S.reactivityProfile = name;
    }
    var pr = prof();
    P.SMTH = pr.smth;
    var smEl = document.getElementById('rsmth');
    if (smEl) {
      smEl.value = String(pr.smth);
      var row = smEl.closest('.ctrl-slider');
      if (row) {
        var vd = row.querySelector('.val');
        if (vd) vd.textContent = String(pr.smth);
      }
    }
    if (S.analyser) S.analyser.smoothingTimeConstant = P.SMTH / 100;
    var sel = document.getElementById('nx-react-profile');
    if (sel && sel.value !== S.reactivityProfile) sel.value = S.reactivityProfile;
    document.querySelectorAll('.nx-react-pill').forEach(function (b) {
      b.classList.toggle('nx-react-pill-on', b.getAttribute('data-profile') === S.reactivityProfile);
    });
  }

  /** Effective gain for level mapping: P.GAIN * trim multiplier. */
  function effectiveGain() {
    var t = typeof P.TRIM === 'number' ? P.TRIM : 100;
    t = Math.max(50, Math.min(200, t));
    return P.GAIN * (t / 100);
  }

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

  function noiseFloor01(freqArr, i1) {
    if (i1 < 1) return 0;
    var sum = 0;
    for (var i = 0; i < i1; i++) sum += freqArr[i];
    var nf = sum / (i1 * 255);
    return Math.min(0.22, Math.max(0, nf));
  }

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
    S.sTransient += (0 - S.sTransient) * k;
    S._rmsSlow += (0 - S._rmsSlow) * k;
    S._visualBcDrive = 0;
  }

  function silenceAudioTexture() {
    for (var i = 0; i < 256; i++) abuf[i] = 0;
    for (var i = 0; i < 256; i++) abuf[256 + i] = 128;
  }

  function syncVisualDrive(pr) {
    var cur = typeof S._visualDrive === 'number' ? S._visualDrive : 0;
    var tgt = 0;
    if (S.analyser && S.micOn) {
      var tr = typeof S.sTransient === 'number' ? S.sTransient : 0;
      tgt = Math.min(1,
        (S.micEnergy || 0) * pr.vdMic +
        (S.sVol || 0) * pr.vdVol +
        (S.sBass || 0) * pr.vdBass +
        (S.sFlux || 0) * pr.vdFlux +
        tr * pr.vdTr
      );
      if (tgt < pr.silentThresh) tgt = 0;
    }
    var r = tgt > cur ? pr.vdUp : pr.vdDown;
    S._visualDrive = cur + (tgt - cur) * r;
  }

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
      S._rmsSlow = 0;
      S.sTransient = 0;
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
    S._bcGateOpen = 0; S.micEnergy = 0; S._rmsSlow = 0; S.sTransient = 0; S._visualBcDrive = 0;
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
    var pr = prof();
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
      S.bpmConfidence = 0;
      S.beatPhase = ((S.beatVisual || 0) * 0.9 + Math.sin(S.GT * 0.55) * 0.05);
      S.beatPhase = S.beatPhase - Math.floor(S.beatPhase);
      syncVisualDrive(pr);
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
      S.sFlux += (Math.min(1, fluxRaw / (S.bufLen * 0.42)) - S.sFlux) * pr.fluxAlpha;

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
      var g = effectiveGain();

      var rawBass = bv / ((i2 - i1) * 255);
      var rawBass2 = bv2 / ((i2b - i2) * 255 || 1);
      var mb = Math.max(levelFromRaw(rawBass, nf, g), levelFromRaw(rawBass2, nf, g * 0.72));
      var mm = levelFromRaw(mv / ((i3 - i2) * 255), nf, g * 0.95);
      var mlm = levelFromRaw(lmv / (Math.max(1, (iLm1 - i2b)) * 255), nf, g * 0.92);
      var mh = levelFromRaw(hv / ((i4 - i3) * 255), nf, g * 0.9);
      var mv2 = levelFromRaw(vv / (i4 * 255), nf, g * 0.88);

      var rmsW = rmsWave8(S.waveArr);
      var slowAlpha = 1 - Math.exp(-Math.min(adt * pr.crestSmooth, 0.45));
      S._rmsSlow = S._rmsSlow + (rmsW - S._rmsSlow) * slowAlpha;
      var crest = Math.max(0, rmsW - S._rmsSlow) * pr.transientGain;
      crest = Math.min(1, crest);
      S.sTransient += (crest - S.sTransient) * Math.min(1, adt * 22);

      if (rmsW < pr.squashThresh) {
        var squash = rmsW / pr.squashThresh;
        mb *= squash; mm *= squash; mlm *= squash; mh *= squash; mv2 *= squash;
      }

      var atk = mb - S.prevMbRaw;
      S.prevMbRaw = mb;
      if (atk > 0.14 && mb > 0.12) S.beat = Math.max(S.beat, 0.92);
      if (atk > 0.22 && mb > 0.22) S.beat = Math.max(S.beat, 1.12);

      var att = pr.bandAtk, rel = pr.bandRel;
      S.sBass += (mb - S.sBass) * (mb > S.sBass ? att : rel);
      S.sLowMid += (mlm - S.sLowMid) * (mlm > S.sLowMid ? att * 0.9 : rel * 0.9);
      S.sMid += (mm - S.sMid) * (mm > S.sMid ? att * 0.92 : rel * 0.93);
      S.sHigh += (mh - S.sHigh) * (mh > S.sHigh ? att * 0.89 : rel * 0.87);
      S.sVol += (mv2 - S.sVol) * (mv2 > S.sVol ? att * 0.89 : rel * 0.87);

      S.micEnergy = Math.min(1, mb * 0.5 + mm * 0.24 + mh * 0.11 + mv2 * 0.36);
      var rFloor = pr.rFloor, rSpan = pr.rSpan;
      var linG = (rmsW - rFloor) / rSpan;
      if (linG < 0) linG = 0; else if (linG > 1) linG = 1;
      var tgtGate = Math.pow(linG, pr.rPow);
      var go = typeof S._bcGateOpen === 'number' ? S._bcGateOpen : 0;
      if (tgtGate > go) go += (tgtGate - go) * pr.gateUp;
      else go += (tgtGate - go) * pr.gateDown;
      S._bcGateOpen = go;
      if (S.bcGateNode) S.bcGateNode.gain.value = go;

      var gate = go;
      var trn = S.sTransient || 0;
      S._visualBcDrive = Math.min(1,
        S.micEnergy * (0.14 + 0.86 * Math.max(gate, trn * 0.82, (S._visualDrive || 0) * 0.5)) +
        trn * 0.38 +
        S.sFlux * 0.22
      );

      var step = Math.floor(S.bufLen / 256);
      var bvA = typeof S.beatVisual === 'number' ? S.beatVisual : S.beat * 0.5;
      for (var j = 0; j < 256; j++) {
        var fq = S.freqArr[j * step] || 0;
        var adj = Math.max(0, fq - nf * 255);
        abuf[j] = Math.min(255, Math.floor(adj * (1 + S.sBass * 0.32 + bvA * 0.1 + trn * 0.15)));
      }
      for (var j = 0; j < 256; j++) abuf[256 + j] = S.waveArr[j * step] || 128;
    }

    gl.bindTexture(gl.TEXTURE_2D, atex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, abuf);

    if (S.micOn && S.sBass > 0.38 && S.prevBass < 0.26) {
      var now = performance.now(), gap = now - S.lastBeat;
      if (gap > 180 && gap < 2800) {
        var instBpm = 60000 / gap;
        if (instBpm > 210) instBpm *= 0.5;
        if (instBpm < 55 && instBpm > 20) instBpm *= 2;
        instBpm = Math.max(48, Math.min(198, instBpm));
        if (S.bpmList.length >= 3) {
          var sorted = S.bpmList.slice().sort(function (a, b) { return a - b; });
          var med = sorted[(sorted.length / 2) | 0];
          if (med > 40 && (instBpm > med * 1.65 || instBpm < med * 0.55)) {
            if (instBpm > med * 1.4 && instBpm * 0.5 > med * 0.75) instBpm *= 0.5;
            else if (instBpm < med * 0.65 && instBpm * 2 < med * 1.35) instBpm *= 2;
          }
        }
        S.bpmList.push(instBpm);
        if (S.bpmList.length > 8) S.bpmList.shift();
        var sum = 0;
        for (var bi = 0; bi < S.bpmList.length; bi++) sum += S.bpmList[bi];
        var rawBpm = sum / S.bpmList.length;
        var prevBpm = typeof S.bpm === 'number' ? S.bpm : rawBpm;
        if (S.bpmList.length >= 2) {
          S.bpm = Math.round(prevBpm * 0.35 + rawBpm * 0.65);
        } else {
          S.bpm = Math.round(rawBpm);
        }
        S.bpm = Math.max(52, Math.min(190, S.bpm));
      }
      S.lastBeat = now;
      S.beat = Math.max(S.beat, 1.18);
      S._beatPulseCount = (S._beatPulseCount || 0) + 1;
    }
    S.prevBass = S.sBass;
    if (S.beat > 0) S.beat = Math.max(0, S.beat - adt * 2.65);
    if (S.explode > 0) S.explode = Math.max(0, S.explode - adt * 2.2);

    var bvTarget = Math.min(0.92, S.beat * 0.52 + S.sBass * 0.1 + (S.sTransient || 0) * 0.12);
    var tau = bvTarget > (S.beatVisual || 0) ? 0.09 : 0.42;
    var alpha = 1 - Math.exp(-Math.min(adt * 2.5, 0.35) / tau);
    S.beatVisual = (S.beatVisual || 0) + (bvTarget - (S.beatVisual || 0)) * alpha;
    syncVisualDrive(pr);

    var listLen = S.bpmList && S.bpmList.length ? S.bpmList.length : 0;
    var conf = Math.min(1, listLen / 6);
    var micE = typeof S.micEnergy === 'number' ? S.micEnergy : 0;
    var baseConf = (S.micOn && listLen >= 2) ? conf * Math.min(1, micE * 2.8 + 0.2) : 0;
    if (S.lastBeat && nowA - S.lastBeat > 3200) baseConf *= 0.92;
    if (S.lastBeat && nowA - S.lastBeat > 8000) baseConf *= 0.88;
    S.bpmConfidence = Math.max(0, Math.min(1, baseConf));
    if (S.micOn && S.bpm > 42 && S.bpm < 200 && S.lastBeat) {
      var beatMs = 60000 / S.bpm;
      var ph = ((nowA - S.lastBeat) % beatMs) / beatMs;
      S.beatPhase = ph < 0 ? 0 : (ph > 1 ? 1 : ph);
    } else {
      var bv = typeof S.beatVisual === 'number' ? S.beatVisual : 0;
      S.beatPhase = bv * 0.88 + Math.sin(S.GT * 0.62 + S.sFlux * 2) * 0.06;
      S.beatPhase = S.beatPhase - Math.floor(S.beatPhase);
    }
  }

  /** Beat interval in seconds when BPM is trusted; else null. */
  function getBeatIntervalSec() {
    var b = typeof S.bpm === 'number' ? S.bpm : 0;
    var bc = typeof S.bpmConfidence === 'number' ? S.bpmConfidence : 0;
    if (b < 52 || b > 190 || bc < 0.22) return null;
    return 60 / b;
  }

  NX.audio = {
    tick: tick,
    getBeatIntervalSec: getBeatIntervalSec,
    startMic: startMic,
    stopMic: stopMic,
    toggleMic: toggleMic,
    enumDevices: enumDevices,
    ensureButterchurnAudioGraph: ensureButterchurnAudioGraph,
    resumeAudioContext: resumeAudioContext,
    primeForButterchurn: primeForButterchurn,
    applyReactivityProfile: applyReactivityProfile,
    effectiveGain: effectiveGain
  };
})();
