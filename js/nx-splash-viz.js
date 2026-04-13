'use strict';
/**
 * nx-splash-viz.js — Boot splash motion: synthetic “audio” (no mic) drives particles,
 * spectrum shimmer, and pulse rings until #splash is dismissed.
 *
 * WHO THIS IS FOR: operators seeing the app cold-load on venue projectors.
 * WHAT IT DOES: lightweight 2D canvas behind the splash card; stops on splash.out.
 * HOW IT CONNECTS: index.html loads this in <head> before the module loader; no NX dependency.
 */
(function () {
  var canvas = null;
  var ctx = null;
  var w = 0;
  var h = 0;
  var dpr = 1;
  var raf = 0;
  var parts = [];
  var N = 520;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function splashActive() {
    var sp = document.getElementById('splash');
    if (!sp) return false;
    if (sp.classList.contains('out')) return false;
    if (sp.style.display === 'none') return false;
    return true;
  }

  function resize() {
    canvas = document.getElementById('nx-splash-stage');
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(8, Math.floor((window.innerWidth || 800) * dpr));
    h = Math.max(8, Math.floor((window.innerHeight || 600) * dpr));
    canvas.width = w;
    canvas.height = h;
  }

  function noise2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function synthBands(t) {
    var bass = Math.pow(Math.max(0, Math.sin(t * 2.2)), 3.2) * 0.85 + Math.sin(t * 0.37) * 0.08 + 0.06;
    var mid = Math.pow(Math.max(0, Math.sin(t * 3.8 + 1.1)), 2.1) * 0.55 + Math.sin(t * 0.91 + 2.4) * 0.12 + 0.08;
    var hi = Math.pow(Math.max(0, Math.sin(t * 6.2 + 0.4)), 1.6) * 0.42 + Math.sin(t * 1.7) * 0.1 + 0.05;
    var flux = Math.abs(Math.sin(t * 4.5)) * 0.35 + Math.abs(Math.sin(t * 11.3)) * 0.22;
    var beat = Math.pow(Math.max(0, Math.sin(t * 3.14159)), 12) * 0.95;
    return { bass: bass, mid: mid, hi: hi, flux: flux, beat: beat };
  }

  function initParts() {
    parts.length = 0;
    var i;
    for (i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        z: 0.2 + Math.random() * 0.8,
        ph: Math.random() * 6.28318530718
      });
    }
  }

  function drawSpectrum(t, bands) {
    var bars = 56;
    var gap = w / bars;
    var baseY = h * 0.92;
    var bi;
    for (bi = 0; bi < bars; bi++) {
      var wave = Math.sin(t * 2.4 + bi * 0.31) * 0.5 + 0.5;
      var hMix = bands.bass * 0.42 + bands.mid * 0.35 + bands.hi * 0.28;
      var amp = (0.12 + wave * 0.88) * h * 0.14 * (0.55 + hMix * 1.15);
      amp += bands.beat * h * 0.06 * (0.4 + (bi / bars) * 0.6);
      var x = bi * gap + gap * 0.18;
      var bw = Math.max(1.2, gap * 0.64);
      var hue = 168 + bi * 2.8 + bands.flux * 40 + t * 18;
      ctx.fillStyle = 'hsla(' + hue + ',78%,58%,' + (0.22 + bands.mid * 0.2) + ')';
      ctx.fillRect(x, baseY - amp, bw, amp);
    }
  }

  function frame(now) {
    if (!canvas || !ctx) return;
    if (!splashActive()) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    var t = now * 0.001;
    var bands = synthBands(t);
    var cx = w * 0.5;
    var cy = h * 0.42;
    var dt = 0.016;

    ctx.fillStyle = 'rgba(2,3,8,0.22)';
    ctx.fillRect(0, 0, w, h);

    var pulse = bands.beat * 0.85 + bands.bass * 0.35;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.55);
    g.addColorStop(0, 'rgba(0,255,220,' + (0.04 + pulse * 0.14) + ')');
    g.addColorStop(0.35, 'rgba(80,140,255,' + (0.02 + bands.mid * 0.08) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var rings = 4;
    var ri;
    for (ri = 0; ri < rings; ri++) {
      var phase = t * (1.1 + ri * 0.22) + ri * 1.7;
      var rad = (Math.min(w, h) * 0.08) + (0.5 + 0.5 * Math.sin(phase)) * Math.min(w, h) * (0.22 + ri * 0.07);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, 6.28318530718);
      ctx.strokeStyle = 'rgba(0,229,255,' + (0.04 + bands.hi * 0.07 + pulse * 0.06) + ')';
      ctx.lineWidth = 1.2 + pulse * 2.2;
      ctx.stroke();
    }

    var spBase = (0.35 + bands.bass * 1.1 + bands.flux * 0.75 + pulse * 0.9) * 140 * dt;
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      var nx = noise2(p.x * 0.002 + t * 0.35, p.y * 0.002);
      var ny = noise2(p.y * 0.002 - t * 0.28, p.x * 0.002 + 5);
      p.vx += (nx - 0.5) * spBase;
      p.vy += (ny - 0.5) * spBase;
      p.vx += (bands.mid - 0.4) * 60 * dt * (p.z + 0.2);
      p.vy += (-bands.bass * 0.55 + bands.hi * 0.25) * 70 * dt;
      var dx = p.x - cx;
      var dy = p.y - cy;
      var dist = Math.sqrt(dx * dx + dy * dy) + 1e-4;
      var swirl = (48 + bands.flux * 80 + pulse * 120) * dt;
      p.vx += (-dy / dist) * swirl * 0.018 * p.z;
      p.vy += (dx / dist) * swirl * 0.018 * p.z;
      if (pulse > 0.2) {
        p.vx += (dx / dist) * pulse * 28 * dt;
        p.vy += (dy / dist) * pulse * 28 * dt;
      }
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt * 60 * 0.018;
      p.y += p.vy * dt * 60 * 0.018;
      if (p.x < -40) p.x = w + 40;
      else if (p.x > w + 40) p.x = -40;
      if (p.y < -40) p.y = h + 40;
      else if (p.y > h + 40) p.y = -40;

      var hue = 175 + bands.mid * 70 + p.z * 40 + nx * 30 + t * 22;
      var a = (0.035 + bands.hi * 0.04 + pulse * 0.05) * p.z;
      ctx.fillStyle = 'hsla(' + hue + ',82%,62%,' + a + ')';
      var sz = 1.2 + p.z * 2.4 + bands.bass * 1.8;
      ctx.fillRect(p.x, p.y, sz, sz);
    }

    drawSpectrum(t, bands);

    raf = requestAnimationFrame(frame);
  }

  function boot() {
    if (reduced) return;
    canvas = document.getElementById('nx-splash-stage');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    resize();
    initParts();
    window.addEventListener('resize', function () {
      resize();
      initParts();
    });
    raf = requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
