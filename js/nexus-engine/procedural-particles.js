'use strict';
/**
 * 2D procedural particle sheet (#nx-proc-particles) — always-evolving mix of ocean,
 * fire, swirl, and beat bursts; audio drives hue, turbulence, and wave energy.
 * Toroidal wrap respawns with jitter (avoids vertical “streak” at x≈0). Lower
 * default counts + adaptive draw skip when FPS dips — keeps the main WebGL loop healthy.
 */
(function () {
  var canvas = null;
  var ctx = null;
  var w = 0;
  var h = 0;
  var parts = [];
  var time = 0;
  /** Lower caps than prior build — fillRect per particle is costly. */
  var baseCount = 340;
  var maxParts = 560;
  var perfCap = 200;
  var inited = false;
  var lastSceneKey = '';
  var warmFrames = 0;
  var prevBeatVisRaw = 0;
  var pulse = 0;
  var cx = 0;
  var cy = 0;
  var rings = [];
  var maxRings = 6;
  /** Slow global evolution so modes morph even when scene is static. */
  var evolveT = 0;

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

  function fieldParams() {
    var si = (NX.S && typeof NX.S.curS === 'number') ? NX.S.curS : 0;
    var pal = (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0;
    var f = (si * 5 + pal * 3 + si * pal) % 8;
    var palHue = [198, 18, 145, 268, 210, 38][pal % 6];
    var hueSpread = 48 + (f % 3) * 22;
    var grav = (f === 1 || f === 4) ? -0.42 : (f === 2 || f === 6) ? 0.06 : 0.28;
    var curl = 0.55 + (f % 4) * 0.16;
    var radial = (f === 2 || f === 5 || f === 7) ? 1.05 : 0.32;
    var wind = (f === 3 || f === 0) ? 0.9 : 0.4;
    var chaos = 0.22 + (f % 5) * 0.1;
    var ocean = (f === 0 || f === 3) ? 1 : (f === 7 ? 0.45 : 0.14);
    var fire = (f === 1 || f === 4) ? 1 : 0;
    var burst = (f === 2 || f === 5 || f === 6) ? 0.9 : 0.26;
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

  /**
   * Continuous weights 0..1 — scene biases the cycles so ocean/fire still read clearly.
   * evolveT is advanced once per tick (not here) so spawn/reseed cannot fast-forward time.
   */
  function evolveWeights(fp, b, mid, hi, fl, bv, tr) {
    var c0 = evolveT;
    var oceanC = 0.5 + 0.5 * Math.sin(c0 * 0.62);
    var fireC = 0.5 + 0.5 * Math.sin(c0 * 0.88 + 2.05);
    var swirlC = 0.5 + 0.5 * Math.sin(c0 * 0.41 + 0.9);
    var burstC = 0.5 + 0.5 * Math.sin(c0 * 1.15 + 3.7);
    var oceanW = clamp01(0.18 + fp.ocean * 0.62 + oceanC * 0.38 + mid * 0.28);
    var fireW = clamp01(0.1 + fp.fire * 0.72 + fireC * 0.42 + b * 0.32);
    var swirlW = clamp01(0.22 + swirlC * 0.55 + hi * 0.35 + bv * 0.45);
    var burstW = clamp01(0.2 + fp.burst * 0.55 + burstC * 0.35 + tr * 0.45);
    return { oceanW: oceanW, fireW: fireW, swirlW: swirlW, burstW: burstW };
  }

  function targetParticleCount(perf) {
    var fp = fieldParams();
    var n = baseCount + Math.floor(fp.field * 14) + Math.floor((fp.ocean + fp.fire) * 40);
    if (perf) n = Math.min(perfCap, Math.floor(n * 0.48));
    return Math.min(maxParts, n);
  }

  function resize() {
    canvas = document.getElementById('nx-proc-particles');
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = Math.max(8, Math.floor((window.innerWidth || 800) * dpr));
    h = Math.max(8, Math.floor((window.innerHeight || 600) * dpr));
    canvas.width = w;
    canvas.height = h;
    cx = w * 0.5;
    cy = h * 0.5;
  }

  function spawnParticle(i, ew) {
    var fp = fieldParams();
    ew = ew || evolveWeights(fp, 0, 0, 0, 0, 0, 0);
    var x;
    var y;
    var rFire = ew.fireW + fp.fire * 0.35;
    if (Math.random() < rFire * 0.55) {
      x = w * (0.08 + Math.random() * 0.84);
      y = h * (0.72 + Math.random() * 0.28);
    } else if (Math.random() < ew.oceanW * 0.4) {
      x = w * (0.05 + Math.random() * 0.9);
      y = h * (0.28 + Math.random() * 0.52);
    } else {
      x = 2 + Math.random() * (w - 4);
      y = 2 + Math.random() * (h - 4);
    }
    if (fp.field === 5) {
      x = cx + (Math.random() - 0.5) * w * 0.14;
      y = cy + (Math.random() - 0.5) * h * 0.14;
    }
    var kind = 'mist';
    var r = Math.random();
    if (rFire > 0.35) {
      if (r > 0.68) kind = 'ember';
      else if (r > 0.38) kind = 'spark';
    } else if (ew.oceanW > 0.45) {
      if (r > 0.62) kind = 'foam';
    } else if (r > 0.92) kind = 'star';
    return {
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 95,
      vy: (Math.random() - 0.5) * 95,
      role: Math.random(),
      phase: Math.random() * 6.28318530718,
      jitter: Math.random(),
      kind: kind
    };
  }

  function pushRing(strength, heat) {
    if (rings.length >= maxRings) rings.shift();
    rings.push({
      r: 8 + Math.random() * 36,
      life: 1,
      a: 0.38 * strength + 0.12,
      heat: heat != null ? heat : 0.62
    });
  }

  /** Respawn with spread so wrapped particles never stack on one vertical column. */
  function wrapAndScatter(p) {
    var m = 60;
    if (p.x < -m) {
      p.x = w - 40 - Math.random() * (w * 0.35);
      p.y = Math.random() * h;
      p.vx = -20 - Math.random() * 70;
      p.vy += (Math.random() - 0.5) * 120;
    } else if (p.x > w + m) {
      p.x = 40 + Math.random() * (w * 0.35);
      p.y = Math.random() * h;
      p.vx = 20 + Math.random() * 70;
      p.vy += (Math.random() - 0.5) * 120;
    }
    if (p.y < -m) {
      p.y = h - 30 - Math.random() * (h * 0.4);
      p.x = Math.random() * w;
      p.vy = -15 - Math.random() * 55;
    } else if (p.y > h + m) {
      p.y = 30 + Math.random() * (h * 0.4);
      p.x = Math.random() * w;
      p.vy = 15 + Math.random() * 55;
    }
  }

  function clampSpeed(p, maxPx) {
    var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > maxPx) {
      var k = maxPx / sp;
      p.vx *= k;
      p.vy *= k;
    }
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
    var fp = fieldParams();
    var ew = evolveWeights(fp, 0, 0, 0, 0, 0, 0);
    var n = targetParticleCount(!!perf);
    var i;
    for (i = 0; i < n; i++) {
      parts.push(spawnParticle(i, ew));
    }
    lastSceneKey = sceneKey();
    window.addEventListener('resize', resize);
  }

  function reseed() {
    var perf = NX.S && NX.S.nexusPerfLock;
    var fp = fieldParams();
    var ew = evolveWeights(fp, 0, 0, 0, 0, 0, 0);
    var n = targetParticleCount(!!perf);
    while (parts.length < n) parts.push(spawnParticle(parts.length, ew));
    while (parts.length > n) parts.pop();
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = spawnParticle(i, ew);
      parts[i].x = p.x;
      parts[i].y = p.y;
      parts[i].vx = p.vx;
      parts[i].vy = p.vy;
      parts[i].role = p.role;
      parts[i].phase = p.phase;
      parts[i].jitter = p.jitter;
      parts[i].kind = p.kind;
    }
    warmFrames = 40;
  }

  function onSceneOrPaletteChange() {
    var k = sceneKey();
    if (k === lastSceneKey) return;
    lastSceneKey = k;
    warmFrames = 48;
    var perf = NX.S && NX.S.nexusPerfLock;
    var targetN = targetParticleCount(!!perf);
    while (parts.length < targetN) parts.push(spawnParticle(parts.length));
    while (parts.length > targetN) parts.pop();
    var fp = fieldParams();
    var ew = evolveWeights(fp, 0, 0, 0, 0, 0, 0);
    var i;
    for (i = 0; i < parts.length; i++) {
      parts[i].vx += (Math.random() - 0.5) * 120;
      parts[i].vy += (Math.random() - 0.5) * 120;
      parts[i].phase = Math.random() * 6.28318530718;
      parts[i].kind = spawnParticle(i, ew).kind;
    }
    pushRing(0.5, 0.48);
  }

  function drawLightingAndRings(dt, b, mid, hi, fl, pulseAmt, lite) {
    var diag = Math.min(w, h);
    if (pulseAmt > 0.16) {
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.46);
      var core = 0.05 + pulseAmt * 0.12 + b * 0.045;
      g.addColorStop(0, 'rgba(255,248,235,' + core + ')');
      g.addColorStop(0.25, 'rgba(255,190,120,' + (core * 0.48) + ')');
      g.addColorStop(0.58, 'rgba(255,90,40,' + (core * 0.18) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    var ri;
    for (ri = rings.length - 1; ri >= 0; ri--) {
      var R = rings[ri];
      R.r += dt * (320 + pulseAmt * 220 + b * 180);
      R.life -= dt * 0.92;
      R.a *= Math.pow(0.989, dt * 60);
      if (R.life <= 0 || R.r > diag * 0.82) {
        rings.splice(ri, 1);
        continue;
      }
      var lm = R.a * R.life;
      var hot = R.heat;
      ctx.beginPath();
      ctx.arc(cx, cy, R.r, 0, 6.28318530718);
      ctx.strokeStyle = 'rgba(255,255,' + Math.floor(195 + hi * 50) + ',' + (lm * (lite ? 0.32 : 0.4)) + ')';
      ctx.lineWidth = 1.8 + pulseAmt * 1.6 + mid;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, R.r * 0.92, 0, 6.28318530718);
      ctx.strokeStyle = 'rgba(255,' + Math.floor(110 + hot * 105) + ',45,' + (lm * (lite ? 0.2 : 0.26)) + ')';
      ctx.lineWidth = 4 + fl * 3;
      ctx.stroke();
    }
  }

  function tick(dt) {
    if (reducedMotion() || !canvas || !ctx || w < 8 || h < 8) return;
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
    var emaFps = S && typeof S._emaFps === 'number' ? S._emaFps : 58;

    var beatJump = bv - prevBeatVisRaw;
    if (beatJump > 0.08) {
      pulse = Math.min(1, pulse + 0.72 + tr * 0.28);
      pushRing(0.88 + tr * 0.3, 0.52 + b * 0.32);
      if (beatJump > 0.13) pushRing(0.48 + mid * 0.28, 0.38);
    }
    pulse = Math.max(0, pulse - dt * 1.5);
    prevBeatVisRaw = bv;

    var fp = fieldParams();
    var ew = evolveWeights(fp, b, mid, hi, fl, bv, tr);
    var warm = warmFrames > 0;
    if (warm) warmFrames--;

    time += dt * (0.32 + fl * 0.22 + pulse * 0.45);
    evolveT += dt * (0.55 + fl * 0.35 + b * 0.12 + mid * 0.08);
    var td = Math.min(dt * 60, 2.8);

    var fadeA = perf ? 0.2 : 0.11;
    fadeA += pulse * 0.048 + rings.length * 0.006;
    ctx.fillStyle = 'rgba(0,0,0,' + fadeA + ')';
    ctx.fillRect(0, 0, w, h);

    var liteRings = perf || emaFps < 48;
    drawLightingAndRings(dt, b, mid, hi, fl, pulse, liteRings);

    var n = parts.length;
    var i;
    var spBase = (perf ? 0.38 : 0.88) * (0.28 + vd * 0.72);
    spBase *= 1 + fl * 0.35 + pulse * 0.5 + ew.burstW * 0.22;

    var wavePhase = time * (1.35 + mid * 1.1) + bv * 2.2;
    var wavePhase2 = time * (0.95 + hi * 0.8) + ph * 2.4;
    var kx = 0.0042 + ew.oceanW * 0.005 + mid * 0.0035;
    var ky = 0.0036 + ew.oceanW * 0.004;
    var oceanAx = (22 + ew.oceanW * 62 + b * 48 + fl * 28) * td;
    var oceanAy = (16 + ew.oceanW * 48 + mid * 38) * td;

    var grav = fp.grav * (0.35 + b * 1.75) * 18 * dt * (1 - ew.fireW * 0.35);
    var wind = fp.wind * (0.12 + b * 0.85 + Math.sin(time * 1.55) * 0.08) * 42 * dt;
    var chaos = fp.chaos * (0.35 + hi * 0.9 + tr * 0.6);

    var swirlStr = (38 + hi * 52 + bv * 70 + pulse * 95) * ew.swirlW * td;
    var radScene = fp.radial * (0.26 + mid * 0.88 + bv * 0.52) * dt * 48;

    var drawStride = 1;
    if (perf) drawStride = 2;
    else if (emaFps < 40) drawStride = 3;
    else if (emaFps < 50) drawStride = 2;

    for (i = 0; i < n; i++) {
      var p = parts[i];
      var nx = noise2(p.x * 0.0025 + time * fp.curl * 0.07, p.y * 0.0025 + ph * 1.8 + p.phase);
      var ny = noise2(p.y * 0.0026 - time * 0.05 * fp.curl, p.x * 0.0026 + 20.4 + p.jitter * 4);
      p.vx = p.vx * Math.pow(0.928, td) + (nx - 0.5) * 0.11 * spBase * chaos * td;
      p.vy = p.vy * Math.pow(0.928, td) + (ny - 0.5) * 0.11 * spBase * chaos * td;

      /* Ocean: traveling pressure ridges + cross-current (readable as “waves”). */
      p.vx += Math.sin(p.y * ky + wavePhase2) * oceanAx * ew.oceanW;
      p.vy += Math.cos(p.x * kx + wavePhase) * oceanAy * ew.oceanW;
      p.vx += Math.sin(p.x * (kx * 1.7) - time * 1.8 + mid * 3) * oceanAx * 0.35 * ew.oceanW;

      /* Fire: updraft + sideways turbulence (embers ride it). */
      if (ew.fireW > 0.08) {
        var up = (0.42 + b * 1.05 + (p.kind === 'ember' ? 0.5 : 0)) * (18 + ew.fireW * 28) * dt;
        p.vy -= up;
        p.vx += Math.sin(time * 9 + p.phase + hi * 4) * (3 + hi * 6 + ew.fireW * 8) * dt * 16;
        if (p.kind === 'spark') p.vy -= (28 + tr * 36) * dt;
        if (p.y < h * 0.12 && p.kind !== 'foam') {
          p.y = h * (0.75 + Math.random() * 0.22);
          p.x = 4 + Math.random() * (w - 8);
          p.vy = 8 + Math.random() * 40;
        }
      }

      p.vy += grav;
      p.vx += wind * (p.y / h - 0.5);

      var dx = p.x - cx;
      var dy = p.y - cy;
      var dist = Math.sqrt(dx * dx + dy * dy) + 1e-4;
      var tx = -dy / dist;
      var ty = dx / dist;

      /* Swirl + scene radial blend. */
      p.vx += tx * swirlStr * (0.55 + hi * 0.45);
      p.vy += ty * swirlStr * (0.55 + hi * 0.45);

      if (fp.field === 2 || fp.field === 6) {
        p.vx += tx * radScene * (0.58 + hi);
        p.vy += ty * radScene * (0.58 + hi);
        p.vx -= (dx / dist) * radScene * 0.08 * (1 + mid);
        p.vy -= (dy / dist) * radScene * 0.08 * (1 + mid);
      } else if (fp.radial > 0.48) {
        p.vx -= (dx / dist) * radScene * 0.12 * (0.4 + bv);
        p.vy -= (dy / dist) * radScene * 0.12 * (0.4 + bv);
      }

      if (pulse > 0.035) {
        var blast = pulse * (26 + ew.burstW * 36) * dt;
        p.vx += (dx / dist) * blast * (0.55 - p.jitter * 0.32);
        p.vy += (dy / dist) * blast * (0.55 - p.jitter * 0.32);
      }

      p.x += p.vx * dt * 0.92;
      p.y += p.vy * dt * 0.92;

      wrapAndScatter(p);
      clampSpeed(p, perf ? 280 : 380);

      var leader = p.role > 0.87;
      var tw = 0.5 + 0.5 * Math.sin(time * 3.2 + p.phase + hi * 5);
      var hue = fp.hue0 + fp.hue1 * (nx * 0.36 + mid * 0.34 + procHue * 36) + hi * 42 + fl * 55 + time * 12 * (0.06 + fl * 0.03);

      if (ew.fireW > 0.25) {
        var fh = 10 + p.jitter * 42 + b * 38 + tw * 22 + tr * 28 + (1 - ew.oceanW) * 6;
        if (p.kind === 'ember') fh += 10;
        hue = fh + mid * 18;
      }
      if (ew.oceanW > 0.35) {
        hue = hue * (1 - ew.oceanW * 0.35) + (175 + nx * 38 + mid * 28 + procHue * 22) * (ew.oceanW * 0.35);
      }

      hue = ((hue % 360) + 360) % 360;
      var sat = 52 + mid * 38 + pulse * 18 + ew.fireW * 22 + ew.oceanW * 12;
      var light = 46 + b * 34 + (leader ? 14 : 0) + tw * 12 + ew.fireW * (10 + hi * 12);
      var a = (0.038 + nx * 0.048 * vd) * (1 + tr * 0.5 + pulse * 0.48);
      if (leader) a *= 1.35;
      if (p.kind === 'star') {
        a *= 1.5;
        light += 16;
      }
      if (warm) a *= 1.08;
      a = Math.min(0.24, a);

      ctx.fillStyle = 'hsla(' + hue.toFixed(1) + ',' + sat.toFixed(0) + '%,' + light.toFixed(0) + '%,' + a.toFixed(3) + ')';
      var sz = (leader ? 2.5 : (p.kind === 'star' ? 2 : 1.22)) * (1 + bv * 0.35 + ew.fireW * (p.kind === 'ember' ? 0.32 : 0)) * (perf ? 0.78 : 1);
      if (p.kind === 'foam') sz *= 1.22;
      if (drawStride > 1 && (i % drawStride) !== 0) continue;

      var rx = Math.floor(p.x);
      var ry = Math.floor(p.y);
      ctx.fillRect(rx, ry, Math.max(1, sz), Math.max(1, sz));
    }
  }

  window.NX = window.NX || {};
  NX.ProcParticles = {
    init: init,
    tick: tick,
    reseed: reseed
  };
})();
