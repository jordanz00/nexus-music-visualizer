'use strict';
/*  auto-director.js — Energy-based smart scene switching.
    Detects drops (energy spikes after quiet sections), calm passages,
    and builds. Switches scenes + triggers effects accordingly.        */

(function () {
  var S = NX.S, P = NX.P;

  var enabled = false;
  var _energy = 0, _prevEnergy = 0, _smoothEnergy = 0;
  var _calmTimer = 0, _buildTimer = 0, _lastSwitch = 0;
  var _energyHistory = [];
  var HISTORY_LEN = 60;

  /* Scene pools by mood */
  var calmScenes = [];
  var intenseScenes = [];
  var allScenes = [];

  function hasTag(sc, t) {
    return sc && sc.tags && sc.tags.indexOf(t) >= 0;
  }

  function categorize() {
    allScenes = [];
    calmScenes = [];
    intenseScenes = [];
    NX.scenes.forEach(function (sc, i) {
      allScenes.push(i);
      if (hasTag(sc, 'calm')) calmScenes.push(i);
      if (hasTag(sc, 'intense')) intenseScenes.push(i);
    });
    if (!calmScenes.length) calmScenes = allScenes.slice();
    if (!intenseScenes.length) intenseScenes = allScenes.slice();
  }

  function randomFrom(pool) {
    var idx = pool[Math.floor(Math.random() * pool.length)];
    if (idx === S.curS && pool.length > 1) return randomFrom(pool);
    return idx;
  }

  function loadRandomButterchurn(blend) {
    if (!NX.PresetLibrary || !NX.VisualEngineManager) return;
    var keys = NX.PresetLibrary.getKeys();
    if (!keys || !keys.length) return;
    var k = keys[Math.floor(Math.random() * keys.length)];
    var p = NX.PresetLibrary.getPreset(k);
    if (p) NX.VisualEngineManager.loadPreset(p, blend == null ? 2 : blend, k);
  }

  function switchVisual(intensePool, calmPool, blendHint) {
    var mode = S.visualMode || 'shader';
    if (mode === 'butterchurn') {
      loadRandomButterchurn(blendHint);
      return;
    }
    if (mode === 'hybrid' && blendHint != null && blendHint < 1 && NX.VisualEngineManager && NX.VisualEngineManager.isReady()) {
      loadRandomButterchurn(blendHint);
    }
    NX.goNext(randomFrom(intensePool || intenseScenes));
  }

  function tick(dt) {
    if (!enabled) return;

    /* Compute current energy */
    _energy = S.sBass * 0.4 + S.sMid * 0.25 + S.sHigh * 0.15 + S.sFlux * 0.2;
    _smoothEnergy += (_energy - _smoothEnergy) * 0.12;

    _energyHistory.push(_smoothEnergy);
    if (_energyHistory.length > HISTORY_LEN) _energyHistory.shift();

    var avg = 0;
    for (var i = 0; i < _energyHistory.length; i++) avg += _energyHistory[i];
    avg /= Math.max(1, _energyHistory.length);

    var now = performance.now() / 1000;
    var sinceLast = now - _lastSwitch;
    var bpmConf = typeof S.bpmConfidence === 'number' ? S.bpmConfidence : 0;
    var gate = 0.88 + 0.12 * bpmConf;

    /* DROP DETECTION: energy spike after quiet section */
    var spike = _energy - _prevEnergy;
    var isDrop = spike > 0.35 * gate && _prevEnergy < 0.25 && _energy > 0.45 && sinceLast > 3;
    var isBigDrop = spike > 0.5 * gate && _prevEnergy < 0.2 && _energy > 0.55 && sinceLast > 4;

    if (isBigDrop) {
      S.explode = 0.72; S.beat = 0.78;
      S.morphDurationSec = 0.5;
      switchVisual(intenseScenes, null, 0.55);
      _lastSwitch = now;
      _calmTimer = 0; _buildTimer = 0;
    } else if (isDrop) {
      S.beat = 0.62;
      S.morphDurationSec = 0.8;
      switchVisual(intenseScenes, null, 1.2);
      _lastSwitch = now;
      _calmTimer = 0; _buildTimer = 0;
    }

    /* CALM DETECTION: sustained low energy */
    if (_smoothEnergy < 0.15) {
      _calmTimer += dt;
      if (_calmTimer > 8 && sinceLast > 6) {
        S.morphDurationSec = 3.0;
        if ((S.visualMode || 'shader') === 'butterchurn') loadRandomButterchurn(3.5);
        else NX.goNext(randomFrom(calmScenes));
        _lastSwitch = now; _calmTimer = 0;
      }
    } else {
      _calmTimer = Math.max(0, _calmTimer - dt * 2);
    }

    /* BUILD DETECTION: rising energy */
    if (_smoothEnergy > avg * 1.3 && _smoothEnergy > 0.3) {
      _buildTimer += dt;
      if (_buildTimer > 5 && sinceLast > 6) {
        S.morphDurationSec = 1.2;
        switchVisual(intenseScenes, null, 1.8);
        _lastSwitch = now; _buildTimer = 0;
      }
    } else {
      _buildTimer = Math.max(0, _buildTimer - dt);
    }

    /* PERIODIC: if nothing else triggers, switch every 15-25s */
    if (sinceLast > 15 + Math.random() * 10) {
      S.morphDurationSec = 1.8;
      if ((S.visualMode || 'shader') === 'butterchurn') loadRandomButterchurn(2.5);
      else NX.goNext(randomFrom(_smoothEnergy > 0.25 ? intenseScenes : calmScenes));
      _lastSwitch = now;
    }

    _prevEnergy = _energy;
  }

  function enable() {
    if (!allScenes.length) categorize();
    enabled = true; _lastSwitch = performance.now() / 1000;
  }
  function disable() { enabled = false; }
  function toggle() { enabled ? disable() : enable(); return enabled; }
  function isEnabled() { return enabled; }

  NX.autoDirector = { tick: tick, enable: enable, disable: disable, toggle: toggle, isEnabled: isEnabled, categorize: categorize };
})();
