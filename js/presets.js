'use strict';
/*  presets.js — Save / load engine + UI state to localStorage.
    Ships 4 built-in presets: Afterlife Dark, Festival Energy,
    Ambient Chill, Laser Show.                                  */

(function () {
  var S = NX.S, P = NX.P;
  var STORAGE_KEY = 'nx_presets';

  var builtIn = {
    'Afterlife Dark': { SPD: 3, RCT: 8, WRP: 6, PAL: 4, GAIN: 1.0, SMTH: 55, morphDur: 2.2, scene: 0, quality: 'balanced' },
    'Festival Energy': { SPD: 7, RCT: 9, WRP: 7, PAL: 1, GAIN: 1.2, SMTH: 45, morphDur: 0.9, scene: 0, quality: 'balanced' },
    'Ambient Chill': { SPD: 2, RCT: 4, WRP: 3, PAL: 2, GAIN: 0.8, SMTH: 70, morphDur: 3.5, scene: 0, quality: 'balanced' },
    'Laser Show': { SPD: 8, RCT: 10, WRP: 8, PAL: 0, GAIN: 1.3, SMTH: 40, morphDur: 0.7, scene: 0, quality: 'ultra' },
    'Club': { SPD: 7, RCT: 8, WRP: 7, PAL: 0, GAIN: 1.15, SMTH: 48, morphDur: 1.05, scene: 0, quality: 'balanced', visualMacro: 'club', postFxKaleido: 0, postFxGlitch: 0.04, nexusPostTrails: 0.03, postBloomMul: 1.12, visualMode: 'hybrid' },
    'Ambient Show': { SPD: 2, RCT: 5, WRP: 3, PAL: 2, GAIN: 0.85, SMTH: 72, morphDur: 3.2, scene: 0, quality: 'balanced', visualMacro: 'ambient', postFxKaleido: 0.05, postFxGlitch: 0, nexusPostTrails: 0.16, postBloomMul: 0.88, visualMode: 'hybrid' },
    'Psychedelic': { SPD: 5, RCT: 8, WRP: 7, PAL: 3, GAIN: 1.05, SMTH: 52, morphDur: 1.45, scene: 0, quality: 'balanced', visualMacro: 'psychedelic', postFxKaleido: 0.14, postFxGlitch: 0.05, nexusPostTrails: 0.11, postBloomMul: 1.08, visualMode: 'hybrid' }
  };

  function getUser() {
    try { var s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : {}; } catch (e) { return {}; }
  }
  function saveUser(all) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (e) { }
  }

  function capture() {
    return {
      SPD: P.SPD, RCT: P.RCT, WRP: P.WRP, PAL: P.PAL,
      GAIN: P.GAIN, SMTH: P.SMTH,
      TRIM: typeof P.TRIM === 'number' ? P.TRIM : 100,
      reactivityProfile: S.reactivityProfile || 'balanced',
      morphDur: S.morphDurationSec,
      scene: S.curS,
      quality: (function () { var q = document.getElementById('qsel'); return q ? q.value : 'balanced'; })(),
      hueShift: S.hueShift,
      postBloomMul: S.postBloomMul,
      nexusPostBloom: S.nexusPostBloom,
      nexusPostTrails: S.nexusPostTrails,
      visualMode: S.visualMode || 'hybrid',
      visualMacro: S.visualMacro || '',
      postFxKaleido: S.postFxKaleido,
      postFxGlitch: S.postFxGlitch
    };
  }

  function apply(preset) {
    P.SPD = preset.SPD != null ? preset.SPD : P.SPD;
    P.RCT = preset.RCT != null ? preset.RCT : P.RCT;
    P.WRP = preset.WRP != null ? preset.WRP : P.WRP;
    P.PAL = preset.PAL != null ? preset.PAL : P.PAL;
    P.GAIN = preset.GAIN != null ? preset.GAIN : P.GAIN;
    P.SMTH = preset.SMTH != null ? preset.SMTH : P.SMTH;
    if (preset.TRIM != null) P.TRIM = Math.max(50, Math.min(200, preset.TRIM));
    if (preset.reactivityProfile === 'punchy' || preset.reactivityProfile === 'balanced' || preset.reactivityProfile === 'smooth') {
      S.reactivityProfile = preset.reactivityProfile;
    }
    if (preset.morphDur != null) S.morphDurationSec = preset.morphDur;
    if (preset.quality) NX.setQualityPreset(preset.quality);
    if (preset.scene != null && preset.scene < NX.scenes.length) NX.goNext(preset.scene);
    if (preset.hueShift != null) S.hueShift = preset.hueShift;
    if (preset.postBloomMul != null) S.postBloomMul = preset.postBloomMul;
    if (preset.nexusPostBloom != null) S.nexusPostBloom = preset.nexusPostBloom;
    if (preset.nexusPostTrails != null) S.nexusPostTrails = preset.nexusPostTrails;
    if (preset.visualMode != null && NX.SceneManager) {
      NX.SceneManager.setMode(preset.visualMode, { crossfade: true, fadeSec: 0.75 });
    }
    if (preset.visualMacro != null) S.visualMacro = preset.visualMacro;
    if (preset.postFxKaleido != null) S.postFxKaleido = preset.postFxKaleido;
    if (preset.postFxGlitch != null) S.postFxGlitch = preset.postFxGlitch;
    if (NX.ui && NX.ui.syncControls) NX.ui.syncControls();
  }

  function save(name) {
    var all = getUser(); all[name] = capture(); saveUser(all);
  }

  function load(name) {
    var all = Object.assign({}, builtIn, getUser());
    if (all[name]) apply(all[name]);
  }

  function remove(name) {
    if (builtIn[name]) return;
    var all = getUser(); delete all[name]; saveUser(all);
  }

  function list() {
    var user = getUser();
    return Object.keys(builtIn).concat(Object.keys(user).filter(function (k) { return !builtIn[k]; }));
  }

  function exportJSON() { return JSON.stringify(capture(), null, 2); }
  function importJSON(json) { try { apply(JSON.parse(json)); } catch (e) { console.warn('Bad preset JSON'); } }

  NX.presets = { save: save, load: load, remove: remove, list: list, capture: capture, apply: apply, exportJSON: exportJSON, importJSON: importJSON };
})();
