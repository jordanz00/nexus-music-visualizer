'use strict';
/**
 * preset-resolve.js — Merge authored particle presets (JSON) with runtime context.
 * WHO: VolumetricFX + Mix UI. HOW: default → pack → optional override by genre/preset id.
 */
(function () {
  var DEFAULT_PRESET = {
    schemaVersion: 1,
    id: 'default',
    depthMode: 'proxy',
    kernelId: 'default',
    forces: { tornadoMul: 1, oceanMul: 1, vortexMul: 1, noiseMul: 1, swellMul: 1, dragLinMul: 1, dragQuadMul: 1 },
    colorLaw: { hueShift: 0, saturationMul: 1, brightnessMul: 1, beatFlash: 0.35 },
    spawn: { radiusMul: 1, impulseOnPreset: 0.45 },
    proxyDepth: { lumaWeight: 0.55, motionWeight: 2.4, temporalBlend: 0.82 },
    primitives: { points: true, ribbonGridStep: 8, ribbonOpacity: 0.42, metaballScreenPass: false, fluidDriverWeight: 0 },
    lod: { particleFbScale: 0.75, disableRibbonUnderVizPerf: true }
  };

  var PACK_TRANCE = {
    schemaVersion: 1,
    id: 'pack.trance',
    depthMode: 'proxy',
    kernelId: 'tight',
    forces: { tornadoMul: 1.25, oceanMul: 0.85, vortexMul: 1.15, noiseMul: 1.2, swellMul: 1.35, dragLinMul: 0.92, dragQuadMul: 1.08 },
    colorLaw: { hueShift: -0.04, saturationMul: 1.18, brightnessMul: 1.08, beatFlash: 0.55 },
    spawn: { radiusMul: 0.95, impulseOnPreset: 0.62 },
    proxyDepth: { lumaWeight: 0.48, motionWeight: 3.1, temporalBlend: 0.76 },
    primitives: { points: true, ribbonGridStep: 6, ribbonOpacity: 0.55, metaballScreenPass: true, fluidDriverWeight: 0 },
    lod: { particleFbScale: 0.72, disableRibbonUnderVizPerf: true }
  };

  var PACK_AMBIENT = {
    schemaVersion: 1,
    id: 'pack.ambient',
    depthMode: 'proxy',
    kernelId: 'ambient',
    forces: { tornadoMul: 0.72, oceanMul: 1.35, vortexMul: 0.88, noiseMul: 0.78, swellMul: 0.9, dragLinMul: 1.12, dragQuadMul: 1.05 },
    colorLaw: { hueShift: 0.06, saturationMul: 0.88, brightnessMul: 1.12, beatFlash: 0.22 },
    spawn: { radiusMul: 1.08, impulseOnPreset: 0.32 },
    proxyDepth: { lumaWeight: 0.62, motionWeight: 1.6, temporalBlend: 0.9 },
    primitives: { points: true, ribbonGridStep: 10, ribbonOpacity: 0.28, metaballScreenPass: false, fluidDriverWeight: 0.15 },
    lod: { particleFbScale: 0.85, disableRibbonUnderVizPerf: true }
  };

  var BUNDLED = {
    default: DEFAULT_PRESET,
    trance: PACK_TRANCE,
    ambient: PACK_AMBIENT
  };

  function deepMerge(base, over) {
    if (!over || typeof over !== 'object') return base;
    var out = {};
    var k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    }
    for (k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      var v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  function packFromGenre(genre) {
    var g = String(genre || '').toLowerCase().trim();
    if (g === 'all' || !g) return BUNDLED.default;
    if (g === 'trance' || g === 'techno' || g === 'edm') return BUNDLED.trance;
    if (g === 'ambient' || g === 'glitch') return BUNDLED.ambient;
    return BUNDLED.default;
  }

  /**
   * @param {object} S — NX.S
   * @returns {object} frozen merged preset
   */
  function resolve(S) {
    var look = (S && S.nexusParticleLook) ? String(S.nexusParticleLook) : 'default';
    var base = BUNDLED.default;
    if (look === 'trance') base = deepMerge(BUNDLED.default, BUNDLED.trance);
    else if (look === 'ambient') base = deepMerge(BUNDLED.default, BUNDLED.ambient);

    var merged = base;
    if (S && S.nexusParticleMatchGenre) {
      var pool = '';
      try {
        var el = document.getElementById('pro-genre-filter');
        if (el && el.value) pool = el.value;
      } catch (e) { /* ignore */ }
      merged = deepMerge(merged, packFromGenre(pool));
    }

    return merged;
  }

  /**
   * Pack subset of preset into Float32Array for GPU (vec4 slots).
   * Layout: 0 forces tornado/ocean/vortex/noise, 1 swell/dragLin/dragQuad/spare,
   * 2 colorLaw, 3 spawn + proxy luma/motion/temporal, 4 primitives ribbon step + opacity + meta + fluid
   * @param {object} preset
   * @returns {Float32Array} length 20
   */
  function toGpuParams(preset) {
    var f = preset.forces || {};
    var c = preset.colorLaw || {};
    var sp = preset.spawn || {};
    var px = preset.proxyDepth || {};
    var pr = preset.primitives || {};
    var arr = new Float32Array(20);
    arr[0] = f.tornadoMul != null ? f.tornadoMul : 1;
    arr[1] = f.oceanMul != null ? f.oceanMul : 1;
    arr[2] = f.vortexMul != null ? f.vortexMul : 1;
    arr[3] = f.noiseMul != null ? f.noiseMul : 1;
    arr[4] = f.swellMul != null ? f.swellMul : 1;
    arr[5] = f.dragLinMul != null ? f.dragLinMul : 1;
    arr[6] = f.dragQuadMul != null ? f.dragQuadMul : 1;
    arr[7] = 0;
    arr[8] = c.hueShift != null ? c.hueShift : 0;
    arr[9] = c.saturationMul != null ? c.saturationMul : 1;
    arr[10] = c.brightnessMul != null ? c.brightnessMul : 1;
    arr[11] = c.beatFlash != null ? c.beatFlash : 0.35;
    arr[12] = sp.radiusMul != null ? sp.radiusMul : 1;
    arr[13] = sp.impulseOnPreset != null ? sp.impulseOnPreset : 0.45;
    arr[14] = px.lumaWeight != null ? px.lumaWeight : 0.55;
    arr[15] = px.motionWeight != null ? px.motionWeight : 2.4;
    arr[16] = px.temporalBlend != null ? px.temporalBlend : 0.82;
    arr[17] = pr.ribbonGridStep != null ? pr.ribbonGridStep : 8;
    arr[18] = pr.ribbonOpacity != null ? pr.ribbonOpacity : 0.4;
    arr[19] = pr.fluidDriverWeight != null ? pr.fluidDriverWeight : 0;
    return arr;
  }

  window.NX = window.NX || {};
  NX.VolumetricPresetResolve = {
    resolve: resolve,
    toGpuParams: toGpuParams,
    bundled: BUNDLED
  };
})();
