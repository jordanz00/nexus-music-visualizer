'use strict';
/*  audio.js — Mic / analyser, spectral flux, centroid, beat detection,
    demo synthesizer, and the per-frame tickAudio routine.               */

(function () {
  var S = NX.S, P = NX.P, gl = NX.gl, abuf = NX.abuf, atex = NX.atex;

  function demoAudio(t) {
    var bph = t * 2.0;
    var kick = Math.max(0, 1.0 - Math.abs(bph % 1.0) * 14);
    var snare = Math.max(0, 1.0 - Math.abs((bph + 0.5) % 1.0) * 11) * 0.55;
    var hihat = 0.5 + 0.45 * Math.sin(t * 7.3 + 0.9);
    var wobble = 0.5 + 0.5 * Math.sin(t * 2.2) * Math.sin(t * 5.1);
    return {
      bass: 0.22 + 0.55 * Math.pow(Math.max(0, Math.sin(bph * Math.PI * 2)), 2.2) + kick * 0.52 + snare * 0.12,
      mid: 0.12 + 0.38 * Math.abs(Math.sin(t * 3.1)) + snare * 0.35 + wobble * 0.12,
      high: 0.06 + 0.22 * hihat + snare * 0.2,
      vol: 0.2 + 0.48 * kick + 0.15 * snare,
      beat: Math.max(kick, snare * 0.85)
    };
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
      S.gainNode = S.audioCtx.createGain(); S.gainNode.gain.value = P.GAIN;
      S.analyser = S.audioCtx.createAnalyser();
      S.analyser.fftSize = 2048; S.analyser.smoothingTimeConstant = P.SMTH / 100;
      S.analyser.minDecibels = -88; S.analyser.maxDecibels = -28;
      S.bufLen = S.analyser.frequencyBinCount;
      S.waveArr = new Uint8Array(S.bufLen); S.freqArr = new Uint8Array(S.bufLen);
      S.prevFreqFlux = new Uint8Array(S.bufLen);
      src.connect(S.gainNode); S.gainNode.connect(S.analyser);
      S.micOn = true; S.curDev = devId || '';
      var db = document.getElementById('db'); if (db) db.classList.add('h');
      await enumDevices();
      if (NX.VisualEngineManager && NX.VisualEngineManager.isReady()) NX.VisualEngineManager.connectAudio();
    } catch (e) {
      console.warn('Mic failed:', e.message);
    }
  }

  async function stopMic() {
    if (S.micStream) { S.micStream.getTracks().forEach(function (t) { t.stop(); }); S.micStream = null; }
    if (S.audioCtx) { try { await S.audioCtx.close(); } catch (e) { } S.audioCtx = null; }
    S.analyser = null; S.micOn = false; S.prevFreqFlux = null;
    if (NX.VisualEngineManager) NX.VisualEngineManager.disconnectAudio();
    var db = document.getElementById('db'); if (db) db.classList.remove('h');
  }

  function toggleMic() { if (S.micOn) stopMic(); else startMic(S.curDev); }

  async function enumDevices() {
    try {
      var d = await navigator.mediaDevices.enumerateDevices();
      var s = document.getElementById('devsel'); if (!s) return;
      s.innerHTML = '<option value="">Default Microphone</option>';
      d.filter(function (x) { return x.kind === 'audioinput'; }).forEach(function (x, i) {
        var o = document.createElement('option');
        o.value = x.deviceId; o.textContent = x.label || ('Microphone ' + (i + 1));
        if (x.deviceId === S.curDev) o.selected = true; s.appendChild(o);
      });
    } catch (e) { }
  }

  function tick() {
    var nowA = performance.now();
    var adt = Math.min(0.055, S._lastAudT ? ((nowA - S._lastAudT) / 1000) : 0.016);
    S._lastAudT = nowA;
    var s = (P.RCT / 5) * P.GAIN * 1.12;
    var demo = demoAudio(S.GT * 0.5);

    if (S.analyser) {
      S.analyser.smoothingTimeConstant = P.SMTH / 100;
      S.analyser.getByteFrequencyData(S.freqArr);
      S.analyser.getByteTimeDomainData(S.waveArr);
      if (!S.prevFreqFlux || S.prevFreqFlux.length !== S.bufLen) S.prevFreqFlux = new Uint8Array(S.bufLen);
      var fluxRaw = 0;
      for (var fi = 2; fi < S.bufLen; fi++) { var d = S.freqArr[fi] - S.prevFreqFlux[fi]; if (d > 0) fluxRaw += d; S.prevFreqFlux[fi] = S.freqArr[fi]; }
      S.sFlux += (Math.min(1, fluxRaw / (S.bufLen * 0.42)) - S.sFlux) * 0.52;
      var i1 = Math.floor(S.bufLen * .02), i2 = Math.floor(S.bufLen * .08), i2b = Math.floor(S.bufLen * .14);
      var i3 = Math.floor(S.bufLen * .32), i4 = Math.floor(S.bufLen * .72);
      var bv = 0, bv2 = 0, mv = 0, hv = 0, vv = 0;
      for (var i = i1; i < i2; i++) bv += S.freqArr[i];
      for (var i = i2; i < i2b; i++) bv2 += S.freqArr[i];
      for (var i = i2; i < i3; i++) mv += S.freqArr[i];
      for (var i = i3; i < i4; i++) hv += S.freqArr[i];
      for (var i = 0; i < i4; i++) vv += S.freqArr[i];
      var cNum = 0, cDen = 1;
      for (var ci = i2; ci < i4; ci++) { cNum += S.freqArr[ci] * ci; cDen += S.freqArr[ci]; }
      S.sCent += (((cNum / Math.max(1, cDen)) / S.bufLen) - S.sCent) * 0.28;
      var mb = Math.min(1, (bv / ((i2 - i1) * 255)) * s * 4.2);
      mb = Math.max(mb, (bv2 / ((i2b - i2) * 255 || 1)) * s * 2.6);
      var mm = Math.min(1, (mv / ((i3 - i2) * 255)) * s * 3.5);
      var mh = Math.min(1, (hv / ((i4 - i3) * 255)) * s * 3.25);
      var mv2 = Math.min(1, (vv / (i4 * 255)) * s * 2.85);
      var blend = Math.min(1, mv2 * 2.4);
      var atk = mb - S.prevMbRaw; S.prevMbRaw = mb;
      if (atk > 0.14 && mb > 0.18) S.beat = Math.max(S.beat, 0.92);
      if (atk > 0.22 && mb > 0.28) S.beat = Math.max(S.beat, 1.12);
      S.sBass += (Math.max(demo.bass * (1 - blend), mb) - S.sBass) * .4;
      S.sMid += (Math.max(demo.mid * (1 - blend), mm) - S.sMid) * .36;
      S.sHigh += (Math.max(demo.high * (1 - blend), mh) - S.sHigh) * .34;
      S.sVol += (Math.max(demo.vol * (1 - blend), mv2) - S.sVol) * .32;
      var step = Math.floor(S.bufLen / 256);
      for (var i = 0; i < 256; i++) abuf[i] = Math.min(255, Math.floor((S.freqArr[i * step] || 0) * (1 + S.sBass * 0.35 + S.beat * 0.25)));
      for (var i = 0; i < 256; i++) abuf[256 + i] = S.waveArr[i * step] || 128;
    } else {
      S.sBass += (demo.bass - S.sBass) * .42; S.sMid += (demo.mid - S.sMid) * .38;
      S.sHigh += (demo.high - S.sHigh) * .34; S.sVol += (demo.vol - S.sVol) * .36;
      var dKick = Math.abs(Math.sin(S.GT * 2. * 3.14159));
      S.sFlux += (Math.min(1, dKick * demo.beat * 1.8) - S.sFlux) * 0.55;
      S.sCent += (0.32 + 0.22 * Math.sin(S.GT * 0.37) + demo.mid * 0.12 - S.sCent) * 0.22;
      if (demo.beat > 0.65) S.beat = Math.max(S.beat, demo.beat * 0.95);
      for (var i = 0; i < 256; i++) abuf[i] = Math.floor(Math.min(255, S.sBass * 240 * Math.exp(-i / 48) + S.beat * 40));
      for (var i = 0; i < 256; i++) abuf[256 + i] = 128 + Math.floor(S.sMid * 55 * Math.sin(i * 0.2 + S.GT * 3) + S.sHigh * 35 * Math.sin(i * 0.37 - S.GT * 4));
    }
    gl.bindTexture(gl.TEXTURE_2D, atex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, abuf);

    if (S.sBass > 0.38 && S.prevBass < 0.26) {
      var now = performance.now(), gap = now - S.lastBeat;
      if (gap > 180 && gap < 2800) {
        S.bpmList.push(60000 / gap); if (S.bpmList.length > 8) S.bpmList.shift();
        var sum = 0; for (var i = 0; i < S.bpmList.length; i++) sum += S.bpmList[i];
        S.bpm = Math.round(sum / S.bpmList.length);
      }
      S.lastBeat = now; S.beat = Math.max(S.beat, 1.18);
    }
    S.prevBass = S.sBass;
    if (S.beat > 0) S.beat = Math.max(0, S.beat - adt * 2.65);
    if (S.explode > 0) S.explode = Math.max(0, S.explode - adt * 2.2);
  }

  NX.audio = { tick: tick, startMic: startMic, stopMic: stopMic, toggleMic: toggleMic, enumDevices: enumDevices };
})();
