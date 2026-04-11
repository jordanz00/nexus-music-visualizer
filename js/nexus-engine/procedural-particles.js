'use strict';
/**
 * Lightweight 2D procedural particle sheet behind WebGL — slow drift, soft trails.
 * Targets `#nx-proc-particles`. Respects `prefers-reduced-motion` and `NX.S.nexusPerfLock`.
 */
(function () {
  var canvas = null;
  var ctx = null;
  var w = 0;
  var h = 0;
  var parts = [];
  var time = 0;
  var count = 380;
  var inited = false;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function noise2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function resize() {
    canvas = document.getElementById('nx-proc-particles');
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(2, Math.floor((window.innerWidth || 800) * dpr));
    h = Math.max(2, Math.floor((window.innerHeight || 600) * dpr));
    canvas.width = w;
    canvas.height = h;
  }

  function init() {
    if (inited) return;
    if (reducedMotion()) return;
    canvas = document.getElementById('nx-proc-particles');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    inited = true;
    resize();
    parts.length = 0;
    var i;
    for (i = 0; i < count; i++) {
      parts.push({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0 });
    }
    window.addEventListener('resize', resize);
  }

  function reseed() {
    var i;
    for (i = 0; i < parts.length; i++) {
      parts[i].x = Math.random() * w;
      parts[i].y = Math.random() * h;
      parts[i].vx = 0;
      parts[i].vy = 0;
    }
  }

  function tick(dt) {
    if (reducedMotion() || !canvas || !ctx || w < 4 || h < 4) return;
    var S = window.NX && NX.S;
    var perf = S && S.nexusPerfLock;
    if (canvas) canvas.classList.toggle('nx-proc-dim', !!perf);

    time += dt * 0.28;
    var vd = S && typeof S._visualDrive === 'number' ? S._visualDrive : 0.3;
    if (vd < 0) vd = 0;
    if (vd > 1) vd = 1;
    var ph = S && typeof S.procPhase === 'number' ? S.procPhase : 0.5;

    ctx.fillStyle = perf ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, 0, w, h);

    var n = parts.length;
    var i;
    var p;
    var nx;
    var ny;
    var sp = (perf ? 0.42 : 0.85) * (0.25 + vd * 0.75);

    for (i = 0; i < n; i++) {
      p = parts[i];
      nx = noise2(p.x * 0.0031 + time * 0.06, p.y * 0.0031 + ph * 1.7);
      ny = noise2(p.y * 0.0031 - time * 0.045, p.x * 0.0031 + 19.1);
      p.vx = p.vx * 0.94 + (nx - 0.5) * 0.09 * sp;
      p.vy = p.vy * 0.94 + (ny - 0.5) * 0.09 * sp;
      p.x += p.vx * dt * 55;
      p.y += p.vy * dt * 55;
      if (p.x < 0) p.x += w;
      else if (p.x > w) p.x -= w;
      if (p.y < 0) p.y += h;
      else if (p.y > h) p.y -= h;
      var a = 0.04 + nx * 0.07 * vd;
      ctx.fillStyle = 'rgba(160,210,255,' + a + ')';
      ctx.fillRect(p.x, p.y, perf ? 1.2 : 1.6, perf ? 1.2 : 1.6);
    }
  }

  window.NX = window.NX || {};
  NX.ProcParticles = {
    init: init,
    tick: tick,
    reseed: reseed
  };
})();
