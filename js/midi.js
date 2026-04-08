'use strict';
/*  midi.js — WebMIDI support with learn mode, scene triggers, CC mapping.
    Falls back gracefully when MIDI is unavailable.                        */

(function () {
  var S = NX.S, P = NX.P;
  var access = null, inputs = [], mappings = {}, learnTarget = null;

  function loadMappings() {
    try { var s = localStorage.getItem('nx_midi'); if (s) mappings = JSON.parse(s); } catch (e) { }
  }
  function saveMappings() {
    try { localStorage.setItem('nx_midi', JSON.stringify(mappings)); } catch (e) { }
  }

  /* Map a CC channel → a param */
  var paramDefs = {
    speed: { set: function (v) { P.SPD = v * 10; var e = document.getElementById('rspd'); if (e) e.value = P.SPD; } },
    react: { set: function (v) { P.RCT = v * 10; var e = document.getElementById('rrct'); if (e) e.value = P.RCT; } },
    warp: { set: function (v) { P.WRP = v * 10; var e = document.getElementById('rwrp'); if (e) e.value = P.WRP; } },
    gain: { set: function (v) { P.GAIN = v * 2; var e = document.getElementById('rgain'); if (e) e.value = P.GAIN * 100; } },
    morph: { set: function (v) { S.morphDurationSec = 0.55 + v * 3.65; } },
    palette: { set: function (v) { P.PAL = Math.floor(v * 6); if (NX.ui && NX.ui.setPalette) NX.ui.setPalette(P.PAL); } },
    bloom: { set: function (v) { S.postBloomMul = v * 2.2; } },
    colorShift: { set: function (v) { S.hueShift = v; } },
    bcNext: { set: function () {
      if (!NX.PresetLibrary || !NX.VisualEngineManager) return;
      var keys = NX.PresetLibrary.getKeys();
      if (!keys || !keys.length) return;
      var p = NX.PresetLibrary.getPreset(keys[Math.floor(Math.random() * keys.length)]);
      if (p) NX.VisualEngineManager.loadPreset(p, 1.6);
    } },
    visualMode: { set: function (v) {
      var modes = ['shader', 'butterchurn', 'hybrid'];
      var i = Math.min(2, Math.floor(v * 3));
      if (NX.SceneManager) NX.SceneManager.setMode(modes[i], { crossfade: true });
    } }
  };

  function handleMessage(e) {
    var data = e.data;
    if (!data || data.length < 3) return;
    var status = data[0] & 0xf0, ch = data[0] & 0x0f, note = data[1], vel = data[2];

    /* Learn mode: map this CC or note to the current target */
    if (learnTarget) {
      var key = ch + ':' + note;
      if (status === 0xb0) {
        mappings[key] = { type: 'cc', param: learnTarget };
      } else if (status === 0x90) {
        mappings[key] = { type: 'note', param: learnTarget };
      }
      saveMappings();
      learnTarget = null;
      if (NX.ui && NX.ui.setMidiStatus) NX.ui.setMidiStatus('mapped');
      return;
    }

    var mkey = ch + ':' + note;

    /* Note On → scene trigger or explode */
    if (status === 0x90 && vel > 0) {
      var m = mappings[mkey];
      if (m && m.type === 'note' && m.param === 'explode') { S.explode = 1.5; S.beat = 1.0; return; }
      if (m && m.type === 'note' && typeof m.param === 'number') { NX.goNext(m.param); return; }
      if (note < NX.scenes.length) NX.goNext(note);
      return;
    }

    /* CC → parameter control */
    if (status === 0xb0) {
      var v01 = vel / 127;
      var m2 = mappings[mkey];
      if (m2 && m2.type === 'cc' && paramDefs[m2.param]) {
        if (m2.param === 'bcNext') paramDefs.bcNext.set();
        else paramDefs[m2.param].set(v01);
        if (NX.ui && NX.ui.flashControl) NX.ui.flashControl(m2.param);
      }
    }
  }

  async function init() {
    loadMappings();
    if (!navigator.requestMIDIAccess) { console.log('WebMIDI not available'); return; }
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
      access.onstatechange = refreshInputs;
      refreshInputs();
    } catch (e) { console.warn('MIDI access denied:', e.message); }
  }

  function refreshInputs() {
    inputs.forEach(function (inp) { inp.onmidimessage = null; });
    inputs = [];
    if (!access) return;
    access.inputs.forEach(function (inp) {
      inputs.push(inp);
      inp.onmidimessage = handleMessage;
    });
    console.log('MIDI inputs:', inputs.map(function (i) { return i.name; }));
    if (NX.ui && NX.ui.setMidiStatus) NX.ui.setMidiStatus(inputs.length ? 'connected' : 'none');
  }

  function startLearn(paramName) { learnTarget = paramName; if (NX.ui && NX.ui.setMidiStatus) NX.ui.setMidiStatus('learning: ' + paramName); }
  function clearMappings() { mappings = {}; saveMappings(); }
  function getMappings() { return Object.assign({}, mappings); }

  NX.midi = { init: init, startLearn: startLearn, clearMappings: clearMappings, getMappings: getMappings };
})();
