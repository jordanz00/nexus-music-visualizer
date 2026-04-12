'use strict';
/* Dedicated Web Worker: raw 12-bin chromagram from frequency data (main thread smooths + M/S). */

function rawChromaFromFreq(freq, bufLen, sampleRate, fftSize) {
  var chroma = new Float32Array(12);
  var k0 = 2;
  var k1 = Math.max(k0 + 1, bufLen - 1);
  var k;
  for (k = k0; k < k1; k++) {
    var freqHz = k * sampleRate / fftSize;
    if (freqHz < 55 || freqHz > 5200) continue;
    var midi = 69 + 12 * Math.log2(freqHz / 440);
    var pc = (Math.floor(midi) % 12 + 12) % 12;
    chroma[pc] += freq[k] / 255;
  }
  return chroma;
}

self.onmessage = function (ev) {
  var d = ev.data;
  if (!d || d.type !== 'analyze') return;
  try {
    var freq = new Uint8Array(d.freqBuf);
    var chroma = rawChromaFromFreq(
      freq,
      d.bufLen | 0,
      +d.sampleRate || 44100,
      d.fftSize | 2048
    );
    self.postMessage({ type: 'chroma', chroma: chroma.buffer, t: d.t || 0 }, [chroma.buffer]);
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e && e.message ? e.message : e) });
  }
};
