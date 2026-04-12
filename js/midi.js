'use strict';
/*  midi.js — WebMIDI support with learn mode, scene triggers, CC mapping.
    Falls back gracefully when MIDI is unavailable.
    Scene select: unmapped Note On → NX.goNext(note) when note < scene count
    (includes PRESET_PACK_2026 + homage scenes per index.html script order). */

(function () {
  var S = NX.S, P = NX.P;
  var access = null, inputs = [], learnTarget = null;
  var _sceneFamilyBucket = -1;
  var _nextRandomPrev = 0;
  var PROFILES_KEY = 'nx_midi_profiles';
  var ACTIVE_KEY = 'nx_midi_profile';
  var LEGACY_KEY = 'nx_midi';
  var profiles = {};
  var activeName = 'Default';
  var mappings = {};

  function flushActiveToProfiles() {
    profiles[activeName] = mappings && typeof mappings === 'object' ? mappings : {};
  }

  function storageGet(key) {
    try {
      var s = null;
      if (window.NX_Store && typeof NX_Store.get === 'function') {
        var v = NX_Store.get(key);
        if (v != null) s = v;
      }
      if (s == null && NX.Persist && NX.Persist.getItem) s = NX.Persist.getItem(key);
      return s;
    } catch (eG) { return null; }
  }

  function storageSet(key, val) {
    try {
      if (window.NX_Store && typeof NX_Store.set === 'function') {
        NX_Store.set(key, val);
        return;
      }
      if (NX.Persist && NX.Persist.setItem) NX.Persist.setItem(key, val);
    } catch (eS) { /* ignore */ }
  }

  function loadProfiles() {
    profiles = {};
    activeName = 'Default';
    mappings = {};
    try {
      var raw = storageGet(PROFILES_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') profiles = p;
        var an = storageGet(ACTIVE_KEY);
        if (an && profiles[an]) activeName = an;
        else activeName = Object.keys(profiles)[0] || 'Default';
        if (!profiles[activeName]) profiles[activeName] = {};
        mappings = profiles[activeName] && typeof profiles[activeName] === 'object' ? profiles[activeName] : {};
        return;
      }
    } catch (e0) { /* migrate */ }
    try {
      var leg = storageGet(LEGACY_KEY);
      if (leg) mappings = JSON.parse(leg) || {};
    } catch (e1) { mappings = {}; }
    if (!mappings || typeof mappings !== 'object') mappings = {};
    profiles = { Default: mappings };
    activeName = 'Default';
    saveProfiles();
  }

  function saveProfiles() {
    flushActiveToProfiles();
    try {
      storageSet(PROFILES_KEY, JSON.stringify(profiles));
      storageSet(ACTIVE_KEY, activeName);
    } catch (e) { /* ignore */ }
  }

  function saveMappings() {
    profiles[activeName] = mappings;
    saveProfiles();
  }

  function setActiveProfile(name) {
    if (!name || !profiles[name]) return;
    flushActiveToProfiles();
    activeName = name;
    mappings = profiles[activeName] && typeof profiles[activeName] === 'object'
      ? Object.assign({}, profiles[activeName])
      : {};
    profiles[activeName] = mappings;
    saveProfiles();
    refreshProfileSelect();
  }

  function panic() {
    learnTarget = null;
    mappings = {};
    profiles[activeName] = mappings;
    saveProfiles();
  }

  function refreshProfileSelect() {
    var sel = document.getElementById('nx-midi-profile-sel');
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var names = Object.keys(profiles).sort();
    if (!names.length) names = ['Default'];
    names.forEach(function (nm) {
      var o = document.createElement('option');
      o.value = nm;
      o.textContent = nm;
      if (nm === activeName) o.selected = true;
      sel.appendChild(o);
    });
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
    colorShift: { set: function (v) { S.hueShift = (v - 0.5) * 0.55; var el = document.getElementById('r-hue'); if (el) el.value = String(Math.round(S.hueShift * 200)); } },
    bcNext: { set: function () {
      if (!NX.PresetLibrary || !NX.VisualEngineManager) return;
      var keys = NX.PresetLibrary.getKeys();
      if (!keys || !keys.length) return;
      var rnd = typeof NX.randomUnit === 'function' ? NX.randomUnit : Math.random;
      var k = keys[Math.floor(rnd() * keys.length)];
      var p = NX.PresetLibrary.getPreset(k);
      if (p) NX.VisualEngineManager.loadPreset(p, 1.8, k);
    } },
    visualMode: { set: function (v) {
      var modes = ['shader', 'butterchurn', 'hybrid'];
      var i = Math.min(2, Math.floor(v * 3));
      if (NX.SceneManager) NX.SceneManager.setMode(modes[i], { crossfade: true });
    } },
    intensity: { set: function (v) {
      S.bcIntensity = 0.15 + v * 1.25;
      if (NX.VisualEngineManager && NX.VisualEngineManager.setIntensity) NX.VisualEngineManager.setIntensity(S.bcIntensity);
    } },
    trailsAmt: { set: function (v) {
      S.nexusPostTrails = Math.max(0, Math.min(1, v));
      var el = document.getElementById('nx-trails');
      if (el) el.value = String(Math.round(S.nexusPostTrails * 100));
    } },
    kaleido: { set: function (v) { S.postFxKaleido = Math.max(0, Math.min(1, v)); } },
    glitch: { set: function (v) { S.postFxGlitch = Math.max(0, Math.min(1, v)); } },
    asura: { set: function (v) {
      S.postFxAsura = Math.max(0, Math.min(1, v));
      var el = document.getElementById('nx-asura');
      if (el) el.value = String(Math.round(S.postFxAsura * 100));
    } },
    postFx: { set: function (v) {
      S.postFxKaleido = Math.max(0, Math.min(1, v * 0.55));
      S.postFxGlitch = Math.max(0, Math.min(1, v * 0.45));
      S.postFxAsura = Math.max(0, Math.min(1, v * 0.38));
    } },
    nextRandom: { set: function (v) {
      if (v > 0.9 && _nextRandomPrev <= 0.9) NX.goRandom();
      _nextRandomPrev = v;
    } },
    sceneFamily: { set: function (v) {
      var tags = ['calm', 'intense', 'fractal', 'tunnel', 'sacred'];
      var b = Math.min(tags.length - 1, Math.floor(Math.max(0, Math.min(1, v)) * tags.length));
      if (b === _sceneFamilyBucket) return;
      _sceneFamilyBucket = b;
      var tag = tags[b];
      if (!NX.sceneHasTag) return;
      var pool = [];
      for (var i = 0; i < NX.scenes.length; i++) if (NX.sceneHasTag(i, tag)) pool.push(i);
      if (!pool.length) return;
      var rnd2 = typeof NX.randomUnit === 'function' ? NX.randomUnit : Math.random;
      var pick = pool[Math.floor(rnd2() * pool.length)];
      if (pick === S.curS && pool.length > 1) {
        var j = pool.indexOf(pick);
        pick = pool[(j + 1 + Math.floor(rnd2() * (pool.length - 1))) % pool.length];
      }
      NX.goNext(pick);
    } },
    autoMorphCc: { set: function (v) {
      S.autoMorph = v > 0.5;
      var ab = document.getElementById('autobtn');
      if (ab) ab.classList.toggle('on', S.autoMorph);
      var t = document.getElementById('auto-timer'); if (t) t.textContent = S.autoMorph ? '-' : 'OFF';
    } },
    explodePulse: { set: function (v) {
      if (v > 0.88) { S.explode = 0.95; S.beat = 0.72; }
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
      if (NX.ui && NX.ui.refreshMidiMapPanel) NX.ui.refreshMidiMapPanel();
      return;
    }

    var mkey = ch + ':' + note;

    /* Note On → scene trigger or explode */
    if (status === 0x90 && vel > 0) {
      var m = mappings[mkey];
      if (m && m.type === 'note' && m.param === 'explode') { S.explode = 0.95; S.beat = 0.72; return; }
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
    loadProfiles();
    refreshProfileSelect();
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

  function getMappingList() {
    var out = [];
    Object.keys(mappings).forEach(function (k) {
      var m = mappings[k];
      if (m) out.push({ midiKey: k, type: m.type, param: m.param });
    });
    return out;
  }

  function getParamCatalog() {
    return Object.keys(paramDefs);
  }

  NX.midi = {
    init: init, startLearn: startLearn, clearMappings: clearMappings, getMappings: getMappings,
    getMappingList: getMappingList, getParamCatalog: getParamCatalog, paramDefs: paramDefs,
    setActiveProfile: setActiveProfile, panic: panic, refreshProfileSelect: refreshProfileSelect
  };
})();
