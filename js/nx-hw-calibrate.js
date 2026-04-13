'use strict';
/**
 * nx-hw-calibrate.js — One-time GPU fill-rate probe; sets quality + perf lock on weak devices.
 */
(function () {
  if (!window.NX) return;

  var KEY_DONE = 'nx_hw_calibrate_v1';
  var KEY_TIER = 'nx_hw_tier';
  var KEY_TIER_READABLE = 'hw_tier';

  function compileTiny(gl) {
    var vsSrc = 'attribute vec4 p;void main(){gl_Position=p;}';
    var fsSrc = 'precision mediump float;void main(){gl_FragColor=vec4(0.08,0.09,0.14,1.);}';
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, vsSrc);
    var fs = sh(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  /**
   * @param {function(): void} done
   */
  function runIfNeeded(done) {
    var P = NX.Persist;
    try {
      var u = new URL(location.href);
      if (u.searchParams.get('nocal') === '1') {
        done();
        return;
      }
    } catch (eU) { /* ignore */ }

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
      return;
    }

    if (!P || P.getItem(KEY_DONE) === '1') {
      done();
      return;
    }

    var gl = NX.gl;
    var C = NX.C;
    if (!gl || !C || NX._fatalNoWebGL) {
      done();
      return;
    }

    var prog = compileTiny(gl);
    if (!prog) {
      P.setItem(KEY_DONE, '1');
      P.setItem(KEY_TIER, 'unknown');
      done();
      return;
    }

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');

    var fb = gl.createFramebuffer();
    var tex = gl.createTexture();
    var W = 768;
    var H = 768;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    var frames = 22;
    var t0 = performance.now();
    gl.viewport(0, 0, W, H);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (var i = 0; i < frames; i++) {
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.flush();
    var dt = Math.max(1e-3, performance.now() - t0);
    var fps = frames / (dt / 1000);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.useProgram(null);
    } catch (eGl) { /* ignore */ }

    var tier = 'mid';
    var qsel = document.getElementById('qsel');
    if (fps >= 52) {
      tier = 'fast';
      if (NX.setQualityPreset) NX.setQualityPreset('ultra');
      if (qsel) qsel.value = 'ultra';
    } else if (fps >= 28) {
      tier = 'mid';
      if (NX.setQualityPreset) NX.setQualityPreset('balanced');
      if (qsel) qsel.value = 'balanced';
    } else {
      tier = 'low';
      if (NX.setQualityPreset) NX.setQualityPreset('perf');
      if (qsel) qsel.value = 'perf';
      if (NX.S) {
        NX.S.nexusPerfLock = true;
        var nxPerf = document.getElementById('nx-perf');
        if (nxPerf) nxPerf.checked = true;
        var perfTop = document.getElementById('perfbtn');
        if (perfTop) perfTop.classList.add('on');
        document.body.classList.add('nexus-perf-top');
      }
    }

    P.setItem(KEY_TIER, tier);
    try {
      P.setItem(KEY_TIER_READABLE, tier);
    } catch (eA) { /* ignore */ }
    P.setItem(KEY_DONE, '1');
    done();
  }

  /**
   * Clear one-shot flag and re-run probe (e.g. after GPU driver update).
   * @param {function(): void} [done]
   */
  function forceRecalibrate(done) {
    var P = NX.Persist;
    try {
      if (P && P.removeItem) {
        P.removeItem(KEY_DONE);
      }
    } catch (eR) { /* ignore */ }
    runIfNeeded(done || function () {});
  }

  NX.HwCalibrate = {
    runIfNeeded: runIfNeeded,
    forceRecalibrate: forceRecalibrate,
    KEY_DONE: KEY_DONE,
    KEY_TIER: KEY_TIER,
    KEY_TIER_READABLE: KEY_TIER_READABLE
  };
})();
