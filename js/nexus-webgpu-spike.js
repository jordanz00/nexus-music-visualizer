'use strict';
/**
 * nexus-webgpu-spike.js — Thin diagnostics bridge around NX.WgslGraph (copyExternalImageToTexture path).
 * True WebGPU→WebGL texture round-trip remains browser-specific; production stack uses #nx-wgpu overlay.
 */
(function () {
  function probe() {
    var gpu = typeof navigator !== 'undefined' && navigator.gpu;
    var wg = window.NX && NX.WgslGraph;
    return {
      navigatorGpu: !!gpu,
      wgslGraphPresent: !!wg,
      wgslReady: !!(wg && typeof wg.isReady === 'function' && wg.isReady()),
      wgslEnabled: !!(wg && typeof wg.getEnabled === 'function' && wg.getEnabled()),
      note: 'WgslGraph.renderFrame copies #c into a WebGPU texture chain; see js/nexus-engine/wgsl-graph.js'
    };
  }

  window.NX = window.NX || {};
  NX.WebGpuSpike = {
    probe: probe
  };

  try {
    if (new URLSearchParams(location.search).get('wgpu_probe') === '1' && typeof console !== 'undefined' && console.table) {
      console.table(probe());
    }
  } catch (eP) { /* ignore */ }
})();
