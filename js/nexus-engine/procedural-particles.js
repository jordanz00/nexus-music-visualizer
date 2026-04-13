'use strict';
/**
 * 2D + pseudo-3D procedural particles (#nx-proc-particles).
 * Physics-forward: drag, curl noise, dual vortices, ocean pressure waves, fire plume,
 * beat shock + rings. Each WebGL scene index (NX.S.curS) selects a distinct force mix;
 * palette shifts hue. Audio directly drives acceleration, vortex gain, wave speed, and color.
 * Not literal 3D engine — parallax + depth scale + vz simulate depth cheaply on 2D canvas.
 */
(function () {
  var canvas = null;
  var ctx = null;
  var w = 0;
  var h = 0;
  var parts = [];
  var time = 0;
  var baseCount = 780;
  var maxParts = 1280;
  var perfCap = 340;
  var inited = false;
  var lastSceneKey = '';
  var warmFrames = 0;
  var prevBeatVisRaw = 0;
  var pulse = 0;
  var cx = 0;
  var cy = 0;
  var rings = [];
  var maxRings = 7;
  var evolveT = 0;
  var sceneCount = 24;

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

  function getSceneCount() {
    try {
      if (NX.scenes && NX.scenes.length) return Math.max(8, NX.scenes.length | 0);
    } catch (eSc) { /* ignore */ }
    return sceneCount;
  }

  function sceneKey() {
    var S = window.NX && NX.S;
    var si = (S && typeof S.curS === 'number') ? S.curS : 0;
    var pal = (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0;
    var pk = (S && S.bcLastPresetKey) ? String(S.bcLastPresetKey) : '';
    var cid = (S && S.bcPresetContentId) ? String(S.bcPresetContentId) : '';
    var tok = cid ? pk + '\0' + cid : pk;
    var ph = (NX.ParticleSignature && typeof NX.ParticleSignature.fnv1a === 'function')
      ? (NX.ParticleSignature.fnv1a(tok) % 8192)
      : 0;
    return si + ':' + pal + ':' + ph;
  }

  function notifyPresetChange() {
    lastSceneKey = '';
  }

  /**
   * Per-scene + palette physics fingerprint — every scene index shifts the particle field.
   * @returns {{ ocean: number, fire: number, swirl: number, burst: number, curl: number,
   *   vortexSign: number, audioCoupling: number, hue0: number, hueSpread: number }}
   */
  function scenePhysicsSig(si, pal) {
    var n = getSceneCount();
    si = (si | 0) % n;
    pal = pal | 0;
    var pk = (NX.S && NX.S.bcLastPresetKey) ? String(NX.S.bcLastPresetKey) : '';
    var cid = (NX.S && NX.S.bcPresetContentId) ? String(NX.S.bcPresetContentId) : '';
    var tok = cid ? pk + '\0' + cid : pk;
    var pm = (NX.ParticleSignature && typeof NX.ParticleSignature.fnv1a === 'function')
      ? (NX.ParticleSignature.fnv1a(tok) % 503)
      : 0;
    var h1 = ((si * 17 + pal * 23 + pm * 3) % 997) / 997;
    var h2 = ((si * 31 + pal * 11 + pm * 5) % 991) / 991;
    var h3 = ((si * 13 + pal * 41 + pm * 7) % 983) / 983;
    var h4 = ((si * 7 + pal * 19 + pm * 11) % 1009) / 1009;
    var ocean = clamp01(0.22 + 0.78 * Math.sin(h1 * 6.28318) * 0.5 + 0.5 * h2);
    var fire = clamp01(0.15 + 0.85 * Math.sin(h2 * 6.28318 + 1.2) * 0.5 + 0.5 * h3);
    var swirl = clamp01(0.25 + 0.75 * Math.sin(h3 * 6.28318 + 2.1) * 0.5 + 0.4 * h4);
    var burst = clamp01(0.2 + 0.8 * Math.sin((h1 + h4) * 6.28318));
    var norm = ocean + fire + swirl + burst + 1e-4;
    ocean /= norm;
    fire /= norm;
    swirl /= norm;
    burst /= norm;
    var palHue = [198, 18, 145, 268, 210, 38][pal % 6];
    return {
      ocean: ocean,
      fire: fire,
      swirl: swirl,
      burst: burst,
      curl: 0.52 + (si % 5) * 0.14 + (pal % 3) * 0.08,
      vortexSign: (si % 2 === 0) ? 1 : -1,
      audioCoupling: 0.55 + (si % 7) * 0.07,
      hue0: palHue + (si % 12) * 9,
      hueSpread: 38 + (si % 6) * 14 + (pal % 4) * 8
    };
  }

  function evolveWeights(sig, b, mid, hi, fl, bv, tr) {
    var c0 = evolveT;
    var oceanC = 0.5 + 0.5 * Math.sin(c0 * 0.58);
    var fireC = 0.5 + 0.5 * Math.sin(c0 * 0.86 + 2.1);
    var swirlC = 0.5 + 0.5 * Math.sin(c0 * 0.44 + 0.85);
    var burstC = 0.5 + 0.5 * Math.sin(c0 * 1.12 + 3.6);
    return {
      oceanW: clamp01(sig.ocean * 0.72 + oceanC * 0.35 + mid * 0.32 + b * 0.08),
      fireW: clamp01(sig.fire * 0.78 + fireC * 0.38 + b * 0.35 + tr * 0.15),
      swirlW: clamp01(sig.swirl * 0.75 + swirlC * 0.4 + hi * 0.38 + bv * 0.42),
      burstW: clamp01(sig.burst * 0.72 + burstC * 0.38 + tr * 0.5 + pulse * 0.35)
    };
  }

  function targetParticleCount(perf) {
    var sig = scenePhysicsSig(
      (NX.S && typeof NX.S.curS === 'number') ? NX.S.curS : 0,
      (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0
    );
    var n = baseCount + Math.floor((sig.ocean + sig.fire + sig.swirl) * 120) + Math.floor(sig.burst * 80);
    if (perf) n = Math.min(perfCap, Math.floor(n * 0.45));
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

  function spawnParticle(i, ew, sig) {
    sig = sig || scenePhysicsSig(
      (NX.S && typeof NX.S.curS === 'number') ? NX.S.curS : 0,
      (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0
    );
    ew = ew || evolveWeights(sig, 0, 0, 0, 0, 0, 0);
    var x;
    var y;
    var z = 0.25 + Math.random() * 0.75;
    var vz = (Math.random() - 0.5) * 28;
    if (Math.random() < ew.fireW * 0.62) {
      x = w * (0.06 + Math.random() * 0.88);
      y = h * (0.68 + Math.random() * 0.3);
      z = 0.45 + Math.random() * 0.55;
    } else if (Math.random() < ew.oceanW * 0.55) {
      x = w * (0.04 + Math.random() * 0.92);
      y = h * (0.22 + Math.random() * 0.58);
      z = 0.2 + Math.random() * 0.65;
    } else {
      x = 4 + Math.random() * (w - 8);
      y = 4 + Math.random() * (h - 8);
    }
    var kind = 'mist';
    var r = Math.random();
    if (ew.fireW > 0.28) {
      if (r > 0.65) kind = 'ember';
      else if (r > 0.35) kind = 'spark';
    } else if (ew.oceanW > 0.42) {
      if (r > 0.58) kind = 'foam';
    } else if (r > 0.9) kind = 'star';
    return {
      x: x,
      y: y,
      z: z,
      vz: vz,
      vx: (Math.random() - 0.5) * 110,
      vy: (Math.random() - 0.5) * 110,
      role: Math.random(),
      phase: Math.random() * 6.28318530718,
      jitter: Math.random(),
      kind: kind
    };
  }

  function pushRing(strength, heat) {
    if (rings.length >= maxRings) rings.shift();
    rings.push({
      r: 6 + Math.random() * 42,
      life: 1,
      a: 0.36 * strength + 0.12,
      heat: heat != null ? heat : 0.62
    });
  }

  function wrapAndScatter(p) {
    var m = 70;
    if (p.x < -m) {
      p.x = w - 50 - Math.random() * (w * 0.32);
      p.y = Math.random() * h;
      p.vx = -30 - Math.random() * 90;
      p.vy += (Math.random() - 0.5) * 140;
    } else if (p.x > w + m) {
      p.x = 50 + Math.random() * (w * 0.32);
      p.y = Math.random() * h;
      p.vx = 30 + Math.random() * 90;
      p.vy += (Math.random() - 0.5) * 140;
    }
    if (p.y < -m) {
      p.y = h - 40 - Math.random() * (h * 0.38);
      p.x = Math.random() * w;
      p.vy = -20 - Math.random() * 70;
    } else if (p.y > h + m) {
      p.y = 40 + Math.random() * (h * 0.38);
      p.x = Math.random() * w;
      p.vy = 20 + Math.random() * 70;
    }
  }

  function clampSpeed(p, maxPx) {
    var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > maxPx) {
      var k = maxPx / sp;
      p.vx *= k;
      p.vy *= k;
    }
    if (p.vz > 95) p.vz = 95;
    if (p.vz < -95) p.vz = -95;
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
    var si = (NX.S && typeof NX.S.curS === 'number') ? NX.S.curS : 0;
    var pal = (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0;
    var sig = scenePhysicsSig(si, pal);
    var ew = evolveWeights(sig, 0, 0, 0, 0, 0, 0);
    var n = targetParticleCount(!!perf);
    var i;
    for (i = 0; i < n; i++) {
      parts.push(spawnParticle(i, ew, sig));
    }
    lastSceneKey = sceneKey();
    window.addEventListener('resize', resize);
  }

  function reseed() {
    var perf = NX.S && NX.S.nexusPerfLock;
    var si = (NX.S && typeof NX.S.curS === 'number') ? NX.S.curS : 0;
    var pal = (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0;
    var sig = scenePhysicsSig(si, pal);
    var ew = evolveWeights(sig, 0, 0, 0, 0, 0, 0);
    var n = targetParticleCount(!!perf);
    while (parts.length < n) parts.push(spawnParticle(parts.length, ew, sig));
    while (parts.length > n) parts.pop();
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = spawnParticle(i, ew, sig);
      parts[i].x = p.x;
      parts[i].y = p.y;
      parts[i].z = p.z;
      parts[i].vz = p.vz;
      parts[i].vx = p.vx;
      parts[i].vy = p.vy;
      parts[i].role = p.role;
      parts[i].phase = p.phase;
      parts[i].jitter = p.jitter;
      parts[i].kind = p.kind;
    }
    warmFrames = 44;
  }

  function onSceneOrPaletteChange() {
    var k = sceneKey();
    if (k === lastSceneKey) return;
    lastSceneKey = k;
    warmFrames = 56;
    var perf = NX.S && NX.S.nexusPerfLock;
    var targetN = targetParticleCount(!!perf);
    while (parts.length < targetN) parts.push(spawnParticle(parts.length));
    while (parts.length > targetN) parts.pop();
    var si = (NX.S && typeof NX.S.curS === 'number') ? NX.S.curS : 0;
    var pal = (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0;
    var sig = scenePhysicsSig(si, pal);
    var ew = evolveWeights(sig, 0, 0, 0, 0, 0, 0);
    var i;
    for (i = 0; i < parts.length; i++) {
      parts[i].vx += (Math.random() - 0.5) * 160;
      parts[i].vy += (Math.random() - 0.5) * 160;
      parts[i].vz += (Math.random() - 0.5) * 50;
      parts[i].phase = Math.random() * 6.28318530718;
      parts[i].kind = spawnParticle(i, ew, sig).kind;
      parts[i].z = 0.2 + Math.random() * 0.8;
    }
    pushRing(0.58, 0.5);
  }

  function drawLightingAndRings(dt, b, mid, hi, fl, pulseAmt, lite, gpuOn) {
    var diag = Math.min(w, h);
    var pulseTh = gpuOn ? 0.22 : 0.14;
    if (pulseAmt > pulseTh) {
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, diag * 0.46);
      var core = 0.05 + pulseAmt * 0.13 + b * 0.05;
      if (gpuOn) core *= 0.42;
      g.addColorStop(0, 'rgba(255,248,235,' + core + ')');
      g.addColorStop(0.25, 'rgba(255,190,120,' + (core * 0.46) + ')');
      g.addColorStop(0.58, 'rgba(255,90,40,' + (core * 0.17) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    var ri;
    for (ri = rings.length - 1; ri >= 0; ri--) {
      var R = rings[ri];
      R.r += dt * (340 + pulseAmt * 240 + b * 200);
      R.life -= dt * 0.9;
      R.a *= Math.pow(0.988, dt * 60);
      if (R.life <= 0 || R.r > diag * 0.84) {
        rings.splice(ri, 1);
        continue;
      }
      var lm = R.a * R.life;
      var hot = R.heat;
      ctx.beginPath();
      ctx.arc(cx, cy, R.r, 0, 6.28318530718);
      ctx.strokeStyle = 'rgba(255,255,' + Math.floor(192 + hi * 52) + ',' + (lm * (lite ? 0.3 : 0.38)) + ')';
      ctx.lineWidth = 1.8 + pulseAmt * 1.8 + mid;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, R.r * 0.91, 0, 6.28318530718);
      ctx.strokeStyle = 'rgba(255,' + Math.floor(105 + hot * 108) + ',42,' + (lm * (lite ? 0.19 : 0.25)) + ')';
      ctx.lineWidth = 4 + fl * 3.5;
      ctx.stroke();
    }
  }

  function tick(dt) {
    if (reducedMotion() || !canvas || !ctx || w < 8 || h < 8) return;
    var S = window.NX && NX.S;
    if (S && S.nexusMixParticlesEnabled === false) {
      canvas.style.display = 'none';
      return;
    }
    if (!S || S.nexusProcParticlesEnabled !== true) {
      canvas.style.display = 'none';
      return;
    }
    canvas.style.display = '';
    var perf = S && S.nexusPerfLock;
    if (canvas) canvas.classList.toggle('nx-proc-dim', !!perf);
    var vizPerf = S && S.nexusVizPerformance;
    var gpuOn = !!(NX.GpuParticles && typeof NX.GpuParticles.isReady === 'function' && NX.GpuParticles.isReady() &&
      S && S.nexusGpuParticlesEnabled && !perf && !vizPerf);
    if (canvas) canvas.classList.toggle('nx-proc-subtle', gpuOn);

    onSceneOrPaletteChange();

    var vd = S && typeof S._visualDrive === 'number' ? S._visualDrive : 0.35;
    vd = clamp01(vd);
    var ph = S && typeof S.procPhase === 'number' ? S.procPhase : 0.5;
    var procHue = S && typeof S.procHue === 'number' ? S.procHue : 0;
    var b = S && typeof S.sBass === 'number' ? S.sBass : 0;
    var mid = S && typeof S.sMid === 'number' ? S.sMid : 0;
    var lm = clamp01(b * 0.38 + mid * 0.62);
    var hi = S && typeof S.sHigh === 'number' ? S.sHigh : 0;
    var fl = S && typeof S.sFlux === 'number' ? S.sFlux : 0;
    var bv = S && typeof S.beatVisual === 'number' ? S.beatVisual : 0;
    var tr = S && typeof S.sTransient === 'number' ? S.sTransient : 0;
    var emaFps = S && typeof S._emaFps === 'number' ? S._emaFps : 58;

    var si = (S && typeof S.curS === 'number') ? S.curS : 0;
    var pal = (NX.P && typeof NX.P.PAL === 'number') ? NX.P.PAL : 0;
    var sig = scenePhysicsSig(si, pal);

    var beatJump = bv - prevBeatVisRaw;
    if (beatJump > 0.075) {
      pulse = Math.min(1, pulse + 0.78 + tr * 0.32);
      pushRing(0.92 + tr * 0.32, 0.52 + b * 0.34);
      if (beatJump > 0.12) pushRing(0.52 + mid * 0.3, 0.4);
    }
    pulse = Math.max(0, pulse - dt * 1.48);
    prevBeatVisRaw = bv;

    var ew = evolveWeights(sig, b, mid, hi, fl, bv, tr);
    var warm = warmFrames > 0;
    if (warm) warmFrames--;

    time += dt * (0.36 + fl * 0.26 + pulse * 0.48 + bv * 0.12);
    evolveT += dt * (0.58 + fl * 0.38 + b * 0.14 + mid * 0.1);
    var td = Math.min(dt * 60, 2.8);
    var ac = sig.audioCoupling;

    var fadeA = perf ? 0.19 : 0.1;
    fadeA += pulse * 0.045 + rings.length * 0.006;
    ctx.fillStyle = 'rgba(0,0,0,' + fadeA + ')';
    ctx.fillRect(0, 0, w, h);

    var liteRings = perf || emaFps < 48;
    drawLightingAndRings(dt, b, mid, hi, fl, pulse, liteRings, gpuOn);

    var n = parts.length;
    var i;
    var spBase = (perf ? 0.36 : 0.92) * (0.26 + vd * 0.74) * (1 + fl * 0.4 + bv * 0.35);
    spBase *= (1 + pulse * 0.55 + ew.burstW * 0.28) * ac;

    var wavePhase = time * (1.55 + mid * 1.25 + b * 0.65) + bv * 2.4 + fl * 1.8;
    var wavePhase2 = time * (1.02 + hi * 0.95 + lm * 0.5) + ph * 2.5;
    var kx = 0.0038 + ew.oceanW * 0.0065 + mid * 0.004 + b * 0.0025;
    var ky = 0.0034 + ew.oceanW * 0.0055 + lm * 0.0035;
    var oceanAx = (28 + ew.oceanW * 88 + b * 62 + lm * 48 + fl * 32) * td;
    var oceanAy = (22 + ew.oceanW * 72 + mid * 52 + hi * 28) * td;

    var vortexCx = cx + Math.sin(time * 0.85 + b * 2.2) * w * (0.06 + b * 0.05);
    var vortexCy = cy + Math.cos(time * 0.72 + mid * 2.8) * h * (0.05 + mid * 0.04);
    var v2x = cx + Math.cos(time * 0.62 + hi * 3) * w * 0.07;
    var v2y = cy + Math.sin(time * 0.58 + fl * 4) * h * 0.06;

    var swirlGain = (48 + hi * 68 + bv * 88 + pulse * 110 + tr * 75) * ew.swirlW * td * sig.vortexSign;
    var swirl2 = swirlGain * 0.42 * (0.5 + lm);

    var damp = Math.pow(0.915 + bv * 0.028 + (1 - hi) * 0.012, td);

    var drawStride = 1;
    if (perf) drawStride = 2;
    else if (emaFps < 38) drawStride = 3;
    else if (emaFps < 50) drawStride = 2;

    for (i = 0; i < n; i++) {
      var p = parts[i];
      var nx = noise2(p.x * 0.0024 + time * sig.curl * 0.068, p.y * 0.0024 + ph * 1.75 + p.phase);
      var ny = noise2(p.y * 0.0025 - time * 0.048 * sig.curl, p.x * 0.0025 + 19.2 + p.jitter * 4.2);

      p.vx *= damp;
      p.vy *= damp;
      p.vx += (nx - 0.5) * 0.14 * spBase * (0.4 + hi * 0.95 + tr * 0.5) * td;
      p.vy += (ny - 0.5) * 0.14 * spBase * (0.4 + hi * 0.95 + tr * 0.5) * td;

      /* Ocean — crests and cross-surge (audio modulates phase speed above). */
      p.vx += Math.sin(p.y * ky + wavePhase2) * oceanAx * ew.oceanW;
      p.vy += Math.cos(p.x * kx + wavePhase) * oceanAy * ew.oceanW;
      p.vx += Math.sin(p.x * kx * 2.1 - time * 2.05 + mid * 4) * oceanAx * 0.42 * ew.oceanW;
      p.vy += Math.sin(p.x * 0.0018 + p.y * 0.0022 + wavePhase * 1.1) * oceanAy * 0.35 * ew.oceanW * (0.6 + b);

      /* Fire plume — strong when fireW; bass lifts column. */
      if (ew.fireW > 0.06) {
        var up = (0.48 + b * 1.35 + (p.kind === 'ember' ? 0.55 : 0)) * (22 + ew.fireW * 38) * dt;
        p.vy -= up * (0.55 + p.z * 0.45);
        p.vx += Math.sin(time * 10 + p.phase * 2 + hi * 5) * (4 + hi * 10 + ew.fireW * 12) * dt * 18;
        p.vz += (Math.random() - 0.5) * 8 * dt * ew.fireW * (0.5 + tr);
        if (p.kind === 'spark') p.vy -= (32 + tr * 48) * dt;
        if (p.y < h * 0.1 && p.kind !== 'foam') {
          p.y = h * (0.72 + Math.random() * 0.24);
          p.x = 6 + Math.random() * (w - 12);
          p.vy = 12 + Math.random() * 55;
          p.z = 0.35 + Math.random() * 0.65;
        }
      }

      /* Audio acceleration field — pushes particles with the music (not “snow”). */
      var axAudio = ((b - 0.5) * 2.55 * (105 + pulse * 165) + (mid - 0.45) * 64 * Math.sin(time * 2.1 + p.phase)) * ac * td;
      var ayAudio = ((lm - 0.45) * 82 * Math.cos(time * 1.7 + p.y * 0.003) + (hi - 0.4) * 54 * Math.sin(time * 3.2 + p.x * 0.002)) * ac * td;
      p.vx += axAudio * (0.65 + p.z * 0.5);
      p.vy += ayAudio * (0.65 + p.z * 0.5);

      /* Tiny tilted “gravity” — mostly cancelled by ocean/swirl; never dominant down. */
      var gravAngle = time * 0.35 + si * 0.21 + b * 1.8;
      var gMag = (0.08 + hi * 0.14 + fl * 0.1) * (1 - ew.oceanW * 0.45 - ew.swirlW * 0.25) * 22 * dt;
      p.vx += Math.cos(gravAngle) * gMag * (p.z * 0.5 + 0.5);
      p.vy += Math.sin(gravAngle) * gMag * 0.55;

      var dx1 = p.x - vortexCx;
      var dy1 = p.y - vortexCy;
      var d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) + 1e-4;
      var t1x = -dy1 / d1;
      var t1y = dx1 / d1;
      p.vx += t1x * swirlGain * (0.5 + p.z * 0.5) / (1 + d1 * 0.0012);
      p.vy += t1y * swirlGain * (0.5 + p.z * 0.5) / (1 + d1 * 0.0012);

      var dx2 = p.x - v2x;
      var dy2 = p.y - v2y;
      var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) + 1e-4;
      var t2x = -dy2 / d2;
      var t2y = dx2 / d2;
      p.vx += t2x * swirl2 * (0.35 + nx);
      p.vy += t2y * swirl2 * (0.35 + ny);

      var dx0 = p.x - cx;
      var dy0 = p.y - cy;
      var d0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) + 1e-4;
      if (ew.burstW > 0.18) {
        var radIn = -0.11 * ew.burstW * (48 + mid * 70 + bv * 55) * dt;
        p.vx += (dx0 / d0) * radIn * (0.4 + hi * 0.35);
        p.vy += (dy0 / d0) * radIn * (0.4 + hi * 0.35);
      }

      if (pulse > 0.03) {
        var blast = pulse * (34 + ew.burstW * 48 + tr * 60) * dt;
        p.vx += (dx0 / d0) * blast * (0.58 - p.jitter * 0.34);
        p.vy += (dy0 / d0) * blast * (0.58 - p.jitter * 0.34);
        p.vz += pulse * tr * 22 * dt;
      }

      p.z += p.vz * dt * 0.85;
      if (p.z > 1) {
        p.z = 1;
        p.vz *= -0.35;
      } else if (p.z < 0.12) {
        p.z = 0.12;
        p.vz *= -0.4;
      }
      p.vz += (Math.sin(time * 2.4 + p.phase) * (6 + fl * 14) - p.vz * 0.08) * dt * 60 * (0.3 + b * 0.4);

      p.x += p.vx * dt * 0.94;
      p.y += p.vy * dt * 0.94;

      wrapAndScatter(p);
      clampSpeed(p, perf ? 320 : 460);

      var parallax = (p.z - 0.5) * w * (0.035 + b * 0.028 + mid * 0.018);
      var parallaxY = (p.z - 0.5) * h * (0.022 + hi * 0.02);
      var sx = p.x + parallax;
      var sy = p.y + parallaxY;

      var leader = p.role > 0.86;
      var tw = 0.5 + 0.5 * Math.sin(time * 3.4 + p.phase + hi * 6 + bv * 8);
      var hue = sig.hue0 + sig.hueSpread * (nx * 0.42 + mid * 0.36 + procHue * 34);
      hue += b * 42 + hi * 55 + fl * 62 + bv * 48 + tr * 70 + p.z * 28;
      hue += time * 10 * (0.05 + fl * 0.04);

      if (ew.fireW > 0.22) {
        var fh = 8 + p.jitter * 48 + b * 48 + tw * 26 + tr * 32;
        if (p.kind === 'ember') fh += 12;
        hue = hue * (1 - ew.fireW * 0.4) + fh * (ew.fireW * 0.4);
      }
      if (ew.oceanW > 0.32) {
        hue = hue * (1 - ew.oceanW * 0.42) + (168 + nx * 42 + mid * 32 + procHue * 20) * (ew.oceanW * 0.42);
      }

      hue = ((hue % 360) + 360) % 360;
      var sat = 50 + mid * 42 + b * 22 + pulse * 22 + ew.fireW * 24 + ew.oceanW * 16 + bv * 18;
      var light = 42 + b * 38 + p.z * 28 + (leader ? 16 : 0) + tw * 14 + hi * 22;
      var a = (0.034 + nx * 0.052 * vd) * (0.75 + p.z * 0.55) * (1 + tr * 0.55 + pulse * 0.52 + bv * 0.25);
      if (leader) a *= 1.38;
      if (p.kind === 'star') {
        a *= 1.55;
        light += 18;
      }
      if (warm) a *= 1.06;
      a = Math.min(0.26, a);

      var szBase = (leader ? 2.65 : (p.kind === 'star' ? 2.15 : 1.2)) * (0.55 + p.z * 0.95);
      szBase *= (1 + bv * 0.42 + b * 0.22 + ew.fireW * (p.kind === 'ember' ? 0.36 : 0.12)) * (perf ? 0.76 : 1);
      if (p.kind === 'foam') szBase *= 1.2;

      if (drawStride > 1 && (i % drawStride) !== 0) continue;

      ctx.fillStyle = 'hsla(' + hue.toFixed(1) + ',' + sat.toFixed(0) + '%,' + light.toFixed(0) + '%,' + a.toFixed(3) + ')';
      var rx = Math.floor(sx);
      var ry = Math.floor(sy);
      ctx.fillRect(rx, ry, Math.max(1, szBase), Math.max(1, szBase));
    }
  }

  window.NX = window.NX || {};
  NX.ProcParticles = {
    init: init,
    tick: tick,
    reseed: reseed,
    notifyPresetChange: notifyPresetChange
  };
})();
