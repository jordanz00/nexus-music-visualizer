'use strict';
/*  fluid.js — Fluid / liquid scenes.
    INK & OIL, LIQUID METAL                          */

(function () {
  var H = NX.HEAD;

  /* ---------------------------------------------------------------
     1. INK & OIL  (#d500f9)
     Advected fbm fluid with thin-film iridescence, mouse-driven
     curl velocity, ink injection points pulsing per audio band.
     Feedback persistence via feedUV advection.
  --------------------------------------------------------------- */
  NX.registerScene({
    n: 'INK & OIL', rx: 2, c: '#d500f9',
    fs: H + [
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  vec2 fuv=feedUV(1.015+B*.03,T*.002+BT*.004,vec2(0));',
      '  vec3 pv=texture2D(PV,fuv).rgb;',
      '  vec2 dm=st-MX*.5;float pot=exp(-dot(dm,dm)*6.);',
      '  vec2 curl=vec2(dm.y,-dm.x)*pot*3.;',
      '  vec2 adv=st+curl*.02+(pv.rg-.5)*.06;',
      '  float f=fbm(adv*3.5+T*.25*SP);',
      '  float i1=exp(-length(st-vec2(sin(T*.7)*.3,cos(T*.5)*.3))*12.)*(.4+B*1.5);',
      '  float i2=exp(-length(st-vec2(cos(T*.4)*.4,sin(T*.6)*.2))*10.)*(.3+M*1.2);',
      '  float i3=exp(-length(st+vec2(sin(T*.9)*.2,cos(T*.3)*.4))*14.)*(.2+H*1.);',
      '  f+=i1+i2+i3;',
      '  float film=fract(f*2.5+T*.04+pv.b*.8);',
      '  vec3 c=.5+.5*cos(TAU*(film*vec3(.9,1.,.8)+vec3(.0,.15,.33)));',
      '  c+=pal(f*.3+T*.008)*.35;',
      '  c*=.85+BT*.6+FL*.25;',
      '  c=mix(pv*.965,c,.14+B*.08+BT*.12);',
      '  c+=vec3(.83,.0,.97)*.1*sat(i1+i2+i3);',
      '  gl_FragColor=vec4(c,1.);',
      '}'
    ].join('\n')
  });

  /* ---------------------------------------------------------------
     2. LIQUID METAL  (#e0e0e0)
     Morphing mercury blob — SDF sphere with bass harmonics,
     mid ripples, high shimmer.  Chrome env mapping via pal()
     on reflect direction, dual specular, curvature iridescence.
  --------------------------------------------------------------- */
  NX.registerScene({
    n: 'LIQUID METAL', c: '#e0e0e0',
    fs: H + [
      'float mp(vec3 p){',
      '  float r=1.2+B*.25,d=sdSph(p,r);',
      '  float a1=atan(p.z,p.x),a2=asin(clamp(p.y/max(length(p),.001),-1.,1.));',
      '  d+=sin(a1*3.+T*.5)*sin(a2*2.+T*.3)*.15*(.3+B*.7);',
      '  d+=sin(a1*7.+T*1.2)*sin(a2*5.+T*.8)*.05*M;',
      '  d+=vn(p.xy*14.+T*2.)*.018*H;',
      '  d+=sin(a1*2.+a2*3.+T*.35)*.06*EX;return d;',
      '}',
      'vec3 nm(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(mp(p+e.xyy)-mp(p-e.xyy),mp(p+e.yxy)-mp(p-e.yxy),mp(p+e.yyx)-mp(p-e.yyx)));}',
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  float ca=T*.12+MX.x*1.5;',
      '  vec3 ro=vec3(cos(ca)*3.5,sin(T*.08+MX.y*.5),sin(ca)*3.5);',
      '  mat3 cm=camMat(ro,vec3(0.),sin(T*.03)*.02);',
      '  vec3 rd=cm*normalize(vec3(st,1.8));',
      '  float t=0.;vec3 col=vec3(0.);',
      '  for(int i=0;i<64;i++){float d=mp(ro+rd*t);if(d<.001||t>12.)break;t+=d*.7;}',
      '  if(t<12.){',
      '    vec3 p=ro+rd*t,n=nm(p),ref=reflect(rd,n);',
      '    vec3 env=pal(ref.y*.5+ref.x*.3+T*.01)*.7+.25;',
      '    float fres=pow(1.-sat(dot(-rd,n)),3.);',
      '    float sp1=pow(sat(dot(ref,normalize(vec3(1,1,.5)))),32.)*.8;',
      '    float sp2=pow(sat(dot(ref,normalize(vec3(-1,.5,-1)))),64.)*.5;',
      '    float curv=length(nm(p+n*.02)-n)*50.;',
      '    vec3 iri=.5+.5*cos(TAU*(curv*.08+fres*2.+vec3(0,.33,.67)));',
      '    col=env*(.5+fres*.5)+vec3(1.)*(sp1+sp2)+iri*.25*(fres+.15);',
      '    col*=1.+BT*.5+FL*.2;',
      '  }',
      '  vec2 fuv=feedUV(1.008,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.88,col,.38+BT*.08);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

})();
