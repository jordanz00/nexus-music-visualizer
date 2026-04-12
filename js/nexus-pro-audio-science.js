'use strict';
/**
 * nexus-pro-audio-science.js — Chromagram (Web Worker optional), pseudo M/S, structural blend → `PRO`.
 * Worker path: dedicated `nexus-pro-structure-worker.js` computes raw chroma bins; main smooths + M/S.
 */

(function () {
  var chromaSmooth = new Float32Array(12);
  var _worker = null;
  var _workerFailed = false;
  var _frame = 0;
  var _pendingChroma = null;
  var _pendingFresh = false;

  function workerUrl() {
    try {
      return new URL('js/nexus-pro-structure-worker.js', document.baseURI || location.href).href;
    } catch (e) {
      return 'js/nexus-pro-structure-worker.js';
    }
  }

  function ensureWorker() {
    if (_workerFailed || _worker) return _worker;
    try {
      if (typeof Worker !== 'function') return null;
      _worker = new Worker(workerUrl());
      _worker.onmessage = function (ev) {
        var d = ev.data;
        if (!d || d.type !== 'chroma') return;
        if (d.chroma) {
          _pendingChroma = new Float32Array(d.chroma);
          _pendingFresh = true;
        }
      };
      _worker.onerror = function () {
        _workerFailed = true;
        try {
          if (_worker) _worker.terminate();
        } catch (eT) { /* ignore */ }
        _worker = null;
      };
    } catch (e) {
      _workerFailed = true;
      _worker = null;
    }
    return _worker;
  }

  function resetSmooth() {
    for (var i = 0; i < 12; i++) chromaSmooth[i] = 0;
  }

  function smoothChromaFromRaw(raw, alpha) {
    var p;
    for (p = 0; p < 12; p++) {
      chromaSmooth[p] += (raw[p] - chromaSmooth[p]) * alpha;
    }
    var sum = 0;
    var peak = 0;
    var peakPc = 0;
    for (p = 0; p < 12; p++) {
      var v = chromaSmooth[p];
      sum += v;
      if (v > peak) {
        peak = v;
        peakPc = p;
      }
    }
    var cent = peak > 1e-4 ? peakPc / 11 : 0;
    var ent = 0;
    if (sum > 1e-5) {
      for (p = 0; p < 12; p++) {
        var q = chromaSmooth[p] / sum;
        if (q > 1e-6) ent -= q * Math.log(q);
      }
    }
    var flat = Math.min(1, ent / Math.log(12));
    return { cent: cent, flat: flat };
  }

  function rawChromaMain(freq, bufLen, sampleRate, fft) {
    var chroma = new Float32Array(12);
    var k0 = 2;
    var k1 = Math.max(k0 + 1, bufLen - 1);
    var k;
    for (k = k0; k < k1; k++) {
      var freqHz = k * sampleRate / fft;
      if (freqHz < 55 || freqHz > 5200) continue;
      var midi = 69 + 12 * Math.log2(freqHz / 440);
      var pc = (Math.floor(midi) % 12 + 12) % 12;
      chroma[pc] += freq[k] / 255;
    }
    return chroma;
  }

  /**
   * @param {object} S — NX.S
   * @returns {void}
   */
  function ingest(S) {
    if (!S) return;
    if (!S.analyser || !S.freqArr || !S.waveArr || !S.bufLen) {
      S.proPR = S.proPG = S.proPB = S.proPA = 0;
      S.proChromaFlatness = 0;
      S.proPhaseCorr01 = 0.5;
      return;
    }
    var sr = (S.audioCtx && S.audioCtx.sampleRate) || 44100;
    var fft = S.analyser.fftSize || 2048;
    var n = S.bufLen | 0;
    var alpha = S.micOn ? 0.24 : 0.08;
    var useWorker = S.nexusProWorkerClassifier !== false && S.micOn && !_workerFailed;
    var rawMain = rawChromaMain(S.freqArr, n, sr, fft);
    if (useWorker && ensureWorker()) {
      _frame++;
      if ((_frame & 1) === 0) {
        var cpy = new Uint8Array(S.freqArr.length);
        cpy.set(S.freqArr);
        try {
          _worker.postMessage({
            type: 'analyze',
            freqBuf: cpy.buffer,
            bufLen: n,
            sampleRate: sr,
            fftSize: fft,
            t: performance.now()
          }, [cpy.buffer]);
        } catch (ePost) {
          _workerFailed = true;
        }
      }
    }
    var raw = rawMain;
    if (_pendingFresh && _pendingChroma && _pendingChroma.length === 12) {
      raw = _pendingChroma;
      _pendingFresh = false;
    }
    var cf = smoothChromaFromRaw(raw, alpha);
    var cent = cf.cent;
    var flat = cf.flat;

    var wv = S.waveArr;
    var len = wv.length | 0;
    var h = (len >> 1) - 2;
    if (h < 4) {
      S.proPR = cent;
      S.proPG = 0;
      S.proPB = 0;
      var tr0 = typeof S.sTransient === 'number' ? S.sTransient : 0;
      var hm0 = (typeof S.sMid === 'number' ? S.sMid : 0) * 0.55 + (typeof S.sHigh === 'number' ? S.sHigh : 0) * 0.45;
      var struct0 = tr0 / (tr0 + hm0 + 0.04);
      if (struct0 > 1) struct0 = 1;
      S.proPA = Math.min(1, struct0 * 0.62 + flat * 0.38);
      S.proChromaFlatness = flat;
      S.proPhaseCorr01 = 0.5;
      return;
    }
    var accM = 0;
    var accS = 0;
    var accLL = 0;
    var accRR = 0;
    var accLR = 0;
    var i;
    for (i = 0; i < h; i++) {
      var L = (wv[2 * i] - 128) / 128;
      var R = (wv[2 * i + 1] - 128) / 128;
      var Md = L + R;
      var Sd = L - R;
      accM += Md * Md;
      accS += Sd * Sd;
      accLL += L * L;
      accRR += R * R;
      accLR += L * R;
    }
    var inv = 1 / h;
    var midE = Math.sqrt(Math.max(0, accM * inv * 0.25));
    var sideE = Math.sqrt(Math.max(0, accS * inv * 0.25));
    var den = Math.sqrt(Math.max(1e-8, accLL * accRR)) * inv;
    var corr = den > 1e-6 ? (accLR * inv) / den : 0;
    if (corr < -1) corr = -1;
    else if (corr > 1) corr = 1;
    var width = sideE / (midE + 0.07);
    if (width > 1) width = 1;

    var tr = typeof S.sTransient === 'number' ? S.sTransient : 0;
    var hm = (typeof S.sMid === 'number' ? S.sMid : 0) * 0.55 + (typeof S.sHigh === 'number' ? S.sHigh : 0) * 0.45;
    var struct = tr / (tr + hm + 0.04);
    if (struct > 1) struct = 1;

    S.proPR = cent;
    S.proPG = Math.min(1, midE * 3.2);
    S.proPB = Math.min(1, width * 1.15);
    S.proPA = Math.min(1, struct * 0.62 + flat * 0.38);
    S.proChromaFlatness = flat;
    S.proPhaseCorr01 = corr * 0.5 + 0.5;
  }

  window.NX.ProAudioScience = {
    ingest: ingest,
    resetSmooth: resetSmooth
  };
})();
