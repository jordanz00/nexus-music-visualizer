/**
 * AudioWorkletProcessor — RMS + peak + crest from the live tap (audio thread).
 * Passthrough: copies inputs → outputs so the node can sit in-line before AnalyserNode.
 * MIT — project-authored for NEXUS.
 */
class NxAudioMeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._blocks = 0;
    this._sumSq = 0;
    this._peak = 0;
    this._n = 0;
    this._postEvery = 32;
  }

  process(inputs, outputs) {
    var input = inputs[0];
    var output = outputs[0];
    if (input && input.length > 0 && output && output.length > 0) {
      var ci;
      for (ci = 0; ci < input.length; ci++) {
        var chIn = input[ci];
        var chOut = output[ci];
        if (!chIn || !chOut) continue;
        var i;
        for (i = 0; i < chIn.length; i++) {
          var v = chIn[i];
          chOut[i] = v;
          this._sumSq += v * v;
          var a = v < 0 ? -v : v;
          if (a > this._peak) this._peak = a;
          this._n++;
        }
      }
    }
    this._blocks++;
    if (this._blocks >= this._postEvery) {
      var rms = this._n > 0 ? Math.sqrt(this._sumSq / this._n) : 0;
      var crest = 0;
      if (rms > 1e-6) {
        crest = Math.min(1, (this._peak / rms) / 18);
      }
      this.port.postMessage({ rms: rms, peak: this._peak, crest: crest });
      this._sumSq = 0;
      this._peak = 0;
      this._n = 0;
      this._blocks = 0;
    }
    return true;
  }
}

registerProcessor('nx-audio-meter', NxAudioMeterProcessor);
