'use strict';
/**
 * SMPTE LTC biphase-M decode (mono float32) — in-repo fallback when WASM is absent.
 * Bi-phase mark: bit 1 = one full cell between edges (~T); bit 0 = two half-cells (edges ~T/2 apart).
 * Sync word (bits 64–79, first bit = b0): twelve 1s then 0,1,0,0 — see libltc.
 */
(function () {
  var SYNC = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0];

  function readSchmitt() {
    try {
      var j = JSON.parse(localStorage.getItem('nexus.ltc.cal') || '{}');
      var hi = typeof j.hi === 'number' ? Math.max(0.02, Math.min(0.28, j.hi)) : 0.08;
      var lo = typeof j.lo === 'number' ? Math.min(-0.02, Math.max(-0.28, j.lo)) : -hi;
      return { hi: hi, lo: lo };
    } catch (e) {
      return { hi: 0.08, lo: -0.08 };
    }
  }

  function matchSync(bits, off) {
    var i;
    for (i = 0; i < 16; i++) {
      if ((bits[off + i] | 0) !== SYNC[i]) return false;
    }
    return true;
  }

  /** SMPTE 12M-ish LTC bit layout (LSB first stream → bits[0] first received). */
  function parseTimeBits(b) {
    var i;
    var fu = 0, ft = 0, su = 0, st = 0, mu = 0, mt = 0, hu = 0, ht = 0;
    for (i = 0; i < 4; i++) fu |= (b[i] & 1) << i;
    for (i = 0; i < 2; i++) ft |= (b[8 + i] & 1) << i;
    var df = !!(b[10] & 1);
    for (i = 0; i < 4; i++) su |= (b[16 + i] & 1) << i;
    for (i = 0; i < 3; i++) st |= (b[24 + i] & 1) << i;
    for (i = 0; i < 4; i++) mu |= (b[32 + i] & 1) << i;
    for (i = 0; i < 3; i++) mt |= (b[40 + i] & 1) << i;
    for (i = 0; i < 4; i++) hu |= (b[48 + i] & 1) << i;
    for (i = 0; i < 2; i++) ht |= (b[56 + i] & 1) << i;
    var f = ft * 10 + fu;
    var s = st * 10 + su;
    var m = mt * 10 + mu;
    var h = ht * 10 + hu;
    if (f > 39 || s > 59 || m > 59 || h > 23) return null;
    return { h: h, m: m, s: s, f: f, df: df };
  }

  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    return s[(s.length / 2) | 0];
  }

  /**
   * Turn inter-edge intervals (seconds) into bits using T (one bit cell) estimate.
   */
  function deltasToBits(dts, T) {
    if (T <= 1e-9) return [];
    var half = T * 0.5;
    var tol = T * 0.42;
    var bits = [];
    var i = 0;
    var n = dts.length;
    while (i < n) {
      var d = dts[i];
      if (d > T - tol) {
        bits.push(1);
        i += 1;
      } else if (d < half + tol && i + 1 < n && dts[i + 1] < half + tol) {
        bits.push(0);
        i += 2;
      } else if (d > half - tol && d < half + tol && i + 1 < n) {
        var d2 = dts[i + 1];
        if (d2 > half - tol && d2 < half + tol) {
          bits.push(0);
          i += 2;
        } else {
          i += 1;
        }
      } else {
        i += 1;
      }
    }
    return bits;
  }

  function findFrame(bits) {
    var b;
    var len = bits.length;
    for (b = 0; b <= len - 80; b++) {
      if (!matchSync(bits, b + 64)) continue;
      var fr = [];
      for (var j = 0; j < 64; j++) fr.push(bits[b + j] | 0);
      var t = parseTimeBits(fr);
      if (t) return t;
    }
    return null;
  }

  function createStream(sampleRate) {
    var sr = sampleRate > 0 ? sampleRate : 48000;
    var pos = 0;
    var level = 0;
    var levelInit = false;
    var edgeIdx = [];
    var maxEdges = 12000;
    var lastSmpte = null;

    function feed(mono) {
      if (!mono || !mono.length) return lastSmpte;
      var sch = readSchmitt();
      var i;
      for (i = 0; i < mono.length; i++) {
        var x = mono[i];
        if (!levelInit) {
          level = x >= 0 ? 1 : -1;
          levelInit = true;
        }
        var next = level;
        if (x > sch.hi) next = 1;
        else if (x < sch.lo) next = -1;
        if (next !== level) {
          edgeIdx.push(pos + i);
          while (edgeIdx.length > maxEdges) edgeIdx.shift();
          level = next;
        }
      }
      pos += mono.length;

      if (edgeIdx.length < 24) return lastSmpte;

      var dts = [];
      for (i = 1; i < edgeIdx.length; i++) {
        dts.push((edgeIdx[i] - edgeIdx[i - 1]) / sr);
      }
      var slice = dts.slice(-Math.min(1400, dts.length));
      var med = median(slice);
      if (med < 1 / sr * 3 || med > 0.0025) return lastSmpte;

      var longGuess = med * 2;
      if (longGuess < 1 / 2400 * 0.35 || longGuess > 1 / 2400 * 2.2) {
        longGuess = 1 / 2400;
      }

      var bits = deltasToBits(slice, longGuess);
      if (bits.length < 80) return lastSmpte;

      var tail = bits.slice(-200);
      var smpte = findFrame(tail);
      if (!smpte) smpte = findFrame(bits);
      if (smpte) lastSmpte = smpte;
      return lastSmpte;
    }

    return {
      feed: feed,
      reset: function () {
        edgeIdx = [];
        pos = 0;
        level = 0;
        levelInit = false;
        lastSmpte = null;
      }
    };
  }

  /**
   * One-shot decode (no state). Prefer createStream + feed for line input.
   */
  function decodeMonoF32(mono, sampleRate) {
    var st = createStream(sampleRate);
    return st.feed(mono);
  }

  window.NX = window.NX || {};
  NX.LtcDecodeCore = {
    createStream: createStream,
    decodeMonoF32: decodeMonoF32,
    /** @param {number} hi positive threshold 0.02–0.28 (symmetric low = -hi unless `lo` set) */
    saveCalibration: function (hi, lo) {
      hi = Math.max(0.02, Math.min(0.28, +hi || 0.08));
      lo = lo != null ? Math.max(-0.28, Math.min(-0.02, +lo)) : -hi;
      try {
        localStorage.setItem('nexus.ltc.cal', JSON.stringify({ hi: hi, lo: lo }));
      } catch (e) { /* ignore */ }
    }
  };
})();
