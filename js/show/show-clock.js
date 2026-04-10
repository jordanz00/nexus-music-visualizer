'use strict';
/**
 * ShowClock — master show time for NEXUS: internal, BPM-locked, MTC (Web MIDI), LTC (line-in RMS gate; full decode = WASM hook).
 * Exposes SMPTE-style display + seconds for cues / future shader uniforms.
 */
(function () {
  var mode = 'internal';
  var frameRate = 30;
  var dropFrame = false;
  var rate = 1;
  var tSeconds = 0;
  var bpmAnchorMs = 0;
  var midiAccess = null;
  var midiInputs = [];
  var mtc = {
    f: 0, s: 0, m: 0, h: 0,
    piece: 0,
    lastComplete: null
  };
  var ltc = { rms: 0, stream: null, ctx: null, node: null, decoder: null, decSmpte: null };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function secondsToSmpte(sec, fps) {
    fps = fps | 0;
    if (fps <= 0) fps = 30;
    var framesTotal = Math.floor(sec * fps + 1e-6);
    var f = framesTotal % fps;
    var t = (framesTotal / fps) | 0;
    var s = t % 60;
    var m = (t / 60 | 0) % 60;
    var h = (t / 3600 | 0) % 24;
    return { h: h, m: m, s: s, f: f };
  }

  function smpteToDisplay(o) {
    return pad2(o.h) + ':' + pad2(o.m) + ':' + pad2(o.s) + ':' + pad2(o.f);
  }

  function getSMPTEObject() {
    if (mode === 'ltc' && ltc.decSmpte) {
      var d = ltc.decSmpte;
      var fm = d.f | 0;
      if (fm >= frameRate) fm = frameRate - 1;
      if (fm < 0) fm = 0;
      return { h: (d.h | 0) % 24, m: (d.m | 0) % 60, s: (d.s | 0) % 60, f: fm };
    }
    if (mode === 'mtc' && mtc.lastComplete) {
      var mf = mtc.f;
      if (mf >= frameRate) mf = frameRate - 1;
      if (mf < 0) mf = 0;
      return { h: mtc.h % 24, m: mtc.m % 60, s: mtc.s % 60, f: mf };
    }
    var sec = tSeconds;
    if (mode === 'bpm') sec = (performance.now() - bpmAnchorMs) / 1000;
    return secondsToSmpte(sec, frameRate);
  }

  function getDisplayString() {
    if (mode === 'ltc') {
      var r = ltc.rms;
      var tag = r > 0.02 ? 'LTC●' : 'LTC○';
      var conf = ltc.decoder && typeof ltc.decoder.confidence === 'number'
        ? Math.round(ltc.decoder.confidence * 100) + '%' : '—';
      return tag + ' ' + smpteToDisplay(getSMPTEObject()) + ' · ~' + conf;
    }
    return smpteToDisplay(getSMPTEObject());
  }

  function tick(dt) {
    if (mode === 'internal') {
      tSeconds += dt * rate;
      if (tSeconds < 0) tSeconds = 0;
    }
    if (mode === 'ltc') {
      if (ltc.decSmpte) {
        var frL = frameRate;
        tSeconds = (((ltc.decSmpte.h * 60 + ltc.decSmpte.m) * 60 + ltc.decSmpte.s) * frL + (ltc.decSmpte.f | 0)) / frL;
      }
    }
    if (mode === 'mtc' && mtc.lastComplete) {
      var fr2 = frameRate;
      tSeconds = (((mtc.h * 60 + mtc.m) * 60 + mtc.s) * fr2 + mtc.f) / fr2;
    }
    if (mode === 'bpm') tSeconds = (performance.now() - bpmAnchorMs) / 1000;
    var S = window.NX && NX.S;
    if (S) {
      var sm = getSMPTEObject();
      S.showTcH = sm.h;
      S.showTcM = sm.m;
      S.showTcS = sm.s;
      S.showTcF = sm.f;
      S.showTcMode = mode;
      S.showTcSeconds = tSeconds;
      S.ltcConfidence = mode === 'ltc' && ltc.decoder ? ltc.decoder.confidence : 0;
    }
  }

  function setMode(m) {
    if (m === 'internal' || m === 'bpm' || m === 'mtc' || m === 'ltc') {
      mode = m;
      if (m === 'bpm') bpmAnchorMs = performance.now();
      if (m === 'internal') { /* keep tSeconds */ }
    }
  }

  function setFrameRate(fps) {
    if (fps === 24 || fps === 25 || fps === 30) frameRate = fps;
  }

  function resetInternal() {
    tSeconds = 0;
    bpmAnchorMs = performance.now();
  }

  /** MTC quarter-frame (status 0xF1). */
  function onMidiMessage(ev) {
    var d = ev.data;
    if (!d || d.length < 1) return;
    var st = d[0];
    if (st !== 0xf1) return;
    var b = d[1];
    var typ = (b >> 4) & 7;
    var nib = b & 0x0f;
    switch (typ) {
      case 0: mtc.f = (mtc.f & ~0x0f) | nib; break;
      case 1: mtc.f = (mtc.f & ~0x30) | ((nib & 0x03) << 4); break;
      case 2: mtc.s = (mtc.s & ~0x0f) | nib; break;
      case 3: mtc.s = (mtc.s & ~0x30) | ((nib & 0x03) << 4); break;
      case 4: mtc.m = (mtc.m & ~0x0f) | nib; break;
      case 5: mtc.m = (mtc.m & ~0x30) | ((nib & 0x03) << 4); break;
      case 6: mtc.h = (mtc.h & ~0x0f) | nib; break;
      case 7:
        mtc.h = (mtc.h & ~0x1f) | ((nib & 0x01) << 4);
        dropFrame = !!(nib & 0x04);
        var fpsBits = (nib >> 1) & 3;
        if (fpsBits === 0) frameRate = 24;
        else if (fpsBits === 1) frameRate = 25;
        else if (fpsBits === 2) { frameRate = 30; }
        else frameRate = 30;
        mtc.lastComplete = performance.now();
        break;
      default: break;
    }
  }

  function stopMIDI() {
    for (var i = 0; i < midiInputs.length; i++) {
      try { midiInputs[i].onmidimessage = null; } catch (e) { }
    }
    midiInputs = [];
  }

  function startMTC() {
    if (!navigator.requestMIDIAccess) return Promise.reject(new Error('Web MIDI unavailable'));
    return navigator.requestMIDIAccess({ sysex: false }).then(function (access) {
      midiAccess = access;
      stopMIDI();
      access.inputs.forEach(function (inp) {
        inp.onmidimessage = onMidiMessage;
        midiInputs.push(inp);
      });
      access.onstatechange = function () {
        stopMIDI();
        access.inputs.forEach(function (inp) {
          inp.onmidimessage = onMidiMessage;
          midiInputs.push(inp);
        });
      };
      setMode('mtc');
      return access;
    });
  }

  function stopLTC() {
    try {
      if (ltc.node) ltc.node.disconnect();
    } catch (e1) { }
    ltc.node = null;
    try {
      if (ltc.ctx) ltc.ctx.close();
    } catch (e2) { }
    ltc.ctx = null;
    ltc.stream = null;
    ltc.rms = 0;
    ltc.decoder = null;
    ltc.decSmpte = null;
    if (window.NX && NX.LtcWasm && NX.LtcWasm.resetStream) NX.LtcWasm.resetStream();
  }

  /** Arm LTC line: RMS gate only until libltc WASM decodes SMPTE. */
  function startLTC() {
    stopLTC();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('getUserMedia unavailable'));
    }
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
      .then(function (stream) {
        ltc.stream = stream;
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        ltc.ctx = ctx;
        var src = ctx.createMediaStreamSource(stream);
        ltc.decoder = NX.LtcJsDecoder ? new NX.LtcJsDecoder(ctx.sampleRate) : null;
        if (NX.LtcWasm && NX.LtcWasm.init) NX.LtcWasm.init().catch(function () { });
        var proc = ctx.createScriptProcessor(2048, 1, 1);
        proc.onaudioprocess = function (e) {
          var buf = e.inputBuffer.getChannelData(0);
          var sum = 0;
          var i;
          for (i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          ltc.rms = Math.sqrt(sum / buf.length);
          if (ltc.decoder) ltc.decoder.feed(buf);
          var wasmSmpte = NX.LtcWasm && NX.LtcWasm.decodeMonoF32 ? NX.LtcWasm.decodeMonoF32(buf, ctx.sampleRate) : null;
          if (wasmSmpte) ltc.decSmpte = wasmSmpte;
        };
        var silent = ctx.createGain();
        silent.gain.value = 0;
        src.connect(proc);
        proc.connect(silent);
        silent.connect(ctx.destination);
        ltc.node = proc;
        setMode('ltc');
        return stream;
      });
  }

  window.NX = window.NX || {};
  NX.ShowClock = {
    tick: tick,
    setMode: setMode,
    getMode: function () { return mode; },
    setFrameRate: setFrameRate,
    setRate: function (r) { rate = Math.max(-4, Math.min(4, r)); },
    resetInternal: resetInternal,
    getSMPTEObject: getSMPTEObject,
    getDisplayString: getDisplayString,
    getSeconds: function () { return tSeconds; },
    startMTC: startMTC,
    stopMIDI: stopMIDI,
    startLTC: startLTC,
    stopLTC: stopLTC,
    getLtcRms: function () { return ltc.rms; },
    getMidiInputCount: function () { return midiInputs.length; }
  };
})();
