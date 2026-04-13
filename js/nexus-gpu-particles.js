'use strict';
/**
 * nexus-gpu-particles.js — WebGL1 volumetric-style 3D GPU particles (same GL context as #c).
 * Dual ping-pong RGBA float textures: vec3 position + pad, vec3 velocity + speed scalar.
 * Physics: gravity, quadratic + linear drag, wind, cylindrical tornado + lift, ocean phase field,
 * vortex axis, radial explosion, audio-reactive noise; scene+preset signature mix.
 * Draw: true perspective (view × projection), optional depth test vs scene buffer, additive POINTS.
 * Self-disables if float FBO, vertex textures, or compile fails.
 */
(function () {
  var W = 128;
  var H = 128;
  var N = W * H;
  var gl = null;
  var ready = false;
  var ping = 0;
  var texPos = [null, null];
  var texVel = [null, null];
  var fbPos = [null, null];
  var fbVel = [null, null];
  var simVelProg = null;
  var simPosProg = null;
  var drawProg = null;
  var idxBuf = null;
  var softImpulse = 0;
  var lastSigH = -1;
  var matP = new Float32Array(16);
  var matV = new Float32Array(16);
  var matVP = new Float32Array(16);

  var VS_QUAD = 'attribute vec2 a_uv;varying vec2 v_uv;void main(){v_uv=a_uv;gl_Position=vec4(a_uv*2.0-1.0,0.0,1.0);}';

  var FS_SIM_VEL = [
    'precision highp float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_pos;',
    'uniform sampler2D u_vel;',
    'uniform float u_time,u_bass,u_mid,u_hi,u_flux,u_si,u_tr,u_bv,u_impulse;',
    'uniform vec4 u_sigA;',
    'uniform vec2 u_sigB;',
    'uniform vec3 u_gravity,u_wind,u_explCenter;',
    'uniform float u_explStr,u_dragLin,u_dragQuad;',
    'uniform vec4 u_modes;',
    'float n2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'void main(){',
    ' vec3 p=texture2D(u_pos,v_uv).rgb;',
    ' vec4 v4=texture2D(u_vel,v_uv);',
    ' vec3 v=v4.rgb;',
    ' float t=u_time;',
    ' float si=u_si;',
    ' float mt=u_modes.x;',
    ' float mo=u_modes.y;',
    ' float mv=u_modes.z;',
    ' float ms=u_modes.w;',
    ' float ocean=(u_sigA.x*0.45+u_mid*0.4)*mo;',
    ' float torn=(u_sigA.y*0.42+u_bass*0.5)*mt;',
    ' float swirl=(0.32+u_sigB.x*0.55+u_hi*0.48+u_bv*0.32)*(0.35+mv);',
    ' vec3 tc=vec3(sin(t*0.72+u_sigB.y*6.28318),cos(t*0.58+u_sigA.z*6.28318),sin(t*0.31)*0.35);',
    ' vec3 rel=p-tc*0.58;',
    ' float rl=length(rel.xy)+1e-4;',
    ' vec3 tang=vec3(-rel.y,rel.x,0.0)*(0.024*torn+0.038*u_bv)*(1.0/rl);',
    ' tang.z+=0.014*sin(rl*4.1-t*2.25)*u_hi;',
    ' tang.xy*=1.0+u_bass*0.35;',
    ' vec3 inward=-normalize(p+vec3(1e-4))*length(p)*(0.0055+0.032*u_bass)*mt;',
    ' vec3 oceanf=vec3(',
    '  sin(p.y*3.1+p.z*2.4+t*1.45+u_sigA.w*6.28318),',
    '  cos(p.x*2.9-t*1.12+si*0.14),',
    '  sin(p.x*1.72+p.y*1.68+t*0.92))*ocean*(0.016+u_flux*0.026);',
    ' vec3 curl=cross(p,vec3(0.0,0.0,1.0))*(0.011+0.036*swirl)*(0.5+u_sigA.x);',
    ' vec3 vortex=normalize(cross(p,vec3(0.65,0.35,-0.28)))*mv*(0.018+u_hi*0.022);',
    ' vec3 spec=vec3(sin(p.z*5.0+t),cos(p.x*4.2-t*0.7),sin(p.y*3.8+t*1.1))*ms*(0.01+u_flux*0.018);',
    ' vec3 noise=(vec3(n2(v_uv*37.0+t),n2(v_uv*41.0-t),n2(v_uv*43.0+t*0.7))-0.5)*(0.013+0.042*u_tr+0.028*u_flux);',
    ' vec3 grav=u_gravity*(0.55+u_mid*0.5);',
    ' vec3 w=u_wind*(1.0+u_flux*0.55+u_hi*0.28);',
    ' float vlen=length(v)+1e-5;',
    ' vec3 drag=-u_dragLin*v-u_dragQuad*v*vlen;',
    ' vec3 expl=vec3(0.0);',
    ' if(u_explStr>0.0005){',
    '  vec3 d=p-u_explCenter;',
    '  float dist=length(d)+0.08;',
    '  vec3 dir=d/dist;',
    '  expl=dir*u_explStr/(dist*dist*0.55+0.14)*(0.022+u_bass*0.016);',
    ' }',
    ' vec3 velN=v+tang+inward+oceanf+curl+vortex+spec+noise+grav+w+drag+expl;',
    ' if(u_impulse>0.001)velN+=(vec3(n2(v_uv+u_impulse),n2(v_uv*31.0+u_impulse),n2(v_uv*29.0))-0.5)*u_impulse*1.15;',
    ' float sp=length(velN);',
    ' float vmax=mix(2.15,3.45,clamp(u_explStr*0.35,0.0,1.0));',
    ' if(sp>vmax)velN*=vmax/sp;',
    ' gl_FragColor=vec4(velN,sp*0.15);',
    '}'
  ].join('');

  var FS_SIM_POS = [
    'precision highp float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_pos;',
    'uniform sampler2D u_vel;',
    'uniform float u_bass,u_dt,u_explStr;',
    'void main(){',
    ' vec3 p=texture2D(u_pos,v_uv).rgb;',
    ' vec3 v=texture2D(u_vel,v_uv).rgb;',
    ' float s=texture2D(u_vel,v_uv).a;',
    ' float sp=1.0+clamp(u_explStr,0.0,1.2)*0.35;',
    ' vec3 p2=p+v*u_dt*(0.86+u_bass*0.58)*sp;',
    ' float r=length(p2);',
    ' float rmax=1.42+clamp(u_explStr*0.55,0.0,1.1);',
    ' if(r>rmax)p2*=rmax/r;',
    ' gl_FragColor=vec4(p2,s);',
    '}'
  ].join('');

  var VS_DRAW = [
    'attribute vec2 a_uv;',
    'uniform sampler2D u_pos;',
    'uniform mat4 uViewProj;',
    'uniform float u_worldScale,u_point,u_bass,u_mid,u_hi,u_bv,u_si,u_flux,u_hue;',
    'uniform vec4 u_sigA;',
    'uniform vec3 u_worldBias;',
    'varying vec4 v_col;',
    'varying float v_eye;',
    'void main(){',
    ' vec3 praw=texture2D(u_pos,a_uv).rgb;',
    ' vec3 wp=praw*u_worldScale+u_worldBias;',
    ' vec4 clip=uViewProj*vec4(wp,1.0);',
    ' gl_Position=clip;',
    ' v_eye=max(0.35,clip.w);',
    ' vec3 cA=vec3(0.12,0.52,1.0);',
    ' vec3 cB=vec3(1.0,0.28,0.52);',
    ' vec3 cC=vec3(0.32,0.95,0.62);',
    ' float pk=fract(u_si*0.073+u_bv*0.22+u_mid*0.15+u_sigA.x*0.4+u_sigA.y*0.3+u_hue*0.08);',
    ' vec3 pal=mix(cA,cB,pk);pal=mix(pal,cC,u_mid*0.45);',
    ' float e=length(praw)+0.15;',
    ' vec3 rgb=pal*(0.48+e*1.12)+vec3(u_hi*0.3,u_mid*0.16,u_bass*0.24)+u_sigA.xyz*0.09;',
    ' float hs=u_hue+u_bass*0.55+u_flux*0.4+a_uv.x*2.1;',
    ' vec3 sh=mix(rgb,rgb.brg,0.22*sin(hs));',
    ' sh=mix(sh,sh.grb,0.18*sin(hs*1.37+u_mid*3.1));',
    ' float tw=0.5+0.5*sin(u_bv*6.28318+u_si+a_uv.x*14.0);',
    ' float al=0.13+e*1.22+u_bass*0.15+u_flux*0.12+tw*0.065;',
    ' v_col=vec4(sh,al);',
    ' float ps=u_point*(220.0/v_eye)*(0.92+abs(praw.z)*9.5)*(1.0+u_bv*0.45)*(0.72+length(praw)*0.38);',
    ' if(clip.w<0.12)ps=0.0;',
    ' gl_PointSize=ps;',
    '}'
  ].join('');

  var FS_DRAW = [
    'precision mediump float;',
    'varying vec4 v_col;',
    'varying float v_eye;',
    'void main(){',
    ' vec2 q=gl_PointCoord*2.0-1.0;',
    ' float d=length(q);',
    ' if(d>1.0)discard;',
    ' float core=1.0-d*d;',
    ' float vol=pow(max(0.0,1.0-d*d),1.65);',
    ' float a=v_col.a*core*vol*(0.55+0.45/(0.65+v_eye*0.08));',
    ' vec3 rgb=v_col.rgb*(0.88+0.22*vol);',
    ' gl_FragColor=vec4(rgb,a);',
    '}'
  ].join('');

  function mat4PerspectiveRad(out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy * 0.5);
    var nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = out[2] = out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = out[7] = 0;
    out[8] = out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
  }

  function mat4LookAt(out, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
    var z0 = cx - ex;
    var z1 = cy - ey;
    var z2 = cz - ez;
    var len = Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    if (len < 1e-6) len = 1e-6;
    len = 1 / len;
    z0 *= len;
    z1 *= len;
    z2 *= len;
    var x0 = uy * z2 - uz * z1;
    var x1 = uz * z0 - ux * z2;
    var x2 = ux * z1 - uy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (len < 1e-6) {
      x0 = 1;
      x1 = x2 = 0;
      len = 1;
    } else len = 1 / len;
    x0 *= len;
    x1 *= len;
    x2 *= len;
    var y0 = z1 * x2 - z2 * x1;
    var y1 = z2 * x0 - z0 * x2;
    var y2 = z0 * x1 - z1 * x0;
    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * ex + x1 * ey + x2 * ez);
    out[13] = -(y0 * ex + y1 * ey + y2 * ez);
    out[14] = -(z0 * ex + z1 * ey + z2 * ez);
    out[15] = 1;
  }

  function mat4Multiply(out, a, b) {
    var a00 = a[0];
    var a01 = a[1];
    var a02 = a[2];
    var a03 = a[3];
    var a10 = a[4];
    var a11 = a[5];
    var a12 = a[6];
    var a13 = a[7];
    var a20 = a[8];
    var a21 = a[9];
    var a22 = a[10];
    var a23 = a[11];
    var a30 = a[12];
    var a31 = a[13];
    var a32 = a[14];
    var a33 = a[15];
    var b0 = b[0];
    var b1 = b[1];
    var b2 = b[2];
    var b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }

  function buildViewProj(S, cw, ch) {
    var aspect = (ch > 0 ? cw / ch : 1.5);
    if (!(aspect > 0.05) || aspect > 20) aspect = 1.5;
    mat4PerspectiveRad(matP, (52 * Math.PI) / 180, aspect, 0.08, 48.0);
    var t = S.GT || 0;
    var mx = S.mouseSmooth || [0, 0];
    var cam = NX.camera && typeof NX.camera.get === 'function'
      ? NX.camera.get('orbit', t, { az: 0.35 + mx[0] * 2.4, el: 0.38 + mx[1] * 0.85, dist: 4.55 })
      : { ro: [2.1, 1.35, 3.85], ta: [0, 0, 0] };
    var ro = cam.ro;
    var ta = cam.ta;
    mat4LookAt(matV, ro[0], ro[1], ro[2], ta[0], ta[1], ta[2], 0, 1, 0);
    mat4Multiply(matVP, matP, matV);
  }

  function ensureVolDefaults(S) {
    if (S.nexusVolTornado == null) S.nexusVolTornado = 0.55;
    if (S.nexusVolOcean == null) S.nexusVolOcean = 0.45;
    if (S.nexusVolVortex == null) S.nexusVolVortex = 0.35;
    if (S.nexusVolSpecial == null) S.nexusVolSpecial = 0.22;
    if (S.nexusVolGravity == null) S.nexusVolGravity = -0.24;
    if (S.nexusVolWindX == null) S.nexusVolWindX = 0;
    if (S.nexusVolWindY == null) S.nexusVolWindY = 0;
    if (S.nexusVolWindZ == null) S.nexusVolWindZ = 0;
    if (S.nexusVolWindAudio == null) S.nexusVolWindAudio = 0.62;
    if (S.nexusVolDragLin == null) S.nexusVolDragLin = 0.14;
    if (S.nexusVolDragQuad == null) S.nexusVolDragQuad = 0.065;
    if (S.nexusVolExplosion == null) S.nexusVolExplosion = 0;
    if (S.nexusVolExplodeCenterX == null) S.nexusVolExplodeCenterX = 0;
    if (S.nexusVolExplodeCenterY == null) S.nexusVolExplodeCenterY = 0;
    if (S.nexusVolExplodeCenterZ == null) S.nexusVolExplodeCenterZ = 0;
    if (S.nexusVolWorldScale == null) S.nexusVolWorldScale = 2.15;
    if (S.nexusVolHuePhase == null) S.nexusVolHuePhase = 0;
    if (S.nexusVolDepthTest == null) S.nexusVolDepthTest = true;
    if (S.nexusVolAutoWind == null) S.nexusVolAutoWind = true;
    if (S.nexusVolAutoExplode == null) S.nexusVolAutoExplode = true;
  }

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

  function fillSpherePos(data) {
    var i;
    var o;
    var x;
    var y;
    var z;
    var L;
    for (i = 0; i < W * H; i++) {
      o = i * 4;
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      L = Math.sqrt(x * x + y * y + z * z) + 1e-4;
      x = (x / L) * (0.32 + Math.random() * 0.62);
      y = (y / L) * (0.32 + Math.random() * 0.62);
      z = (z / L) * (0.32 + Math.random() * 0.62);
      data[o] = x;
      data[o + 1] = y;
      data[o + 2] = z;
      data[o + 3] = Math.random();
    }
  }

  function fillSmallVel(data) {
    var i;
    var o;
    for (i = 0; i < W * H; i++) {
      o = i * 4;
      data[o] = (Math.random() - 0.5) * 0.045;
      data[o + 1] = (Math.random() - 0.5) * 0.045;
      data[o + 2] = (Math.random() - 0.5) * 0.045;
      data[o + 3] = 0;
    }
  }

  function mkFloatTex(data) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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
      var j;
      for (j = 0; j < 2; j++) {
        if (fbPos[j]) gl.deleteFramebuffer(fbPos[j]);
        if (fbVel[j]) gl.deleteFramebuffer(fbVel[j]);
        if (texPos[j]) gl.deleteTexture(texPos[j]);
        if (texVel[j]) gl.deleteTexture(texVel[j]);
      }
      if (idxBuf) gl.deleteBuffer(idxBuf);
      if (simVelProg) gl.deleteProgram(simVelProg);
      if (simPosProg) gl.deleteProgram(simPosProg);
      if (drawProg) gl.deleteProgram(drawProg);
    } catch (eTd) { /* invalid GL */ }
    fbPos[0] = fbPos[1] = fbVel[0] = fbVel[1] = null;
    texPos[0] = texPos[1] = texVel[0] = texVel[1] = null;
    idxBuf = null;
    simVelProg = simPosProg = drawProg = null;
  }

  function pickGrid() {
    try {
      var S = window.NX && NX.S;
      var perf = S && (S.nexusPerfLock || S.nexusVizPerformance);
      var q = document.getElementById('qsel');
      var v = q && q.value ? q.value : 'balanced';
      if (v === 'ultra') return perf ? { w: 128, h: 128 } : { w: 192, h: 192 };
      if (v === 'perf') return { w: 96, h: 96 };
      if (!perf) return { w: 160, h: 160 };
    } catch (eQ) { /* ignore */ }
    return { w: 128, h: 128 };
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

    var dPos0 = new Float32Array(W * H * 4);
    var dPos1 = new Float32Array(W * H * 4);
    var dVel0 = new Float32Array(W * H * 4);
    var dVel1 = new Float32Array(W * H * 4);
    fillSpherePos(dPos0);
    fillSpherePos(dPos1);
    fillSmallVel(dVel0);
    fillSmallVel(dVel1);

    texPos[0] = mkFloatTex(dPos0);
    texPos[1] = mkFloatTex(dPos1);
    texVel[0] = mkFloatTex(dVel0);
    texVel[1] = mkFloatTex(dVel1);
    fbPos[0] = mkFbo(texPos[0]);
    fbPos[1] = mkFbo(texPos[1]);
    fbVel[0] = mkFbo(texVel[0]);
    fbVel[1] = mkFbo(texVel[1]);
    if (!fbPos[0] || !fbPos[1] || !fbVel[0] || !fbVel[1]) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[NEXUS GpuParticles] float FBO incomplete — disabled');
      texPos[0] = texPos[1] = texVel[0] = texVel[1] = null;
      return;
    }
    simVelProg = mkProg(VS_QUAD, FS_SIM_VEL);
    simPosProg = mkProg(VS_QUAD, FS_SIM_POS);
    drawProg = mkProg(VS_DRAW, FS_DRAW);
    if (!simVelProg || !simPosProg || !drawProg) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[NEXUS GpuParticles] shader compile failed');
      tearDown();
      return;
    }

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
    ping = 0;
    softImpulse = 0.4;
    ready = true;
  }

  var quadUv = null;
  function ensureQuad() {
    if (quadUv) return;
    quadUv = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadUv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  }

  function bindQuad(prog) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadUv);
    var al = gl.getAttribLocation(prog, 'a_uv');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    return al;
  }

  function tickFixed(dt) {
    var S = NX.S;
    if (!ready || !S || !S.nexusGpuParticlesEnabled || S.nexusPerfLock || S.nexusVizPerformance) return;
    if (!simVelProg || !simPosProg || !gl || (gl.isContextLost && gl.isContextLost())) return;
    ensureVolDefaults(S);
    ensureQuad();

    if (NX.ParticleSignature && typeof NX.ParticleSignature.pack === 'function') {
      var pk = NX.ParticleSignature.pack(S.curS | 0, S.bcLastPresetKey || '', NX.P && NX.P.PAL != null ? NX.P.PAL : 0);
      if (pk.h !== lastSigH) {
        lastSigH = pk.h;
        softImpulse = Math.max(softImpulse, 0.45);
      }
    }

    softImpulse *= Math.pow(0.88, Math.min(dt * 60, 3));
    var imp = softImpulse;

    var pk2 = (NX.ParticleSignature && NX.ParticleSignature.pack)
      ? NX.ParticleSignature.pack(S.curS | 0, S.bcLastPresetKey || '', NX.P && NX.P.PAL != null ? NX.P.PAL : 0)
      : { u_sigA: new Float32Array([0.5, 0.5, 0.5, 0.5]), u_sigB: new Float32Array([0.5, 0.5]) };

    var expl = Math.max(0, S.nexusVolExplosion || 0);
    if (expl > 0) {
      expl *= Math.pow(0.86, Math.min(dt * 60, 4));
      if (expl < 0.004) expl = 0;
      S.nexusVolExplosion = expl;
    }
    if (S.nexusVolAutoExplode && (S.sTransient || 0) > 0.82) {
      S.nexusVolExplosion = Math.min(1.65, (S.nexusVolExplosion || 0) + 0.22 * (S.sTransient || 0));
    }

    S.nexusVolHuePhase = (S.nexusVolHuePhase || 0) + dt * (0.35 + (S.sFlux || 0) * 0.9 + (S.beatVisual || 0) * 0.4);

    var wa = Math.max(0, Math.min(1.2, S.nexusVolWindAudio));
    var wx = (S.nexusVolWindX || 0) + (S.nexusVolAutoWind ? (S.sFlux || 0) * 0.028 * wa : 0) + Math.sin(S.GT || 0) * 0.006 * wa;
    var wy = (S.nexusVolWindY || 0) + (S.nexusVolAutoWind ? (S.sMid || 0) * 0.018 * wa : 0);
    var wz = (S.nexusVolWindZ || 0) + (S.nexusVolAutoWind ? (S.sHigh || 0) * 0.015 * wa : 0);

    var dtCl = Math.min(dt, 0.05);
    var readP = ping;
    var readV = ping;
    var writeV = 1 - ping;
    var writeP = 1 - ping;

    gl.viewport(0, 0, W, H);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbVel[writeV]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texVel[writeV], 0);
    gl.useProgram(simVelProg);
    var alV = bindQuad(simVelProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texPos[readP]);
    gl.uniform1i(gl.getUniformLocation(simVelProg, 'u_pos'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texVel[readV]);
    gl.uniform1i(gl.getUniformLocation(simVelProg, 'u_vel'), 1);
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_time'), S.GT || 0);
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_bass'), Math.max(0, Math.min(1, S.sBass || 0)));
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_mid'), Math.max(0, Math.min(1, S.sMid || 0)));
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_hi'), Math.max(0, Math.min(1, S.sHigh || 0)));
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_flux'), Math.max(0, Math.min(1, S.sFlux || 0)));
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_si'), (S.curS | 0) * 1.0);
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_tr'), Math.max(0, Math.min(1, S.sTransient || 0)));
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_bv'), Math.max(0, Math.min(1.35, S.beatVisual || 0)));
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_impulse'), imp);
    gl.uniform4f(gl.getUniformLocation(simVelProg, 'u_sigA'), pk2.u_sigA[0], pk2.u_sigA[1], pk2.u_sigA[2], pk2.u_sigA[3]);
    gl.uniform2f(gl.getUniformLocation(simVelProg, 'u_sigB'), pk2.u_sigB[0], pk2.u_sigB[1]);
    gl.uniform3f(
      gl.getUniformLocation(simVelProg, 'u_gravity'),
      0,
      S.nexusVolGravity,
      0
    );
    gl.uniform3f(gl.getUniformLocation(simVelProg, 'u_wind'), wx, wy, wz);
    gl.uniform3f(
      gl.getUniformLocation(simVelProg, 'u_explCenter'),
      S.nexusVolExplodeCenterX || 0,
      S.nexusVolExplodeCenterY || 0,
      S.nexusVolExplodeCenterZ || 0
    );
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_explStr'), S.nexusVolExplosion || 0);
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_dragLin'), Math.max(0, S.nexusVolDragLin));
    gl.uniform1f(gl.getUniformLocation(simVelProg, 'u_dragQuad'), Math.max(0, S.nexusVolDragQuad));
    gl.uniform4f(
      gl.getUniformLocation(simVelProg, 'u_modes'),
      Math.max(0, Math.min(1.5, S.nexusVolTornado)),
      Math.max(0, Math.min(1.5, S.nexusVolOcean)),
      Math.max(0, Math.min(1.5, S.nexusVolVortex)),
      Math.max(0, Math.min(1.5, S.nexusVolSpecial))
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(alV);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbPos[writeP]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texPos[writeP], 0);
    gl.useProgram(simPosProg);
    var alP = bindQuad(simPosProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texPos[readP]);
    gl.uniform1i(gl.getUniformLocation(simPosProg, 'u_pos'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texVel[writeV]);
    gl.uniform1i(gl.getUniformLocation(simPosProg, 'u_vel'), 1);
    gl.uniform1f(gl.getUniformLocation(simPosProg, 'u_bass'), Math.max(0, Math.min(1, S.sBass || 0)));
    gl.uniform1f(gl.getUniformLocation(simPosProg, 'u_dt'), dtCl * 60 * 0.00115);
    gl.uniform1f(gl.getUniformLocation(simPosProg, 'u_explStr'), S.nexusVolExplosion || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(alP);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    ping = 1 - ping;
  }

  function renderOverlay() {
    var S = NX.S;
    if (!ready || !S || !S.nexusGpuParticlesEnabled || S.nexusPerfLock || S.nexusVizPerformance) return;
    if (!drawProg || !gl || !NX.C || (gl.isContextLost && gl.isContextLost())) return;
    ensureVolDefaults(S);
    var readP = ping;
    var pk2 = (NX.ParticleSignature && NX.ParticleSignature.pack)
      ? NX.ParticleSignature.pack(S.curS | 0, S.bcLastPresetKey || '', NX.P && NX.P.PAL != null ? NX.P.PAL : 0)
      : { u_sigA: new Float32Array([0.5, 0.5, 0.5, 0.5]) };

    var cw = NX.C.width | 0;
    var ch = NX.C.height | 0;
    buildViewProj(S, cw, ch);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);

    var useDepth = S.nexusVolDepthTest !== false;
    if (useDepth) {
      try {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
      } catch (eD1) { /* ignore */ }
    } else {
      try { gl.disable(gl.DEPTH_TEST); } catch (eD0) { /* ignore */ }
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(drawProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf);
    var al = gl.getAttribLocation(drawProg, 'a_uv');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texPos[readP]);
    gl.uniform1i(gl.getUniformLocation(drawProg, 'u_pos'), 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(drawProg, 'uViewProj'), false, matVP);
    var ws = Math.max(0.4, Math.min(4.5, S.nexusVolWorldScale));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_worldScale'), ws);
    gl.uniform3f(gl.getUniformLocation(drawProg, 'u_worldBias'), 0, 0, 0);
    var pt = S._iosCoarsePointer ? 2.6 : 4.1;
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_point'), pt);
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_bass'), Math.max(0, Math.min(1, S.sBass || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_mid'), Math.max(0, Math.min(1, S.sMid || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_hi'), Math.max(0, Math.min(1, S.sHigh || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_bv'), Math.max(0, Math.min(1.35, S.beatVisual || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_si'), (S.curS | 0) * 1.0);
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_flux'), Math.max(0, Math.min(1, S.sFlux || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_hue'), (S.nexusVolHuePhase || 0) + (S.hueShift || 0) * 0.02);
    gl.uniform4f(gl.getUniformLocation(drawProg, 'u_sigA'), pk2.u_sigA[0], pk2.u_sigA[1], pk2.u_sigA[2], pk2.u_sigA[3]);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(al);
    gl.activeTexture(gl.TEXTURE_2D, null);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
    try { gl.disable(gl.DEPTH_TEST); } catch (eD2) { /* ignore */ }
    gl.depthMask(true);
  }

  function notifyPresetChange() {
    softImpulse = Math.max(softImpulse, 0.62);
    lastSigH = -1;
  }

  function triggerExplosion(strength) {
    var S = NX.S;
    if (!S) return;
    ensureVolDefaults(S);
    var s = strength == null ? 1 : Math.max(0, strength);
    S.nexusVolExplosion = Math.min(2.2, (S.nexusVolExplosion || 0) + s * 0.95);
    softImpulse = Math.max(softImpulse, 0.55 + s * 0.15);
  }

  function setExplosionCenter(x, y, z) {
    var S = NX.S;
    if (!S) return;
    ensureVolDefaults(S);
    S.nexusVolExplodeCenterX = x;
    S.nexusVolExplodeCenterY = y;
    S.nexusVolExplodeCenterZ = z;
  }

  function setModes(tornado, ocean, vortex, special) {
    var S = NX.S;
    if (!S) return;
    ensureVolDefaults(S);
    if (tornado != null) S.nexusVolTornado = tornado;
    if (ocean != null) S.nexusVolOcean = ocean;
    if (vortex != null) S.nexusVolVortex = vortex;
    if (special != null) S.nexusVolSpecial = special;
  }

  function setWind(x, y, z) {
    var S = NX.S;
    if (!S) return;
    ensureVolDefaults(S);
    if (x != null) S.nexusVolWindX = x;
    if (y != null) S.nexusVolWindY = y;
    if (z != null) S.nexusVolWindZ = z;
  }

  function setGravity(g) {
    var S = NX.S;
    if (!S) return;
    ensureVolDefaults(S);
    S.nexusVolGravity = g;
  }

  function setDrag(linear, quadratic) {
    var S = NX.S;
    if (!S) return;
    ensureVolDefaults(S);
    if (linear != null) S.nexusVolDragLin = linear;
    if (quadratic != null) S.nexusVolDragQuad = quadratic;
  }

  function setDepthTest(on) {
    var S = NX.S;
    if (S) S.nexusVolDepthTest = !!on;
  }

  window.NX = window.NX || {};
  NX.GpuParticles = {
    init: function (opts) {
      init(opts);
      if (ready && typeof console !== 'undefined' && console.info) {
        console.info('[NEXUS GpuParticles] volumetric 3D —', N, 'points (Composition → GPU particles)');
      }
    },
    tearDown: tearDown,
    tick: tickFixed,
    renderOverlay: renderOverlay,
    isReady: function () { return ready; },
    notifyPresetChange: notifyPresetChange
  };

  NX.VolumetricParticles = {
    triggerExplosion: triggerExplosion,
    setExplosionCenter: setExplosionCenter,
    setModes: setModes,
    setWind: setWind,
    setGravity: setGravity,
    setDrag: setDrag,
    setDepthTest: setDepthTest
  };
})();
