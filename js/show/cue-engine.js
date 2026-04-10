'use strict';
/**
 * Cue list + executors — fires on ShowClock.getSeconds() with ±window; integrates scenes, DMX, clips.
 */
(function () {
  var STORAGE = 'nexus.show.cues.v1';
  var EXEC_STORAGE = 'nexus.show.exec.v1';
  var cues = [];
  var fired = {};
  var windowSec = 0.12;
  var executors = [
    { label: 'A', cueId: '' }, { label: 'B', cueId: '' }, { label: 'C', cueId: '' },
    { label: 'D', cueId: '' }, { label: 'E', cueId: '' }, { label: 'F', cueId: '' }
  ];

  function load() {
    try {
      var j = localStorage.getItem(STORAGE);
      cues = j ? JSON.parse(j) : [];
      if (!Array.isArray(cues)) cues = [];
      var ej = localStorage.getItem(EXEC_STORAGE);
      if (ej) {
        var ex = JSON.parse(ej);
        if (Array.isArray(ex) && ex.length === executors.length) {
          for (var ei = 0; ei < ex.length; ei++) {
            executors[ei] = { label: executors[ei].label, cueId: (ex[ei] && ex[ei].cueId) ? ex[ei].cueId : '' };
          }
        }
      }
    } catch (e) {
      cues = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(cues));
      localStorage.setItem(EXEC_STORAGE, JSON.stringify(executors));
    } catch (e) { }
  }

  function smpteToSec(h, m, s, f, fps) {
    fps = fps || 30;
    return ((h * 60 + m) * 60 + s) + f / fps;
  }

  function cueTimeSec(c) {
    if (typeof c.tSec === 'number') return c.tSec;
    if (c.smpte) return smpteToSec(c.smpte.h | 0, c.smpte.m | 0, c.smpte.s | 0, c.smpte.f | 0, c.smpte.fps || 30);
    return 0;
  }

  function runAction(a) {
    if (!a || !a.type) return;
    if (a.type === 'scene' && typeof a.index === 'number' && NX.goNext) {
      NX.goNext(a.index | 0);
      return;
    }
    if (a.type === 'random' && NX.goRandom) {
      NX.goRandom();
      return;
    }
    if (a.type === 'dmx' && NX.OlaClient && a.channels) {
      var u = a.universe != null ? a.universe | 0 : 0;
      var arr = a.channels;
      if (Array.isArray(arr)) NX.OlaClient.setDmx(u, arr).catch(function () { });
      return;
    }
    if (a.type === 'clip' && NX.ClipLayers) {
      if (a.op === 'play') NX.ClipLayers.playSlot(a.slot | 0, a.below !== false);
      if (a.op === 'opacity') NX.ClipLayers.setOpacity(a.slot | 0, a.below !== false, +a.value);
      if (a.op === 'stop') NX.ClipLayers.stopSlot(a.slot | 0, a.below !== false);
      return;
    }
    if (a.type === 'explode' && NX.S) {
      NX.S.explode = 0.95;
      NX.S.beat = 0.85;
    }
  }

  function fireCue(c) {
    if (!c || !c.actions) return;
    for (var i = 0; i < c.actions.length; i++) runAction(c.actions[i]);
  }

  function tick(dt) {
    var t = NX.ShowClock && NX.ShowClock.getSeconds ? NX.ShowClock.getSeconds() : 0;
    var pulse = NX.S && typeof NX.S._beatPulseCount === 'number' ? NX.S._beatPulseCount : 0;
    var i;
    for (i = 0; i < cues.length; i++) {
      var c = cues[i];
      if (!c || !c.id || !c.enabled) continue;
      if (c.trigger === 'beat') {
        var ev = Math.max(1, parseInt(c.everyBeats, 10) || 8);
        var ph = Math.max(0, (parseInt(c.phaseBeats, 10) || 0) % ev);
        if (typeof c._prevPulse !== 'number') c._prevPulse = pulse;
        if (pulse > c._prevPulse) {
          var p;
          for (p = c._prevPulse + 1; p <= pulse; p++) {
            if (p >= ph && (p - ph) % ev === 0) fireCue(c);
          }
          c._prevPulse = pulse;
        }
        continue;
      }
      var ct = cueTimeSec(c);
      if (t + windowSec >= ct && t - windowSec <= ct) {
        if (!fired[c.id]) {
          fired[c.id] = true;
          fireCue(c);
        }
      } else if (t > ct + windowSec * 3) {
        fired[c.id] = false;
      }
    }
  }

  function armAll() {
    fired = {};
    cues.forEach(function (c) {
      if (c) {
        delete c._prevPulse;
        delete c._lastSeenPulse;
      }
    });
  }

  function addCue(obj) {
    obj.id = obj.id || ('c' + Date.now());
    obj.enabled = obj.enabled !== false;
    obj.actions = obj.actions || [];
    cues.push(obj);
    save();
    return obj;
  }

  function removeCue(id) {
    cues = cues.filter(function (c) { return c.id !== id; });
    save();
  }

  function bindExecutor(idx, cueId) {
    if (idx < 0 || idx >= executors.length) return;
    executors[idx].cueId = cueId || '';
    save();
  }

  function fireExecutor(idx) {
    var ex = executors[idx];
    if (!ex || !ex.cueId) return;
    var c = cues.filter(function (x) { return x.id === ex.cueId; })[0];
    if (c) fireCue(c);
  }

  function getCues() {
    return cues.slice();
  }

  load();

  window.NX = window.NX || {};
  NX.CueEngine = {
    tick: tick,
    load: load,
    save: save,
    addCue: addCue,
    removeCue: removeCue,
    getCues: getCues,
    fireCue: fireCue,
    armAll: armAll,
    bindExecutor: bindExecutor,
    fireExecutor: fireExecutor,
    getExecutors: function () { return executors.slice(); }
  };
})();
