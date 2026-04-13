'use strict';
/**
 * volumetric-fx.js — Integrated volumetric particle product: proxy depth (luma + fwidth),
 * world-space point draw with depth buffer, spectrum texture upload, ribbon lines (GPU),
 * optional advanced screen pass when enabled. Composites additive after post copy to screen.
 */
(function () {
  var gl = null;
  var ready = false;
  var useIntegratedPipeline = false;
  var sceneTexRef = null;
  var prevSceneTex = null;
  var proxyProg = null;
  var worldDrawProg = null;
  var ribbonProg = null;
  var screenAddProg = null;
  var advProg = null;
  var copySceneProg = null;
  var fbProxy = null;
  var texProxy = null;
  var fbParticle = null;
  var fbParticleWrap = null;
  var texParticle = null;
  var texSceneHist = null;
  var fbCopy = null;
  var quadBuf = null;
  var ribbonBuf = null;
  var ribbonVertCount = 0;
  var simIdxBuf = null;
  var simN = 0;
  var spectrumTex = null;
  var SPECT_W = 32;
  var SPECT_H = 16;
  var pw = 0;
  var ph = 0;
  var prxW = 0;
  var prxH = 0;
  var swHist = 0;
  var shHist = 0;
  var matP = new Float32Array(16);
  var matV = new Float32Array(16);
  var matVP = new Float32Array(16);
  var gpuParams = new Float32Array(20);
  var lastRibbonKey = '';

  var FS_PROXY = [
    '#extension GL_OES_standard_derivatives : enable',
    'precision mediump float;',
    'varying vec2 uv;',
    'uniform sampler2D u_scene;',
    'uniform sampler2D u_prevScene;',
    'uniform vec3 u_w;',
    'void main(){',
    ' vec3 c=texture2D(u_scene,uv).rgb;',
    ' vec3 p=texture2D(u_prevScene,uv).rgb;',
    ' float l=dot(c,vec3(0.299,0.587,0.114));',
    ' float lp=dot(p,vec3(0.299,0.587,0.114));',
    ' float edge=length(fwidth(c))*10.0;',
    ' float motion=length(c-p);',
    ' float d=clamp(l*u_w.x+edge*u_w.y*0.35+motion*u_w.y*0.65+abs(l-lp)*0.5,0.0,1.0);',
    ' gl_FragColor=vec4(d,d,d,1.0);',
    '}'
  ].join('');

  var FS_COPY = [
    'precision mediump float;',
    'varying vec2 uv;',
    'uniform sampler2D u_tex;',
    'void main(){gl_FragColor=texture2D(u_tex,uv);}'
  ].join('');

  var VS_WORLD = [
    'attribute vec2 a_uv;',
    'uniform sampler2D u_pos;',
    'uniform mat4 uViewProj;',
    'uniform float u_worldScale,u_point,u_bass,u_mid,u_hi,u_bv,u_flux,u_hue;',
    'uniform vec4 u_sigA;',
    'uniform vec4 u_colLaw;',
    'varying vec4 v_col;',
    'void main(){',
    ' vec3 praw=texture2D(u_pos,a_uv).rgb;',
    ' vec3 wp=praw*u_worldScale;',
    ' vec4 clip=uViewProj*vec4(wp,1.0);',
    ' gl_Position=clip;',
    ' float e=length(praw)+0.15;',
    ' vec3 cA=vec3(0.12,0.52,1.0);',
    ' vec3 cB=vec3(1.0,0.28,0.52);',
    ' float pk=fract(u_sigA.x+u_sigA.y+u_bv*0.2+u_mid*0.15);',
    ' vec3 pal=mix(cA,cB,pk);',
    ' float hyp=1.0+u_bass*u_colLaw.y+u_flux*u_colLaw.z+u_bv*u_colLaw.w;',
    ' vec3 rgb=pal*(0.5+e*1.05)*hyp*u_colLaw.x+vec3(u_hi*0.25,u_mid*0.18,u_bass*0.32);',
    ' float al=0.12+e*1.05+u_flux*0.14;',
    ' v_col=vec4(rgb,al);',
    ' float ps=u_point*(240.0/max(0.35,clip.w))*(0.85+abs(praw.z)*8.0)*(0.7+length(praw)*0.35);',
    ' gl_PointSize=ps;',
    '}'
  ].join('');

  var FS_WORLD = [
    'precision mediump float;',
    'uniform sampler2D u_proxy;',
    'uniform sampler2D u_spec;',
    'uniform vec2 u_sceneUvScale;',
    'uniform float u_softZ;',
    'varying vec4 v_col;',
    'void main(){',
    ' vec2 q=gl_PointCoord*2.0-1.0;',
    ' if(length(q)>1.0)discard;',
    ' float dz=1.0-smoothstep(0.0,u_softZ,gl_FragCoord.z);',
    ' vec2 sceneUv=gl_FragCoord.xy*u_sceneUvScale;',
    ' float pd=texture2D(u_proxy,sceneUv).r;',
    ' float fog=smoothstep(0.15,0.92,pd);',
    ' float sm=texture2D(u_spec,vec2(gl_PointCoord.x,0.12)).r;',
    ' float a=v_col.a*(0.55+0.45*dz)*(0.65+fog*0.5)*(1.0+sm*0.22);',
    ' vec3 rgb=v_col.rgb*(1.0+sm*0.12);',
    ' gl_FragColor=vec4(rgb,a);',
    '}'
  ].join('');

  var VS_RIBBON = [
    'attribute vec4 a_seg;',
    'attribute float a_which;',
    'uniform sampler2D u_pos;',
    'uniform mat4 uViewProj;',
    'uniform float u_worldScale;',
    'void main(){',
    ' vec2 uva=mix(a_seg.xy,a_seg.zw,a_which);',
    ' vec3 praw=texture2D(u_pos,uva).rgb;',
    ' vec3 wp=praw*u_worldScale;',
    ' gl_Position=uViewProj*vec4(wp,1.0);',
    '}'
  ].join('');

  var FS_RIBBON = [
    'precision mediump float;',
    'uniform vec4 u_color;',
    'void main(){',
    ' gl_FragColor=vec4(u_color.rgb,u_color.a*0.85);',
    '}'
  ].join('');

  var FS_SCREEN_ADD = [
    'precision mediump float;',
    'varying vec2 uv;',
    'uniform sampler2D u_tex;',
    'void main(){',
    ' vec4 c=texture2D(u_tex,uv);',
    ' gl_FragColor=vec4(c.rgb*c.a,c.a);',
    '}'
  ].join('');

  var FS_ADV = [
    'precision mediump float;',
    'varying vec2 uv;',
    'uniform sampler2D u_part;',
    'uniform float u_w;',
    'void main(){',
    ' float d=0.0;',
    ' for(int i=-1;i<=1;i++){',
    '  for(int j=-1;j<=1;j++){',
    '   d+=dot(texture2D(u_part,uv+vec2(float(i),float(j))*u_w).rgb,vec3(0.33));',
    '  }',
    ' }',
    ' d/=9.0;',
    ' float m=smoothstep(0.35,0.85,d);',
    ' gl_FragColor=vec4(vec3(0.15,0.45,0.95)*m*0.35,m*0.22);',
    '}'
  ].join('');

  function mat4PerspectiveRad(out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy * 0.5);
    var nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = out[2] = out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = out[7] = 0;
    out[8] = out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;
  }

  function mat4LookAt(out, ex, ey, ez, cx, cy, cz) {
    var z0 = cx - ex;
    var z1 = cy - ey;
    var z2 = cz - ez;
    var len = Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2) || 1e-6;
    len = 1 / len;
    z0 *= len; z1 *= len; z2 *= len;
    var x0 = -z2;
    var x1 = 0;
    var x2 = z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2) || 1;
    len = 1 / len;
    x0 *= len; x1 *= len; x2 *= len;
    var y0 = z1 * x2 - z2 * x1;
    var y1 = z2 * x0 - z0 * x2;
    var y2 = z0 * x1 - z1 * x0;
    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * ex + x1 * ey + x2 * ez);
    out[13] = -(y0 * ex + y1 * ey + y2 * ez);
    out[14] = -(z0 * ex + z1 * ey + z2 * ez);
    out[15] = 1;
  }

  function mat4Multiply(out, a, b) {
    var i;
    var j;
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        out[i + j * 4] =
          a[i] * b[j * 4] +
          a[i + 4] * b[1 + j * 4] +
          a[i + 8] * b[2 + j * 4] +
          a[i + 12] * b[3 + j * 4];
      }
    }
  }

  function buildViewProj(S, cw, ch) {
    var aspect = ch > 0 ? cw / ch : 1.5;
    if (!(aspect > 0.05) || aspect > 20) aspect = 1.5;
    mat4PerspectiveRad(matP, (50 * Math.PI) / 180, aspect, 0.06, 32);
    var t = S.GT || 0;
    var mx = S.mouseSmooth || [0, 0];
    var cam = NX.camera && typeof NX.camera.get === 'function'
      ? NX.camera.get('orbit', t, { az: 0.32 + mx[0] * 2.2, el: 0.36 + mx[1] * 0.8, dist: 4.2 })
      : { ro: [2.0, 1.2, 3.6], ta: [0, 0, 0] };
    mat4LookAt(matV, cam.ro[0], cam.ro[1], cam.ro[2], cam.ta[0], cam.ta[1], cam.ta[2]);
    mat4Multiply(matVP, matP, matV);
  }

  function mkFboColorDepth(w, h) {
    var color = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, color);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    var rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) {
      try {
        gl.deleteFramebuffer(f);
        gl.deleteTexture(color);
        gl.deleteRenderbuffer(rb);
      } catch (e) { /* ignore */ }
      return null;
    }
    return { f: f, t: color, depthRb: rb };
  }

  function buildRibbonBuffer(Wg, Hg, step) {
    var verts = [];
    var y;
    var x;
    for (y = 0; y < Hg; y += step) {
      for (x = 0; x < Wg - 1; x++) {
        verts.push((x + 0.5) / Wg, (y + 0.5) / Hg, (x + 1.5) / Wg, (y + 0.5) / Hg, 0);
        verts.push((x + 0.5) / Wg, (y + 0.5) / Hg, (x + 1.5) / Wg, (y + 0.5) / Hg, 1);
      }
    }
    return new Float32Array(verts);
  }

  function ensureSpectrum() {
    if (spectrumTex) return;
    spectrumTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, spectrumTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var z = new Uint8Array(SPECT_W * SPECT_H * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SPECT_W, SPECT_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, z);
  }

  function uploadSpectrum(S) {
    ensureSpectrum();
    var freq = S && S.freqArr;
    if (!freq || !freq.length) return;
    var buf = new Uint8Array(SPECT_W * SPECT_H * 4);
    var i;
    var j;
    var idx;
    var logN = Math.log(1 + freq.length);
    for (j = 0; j < SPECT_H; j++) {
      for (i = 0; i < SPECT_W; i++) {
        var t = (i + 0.5) / SPECT_W;
        var src = Math.floor((Math.exp(t * logN) - 1)) % freq.length;
        var v = freq[src] / 255;
        var w = v * (0.55 + (j / SPECT_H) * 0.45) * 255;
        idx = (j * SPECT_W + i) * 4;
        buf[idx] = buf[idx + 1] = buf[idx + 2] = Math.min(255, w);
        buf[idx + 3] = 255;
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, spectrumTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SPECT_W, SPECT_H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  }

  function tearDown() {
    ready = false;
    useIntegratedPipeline = false;
    try {
      if (fbProxy) gl.deleteFramebuffer(fbProxy);
      if (texProxy) gl.deleteTexture(texProxy);
      if (fbParticleWrap) {
        gl.deleteFramebuffer(fbParticleWrap.f);
        gl.deleteTexture(fbParticleWrap.t);
        if (fbParticleWrap.depthRb) gl.deleteRenderbuffer(fbParticleWrap.depthRb);
      }
      if (fbCopy) gl.deleteFramebuffer(fbCopy);
      if (texSceneHist) gl.deleteTexture(texSceneHist);
      if (proxyProg) gl.deleteProgram(proxyProg);
      if (worldDrawProg) gl.deleteProgram(worldDrawProg);
      if (ribbonProg) gl.deleteProgram(ribbonProg);
      if (screenAddProg) gl.deleteProgram(screenAddProg);
      if (advProg) gl.deleteProgram(advProg);
      if (copySceneProg) gl.deleteProgram(copySceneProg);
      if (spectrumTex) gl.deleteTexture(spectrumTex);
    } catch (e) { /* ignore */ }
    fbProxy = texProxy = fbParticle = texParticle = null;
    fbParticleWrap = null;
    fbCopy = null;
    texSceneHist = null;
    proxyProg = worldDrawProg = ribbonProg = screenAddProg = advProg = copySceneProg = null;
    spectrumTex = null;
    ribbonBuf = simIdxBuf = quadBuf = null;
    prevSceneTex = null;
    lastRibbonKey = '';
  }

  function ensureSceneHist(sw, sh) {
    if (texSceneHist && sw === swHist && sh === shHist) return;
    try {
      if (texSceneHist) gl.deleteTexture(texSceneHist);
    } catch (e0) { /* ignore */ }
    swHist = sw;
    shHist = sh;
    texSceneHist = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texSceneHist);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function copyTex(dst, src, w, h) {
    if (!copySceneProg || !dst || !src || !quadBuf) return;
    if (!fbCopy) fbCopy = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbCopy);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dst, 0);
    gl.viewport(0, 0, w, h);
    gl.useProgram(copySceneProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    var al = gl.getAttribLocation(copySceneProg, 'pos');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(gl.getUniformLocation(copySceneProg, 'u_tex'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(al);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function ensureInit() {
    var S = NX.S;
    if (!S || S.nexusVolumetricProductEnabled === false) return;
    if (!NX.gl || NX._fatalNoWebGL) return;
    gl = NX.gl;
    if (ready && gl) return;
    tearDown();
    gl = NX.gl;
    if (!gl) return;
    try { gl.getExtension('OES_standard_derivatives'); } catch (eDer) { /* ignore */ }
    if (NX.GpuParticles && typeof NX.GpuParticles.init === 'function') {
      try { NX.GpuParticles.init({}); } catch (eI) { /* ignore */ }
    }
    if (!NX.GpuParticles || !NX.GpuParticles.isReady || !NX.GpuParticles.isReady()) return;

    proxyProg = NX.mkProg(NX.VS, FS_PROXY);
    worldDrawProg = NX.mkProg(VS_WORLD, FS_WORLD);
    ribbonProg = NX.mkProg(VS_RIBBON, FS_RIBBON);
    screenAddProg = NX.mkProg(NX.VS, FS_SCREEN_ADD);
    advProg = NX.mkProg(NX.VS, FS_ADV);
    copySceneProg = NX.mkProg(NX.VS, FS_COPY);
    if (!proxyProg || !worldDrawProg || !ribbonProg || !screenAddProg || !copySceneProg) {
      tearDown();
      return;
    }

    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    var st = NX.GpuParticles.getSimReadState && NX.GpuParticles.getSimReadState();
    if (!st) return;
    var preset0 = NX.VolumetricPresetResolve && NX.VolumetricPresetResolve.resolve
      ? NX.VolumetricPresetResolve.resolve(S)
      : null;
    var pr0 = preset0 && preset0.primitives ? preset0.primitives : {};
    var step = pr0.ribbonGridStep != null ? Math.max(1, Math.min(32, pr0.ribbonGridStep | 0)) : 8;
    var rb = buildRibbonBuffer(st.W, st.H, step);
    ribbonBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ribbonBuf);
    gl.bufferData(gl.ARRAY_BUFFER, rb, gl.STATIC_DRAW);
    ribbonVertCount = rb.length / 5;

    simIdxBuf = null;
    simN = st.N;

    ensureSpectrum();
    ready = true;
    useIntegratedPipeline = true;
    resize();
    if (typeof console !== 'undefined' && console.info) console.info('[NEXUS VolumetricFX] integrated pipeline active');
  }

  function resize() {
    if (!gl) return;
    var S = NX.S;
    if (!S) return;
    var scale = 0.75;
    if (NX.VolumetricPresetResolve && NX.VolumetricPresetResolve.resolve) {
      var pr = NX.VolumetricPresetResolve.resolve(S);
      if (pr.lod && pr.lod.particleFbScale) scale = pr.lod.particleFbScale;
    }
    pw = Math.max(64, Math.floor(S.FW * scale));
    ph = Math.max(64, Math.floor(S.FH * scale));
    prxW = Math.max(32, Math.floor(S.FW / 2));
    prxH = Math.max(32, Math.floor(S.FH / 2));

    try {
      if (fbProxy) gl.deleteFramebuffer(fbProxy);
      if (texProxy) gl.deleteTexture(texProxy);
      if (fbParticleWrap) {
        gl.deleteFramebuffer(fbParticleWrap.f);
        gl.deleteTexture(fbParticleWrap.t);
        if (fbParticleWrap.depthRb) gl.deleteRenderbuffer(fbParticleWrap.depthRb);
      }
    } catch (eR) { /* ignore */ }

    texProxy = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texProxy);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, prxW, prxH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    fbProxy = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbProxy);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texProxy, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    fbParticleWrap = mkFboColorDepth(pw, ph);
    if (!fbParticleWrap) {
      tearDown();
      return;
    }
    fbParticle = fbParticleWrap.f;
    texParticle = fbParticleWrap.t;

    ensureSceneHist(S.FW, S.FH);
  }

  function setSourceSceneTexture(tex) {
    sceneTexRef = tex || null;
  }

  function tick(dt) {
    var S = NX.S;
    if (!S || S.nexusVolumetricProductEnabled === false) return;
    if (S.nexusMixParticlesEnabled === false) return;
    if (!S.nexusGpuParticlesEnabled) return;
    if (S.nexusPerfLock || S.nexusVizPerformance) return;
    ensureInit();
    if (!ready || !gl) return;

    var sc = 0.75;
    if (NX.VolumetricPresetResolve && NX.VolumetricPresetResolve.resolve) {
      var pr2 = NX.VolumetricPresetResolve.resolve(S);
      if (pr2.lod && pr2.lod.particleFbScale) sc = pr2.lod.particleFbScale;
    }
    if (Math.abs(pw - Math.floor(S.FW * sc)) > 2 || Math.abs(ph - Math.floor(S.FH * sc)) > 2) {
      if (S.FW > 8 && S.FH > 8) resize();
    }

    var preset = NX.VolumetricPresetResolve ? NX.VolumetricPresetResolve.resolve(S) : null;
    if (preset && NX.VolumetricPresetResolve.toGpuParams) {
      gpuParams = NX.VolumetricPresetResolve.toGpuParams(preset);
    }

    var stR = NX.GpuParticles.getSimReadState && NX.GpuParticles.getSimReadState();
    if (stR && preset) {
      var prR = preset.primitives || {};
      var rStep = prR.ribbonGridStep != null ? Math.max(1, Math.min(32, prR.ribbonGridStep | 0)) : 8;
      var rKey = stR.W + 'x' + stR.H + ':' + rStep;
      if (rKey !== lastRibbonKey && gl) {
        lastRibbonKey = rKey;
        try {
          if (ribbonBuf) gl.deleteBuffer(ribbonBuf);
        } catch (eRb) { /* ignore */ }
        var rb = buildRibbonBuffer(stR.W, stR.H, rStep);
        ribbonBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ribbonBuf);
        gl.bufferData(gl.ARRAY_BUFFER, rb, gl.STATIC_DRAW);
        ribbonVertCount = rb.length / 5;
      }
    }

    uploadSpectrum(S);

    if (!sceneTexRef || !proxyProg) return;

    ensureSceneHist(S.FW, S.FH);

    var px = preset && preset.proxyDepth ? preset.proxyDepth : {};
    gl.viewport(0, 0, prxW, prxH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbProxy);
    gl.useProgram(proxyProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    var al = gl.getAttribLocation(proxyProg, 'pos');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTexRef);
    gl.uniform1i(gl.getUniformLocation(proxyProg, 'u_scene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prevSceneTex || sceneTexRef);
    gl.uniform1i(gl.getUniformLocation(proxyProg, 'u_prevScene'), 1);
    gl.uniform3f(
      gl.getUniformLocation(proxyProg, 'u_w'),
      px.lumaWeight != null ? px.lumaWeight : 0.55,
      px.motionWeight != null ? px.motionWeight : 2.4,
      0
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(al);

    if (texSceneHist && sceneTexRef) {
      copyTex(texSceneHist, sceneTexRef, S.FW, S.FH);
      prevSceneTex = texSceneHist;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function drawWorldParticles() {
    var S = NX.S;
    if (!ready || !worldDrawProg || !fbParticle) return;
    var st = NX.GpuParticles.getSimReadState && NX.GpuParticles.getSimReadState();
    if (!st || !st.texPos) return;
    if (!simIdxBuf || simN !== st.N) {
      simN = st.N;
      var uvs = new Float32Array(simN * 2);
      var x;
      var y;
      var idx = 0;
      for (y = 0; y < st.H; y++) {
        for (x = 0; x < st.W; x++) {
          uvs[idx++] = (x + 0.5) / st.W;
          uvs[idx++] = (y + 0.5) / st.H;
        }
      }
      if (simIdxBuf) gl.deleteBuffer(simIdxBuf);
      simIdxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, simIdxBuf);
      gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbParticle);
    gl.viewport(0, 0, pw, ph);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    buildViewProj(S, pw, ph);
    gl.useProgram(worldDrawProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, simIdxBuf);
    var al2 = gl.getAttribLocation(worldDrawProg, 'a_uv');
    gl.enableVertexAttribArray(al2);
    gl.vertexAttribPointer(al2, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, st.texPos);
    gl.uniform1i(gl.getUniformLocation(worldDrawProg, 'u_pos'), 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(worldDrawProg, 'uViewProj'), false, matVP);
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_worldScale'), Math.max(0.4, Math.min(4.5, S.nexusVolWorldScale || 2.15)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_point'), S._iosCoarsePointer ? 2.2 : 3.6);
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_bass'), Math.max(0, Math.min(1, S.sBass || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_mid'), Math.max(0, Math.min(1, S.sMid || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_hi'), Math.max(0, Math.min(1, S.sHigh || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_bv'), Math.max(0, Math.min(1.35, S.beatVisual || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_flux'), Math.max(0, Math.min(1, S.sFlux || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_hue'), (S.nexusVolHuePhase || 0) * 0.02);
    var pk = (NX.ParticleSignature && NX.ParticleSignature.pack)
      ? NX.ParticleSignature.pack(S.curS | 0, S.bcLastPresetKey || '', NX.P && NX.P.PAL != null ? NX.P.PAL : 0)
      : { u_sigA: new Float32Array([0.5, 0.5, 0.5, 0.5]) };
    gl.uniform4f(gl.getUniformLocation(worldDrawProg, 'u_sigA'), pk.u_sigA[0], pk.u_sigA[1], pk.u_sigA[2], pk.u_sigA[3]);
    var sat = gpuParams[9] != null ? gpuParams[9] : 1;
    var br = gpuParams[10] != null ? gpuParams[10] : 1;
    var bf = gpuParams[11] != null ? gpuParams[11] : 0.35;
    var hs = gpuParams[8] != null ? gpuParams[8] : 0;
    gl.uniform4f(gl.getUniformLocation(worldDrawProg, 'u_colLaw'), sat * (1 + hs), br, 0.85, bf);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texProxy);
    gl.uniform1i(gl.getUniformLocation(worldDrawProg, 'u_proxy'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, spectrumTex || texProxy);
    gl.uniform1i(gl.getUniformLocation(worldDrawProg, 'u_spec'), 2);
    gl.uniform2f(gl.getUniformLocation(worldDrawProg, 'u_sceneUvScale'), 1 / Math.max(1, pw), 1 / Math.max(1, ph));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_softZ'), 0.025);
    gl.drawArrays(gl.POINTS, 0, simN);
    gl.disableVertexAttribArray(al2);

    var preset = NX.VolumetricPresetResolve ? NX.VolumetricPresetResolve.resolve(S) : {};
    var prims = preset.primitives || {};
    var wantRibbon = prims.points !== false && ribbonBuf && ribbonProg && ribbonVertCount > 0;
    if (S.nexusVizPerformance && preset.lod && preset.lod.disableRibbonUnderVizPerf) wantRibbon = false;
    if (wantRibbon) {
      gl.depthMask(false);
      gl.lineWidth(1);
      gl.useProgram(ribbonProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, ribbonBuf);
      var locSeg = gl.getAttribLocation(ribbonProg, 'a_seg');
      var locWh = gl.getAttribLocation(ribbonProg, 'a_which');
      gl.enableVertexAttribArray(locSeg);
      gl.vertexAttribPointer(locSeg, 4, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(locWh);
      gl.vertexAttribPointer(locWh, 1, gl.FLOAT, false, 20, 16);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, st.texPos);
      gl.uniform1i(gl.getUniformLocation(ribbonProg, 'u_pos'), 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(ribbonProg, 'uViewProj'), false, matVP);
      gl.uniform1f(gl.getUniformLocation(ribbonProg, 'u_worldScale'), Math.max(0.4, Math.min(4.5, S.nexusVolWorldScale || 2.15)));
      var ro = prims.ribbonOpacity != null ? prims.ribbonOpacity : 0.4;
      gl.uniform4f(gl.getUniformLocation(ribbonProg, 'u_color'), 0.35, 0.78, 1.0, ro);
      gl.drawArrays(gl.LINES, 0, ribbonVertCount);
      gl.disableVertexAttribArray(locSeg);
      gl.disableVertexAttribArray(locWh);
      gl.depthMask(true);
    }

    if (S.nexusVolAdvancedFX && !S._iosCoarsePointer && advProg && prims.metaballScreenPass) {
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(advProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      var al3 = gl.getAttribLocation(advProg, 'pos');
      gl.enableVertexAttribArray(al3);
      gl.vertexAttribPointer(al3, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texParticle);
      gl.uniform1i(gl.getUniformLocation(advProg, 'u_part'), 0);
      gl.uniform1f(gl.getUniformLocation(advProg, 'u_w'), 1 / pw);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(al3);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function compositeToScreen(screenW, screenH) {
    var S = NX.S;
    if (!ready || !screenAddProg || !texParticle) return;
    if (!S || S.nexusVolumetricProductEnabled === false) return;
    if (S.nexusMixParticlesEnabled === false) return;
    if (!S.nexusGpuParticlesEnabled) return;
    if (S.nexusPerfLock || S.nexusVizPerformance) return;
    if (!NX.GpuParticles || !NX.GpuParticles.isReady || !NX.GpuParticles.isReady()) return;
    drawWorldParticles();
    gl.viewport(0, 0, screenW, screenH);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(screenAddProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    var al = gl.getAttribLocation(screenAddProg, 'pos');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texParticle);
    gl.uniform1i(gl.getUniformLocation(screenAddProg, 'u_tex'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(al);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
  }

  function onPresetChange() {
    if (NX.GpuParticles && NX.GpuParticles.notifyPresetChange) {
      try { NX.GpuParticles.notifyPresetChange(); } catch (e) { /* ignore */ }
    }
  }

  window.NX = window.NX || {};
  NX.VolumetricFX = {
    ensureInit: ensureInit,
    tearDown: tearDown,
    resize: resize,
    tick: tick,
    setSourceSceneTexture: setSourceSceneTexture,
    compositeToScreen: compositeToScreen,
    onPresetChange: onPresetChange,
    isReady: function () { return !!ready; },
    get useIntegratedPipeline() { return useIntegratedPipeline; },
    set useIntegratedPipeline(v) { useIntegratedPipeline = !!v; }
  };
})();
