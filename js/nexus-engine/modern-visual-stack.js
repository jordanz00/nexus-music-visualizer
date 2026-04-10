'use strict';
/**
 * Modern Visual Stack — recent browser graphics/CSS surfaces wired into NEXUS.
 *
 * Grounded in platform shifts from roughly 2021–2025: WebGPU in Chromium/Safari/Firefox
 * shipping waves, perceptual OKLCH + color-mix() in CSS, registered custom properties
 * (@property / registerProperty), and the View Transitions API for UI state changes.
 *
 * This module does not replace the WebGL path; it adds audio-reactive ambient lighting
 * (CSS layer under the main canvas) and small UX hooks with safe feature detection.
 */
(function () {
  var root = document.documentElement;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var caps = {
    webgpu: null,
    viewTransitions: typeof document.startViewTransition === 'function',
    oklch: !!(window.CSS && CSS.supports && CSS.supports('color', 'oklch(70% 0.12 200)')),
    colorMix: !!(window.CSS && CSS.supports && CSS.supports('color', 'color-mix(in oklch, red, blue)'))
  };

  function probeWebGPU() {
    if (!navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') {
      caps.webgpu = false;
      root.dataset.nxWebgpu = '0';
      return;
    }
    navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).then(function (adapter) {
      caps.webgpu = !!adapter;
      root.dataset.nxWebgpu = adapter ? '1' : '0';
    }).catch(function () {
      caps.webgpu = false;
      root.dataset.nxWebgpu = '0';
    });
  }

  /**
   * Push analyzer-driven values into CSS custom properties for OKLCH / HSL fallbacks.
   */
  function tick() {
    var S = window.NX && NX.S;
    if (!S) return;
    var h = 175 + (S.sMid || 0) * 100 + (typeof S.beatVisual === 'number' ? S.beatVisual : 0) * 55 + (S.hueShift || 0) * 80;
    while (h > 360) h -= 360;
    while (h < 0) h += 360;
    var c = 0.04 + (S.sBass || 0) * 0.14 + (typeof S.sTransient === 'number' ? S.sTransient : 0) * 0.1;
    var l = 0.06 + (S.sVol || 0) * 0.1;
    if (reducedMotion) {
      c *= 0.45;
      l *= 0.75;
    }
    var vd = typeof S._visualDrive === 'number' ? S._visualDrive : 1;
    if (vd < 0) vd = 0;
    if (vd > 1) vd = 1;
    c *= 0.35 + 0.65 * vd;
    l *= 0.5 + 0.5 * vd;
    c = Math.min(0.28, c);
    l = Math.min(0.22, l);
    root.style.setProperty('--nx-amb-h', String(h));
    root.style.setProperty('--nx-amb-c', String(c));
    root.style.setProperty('--nx-amb-l', String(l));
    root.style.setProperty('--nx-fb-h', String(Math.round(h)));
    var mx = S.mouseSmooth || [0, 0];
    root.style.setProperty('--nx-spot-x', (50 + mx[0] * 38) + '%');
    root.style.setProperty('--nx-spot-y', (32 - mx[1] * 22) + '%');
    root.classList.toggle('nx-amb-subtle', !!S.nexusPerfLock);
  }

  /**
   * Run a synchronous DOM update inside document.startViewTransition when supported.
   * Used for low-risk moments (e.g. splash → app), not every animation frame.
   *
   * @param {function(): void} fn
   */
  function wrapUiTransition(fn) {
    if (!caps.viewTransitions || reducedMotion || typeof document.startViewTransition !== 'function') {
      if (typeof fn === 'function') fn();
      return;
    }
    try {
      document.startViewTransition(function () {
        if (typeof fn === 'function') fn();
      });
    } catch (e) {
      if (typeof fn === 'function') fn();
    }
  }

  function init() {
    probeWebGPU();
    root.classList.add('nx-modern-vis');
    if (!caps.oklch) root.classList.add('nx-fallback-amb');
  }

  window.NX = window.NX || {};
  NX.ModernVisualStack = {
    init: init,
    tick: tick,
    wrapUiTransition: wrapUiTransition,
    getCaps: function () { return caps; }
  };
})();
