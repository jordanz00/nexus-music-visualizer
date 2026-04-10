'use strict';
/*  scenes.js — Shared GLSL HEAD (uniforms, palette, SDF, noise, lighting),
    scene registry, and compilation.                                        */

(function () {
  var HEAD = [
    /* iOS / Mali: fragment highp is optional; fall back so scenes still compile */
    '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif',
    'varying vec2 uv;',
    'uniform vec2 R;',
    'uniform vec2 MX;',
    'uniform float T,B,M,H,V,BT,EX,SP,WP,PAL,FL,SC;',
    'uniform float BP,PH,BC,LD;',
    'uniform sampler2D AU,PV;',
    '#define PI  3.14159265359',
    '#define TAU 6.28318530718',
    '#define sat(x) clamp(x,0.,1.)',
    '#define smin(a,b,k) (min(a,b)-k*(sat(.5+.5*(b-a)/k))*(1.-sat(.5+.5*(b-a)/k))*k*.25)',
    'vec3 pal(float t){',
    '  float hue=B*.24+M*.17+H*.14+BT*.36+SC*.22+FL*.11;',
    '  float tw=fract(t+T*0.0032*SP+hue+FL*.04);',
    '  vec3 c;',
    '  if(PAL<1.)c=.5+.5*cos(TAU*(tw*vec3(.8,.9,1.1)+vec3(.0,.08,.28)));',
    '  else if(PAL<2.)c=.5+.5*cos(TAU*(tw*vec3(1.,.55,.25)+vec3(.04,.18,.32)));',
    '  else if(PAL<3.)c=.5+.5*cos(TAU*(tw*vec3(.55,1.,.65)+vec3(.18,.0,.12)));',
    '  else if(PAL<4.)c=.5+.5*cos(TAU*(tw*vec3(1.,.15,.85)+vec3(.0,.38,.08)));',
    '  else if(PAL<5.)c=.5+.5*cos(TAU*(tw*vec3(.38,.38,.38)+vec3(.28,.28,.28)));',
    '  else c=.5+.5*cos(TAU*(tw*vec3(1.,.75,.45)+vec3(.0,.08,.18)));',
    '  float chir=1.+M*1.12+H*1.18+FL*.45;',
    '  c=(c-.5)*chir+.5;',
    '  float punch=(.62+B*1.52+M*1.+H*.86+V*.65)*(1.+BT*2.65+EX*.62)*(1.+FL*.55);',
    '  c+=vec3(1.)*(.04*FL+.07*BT+.03*H)*sat(punch-1.2);',
    '  return c*punch;',
    '}',
    'float h11(float n){return fract(sin(n*127.1)*43758.5);}',
    'float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}',
    'float vn(vec2 p){',
    '  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    '  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);',
    '}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vn(p);p*=2.1;p=vec2(p.x*cos(.45)-p.y*sin(.45),p.x*sin(.45)+p.y*cos(.45));a*=.5;}return v;}',
    'mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
    'mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,-s,0,s,c);}',
    'mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0,s,0,1,0,-s,0,c);}',
    'mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,-s,0,s,c,0,0,0,1);}',
    'float sdSph(vec3 p,float r){return length(p)-r;}',
    'float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,vec3(0.)))+min(max(q.x,max(q.y,q.z)),0.);}',
    'float sdTorus(vec3 p,float R,float r){return length(vec2(length(p.xz)-R,p.y))-r;}',
    'float sdCyl(vec3 p,float r,float h){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,vec2(0.)));}',
    'float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float t=sat(dot(pa,ba)/dot(ba,ba));return length(pa-ba*t)-r;}',
    'float sdOct(vec3 p,float s){p=abs(p);return(p.x+p.y+p.z-s)*.57735;}',
    'float opU(float a,float b){return min(a,b);}',
    'float opRep1(float x,float s){return mod(x+s*.5,s)-s*.5;}',
    'vec3 opRep3(vec3 p,vec3 s){return mod(p+s*.5,s)-s*.5;}',
    'vec3 blinnPhong(vec3 n,vec3 rd,vec3 ldir,vec3 col,float amb){',
    '  float d=sat(dot(n,ldir));',
    '  float sh=32.-BT*10.-M*6.-FL*8.;sh=max(sh,8.);',
    '  float s=pow(sat(dot(n,normalize(ldir-rd))),sh);',
    '  return col*(amb+d*(.82+BT*.15+FL*.1))+(vec3(.85,.92,1.)*s*(.42+BT*.55+FL*.35));',
    '}',
    'mat3 camMat(vec3 ro,vec3 ta,float roll){',
    '  vec3 fwd=normalize(ta-ro);',
    '  vec3 rgt=normalize(cross(vec3(sin(roll),cos(roll),0),fwd));',
    '  return mat3(rgt,cross(fwd,rgt),fwd);',
    '}',
    'vec2 feedUV(float zoom,float rot,vec2 drift){',
    '  vec2 p=uv-.5;',
    '  float wob=B*.045+M*.028+BT*.055+FL*.04;',
    '  p+=vec2(sin(p.y*7.+T*1.4+BT*3.)*wob,sin(p.x*7.+T*.95)*wob);',
    '  p=rot2(rot+BT*.022+B*.018+FL*.015)*p;',
    '  p=p/zoom;',
    '  p+=drift;',
    '  return sat(p+.5);',
    '}',
  ].join('\n');

  NX.HEAD = HEAD;

  var CALM_NAMES = ['VOID CATHEDRAL', 'SACRED GEOMETRY', 'INK & OIL', 'DEEP SEA',
    'AFTERLIFE RINGS', 'DARK MONOLITH', 'GALAXY CORE', 'NEBULA FLYTHROUGH'];

  /**
   * @param {string} name
   * @returns {boolean}
   */
  NX.sceneHasTag = function (idx, tag) {
    var sc = NX.scenes[idx];
    if (!sc || !sc.tags) return false;
    return sc.tags.indexOf(tag) >= 0;
  };

  /**
   * @param {object} s
   */
  function normalizeScene(s) {
    var nm = (s.n || '').toUpperCase();
    if (!Array.isArray(s.tags) || s.tags.length === 0) {
      s.tags = CALM_NAMES.indexOf(s.n) >= 0 ? ['calm'] : ['intense'];
    }
    if (nm.indexOf('MANDEL') >= 0 || nm.indexOf('FRACTAL') >= 0 || nm.indexOf('BULB') >= 0 ||
        nm.indexOf('MERGER') >= 0 || nm.indexOf('APOLLON') >= 0 || nm.indexOf('KALI') >= 0 ||
        nm.indexOf('INFLECT') >= 0) {
      if (s.tags.indexOf('fractal') < 0) s.tags.push('fractal');
    }
    if (nm.indexOf('TUNNEL') >= 0 || nm.indexOf('WORM') >= 0 || nm.indexOf('HYPER') >= 0 ||
        nm.indexOf('HOLE') >= 0 || nm.indexOf('VORTEX') >= 0) {
      if (s.tags.indexOf('tunnel') < 0) s.tags.push('tunnel');
    }
    if (nm.indexOf('SACRED') >= 0 || nm.indexOf('CATHEDRAL') >= 0 || nm.indexOf('MONOLITH') >= 0 ||
        nm.indexOf('GEOMETRY') >= 0 || nm.indexOf('LATTICE') >= 0) {
      if (s.tags.indexOf('sacred') < 0) s.tags.push('sacred');
    }
    if (!s.cost) {
      if (nm.indexOf('ECHO LATTICE') >= 0 || nm === 'TUNNEL GRID') s.cost = 'low';
      else if (s.rx >= 2) s.cost = 'high';
      else if (/MANDEL|BLACK HOLE|PLASMA|VORTEX|NEURAL|LASER|HYPERSPACE|CHROME|MERGER|APOLLON|KALI|WORMHOLE/i.test(nm)) s.cost = 'high';
      else if (/GRID|TUNNEL|NEBULA|INK|DEEP|VOID|SACRED|AFTERLIFE|MONOLITH/i.test(nm)) s.cost = 'med';
      else s.cost = 'med';
    }
    return s;
  }

  /** Register a scene: { n, c, fs, tags?, cost?, rx? } */
  NX.registerScene = function (s) { NX.scenes.push(normalizeScene(s)); };

  /** Compile all registered scenes; returns count of successes. */
  NX.compileScenes = function () {
    console.log('Compiling ' + NX.scenes.length + ' scenes...');
    NX.sceneProgs = NX.scenes.map(function (s, i) {
      var p = NX.mkProg(NX.VS, s.fs);
      if (!p) console.error('Scene', i, s.n, 'FAILED');
      else console.log('OK', i, s.n);
      return p;
    });
    return NX.sceneProgs.filter(Boolean).length;
  };
})();
