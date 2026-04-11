'use strict';
/**
 * hybrid-layer-registry.js — Ordered hybrid stack metadata for NEXUS Engine Pro.
 *
 * WHO THIS IS FOR: operators and developers mapping “Resolume-style” layers to canvases.
 * WHAT IT DOES: documents the composite order (ambient → BC → WebGL → …) and exposes
 *   small helpers for presets / future SceneManager integration.
 * HOW IT CONNECTS: read by presets and UI; does not replace SceneManager — registry only.
 *
 * See plan: nexus_pro_vj_parity (homage packs + PRESET_PACK_2026).
 */
(function () {
  var NX = window.NX || (window.NX = {});

  /**
   * Logical layer types (composite contract). Order for rendering is
   * `ORDERED_LAYERS` — keep in sync with docs/LAYER-COMPOSITE-SPEC.md.
   * @readonly
   */
  var HybridLayerType = {
    AMBIENT: 'ambient',
    BUTTERCHURN: 'butterchurn',
    SHADER: 'shader',
    PROC_PARTICLES: 'procParticles',
    THREE: 'three',
    WEBGPU: 'webgpu',
    CLIP_UNDER: 'clipUnder',
    CLIP_OVER: 'clipOver'
  };

  /** Blend modes allowed for clip DOM + future deck UI (CSS-safe subset). */
  var BLEND_MODES = [
    'normal', 'screen', 'multiply', 'soft-light', 'plus-lighter',
    'overlay', 'hard-light', 'difference', 'exclusion'
  ];

  /** @type {{ id: string, domId: string, role: string }[]} */
  var ORDERED_LAYERS = [
    { id: 'ambient', domId: 'nx-ambient', role: 'OKLCH / color-mix wash' },
    { id: 'butterchurn', domId: 'c-bc', role: 'Aurora Field / Butterchurn' },
    { id: 'shader', domId: 'c', role: 'Main WebGL quad scenes' },
    { id: 'procParticles', domId: 'nx-proc-particles', role: 'Procedural particle canvas' },
    { id: 'three', domId: 'c-three', role: 'Three.js guest layer' },
    { id: 'webgpu', domId: 'nx-wgpu', role: 'WebGPU WGSL overlay' },
    { id: 'clipUnder', domId: 'nx-clip-under', role: 'Clip stack under' },
    { id: 'clipOver', domId: 'nx-clip-over', role: 'Clip stack over' }
  ];

  /**
   * @returns {ReadonlyArray<{ id: string, domId: string, role: string }>}
   */
  function getOrderedStack() {
    return ORDERED_LAYERS.slice();
  }

  /**
   * @param {string} id
   * @returns {{ id: string, domId: string, role: string } | null}
   */
  function getLayer(id) {
    for (var i = 0; i < ORDERED_LAYERS.length; i++) {
      if (ORDERED_LAYERS[i].id === id) return ORDERED_LAYERS[i];
    }
    return null;
  }

  /**
   * Preset hints for hybrid opacities (0–1). SceneManager remains authoritative at runtime.
   * @param {'club'|'ambient'|'mitd'|'full'} name
   * @returns {{ hybridBcOpacity: number, hybridShaderOpacity: number, visualMode: string }}
   */
  function hybridProfile(name) {
    if (name === 'mitd') {
      return { hybridBcOpacity: 0, hybridShaderOpacity: 1, visualMode: 'shader' };
    }
    if (name === 'ambient') {
      return { hybridBcOpacity: 0.55, hybridShaderOpacity: 0.45, visualMode: 'hybrid' };
    }
    if (name === 'club') {
      return { hybridBcOpacity: 0.85, hybridShaderOpacity: 1, visualMode: 'hybrid' };
    }
    return { hybridBcOpacity: 1, hybridShaderOpacity: 1, visualMode: 'hybrid' };
  }

  /**
   * Default per-layer state for JSON export / future deck persistence.
   * @param {string} layerId
   * @returns {{ id: string, opacity: number, blendMode: string, solo: boolean, bypass: boolean, audioDrive: string, busSend: string }}
   */
  function defaultLayerState(layerId) {
    return {
      id: layerId,
      opacity: 1,
      blendMode: 'normal',
      solo: false,
      bypass: false,
      audioDrive: 'none',
      busSend: 'main'
    };
  }

  /**
   * Full stack as serializable defaults (ordered).
   * @returns {object[]}
   */
  function defaultStackDocument() {
    var out = [];
    for (var i = 0; i < ORDERED_LAYERS.length; i++) {
      out.push(defaultLayerState(ORDERED_LAYERS[i].id));
    }
    return out;
  }

  /**
   * Validate a persisted layer stack document (showfile / deck export).
   * @param {unknown} doc
   * @returns {{ ok: boolean, error?: string }}
   */
  function validateStackDocument(doc) {
    if (!Array.isArray(doc)) return { ok: false, error: 'not_array' };
    var allowed = {};
    for (var a = 0; a < ORDERED_LAYERS.length; a++) allowed[ORDERED_LAYERS[a].id] = true;
    var j;
    for (j = 0; j < doc.length; j++) {
      var o = doc[j];
      if (!o || typeof o !== 'object') return { ok: false, error: 'bad_entry' };
      if (typeof o.id !== 'string' || !allowed[o.id]) return { ok: false, error: 'unknown_layer:' + o.id };
      if (typeof o.opacity === 'number' && (o.opacity < 0 || o.opacity > 1)) return { ok: false, error: 'opacity_range' };
      if (o.blendMode != null && typeof o.blendMode === 'string' && BLEND_MODES.indexOf(o.blendMode) < 0) {
        return { ok: false, error: 'blendMode' };
      }
      if (o.audioDrive != null && ['none', 'rms', 'bass', 'beat'].indexOf(String(o.audioDrive)) < 0) {
        return { ok: false, error: 'audioDrive' };
      }
    }
    return { ok: true };
  }

  NX.HybridLayers = {
    HybridLayerType: HybridLayerType,
    BLEND_MODES: BLEND_MODES.slice(),
    getOrderedStack: getOrderedStack,
    getLayer: getLayer,
    hybridProfile: hybridProfile,
    defaultLayerState: defaultLayerState,
    defaultStackDocument: defaultStackDocument,
    validateStackDocument: validateStackDocument,
    /** Version for debugging / showfile export */
    registryVersion: '2026.04.10'
  };
})();
