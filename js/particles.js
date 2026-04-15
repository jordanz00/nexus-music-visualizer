'use strict';
/**
 * NEXUS Particle System — particles.js
 *
 * GPU ping-pong sim (float textures) + thick sprite render (MFX-inspired palettes).
 * Reads analysis from NX.S (same contract as former particles-gpu.js).
 * Hooks the engine via NX.GpuParticles.renderOverlay (see nexus-gpu-particles-stub.js).
 *
 * WHO THIS IS FOR: live VJ overlay on #c after post + Butterchurn.
 * HOW IT CONNECTS: app-loader loads this after nexus-gpu-particles-stub.js; NX.particles + GpuParticles.renderOverlay.
 */

(function (win) {
  /* ---- CONFIG (verified against engine.js / audio.js / index.html) ----
   * Canvas: engine uses document.getElementById('c') + NX.C / NX.gl.
   * Bands: stored on NX.S — sBass, sMid, sHigh, beatVisual, beatPhase, sCent, sFlux.
   * NX.audio (audio.js) exposes tick/startMic only — not band scalars.
   * GPU toggle: #nx-gpu-particles; mix master: #nx-mix-particles → NX.S flags.
   * Main loop: NX.loop (requestAnimationFrame); overlay tail calls GpuParticles.renderOverlay.
   * Prefer dedicated #c-particles WebGL so MIX stack opacity on #c / #c-bc never hides sprites.
   */
  var CFG = {
    particlesCanvasId: 'c-particles',
    canvasId: 'c',
    audioSource: 'S',
    audio: {
      bass: 'sBass',
      mid: 'sMid',
      high: 'sHigh',
      beat: 'beatVisual',
      bpmPhase: 'beatPhase',
      centroid: 'sCent',
      flux: 'sFlux',
      rms: '_rmsSlow'
    },
    gpuCheckboxId: 'nx-gpu-particles',
    mixParticlesCheckboxId: 'nx-mix-particles'
  };

  var PRESETS = {
    Default: {
      count: 98304,
      physics: { gravity: 0, drag: 0.972, curl: 0.72, attract: 0.18, repel: 0.12, vortex: 0.38, blast: 0.12, spread: 2.35, speed: 0.42, life: 1.05, turbFreq: 0.52, ocean: 0.55, fluid: 0.65 },
      visual: { size: 3.1, glow: 1.35, palette: 0, opacity: 0.9, colorCycle: 0.42, saturation: 0.92, brightness: 0.95 }
    },
    FluidShowcase: {
      count: 196608,
      physics: { gravity: -0.00012, drag: 0.987, curl: 1.18, attract: 0.26, repel: 0.2, vortex: 0.62, blast: 0.14, spread: 2.85, speed: 0.52, life: 1.28, turbFreq: 0.58, ocean: 1.38, fluid: 1.12 },
      visual: { size: 3.55, glow: 1.72, palette: 3, opacity: 0.96, colorCycle: 0.62, saturation: 1, brightness: 1.06 }
    },
    Trance: {
      count: 98304,
      physics: { gravity: -0.0002, drag: 0.982, curl: 0.8, attract: 0.28, repel: 0, vortex: 0.75, blast: 0.09, spread: 2, speed: 0.38, life: 1.3, turbFreq: 0.4 },
      visual: { size: 3.2, glow: 1.5, palette: 0, opacity: 0.78, colorCycle: 0.25, saturation: 0.9, brightness: 1 }
    },
    Techno: {
      count: 131072,
      physics: { gravity: 0, drag: 0.955, curl: 1.1, attract: 0.05, repel: 0.55, vortex: 0.15, blast: 0.16, spread: 3, speed: 0.75, life: 0.6, turbFreq: 0.9 },
      visual: { size: 2, glow: 0.7, palette: 1, opacity: 0.92, colorCycle: 0.7, saturation: 1, brightness: 1 }
    },
    Ambient: {
      count: 49152,
      physics: { gravity: -0.0004, drag: 0.992, curl: 0.25, attract: 0.12, repel: 0, vortex: 0.2, blast: 0.03, spread: 2.5, speed: 0.14, life: 2, turbFreq: 0.2 },
      visual: { size: 4.5, glow: 1.8, palette: 2, opacity: 0.52, colorCycle: 0.08, saturation: 0.6, brightness: 0.85 }
    },
    EDM: {
      count: 131072,
      physics: { gravity: 0, drag: 0.97, curl: 0.75, attract: 0.2, repel: 0.25, vortex: 0.5, blast: 0.13, spread: 2.6, speed: 0.6, life: 0.85, turbFreq: 0.7 },
      visual: { size: 2.4, glow: 1.3, palette: 3, opacity: 0.87, colorCycle: 0.5, saturation: 0.95, brightness: 1 }
    },
    Glitch: {
      count: 131072,
      physics: { gravity: 0, drag: 0.935, curl: 1.5, attract: 0, repel: 0.9, vortex: 0, blast: 0.22, spread: 3.5, speed: 1.1, life: 0.4, turbFreq: 1.3 },
      visual: { size: 1.6, glow: 0.5, palette: 1, opacity: 1, colorCycle: 1, saturation: 1, brightness: 1 }
    },
    Club: {
      count: 98304,
      physics: { gravity: 0, drag: 0.974, curl: 0.65, attract: 0.22, repel: 0.18, vortex: 0.55, blast: 0.11, spread: 2.3, speed: 0.48, life: 0.95, turbFreq: 0.6 },
      visual: { size: 2.6, glow: 1.1, palette: 4, opacity: 0.85, colorCycle: 0.35, saturation: 0.88, brightness: 0.95 }
    },
    Psychedelic: {
      count: 98304,
      physics: { gravity: -0.0001, drag: 0.985, curl: 1, attract: 0.35, repel: 0.12, vortex: 0.88, blast: 0.07, spread: 2.1, speed: 0.3, life: 1.6, turbFreq: 0.45 },
      visual: { size: 3.8, glow: 1.7, palette: 0, opacity: 0.68, colorCycle: 0.15, saturation: 0.92, brightness: 0.95 }
    },
    Tornado: {
      count: 131072,
      physics: { gravity: -0.0006, drag: 0.98, curl: 0.5, attract: 0, repel: 0, vortex: 1, blast: 0.07, spread: 1, speed: 0.55, life: 1.2, turbFreq: 0.3 },
      visual: { size: 2, glow: 1, palette: 2, opacity: 0.8, colorCycle: 0.4, saturation: 0.9, brightness: 1 }
    },
    Ocean: {
      count: 131072,
      physics: { gravity: 0.0002, drag: 0.988, curl: 0.55, attract: 0.14, repel: 0, vortex: 0.28, blast: 0.06, spread: 3.25, speed: 0.28, life: 1.65, turbFreq: 0.32, ocean: 1.05, fluid: 0.88 },
      visual: { size: 3.65, glow: 1.55, palette: 3, opacity: 0.78, colorCycle: 0.22, saturation: 0.82, brightness: 0.94 }
    },
    Gravity: {
      count: 131072,
      physics: { gravity: 0.001, drag: 0.965, curl: 0.3, attract: 0, repel: 0.65, vortex: 0, blast: 0.18, spread: 2.8, speed: 0.85, life: 0.65, turbFreq: 0.4 },
      visual: { size: 1.8, glow: 0.8, palette: 2, opacity: 0.9, colorCycle: 0.55, saturation: 0.9, brightness: 1 }
    },
    Vortex: {
      count: 131072,
      physics: { gravity: 0, drag: 0.976, curl: 0.7, attract: 0.55, repel: 0.28, vortex: 0.82, blast: 0.1, spread: 2.2, speed: 0.52, life: 1, turbFreq: 0.6 },
      visual: { size: 2.2, glow: 1.1, palette: 0, opacity: 0.83, colorCycle: 0.4, saturation: 0.87, brightness: 0.97 }
    }
  };

  var QUAD_VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUV;',
    'void main(){ vUV=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }'
  ].join('\n');

  /* Sim: drag → curl (mid+flux) → moving attractor (bass) → audio accents → clamp. */
  var VEL_FRAG = [
    'precision highp float;',
    'varying vec2 vUV;',
    'uniform sampler2D uPos;',
    'uniform sampler2D uVel;',
    'uniform float uBass,uMid,uHigh,uBeat,uPhase,uCentroid,uFlux,uTime,uSeedOff;',
    'uniform float uGravity,uDrag,uCurl,uAttract,uRepel,uVortex;',
    'uniform float uBlast,uSpread,uSpeed,uLife,uTurbFreq,uOcean,uFluid;',
    'float h21(vec2 p){ p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+19.19); return fract(p.x*p.y); }',
    'float h31(vec3 p){ return h21(p.xy+p.z*0.631); }',
    'vec3 h33(vec3 p){ return vec3(h31(p),h31(p+4.71),h31(p+9.37)); }',
    'float snoise(vec3 p){',
    '  vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);',
    '  float n000=h31(i),n100=h31(i+vec3(1,0,0)),n010=h31(i+vec3(0,1,0)),n110=h31(i+vec3(1,1,0)),',
    '        n001=h31(i+vec3(0,0,1)),n101=h31(i+vec3(1,0,1)),n011=h31(i+vec3(0,1,1)),n111=h31(i+vec3(1,1,1));',
    '  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),',
    '             mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z)*2.0-1.0;',
    '}',
    'vec3 curlN(vec3 p){',
    '  float e=0.02;',
    '  vec3 c;',
    '  c.x=(snoise(p+vec3(0.0,e,0.0))-snoise(p-vec3(0.0,e,0.0)))-(snoise(p+vec3(0.0,0.0,e))-snoise(p-vec3(0.0,0.0,e)));',
    '  c.y=(snoise(p+vec3(0.0,0.0,e))-snoise(p-vec3(0.0,0.0,e)))-(snoise(p+vec3(e,0.0,0.0))-snoise(p-vec3(e,0.0,0.0)));',
    '  c.z=(snoise(p+vec3(e,0.0,0.0))-snoise(p-vec3(e,0.0,0.0)))-(snoise(p+vec3(0.0,e,0.0))-snoise(p-vec3(0.0,e,0.0)));',
    '  return c/(2.0*e);',
    '}',
    'void main(){',
    '  vec4 pos=texture2D(uPos,vUV);',
    '  vec4 vel=texture2D(uVel,vUV);',
    '  float age=pos.w,mass=max(vel.w,0.15);',
    '  float maxAge=0.016/max(uLife*0.007,0.0001);',
    '  if(age>maxAge){',
    '    vec2 seed=vUV+vec2(uTime*0.0013,uSeedOff);',
    '    vel.xyz=(h33(seed+vec3(1.2,2.4,3.6))-vec3(0.5))*uSpeed*(1.0+h21(seed+0.8));',
    '    vel.w=0.3+h21(seed+1.1)*0.7;',
    '    gl_FragColor=vel; return;',
    '  }',
    '  vec3 p=pos.xyz;',
    '  vec3 v=vel.xyz;',
    '  float dragT=clamp(uDrag,0.93,0.998);',
    '  float fluxDrag=1.0+uFlux*0.26;',
    '  v*=pow(dragT*pow(0.9991,fluxDrag),1.0+mass*0.32);',
    '  float flowMid=0.34+uMid*1.22;',
    '  float nf=uTurbFreq*(0.46+uFlux*0.54);',
    '  vec3 advec=vec3(uTime*(0.056+0.048*uMid),uTime*0.041,uTime*0.035+uPhase*0.14);',
    '  vec3 c1=curlN(p*nf+advec);',
    '  vec3 c2=curlN(p*nf*2.05+advec*1.08+vec3(0.7,1.3,0.2));',
    '  float chaos=1.0+uFlux*0.78;',
    '  v+=c1*uCurl*0.0106*flowMid*chaos;',
    '  v+=c2*uCurl*0.00335*(0.3+uMid)*chaos;',
    '  float attR=0.4+0.6*uBass;',
    '  vec3 att=vec3(sin(uTime*0.38+uPhase*1.35)*attR,cos(uTime*0.29)*0.36*(1.0+0.45*uBass),cos(uTime*0.33+uPhase*1.05)*attR);',
    '  float eps=0.075;',
    '  vec3 toA=att-p;',
    '  float dA=length(toA);',
    '  v+=(toA/(dA+eps))*uAttract*(0.0062+0.0115*uBass);',
    '  float d0=length(p);',
    '  vec3 toO=-p;',
    '  v+=(toO/(d0+0.11))*uAttract*(0.0019+0.0034*uBass);',
    '  v.y-=(uGravity-uBass*0.00032)/mass;',
    '  if(d0<0.72&&d0>0.004) v+=normalize(p)*uRepel*0.009*(1.0-d0/0.72);',
    '  if(uVortex>0.01){ vec2 xz=normalize(vec2(-p.z,p.x)+vec2(0.0001)); v.xz+=xz*uVortex*0.0066*(1.0+uBass*0.52); }',
    '  float wavX=sin(p.x*2.18+uTime*(0.58+0.62*uBass)+uPhase*1.1);',
    '  float wavZ=cos(p.z*1.93-uTime*(0.51+0.48*uMid)+uCentroid*2.4);',
    '  v.x+=wavX*uOcean*(0.0038+0.019*uMid)*(1.0+uFlux*0.55);',
    '  v.z+=wavZ*uOcean*(0.0032+0.017*uHigh)*(1.0+uBeat*0.65);',
    '  v.y+=sin(dot(p.xz,vec2(1.12,0.87))*2.1-uTime*1.15)*uOcean*(0.0016+0.009*uBass);',
    '  float div=(snoise(p*0.64+uTime*0.095)-snoise(p*0.64))*uFluid;',
    '  v-=normalize(p+vec3(0.0001))*div*0.0026;',
    '  v+=normalize(p+vec3(0.0001))*sin(uPhase*6.28318)*0.0025*uMid;',
    '  float sa=uTime*(1.35+uCentroid*4.8);',
    '  v.xz+=vec2(cos(sa),sin(sa))*uCentroid*0.0034;',
    '  v+=(h33(p*4.1+advec*1.65)-vec3(0.5))*(0.0015+uHigh*0.0078);',
    '  float bk=smoothstep(0.3,0.96,uBeat);',
    '  vec3 bdir=normalize(p+c1*0.38+vec3(0.0001));',
    '  v+=bdir*uBlast*(0.012+0.048*uBass)*bk*bk;',
    '  float maxSp=uSpeed*2.38+uBass*0.052;',
    '  float sp=length(v);',
    '  if(sp>maxSp) v*=maxSp/sp;',
    '  gl_FragColor=vec4(v,mass);',
    '}'
  ].join('\n');

  var POS_FRAG = [
    'precision highp float;',
    'varying vec2 vUV;',
    'uniform sampler2D uPos;',
    'uniform sampler2D uVel;',
    'uniform float uTime,uSeedOff,uSpread,uLife,uFlux;',
    'float h21(vec2 p){ p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+19.19); return fract(p.x*p.y); }',
    'void main(){',
    '  vec4 pos=texture2D(uPos,vUV);',
    '  vec4 vel=texture2D(uVel,vUV);',
    '  float age=pos.w;',
    '  float maxAge=0.016/max(uLife*0.007,0.0001);',
    '  if(age>maxAge){',
    '    vec2 seed=vUV+vec2(uTime*0.0013,uSeedOff);',
    '    float theta=h21(seed)*6.28318;',
    '    float phi=h21(seed+0.31)*3.14159;',
    '    float r=uSpread*(0.25+h21(seed+0.7)*0.75);',
    '    pos.xyz=vec3(sin(phi)*cos(theta),cos(phi),sin(phi)*sin(theta))*r;',
    '    pos.w=h21(seed+1.3)*0.4;',
    '    gl_FragColor=pos; return;',
    '  }',
    '  float dt=clamp(1.0-uFlux*0.038,0.86,1.0);',
    '  pos.xyz+=vel.xyz*dt;',
    '  pos.w+=0.016;',
    '  gl_FragColor=pos;',
    '}'
  ].join('\n');

  /* Sprite: wide halo + tight core + rim lobe → additive stack reads volumetric. */
  var RENDER_VERT = [
    'attribute float aIdx;',
    'uniform sampler2D uPos;',
    'uniform sampler2D uVel;',
    'uniform mat4 uMVP;',
    'uniform float uTex,uSzBase,uBass,uBeat,uTime,uGlow,uRms;',
    'varying vec4 vPosAge;',
    'varying vec3 vVel;',
    'varying float vLife;',
    'varying float vPalSeed;',
    'void main(){',
    '  vec2 uv=(vec2(mod(aIdx,uTex),floor(aIdx/uTex))+0.5)/uTex;',
    '  vPosAge=texture2D(uPos,uv);',
    '  vec4 vel=texture2D(uVel,uv);',
    '  vVel=vel.xyz;',
    '  vLife=vel.w;',
    '  vPalSeed=fract(sin(aIdx*12.9898+cos(aIdx*0.001))*43758.5453);',
    '  gl_Position=uMVP*vec4(vPosAge.xyz,1.0);',
    '  float spd=length(vel.xyz);',
    '  float aFade=1.0-smoothstep(0.65,1.0,vPosAge.w/2.5);',
    '  float bPulse=1.0+uBeat*0.5;',
    '  float sBst=1.0+spd*5.0;',
    '  float rmsS=0.88+clamp(uRms,0.0,1.0)*0.38;',
    '  gl_PointSize=clamp(uSzBase*sBst*bPulse*aFade*uGlow*rmsS,0.8,42.0);',
    '}'
  ].join('\n');

  /* Colour: cosine-palette field — t mixes time, age, speed, xyz, audio + per-particle seed. */
  var RENDER_FRAG = [
    'precision mediump float;',
    'varying vec4 vPosAge;',
    'varying vec3 vVel;',
    'varying float vLife;',
    'varying float vPalSeed;',
    'uniform float uBass,uMid,uHigh,uBeat,uPhase,uCentroid,uTime,uRms;',
    'uniform float uOpacity,uPalette,uColorCycle,uSat,uBright;',
    'vec3 palette(float t,float pal){',
    '  t=fract(t);',
    '  if(pal<0.5){',
    '    vec3 a=vec3(0.1,0.02,0.15),b=vec3(0.8,0.3,0.5),c=vec3(1.2,0.8,1.1),d=vec3(0.0,0.25,0.5);',
    '    return a+b*cos(6.28318*(c*t+d));',
    '  }else if(pal<1.5){',
    '    vec3 a=vec3(0.05,0.0,0.1),b=vec3(0.9,0.2,0.7),c=vec3(1.0,0.7,1.0),d=vec3(0.1,0.3,0.6);',
    '    return a+b*cos(6.28318*(c*t+d));',
    '  }else if(pal<2.5){',
    '    vec3 a=vec3(0.15,0.03,0.0),b=vec3(0.85,0.4,0.1),c=vec3(0.9,0.5,0.3),d=vec3(0.0,0.1,0.2);',
    '    return a+b*cos(6.28318*(c*t+d));',
    '  }else if(pal<3.5){',
    '    vec3 a=vec3(0.0,0.05,0.2),b=vec3(0.2,0.6,0.8),c=vec3(0.8,1.0,1.2),d=vec3(0.3,0.1,0.0);',
    '    return a+b*cos(6.28318*(c*t+d));',
    '  }',
    '  vec3 a=vec3(0.12,0.06,0.0),b=vec3(0.88,0.55,0.1),c=vec3(0.9,0.7,0.3),d=vec3(0.0,0.05,0.15);',
    '  return a+b*cos(6.28318*(c*t+d));',
    '}',
    'void main(){',
    '  vec2 coord=gl_PointCoord-0.5;',
    '  float d=length(coord);',
    '  if(d>0.502) discard;',
    '  float edge=1.0-smoothstep(0.36,0.5,d);',
    '  float halo=exp(-d*4.15),core=exp(-d*29.0),rim=exp(-d*9.2)*(1.0-exp(-d*3.4));',
    '  float aFade=1.0-smoothstep(0.6,1.0,vPosAge.w/2.5);',
    '  float alpha=(halo*0.5+core*0.36+rim*0.14)*uOpacity*aFade*edge;',
    '  if(alpha<0.006) discard;',
    '  float speed=length(vVel),age=vPosAge.w;',
    '  vec3 p3=vPosAge.xyz;',
    '  float t=fract(uTime*uColorCycle*0.04+age*0.14+speed*0.42+p3.x*0.06+p3.y*0.08+p3.z*0.055+vPalSeed*0.34+uBass*0.22-uHigh*0.14+uMid*0.1+uPhase*0.11+uCentroid*0.19);',
    '  vec3 col=palette(t,uPalette);',
    '  float lum=dot(col,vec3(0.299,0.587,0.114));',
    '  col=mix(vec3(lum),col,uSat)*uBright;',
    '  float centN=(uCentroid-0.35)*0.22;',
    '  col*=vec3(1.0+centN*0.35,1.0-centN*0.12,1.0+centN*0.18);',
    '  col=mix(col,col*1.85+vec3(0.16),core);',
    '  col=mix(col,col+vec3(0.34),uBeat*0.21);',
    '  col+=vec3(rim*0.08)*uMid;',
    '  col*=(1.0+clamp(uRms,0.0,1.0)*0.12*core);',
    '  gl_FragColor=vec4(col,alpha);',
    '}'
  ].join('\n');

  function _lookAt(e, c, u) {
    var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
    var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
    var crs = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
    var nrm = function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    var f = nrm(sub(c, e)); var s = nrm(crs(f, u)); var uu = crs(s, f);
    return [s[0], uu[0], -f[0], 0, s[1], uu[1], -f[1], 0, s[2], uu[2], -f[2], 0, -dot(s, e), -dot(uu, e), dot(f, e), 1];
  }
  function _perspective(fov, asp, n, f) {
    var fh = 1 / Math.tan(fov / 2); var nf = 1 / (n - f);
    return [fh / asp, 0, 0, 0, 0, fh, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
  }
  function _mat4mul(a, b) {
    var r = new Float32Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) for (var k = 0; k < 4; k++) r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
    return r;
  }

  function getQualityScale() {
    try {
      var q = document.getElementById('qsel');
      var v = q && q.value ? String(q.value).toLowerCase() : 'balanced';
      if (v === 'perf' || v === 'performance') return 0.5;
      if (v === 'ultra') return 1.35;
    } catch (e) { /* ignore */ }
    return 1;
  }

  function countToTexSize(n) {
    var target = Math.round((n || 65536) * getQualityScale());
    var sizes = [64, 96, 128, 192, 256, 320, 384, 448, 512];
    for (var i = 0; i < sizes.length; i++) {
      if (sizes[i] * sizes[i] >= target) return sizes[i];
    }
    return 512;
  }

  function NexusParticles() {
    this.enabled = true;
    this._ready = false;
    this._gl = null;
    this._canvas = null;
    this._time = 0;
    this._ping = 0;
    this._sz = 256;
    this._count = 65536;
    this._seed = Math.random();
    this._rebuild = false;
    this._p = { gravity: 0, drag: 0.978, curl: 0.6, attract: 0.15, repel: 0.1, vortex: 0.3, blast: 0.1, spread: 2.2, speed: 0.35, life: 1, turbFreq: 0.5, ocean: 0.5, fluid: 0.6 };
    this._pT = Object.assign({}, this._p);
    this._v = { size: 2.8, glow: 1.2, palette: 0, opacity: 0.82, colorCycle: 0.3, saturation: 0.85, brightness: 0.9 };
    this._lerpSpd = 0.028;
    this._lastTargetCount = 65536;
  }

  NexusParticles.prototype.init = function () {
    var pEl = document.getElementById(CFG.particlesCanvasId);
    var canvas = pEl || document.getElementById(CFG.canvasId);
    var gl = null;
    if (pEl) {
      gl = pEl.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, stencil: false }) ||
        pEl.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
    }
    if (!gl && win.NX && NX.gl) {
      gl = NX.gl;
      canvas = gl.canvas || canvas;
    }
    if (!gl && canvas) {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
        canvas.getContext('experimental-webgl');
    }
    if (!canvas && !gl) {
      var self = this;
      setTimeout(function () { self.init(); }, 400);
      return;
    }
    if (!gl) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[NXP] WebGL not available');
      return;
    }
    this._gl = gl;
    this._canvas = gl.canvas || canvas;

    var extF = gl.getExtension('OES_texture_float');
    var extH = gl.getExtension('OES_texture_half_float');
    if (!extF && !extH) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[NXP] Float textures not available — particles disabled');
      this.enabled = false;
      return;
    }
    gl.getExtension('OES_texture_float_linear');
    var extBufFloat = gl.getExtension('WEBGL_color_buffer_float');
    var extBufHalf = gl.getExtension('EXT_color_buffer_half_float');
    if (extH && extBufHalf) {
      this._fType = extH.HALF_FLOAT_OES;
    } else if (extF && extBufFloat) {
      this._fType = gl.FLOAT;
    } else if (extH) {
      this._fType = extH.HALF_FLOAT_OES;
    } else {
      this._fType = gl.FLOAT;
    }

    this._buildShaders();
    if (!this._programsValid()) {
      if (typeof console !== 'undefined' && console.error) console.error('[NXP] Shader link failed — particles disabled');
      this.enabled = false;
      return;
    }
    this._buildQuad();
    this._rebuildBuffers(this._sz);
    if (!this._fbosRenderable()) {
      if (this._tryFallbackFloatType(extF, extH, extBufFloat, extBufHalf)) {
        this._rebuildBuffers(this._sz);
      }
      if (!this._fbosRenderable()) {
        if (typeof console !== 'undefined' && console.error) console.error('[NXP] Particle float FBO not color-renderable on this GPU — particles disabled');
        this.enabled = false;
        return;
      }
    }

    this._ready = true;
    if (NX.FxChain && typeof NX.FxChain.updateGpuParticlesStatus === 'function') {
      try { NX.FxChain.updateGpuParticlesStatus(); } catch (eFx) { /* ignore */ }
    }
    if (typeof console !== 'undefined' && console.info) {
      console.info('[NXP] ✓ ' + this._count.toLocaleString() + ' particles on ' + (this._canvas && this._canvas.id ? '#' + this._canvas.id : 'canvas'));
    }
  };

  /** Engine resize() already set bitmap CSS size; no GL rebuild required here. */
  NexusParticles.prototype.onHostResize = function () { /* viewport follows this._canvas on next render */ };

  NexusParticles.prototype._sh = function (src, type) {
    var gl = this._gl;
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && typeof console !== 'undefined' && console.error) {
      console.error('[NXP] Shader:', gl.getShaderInfoLog(s));
    }
    return s;
  };
  NexusParticles.prototype._prog = function (vs, fs) {
    var gl = this._gl;
    var p = gl.createProgram();
    gl.attachShader(p, this._sh(vs, gl.VERTEX_SHADER));
    gl.attachShader(p, this._sh(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && typeof console !== 'undefined' && console.error) {
      console.error('[NXP] Program:', gl.getProgramInfoLog(p));
    }
    return p;
  };
  NexusParticles.prototype._buildShaders = function () {
    this._pVel = this._prog(QUAD_VERT, VEL_FRAG);
    this._pPos = this._prog(QUAD_VERT, POS_FRAG);
    this._pRender = this._prog(RENDER_VERT, RENDER_FRAG);
  };

  NexusParticles.prototype._programsValid = function () {
    var gl = this._gl;
    return !!(this._pVel && this._pPos && this._pRender &&
      gl.getProgramParameter(this._pVel, gl.LINK_STATUS) &&
      gl.getProgramParameter(this._pPos, gl.LINK_STATUS) &&
      gl.getProgramParameter(this._pRender, gl.LINK_STATUS));
  };

  NexusParticles.prototype._fbosRenderable = function () {
    var gl = this._gl;
    if (!this._fPos || !this._fPos[0]) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fPos[0]);
    var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return st === gl.FRAMEBUFFER_COMPLETE;
  };

  /**
   * If RGBA+FLOAT ping-pong is incomplete, switch toward half-float when extensions allow.
   * @returns {boolean} true if type changed and caller should rebuild buffers
   */
  NexusParticles.prototype._tryFallbackFloatType = function (extF, extH, extBufFloat, extBufHalf) {
    var gl = this._gl;
    if (this._fType === gl.FLOAT && extH && extBufHalf) {
      this._fType = extH.HALF_FLOAT_OES;
      if (typeof console !== 'undefined' && console.warn) console.warn('[NXP] Switched particle sim to half-float FBO (color-buffer compatibility)');
      return true;
    }
    if (this._fType !== gl.FLOAT && extF && extBufFloat) {
      this._fType = gl.FLOAT;
      if (typeof console !== 'undefined' && console.warn) console.warn('[NXP] Retrying particle sim with float32 FBO');
      return true;
    }
    return false;
  };

  NexusParticles.prototype._buildQuad = function () {
    var gl = this._gl;
    this._quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  };

  NexusParticles.prototype._rebuildBuffers = function (sz) {
    var gl = this._gl;
    this._sz = sz;
    this._count = sz * sz;
    var posD = new Float32Array(sz * sz * 4);
    var velD = new Float32Array(sz * sz * 4);
    var i;
    for (i = 0; i < sz * sz; i++) {
      var th = Math.random() * 6.28318;
      var ph = Math.acos(2 * Math.random() - 1);
      var r = 1.4 + Math.random() * 1.2;
      posD[i * 4] = Math.sin(ph) * Math.cos(th) * r;
      posD[i * 4 + 1] = Math.cos(ph) * r;
      posD[i * 4 + 2] = Math.sin(ph) * Math.sin(th) * r;
      posD[i * 4 + 3] = Math.random();
      velD[i * 4] = (Math.random() - 0.5) * 0.03;
      velD[i * 4 + 1] = (Math.random() - 0.5) * 0.03;
      velD[i * 4 + 2] = (Math.random() - 0.5) * 0.03;
      velD[i * 4 + 3] = 0.3 + Math.random() * 0.7;
    }
    var self = this;
    function mkTex(data) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sz, sz, 0, gl.RGBA, self._fType, data || null);
      return t;
    }
    function mkFBO(tex) {
      var f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (st !== gl.FRAMEBUFFER_COMPLETE && typeof console !== 'undefined' && console.warn) {
        console.warn('[NXP] Particle FBO incomplete — try another GPU profile');
      }
      return f;
    }
    this._tPos = [mkTex(posD), mkTex(null)];
    this._tVel = [mkTex(velD), mkTex(null)];
    this._fPos = [mkFBO(this._tPos[0]), mkFBO(this._tPos[1])];
    this._fVel = [mkFBO(this._tVel[0]), mkFBO(this._tVel[1])];
    var idx = new Float32Array(this._count);
    for (i = 0; i < this._count; i++) idx[i] = i;
    this._idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._idxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  };

  NexusParticles.prototype.applyPreset = function (name, instant) {
    var keys = Object.keys(PRESETS);
    var key = 'Default';
    var k;
    var want = String(name || 'default').toLowerCase();
    for (k = 0; k < keys.length; k++) {
      if (keys[k].toLowerCase() === want) { key = keys[k]; break; }
    }
    var pr = PRESETS[key];
    this._lastTargetCount = pr.count || 65536;
    var ph = pr.physics;
    var vis = pr.visual;
    this._pT.gravity = ph.gravity; this._pT.drag = ph.drag; this._pT.curl = ph.curl;
    this._pT.attract = ph.attract; this._pT.repel = ph.repel; this._pT.vortex = ph.vortex;
    this._pT.blast = ph.blast; this._pT.spread = ph.spread; this._pT.speed = ph.speed;
    this._pT.life = ph.life; this._pT.turbFreq = ph.turbFreq;
    this._pT.ocean = typeof ph.ocean === 'number' ? ph.ocean : 0.45;
    this._pT.fluid = typeof ph.fluid === 'number' ? ph.fluid : 0.55;
    Object.assign(this._v, vis);
    if (instant) Object.assign(this._p, this._pT);
    var newSz = countToTexSize(pr.count);
    if (newSz !== this._sz && this._gl) {
      this._sz = newSz;
      this._rebuild = true;
    }
    if (typeof console !== 'undefined' && console.info) {
      console.info('[NXP] → ' + key + ' (' + (pr.count || 0).toLocaleString() + ' target · tex ' + this._sz + '²)');
    }
  };

  NexusParticles.prototype._setVelUniforms = function (prog, audio) {
    var gl = this._gl;
    var p = this._p;
    function u1(n, v) { var l = gl.getUniformLocation(prog, n); if (l) gl.uniform1f(l, v); }
    u1('uBass', audio.bass); u1('uMid', audio.mid); u1('uHigh', audio.high);
    u1('uBeat', audio.beat); u1('uPhase', audio.phase); u1('uCentroid', audio.centroid);
    u1('uFlux', audio.flux); u1('uTime', this._time); u1('uSeedOff', this._seed);
    u1('uGravity', p.gravity); u1('uDrag', p.drag); u1('uCurl', p.curl);
    u1('uAttract', p.attract); u1('uRepel', p.repel); u1('uVortex', p.vortex);
    u1('uBlast', p.blast); u1('uSpread', p.spread); u1('uSpeed', p.speed);
    u1('uLife', p.life); u1('uTurbFreq', p.turbFreq);
    u1('uOcean', typeof p.ocean === 'number' ? p.ocean : 0.5);
    u1('uFluid', typeof p.fluid === 'number' ? p.fluid : 0.6);
  };

  NexusParticles.prototype._setPosUniforms = function (prog, audio) {
    var gl = this._gl;
    var p = this._p;
    function u1(n, v) { var l = gl.getUniformLocation(prog, n); if (l) gl.uniform1f(l, v); }
    u1('uTime', this._time); u1('uSeedOff', this._seed);
    u1('uSpread', p.spread); u1('uLife', p.life);
    u1('uFlux', audio && typeof audio.flux === 'number' ? audio.flux : 0);
  };

  NexusParticles.prototype._syncFlagsFromUi = function () {
    var S = win.NX && NX.S;
    if (!S) return;
    var gpu = document.getElementById(CFG.gpuCheckboxId);
    var mix = document.getElementById(CFG.mixParticlesCheckboxId);
    if (gpu) S.nexusGpuParticlesEnabled = !!gpu.checked;
    if (mix) S.nexusMixParticlesEnabled = !!mix.checked;
    var forced = NX.SceneManager && typeof NX.SceneManager.isParticleStackForced === 'function' && NX.SceneManager.isParticleStackForced();
    if (forced) {
      this.enabled = S.nexusMixParticlesEnabled !== false;
      return;
    }
    if (typeof S.nexusGpuParticlesEnabled === 'boolean') this.enabled = S.nexusGpuParticlesEnabled;
    if (typeof S.nexusMixParticlesEnabled === 'boolean' && !S.nexusMixParticlesEnabled) this.enabled = false;
  };

  NexusParticles.prototype.render = function (audio) {
    if (!this._ready || !this._gl) return;
    this._syncFlagsFromUi();
    if (!this.enabled) return;

    if (this._rebuild) {
      this._rebuildBuffers(this._sz);
      this._rebuild = false;
    }

    var k;
    for (k in this._pT) {
      if (Object.prototype.hasOwnProperty.call(this._p, k)) {
        this._p[k] += (this._pT[k] - this._p[k]) * this._lerpSpd;
      }
    }

    this._time += 0.016;
    var gl = this._gl;
    var pong = 1 - this._ping;
    var sz = this._sz;
    var self = this;

    function runUpdate(prog, fbo, tPos, tVel, posOnly) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, sz, sz);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tPos);
      gl.uniform1i(gl.getUniformLocation(prog, 'uPos'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tVel);
      gl.uniform1i(gl.getUniformLocation(prog, 'uVel'), 1);
      if (posOnly) self._setPosUniforms(prog, audio);
      else self._setVelUniforms(prog, audio);
      gl.bindBuffer(gl.ARRAY_BUFFER, self._quad);
      var al = gl.getAttribLocation(prog, 'aPos');
      if (al >= 0) {
        gl.enableVertexAttribArray(al);
        gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    runUpdate(this._pVel, this._fVel[pong], this._tPos[this._ping], this._tVel[this._ping], false);
    runUpdate(this._pPos, this._fPos[pong], this._tPos[this._ping], this._tVel[pong], true);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this._canvas.width, this._canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this._pRender);
    var depthWas = gl.isEnabled(gl.DEPTH_TEST);
    var depthMaskWas = gl.getParameter(gl.DEPTH_WRITEMASK);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._tPos[pong]);
    gl.uniform1i(gl.getUniformLocation(this._pRender, 'uPos'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._tVel[pong]);
    gl.uniform1i(gl.getUniformLocation(this._pRender, 'uVel'), 1);

    function u1r(n, v) { var l = gl.getUniformLocation(self._pRender, n); if (l) gl.uniform1f(l, v); }
    u1r('uBass', audio.bass); u1r('uMid', audio.mid); u1r('uHigh', audio.high);
    u1r('uBeat', audio.beat); u1r('uPhase', audio.phase); u1r('uCentroid', audio.centroid);
    u1r('uRms', audio.rms);
    u1r('uTime', this._time); u1r('uTex', sz);
    u1r('uOpacity', this._v.opacity); u1r('uPalette', this._v.palette);
    u1r('uColorCycle', this._v.colorCycle); u1r('uSat', this._v.saturation);
    u1r('uBright', this._v.brightness); u1r('uGlow', this._v.glow);
    u1r('uSzBase', this._v.size * (win.devicePixelRatio || 1));

    this._setMVP(audio);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._idxBuf);
    var idxLoc = gl.getAttribLocation(this._pRender, 'aIdx');
    if (idxLoc >= 0) {
      gl.enableVertexAttribArray(idxLoc);
      gl.vertexAttribPointer(idxLoc, 1, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, this._count);
    }

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (depthWas) gl.enable(gl.DEPTH_TEST);
    else gl.disable(gl.DEPTH_TEST);
    gl.depthMask(depthMaskWas);

    this._ping = pong;
  };

  NexusParticles.prototype._setMVP = function (audio) {
    var gl = this._gl;
    var loc = gl.getUniformLocation(this._pRender, 'uMVP');
    if (!loc) return;
    if (win.NX && NX.camera && typeof NX.camera.getMVP === 'function') {
      gl.uniformMatrix4fv(loc, false, NX.camera.getMVP());
      return;
    }
    if (win.NX && NX.camera && NX.camera.viewProjection) {
      gl.uniformMatrix4fv(loc, false, NX.camera.viewProjection);
      return;
    }
    var t = this._time;
    var r = 5.5 + (audio.bass || 0) * 0.8 - (audio.high || 0) * 0.3;
    var ey = Math.sin(t * 0.08) * 2.2;
    var ex = Math.sin(t * 0.13) * r;
    var ez = Math.cos(t * 0.13) * r;
    gl.uniformMatrix4fv(loc, false, _mat4mul(
      _perspective(60 * Math.PI / 180, this._canvas.width / this._canvas.height, 0.01, 50),
      _lookAt([ex, ey, ez], [0, 0, 0], [0, 1, 0])
    ));
  };

  function getAudio() {
    var S = (win.NX && NX.S) ? NX.S : {};
    var A = CFG.audio;
    function num(x) { return typeof x === 'number' && !isNaN(x) ? x : 0; }
    var beat = num(S[A.beat]);
    if (!beat && typeof S.beat === 'number') beat = Math.min(1, S.beat * 0.45);
    return {
      bass: num(S[A.bass]),
      mid: num(S[A.mid]),
      high: num(S[A.high]),
      beat: beat,
      phase: num(S[A.bpmPhase]),
      centroid: typeof S[A.centroid] === 'number' ? S[A.centroid] : 0.35,
      flux: num(S[A.flux]),
      rms: num(S[A.rms])
    };
  }

  function boot() {
    var sys = new NexusParticles();
    win.NX = win.NX || {};
    win.NX.particles = sys;

    function patchGpuOverlay() {
      if (!win.NX.GpuParticles) NX.GpuParticles = {};
      var gp = NX.GpuParticles;
      if (gp.renderOverlay && gp.renderOverlay._nxMfxParticles) return;
      var prev = gp.renderOverlay;
      gp.renderOverlay = function () {
        try {
          if (prev && prev !== gp.renderOverlay) prev();
        } catch (e0) {
          if (typeof console !== 'undefined' && console.warn) console.warn('[NXP] GpuParticles chain (pre-overlay):', e0);
        }
        try {
          if (sys._ready && sys.enabled) sys.render(getAudio());
        } catch (e1) {
          if (typeof console !== 'undefined' && console.warn) console.warn('[NXP] render overlay:', e1);
        }
      };
      gp.renderOverlay._nxMfxParticles = true;
    }

    setTimeout(function () { sys.init(); patchGpuOverlay(); }, 280);
    setTimeout(patchGpuOverlay, 2000);

    var STYLE_MAP = {
      trance: 'Trance', techno: 'Techno', ambient: 'Ambient', edm: 'EDM', glitch: 'Glitch',
      club: 'Club', psychedelic: 'Psychedelic', asura_mfx: 'Psychedelic', asura: 'Psychedelic',
      tornado: 'Tornado', ocean: 'Ocean', gravity: 'Gravity', vortex: 'Vortex', ambient_show: 'Ambient'
    };

    function applyStyleId(id) {
      var p = STYLE_MAP[String(id || '').toLowerCase()];
      if (p) sys.applyPreset(p);
    }

    function patchProPresets() {
      if (!win.NXProPresets) return;
      var PP = NXProPresets;
      if (typeof PP.applyVisualStyle === 'function' && !PP.applyVisualStyle._nxMfxP) {
        var oVis = PP.applyVisualStyle;
        PP.applyVisualStyle = function (id) {
          oVis.call(PP, id);
          applyStyleId(id);
        };
        PP.applyVisualStyle._nxMfxP = true;
      }
      if (typeof PP.applyShowMacro === 'function' && !PP.applyShowMacro._nxMfxP) {
        var oShow = PP.applyShowMacro;
        PP.applyShowMacro = function (id) {
          oShow.call(PP, id);
          applyStyleId(id);
        };
        PP.applyShowMacro._nxMfxP = true;
      }
    }
    patchProPresets();
    setTimeout(patchProPresets, 2000);
    setTimeout(patchProPresets, 5000);

    function patchStyleFn() {
      if (!win.NX) return;
      var fn = NX.applyVisualStyle;
      if (typeof fn === 'function' && !fn._nxMfxP) {
        NX.applyVisualStyle = function (s) {
          fn.call(NX, s);
          applyStyleId(s);
        };
        NX.applyVisualStyle._nxMfxP = true;
      }
    }
    patchStyleFn();
    setTimeout(patchStyleFn, 2000);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var b = t.closest('[data-style],[data-vol]');
      if (b && b.dataset) {
        if (b.dataset.style) applyStyleId(b.dataset.style);
        else if (b.dataset.vol) applyStyleId(b.dataset.vol);
      }
    });

    var styleSel = document.getElementById('nx-visual-style');
    if (styleSel && !styleSel._nxMfxStyle) {
      styleSel._nxMfxStyle = true;
      styleSel.addEventListener('change', function () {
        applyStyleId(styleSel.value);
      });
    }

    function wireGpuToggle() {
      var cb = document.getElementById(CFG.gpuCheckboxId);
      if (!cb || cb._nxMfxWire) return !!cb;
      cb._nxMfxWire = true;
      function sync() {
        if (NX.S) NX.S.nexusGpuParticlesEnabled = !!cb.checked;
        if (NX.SceneManager && typeof NX.SceneManager.isParticleStackForced === 'function' && NX.SceneManager.isParticleStackForced()) {
          sys.enabled = NX.S && NX.S.nexusMixParticlesEnabled !== false;
          return;
        }
        sys.enabled = !!cb.checked;
        if (NX.S && typeof NX.S.nexusMixParticlesEnabled === 'boolean' && !NX.S.nexusMixParticlesEnabled) sys.enabled = false;
      }
      sync();
      cb.addEventListener('change', sync);
      return true;
    }
    function wireMixToggle() {
      var cb = document.getElementById(CFG.mixParticlesCheckboxId);
      if (!cb || cb._nxMfxWire) return !!cb;
      cb._nxMfxWire = true;
      cb.addEventListener('change', function () {
        if (NX.S) NX.S.nexusMixParticlesEnabled = !!cb.checked;
        if (NX.SceneManager && typeof NX.SceneManager.isParticleStackForced === 'function' && NX.SceneManager.isParticleStackForced()) {
          sys.enabled = NX.S && NX.S.nexusMixParticlesEnabled !== false;
          return;
        }
        if (NX.S && !NX.S.nexusMixParticlesEnabled) sys.enabled = false;
        else if (document.getElementById(CFG.gpuCheckboxId)) {
          sys.enabled = !!document.getElementById(CFG.gpuCheckboxId).checked;
        }
      });
      return true;
    }
    if (!wireGpuToggle()) setTimeout(wireGpuToggle, 1500);
    if (!wireMixToggle()) setTimeout(wireMixToggle, 1500);

    if (typeof NX.setQualityPreset === 'function' && !NX.setQualityPreset._nxMfxQ) {
      var oQ = NX.setQualityPreset;
      NX.setQualityPreset = function (mode) {
        oQ.apply(NX, arguments);
        sys._sz = countToTexSize(sys._lastTargetCount || 65536);
        sys._rebuild = true;
      };
      NX.setQualityPreset._nxMfxQ = true;
    }

    sys.applyPreset('Default', true);
    if (typeof console !== 'undefined' && console.info) console.info('[NXP] Bootstrap complete — NX.particles + GpuParticles overlay');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 120); });
  } else {
    setTimeout(boot, 120);
  }

  win.NexusParticles = NexusParticles;
  win.NX_PARTICLE_PRESETS = PRESETS;
})(window);