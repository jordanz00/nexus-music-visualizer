'use strict';
/**
 * nexus-gpu-particles.js — WebGL1 ping-pong particle simulation (RGBA float textures)
 * + additive POINTS overlay. Self-disables if float FBO or vertex textures unsupported.
 */
(function () {
  var W = 192;
  var H = 192;
  var N = W * H;
  var gl = null;
  var ready = false;
  var ping = 0;
  var tex = [null, null];
  var fb = [null, null];
  var simProg = null;
  var drawProg = null;
  var idxBuf = null;
  var VS_SIM = 'attribute vec2 a_uv;varying vec2 v_uv;void main(){v_uv=a_uv;gl_Position=vec4(a_uv*2.0-1.0,0.0,1.0);}';
  var FS_SIM = [
    'precision highp float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_prev;uniform float u_time,u_bass,u_flux;',
    'float n2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'void main(){',
    ' vec4 s=texture2D(u_prev,v_uv);',
    ' vec2 p=s.xy*2.0-1.0;vec2 v=s.zw;',
    ' vec2 g=vec2(n2(v_uv*30.7+u_time),n2(v_uv*22.3-u_time*.7))-0.5;',
    ' v=v*.965+g*0.0022*(0.35+u_bass);',
    ' v.y-=0.00035;',
    ' p+=v*(0.55+u_bass*0.85);',
    ' if(p.x>1.0)p.x-=2.0;if(p.x<-1.0)p.x+=2.0;',
    ' if(p.y>1.0)p.y-=2.0;if(p.y<-1.0)p.y+=2.0;',
    ' float sp=length(v)+1e-5;',
    ' float life=clamp(1.0-sp*1.8,0.0,1.0)+u_flux*.08;',
    ' if(life<0.08||n2(v_uv+u_time)<0.00035){',
    '  p=(vec2(n2(v_uv+u_time),n2(v_uv*1.7+u_time*.3))-0.5)*1.9;',
    '  v=(vec2(n2(v_uv*5.1),n2(v_uv*3.9))-0.5)*0.04;',
    ' }',
    ' gl_FragColor=vec4(p*0.5+0.5,v);',
    '}'
  ].join('');

  var VS_DRAW = [
    'attribute vec2 a_uv;',
    'uniform sampler2D u_state;',
    'uniform float u_point;',
    'varying vec4 v_col;',
    'void main(){',
    ' vec4 st=texture2D(u_state,a_uv);',
    ' vec2 pos=st.xy*2.0-1.0;',
    ' gl_Position=vec4(pos,0.0,1.0);',
    ' float e=length(st.zw)+1e-5;',
    ' v_col=vec4(0.35+st.z*0.4,0.55+st.w*0.35,0.95,0.22+e*1.8);',
    ' gl_PointSize=u_point*(0.85+length(st.zw)*12.0);',
    '}'
  ].join('');

  var FS_DRAW = [
    'precision mediump float;',
    'varying vec4 v_col;',
    'void main(){',
    ' vec2 q=gl_PointCoord*2.0-1.0;',
    ' float d=length(q);',
    ' if(d>1.0)discard;',
    ' float a=(1.0-d*d)*v_col.a;',
    ' gl_FragColor=vec4(v_col.rgb,a);',
    '}'
  ].join('');

  function mkShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[NEXUS GpuParticles] shader', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function mkProg(vs, fs) {
    var v = mkShader(gl.VERTEX_SHADER, vs);
    var f = mkShader(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('[NEXUS GpuParticles] link', gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  function mkFloatTex() {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var data = new Float32Array(W * H * 4);
    var i;
    for (i = 0; i < W * H; i++) {
      var o = i * 4;
      data[o] = Math.random();
      data[o + 1] = Math.random();
      data[o + 2] = (Math.random() - 0.5) * 0.06;
      data[o + 3] = (Math.random() - 0.5) * 0.06;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.FLOAT, data);
    return t;
  }

  function mkFbo(tex) {
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return st === gl.FRAMEBUFFER_COMPLETE ? f : null;
  }

  function tearDown() {
    ready = false;
    ping = 0;
    quadUv = null;
    if (!gl) return;
    try {
      if (fb[0]) gl.deleteFramebuffer(fb[0]);
      if (fb[1]) gl.deleteFramebuffer(fb[1]);
      if (tex[0]) gl.deleteTexture(tex[0]);
      if (tex[1]) gl.deleteTexture(tex[1]);
      if (idxBuf) gl.deleteBuffer(idxBuf);
      if (simProg) gl.deleteProgram(simProg);
      if (drawProg) gl.deleteProgram(drawProg);
    } catch (eTd) { /* invalid GL after context loss */ }
    fb[0] = fb[1] = null;
    tex[0] = tex[1] = null;
    idxBuf = null;
    simProg = drawProg = null;
  }

  function pickGrid() {
    try {
      var q = document.getElementById('qsel');
      var v = q && q.value ? q.value : 'balanced';
      if (v === 'ultra') return { w: 256, h: 256 };
      if (v === 'perf') return { w: 128, h: 128 };
    } catch (eQ) { /* ignore */ }
    return { w: 192, h: 192 };
  }

  function init(opts) {
    var force = opts && opts.force;
    if (ready && !force) return;
    tearDown();
    var dim = pickGrid();
    W = dim.w;
    H = dim.h;
    N = W * H;
    gl = NX.gl;
    if (!gl || NX._fatalNoWebGL) return;
    var vtxUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) | 0;
    if (vtxUnits < 1) {
      if (typeof console !== 'undefined' && console.info) console.info('[NEXUS GpuParticles] disabled — no vertex texture units');
      return;
    }
    if (!gl.getExtension('OES_texture_float')) return;
    tex[0] = mkFloatTex();
    tex[1] = mkFloatTex();
    fb[0] = mkFbo(tex[0]);
    fb[1] = mkFbo(tex[1]);
    if (!fb[0] || !fb[1]) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[NEXUS GpuParticles] float FBO incomplete — disabled');
      tex[0] = tex[1] = null;
      return;
    }
    simProg = mkProg(VS_SIM, FS_SIM);
    drawProg = mkProg(VS_DRAW, FS_DRAW);
    if (!simProg || !drawProg) return;
    var uvs = new Float32Array(N * 2);
    var x;
    var y;
    var idx = 0;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        uvs[idx++] = (x + 0.5) / W;
        uvs[idx++] = (y + 0.5) / H;
      }
    }
    idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    ready = true;
  }

  /* Full-screen sim: 4 verts with corners 0,0 1,0 0,1 1,1 — separate from POINTS buffer */
  var quadUv = null;
  function ensureQuad() {
    if (quadUv) return;
    quadUv = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadUv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  }

  function tickFixed(dt) {
    var S = NX.S;
    if (!ready || !S || !S.nexusGpuParticlesEnabled || S.nexusPerfLock || S.nexusVizPerformance) return;
    if (!simProg || !gl || (gl.isContextLost && gl.isContextLost())) return;
    ensureQuad();
    var readT = tex[ping];
    var writeF = fb[1 - ping];
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeF);
    gl.viewport(0, 0, W, H);
    gl.useProgram(simProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadUv);
    var al = gl.getAttribLocation(simProg, 'a_uv');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readT);
    gl.uniform1i(gl.getUniformLocation(simProg, 'u_prev'), 0);
    gl.uniform1f(gl.getUniformLocation(simProg, 'u_time'), S.GT || 0);
    gl.uniform1f(gl.getUniformLocation(simProg, 'u_bass'), Math.max(0, Math.min(1, S.sBass || 0)));
    gl.uniform1f(gl.getUniformLocation(simProg, 'u_flux'), Math.max(0, Math.min(1, S.sFlux || 0)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(al);
    ping = 1 - ping;
  }

  function renderOverlay() {
    var S = NX.S;
    if (!ready || !S || !S.nexusGpuParticlesEnabled || S.nexusPerfLock || S.nexusVizPerformance) return;
    if (!drawProg || !gl || !NX.C || (gl.isContextLost && gl.isContextLost())) return;
    var readT = tex[ping];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, NX.C.width | 0, NX.C.height | 0);
    try { gl.disable(gl.DEPTH_TEST); } catch (eD) { /* ignore */ }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(drawProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf);
    var al = gl.getAttribLocation(drawProg, 'a_uv');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readT);
    gl.uniform1i(gl.getUniformLocation(drawProg, 'u_state'), 0);
    var pt = S._iosCoarsePointer ? 2.2 : 3.2;
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_point'), pt);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(al);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }

  window.NX = window.NX || {};
  NX.GpuParticles = {
    init: function (opts) {
      init(opts);
      if (ready && typeof console !== 'undefined' && console.info) {
        console.info('[NEXUS GpuParticles] ready —', N, 'simulated points (toggle in I/O)');
      }
    },
    tearDown: tearDown,
    tick: tickFixed,
    renderOverlay: renderOverlay,
    isReady: function () { return ready; }
  };
})();
