/**
 * NEXUS Engine Pro — particles-gpu.js
 * =====================================
 * Self-contained GPU particle system. Zero changes to engine.js.
 * Ping-pong float textures: physics runs on GPU.
 * Preset personalities tied to DJ style / show macros (NXProPresets).
 * Audio-reactive: reads live analysis from NX.S (sBass / sMid / sHigh / beatVisual / beatPhase / sCent / sFlux).
 *
 * Integration: this file is registered in js/app-loader.mjs immediately after js/engine.js.
 */

(function (global) {
  'use strict';

  // NX.audio (audio.js) is the mic/graph API — band levels live on NX.S after each tick.
  const CANVAS_ID        = 'c';
  const AUDIO_BASS       = 'sBass';
  const AUDIO_MID        = 'sMid';
  const AUDIO_HIGH       = 'sHigh';
  const AUDIO_BEAT       = 'beatVisual';
  const AUDIO_BPMPHASE   = 'beatPhase';
  const AUDIO_CENTROID   = 'sCent';
  const AUDIO_FLUX       = 'sFlux';

  const COUNT_TIERS = {
    performance: { low: 16384,  mid: 32768,  ultra: 65536  },
    balanced:    { low: 32768,  mid: 65536,  ultra: 131072 },
    ultra:       { low: 65536,  mid: 131072, ultra: 262144 },
  };

  const PRESETS = {

    Trance: {
      count: 'ultra',
      physics: {
        gravity: 0.0, drag: 0.980, turbulence: 0.40,
        attraction: 0.30, repulsion: 0.00, vortex: 0.70,
        explosionMag: 0.08, spread: 2.20, speed: 0.40, lifetime: 1.00,
      },
      visual: { size: 2.0, glow: 1.0, colorMode: 0, opacity: 0.85, pulseOnBeat: true },
    },

    Techno: {
      count: 'ultra',
      physics: {
        gravity: 0.0, drag: 0.960, turbulence: 0.80,
        attraction: 0.00, repulsion: 0.50, vortex: 0.20,
        explosionMag: 0.14, spread: 2.80, speed: 0.70, lifetime: 0.70,
      },
      visual: { size: 1.5, glow: 0.6, colorMode: 4, opacity: 0.90, pulseOnBeat: true },
    },

    Ambient: {
      count: 'mid',
      physics: {
        gravity: -0.0003, drag: 0.993, turbulence: 0.12,
        attraction: 0.15, repulsion: 0.00, vortex: 0.25,
        explosionMag: 0.03, spread: 1.80, speed: 0.15, lifetime: 1.60,
      },
      visual: { size: 3.5, glow: 1.4, colorMode: 3, opacity: 0.55, pulseOnBeat: false },
    },

    EDM: {
      count: 'ultra',
      physics: {
        gravity: 0.0, drag: 0.972, turbulence: 0.60,
        attraction: 0.20, repulsion: 0.30, vortex: 0.50,
        explosionMag: 0.12, spread: 2.50, speed: 0.60, lifetime: 0.85,
      },
      visual: { size: 2.2, glow: 1.2, colorMode: 0, opacity: 0.88, pulseOnBeat: true },
    },

    Glitch: {
      count: 'ultra',
      physics: {
        gravity: 0.0, drag: 0.940, turbulence: 1.20,
        attraction: 0.00, repulsion: 0.80, vortex: 0.00,
        explosionMag: 0.20, spread: 3.20, speed: 1.00, lifetime: 0.45,
      },
      visual: { size: 1.2, glow: 0.4, colorMode: 4, opacity: 1.00, pulseOnBeat: true },
    },

    Club: {
      count: 'ultra',
      physics: {
        gravity: 0.0, drag: 0.975, turbulence: 0.50,
        attraction: 0.25, repulsion: 0.20, vortex: 0.60,
        explosionMag: 0.10, spread: 2.20, speed: 0.50, lifetime: 0.90,
      },
      visual: { size: 2.0, glow: 1.1, colorMode: 5, opacity: 0.85, pulseOnBeat: true },
    },

    Psychedelic: {
      count: 'ultra',
      physics: {
        gravity: -0.0001, drag: 0.985, turbulence: 0.90,
        attraction: 0.40, repulsion: 0.10, vortex: 0.90,
        explosionMag: 0.07, spread: 2.00, speed: 0.35, lifetime: 1.40,
      },
      visual: { size: 3.0, glow: 1.6, colorMode: 0, opacity: 0.70, pulseOnBeat: false },
    },

    Tornado: {
      count: 'ultra',
      physics: {
        gravity: -0.0005, drag: 0.982, turbulence: 0.30,
        attraction: 0.00, repulsion: 0.00, vortex: 1.00,
        explosionMag: 0.06, spread: 0.80, speed: 0.50, lifetime: 1.10,
      },
      visual: { size: 1.8, glow: 0.9, colorMode: 2, opacity: 0.80, pulseOnBeat: true },
    },

    Ocean: {
      count: 'mid',
      physics: {
        gravity: 0.0002, drag: 0.991, turbulence: 0.25,
        attraction: 0.08, repulsion: 0.00, vortex: 0.15,
        explosionMag: 0.04, spread: 3.00, speed: 0.20, lifetime: 1.50,
      },
      visual: { size: 2.8, glow: 1.3, colorMode: 3, opacity: 0.60, pulseOnBeat: false },
    },

    Gravity: {
      count: 'ultra',
      physics: {
        gravity: 0.0008, drag: 0.970, turbulence: 0.20,
        attraction: 0.00, repulsion: 0.60, vortex: 0.00,
        explosionMag: 0.16, spread: 2.60, speed: 0.80, lifetime: 0.70,
      },
      visual: { size: 1.6, glow: 0.7, colorMode: 2, opacity: 0.90, pulseOnBeat: true },
    },

    Vortex: {
      count: 'ultra',
      physics: {
        gravity: 0.0, drag: 0.978, turbulence: 0.45,
        attraction: 0.60, repulsion: 0.30, vortex: 0.80,
        explosionMag: 0.09, spread: 2.00, speed: 0.55, lifetime: 0.95,
      },
      visual: { size: 1.9, glow: 1.0, colorMode: 0, opacity: 0.82, pulseOnBeat: true },
    },

    Default: {
      count: 'mid',
      physics: {
        gravity: 0.0, drag: 0.980, turbulence: 0.30,
        attraction: 0.20, repulsion: 0.10, vortex: 0.40,
        explosionMag: 0.08, spread: 2.00, speed: 0.40, lifetime: 1.00,
      },
      visual: { size: 2.0, glow: 1.0, colorMode: 0, opacity: 0.80, pulseOnBeat: true },
    },
  };

  const UPDATE_VERT = `
    attribute vec2 aUV;
    varying vec2 vUV;
    void main() {
      vUV = aUV * 0.5 + 0.5;
      gl_Position = vec4(aUV, 0.0, 1.0);
    }
  `;

  const UPDATE_FRAG = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D uPosTex;
    uniform sampler2D uVelTex;
    uniform float uBass, uMid, uHigh, uBeat, uBpmPhase, uCentroid, uFlux, uTime, uSeedOffset;
    uniform float uGravity, uDrag, uTurbulence, uAttraction, uRepulsion;
    uniform float uVortex, uExplosionMag, uSpread, uSpeed, uLifetime;

    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }
    float hash3(vec3 p) { return hash(p.xy + p.z * 0.3718); }
    vec3 randomDir(vec2 seed) {
      float theta = hash(seed) * 6.2832;
      float phi   = hash(seed + vec2(1.7, 9.3)) * 3.1416;
      return vec3(sin(phi)*cos(theta), cos(phi), sin(phi)*sin(theta));
    }
    float noise3(vec3 p) {
      vec3 i = floor(p); vec3 f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(
        mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),
        f.z) * 2.0 - 1.0;
    }

    void main() {
      vec4 pos  = texture2D(uPosTex, vUV);
      vec4 vel  = texture2D(uVelTex, vUV);
      float age = pos.w;
      float mass = max(vel.w, 0.2);
      float maxAge = 0.016 / max(uLifetime * 0.008, 0.001);

      if (age > maxAge || (age < 0.0001 && length(vel.xyz) < 0.0001)) {
        vec2 seed = vUV + vec2(uTime * 0.001, uSeedOffset);
        vec3 dir  = randomDir(seed);
        float r   = uSpread * (0.3 + hash(seed + 0.5) * 0.7);
        pos.xyz   = dir * r;
        pos.w     = hash(seed + 3.7) * 0.3;
        gl_FragColor = pos; return;
      }

      vec3 p = pos.xyz;
      vec3 v = vel.xyz;
      vec3 force = vec3(0.0);

      force.y -= (uGravity + uBass * 0.0002) / mass;
      force += normalize(p + 0.0001) * (uBass - uHigh) * 0.003;
      float ts = 0.6 + uFlux * 0.4;
      float tt = uTime * (0.15 + uMid * 0.3);
      force += vec3(noise3(p*ts+vec3(tt,0,0)),
                    noise3(p*ts+vec3(0,tt,1.7)),
                    noise3(p*ts+vec3(3.3,0,tt))) * uTurbulence * 0.006 * (0.5+uMid*0.5);
      float dist = length(p);
      if (dist > 0.01) force -= normalize(p) * uAttraction * 0.004 * (1.0 - min(dist/uSpread, 1.0));
      if (dist < 0.8 && dist > 0.001) force += normalize(p) * uRepulsion * 0.008 * (1.0 - dist/0.8);
      if (uVortex > 0.01) force += normalize(vec3(-p.z, 0.0, p.x) + 0.0001) * uVortex * 0.005 * (0.7 + uBass*0.5);
      force += normalize(p + 0.0001) * sin(uBpmPhase * 6.2832) * 0.002 * uMid;
      float sa = uTime * (2.0 + uCentroid * 6.0);
      force += vec3(cos(sa), 0.0, sin(sa)) * uCentroid * 0.003;
      if (uBeat > 0.75) {
        float bs = (uBeat - 0.75) / 0.25;
        force += normalize(p + randomDir(vUV + uTime) * 0.3) * uExplosionMag * bs * (1.0 + uBass);
      }
      if (uFlux > 0.6) force += randomDir(vUV + uTime * 0.5) * (uFlux - 0.6) / 0.4 * 0.015;

      v += force;
      v *= pow(uDrag, 1.0 + mass * 0.3);
      float maxSpd = uSpeed * 3.0 + uBass * 0.05;
      float spd = length(v);
      if (spd > maxSpd) v = v / spd * maxSpd;

      p   += v;
      age += 0.016;
      gl_FragColor = vec4(p, age);
    }
  `;

  const VEL_FRAG = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D uPosTex;
    uniform sampler2D uVelTex;
    uniform float uBass, uMid, uHigh, uBeat, uBpmPhase, uCentroid, uFlux, uTime, uSeedOffset;
    uniform float uGravity, uDrag, uTurbulence, uAttraction, uRepulsion;
    uniform float uVortex, uExplosionMag, uSpread, uSpeed, uLifetime;

    float hash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float hash3(vec3 p){return hash(p.xy+p.z*0.3718);}
    vec3 randomDir(vec2 s){float t=hash(s)*6.2832,p=hash(s+vec2(1.7,9.3))*3.1416;return vec3(sin(p)*cos(t),cos(p),sin(p)*sin(t));}
    float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z)*2.0-1.0;}

    void main() {
      vec4 pos=texture2D(uPosTex,vUV); vec4 vel=texture2D(uVelTex,vUV);
      float age=pos.w, mass=max(vel.w,0.2);
      float maxAge=0.016/max(uLifetime*0.008,0.001);
      if (age>maxAge||(age<0.0001&&length(vel.xyz)<0.0001)){
        vec2 seed=vUV+vec2(uTime*0.001,uSeedOffset);
        vel.xyz=randomDir(seed)*uSpeed*(0.5+hash(seed+1.3)*0.5);
        vel.w=0.5+hash(seed+2.1)*0.5;
        gl_FragColor=vel; return;
      }
      vec3 p=pos.xyz,v=vel.xyz,force=vec3(0);
      force.y-=(uGravity+uBass*0.0002)/mass;
      force+=normalize(p+0.0001)*(uBass-uHigh)*0.003;
      float ts=0.6+uFlux*0.4,tt=uTime*(0.15+uMid*0.3);
      force+=vec3(noise3(p*ts+vec3(tt,0,0)),noise3(p*ts+vec3(0,tt,1.7)),noise3(p*ts+vec3(3.3,0,tt)))*uTurbulence*0.006*(0.5+uMid*0.5);
      float dist=length(p);
      if(dist>0.01) force-=normalize(p)*uAttraction*0.004*(1.0-min(dist/uSpread,1.0));
      if(dist<0.8&&dist>0.001) force+=normalize(p)*uRepulsion*0.008*(1.0-dist/0.8);
      if(uVortex>0.01) force+=normalize(vec3(-p.z,0,p.x)+0.0001)*uVortex*0.005*(0.7+uBass*0.5);
      force+=normalize(p+0.0001)*sin(uBpmPhase*6.2832)*0.002*uMid;
      float sa=uTime*(2.0+uCentroid*6.0);
      force+=vec3(cos(sa),0,sin(sa))*uCentroid*0.003;
      if(uBeat>0.75) force+=normalize(p+randomDir(vUV+uTime)*0.3)*uExplosionMag*((uBeat-0.75)/0.25)*(1.0+uBass);
      if(uFlux>0.6) force+=randomDir(vUV+uTime*0.5)*(uFlux-0.6)/0.4*0.015;
      v+=force; v*=pow(uDrag,1.0+mass*0.3);
      float maxSpd=uSpeed*3.0+uBass*0.05,spd=length(v);
      if(spd>maxSpd) v=v/spd*maxSpd;
      gl_FragColor=vec4(v,mass);
    }
  `;

  const RENDER_VERT = `
    attribute float aParticleIndex;
    uniform sampler2D uPosTex;
    uniform sampler2D uVelTex;
    uniform mat4 uMVP;
    uniform float uTexSize, uPointSizeBase, uBass, uBeat, uCentroid, uTime, uGlow;
    varying float vAge, vSpeed, vMass, vIndex;
    varying vec3 vVel;

    void main() {
      float idx = aParticleIndex;
      vec2 uv   = (vec2(mod(idx, uTexSize), floor(idx / uTexSize)) + 0.5) / uTexSize;
      vec4 pos  = texture2D(uPosTex, uv);
      vec4 vel  = texture2D(uVelTex, uv);
      vAge   = pos.w;
      vSpeed = length(vel.xyz);
      vMass  = vel.w;
      vVel   = vel.xyz;
      vIndex = idx;
      gl_Position  = uMVP * vec4(pos.xyz, 1.0);
      float ageFade   = 1.0 - smoothstep(0.7, 1.0, vAge / 2.0);
      float beatPulse = 1.0 + uBeat * 0.4;
      float speedSize = 1.0 + vSpeed * 4.0;
      gl_PointSize = clamp(uPointSizeBase * speedSize * beatPulse * ageFade * uGlow, 0.5, 32.0);
    }
  `;

  const RENDER_FRAG = `
    precision mediump float;
    varying float vAge, vSpeed, vMass, vIndex;
    varying vec3 vVel;
    uniform float uBass, uMid, uHigh, uCentroid, uTime, uBeat, uBpmPhase;
    uniform float uOpacity, uColorMode;
    uniform vec3 uTintColor;

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
      vec2  coord  = gl_PointCoord - 0.5;
      float distPt = length(coord);
      if (distPt > 0.5) discard;

      float glow  = exp(-distPt * 6.0);
      float core  = exp(-distPt * 18.0);
      float ageFade = 1.0 - smoothstep(0.65, 1.0, vAge / 2.0);
      float alpha = (glow * 0.6 + core * 0.4) * uOpacity * ageFade;
      if (alpha < 0.01) discard;

      float baseHue = uTime * 0.04 + uCentroid * 0.4 + uBpmPhase * 0.15;
      vec3 color = vec3(1.0);

      if (uColorMode < 0.5) {
        color = hsv2rgb(vec3(fract(baseHue + vIndex * 0.000013 + vSpeed * 0.3),
                             0.7 + uMid * 0.3, 0.8 + uBass * 0.2));
      } else if (uColorMode < 1.5) {
        color = mix(uTintColor * (0.7 + uBass * 0.3), vec3(1.0), core * 0.4);
      } else if (uColorMode < 2.5) {
        float t = clamp(vSpeed * 3.0 + uBass * 0.5, 0.0, 1.0);
        color = mix(vec3(0.8,0.1,0.0), vec3(1.0,0.5,0.0), t);
        color = mix(color, vec3(1.0,1.0,0.5), clamp((t-0.5)*2.0, 0.0, 1.0));
        color = mix(color, vec3(1.0), clamp((t-0.85)*6.0, 0.0, 1.0));
      } else if (uColorMode < 3.5) {
        float t = clamp(vSpeed * 2.0 + uHigh * 0.5, 0.0, 1.0);
        color = mix(vec3(0.0,0.1,0.6), vec3(0.0,0.7,1.0), t);
        color = mix(color, vec3(0.8,0.95,1.0), clamp((t-0.6)*2.5, 0.0, 1.0));
      } else if (uColorMode < 4.5) {
        color = hsv2rgb(vec3(fract(baseHue + vIndex * 0.000017 + sin(vAge*3.0)*0.1), 1.0, 1.0));
        color = mix(color, vec3(1.0), core * 0.6);
      } else {
        float t = clamp(vSpeed * 2.5 + uBass * 0.4, 0.0, 1.0);
        color = mix(vec3(0.5,0.2,0.0), vec3(1.0,0.7,0.1), t);
        color = mix(color, vec3(1.0,0.95,0.7), core * 0.7);
      }

      color = mix(color, vec3(1.0), uBeat * 0.15);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  function NexusParticleSystem() {
    this.enabled  = true;
    this.gl       = null;
    this._ready   = false;
    this._time    = 0;
    this._ping    = 0;
    this._frameN  = 0;
    this._seedOff = Math.random();
    this._pendingRebuild = false;
    this._texSize = 256;
    this._count   = 65536;
    this._densityTier = 'mid';
    this._lerpSpd = 0.03;

    this._phys = {
      gravity:0, drag:0.98, turbulence:0.3, attraction:0.2, repulsion:0.1,
      vortex:0.4, explosionMag:0.08, spread:2, speed:0.4, lifetime:1
    };
    this._physTarget = Object.assign({}, this._phys);
    this._vis = { size:2, glow:1, colorMode:0, opacity:0.8, pulseOnBeat:true };
  }

  NexusParticleSystem.prototype.init = function () {
    var canvas = document.getElementById(CANVAS_ID) || document.querySelector('canvas');
    if (!canvas) {
      console.warn('[NXP] No canvas — retry in 500ms');
      var self = this;
      setTimeout(function () { self.init(); }, 500);
      return;
    }

    var gl = canvas.getContext('webgl', { alpha:true, premultipliedAlpha:false }) ||
             canvas.getContext('experimental-webgl');
    if (!gl) { console.warn('[NXP] WebGL unavailable'); return; }
    this.gl = gl;

    this._extFloat   = gl.getExtension('OES_texture_float');
    this._extHalfFlt = gl.getExtension('OES_texture_half_float');
    if (!this._extFloat && !this._extHalfFlt) {
      console.warn('[NXP] Float textures unavailable — particles disabled');
      this.enabled = false; return;
    }
    this._ftype = this._extFloat ? gl.FLOAT : this._extHalfFlt.HALF_FLOAT_OES;

    this._buildShaders();
    this._buildQuad();
    this._setCount('mid', 'balanced');
    this._buildFBOs();
    this._buildIndexBuf();

    this._ready = true;
    if (NX.FxChain && typeof NX.FxChain.updateGpuParticlesStatus === 'function') {
      try { NX.FxChain.updateGpuParticlesStatus(); } catch (eFx) { /* ignore */ }
    }
    setTimeout(function () {
      if (NX.FxChain && typeof NX.FxChain.updateGpuParticlesStatus === 'function') {
        try { NX.FxChain.updateGpuParticlesStatus(); } catch (eF2) { /* ignore */ }
      }
    }, 2500);
    console.log('[NXP] Ready — ' + this._count.toLocaleString() + ' particles');
  };

  NexusParticleSystem.prototype._compile = function (src, type) {
    var gl = this.gl;
    var s  = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[NXP] Shader error:\n' + gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };

  NexusParticleSystem.prototype._link = function (vs, fs) {
    var gl = this.gl;
    var p  = gl.createProgram();
    gl.attachShader(p, this._compile(vs, gl.VERTEX_SHADER));
    gl.attachShader(p, this._compile(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[NXP] Link error:\n' + gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  };

  NexusParticleSystem.prototype._buildShaders = function () {
    this._progPos    = this._link(UPDATE_VERT, UPDATE_FRAG);
    this._progVel    = this._link(UPDATE_VERT, VEL_FRAG);
    this._progRender = this._link(RENDER_VERT, RENDER_FRAG);
  };

  NexusParticleSystem.prototype._buildQuad = function () {
    var gl = this.gl;
    this._quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  };

  NexusParticleSystem.prototype._buildIndexBuf = function () {
    var gl  = this.gl;
    var arr = new Float32Array(this._count);
    for (var i = 0; i < this._count; i++) arr[i] = i;
    this._idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._idxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  };

  NexusParticleSystem.prototype._makeTex = function (size, data) {
    var gl = this.gl;
    var t  = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, this._ftype, data||null);
    return t;
  };

  NexusParticleSystem.prototype._makeFBO = function (tex) {
    var gl  = this.gl;
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn('[NXP] Float FBO incomplete (' + st + ') — particles may not render on this GPU');
    }
    return fbo;
  };

  NexusParticleSystem.prototype._setCount = function (densityTier, qualityPreset) {
    var qk = (qualityPreset||'balanced').toLowerCase();
    var qt = qk.indexOf('ultra')>=0||qk.indexOf('high')>=0 ? 'ultra'
           : qk.indexOf('perf')>=0||qk.indexOf('low')>=0   ? 'performance'
           : 'balanced';
    var n = (COUNT_TIERS[qt]||COUNT_TIERS.balanced)[densityTier||'mid'] || 65536;
    var sizes = [64,128,256,512,1024];
    this._texSize = sizes.filter(function (s) { return s*s >= n; })[0] || 512;
    this._count   = this._texSize * this._texSize;
  };

  NexusParticleSystem.prototype._buildFBOs = function () {
    var s   = this._texSize;
    var pos = new Float32Array(s*s*4);
    var vel = new Float32Array(s*s*4);
    for (var i = 0; i < s*s; i++) {
      var theta = Math.random()*Math.PI*2, phi = Math.acos(2*Math.random()-1);
      var r = 1.5 + Math.random();
      pos[i*4]   = Math.sin(phi)*Math.cos(theta)*r;
      pos[i*4+1] = Math.cos(phi)*r;
      pos[i*4+2] = Math.sin(phi)*Math.sin(theta)*r;
      pos[i*4+3] = Math.random();
      vel[i*4]   = (Math.random()-0.5)*0.02;
      vel[i*4+1] = (Math.random()-0.5)*0.02;
      vel[i*4+2] = (Math.random()-0.5)*0.02;
      vel[i*4+3] = 0.5 + Math.random()*0.5;
    }
    this._posTex = [this._makeTex(s, pos), this._makeTex(s, null)];
    this._velTex = [this._makeTex(s, vel), this._makeTex(s, null)];
    this._posFBO = [this._makeFBO(this._posTex[0]), this._makeFBO(this._posTex[1])];
    this._velFBO = [this._makeFBO(this._velTex[0]), this._makeFBO(this._velTex[1])];
  };

  NexusParticleSystem.prototype._neededTexSize = function (densityTier, qt) {
    var n = (COUNT_TIERS[qt]||COUNT_TIERS.balanced)[densityTier||'mid'] || 65536;
    var sizes = [64,128,256,512,1024];
    return sizes.filter(function (s) { return s*s >= n; })[0] || 512;
  };

  NexusParticleSystem.prototype.applyPreset = function (name, instant) {
    var keys = Object.keys(PRESETS);
    var key = 'Default';
    for (var ki = 0; ki < keys.length; ki++) {
      if (keys[ki].toLowerCase() === String(name||'').toLowerCase()) { key = keys[ki]; break; }
    }
    var preset = PRESETS[key];
    this._densityTier = preset.count || 'mid';
    Object.assign(this._physTarget, preset.physics);
    Object.assign(this._vis, preset.visual);
    if (instant) Object.assign(this._phys, preset.physics);

    var qt = this._getQualityTier();
    var nextTex = this._neededTexSize(preset.count||'mid', qt);
    if (nextTex !== this._texSize) {
      this._setCount(preset.count, qt);
      this._pendingRebuild = true;
    }
    console.log('[NXP] Preset → ' + key);
  };

  NexusParticleSystem.prototype._getQualityTier = function () {
    try {
      var q = document.getElementById('qsel');
      var v = q && q.value ? String(q.value).toLowerCase() : 'balanced';
      if (v === 'ultra') return 'ultra';
      if (v === 'perf') return 'performance';
    } catch (e0) { /* ignore */ }
    return 'balanced';
  };

  NexusParticleSystem.prototype._lerpPhysics = function () {
    var s = this._lerpSpd, p = this._phys, t = this._physTarget;
    for (var k in t) {
      if (Object.prototype.hasOwnProperty.call(p, k)) p[k] += (t[k]-p[k]) * s;
    }
  };

  NexusParticleSystem.prototype._setPhysUniforms = function (prog, audio) {
    var gl = this.gl, p = this._phys;
    function u1(n, v) { var l = gl.getUniformLocation(prog,n); if (l!==null) gl.uniform1f(l,v); }
    u1('uBass',        audio.bass       || 0);
    u1('uMid',         audio.mid        || 0);
    u1('uHigh',        audio.high       || 0);
    u1('uBeat',        audio.beat       || 0);
    u1('uBpmPhase',    audio.bpmPhase   || 0);
    u1('uCentroid',    audio.centroid   || 0);
    u1('uFlux',        audio.flux       || 0);
    u1('uTime',        this._time);
    u1('uSeedOffset',  this._seedOff);
    u1('uGravity',     p.gravity);
    u1('uDrag',        p.drag);
    u1('uTurbulence',  p.turbulence);
    u1('uAttraction',  p.attraction);
    u1('uRepulsion',   p.repulsion);
    u1('uVortex',      p.vortex);
    u1('uExplosionMag',p.explosionMag);
    u1('uSpread',      p.spread);
    u1('uSpeed',       p.speed);
    u1('uLifetime',    p.lifetime);
  };

  NexusParticleSystem.prototype.render = function (audio) {
    if (!this._ready || !this.enabled) return;
    var gl   = this.gl;

    if (this._pendingRebuild) {
      this._buildFBOs();
      this._buildIndexBuf();
      this._pendingRebuild = false;
    }

    this._lerpPhysics();
    this._time += 0.016;
    var pong = 1 - this._ping;
    var s    = this._texSize;
    var self = this;

    function runPass(prog, fbo, tex0, tex1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, s, s);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex0);
      gl.uniform1i(gl.getUniformLocation(prog,'uPosTex'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex1);
      gl.uniform1i(gl.getUniformLocation(prog,'uVelTex'), 1);
      self._setPhysUniforms(prog, audio);
      gl.bindBuffer(gl.ARRAY_BUFFER, self._quadBuf);
      var uvL = gl.getAttribLocation(prog, 'aUV');
      gl.enableVertexAttribArray(uvL);
      gl.vertexAttribPointer(uvL, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    runPass(this._progPos, this._posFBO[pong],
            this._posTex[this._ping], this._velTex[this._ping]);

    runPass(this._progVel, this._velFBO[pong],
            this._posTex[pong], this._velTex[this._ping]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(this._progRender);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._posTex[pong]);
    gl.uniform1i(gl.getUniformLocation(this._progRender,'uPosTex'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this._velTex[pong]);
    gl.uniform1i(gl.getUniformLocation(this._progRender,'uVelTex'), 1);

    function u1(n,v) { var l=gl.getUniformLocation(self._progRender,n); if(l!==null) gl.uniform1f(l,v); }
    function u3(n,x,y,z) { var l=gl.getUniformLocation(self._progRender,n); if(l!==null) gl.uniform3f(l,x,y,z); }
    u1('uBass',     audio.bass     ||0); u1('uMid',      audio.mid      ||0);
    u1('uHigh',     audio.high     ||0); u1('uBeat',     audio.beat     ||0);
    u1('uBpmPhase', audio.bpmPhase ||0); u1('uCentroid', audio.centroid ||0);
    u1('uTime',     this._time);         u1('uTexSize',  s);
    u1('uOpacity',  this._vis.opacity);  u1('uColorMode',this._vis.colorMode);
    u1('uGlow',     this._vis.glow);
    u1('uPointSizeBase', this._vis.size * (window.devicePixelRatio||1));
    var tint = this._hsvToRgb((audio.centroid||0.5), 0.8, 1.0);
    u3('uTintColor', tint[0], tint[1], tint[2]);

    this._setMVP(audio);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._idxBuf);
    var idxL = gl.getAttribLocation(this._progRender, 'aParticleIndex');
    gl.enableVertexAttribArray(idxL);
    gl.vertexAttribPointer(idxL, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, this._count);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this._ping = pong;
  };

  NexusParticleSystem.prototype._setMVP = function (audio) {
    var gl  = this.gl;
    var loc = gl.getUniformLocation(this._progRender, 'uMVP');
    if (!loc) return;

    if (window.NX && NX.camera && typeof NX.camera.getMVP === 'function') {
      gl.uniformMatrix4fv(loc, false, NX.camera.getMVP()); return;
    }
    var t  = this._time;
    var r  = 5.5 + (audio.bass||0) * 0.5;
    var cx = Math.sin(t*0.12)*r, cy = Math.sin(t*0.07)*1.8, cz = Math.cos(t*0.12)*r;
    gl.uniformMatrix4fv(loc, false, this._perspLookAt(
      [cx,cy,cz],[0,0,0],[0,1,0], 60*Math.PI/180,
      gl.canvas.width/gl.canvas.height, 0.01, 50
    ));
  };

  NexusParticleSystem.prototype._hsvToRgb = function (h, s, v) {
    var i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
    switch(i%6){case 0:return[v,t,p];case 1:return[q,v,p];case 2:return[p,v,t];
                case 3:return[p,q,v];case 4:return[t,p,v];}return[v,p,q];
  };

  NexusParticleSystem.prototype._perspLookAt = function (eye,center,up,fovy,aspect,near,far) {
    var sub=function(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];};
    var dot=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];};
    var cross=function(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];};
    var norm=function(a){var l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];};
    var mul=function(a,b){var r=new Float32Array(16);for(var ii=0;ii<4;ii++)for(var j=0;j<4;j++)for(var k=0;k<4;k++)r[ii*4+j]+=a[ii*4+k]*b[k*4+j];return r;};
    var f=norm(sub(center,eye)), s=norm(cross(f,up)), u=cross(s,f);
    var view=new Float32Array([s[0],u[0],-f[0],0,s[1],u[1],-f[1],0,s[2],u[2],-f[2],0,-dot(s,eye),-dot(u,eye),dot(f,eye),1]);
    var fh=1/Math.tan(fovy/2), nf=1/(near-far);
    var proj=new Float32Array([fh/aspect,0,0,0,0,fh,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
    return mul(proj, view);
  };

  function bootstrap() {
    var sys = new NexusParticleSystem();

    if (!window.NX) window.NX = {};
    window.NX.particles = sys;

    function tryInit() {
      var canvas = document.getElementById(CANVAS_ID) || document.querySelector('canvas');
      if (!canvas) { setTimeout(tryInit, 300); return; }
      sys.init();
    }
    tryInit();

    function getAudio() {
      var S = (window.NX && NX.S) ? NX.S : {};
      var a = (window.NX && NX.audio) ? NX.audio : {};
      function pick(obj, key) {
        if (obj && typeof obj[key] === 'number' && !isNaN(obj[key])) return obj[key];
        return null;
      }
      function pickOr(obj, key, def) {
        var v = pick(obj, key);
        return v !== null ? v : def;
      }
      var beat = pick(S, AUDIO_BEAT);
      if (beat === null && typeof S.beat === 'number' && !isNaN(S.beat)) beat = S.beat * 0.52;
      if (beat === null) beat = pick(a, AUDIO_BEAT);
      if (beat === null) beat = 0;
      return {
        bass:     pickOr(S, AUDIO_BASS,     pickOr(a, AUDIO_BASS,     0)),
        mid:      pickOr(S, AUDIO_MID,      pickOr(a, AUDIO_MID,      0)),
        high:     pickOr(S, AUDIO_HIGH,     pickOr(a, AUDIO_HIGH,     0)),
        beat:     beat,
        bpmPhase: pickOr(S, AUDIO_BPMPHASE, pickOr(a, AUDIO_BPMPHASE, 0)),
        centroid: pickOr(S, AUDIO_CENTROID, pickOr(a, AUDIO_CENTROID, 0.35)),
        flux:     pickOr(S, AUDIO_FLUX,     pickOr(a, AUDIO_FLUX,     0)),
        rms:      pickOr(S, '_rmsSlow',     pickOr(a, 'rms',          0)),
      };
    }

    var hooked = false;

    /**
     * NX.loop schedules the engine's internal `loop` via closure — wrapping NX.loop only runs once.
     * Chain after compositor paths that run each frame on `#c` (see engine.js loop tail).
     */
    function chainAfter(obj, methodName) {
      if (!obj || typeof obj[methodName] !== 'function' || obj[methodName]._nxpPatched) return false;
      var orig = obj[methodName].bind(obj);
      obj[methodName] = function () {
        var ret = orig.apply(obj, arguments);
        try {
          if (sys.enabled && sys._ready) sys.render(getAudio());
        } catch (eCh) { /* ignore */ }
        return ret;
      };
      obj[methodName]._nxpPatched = true;
      return true;
    }

    function tryHook() {
      if (!window.NX || !sys._ready) return;
      var any = false;
      if (NX.GpuParticles && chainAfter(NX.GpuParticles, 'renderOverlay')) any = true;
      if (NX.VolumetricFX && chainAfter(NX.VolumetricFX, 'compositeToScreen')) any = true;
      if (any) hooked = true;
    }

    var tries = 0;
    var hookInterval = setInterval(function () {
      tryHook();
      if (hooked || ++tries > 60) clearInterval(hookInterval);
    }, 500);

    var lastT = 0;
    (function rafLoop(t) {
      requestAnimationFrame(rafLoop);
      if (!hooked && sys.enabled && sys._ready && t - lastT > 15) {
        sys.render(getAudio());
        lastT = t;
      }
    })(0);

    var STYLE_MAP = {
      trance:'Trance', techno:'Techno', ambient:'Ambient', edm:'EDM', glitch:'Glitch',
      club:'Club', psychedelic:'Psychedelic', asura_mfx:'Psychedelic',
      tornado:'Tornado', ocean:'Ocean', gravity:'Gravity', vortex:'Vortex',
      ambient_show:'Ambient'
    };

    function applyStyleId(id) {
      var p = STYLE_MAP[String(id||'').toLowerCase()];
      if (p) sys.applyPreset(p);
    }

    function patchProPresets() {
      if (!window.NXProPresets) return;
      var PP = NXProPresets;
      if (typeof PP.applyVisualStyle === 'function' && !PP.applyVisualStyle._nxpPatched) {
        var oVis = PP.applyVisualStyle;
        PP.applyVisualStyle = function (id) {
          oVis.call(PP, id);
          applyStyleId(id);
        };
        PP.applyVisualStyle._nxpPatched = true;
      }
      if (typeof PP.applyShowMacro === 'function' && !PP.applyShowMacro._nxpPatched) {
        var oShow = PP.applyShowMacro;
        PP.applyShowMacro = function (id) {
          oShow.call(PP, id);
          applyStyleId(id);
        };
        PP.applyShowMacro._nxpPatched = true;
      }
    }
    patchProPresets();
    setTimeout(patchProPresets, 2000);
    setTimeout(patchProPresets, 5000);

    function patchStyleFn() {
      if (!window.NX) return;
      var fn = NX.applyVisualStyle;
      if (typeof fn === 'function' && !fn._nxpPatched) {
        NX.applyVisualStyle = function (s) {
          fn.call(NX, s);
          applyStyleId(s);
        };
        NX.applyVisualStyle._nxpPatched = true;
      }
    }
    patchStyleFn();
    setTimeout(patchStyleFn, 2000);
    setTimeout(patchStyleFn, 5000);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var styleBtn = t.closest('[data-style]');
      if (styleBtn && styleBtn.dataset && styleBtn.dataset.style) {
        applyStyleId(styleBtn.dataset.style);
        return;
      }
      var volBtn = t.closest('[data-vol]');
      if (volBtn && volBtn.dataset && volBtn.dataset.vol) {
        applyStyleId(volBtn.dataset.vol);
        return;
      }
    });

    ['applyStyle','setStyle','setPreset','applyPreset'].forEach(function (fn) {
      if (typeof window.NX !== 'undefined' && NX && typeof NX[fn] === 'function' && !NX[fn]._nxpPatched) {
        var orig = NX[fn].bind(NX);
        NX[fn] = function (s) {
          orig.apply(NX, arguments);
          var pk = STYLE_MAP[String(s||'').toLowerCase()];
          if (pk) sys.applyPreset(pk);
          else if (PRESETS[s]) sys.applyPreset(s);
        };
        NX[fn]._nxpPatched = true;
      }
    });

    if (window.NX && typeof NX.setQualityPreset === 'function' && !NX.setQualityPreset._nxpPatched) {
      var oQ = NX.setQualityPreset;
      NX.setQualityPreset = function (mode) {
        oQ.apply(NX, arguments);
        var prevTex = sys._texSize;
        sys._setCount(sys._densityTier || 'mid', String(mode || ''));
        if (sys._texSize !== prevTex) sys._pendingRebuild = true;
      };
      NX.setQualityPreset._nxpPatched = true;
    }

    setTimeout(function () {
      var labels = document.querySelectorAll('label');
      for (var li = 0; li < labels.length; li++) {
        var label = labels[li];
        if (!label.textContent || label.textContent.toLowerCase().indexOf('gpu particles') < 0) continue;
        var cb = label.querySelector('input[type=checkbox]') || label.previousElementSibling;
        if (cb && cb.type === 'checkbox') {
          sys.enabled = cb.checked;
          cb.addEventListener('change', function () { sys.enabled = cb.checked; });
        }
      }
    }, 2000);

    sys.applyPreset('Default', true);
    console.log('[NXP] Bootstrap complete. NX.particles ready.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(bootstrap, 200); });
  } else {
    setTimeout(bootstrap, 200);
  }

  global.NexusParticleSystem  = NexusParticleSystem;
  global.NX_PARTICLE_PRESETS  = PRESETS;

})(window);
