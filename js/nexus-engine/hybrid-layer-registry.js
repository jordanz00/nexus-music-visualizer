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

  NX.HybridLayers = {
    getOrderedStack: getOrderedStack,
    getLayer: getLayer,
    hybridProfile: hybridProfile,
    /** Version for debugging / showfile export */
    registryVersion: '2026.04.10'
  };
})();
