'use strict';
/**
 * NEXUS Engine Pro — hybrid preset library + DJ visual-style composer.
 * Each row = real Butterchurn key (from showcase) + seed → palette/warp/hue/bloom/scene.
 * Genres tag rows for filtering (Trance, Techno, Ambient, EDM, Glitch).
 */
(function () {
  var VARIANTS = ['Apex', 'Flux', 'Nova'];
  var GENRES = ['Trance', 'Techno', 'Ambient', 'EDM', 'Glitch'];

  /**
   * DJ “style” macro: engine params + default stack mode for live sets.
   * Does not load Butterchurn presets — pair with Pro hybrid or Showcase picks.
   */
  var VISUAL_STYLES = {
    trance: { SPD: 4, RCT: 6, WRP: 5, PAL: 3, morphDur: 2.4, mode: 'hybrid', trails: 0.08, bloomMul: 1.05 },
    techno: { SPD: 6, RCT: 8, WRP: 6, PAL: 4, morphDur: 1.15, mode: 'hybrid', trails: 0.04, bloomMul: 1.0 },
    ambient: { SPD: 2, RCT: 5, WRP: 3, PAL: 2, morphDur: 3.6, mode: 'hybrid', trails: 0.14, bloomMul: 0.92 },
    edm: { SPD: 7, RCT: 9, WRP: 7, PAL: 0, morphDur: 0.9, mode: 'hybrid', trails: 0.02, bloomMul: 1.12 },
    glitch: { SPD: 8, RCT: 10, WRP: 9, PAL: 1, morphDur: 0.68, mode: 'shader', trails: 0.06, bloomMul: 1.08 }
  };

  function build(showcase) {
    if (!showcase || !showcase.length) return [];
    var out = [];
    for (var i = 0; i < showcase.length; i++) {
      var b = showcase[i];
      for (var v = 0; v < VARIANTS.length; v++) {
        var gi = (i * 3 + v) % GENRES.length;
        out.push({
          label: b.label + ' · ' + VARIANTS[v],
          key: b.key,
          seed: i * 97 + v * 31 + 1,
          slot: i,
          genre: GENRES[gi]
        });
      }
    }
    return out;
  }

  function filterByGenre(list, genreKey) {
    if (!genreKey || genreKey === 'all') return list.slice();
    return list.filter(function (e) { return e.genre === genreKey; });
  }

  /**
   * @param {{ key: string, seed: number }} entry
   * @param {{ loadBc?: boolean, goScene?: boolean }} options
   */
  function apply(entry, options) {
    if (!entry) return;
    options = options || {};
    var loadBc = options.loadBc !== false;
    var goScene = options.goScene !== false;

    var S = NX.S;
    var P = NX.P;
    var seed = entry.seed | 0;

    P.PAL = seed % 6;
    P.WRP = 2 + (seed % 8);
    P.SPD = 2 + (seed % 7);
    P.RCT = 5 + (seed % 5);
    S.hueShift = ((seed * 13) % 50 - 25) / 250;
    S.postBloomMul = 0.8 + (seed % 6) * 0.07;

    var len = (NX.scenes && NX.scenes.length) || 0;
    if (goScene && len) {
      NX.goNext((S.curS + 2 + (seed % 11)) % len);
    }

    if (loadBc && entry.key && NX.PresetLibrary && NX.VisualEngineManager) {
      var preset = NX.PresetLibrary.getPreset(entry.key);
      var bt = 1.35 + (seed % 17) * 0.1;
      bt = Math.max(1, Math.min(3, bt));
      if (preset) NX.VisualEngineManager.loadPreset(preset, bt, entry.key);
    }

    if (NX.ui && NX.ui.syncControls) NX.ui.syncControls();
  }

  /**
   * @param {string} id — trance | techno | ambient | edm | glitch
   */
  function applyVisualStyle(id) {
    var st = VISUAL_STYLES[id];
    if (!st) return;
    var S = NX.S;
    var P = NX.P;
    P.SPD = st.SPD;
    P.RCT = st.RCT;
    P.WRP = st.WRP;
    P.PAL = st.PAL;
    S.morphDurationSec = st.morphDur;
    S.nexusPostTrails = st.trails;
    S.postBloomMul = st.bloomMul;
    if (st.mode && NX.SceneManager) {
      NX.SceneManager.setMode(st.mode, { crossfade: true, fadeSec: 0.9 });
    }
    if (NX.ui && NX.ui.syncControls) NX.ui.syncControls();
  }

  var api = {
    VARIANTS: VARIANTS,
    GENRES: GENRES,
    VISUAL_STYLES: VISUAL_STYLES,
    build: build,
    filterByGenre: filterByGenre,
    apply: apply,
    applyVisualStyle: applyVisualStyle
  };

  window.NXProPresets = api;
  window.NXSuperPresets = api;
})();
