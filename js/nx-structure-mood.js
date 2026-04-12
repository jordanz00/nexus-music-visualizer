'use strict';
/**
 * nx-structure-mood.js — 5-state section classifier (hysteresis) + smooth mood targets.
 * Uses PRO audio suite outputs on NX.S (see nexus-pro-audio-science.js).
 */
(function () {
  if (!window.NX) return;

  var STATES = ['INTRO', 'GROOVE', 'BUILD', 'DROP', 'BREAKDOWN'];
  var MOOD = {
    INTRO: { bloom: 0.85, morph: 2.8, spdMul: 0.85 },
    GROOVE: { bloom: 1.0, morph: 2.2, spdMul: 1 },
    BUILD: { bloom: 1.12, morph: 1.35, spdMul: 1.08 },
    DROP: { bloom: 1.28, morph: 0.95, spdMul: 1.12 },
    BREAKDOWN: { bloom: 0.72, morph: 3.1, spdMul: 0.78 }
  };

  var state = 'GROOVE';
  var streak = 0;
  var pending = 'GROOVE';
  var lastClass = 'GROOVE';
  var _blend = { bloom: 1, morph: 2.2, spdMul: 1 };

  function classify(S) {
    var tr = typeof S.sTransient === 'number' ? S.sTransient : 0;
    var hm = (typeof S.sMid === 'number' ? S.sMid : 0) * 0.55 + (typeof S.sHigh === 'number' ? S.sHigh : 0) * 0.45;
    var struct = typeof S.proPA === 'number' ? S.proPA : 0.5;
    var rms = typeof S.micEnergy === 'number' ? S.micEnergy : 0;
    if (tr > 0.55 && struct > 0.58) return 'BUILD';
    if (tr < 0.12 && hm < 0.18) return 'BREAKDOWN';
    if (rms > 0.42 && hm > 0.35) return 'DROP';
    if (rms < 0.08 && tr < 0.2) return 'INTRO';
    return 'GROOVE';
  }

  function applyMoodProfile(name) {
    if (!NX.S || !MOOD[name]) return;
    pending = name;
    streak = 3;
    lastClass = name;
    state = name;
  }

  function tick(dt) {
    var S = NX.S;
    if (!S || !S.micOn) return;
    var c = classify(S);
    if (c === pending) {
      streak = Math.min(12, streak + 1);
    } else {
      pending = c;
      streak = 1;
    }
    if (streak >= 3 && c !== state) {
      state = c;
      lastClass = state;
    }
    var tgt = MOOD[state] || MOOD.GROOVE;
    var a = Math.min(0.022, Math.max(0.004, dt * 1.4));
    _blend.bloom += (tgt.bloom - _blend.bloom) * a;
    _blend.morph += (tgt.morph - _blend.morph) * a;
    _blend.spdMul += (tgt.spdMul - _blend.spdMul) * a;
    S.postBloomMul = Math.max(0.55, Math.min(1.85, (S.postBloomMul || 1) * 0.92 + _blend.bloom * 0.08));
    S.morphDurationSec = Math.max(0.55, Math.min(4.2, _blend.morph * 0.35 + (S.morphDurationSec || 2) * 0.65));
    S._structureMoodSpdHint = _blend.spdMul;
    S.structureMoodState = state;
    S.structureMoodStreak = streak;
  }

  NX.StructureMood = {
    tick: tick,
    applyMoodProfile: applyMoodProfile,
    getState: function () { return state; },
    MOOD: MOOD,
    STATES: STATES
  };
  NX.applyMoodProfile = applyMoodProfile;
})();
