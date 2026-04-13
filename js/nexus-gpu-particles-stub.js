'use strict';
/**
 * nexus-gpu-particles-stub.js — Replaces removed nexus-gpu-particles.js.
 * Keeps NX.GpuParticles / NX.VolumetricParticles symbols so engine + volumetric + FxChain
 * stay stable; sim is inert (integrated volumetric path stays off until a new sim source exists).
 * Screen GPU particles: js/scenes/particles-gpu.js (NX.particles).
 */
(function () {
  window.NX = window.NX || {};
  function noop() {}
  NX.GpuParticles = {
    init: noop,
    tearDown: noop,
    tick: noop,
    renderOverlay: noop,
    isReady: function () { return false; },
    notifyPresetChange: noop,
    getSimReadState: function () { return null; }
  };
  NX.VolumetricParticles = {
    triggerExplosion: noop,
    setExplosionCenter: noop,
    setModes: noop,
    setWind: noop,
    setGravity: noop,
    setDrag: noop,
    setDepthTest: noop
  };
})();
