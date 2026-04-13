'use strict';
/**
 * volumetric-fx.js — Optional integrated path: same GPU sim as GpuParticles, but draws through
 * an offscreen buffer then composites. Point sprites use the proven nexus-gpu-particles NDC
 * formula (parallax + palette + soft disk), not perspective world blobs. Proxy depth is still
 * computed in tick for future use; ribbons are off here (world-space lines smeared vs NDC).
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
  var gpuParams = new Float32Array(20);
  /** Max point sprite diameter in px (GPU cap); avoids one giant clamped disk = “blob”. */
  var maxPointSpritePx = 340;

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

  /* Same vertex math as nexus-gpu-particles.js VS_DRAW — NDC spread + parallax + per-point size. */
  var VS_WORLD = [
    'attribute vec2 a_uv;',
    'uniform sampler2D u_pos;',
    'uniform float u_worldScale,u_point,u_bass,u_mid,u_hi,u_bv,u_si,u_flux,u_hue,u_time;',
    'uniform float u_ptFbScale,u_psMax;',
    'uniform vec4 u_sigA;',
    'varying vec4 v_col;',
    'void main(){',
    ' vec3 praw=texture2D(u_pos,a_uv).rgb;',
    ' float ws=u_worldScale*0.52;',
    ' float dz=(praw.z-0.45)*1.75;',
    ' float wx=dz*0.11*sin(u_time*(0.88+u_bv*0.65)+praw.y*5.3+u_bass*4.1)+dz*0.08*u_flux*cos(praw.x*6.2+u_time*1.1);',
    ' float wy=dz*0.10*cos(u_time*(0.76+u_flux*0.72)+praw.x*4.8+u_mid*3.9)+dz*0.07*u_hi*sin(praw.y*5.5+u_time*0.95);',
    ' gl_Position=vec4(praw.x*ws+wx,praw.y*ws+wy,0.0,1.0);',
    ' vec3 cA=vec3(0.12,0.52,1.0);',
    ' vec3 cB=vec3(1.0,0.28,0.52);',
    ' vec3 cC=vec3(0.32,0.95,0.62);',
    ' float pk=fract(u_si*0.073+u_bv*0.22+u_mid*0.15+u_sigA.x*0.4+u_sigA.y*0.3+u_hue*0.08);',
    ' vec3 pal=mix(cA,cB,pk);pal=mix(pal,cC,u_mid*0.45);',
    ' float e=length(praw)+0.15;',
    ' float hyp=1.0+u_bass*0.85+u_mid*0.55+u_hi*0.45+u_flux*0.7+u_bv*0.65;',
    ' vec3 rgb=pal*(0.48+e*1.12)*hyp+vec3(u_hi*0.38,u_mid*0.24,u_bass*0.42)+u_sigA.xyz*0.14;',
    ' float hs=u_hue+u_bass*0.55+u_flux*0.4+a_uv.x*2.1+u_time*0.35;',
    ' vec3 sh=mix(rgb,rgb.brg,0.28*sin(hs));',
    ' sh=mix(sh,sh.grb,0.24*sin(hs*1.37+u_mid*3.1));',
    ' float tw=0.5+0.5*sin(u_bv*6.28318+u_si+a_uv.x*14.0);',
    ' float al=(0.14+e*1.28+u_bass*0.22+u_flux*0.18+tw*0.08)*mix(0.85,1.35,hyp*0.5);',
    ' v_col=vec4(sh,al);',
    ' float ps=u_point*(300.0)*(0.92+abs(praw.z)*10.5)*(1.0+u_bv*0.62)*(0.72+length(praw)*0.42)*hyp;',
    ' gl_PointSize=min(ps*u_ptFbScale,u_psMax);',
    '}'
  ].join('');

  /* Same fragment as nexus-gpu-particles.js FS_DRAW — crisp soft disk, not proxy-smeared blob. */
  var FS_WORLD = [
    'precision mediump float;',
    'varying vec4 v_col;',
    'void main(){',
    ' vec2 q=gl_PointCoord*2.0-1.0;',
    ' float d=length(q);',
    ' if(d>1.0)discard;',
    ' float core=1.0-d*d;',
    ' float vol=pow(max(0.0,1.0-d*d),1.65);',
    ' float a=v_col.a*core*vol*0.95;',
    ' vec3 rgb=v_col.rgb*(0.88+0.22*vol);',
    ' gl_FragColor=vec4(rgb,a);',
    '}'
  ].join('');

  var FS_SCREEN_ADD = [
    'precision mediump float;',
    'varying vec2 uv;',
    'uniform sampler2D u_tex;',
    'void main(){',
    ' vec4 c=texture2D(u_tex,uv);',
    ' gl_FragColor=vec4(c.rgb,c.a);',
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
    if (!S || S.nexusVolumetricProductEnabled === false) {
      if (ready) tearDown();
      return;
    }
    if (!NX.gl || NX._fatalNoWebGL) return;
    gl = NX.gl;
    if (ready && gl) return;
    tearDown();
    gl = NX.gl;
    if (!gl) return;
    try { gl.getExtension('OES_standard_derivatives'); } catch (eDer) { /* ignore */ }
    try {
      var rps = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
      if (rps && rps.length >= 2 && rps[1] > 0) {
        maxPointSpritePx = Math.min(400, Math.max(80, rps[1] * 0.98));
      }
    } catch (ePs) { /* ignore */ }
    if (NX.GpuParticles && typeof NX.GpuParticles.init === 'function') {
      try { NX.GpuParticles.init({}); } catch (eI) { /* ignore */ }
    }
    if (!NX.GpuParticles || !NX.GpuParticles.isReady || !NX.GpuParticles.isReady()) return;

    proxyProg = NX.mkProg(NX.VS, FS_PROXY);
    worldDrawProg = NX.mkProg(VS_WORLD, FS_WORLD);
    ribbonProg = null;
    screenAddProg = NX.mkProg(NX.VS, FS_SCREEN_ADD);
    advProg = NX.mkProg(NX.VS, FS_ADV);
    copySceneProg = NX.mkProg(NX.VS, FS_COPY);
    if (!proxyProg || !worldDrawProg || !screenAddProg || !advProg || !copySceneProg) {
      tearDown();
      return;
    }

    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    var st = NX.GpuParticles.getSimReadState && NX.GpuParticles.getSimReadState();
    if (!st) return;
    ribbonBuf = null;
    ribbonVertCount = 0;

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
    if (!S || S.nexusVolumetricProductEnabled === false) {
      if (ready) tearDown();
      return;
    }
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
    try { gl.disable(gl.DEPTH_TEST); } catch (eDt) { /* ignore */ }
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    /* Match GpuParticles.renderOverlay: additive accumulation between overlapping sprites. */
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(worldDrawProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, simIdxBuf);
    var al2 = gl.getAttribLocation(worldDrawProg, 'a_uv');
    gl.enableVertexAttribArray(al2);
    gl.vertexAttribPointer(al2, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, st.texPos);
    gl.uniform1i(gl.getUniformLocation(worldDrawProg, 'u_pos'), 0);
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_worldScale'), Math.max(0.4, Math.min(4.5, S.nexusVolWorldScale || 2.15)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_point'), S._iosCoarsePointer ? 2.6 : 4.1);
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_bass'), Math.max(0, Math.min(1, S.sBass || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_mid'), Math.max(0, Math.min(1, S.sMid || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_hi'), Math.max(0, Math.min(1, S.sHigh || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_bv'), Math.max(0, Math.min(1.35, S.beatVisual || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_si'), (S.curS | 0) * 1.0);
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_flux'), Math.max(0, Math.min(1, S.sFlux || 0)));
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_hue'), (S.nexusVolHuePhase || 0) + (S.hueShift || 0) * 0.02);
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_time'), S.GT || 0);
    var cw0 = (NX.C && NX.C.width) ? NX.C.width : pw;
    var ptFbScale = pw / Math.max(1, cw0);
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_ptFbScale'), ptFbScale);
    gl.uniform1f(gl.getUniformLocation(worldDrawProg, 'u_psMax'), maxPointSpritePx);
    var pk = (NX.ParticleSignature && NX.ParticleSignature.pack)
      ? NX.ParticleSignature.pack(S.curS | 0, S.bcLastPresetKey || '', NX.P && NX.P.PAL != null ? NX.P.PAL : 0)
      : { u_sigA: new Float32Array([0.5, 0.5, 0.5, 0.5]) };
    gl.uniform4f(gl.getUniformLocation(worldDrawProg, 'u_sigA'), pk.u_sigA[0], pk.u_sigA[1], pk.u_sigA[2], pk.u_sigA[3]);
    gl.drawArrays(gl.POINTS, 0, simN);
    gl.disableVertexAttribArray(al2);

    var preset = NX.VolumetricPresetResolve ? NX.VolumetricPresetResolve.resolve(S) : {};
    var prims = preset.primitives || {};

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
