'use strict';
/**
 * LTC line helper: RMS + zero-crossing rate near expected SMPTE LTC band (~2.4 kHz bit rate × edges).
 * Does not fabricate timecode; use vendor/ltc WASM build for decoded SMPTE (see vendor/ltc/README.txt).
 */
(function () {
  function LtcJsDecoder(sampleRate) {
    this.sr = sampleRate || 48000;
    this._prev = 0;
    this._cross = 0;
    this._frames = 0;
    this.confidence = 0;
  }

  LtcJsDecoder.prototype.feed = function (mono) {
    var i;
    var zc = 0;
    for (i = 1; i < mono.length; i++) {
      if ((this._prev <= 0 && mono[i] > 0) || (this._prev >= 0 && mono[i] < 0)) zc++;
      this._prev = mono[i];
    }
    this._cross += zc;
    this._frames++;
    if (this._frames >= Math.max(2, Math.round(this.sr / 2048))) {
      var perSec = this._cross * (this.sr / mono.length) / this._frames;
      this._cross = 0;
      this._frames = 0;
      var target = 4800;
      var err = Math.abs(perSec - target) / target;
      this.confidence = clamp01(1 - err * 2.2);
    }
    return null;
  };

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  window.NX = window.NX || {};
  NX.LtcJsDecoder = LtcJsDecoder;
})();
