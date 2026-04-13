'use strict';
/**
 * nexus-gpu-particles.js — WebGL1 volumetric-style 3D GPU particles (same GL context as #c).
 * Dual ping-pong RGBA float textures: vec3 position + pad, vec3 velocity + speed scalar.
 * Physics: gravity, quadratic + linear drag, wind, cylindrical tornado + lift, ocean phase field,
 * vortex axis, radial explosion, audio-reactive noise; scene+preset signature mix.
 * Draw: NDC billboard + z-parallax wobble (sim xyz → clip.xy), additive POINTS — no depth test on the main canvas buffer (avoids invisible sprites).
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
    ' float D=0.58+u_bass*0.62+u_mid*0.48+u_hi*0.36+u_flux*0.58+u_tr*0.50+u_bv*0.55;',
    ' D=clamp(D,0.40,2.55);',
    ' float sigW=0.55+0.45*u_sigA.x+0.35*u_sigA.y;',
    ' float ocean=(u_sigA.x*0.45+u_mid*0.4)*mo*sigW;',
    ' float torn=(u_sigA.y*0.42+u_bass*0.5)*mt*sigW;',
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
    ' vec3 noise=(vec3(n2(v_uv*37.0+t),n2(v_uv*41.0-t),n2(v_uv*43.0+t*0.7))-0.5)*(0.022+0.068*u_tr+0.050*u_flux)*(0.9+0.55*D);',
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
    ' tang*=D; inward*=mix(1.0,D,0.62); oceanf*=D; curl*=D; vortex*=D; spec*=D; noise*=D;',
    ' w*=D; grav*=mix(1.0,D,0.32);',
    ' vec3 swell=(vec3(sin(t*1.55+p.x*5.1+u_bv*6.28318),cos(t*1.18+p.y*4.6+u_mid*5.5),sin(t*0.92+p.z*6.8+u_hi*4.2))-vec3(0.0))*0.032*D*(0.35+u_bass);',
    ' vec3 velN=v+tang+inward+oceanf+curl+vortex+spec+noise+grav+w+drag+expl+swell;',
    ' if(u_impulse>0.001)velN+=(vec3(n2(v_uv+u_impulse),n2(v_uv*31.0+u_impulse),n2(v_uv*29.0))-0.5)*u_impulse*1.25;',
    ' float sp=length(velN);',
    ' float vmax=mix(2.35,3.85,clamp(u_explStr*0.35,0.0,1.0));',
    ' vmax+=0.35*u_bv+0.22*u_flux;',
    ' if(sp>vmax)velN*=vmax/sp;',
    ' gl_FragColor=vec4(velN,sp*0.15);',
    '}'
  ].join('');

  var FS_SIM_POS = [
    'precision highp float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_pos;',
    'uniform sampler2D u_vel;',
    'uniform float u_bass,u_dt,u_explStr,u_flux;',
    'void main(){',
    ' vec3 p=texture2D(u_pos,v_uv).rgb;',
    ' vec3 v=texture2D(u_vel,v_uv).rgb;',
    ' float s=texture2D(u_vel,v_uv).a;',
    ' float sp=1.0+clamp(u_explStr,0.0,1.2)*0.35;',
    ' float beat=1.0+u_bass*0.95+u_flux*0.48;',
    ' vec3 p2=p+v*u_dt*(0.92+u_bass*0.72)*sp*beat;',
    ' float r=length(p2);',
    ' float rmax=1.42+clamp(u_explStr*0.55,0.0,1.1);',
    ' if(r>rmax)p2*=rmax/r;',
    ' gl_FragColor=vec4(p2,s);',
    '}'
  ].join('');

  var VS_DRAW = [
    'attribute vec2 a_uv;',
    'uniform sampler2D u_pos;',
    'uniform float u_worldScale,u_point,u_bass,u_mid,u_hi,u_bv,u_si,u_flux,u_hue,u_time;',
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
    ' gl_PointSize=ps;',
    '}'
  ].join('');

  var FS_DRAW = [
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
    if (S.nexusVolDepthTest == null) S.nexusVolDepthTest = false;
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
    if (!ready || !S || S.nexusMixParticlesEnabled === false || !S.nexusGpuParticlesEnabled || S.nexusPerfLock || S.nexusVizPerformance) return;
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
    gl.uniform1f(gl.getUniformLocation(simPosProg, 'u_flux'), Math.max(0, Math.min(1, S.sFlux || 0)));
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
    if (NX.VolumetricFX && NX.VolumetricFX.useIntegratedPipeline && NX.VolumetricFX.isReady && NX.VolumetricFX.isReady()) return;
    if (!ready || !S || S.nexusMixParticlesEnabled === false || !S.nexusGpuParticlesEnabled || S.nexusPerfLock || S.nexusVizPerformance) return;
    if (!drawProg || !gl || !NX.C || (gl.isContextLost && gl.isContextLost())) return;
    ensureVolDefaults(S);
    var readP = ping;
    var pk2 = (NX.ParticleSignature && NX.ParticleSignature.pack)
      ? NX.ParticleSignature.pack(S.curS | 0, S.bcLastPresetKey || '', NX.P && NX.P.PAL != null ? NX.P.PAL : 0)
      : { u_sigA: new Float32Array([0.5, 0.5, 0.5, 0.5]) };

    var cw = NX.C.width | 0;
    var ch = NX.C.height | 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);

    try { gl.disable(gl.DEPTH_TEST); } catch (eD0) { /* ignore */ }
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
    var ws = Math.max(0.4, Math.min(4.5, S.nexusVolWorldScale));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_worldScale'), ws);
    var pt = S._iosCoarsePointer ? 2.6 : 4.1;
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_point'), pt);
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_bass'), Math.max(0, Math.min(1, S.sBass || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_mid'), Math.max(0, Math.min(1, S.sMid || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_hi'), Math.max(0, Math.min(1, S.sHigh || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_bv'), Math.max(0, Math.min(1.35, S.beatVisual || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_si'), (S.curS | 0) * 1.0);
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_flux'), Math.max(0, Math.min(1, S.sFlux || 0)));
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_hue'), (S.nexusVolHuePhase || 0) + (S.hueShift || 0) * 0.02);
    gl.uniform1f(gl.getUniformLocation(drawProg, 'u_time'), S.GT || 0);
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
  /**
   * @returns {{ texPos: WebGLTexture, W: number, H: number, N: number }|null}
   */
  function getSimReadState() {
    if (!ready || !texPos[ping]) return null;
    return { texPos: texPos[ping], W: W, H: H, N: N };
  }

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
    notifyPresetChange: notifyPresetChange,
    getSimReadState: getSimReadState
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
