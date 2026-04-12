'use strict';
/**
 * nx-bpm-timeline.js — Phrase automation: advance scenes on beat pulses or beat-phase wraps.
 * Resets auto-morph timer when firing to avoid double-advances the same frame.
 */
(function () {
  var lastPulse = 0;
  var lastPhase = 0;
  var beatsInPhrase = 0;

  function resetTracking() {
    var S = NX.S;
    lastPulse = (S && S._beatPulseCount) || 0;
    lastPhase = typeof (S && S.beatPhase) === 'number' ? S.beatPhase : 0;
    beatsInPhrase = 0;
  }

  function phraseLen(S) {
    var n = (S && S.nexusBpmPhraseBeats) | 0;
    if (!n || n < 1) n = 16;
    return Math.min(128, Math.max(1, n));
  }

  function fire() {
    var S = NX.S;
    if (!S || S.morphing) return;
    S.presTimer = 0;
    if (typeof NX.goNext === 'function') NX.goNext();
  }

  function tick(dt) {
    var S = NX.S;
    if (!S || !S.nexusBpmTimelineEnabled || S.nexusPerfLock || S.nexusVizPerformance) return;
    if (S.morphing) return;
    var phrase = phraseLen(S);
    var mode = String(S.nexusBpmTimelineMode || 'clock');

    if (mode === 'pulse') {
      var pc = S._beatPulseCount || 0;
      if (pc < lastPulse) lastPulse = pc;
      if (pc > lastPulse) {
        beatsInPhrase += pc - lastPulse;
        lastPulse = pc;
        while (beatsInPhrase >= phrase) {
          beatsInPhrase -= phrase;
          fire();
        }
      }
      return;
    }

    var ph = typeof S.beatPhase === 'number' ? S.beatPhase : 0;
    if (lastPhase > 0.55 && ph < 0.2) {
      beatsInPhrase++;
      if (beatsInPhrase >= phrase) {
        beatsInPhrase = 0;
        fire();
      }
    }
    lastPhase = ph;
  }

  window.NX = window.NX || {};
  NX.BpmTimeline = {
    init: function () {
      resetTracking();
    },
    tick: tick,
    resetTracking: resetTracking
  };
})();
