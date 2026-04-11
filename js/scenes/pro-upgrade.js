'use strict';
/*  pro-upgrade.js — Concert-grade additions: fractal mirror, geometric abyss, cheap fold.
    Ray march steps scaled by LD (from engine setCommonUniforms). */

(function () {
  var H = NX.HEAD;

  NX.registerScene({
    n: 'FRACTAL MIRROR CORE', c: '#ff4081',
    tags: ['fractal', 'intense'],
    cost: 'high',
    rx: 2,
    fs: H + [
      'float fk(vec3 p){',
      '  float s=1.;',
      '  float d=sdBox(p,vec3(1.2));',
      '  for(int k=0;k<4;k++){',
      '    p=abs(p)-vec3(.65,.55,.65)*(1.+B*.05);',
      '    p=p*1.45+vec3(sin(p.z+T*.2),cos(p.x+T*.15),sin(p.y))*.08;',
      '    s*=1.45;',
      '    d=min(d,sdOct(p,.42)/s);',
      '  }',
      '  return d;',
      '}',
      'vec3 nfk(vec3 p){vec2 e=vec2(.006,0);return normalize(vec3(fk(p+e.xyy)-fk(p-e.xyy),fk(p+e.yxy)-fk(p-e.yxy),fk(p+e.yyx)-fk(p-e.yyx)));}',
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  vec3 ro=vec3(sin(T*.06)*3.,2.+MX.y*2.,cos(T*.06)*3.);',
      '  vec3 ta=vec3(0,.2,0);',
      '  mat3 cm=camMat(ro,ta,sin(T*.04)*.05);',
      '  vec3 rd=cm*normalize(vec3(st,1.4));',
      '  float t=0.;vec3 col=vec3(.01);',
      '  float ls=mix(1.22,.86,LD);',
      '  for(int i=0;i<48;i++){',
      '    vec3 p=ro+rd*t;',
      '    float d=fk(p)*ls;',
      '    if(d<.012){',
      '      vec3 n=nfk(p);',
      '      vec3 c2=pal(dot(p,vec3(.3,.5,.2))+T*.03);',
      '      col=blinnPhong(n,rd,normalize(vec3(.6,.4,.3)),c2*(.4+FL*.3),.1);',
      '      break;',
      '    }',
      '    if(t>45.)break; t+=max(.01,d*.9);',
      '  }',
      '  vec2 fuv=feedUV(1.004,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.85,col,.34+BT*.05);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'GEOMETRIC ABYSS', c: '#18ffff',
    tags: ['tunnel', 'sacred'],
    cost: 'med',
    rx: 1,
    fs: H + [
      'float ab(vec3 p){',
      '  p=opRep3(p,vec3(5.,5.,6.));',
      '  float pl=sdOct(p,1.1);',
      '  float col=sdCyl(p.xzy,.25,2.5);',
      '  float fl=p.y+1.2;',
      '  return min(min(pl,col),fl);',
      '}',
      'vec3 nab(vec3 p){vec2 e=vec2(.01,0);return normalize(vec3(ab(p+e.xyy)-ab(p-e.xyy),ab(p+e.yxy)-ab(p-e.yxy),ab(p+e.yyx)-ab(p-e.yyx)));}',
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  float tm=T*.25*SP;',
      '  vec3 ro=vec3(sin(tm)*.8,1.8+sin(T*.1)*.4,cos(tm)*.8+tm*1.2);',
      '  vec3 ta=ro+vec3(0,-.5,2.);',
      '  mat3 cm=camMat(ro,ta,0.);',
      '  vec3 rd=cm*normalize(vec3(st,1.5));',
      '  float t=0.;vec3 col=vec3(.005,.008,.02);',
      '  float ls=mix(1.3,.9,LD);',
      '  for(int i=0;i<50;i++){',
      '    vec3 p=ro+rd*t;',
      '    float d=ab(p)*ls;',
      '    if(d<.016){',
      '      vec3 n=nab(p);',
      '      vec3 c2=mix(vec3(.05,.35,.4),vec3(.9,.95,1.),sat(dot(n,vec3(0,1,0))));',
      '      col=blinnPhong(n,rd,normalize(vec3(.3,.8,.5)),c2,.15);',
      '      if(abs(p.y+1.2)<.05) col*=vec3(.2,.9,.95)*(1.+BT*.6);',
      '      break;',
      '    }',
      '    if(t>62.)break; t+=max(.012,d*.88);',
      '  }',
      '  vec2 fuv=feedUV(1.003,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.87,col,.3+BT*.05);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });
})();
