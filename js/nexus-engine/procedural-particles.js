'use strict';
/**
 * 2D procedural particle sheet (#nx-proc-particles) — dense, scene-aware motion:
 * ocean waves, fire updraft + ember palette, shockwave rings / radial “light” on beats,
 * explosions (radial kick + expanding rings), audio-reactive HSL. Screen blend.
 */
(function () {
  var canvas = null;
  var ctx = null;
  var w = 0;
  var h = 0;
  var parts = [];
  var time = 0;
  /** Desktop target; throttled under perf / iOS. */
  var baseCount = 820;
  var maxParts = 1180;
  var perfCap = 420;
  var inited = false;
  var lastSceneKey = '';
  var warmFrames = 0;
  var prevBeatVisRaw = 0;
  var pulse = 0;
  var cx = 0;
  var cy = 0;
  /** Shockwave rings for explosion / lighting read. */
  var rings = [];
  var maxRings = 10;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function noise2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function sceneKey() {
    var si = (NX.S && typeof NX.S.curS === 'number') ? NX.S.curS : 0;
    var pal = (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0;
    return si + ':' + pal;
  }

  /**
   * @returns {{ field: number, hue0: number, hue1: number, grav: number, curl: number, radial: number, wind: number, chaos: number, ocean: number, fire: number, burst: number }}
   */
  function fieldParams() {
    var si = (NX.S && typeof NX.S.curS === 'number') ? NX.S.curS : 0;
    var pal = (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0;
    var f = (si * 5 + pal * 3 + si * pal) % 8;
    var palHue = [198, 18, 145, 268, 210, 38][pal % 6];
    var hueSpread = 48 + (f % 3) * 22;
    var grav = (f === 1 || f === 4) ? -0.55 : (f === 2 || f === 6) ? 0.08 : 0.35;
    var curl = 0.65 + (f % 4) * 0.18;
    var radial = (f === 2 || f === 5 || f === 7) ? 1.15 : 0.35;
    var wind = (f === 3 || f === 0) ? 1.0 : 0.45;
    var chaos = 0.25 + (f % 5) * 0.12;
    var ocean = (f === 0 || f === 3) ? 1 : (f === 7 ? 0.4 : 0.12);
    var fire = (f === 1 || f === 4) ? 1 : 0;
    var burst = (f === 2 || f === 5 || f === 6) ? 0.92 : 0.28;
    return {
      field: f,
      hue0: palHue + si * 7,
      hue1: hueSpread,
      grav: grav,
      curl: curl,
      radial: radial,
      wind: wind,
      chaos: chaos,
      ocean: ocean,
      fire: fire,
      burst: burst
    };
  }

  function targetParticleCount(perf) {
    var fp = fieldParams();
    var n = baseCount + fp.field * 28 + Math.floor(fp.ocean * 80) + Math.floor(fp.fire * 60);
    if (perf) n = Math.min(perfCap, Math.floor(n * 0.52));
    return Math.min(maxParts, n);
  }

  function resize() {
    canvas = document.getElementById('nx-proc-particles');
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(2, Math.floor((window.innerWidth || 800) * dpr));
    h = Math.max(2, Math.floor((window.innerHeight || 600) * dpr));
    canvas.width = w;
    canvas.height = h;
    cx = w * 0.5;
    cy = h * 0.5;
  }

  function spawnParticle(i) {
    var fp = fieldParams();
    var edge = (fp.field === 1 || fp.field === 4);
    var x = Math.random() * w;
    var y = edge ? (h + Math.random() * h * 0.18) : (Math.random() * h);
    if (fp.field === 5) {
      x = cx + (Math.random() - 0.5) * w * 0.1;
      y = cy + (Math.random() - 0.5) * h * 0.1;
    }
    if (fp.ocean > 0.5) {
      y = h * (0.35 + Math.random() * 0.5);
      x = Math.random() * w;
    }
    var kind = 'mist';
    var r = Math.random();
    if (fp.fire > 0.5) {
      if (r > 0.72) kind = 'ember';
      else if (r > 0.4) kind = 'spark';
    } else if (fp.ocean > 0.5) {
      if (r > 0.65) kind = 'foam';
    } else if (r > 0.93) kind = 'star';
    return {
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 48,
      vy: (Math.random() - 0.5) * 48,
      role: Math.random(),
      phase: Math.random() * 6.28318530718,
      jitter: Math.random(),
      kind: kind
    };
  }

  function pushRing(strength, heat) {
    if (rings.length >= maxRings) rings.shift();
    rings.push({
      r: 6 + Math.random() * 28,
      life: 1,
      a: 0.42 * strength + 0.15,
      heat: heat != null ? heat : 0.65
    });
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
    var perf = NX.S && NX.S.nexusPerfLock;
    var n = targetParticleCount(!!perf);
    var i;
    for (i = 0; i < n; i++) {
      parts.push(spawnParticle(i));
    }
    lastSceneKey = sceneKey();
    window.addEventListener('resize', resize);
  }

  function reseed() {
    var perf = NX.S && NX.S.nexusPerfLock;
    var n = targetParticleCount(!!perf);
    while (parts.length < n) parts.push(spawnParticle(parts.length));
    while (parts.length > n) parts.pop();
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = spawnParticle(i);
      parts[i].x = p.x;
      parts[i].y = p.y;
      parts[i].vx = p.vx;
      parts[i].vy = p.vy;
      parts[i].role = p.role;
      parts[i].phase = p.phase;
      parts[i].jitter = p.jitter;
      parts[i].kind = p.kind;
    }
    warmFrames = 48;
  }

  function onSceneOrPaletteChange() {
    var k = sceneKey();
    if (k === lastSceneKey) return;
    lastSceneKey = k;
    warmFrames = 62;
    var perf = NX.S && NX.S.nexusPerfLock;
    var targetN = targetParticleCount(!!perf);
    while (parts.length < targetN) parts.push(spawnParticle(parts.length));
    while (parts.length > targetN) parts.pop();
    var i;
    for (i = 0; i < parts.length; i++) {
      parts[i].vx += (Math.random() - 0.5) * 140;
      parts[i].vy += (Math.random() - 0.5) * 140;
      parts[i].phase = Math.random() * 6.28318530718;
      parts[i].kind = spawnParticle(i).kind;
    }
    pushRing(0.55, 0.5);
  }

  function drawLightingAndRings(dt, b, mid, hi, fl, pulseAmt) {
    var diag = Math.min(w, h);
    if (pulseAmt > 0.18) {
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.48);
      var core = 0.06 + pulseAmt * 0.14 + b * 0.05;
      g.addColorStop(0, 'rgba(255,248,235,' + core + ')');
      g.addColorStop(0.22, 'rgba(255,190,120,' + (core * 0.55) + ')');
      g.addColorStop(0.55, 'rgba(255,90,40,' + (core * 0.22) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    var ri;
    for (ri = rings.length - 1; ri >= 0; ri--) {
      var R = rings[ri];
      R.r += dt * (380 + pulseAmt * 260 + b * 220);
      R.life -= dt * 0.95;
      R.a *= Math.pow(0.988, dt * 60);
      if (R.life <= 0 || R.r > diag * 0.85) {
        rings.splice(ri, 1);
        continue;
      }
      var lm = R.a * R.life;
      var hot = R.heat;
      ctx.beginPath();
      ctx.arc(cx, cy, R.r, 0, 6.28318530718);
      ctx.strokeStyle = 'rgba(255,255,' + Math.floor(200 + hi * 55) + ',' + (lm * 0.42) + ')';
      ctx.lineWidth = 2.2 + pulseAmt * 2 + mid;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, R.r * 0.94, 0, 6.28318530718);
      ctx.strokeStyle = 'rgba(255,' + Math.floor(120 + hot * 100) + ',55,' + (lm * 0.28) + ')';
      ctx.lineWidth = 5 + fl * 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, R.r * 0.88, 0, 6.28318530718);
      ctx.strokeStyle = 'rgba(255,200,120,' + (lm * 0.14) + ')';
      ctx.lineWidth = 10;
      ctx.stroke();
    }
  }

  function tick(dt) {
    if (reducedMotion() || !canvas || !ctx || w < 4 || h < 4) return;
    var S = window.NX && NX.S;
    var perf = S && S.nexusPerfLock;
    if (canvas) canvas.classList.toggle('nx-proc-dim', !!perf);

    onSceneOrPaletteChange();

    var vd = S && typeof S._visualDrive === 'number' ? S._visualDrive : 0.35;
    vd = clamp01(vd);
    var ph = S && typeof S.procPhase === 'number' ? S.procPhase : 0.5;
    var procHue = S && typeof S.procHue === 'number' ? S.procHue : 0;
    var b = S && typeof S.sBass === 'number' ? S.sBass : 0;
    var mid = S && typeof S.sMid === 'number' ? S.sMid : 0;
    var hi = S && typeof S.sHigh === 'number' ? S.sHigh : 0;
    var fl = S && typeof S.sFlux === 'number' ? S.sFlux : 0;
    var bv = S && typeof S.beatVisual === 'number' ? S.beatVisual : 0;
    var tr = S && typeof S.sTransient === 'number' ? S.sTransient : 0;

    var beatJump = bv - prevBeatVisRaw;
    if (beatJump > 0.085) {
      pulse = Math.min(1, pulse + 0.78 + tr * 0.25);
      pushRing(0.95 + tr * 0.35, 0.55 + b * 0.35);
      if (beatJump > 0.14) pushRing(0.55 + mid * 0.3, 0.4);
    }
    pulse = Math.max(0, pulse - dt * 1.45);
    prevBeatVisRaw = bv;

    var fp = fieldParams();
    var warm = warmFrames > 0;
    if (warm) warmFrames--;

    time += dt * (0.34 + fl * 0.24 + pulse * 0.5);

    var fadeA = perf ? 0.22 : 0.1;
    fadeA += pulse * 0.055 + rings.length * 0.008;
    ctx.fillStyle = 'rgba(0,0,0,' + fadeA + ')';
    ctx.fillRect(0, 0, w, h);

    drawLightingAndRings(dt, b, mid, hi, fl, pulse);

    var n = parts.length;
    var i;
    var spBase = (perf ? 0.42 : 0.95) * (0.26 + vd * 0.74);
    spBase *= 1 + fl * 0.38 + pulse * 0.55 + fp.burst * 0.2;
    var grav = fp.grav * (0.42 + b * 1.9) * 24 * dt;
    var rad = fp.radial * (0.28 + mid * 0.95 + bv * 0.58) * dt * 62;
    var wind = fp.wind * (0.16 + b * 0.95 + Math.sin(time * 1.65) * 0.09) * 58 * dt;
    var chaos = fp.chaos * (0.38 + hi * 0.85 + tr * 0.65);

    var waveK = 0.012 + fp.ocean * 0.006;
    var waveAmp = (26 + fp.ocean * 55 + mid * 40) * (1 + fl * 0.45) * dt;
    var waveAmp2 = (14 + fp.ocean * 30) * (1 + hi * 0.6) * dt;

    for (i = 0; i < n; i++) {
      if (perf && (i & 1) === 1 && n > 260) continue;
      var p = parts[i];
      var nx = noise2(p.x * 0.0027 + time * fp.curl * 0.072, p.y * 0.0027 + ph * 1.85 + p.phase);
      var ny = noise2(p.y * 0.0028 - time * 0.052 * fp.curl, p.x * 0.0028 + 20.7 + p.jitter * 4);
      p.vx = p.vx * 0.925 + (nx - 0.5) * 0.12 * spBase * chaos;
      p.vy = p.vy * 0.925 + (ny - 0.5) * 0.12 * spBase * chaos;

      p.vx += Math.sin(p.y * waveK + time * (2.05 + fp.ocean * 0.9)) * waveAmp;
      p.vy += Math.cos(p.x * (waveK * 0.85) + time * (1.35 + fp.ocean * 0.5)) * waveAmp2;

      if (fp.fire > 0.5) {
        var up = (0.55 + b * 1.1 + (p.kind === 'ember' ? 0.45 : 0)) * 22 * dt;
        p.vy -= up;
        p.vx += Math.sin(time * 8 + p.phase) * (2 + hi * 4) * dt * 14;
        if (p.kind === 'spark') p.vy -= (35 + tr * 40) * dt;
      }

      p.vy += grav;
      p.vx += wind * (p.y / h - 0.5);

      var dx = p.x - cx;
      var dy = p.y - cy;
      var dist = Math.sqrt(dx * dx + dy * dy) + 1e-4;
      if (fp.field === 2 || fp.field === 6) {
        var tx = -dy / dist;
        var ty = dx / dist;
        p.vx += tx * rad * (0.62 + hi);
        p.vy += ty * rad * (0.62 + hi);
        p.vx -= (dx / dist) * rad * 0.09 * (1 + mid);
        p.vy -= (dy / dist) * rad * 0.09 * (1 + mid);
      } else if (fp.radial > 0.5) {
        p.vx -= (dx / dist) * rad * 0.13 * (0.42 + bv);
        p.vy -= (dy / dist) * rad * 0.13 * (0.42 + bv);
      }

      if (pulse > 0.04) {
        var blast = pulse * (32 + fp.burst * 28) * dt;
        p.vx += (dx / dist) * blast * (0.55 - p.jitter * 0.35);
        p.vy += (dy / dist) * blast * (0.55 - p.jitter * 0.35);
      }

      p.x += p.vx * dt * 54;
      p.y += p.vy * dt * 54;

      if (p.x < -30) p.x = w + 20;
      else if (p.x > w + 30) p.x = -20;
      if (p.y < -30) p.y = h + 20;
      else if (p.y > h + 30) p.y = -20;

      var leader = p.role > 0.86;
      var tw = 0.5 + 0.5 * Math.sin(time * 3.4 + p.phase + hi * 5);
      var hue = fp.hue0 + fp.hue1 * (nx * 0.38 + mid * 0.32 + procHue * 38) + hi * 40 + time * 15 * (0.07 + fl * 0.035);

      if (fp.fire > 0.5) {
        var fh = 12 + p.jitter * 38 + b * 30 + tw * 18 + tr * 25;
        if (p.kind === 'ember') fh += 8;
        hue = fh + mid * 15;
      } else if (fp.ocean > 0.55) {
        hue = 175 + nx * 35 + mid * 25 + procHue * 25;
      }

      hue = ((hue % 360) + 360) % 360;
      var sat = 56 + mid * 34 + pulse * 16 + fp.fire * 18;
      var light = 48 + b * 32 + (leader ? 14 : 0) + tw * 10 + fp.fire * (8 + hi * 10);
      var a = (0.042 + nx * 0.052 * vd) * (1 + tr * 0.55 + pulse * 0.5);
      if (leader) a *= 1.38;
      if (p.kind === 'star') {
        a *= 1.55;
        light += 18;
      }
      if (warm) a *= 1.12;
      a = Math.min(0.26, a);

      ctx.fillStyle = 'hsla(' + hue.toFixed(1) + ',' + sat.toFixed(0) + '%,' + light.toFixed(0) + '%,' + a.toFixed(3) + ')';
      var sz = (leader ? 2.65 : (p.kind === 'star' ? 2.1 : 1.28)) * (1 + bv * 0.38 + fp.fire * (p.kind === 'ember' ? 0.35 : 0)) * (perf ? 0.82 : 1);
      if (p.kind === 'foam') sz *= 1.25;
      ctx.fillRect(p.x, p.y, sz, sz);
    }
  }

  window.NX = window.NX || {};
  NX.ProcParticles = {
    init: init,
    tick: tick,
    reseed: reseed
  };
})();
