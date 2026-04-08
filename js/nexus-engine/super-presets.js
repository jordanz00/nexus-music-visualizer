'use strict';
/**
 * NEXUS Engine Super — procedural variant presets built on real Butterchurn keys.
 * Each row = same pack preset as showcase + unique seed → palette/warp/hue/bloom/scene bias.
 * No invented MilkDrop JSON; variation is engine-side only.
 */
(function () {
  var VARIANTS = ['Apex', 'Flux', 'Nova'];

  /**
   * @param {{ label: string, key: string }[]} showcase — from PresetLibrary.getShowcase()
   * @returns {{ label: string, key: string, seed: number, slot: number }[]}
   */
  function build(showcase) {
    if (!showcase || !showcase.length) return [];
    var out = [];
    for (var i = 0; i < showcase.length; i++) {
      var b = showcase[i];
      for (var v = 0; v < VARIANTS.length; v++) {
        out.push({
          label: b.label + ' · ' + VARIANTS[v],
          key: b.key,
          seed: i * 97 + v * 31 + 1,
          slot: i
        });
      }
    }
    return out;
  }

  /**
   * Apply super-preset: procedural layer params + optional Butterchurn load.
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
      if (preset) NX.VisualEngineManager.loadPreset(preset, bt);
    }

    if (NX.ui && NX.ui.syncControls) NX.ui.syncControls();
  }

  window.NXSuperPresets = { VARIANTS: VARIANTS, build: build, apply: apply };
})();
